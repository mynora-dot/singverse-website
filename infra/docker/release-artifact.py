#!/usr/bin/env python3
"""Cache checked OCI images in GHCR; publish only final files as Release assets."""
import argparse
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from build_version import release_version

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("image_publisher", Path(__file__).with_name("release.py"))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def context(name):
    if not re.fullmatch(r"[a-z][a-z0-9-]*-(?:amd64|arm64)\.oci\.tar", name):
        raise ValueError("Invalid OCI logical name")
    repository = os.environ["GITHUB_REPOSITORY"]
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Invalid GitHub repository")
    release_version()
    return repository, os.environ["RELEASE_TAG"]


def cache_reference(repository, tag, name):
    """Keep retries for one source revision separate from all other builds."""
    version = release_version(dict(os.environ, RELEASE_TAG=tag))
    revision = os.environ.get("SOURCE_REVISION", "")
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("SOURCE_REVISION must be the locked full source commit")
    namespace = os.environ.get("GHCR_NAMESPACE") or repository.split("/")[0].lower()
    if not re.fullmatch(r"[a-z0-9]+(?:[._-][a-z0-9]+)*", namespace):
        raise ValueError("Invalid GHCR namespace")
    image = os.environ.get("OCI_CACHE_IMAGE") or repository.split("/")[1].lower() + "-buildcache"
    if not re.fullmatch(r"[a-z0-9]+(?:[._-][a-z0-9]+)*", image):
        raise ValueError("Invalid OCI cache image name")
    cache_tag = f"release-{version}-{revision}-{name.removesuffix('.oci.tar')}"
    if len(cache_tag) > 128:
        raise ValueError("OCI cache tag is too long")
    return f"ghcr.io/{namespace}/{image}:{cache_tag}"


def archive_digest(source):
    raw = subprocess.check_output(["skopeo", "inspect", "--raw", "oci-archive:" + str(source)],
                                  timeout=publisher.COPY_TIMEOUT_SECONDS)
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def restore(repository, tag, name, destination):
    reference = cache_reference(repository, tag, name)
    expected = publisher.remote_digest(reference)
    if expected is None:
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="release-oci-", dir=destination.parent) as temporary:
        stage = Path(temporary) / "image.tar"
        # Pin the read to its digest even if a registry tag changes during the copy.
        pinned = reference.rsplit(":", 1)[0] + "@" + expected
        publisher.copy_image("docker://" + pinned, "oci-archive:" + str(stage))
        if archive_digest(stage) != expected:
            raise ValueError("Restored OCI image digest mismatch")
        stage.replace(destination)
    return True


def save(repository, tag, name, source):
    if not source.is_file() or source.stat().st_size <= 0:
        raise ValueError("Checked OCI archive is missing")
    reference = cache_reference(repository, tag, name)
    expected = archive_digest(source)
    # The registry cache is immutable just like the final versioned image.
    publisher.ensure(reference, expected, lambda: publisher.copy_image(
        "oci-archive:" + str(source), "docker://" + reference))


def lookup(repository, tag, name):
    # Network/auth errors are failures, never cache misses.
    record = json.loads(subprocess.check_output(
        ["gh", "api", "repos/" + repository + "/releases/tags/" + tag], text=True))
    if record.get("tag_name") != tag or record.get("draft") or record.get("prerelease"):
        raise ValueError("Only the exact formal release may hold final assets")
    matches = [asset for asset in record["assets"] if asset["name"] == name]
    if len(matches) > 1:
        raise ValueError("Ambiguous Release asset")
    if not matches:
        return None
    asset = matches[0]
    if asset.get("state") != "uploaded" or not isinstance(asset.get("id"), int) or not isinstance(asset.get("size"), int) or asset["size"] <= 0:
        raise ValueError("Incomplete Release asset")
    return asset


def download(repository, asset, destination):
    with destination.open("wb") as target:
        subprocess.run(["gh", "api", "-H", "Accept: application/octet-stream",
                        "repos/" + repository + "/releases/assets/" + str(asset["id"])],
                       stdout=target, check=True)
    if destination.stat().st_size != asset["size"]:
        raise ValueError("Downloaded Release asset size mismatch")
    expected = asset.get("digest")
    if expected is not None and expected != "sha256:" + digest(destination):
        raise ValueError("Downloaded Release asset digest mismatch")


def save_file(repository, tag, name, source):
    asset = lookup(repository, tag, name)
    with tempfile.TemporaryDirectory(prefix="release-oci-") as temporary:
        stage = Path(temporary) / name
        if asset is not None:
            download(repository, asset, stage)
            if digest(source) != digest(stage):
                raise ValueError("Existing immutable Release asset has different content")
            return
        shutil.copyfile(source, stage)
        subprocess.run(["gh", "release", "upload", tag, str(stage), "--repo", repository], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("restore", "save"))
    parser.add_argument("--name", required=True)
    parser.add_argument("--archive", type=Path, default=Path("/tmp/image.tar"))
    args = parser.parse_args()
    repository, tag = context(args.name)
    if args.command == "restore":
        found = restore(repository, tag, args.name, args.archive)
        output = os.environ.get("GITHUB_OUTPUT")
        if output:
            with Path(output).open("a") as target:
                target.write("found=" + str(found).lower() + "\n")
        print("Reused checked OCI archive" if found else "No checked OCI archive; build required")
    else:
        save(repository, tag, args.name, args.archive)
        print("Saved checked immutable OCI image in GHCR")


if __name__ == "__main__":
    main()

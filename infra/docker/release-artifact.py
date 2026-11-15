#!/usr/bin/env python3
"""Preserve checked OCI archives in immutable GitHub Release assets, with retryable parts."""
import argparse
import hashlib
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
PART_SIZE = 1 << 30  # Keep each asset below GitHub's 2 GiB limit.
HEX = re.compile(r"[a-f0-9]{64}")


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def context(name):
    if not re.fullmatch(r"[a-z][a-z0-9-]*-(?:amd64|arm64)\.oci\.tar", name):
        raise ValueError("Invalid OCI logical asset name")
    repository = os.environ["GITHUB_REPOSITORY"]
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Invalid GitHub repository")
    release_version()
    tag = os.environ["RELEASE_TAG"]
    return repository, tag


def lookup(repository, tag, name):
    # Network/auth errors are failures, never cache misses.
    record = json.loads(subprocess.check_output(
        ["gh", "api", "repos/" + repository + "/releases/tags/" + tag], text=True))
    if record.get("tag_name") != tag or record.get("draft") or record.get("prerelease"):
        raise ValueError("Only the exact formal release may hold OCI artifacts")
    matches = [asset for asset in record["assets"] if asset["name"] == name]
    if len(matches) > 1:
        raise ValueError("Ambiguous OCI release asset")
    if not matches:
        return None
    asset = matches[0]
    if asset.get("state") != "uploaded" or not isinstance(asset.get("id"), int) or not isinstance(asset.get("size"), int) or asset["size"] <= 0:
        raise ValueError("Incomplete OCI release asset")
    return asset


def download(repository, asset, destination):
    with destination.open("wb") as target:
        subprocess.run(["gh", "api", "-H", "Accept: application/octet-stream",
                        "repos/" + repository + "/releases/assets/" + str(asset["id"])],
                       stdout=target, check=True)
    if destination.stat().st_size != asset["size"]:
        raise ValueError("Downloaded OCI asset size mismatch")
    expected = asset.get("digest")
    if expected is not None and expected != "sha256:" + digest(destination):
        raise ValueError("Downloaded OCI asset digest mismatch")


def restore(repository, tag, name, destination):
    # Read older single-asset caches as well as bounded multipart archives.
    direct = lookup(repository, tag, name)
    index = None if direct else lookup(repository, tag, name + ".json")
    if direct is None and index is None:
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="release-oci-", dir=destination.parent) as temporary:
        folder = Path(temporary)
        stage = folder / name
        if direct is not None:
            download(repository, direct, stage)
        else:
            if index["size"] > 1 << 20:
                raise ValueError("OCI part manifest is too large")
            metadata = folder / "manifest.json"
            download(repository, index, metadata)
            manifest = json.loads(metadata.read_text())
            parts = manifest.get("parts")
            if manifest.get("schemaVersion") != 1 or manifest.get("name") != name or not isinstance(manifest.get("size"), int) or manifest["size"] <= 0 or not isinstance(manifest.get("sha256"), str) or not HEX.fullmatch(manifest["sha256"]) or not isinstance(parts, list) or not 1 <= len(parts) <= 512:
                raise ValueError("Invalid OCI part manifest")
            with stage.open("wb") as target:
                for number, part in enumerate(parts):
                    checksum = part.get("sha256", "")
                    expected_name = name + ".part%04d-" % number + checksum
                    if not isinstance(checksum, str) or not HEX.fullmatch(checksum) or part.get("name") != expected_name or not isinstance(part.get("size"), int) or not 0 < part["size"] <= PART_SIZE:
                        raise ValueError("Invalid OCI part record")
                    asset = lookup(repository, tag, expected_name)
                    if asset is None or asset["size"] != part["size"]:
                        raise ValueError("Missing OCI archive part")
                    chunk = folder / "part"
                    download(repository, asset, chunk)
                    if digest(chunk) != checksum:
                        raise ValueError("OCI part checksum mismatch")
                    with chunk.open("rb") as source:
                        shutil.copyfileobj(source, target)
                    chunk.unlink()
            if stage.stat().st_size != manifest["size"] or digest(stage) != manifest["sha256"]:
                raise ValueError("OCI archive checksum mismatch")
        stage.replace(destination)
    return True


def save_file(repository, tag, name, source):
    asset = lookup(repository, tag, name)
    with tempfile.TemporaryDirectory(prefix="release-oci-") as temporary:
        stage = Path(temporary) / name
        if asset is not None:
            download(repository, asset, stage)
            if digest(source) != digest(stage):
                raise ValueError("Existing immutable OCI asset has different content")
            return
        shutil.copyfile(source, stage)
        subprocess.run(["gh", "release", "upload", tag, str(stage), "--repo", repository], check=True)


def save(repository, tag, name, source):
    if not source.is_file() or source.stat().st_size <= 0:
        raise ValueError("Checked OCI archive is missing")
    if source.stat().st_size > PART_SIZE * 512:
        raise ValueError("OCI archive exceeds supported cache size")
    with tempfile.TemporaryDirectory(prefix="release-oci-") as temporary:
        folder = Path(temporary)
        existing = folder / name
        if restore(repository, tag, name, existing):
            if digest(existing) != digest(source):
                raise ValueError("Existing immutable OCI asset has different content")
            return
        parts = []
        with source.open("rb") as archive:
            while True:
                chunk = folder / "part"
                remaining = PART_SIZE
                with chunk.open("wb") as target:
                    while remaining:
                        data = archive.read(min(1 << 20, remaining))
                        if not data:
                            break
                        target.write(data)
                        remaining -= len(data)
                if chunk.stat().st_size == 0:
                    chunk.unlink()
                    break
                checksum = digest(chunk)
                part_name = name + ".part%04d-" % len(parts) + checksum
                save_file(repository, tag, part_name, chunk)
                parts.append(dict(name=part_name, size=chunk.stat().st_size, sha256=checksum))
                chunk.unlink()
        manifest = folder / "manifest.json"
        manifest.write_text(json.dumps(dict(schemaVersion=1, name=name, size=source.stat().st_size,
                                            sha256=digest(source), parts=parts), separators=(",", ":")) + "\n")
        # Publish this pointer last. Interrupted uploads leave reusable content-addressed parts.
        save_file(repository, tag, name + ".json", manifest)


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
        print("Saved checked immutable OCI archive")


if __name__ == "__main__":
    main()

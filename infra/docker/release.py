#!/usr/bin/env python3
"""Publish checked OCI artifacts without rebuilding; refuse different immutable tags."""
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
import re
import subprocess
import shutil
import tarfile
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from build_version import release_version

ROOT = Path(__file__).resolve().parents[2]
VARIANTS = {'website': ['amd64', 'arm64']}


def config(env=os.environ):
    version = release_version(env)
    ghcr = env.get('GHCR_NAMESPACE') or env.get('GITHUB_REPOSITORY_OWNER', '').lower()
    hub = env.get('DOCKERHUB_NAMESPACE', '')
    for value in (ghcr, hub):
        if not re.fullmatch(r'[a-z0-9]+(?:[._-][a-z0-9]+)*', value):
            raise ValueError('Registry namespaces must be configured as lowercase names')
    for key in ('GHCR_TOKEN', 'DOCKERHUB_USERNAME', 'DOCKERHUB_TOKEN'):
        if not env.get(key):
            raise ValueError('Missing publishing secret: ' + key)
    return version, ['ghcr.io/' + ghcr, 'docker.io/' + hub]


COPY_TIMEOUT_SECONDS = 30 * 60
INSPECT_TIMEOUT_SECONDS = 120
PROGRESS_INTERVAL_SECONDS = 30


def copy_image(source, destination):
    """Stream layer progress and bound retries and stalled registry requests."""
    reference = destination.removeprefix('docker://')
    command = ['skopeo', '--command-timeout', f'{COPY_TIMEOUT_SECONDS}s',
               'copy', '--retry-times', '2', '--all', '--preserve-digests', source, destination]
    print('Copying image to: ' + reference, flush=True)
    started = time.monotonic()
    with subprocess.Popen(command) as process:
        while True:
            remaining = COPY_TIMEOUT_SECONDS + 5 - (time.monotonic() - started)
            if remaining <= 0:
                process.kill()
                process.wait()
                raise RuntimeError(f'Image copy timed out after {COPY_TIMEOUT_SECONDS}s: {reference}')
            try:
                status = process.wait(timeout=min(PROGRESS_INTERVAL_SECONDS, remaining))
            except subprocess.TimeoutExpired:
                print(f'Still copying {reference} ({time.monotonic() - started:.0f}s elapsed)', flush=True)
                continue
            if status:
                raise subprocess.CalledProcessError(status, command)
            break
    print(f'Copied {reference} in {time.monotonic() - started:.0f}s', flush=True)


def remote_digest(reference):
    print('Inspecting remote tag: ' + reference, flush=True)
    try:
        result = subprocess.run(['skopeo', '--command-timeout', f'{INSPECT_TIMEOUT_SECONDS}s',
                                 'inspect', '--raw', 'docker://' + reference],
                                capture_output=True, text=True, timeout=INSPECT_TIMEOUT_SECONDS + 5)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f'Registry inspection timed out after {INSPECT_TIMEOUT_SECONDS}s: {reference}') from error
    if result.returncode == 0:
        return 'sha256:' + hashlib.sha256(result.stdout.encode()).hexdigest()
    # Only an explicitly missing manifest is safe to create. Auth/network errors fail.
    if not any(code in result.stderr.lower() for code in ('manifest unknown', 'manifest_unknown', 'name unknown', 'name_unknown')):
        raise RuntimeError(f'Cannot inspect remote image {reference}: {result.stderr.strip()}; refusing to assume it is absent')
    return None


def ensure(reference, digest, publish):
    existing = remote_digest(reference)
    if existing is not None:
        if existing != digest:
            raise ValueError('Immutable image already exists with different content: ' + reference)
        print('Reusing identical immutable tag: ' + reference, flush=True)
        return
    publish()
    if remote_digest(reference) != digest:
        raise ValueError('Published image digest mismatch: ' + reference)
    print('Verified immutable tag: ' + reference, flush=True)


def manifest(entries):
    return json.dumps({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.index.v1+json',
                       'manifests': entries}, separators=(',', ':')).encode()


def layout(directory, variant, raw, destination):
    """Combine checked OCI blobs without changing image or index bytes."""
    blobs = destination / 'blobs/sha256'
    blobs.mkdir(parents=True)
    for arch in VARIANTS[variant]:
        with tarfile.open(directory / f'{variant}-{arch}' / 'image.tar') as archive:
            for member in archive:
                name = member.name.removeprefix('./')
                if not re.fullmatch(r'blobs/sha256/[a-f0-9]{64}', name):
                    continue
                if not member.isfile():
                    raise ValueError('OCI blob must be a regular file')
                target = destination / name
                if not target.exists():
                    with archive.extractfile(member) as source, target.open('wb') as output:
                        shutil.copyfileobj(source, output)
                    with target.open('rb') as source:
                        digest = hashlib.sha256()
                        for chunk in iter(lambda: source.read(1024 * 1024), b''):
                            digest.update(chunk)
                        if digest.hexdigest() != target.name:
                            raise ValueError('OCI blob checksum mismatch')
    digest = hashlib.sha256(raw).hexdigest()
    (blobs / digest).write_bytes(raw)
    descriptor = {'mediaType': 'application/vnd.oci.image.index.v1+json',
                  'digest': 'sha256:' + digest, 'size': len(raw),
                  'annotations': {'org.opencontainers.image.ref.name': 'release'}}
    (destination / 'oci-layout').write_text('{"imageLayoutVersion":"1.0.0"}')
    (destination / 'index.json').write_text(json.dumps({'schemaVersion': 2, 'manifests': [descriptor]}))


def publish(directory):
    version, prefixes = config()
    records = {}
    # Read both preserved architecture archives; publish only the combined index.
    for variant, arches in VARIANTS.items():
        image = 'singverse-website'
        suffix = ''
        entries = []
        for arch in arches:
            archive = directory / f'{variant}-{arch}' / 'image.tar'
            print('Reading OCI archive: ' + str(archive), flush=True)
            raw = subprocess.check_output(['skopeo', 'inspect', '--raw', 'oci-archive:' + str(archive)],
                                          timeout=COPY_TIMEOUT_SECONDS)
            digest = 'sha256:' + hashlib.sha256(raw).hexdigest()
            descriptor = {'mediaType': json.loads(raw)['mediaType'], 'digest': digest, 'size': len(raw),
                          'platform': {'os': 'linux', 'architecture': arch}}
            entries.append(descriptor)
        records[(image, suffix)] = (variant, manifest(entries))
    # Copy deterministic OCI indexes, keeping bytes and digests identical at all destinations.
    for (image, suffix), (variant, raw) in records.items():
        digest = 'sha256:' + hashlib.sha256(raw).hexdigest()
        with tempfile.TemporaryDirectory(prefix='singverse-release-') as temporary:
            destination = Path(temporary) / 'layout'
            layout(directory, variant, raw, destination)
            for prefix in prefixes:
                ref = f'{prefix}/{image}:{version}{suffix}'
                ensure(ref, digest, lambda ref=ref: copy_image(
                       'oci:' + str(destination) + ':release', 'docker://' + ref))
    # No latest tag is changed until every immutable version passed validation.
    for (image, suffix), (_, raw) in records.items():
        for prefix in prefixes:
            copy_image(
                f'docker://{prefix}/{image}:{version}{suffix}', f'docker://{prefix}/{image}:latest{suffix}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('validate', 'publish'))
    parser.add_argument('--artifacts', type=Path, default=Path('artifacts'))
    args = parser.parse_args()
    version, _ = config()
    if args.command == 'publish':
        publish(args.artifacts)
    print('Validated release ' + version)


if __name__ == '__main__':
    main()

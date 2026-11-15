import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('release', ROOT / 'infra/docker/release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def env(self):
        return dict(RELEASE_TAG='v1.2.3', GITHUB_REPOSITORY_OWNER='mynora-dot',
                    DOCKERHUB_NAMESPACE='custom-hub', ACR_REGISTRY='registry.example.com', ACR_NAMESPACE='custom-acr',
                    GHCR_TOKEN='test', DOCKERHUB_USERNAME='test', DOCKERHUB_TOKEN='test',
                    ACR_USERNAME='test', ACR_PASSWORD='test')

    def test_namespaces_are_independent_configuration(self):
        env = self.env()
        version, prefixes = release.config(env)
        self.assertEqual(version, '1.2.3')
        self.assertEqual(prefixes, ['ghcr.io/mynora-dot', 'docker.io/custom-hub', 'registry.example.com/custom-acr'])
        env['GITHUB_REPOSITORY_OWNER'] = 'MyNora-Dot'
        self.assertEqual(release.config(env)[1][0], 'ghcr.io/mynora-dot')
        env['GHCR_NAMESPACE'] = 'custom-ghcr'
        self.assertEqual(release.config(env)[1][0], 'ghcr.io/custom-ghcr')

    def test_missing_destination_or_secret_fails_before_publishing(self):
        for key in ('DOCKERHUB_NAMESPACE', 'ACR_REGISTRY', 'ACR_NAMESPACE', 'GHCR_TOKEN',
                    'DOCKERHUB_USERNAME', 'DOCKERHUB_TOKEN', 'ACR_USERNAME', 'ACR_PASSWORD'):
            env = self.env()
            del env[key]
            with self.subTest(key=key), self.assertRaises(ValueError):
                release.config(env)

    def test_release_tag_and_registry_validation(self):
        for key, value in [('RELEASE_TAG', 'v9.0.0-rc.1'), ('ACR_REGISTRY', 'https://registry.example.com'),
                           ('DOCKERHUB_NAMESPACE', 'UpperCase'), ('ACR_NAMESPACE', 'a/b')]:
            env = self.env()
            env[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                release.config(env)

    def test_existing_equal_tag_is_retryable_and_different_tag_is_never_written(self):
        for existing in ('sha256:equal', 'sha256:different'):
            with patch.object(release, 'remote_digest', return_value=existing), patch.object(release, 'copy_image') as publish:
                if existing.endswith('different'):
                    with self.assertRaises(ValueError):
                        release.ensure('registry/image:1.0.0', 'sha256:equal', publish)
                else:
                    release.ensure('registry/image:1.0.0', 'sha256:equal', publish)
                publish.assert_not_called()

    def test_absent_tag_is_verified_after_copy(self):
        with patch.object(release, 'remote_digest', side_effect=[None, 'sha256:expected']), patch.object(release, 'copy_image') as copy:
            release.ensure('registry/image:1.0.0', 'sha256:expected', copy)
            copy.assert_called_once()

    def test_auth_and_network_errors_do_not_count_as_absent(self):
        for error in ('unauthorized', 'connection refused', 'timeout'):
            with patch.object(release.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, '', error)):
                with self.assertRaises(RuntimeError):
                    release.remote_digest('registry/image:1.0.0')

    def test_latest_is_not_touched_if_any_version_destination_fails(self):
        raw = json.dumps({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.manifest.v1+json'}).encode()
        calls = []
        def ensure(ref, digest, publish):
            calls.append(ref)
            if ref.startswith('registry.example.com/'):
                raise RuntimeError('destination unavailable')
        with patch.dict(release.os.environ, self.env(), clear=True), patch.object(release, 'VARIANTS', {'website': ['amd64']}), \
             patch.object(release.subprocess, 'check_output', return_value=raw), patch.object(release, 'ensure', side_effect=ensure), \
             patch.object(release, 'layout'):
            with self.assertRaises(RuntimeError):
                release.publish(Path('/unused'))
        self.assertFalse(any(':latest' in ref for ref in calls))

    def test_latest_only_follows_every_successful_fixed_tag(self):
        raw = json.dumps({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.manifest.v1+json'}).encode()
        events = []
        def ensure(ref, digest, publish):
            events.append(('fixed', ref, digest))
            publish()
        def copy(*args):
            if args[-1].endswith(':latest'):
                events.append(('latest', args[-1]))
        with patch.dict(release.os.environ, self.env(), clear=True), patch.object(release, 'VARIANTS', {'website': ['amd64']}), \
             patch.object(release.subprocess, 'check_output', return_value=raw), patch.object(release, 'ensure', side_effect=ensure), \
             patch.object(release, 'layout'), patch.object(release, 'copy_image', side_effect=copy):
            release.publish(Path('/unused'))
        self.assertEqual([event[0] for event in events], ['fixed'] * 3 + ['latest'] * 3)
        self.assertEqual(len({event[2] for event in events[:3]}), 1)
        self.assertTrue(all(event[1].startswith('docker://') for event in events[-3:]))
        self.assertEqual(len({event[1] for event in events[-3:]}), 3)
        self.assertTrue(all('/singverse-website:' in event[1] for event in events))

    def test_version_index_failure_does_not_update_latest(self):
        raw = json.dumps({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.manifest.v1+json'}).encode()
        def ensure(ref, digest, publish):
            raise RuntimeError('index publication failed')
        with patch.dict(release.os.environ, self.env(), clear=True), patch.object(release, 'VARIANTS', {'website': ['amd64']}), \
             patch.object(release.subprocess, 'check_output', return_value=raw), patch.object(release, 'ensure', side_effect=ensure), \
             patch.object(release, 'layout'), patch.object(release, 'copy_image') as copy:
            with self.assertRaises(RuntimeError):
                release.publish(Path('/unused'))
            copy.assert_not_called()

    def test_stalled_copy_is_killed_and_reports_its_destination(self):
        original_popen = subprocess.Popen
        processes = []

        def spawn(command):
            process = original_popen([sys.executable, '-c', 'import time; time.sleep(60)'])
            processes.append(process)
            return process

        with patch.object(release.subprocess, 'Popen', side_effect=spawn), \
             patch.object(release, 'COPY_TIMEOUT_SECONDS', 0.02), \
             patch.object(release, 'PROGRESS_INTERVAL_SECONDS', 0.5), patch('builtins.print') as log:
            with self.assertRaisesRegex(RuntimeError, 'timed out.*registry/image:1.0.0'):
                release.copy_image('oci:/checked:release', 'docker://registry/image:1.0.0')
        self.assertIsNotNone(processes[0].poll())
        self.assertTrue(any('Still copying registry/image:1.0.0' in str(call) for call in log.call_args_list))
        self.assertFalse(any('Copied registry/image' in str(call) for call in log.call_args_list))

    def test_failed_copy_does_not_report_success(self):
        original_popen = subprocess.Popen

        def spawn(command):
            return original_popen([sys.executable, '-c', 'raise SystemExit(7)'])

        with patch.object(release.subprocess, 'Popen', side_effect=spawn), patch('builtins.print') as log:
            with self.assertRaises(subprocess.CalledProcessError) as caught:
                release.copy_image('oci:/checked:release', 'docker://registry/image:1.0.0')
        self.assertEqual(caught.exception.returncode, 7)
        self.assertFalse(any('Copied registry/image' in str(call) for call in log.call_args_list))

    def test_remote_inspection_timeout_never_creates_a_tag(self):
        with patch.object(release.subprocess, 'run', side_effect=subprocess.TimeoutExpired(['skopeo'], 120)), \
             patch.object(release, 'copy_image') as copy:
            with self.assertRaisesRegex(RuntimeError, 'Registry inspection timed out.*registry/image:1.0.0'):
                release.ensure('registry/image:1.0.0', 'sha256:expected', copy)
        copy.assert_not_called()

    def test_oci_layout_preserves_blob_bytes_and_deterministic_index(self):
        raw = release.manifest([])
        data = b'checked image content'
        digest = hashlib.sha256(data).hexdigest()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'website-amd64'
            source.mkdir()
            with tarfile.open(source / 'image.tar', 'w') as archive:
                member = tarfile.TarInfo('blobs/sha256/' + digest)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
            with patch.object(release, 'VARIANTS', {'website': ['amd64']}):
                release.layout(root, 'website', raw, root / 'layout')
            self.assertEqual((root / 'layout/blobs/sha256' / digest).read_bytes(), data)
            index = json.loads((root / 'layout/index.json').read_text())
            descriptor = index['manifests'][0]
            self.assertEqual(descriptor['digest'], 'sha256:' + hashlib.sha256(raw).hexdigest())
            self.assertEqual((root / 'layout/blobs/sha256' / descriptor['digest'].split(':')[1]).read_bytes(), raw)



    def test_multiarch_release_has_only_version_and_latest_and_reuses_fixed_tags(self):
        registries, copies, raw_manifests = {}, [], {}

        def checksum(data):
            return 'sha256:' + hashlib.sha256(data).hexdigest()

        def copy(source, destination):
            if source.startswith('oci:'):
                folder = Path(source[4:-len(':release')])
                root = json.loads((folder/'index.json').read_bytes())['manifests'][0]
                raw = (folder/'blobs/sha256'/root['digest'].split(':')[1]).read_bytes()
                self.assertEqual(checksum(raw), root['digest'])
                entries = json.loads(raw)['manifests']
                self.assertEqual({entry['platform']['architecture'] for entry in entries}, {'amd64', 'arm64'})
                for entry in entries:
                    self.assertEqual(entry['platform']['os'], 'linux')
                    data = (folder/'blobs/sha256'/entry['digest'].split(':')[1]).read_bytes()
                    self.assertEqual(checksum(data), entry['digest'])
                    manifest = json.loads(data)
                    # Config and layers remain reachable without architecture tags.
                    for descriptor in [manifest['config'], *manifest['layers']]:
                        blob = (folder/'blobs/sha256'/descriptor['digest'].split(':')[1]).read_bytes()
                        self.assertEqual(checksum(blob), descriptor['digest'])
                        self.assertEqual(len(blob), descriptor['size'])
            else:
                raw = registries[source[len('docker://'):]]
            registries[destination[len('docker://'):]] = raw
            copies.append(destination)

        def inspect(command, **kwargs):
            return raw_manifests[Path(command[-1][len('oci-archive:'):]).parent.name]

        def remote_digest(reference):
            raw = registries.get(reference)
            return checksum(raw) if raw is not None else None

        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            for arch in ('amd64', 'arm64'):
                name = 'website-' + arch
                folder = directory/name
                folder.mkdir()
                config = json.dumps({'architecture': arch, 'os': 'linux'}).encode()
                layer = ('checked layer for ' + arch).encode()
                raw = json.dumps({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.manifest.v1+json',
                                  'config': {'mediaType': 'application/vnd.oci.image.config.v1+json',
                                             'digest': checksum(config), 'size': len(config)},
                                  'layers': [{'mediaType': 'application/vnd.oci.image.layer.v1.tar',
                                              'digest': checksum(layer), 'size': len(layer)}]}).encode()
                raw_manifests[name] = raw
                with tarfile.open(folder/'image.tar', 'w') as archive:
                    for data in (config, layer, raw):
                        member = tarfile.TarInfo('blobs/sha256/' + checksum(data).split(':')[1])
                        member.size = len(data)
                        archive.addfile(member, io.BytesIO(data))
            with patch.dict(release.os.environ, self.env(), clear=True), \
                 patch.object(release.subprocess, 'check_output', side_effect=inspect), \
                 patch.object(release, 'remote_digest', side_effect=remote_digest), \
                 patch.object(release, 'copy_image', side_effect=copy):
                prefixes = release.config(self.env())[1]
                release.publish(directory)
                self.assertEqual(len(copies), 6)
                self.assertTrue(all(ref.endswith(':1.2.3') for ref in copies[:3]))
                self.assertTrue(all(ref.endswith(':latest') for ref in copies[3:]))
                self.assertEqual(set(registries), {f'{prefix}/singverse-website:{tag}' for prefix in prefixes
                                                  for tag in ('1.2.3', 'latest')})
                for prefix in prefixes:
                    self.assertEqual(registries[f'{prefix}/singverse-website:1.2.3'],
                                     registries[f'{prefix}/singverse-website:latest'])
                release.publish(directory)
                self.assertEqual(len(copies), 9, 'Retries reuse fixed tags and only refresh latest')
                registries[f'{prefixes[-1]}/singverse-website:1.2.3'] = b'different immutable content'
                with self.assertRaisesRegex(ValueError, 'Immutable image'):
                    release.publish(directory)
                self.assertEqual(len(copies), 9, 'Conflicting fixed tags must never update latest')


if __name__ == '__main__':
    unittest.main()

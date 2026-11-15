import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import call, patch

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('resolve_release', ROOT / 'infra/docker/resolve-release.py')
resolver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resolver)


class ResolveReleaseTests(unittest.TestCase):
    revision = 'a' * 40

    def env(self):
        return dict(RELEASE_TAG='v1.2.3', GITHUB_REPOSITORY='owner/repo')

    def record(self, **changes):
        return json.dumps(dict(dict(tag_name='v1.2.3', draft=False, prerelease=False,
                                    published_at='2026-11-15T00:00:00Z'), **changes))

    def test_empty_tag_only_checks_current_commit_without_release_api(self):
        with patch.object(resolver, 'command', return_value=self.revision) as command:
            self.assertEqual(resolver.resolve({}),
                             dict(revision=self.revision, release_tag='', version='0.0.0', publish='false'))
            command.assert_called_once_with('git', 'rev-parse', 'HEAD^{commit}')

    def test_published_tag_uses_peeled_commit_and_tag_version(self):
        with patch.object(resolver, 'command', side_effect=[self.record(), '', self.revision]) as command:
            self.assertEqual(resolver.resolve(self.env()),
                             dict(revision=self.revision, release_tag='v1.2.3', version='1.2.3', publish='true'))
            self.assertEqual(command.call_args_list, [
                call('gh', 'api', 'repos/owner/repo/releases/tags/v1.2.3'),
                call('git', 'fetch', '--no-tags', '--depth=1', 'origin', 'refs/tags/v1.2.3'),
                call('git', 'rev-parse', 'FETCH_HEAD^{commit}'),
            ])

    def test_invalid_tag_and_repository_fail_before_network(self):
        for key, values in [('RELEASE_TAG', ['main', 'v1.2.3-rc1', 'v01.2.3', '../main', 'v1.2.3\npublish=true']),
                            ('GITHUB_REPOSITORY', ['', 'owner/repo/extra', 'https://github.com/owner/repo'])]:
            for value in values:
                env = dict(self.env(), **{key: value})
                with self.subTest(key=key, value=value), patch.object(resolver, 'command') as command:
                    with self.assertRaises(ValueError):
                        resolver.resolve(env)
                    command.assert_not_called()

    def test_missing_draft_prerelease_and_wrong_releases_never_fetch_source(self):
        for change in [dict(draft=True), dict(prerelease=True), dict(tag_name='v1.2.4'),
                       dict(published_at=None), dict(draft=None), dict(prerelease=None)]:
            with self.subTest(change=change), patch.object(resolver, 'command', return_value=self.record(**change)) as command:
                with self.assertRaises(ValueError):
                    resolver.resolve(self.env())
                self.assertEqual(command.call_count, 1)

    def test_api_failure_is_fatal(self):
        with patch.object(resolver, 'command', side_effect=subprocess.CalledProcessError(1, 'gh')):
            with self.assertRaises(subprocess.CalledProcessError):
                resolver.resolve(self.env())

    def test_injected_version_must_match_tag(self):
        with patch.object(resolver, 'command', side_effect=[self.record(), '', self.revision, '1.2.4']):
            with self.assertRaisesRegex(ValueError, 'VERSION'):
                resolver.resolve(dict(self.env(), SINGVERSE_VERSION='1.2.4'))

    def test_invalid_revision_cannot_be_written_as_action_output(self):
        with patch.object(resolver, 'command', return_value='abc\npublish=true'):
            with self.assertRaises(ValueError):
                resolver.resolve({})


if __name__ == '__main__':
    unittest.main()

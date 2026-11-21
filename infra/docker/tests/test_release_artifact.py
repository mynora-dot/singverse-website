import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("release_artifact", ROOT / "infra/docker/release-artifact.py")
cache = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cache)


class ArtifactCacheTests(unittest.TestCase):
    def env(self):
        return dict(RELEASE_TAG="v0.1.0", GITHUB_REPOSITORY="owner/repo",
                    SOURCE_REVISION="a" * 40)

    def record(self, assets):
        return dict(tag_name="v0.1.0", draft=False, prerelease=False, assets=assets)

    def asset(self, data=b"checked"):
        return dict(name="package.dmg", id=42, state="uploaded", size=len(data),
                    digest="sha256:" + hashlib.sha256(data).hexdigest())

    def test_cache_identity_includes_repo_version_source_variant_and_arch(self):
        with patch.dict(cache.os.environ, self.env(), clear=True):
            reference = cache.cache_reference("owner/repo", "v0.1.0", "base-amd64.oci.tar")
            self.assertEqual(reference, "ghcr.io/owner/repo-buildcache:release-0.1.0-" + "a" * 40 + "-base-amd64")
            for repository, tag, name in (("owner/another", "v0.1.0", "base-amd64.oci.tar"),
                                           ("owner/repo", "v0.2.0", "base-amd64.oci.tar"),
                                           ("owner/repo", "v0.1.0", "base-arm64.oci.tar"),
                                           ("owner/repo", "v0.1.0", "cuda-amd64.oci.tar")):
                self.assertNotEqual(cache.cache_reference(repository, tag, name), reference)
            with patch.dict(cache.os.environ, SOURCE_REVISION="b" * 40):
                self.assertNotEqual(cache.cache_reference("owner/repo", "v0.1.0", "base-amd64.oci.tar"), reference)
            with patch.dict(cache.os.environ, OCI_CACHE_IMAGE="singverse-buildcache"):
                self.assertTrue(cache.cache_reference("owner/repo", "v0.1.0", "base-amd64.oci.tar").startswith("ghcr.io/owner/singverse-buildcache:"))
            with patch.dict(cache.os.environ, GHCR_NAMESPACE="custom"):
                self.assertTrue(cache.cache_reference("owner/repo", "v0.1.0", "base-amd64.oci.tar").startswith("ghcr.io/custom/"))

    def test_missing_source_lock_and_invalid_context_are_rejected(self):
        for key, value in (("SOURCE_REVISION", ""), ("SOURCE_REVISION", "main"),
                           ("GHCR_NAMESPACE", "a/b"), ("OCI_CACHE_IMAGE", "UpperCase"),
                           ("RELEASE_TAG", "v0.1.0-rc1"),
                           ("SINGVERSE_VERSION", "0.2.0")):
            with patch.dict(cache.os.environ, dict(self.env(), **{key: value}), clear=True):
                with self.subTest(key=key), self.assertRaises(ValueError):
                    cache.cache_reference("owner/repo", cache.os.environ["RELEASE_TAG"], "base-amd64.oci.tar")
        with patch.dict(cache.os.environ, self.env(), clear=True):
            with self.assertRaises(ValueError):
                cache.context("../../image.tar")

    def test_only_missing_manifest_is_a_cache_miss(self):
        with patch.dict(cache.os.environ, self.env(), clear=True), \
             patch.object(cache.publisher, "remote_digest", return_value=None), \
             patch.object(cache.publisher, "copy_image") as copy:
            with tempfile.TemporaryDirectory() as temporary:
                target = Path(temporary) / "image.tar"
                self.assertFalse(cache.restore("owner/repo", "v0.1.0", "base-amd64.oci.tar", target))
                self.assertFalse(target.exists())
            copy.assert_not_called()
        for error in ("unauthorized", "timeout", "connection refused"):
            with patch.dict(cache.os.environ, self.env(), clear=True), \
                 patch.object(cache.publisher.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "", error)):
                with self.subTest(error=error), self.assertRaises(RuntimeError):
                    cache.restore("owner/repo", "v0.1.0", "base-amd64.oci.tar", Path("/unused"))

    def test_restore_pins_digest_and_atomically_verifies_archive(self):
        expected = "sha256:" + "1" * 64
        def copy(source, destination):
            self.assertEqual(source, "docker://ghcr.io/owner/repo-buildcache@" + expected)
            Path(destination.removeprefix("oci-archive:")).write_bytes(b"checked image")
        with patch.dict(cache.os.environ, self.env(), clear=True), \
             patch.object(cache.publisher, "remote_digest", return_value=expected), \
             patch.object(cache.publisher, "copy_image", side_effect=copy), \
             patch.object(cache, "archive_digest", return_value=expected):
            with tempfile.TemporaryDirectory() as temporary:
                target = Path(temporary) / "nested/image.tar"
                self.assertTrue(cache.restore("owner/repo", "v0.1.0", "base-amd64.oci.tar", target))
                self.assertEqual(target.read_bytes(), b"checked image")
                target.write_bytes(b"existing")
                with patch.object(cache, "archive_digest", return_value="sha256:corrupt"):
                    with self.assertRaisesRegex(ValueError, "digest mismatch"):
                        cache.restore("owner/repo", "v0.1.0", "base-amd64.oci.tar", target)
                self.assertEqual(target.read_bytes(), b"existing")

    def test_registry_roundtrip_retries_reuse_content_and_conflicts_never_overwrite(self):
        registry, copies = {}, []
        def inspect(reference):
            data = registry.get(reference)
            return "sha256:" + hashlib.sha256(data).hexdigest() if data is not None else None
        def copy(source, destination):
            copies.append((source, destination))
            if source.startswith("oci-archive:"):
                registry[destination.removeprefix("docker://")] = Path(source.removeprefix("oci-archive:")).read_bytes()
            else:
                checksum = source.rsplit("@", 1)[1]
                data = next(data for data in registry.values() if "sha256:" + hashlib.sha256(data).hexdigest() == checksum)
                Path(destination.removeprefix("oci-archive:")).write_bytes(data)
        def local_digest(source):
            return "sha256:" + cache.digest(source)
        with patch.dict(cache.os.environ, self.env(), clear=True), \
             patch.object(cache.publisher, "remote_digest", side_effect=inspect), \
             patch.object(cache.publisher, "copy_image", side_effect=copy), \
             patch.object(cache, "archive_digest", side_effect=local_digest):
            with tempfile.TemporaryDirectory() as temporary:
                source, target = Path(temporary) / "source.tar", Path(temporary) / "restored.tar"
                source.write_bytes(b"checked")
                cache.save("owner/repo", "v0.1.0", "base-amd64.oci.tar", source)
                self.assertEqual(len(copies), 1)
                cache.save("owner/repo", "v0.1.0", "base-amd64.oci.tar", source)
                self.assertEqual(len(copies), 1)
                self.assertTrue(cache.restore("owner/repo", "v0.1.0", "base-amd64.oci.tar", target))
                self.assertEqual(target.read_bytes(), source.read_bytes())
                source.write_bytes(b"different")
                with self.assertRaisesRegex(ValueError, "Immutable image"):
                    cache.save("owner/repo", "v0.1.0", "base-amd64.oci.tar", source)
                self.assertEqual(len(copies), 2)

    def test_invalid_local_archive_is_never_published(self):
        with patch.object(cache.publisher, "copy_image") as copy:
            with tempfile.TemporaryDirectory() as temporary:
                source = Path(temporary) / "image.tar"
                for create in (False, True):
                    if create:
                        source.touch()
                    with self.assertRaisesRegex(ValueError, "archive is missing"):
                        cache.save("owner/repo", "v0.1.0", "base-amd64.oci.tar", source)
            copy.assert_not_called()

    def test_final_file_upload_remains_immutable_and_never_clobbers(self):
        with patch.object(cache.subprocess, "check_output", return_value=json.dumps(self.record([]))), \
             patch.object(cache.subprocess, "run") as run:
            with tempfile.TemporaryDirectory() as temporary:
                source = Path(temporary) / "package.dmg"
                source.write_bytes(b"checked")
                cache.save_file("owner/repo", "v0.1.0", "package.dmg", source)
            args = run.call_args.args[0]
            self.assertEqual(args[:4], ["gh", "release", "upload", "v0.1.0"])
            self.assertEqual(Path(args[4]).name, "package.dmg")
            self.assertNotIn("--clobber", args)
        def download(args, stdout, check):
            stdout.write(b"checked")
        with patch.object(cache.subprocess, "check_output", return_value=json.dumps(self.record([self.asset()]))), \
             patch.object(cache.subprocess, "run", side_effect=download):
            with tempfile.TemporaryDirectory() as temporary:
                source = Path(temporary) / "package.dmg"
                source.write_bytes(b"checked")
                cache.save_file("owner/repo", "v0.1.0", "package.dmg", source)
                source.write_bytes(b"different")
                with self.assertRaisesRegex(ValueError, "immutable Release asset"):
                    cache.save_file("owner/repo", "v0.1.0", "package.dmg", source)


if __name__ == "__main__":
    unittest.main()

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
    def record(self, assets):
        return dict(tag_name="v0.1.0", draft=False, prerelease=False, assets=assets)

    def asset(self, data=b"checked"):
        return dict(name="base-amd64.oci.tar", id=42, state="uploaded", size=len(data),
                    digest="sha256:" + hashlib.sha256(data).hexdigest())

    def test_missing_asset_is_the_only_cache_miss(self):
        with patch.object(cache.subprocess, "check_output", return_value=json.dumps(self.record([]))):
            with tempfile.TemporaryDirectory() as temporary:
                target = Path(temporary) / "image.tar"
                self.assertFalse(cache.restore("owner/repo", "v0.1.0", "base-amd64.oci.tar", target))
                self.assertFalse(target.exists())

    def test_lookup_failures_are_not_cache_misses(self):
        with patch.object(cache.subprocess, "check_output", side_effect=subprocess.CalledProcessError(1, "gh")):
            with self.assertRaises(subprocess.CalledProcessError):
                cache.lookup("owner/repo", "v0.1.0", "base-amd64.oci.tar")

    def test_restore_uses_asset_id_and_checks_digest(self):
        data = b"checked"
        def download(args, stdout, check):
            self.assertEqual(args[-1], "repos/owner/repo/releases/assets/42")
            self.assertTrue(check)
            stdout.write(data)
        with patch.object(cache.subprocess, "check_output", return_value=json.dumps(self.record([self.asset(data)]))), \
             patch.object(cache.subprocess, "run", side_effect=download):
            with tempfile.TemporaryDirectory() as temporary:
                target = Path(temporary) / "image.tar"
                self.assertTrue(cache.restore("owner/repo", "v0.1.0", "base-amd64.oci.tar", target))
                self.assertEqual(target.read_bytes(), data)

    def test_corrupt_restore_does_not_replace_existing_archive(self):
        with patch.object(cache.subprocess, "check_output", return_value=json.dumps(self.record([self.asset()]))), \
             patch.object(cache.subprocess, "run", side_effect=lambda args, stdout, check: stdout.write(b"corrupt")):
            with tempfile.TemporaryDirectory() as temporary:
                target = Path(temporary) / "image.tar"
                target.write_bytes(b"original")
                with self.assertRaises(ValueError):
                    cache.restore("owner/repo", "v0.1.0", "base-amd64.oci.tar", target)
                self.assertEqual(target.read_bytes(), b"original")

    def test_same_asset_is_retryable_but_different_content_is_rejected(self):
        def download(args, stdout, check):
            stdout.write(b"checked")
        with patch.object(cache.subprocess, "check_output", return_value=json.dumps(self.record([self.asset()]))), \
             patch.object(cache.subprocess, "run", side_effect=download) as run:
            with tempfile.TemporaryDirectory() as temporary:
                source = Path(temporary) / "image.tar"
                source.write_bytes(b"checked")
                cache.save("owner/repo", "v0.1.0", "base-amd64.oci.tar", source)
                source.write_bytes(b"different")
                with self.assertRaises(ValueError):
                    cache.save("owner/repo", "v0.1.0", "base-amd64.oci.tar", source)
            self.assertTrue(all(call.args[0][1] == "api" for call in run.call_args_list))

    def test_new_asset_upload_never_clobbers(self):
        with patch.object(cache.subprocess, "check_output", return_value=json.dumps(self.record([]))), \
             patch.object(cache.subprocess, "run") as run:
            with tempfile.TemporaryDirectory() as temporary:
                source = Path(temporary) / "image.tar"
                source.write_bytes(b"checked")
                cache.save_file("owner/repo", "v0.1.0", "base-amd64.oci.tar", source)
            args = run.call_args.args[0]
            self.assertEqual(args[:4], ["gh", "release", "upload", "v0.1.0"])
            self.assertEqual(Path(args[4]).name, "base-amd64.oci.tar")
            self.assertNotIn("--clobber", args)

    def test_draft_prerelease_incomplete_and_duplicate_assets_are_rejected(self):
        records = [dict(self.record([]), draft=True), dict(self.record([]), prerelease=True),
                   dict(self.record([]), tag_name="v0.2.0"),
                   self.record([dict(self.asset(), state="new")]),
                   self.record([self.asset(), self.asset()])]
        for record in records:
            with self.subTest(record=record), \
                 patch.object(cache.subprocess, "check_output", return_value=json.dumps(record)):
                with self.assertRaises(ValueError):
                    cache.lookup("owner/repo", "v0.1.0", "base-amd64.oci.tar")

    def test_multipart_roundtrip_and_interrupted_upload_resume(self):
        remote = {}
        uploads = []
        def response(*args, **kwargs):
            return json.dumps(self.record([dict(name=name, id=asset["id"], state="uploaded",
                size=len(asset["data"]), digest="sha256:" + hashlib.sha256(asset["data"]).hexdigest())
                for name, asset in remote.items()]))
        def command(args, **kwargs):
            if args[1] == "api":
                asset_id = int(args[-1].rsplit("/", 1)[1])
                data = next(asset["data"] for asset in remote.values() if asset["id"] == asset_id)
                kwargs["stdout"].write(data)
            else:
                source = Path(args[4])
                self.assertNotIn(source.name, remote)
                uploads.append(source.name)
                remote[source.name] = dict(id=len(remote) + 100, data=source.read_bytes())
        with patch.object(cache, "PART_SIZE", 3), \
             patch.object(cache.subprocess, "check_output", side_effect=response), \
             patch.object(cache.subprocess, "run", side_effect=command):
            with tempfile.TemporaryDirectory() as temporary:
                source = Path(temporary) / "source.tar"
                restored = Path(temporary) / "restored.tar"
                source.write_bytes(b"12345678")
                name = "base-amd64.oci.tar"
                cache.save("owner/repo", "v0.1.0", name, source)
                self.assertEqual(len(uploads), 4)
                self.assertEqual(uploads[-1], name + ".json")
                self.assertTrue(cache.restore("owner/repo", "v0.1.0", name, restored))
                self.assertEqual(restored.read_bytes(), source.read_bytes())
                del remote[name + ".json"]  # Previous attempt stopped before the pointer upload.
                uploads.clear()
                cache.save("owner/repo", "v0.1.0", name, source)
                self.assertEqual(uploads, [name + ".json"])
                source.write_bytes(b"different")
                with self.assertRaises(ValueError):
                    cache.save("owner/repo", "v0.1.0", name, source)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Use the Release tag as the version authority; local builds default to 0.0.0."""
import argparse
import os
from pathlib import Path
import re

SEMVER = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")


def release_version(env=None):
    env = os.environ if env is None else env
    tag = env.get("RELEASE_TAG", "")
    if not tag.startswith("v") or not SEMVER.fullmatch(tag[1:]):
        raise ValueError("RELEASE_TAG must be vMAJOR.MINOR.PATCH, for example v0.0.1")
    version = tag[1:]
    if env.get("SINGVERSE_VERSION") and env["SINGVERSE_VERSION"] != version:
        raise ValueError("SINGVERSE_VERSION must match RELEASE_TAG")
    return version


def build_version(env=None, required=False):
    env = os.environ if env is None else env
    if env.get("RELEASE_TAG"):
        return release_version(env)
    version = env.get("SINGVERSE_VERSION", "")
    if not version:
        if required:
            raise ValueError("Set RELEASE_TAG or SINGVERSE_VERSION for a release build")
        return "0.0.0"
    if not SEMVER.fullmatch(version):
        raise ValueError("SINGVERSE_VERSION must use major.minor.patch")
    return version


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--github-env", action="store_true")
    parser.add_argument("--required", action="store_true")
    args = parser.parse_args()
    version = build_version(required=args.required)
    if args.github_env:
        with Path(os.environ["GITHUB_ENV"]).open("a", encoding="utf-8") as output:
            output.write("SINGVERSE_VERSION=" + version + "\n")
    print(version)


if __name__ == "__main__":
    main()

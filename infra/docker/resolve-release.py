#!/usr/bin/env python3
"""Resolve a published stable Release to one immutable source commit before building."""
import json
import os
import sys
from pathlib import Path
import re
import subprocess

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from build_version import build_version, release_version


def command(*args):
    return subprocess.check_output(args, text=True).strip()


def commit(ref):
    revision = command('git', 'rev-parse', ref + '^{commit}')
    if not re.fullmatch(r'[a-f0-9]{40}', revision):
        raise ValueError('Expected a full GitHub commit SHA')
    return revision


def resolve(env=os.environ):
    tag = env.get('RELEASE_TAG', '')
    if not tag:
        return dict(revision=commit('HEAD'), release_tag='', version=build_version(env), publish='false')
    if not re.fullmatch(r'v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', tag):
        raise ValueError('RELEASE_TAG must be a stable vMAJOR.MINOR.PATCH tag')
    repository = env.get('GITHUB_REPOSITORY', '')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid GitHub repository')
    record = json.loads(command('gh', 'api', f'repos/{repository}/releases/tags/{tag}'))
    if (record.get('tag_name') != tag or record.get('draft') is not False
            or record.get('prerelease') is not False or not record.get('published_at')):
        raise ValueError('Only an existing published stable GitHub Release may be published')
    # Resolve the exact tag, including annotated tags, never the dispatch branch or target_commitish.
    command('git', 'fetch', '--no-tags', '--depth=1', 'origin', 'refs/tags/' + tag)
    revision = commit('FETCH_HEAD')
    version = release_version(env)
    return dict(revision=revision, release_tag=tag, version=version, publish="true")


def main():
    result = resolve()
    if os.environ.get('GITHUB_OUTPUT'):
        with Path(os.environ['GITHUB_OUTPUT']).open('a') as output:
            for name, value in result.items():
                output.write(name + '=' + value + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()

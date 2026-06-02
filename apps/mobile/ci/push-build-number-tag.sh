#!/usr/bin/env bash
set -euo pipefail

# Usage: push-build-number-tag.sh <platform> <buildNumber> <baseTag>
# Pushes annotated tag <baseTag>-<platform>.<buildNumber>. Idempotent: existing tag → skip.

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <platform> <buildNumber> <baseTag>" >&2
  exit 2
fi

platform="$1"
build_number="$2"
base_tag="$3"

case "$platform" in
  ios|android) ;;
  *) echo "platform must be 'ios' or 'android', got '$platform'" >&2; exit 2 ;;
esac

if ! [[ "$build_number" =~ ^[0-9]+$ ]]; then
  echo "buildNumber must be a non-negative integer, got '$build_number'" >&2
  exit 2
fi

if ! [[ "$base_tag" =~ ^mobile-v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "baseTag must match 'mobile-v<semver>', got '$base_tag'" >&2
  exit 2
fi

tag_name="${base_tag}-${platform}.${build_number}"

if git rev-parse --verify "refs/tags/${tag_name}" >/dev/null 2>&1; then
  echo "tag ${tag_name} already exists, skipping (idempotent)"
  exit 0
fi

git config user.name "${GIT_AUTHOR_NAME:-pearlkeeper-ci-bot}"
git config user.email "${GIT_AUTHOR_EMAIL:-ci@pearlkeeper.com}"

message="Mobile build ${platform} #${build_number} for ${base_tag}"
git tag -a "${tag_name}" -m "${message}"
git push origin "refs/tags/${tag_name}"

echo "pushed tag ${tag_name}"

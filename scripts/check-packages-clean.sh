#!/usr/bin/env bash
# : Fail if any file under packages/ imports a platform-specific
# package (react-native, expo-*, @react-native-*, @react-navigation/*).
#
# introduced @prl-wallet/app-adapters / app-state / app-flows as
# platform-agnostic packages. Desktop () relies on zero platform
# imports leaking into packages/** so the Tauri bundle stays clean.
#
# Exit 0: no violations. Exit 1: at least one banned import found, printed
# with its file + line so reviewers can locate it immediately.
set -u

# Exclude packages/*/node_modules and packages/*/dist so third-party code and
# compiled output never trigger false positives. grep -r handles this when we
# point at source directories explicitly.
#
# We scan packages/*/src/ to keep the sweep fast and precise.
VIOLATIONS=$(
  grep -rnE "from ['\"](expo-|@react-native-|react-native|@react-navigation)" \
    packages/*/src \
    2>/dev/null
) || true

if [ -n "${VIOLATIONS}" ]; then
  echo "VIOLATION: platform import found in packages/**"
  echo "${VIOLATIONS}"
  exit 1
fi

exit 0

#!/usr/bin/env bash
# closed-schema invariant guard.
# Reject any change to packages/api-schemas/src/analytics.ts that introduces
# z.any() / z.unknown() / z.record() / .passthrough() — the closed-shape
# defense-in-depth layer requires the schema to be tight ( layer #3).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="$REPO_ROOT/packages/api-schemas/src/analytics.ts"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "[lint-analytics-schema] $SCHEMA_FILE not found — must land first." >&2
  exit 1
fi

VIOLATIONS=0
# Strip single-line // comments and block /* ... */ comments before pattern
# matching so explanatory comments that mention the forbidden tokens (e.g.
# "// NO z.unknown() / z.any() escape hatch") do not trip the guard.
SCHEMA_NOCOMMENT=$(sed -E 's://.*$::; s:/\*[^*]*\*+([^/*][^*]*\*+)*/::g' "$SCHEMA_FILE")
for pat in 'z\.any\(' 'z\.unknown\(' 'z\.record\(' '\.passthrough\('; do
  if echo "$SCHEMA_NOCOMMENT" | grep -nE "$pat" >&2; then
    echo "[lint-analytics-schema] forbidden pattern '$pat' found in $SCHEMA_FILE (non-comment)" >&2
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# Required tokens () — schema MUST contain both EventNameSchema + FlowIdSchema.
for token in 'EventNameSchema' 'FlowIdSchema'; do
  if ! grep -q "$token" "$SCHEMA_FILE"; then
    echo "[lint-analytics-schema] required token '$token' missing from $SCHEMA_FILE" >&2
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# Bounded analytics.track( call surface (). Allowed roots:
# packages/analytics/, packages/eslint-config/, packages/api-schemas/,
# packages/api-client/, apps/*/src/screens/Settings/Analytics*,
# apps/backend/src/routes/v1/analytics.ts,
# apps/backend/src/services/analyticsAggregator.ts
# Test/mock files are exempt ().
ALLOWED_ROOTS_RE='^(packages/(analytics|eslint-config|api-schemas|api-client)/|apps/[^/]+/src/screens/Settings/Analytics|apps/backend/src/(routes/v1/analytics\.ts|services/analyticsAggregator\.ts))'
TEST_FILE_RE='(__tests__|__mocks__|\.test\.|\.spec\.)'

OUT_OF_BAND=$(grep -rln 'analytics\.track(' "$REPO_ROOT" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.planning \
  --exclude-dir=.claude --exclude-dir=.git --exclude-dir=scripts 2>/dev/null \
  | sed "s|^$REPO_ROOT/||" \
  | grep -vE "$TEST_FILE_RE" \
  | grep -vE "$ALLOWED_ROOTS_RE" \
  || true)

if [ -n "$OUT_OF_BAND" ]; then
  echo "[lint-analytics-schema] out-of-band analytics.track( call sites:" >&2
  echo "$OUT_OF_BAND" >&2
  VIOLATIONS=$((VIOLATIONS + 1))
fi

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "[lint-analytics-schema] $VIOLATIONS violation(s)" >&2
  exit 1
fi

echo "[lint-analytics-schema] OK"
exit 0

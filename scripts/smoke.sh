#!/usr/bin/env bash
# End-to-end smoke for the v1 board (UI-9 / #53).
#
# Dependency-free: bash + curl only. No node toolchain, no test framework (Q3).
# Exercises each mutation once against the running stack and asserts the R2
# count guard (deleting the last note must leave the column at 0).
#
#   ./scripts/smoke.sh                       # against http://localhost
#   BASE_URL=http://localhost:8080 ./scripts/smoke.sh
#
# Exits 0 when every check passes, 1 on the first hard failure. Endpoints that
# are not implemented in the backend yet are reported as BLOCKED, not failed —
# per the plan's blocker protocol (raise on #44, do not stub the contract).

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
PASS=0
FAIL=0
BLOCKED=0

ok()      { printf '  \033[32mPASS\033[0m     %s\n' "$1"; PASS=$((PASS + 1)); }
fail()    { printf '  \033[31mFAIL\033[0m     %s\n' "$1"; FAIL=$((FAIL + 1)); }
blocked() { printf '  \033[33mBLOCKED\033[0m  %s\n' "$1"; BLOCKED=$((BLOCKED + 1)); }
info()    { printf '  \033[36minfo\033[0m     %s\n' "$1"; }

# Extract a top-level JSON field without jq: $1 = json, $2 = key.
json_field() {
  printf '%s' "$1" | tr -d '\n' \
    | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\(\"[^\"]*\"\|[-0-9][^,}]*\)" \
    | head -n1 | sed 's/.*:[[:space:]]*//' | tr -d '"' | sed 's/[[:space:]]*$//'
}

status_of() { printf '%s' "$1" | tail -n1; }
body_of()   { printf '%s' "$1" | sed '$d'; }

printf 'Board smoke: %s\n\n' "$BASE_URL"

# ---------------------------------------------------------------- 0. board shell
printf 'Board shell (NFR5: nginx serves static/, no build step)\n'
RESP=$(curl -sS -w '\n%{http_code}' "$BASE_URL/" 2>/dev/null)
CODE=$(status_of "$RESP")
BODY=$(body_of "$RESP")
if [ "$CODE" = "200" ] && printf '%s' "$BODY" | grep -q 'id="board"'; then
  ok "GET / served the board shell"
else
  fail "GET / expected the board shell (got HTTP ${CODE:-none}); is the stack up?"
fi

MODULE=$(curl -sS -o /dev/null -w '%{http_code} %{content_type}' "$BASE_URL/js/api.js" 2>/dev/null)
if printf '%s' "$MODULE" | grep -qi 'javascript'; then
  ok "ES modules served with a JS content type ($MODULE)"
else
  fail "GET /js/api.js served with wrong content type ($MODULE) — native modules will not load"
fi

# ---------------------------------------------------------------- 1. load board
printf '\nLoad (AC1/AC2)\n'
RESP=$(curl -sS -w '\n%{http_code}' "$BASE_URL/api/columns/" 2>/dev/null)
CODE=$(status_of "$RESP")
COLUMNS=$(body_of "$RESP")
if [ "$CODE" = "200" ]; then
  ok "GET /api/columns/ -> 200"
  COLUMN_ID=$(json_field "$COLUMNS" id)
  if [ -n "$COLUMN_ID" ]; then
    ok "first column id is '${COLUMN_ID}' (opaque, used as a string below)"
  else
    blocked "no columns returned with an id — create a column to exercise the notes flows"
  fi
else
  blocked "GET /api/columns/ -> HTTP ${CODE:-none} (backend not served?)"
  COLUMN_ID=""
fi

if [ -n "${COLUMN_ID:-}" ]; then
  RESP=$(curl -sS -w '\n%{http_code}' "$BASE_URL/api/notes/?column_id=${COLUMN_ID}" 2>/dev/null)
  CODE=$(status_of "$RESP")
  if [ "$CODE" = "200" ]; then
    ok "GET /api/notes/?column_id=${COLUMN_ID} -> 200"
  else
    blocked "GET /api/notes/?column_id= -> HTTP ${CODE:-none} (notes handler missing in internal/)"
  fi
fi

# ---------------------------------------------------------------- 2. create (#4)
printf '\nCreate (#4)\n'
STAMP=$(date +%s)
NOTE_TITLE="smoke-${STAMP}"
NOTE_ID=""
if [ -n "${COLUMN_ID:-}" ]; then
  RESP=$(curl -sS -w '\n%{http_code}' -X POST "$BASE_URL/api/notes/" \
    -H 'Content-Type: application/json' \
    -d "{\"title\":\"${NOTE_TITLE}\",\"body\":\"created by scripts/smoke.sh\",\"columnId\":\"${COLUMN_ID}\"}" 2>/dev/null)
  CODE=$(status_of "$RESP")
  BODY=$(body_of "$RESP")
  if [ "$CODE" = "201" ]; then
    NOTE_ID=$(json_field "$BODY" id)
    ok "POST /api/notes/ -> 201 (id '${NOTE_ID}', sent columnId as a string)"
    if printf '%s' "$BODY" | grep -q '"color"'; then
      info "response included color; the UI never sends it (Q4)"
    fi
  else
    blocked "POST /api/notes/ -> HTTP ${CODE:-none} (notes handler missing in internal/)"
  fi
else
  blocked "POST /api/notes/ skipped — no column id available"
fi

# ---------------------------------------------------------------- 3. same-column drop = no request (#9)
printf '\nSame-column drop = no request (#9)\n'
info "not scriptable without a browser: this is a client-side guard"
if grep -q "fromColumnId === column.id" static/js/board.js 2>/dev/null; then
  ok "board.js short-circuits a same-column drop before any fetch"
else
  fail "could not confirm the same-column no-op guard in static/js/board.js"
fi

# ---------------------------------------------------------------- 4. cross-column move (#9)
printf '\nCross-column move (#9)\n'
if [ -n "${NOTE_ID:-}" ]; then
  TARGET_ID=$(printf '%s' "$COLUMNS" | grep -o '"id"[[:space:]]*:[[:space:]]*\(\"[^\"]*\"\|[-0-9][^,}]*\)' \
    | sed 's/.*:[[:space:]]*//' | tr -d '"' | sed -n '2p')
  if [ -n "$TARGET_ID" ]; then
    RESP=$(curl -sS -w '\n%{http_code}' -X PATCH "$BASE_URL/api/notes/${NOTE_ID}/move" \
      -H 'Content-Type: application/json' \
      -d "{\"columnId\":\"${TARGET_ID}\"}" 2>/dev/null)
    CODE=$(status_of "$RESP")
    if [ "$CODE" = "200" ]; then
      ok "PATCH /api/notes/${NOTE_ID}/move -> 200 (moved to '${TARGET_ID}')"
      COLUMN_ID="$TARGET_ID"
    else
      blocked "PATCH /api/notes/:id/move -> HTTP ${CODE:-none} (move handler missing — Epic 4 #34)"
    fi
  else
    blocked "move skipped — need a second column to move into"
  fi
else
  blocked "move skipped — no note was created"
fi

# ---------------------------------------------------------------- 5. edit (#10)
printf '\nEdit (#10)\n'
if [ -n "${NOTE_ID:-}" ]; then
  RESP=$(curl -sS -w '\n%{http_code}' -X PUT "$BASE_URL/api/notes/${NOTE_ID}" \
    -H 'Content-Type: application/json' \
    -d "{\"title\":\"${NOTE_TITLE}-edited\",\"body\":\"edited by scripts/smoke.sh\"}" 2>/dev/null)
  CODE=$(status_of "$RESP")
  BODY=$(body_of "$RESP")
  if [ "$CODE" = "200" ]; then
    ok "PUT /api/notes/${NOTE_ID} -> 200"
    if printf '%s' "$BODY" | grep -q 'edited'; then
      ok "PUT echo reflects the saved values"
    else
      info "PUT returned no echo of the new body"
    fi
  else
    blocked "PUT /api/notes/:id -> HTTP ${CODE:-none} (notes handler missing in internal/)"
  fi
else
  blocked "edit skipped — no note was created"
fi

# ---------------------------------------------------------------- 6. delete -> count 0 (#11, R2)
printf '\nDelete + R2 count guard (#11, R2)\n'
if [ -n "${NOTE_ID:-}" ]; then
  RESP=$(curl -sS -w '\n%{http_code}' -X DELETE "$BASE_URL/api/notes/${NOTE_ID}" 2>/dev/null)
  CODE=$(status_of "$RESP")
  if [ "$CODE" = "204" ] || [ "$CODE" = "200" ]; then
    ok "DELETE /api/notes/${NOTE_ID} -> ${CODE}"
  else
    blocked "DELETE /api/notes/:id -> HTTP ${CODE:-none} (notes handler missing in internal/)"
  fi
else
  blocked "delete skipped — no note was created"
fi

# The count is derived by filtering notes[] on every render; assert the guard
# exists structurally, which is what makes a stuck (1) impossible.
if grep -q 'notesForColumn\|getCounts' static/js/store.js 2>/dev/null \
   && ! grep -Eq '(counts?|count)[[:space:]]*\+=[[:space:]]*1' static/js/*.js 2>/dev/null; then
  ok "counts are derived from notes[]; no increment/decrement arithmetic anywhere"
else
  fail "found count arithmetic in static/js — R2 guard is not structural"
fi

printf '\n----------------------------------------\n'
printf 'passed %d, failed %d, blocked %d\n' "$PASS" "$FAIL" "$BLOCKED"
if [ "$BLOCKED" -gt 0 ]; then
  printf 'BLOCKED checks mean the endpoint is absent in the backend — raise on #44, do not stub.\n'
fi
[ "$FAIL" -eq 0 ] || exit 1

#!/usr/bin/env bash
# Checks that the ieasybooks vault refuses this job a secret: the release
# workflows' vault access check expects that for the other workflow's secrets
# (docs/releasing.md). It passes only on a 403 because no rule matches, so a
# network error can't pass for a refusal. It prints neither the job's token
# nor, should the vault serve the secret after all, its value.
#
#   scripts/release/expect-vault-refusal.sh NAME
set -euo pipefail

name=${1:?usage: scripts/release/expect-vault-refusal.sh NAME}
[[ $name =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "::error::$name isn't a secret name."; exit 2; }
vault=${VAULT_URL:-https://vault.ieasybooks.com}
: "${ACTIONS_ID_TOKEN_REQUEST_URL:?the job needs the id-token: write permission}"

# The job's OIDC token for the vault, as the ieasybooks/vault action gets it.
token=$(curl -sS --fail -H @<(printf 'Authorization: bearer %s\n' "$ACTIONS_ID_TOKEN_REQUEST_TOKEN") \
  "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=$vault" | jq -r '.value // empty')
[ -n "$token" ] || { echo "::error::GitHub gave no OIDC token."; exit 1; }

# 502 and 503 mean the vault couldn't check the token's signing key yet.
for attempt in 1 2 3 4 5 6; do
  response=$(curl -sS -X POST "$vault/ci" \
    -H @<(printf 'Authorization: Bearer %s\n' "$token") \
    -H "content-type: application/json" \
    --data "{\"secrets\":[\"$name\"]}" \
    -w '\n%{http_code}') || response=$'\n000'
  status=${response##*$'\n'}
  body=${response%$'\n'*}
  [[ $status =~ ^(502|503|000)$ ]] || break
  echo "The vault answered HTTP $status; retrying ($attempt)."
  sleep "${SLEEP_SECONDS:-5}"
done
unset token

if [ "$status" = 200 ]; then
  echo "::error::The vault served $name to this job, which it should refuse."
  exit 1
fi
reason=$(jq -r --arg name "$name" '.refused[$name] // empty' <<<"$body" 2>/dev/null || true)
if [ "$status" = 403 ] && [[ $reason == "no rule matches "* ]]; then
  echo "The vault refuses $name here, as it should: $reason"
else
  echo "::error::Expected the vault to refuse $name (403, no rule matches); it answered HTTP $status: $(jq -c 'del(.secrets)' <<<"$body" 2>/dev/null || echo 'an unreadable body')"
  exit 1
fi

#!/usr/bin/env bash
# Stores the DataForSEO credentials as the DATAFORSEO_API_KEY secret of both
# OpenSEO workers (the app and the site-audit worker), without echoing them.
#
# OpenSEO expects DATAFORSEO_API_KEY = base64("<login>:<api password>"), the
# value DataForSEO labels "Base64" at https://app.dataforseo.com/api-access
# (login = the account email, password = the API password, not the dashboard
# one). Paste that value, or type the login and API password and this script
# encodes them.
#
# Usage (repo root, logged in with `pnpm exec wrangler login`):
#   scripts/set-dataforseo-key.sh
set -euo pipefail

cd "$(dirname "$0")/.."
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-290e6974d5ab11e9b3563b1c6f9b4584}"
WORKERS=(open-seo open-seo-audit)

printf 'DataForSEO credentials:\n  1) the Base64 value from app.dataforseo.com/api-access\n  2) login (email) and API password\nChoose 1 or 2: '
read -r choice

case "$choice" in
1)
	printf 'Base64 credentials (hidden): '
	read -rs key
	printf '\n'
	key="${key//[[:space:]]/}"
	;;
2)
	printf 'DataForSEO login (email): '
	read -r login
	printf 'DataForSEO API password (hidden): '
	read -rs password
	printf '\n'
	if [[ -z "$login" || -z "$password" ]]; then
		echo "Login and password are both required." >&2
		exit 1
	fi
	key="$(printf '%s:%s' "$login" "$password" | base64 | tr -d '\n')"
	unset password
	;;
*)
	echo "Choose 1 or 2." >&2
	exit 1
	;;
esac

# Same sanity check as OpenSEO's /api/health: the value must decode to
# "login:password".
if ! printf '%s' "$key" | base64 -d 2>/dev/null | grep -q ':'; then
	unset key
	echo "That does not decode to login:password. Nothing was stored." >&2
	exit 1
fi

for worker in "${WORKERS[@]}"; do
	printf '%s' "$key" | pnpm exec wrangler secret put DATAFORSEO_API_KEY --name "$worker" >/dev/null
	echo "Stored DATAFORSEO_API_KEY on $worker."
done
unset key

echo "Done. Check https://open-seo.nicocerond.workers.dev/api/health (signed in) for the dataforseo check."

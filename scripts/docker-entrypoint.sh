#!/bin/sh
set -eu

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
	node /app/scripts/migrate.mjs
fi

exec "$@"

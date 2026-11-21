#!/bin/sh
# Dev only. opcache.validate_timestamps=0 avoids stat()-ing every PHP file on
# each request (very slow over Docker Desktop bind mounts on Windows/macOS).
# This loop polls OUR source (not vendor/) and gracefully reloads php-fpm
# when something changes, so edits still apply within ~2 seconds.
STAMP=/tmp/.ccp-reload-stamp
touch "$STAMP"

while sleep 2; do
    changed=$(find app bootstrap config routes database resources -newer "$STAMP" \( -name '*.php' -o -name '*.blade.php' \) 2>/dev/null | head -n 1)
    if [ -n "$changed" ] || [ composer.lock -nt "$STAMP" ]; then
        touch "$STAMP"
        kill -USR2 1 2>/dev/null && echo "[dev-reload] change detected ($changed), php-fpm reloaded"
    fi
done

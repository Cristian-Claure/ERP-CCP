#!/bin/sh
set -e

# Install PHP dependencies on first boot (bind-mounted source in dev).
if [ ! -f vendor/autoload.php ]; then
    composer install --no-interaction --prefer-dist
fi

mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
# Dev bind mount: files may be created by root (docker exec) and php-fpm runs as www-data.
chmod -R a+rwX storage bootstrap/cache 2>/dev/null || true

# php-fpm in local env: background watcher that reloads it on source changes
# (opcache does not revalidate timestamps in dev, see docker/php/php.ini).
if [ "$1" = "php-fpm" ] && [ "${APP_ENV:-local}" = "local" ]; then
    /usr/local/bin/ccp-dev-reload &
fi

exec "$@"

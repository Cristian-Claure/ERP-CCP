# syntax=docker/dockerfile:1
FROM php:8.5-fpm-alpine AS base

COPY --from=mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN apk add --no-cache fcgi git unzip \
    && install-php-extensions pdo_pgsql pgsql redis intl bcmath zip opcache pcntl

COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-ccp.ini
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/zz-ccp.conf
COPY docker/php/entrypoint.sh /usr/local/bin/ccp-entrypoint
RUN chmod +x /usr/local/bin/ccp-entrypoint

WORKDIR /var/www/html
ENTRYPOINT ["ccp-entrypoint"]
CMD ["php-fpm"]

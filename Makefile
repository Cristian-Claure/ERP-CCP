# CCP — developer commands. Works with GNU make on Windows, macOS and Linux.
COMPOSE := docker compose
API     := $(COMPOSE) exec -T api
AI      := $(COMPOSE) exec -T ai
WEB     := $(COMPOSE) exec -T web

.DEFAULT_GOAL := help
.PHONY: help env up down restart build fresh migrate test test-api test-ai test-web \
        lint lint-api lint-ai lint-web format logs ps sh-api

help: ## Show available commands
	@echo "make env | up | down | restart | fresh | migrate | test | lint | format | logs | ps | sh-api"

env: ## Create .env from .env.example and generate secrets
	docker run --rm -v "$(CURDIR):/app" -w /app php:8.5-cli-alpine php docker/scripts/init-env.php

up: env ## Build and start the whole stack, waiting for healthchecks
	$(COMPOSE) up -d --build --wait

down: ## Stop the stack (keeps volumes)
	$(COMPOSE) down

restart: down up

build:
	$(COMPOSE) build

fresh: ## Drop all tables, migrate and seed demo data
	$(API) php artisan migrate:fresh --seed --force

migrate:
	$(API) php artisan migrate --force

test: test-api test-ai test-web ## Run every test suite

test-api:
	$(API) php artisan test

test-ai:
	$(AI) python -m pytest -q -p no:cacheprovider

test-web:
	$(WEB) npm run test

lint: lint-api lint-ai lint-web ## Run every linter

lint-api:
	$(API) ./vendor/bin/pint --test

lint-ai:
	$(AI) ruff check --no-cache .
	$(AI) ruff format --check --no-cache .

lint-web:
	$(WEB) npm run lint
	$(WEB) npm run typecheck
	$(WEB) npm run format:check

format: ## Auto-format all code
	$(API) ./vendor/bin/pint
	$(AI) ruff format --no-cache .
	$(AI) ruff check --fix --no-cache .
	$(WEB) npm run format

logs: ## Tail logs of every service
	$(COMPOSE) logs -f --tail=100

ps:
	$(COMPOSE) ps

sh-api:
	$(COMPOSE) exec api sh

# clemvion — helper targets.
#
# 자세한 인프라 설계는 docker-compose.yml (dev) 와 docker-compose.e2e.yml (e2e) 참고.
# 두 compose 파일은 `name:` top-level key 가 다르므로 동시 실행해도 격리된다.

COMPOSE_E2E := docker compose -f docker-compose.e2e.yml

.PHONY: help e2e-up e2e-down e2e-test e2e-test-full

help:
	@echo "Targets:"
	@echo "  e2e-up         e2e 인프라 + backend-e2e 까지 백그라운드 기동 (runner 제외)"
	@echo "  e2e-down       e2e 리소스 정리 (volume·orphan 모두)"
	@echo "  e2e-test       backend e2e (supertest) 1-shot — 끝나면 자동 down"
	@echo "  e2e-test-full  backend + playwright 까지 — 끝나면 자동 down"

e2e-up:
	$(COMPOSE_E2E) up -d --wait backend-e2e

e2e-down:
	$(COMPOSE_E2E) down -v --remove-orphans

# 인프라+backend 를 `up --wait` 로 띄운 뒤 runner 만 `run --rm` 으로 1-shot 실행.
# `--abort-on-container-exit` 패턴은 Docker Desktop 의 network race 와 충돌하는
# 사례가 있어 분리. 실패하더라도 후속 e2e-down 이 실행되도록 `; STATUS=$$?` 패턴 사용.
e2e-test:
	$(COMPOSE_E2E) up -d --wait backend-e2e
	$(COMPOSE_E2E) run --rm backend-e2e-runner; STATUS=$$?; \
	$(MAKE) e2e-down; exit $$STATUS

e2e-test-full:
	$(COMPOSE_E2E) up -d --wait backend-e2e
	$(COMPOSE_E2E) run --rm backend-e2e-runner && \
	  $(COMPOSE_E2E) run --rm playwright-runner; STATUS=$$?; \
	$(MAKE) e2e-down; exit $$STATUS

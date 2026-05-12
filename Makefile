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

# `--exit-code-from` 가 지정한 서비스의 종료 코드를 전체 `up` 의 종료 코드로 전파.
# 실패하더라도 후속 e2e-down 이 실행되도록 `; STATUS=$$?` 패턴 사용.
e2e-test:
	$(COMPOSE_E2E) --profile test up \
	  --abort-on-container-exit \
	  --exit-code-from backend-e2e-runner \
	  backend-e2e-runner; STATUS=$$?; \
	$(MAKE) e2e-down; exit $$STATUS

e2e-test-full:
	$(COMPOSE_E2E) --profile test up \
	  --abort-on-container-exit \
	  --exit-code-from playwright-runner; STATUS=$$?; \
	$(MAKE) e2e-down; exit $$STATUS

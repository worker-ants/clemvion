# clemvion — helper targets.
#
# 자세한 인프라 설계는 docker-compose.yml (dev) 와 docker-compose.e2e.yml (e2e) 참고.
#
# e2e compose project 격리:
#   - dev compose (`docker-compose.yml`) 는 디렉토리 basename (= clemvion 또는
#     worktree dir 이름) 으로 project 가 자동 분리된다.
#   - e2e compose (`docker-compose.e2e.yml`) 는 `name:` 키를 제거하고, 본 Makefile 이
#     `COMPOSE_PROJECT` 를 도출해 `-p` flag 로 주입한다 → worktree 별 자동 격리.
#   - main worktree (basename=clemvion) → `clemvion-e2e` (기존 동작 그대로).
#   - `.claude/worktrees/<task>-<slug>/` → `clemvion-e2e-<task>-<slug>`.
#   - 사용자가 `COMPOSE_PROJECT=foo make e2e-test` 로 override 가능 (`?=` 사용).
#
# Worktree dir basename 을 docker compose project 명명 규칙(`[a-z0-9][a-z0-9_-]*`)
# 으로 정규화: 소문자화 + 영문/숫자/`_`/`-` 외 문자는 `-` 치환.
_WT := $(shell basename "$(CURDIR)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')
COMPOSE_PROJECT ?= $(if $(filter clemvion,$(_WT)),clemvion-e2e,clemvion-e2e-$(_WT))

COMPOSE_E2E := docker compose -f docker-compose.e2e.yml -p $(COMPOSE_PROJECT)

.PHONY: help setup-githooks e2e-up e2e-down e2e-test e2e-test-full e2e-prune

help:
	@echo "Targets:"
	@echo "  setup-githooks 체크인된 .githooks/ 를 git core.hooksPath 로 등록 (clone 후 1회)"
	@echo "  e2e-up         e2e 인프라 + backend-e2e 까지 백그라운드 기동 (runner 제외, 자동 image rebuild)"
	@echo "  e2e-down       현 worktree 의 e2e 리소스 정리 (volume·orphan 모두)"
	@echo "  e2e-test       backend e2e (supertest) 1-shot — 자동 image rebuild, 끝나면 자동 down"
	@echo "  e2e-test-full  backend + playwright — 자동 image rebuild, 끝나면 자동 down"
	@echo "  e2e-prune      모든 worktree 의 clemvion-e2e* stale compose project 일괄 정리 (jq 필요)"
	@echo ""
	@echo "현재 COMPOSE_PROJECT=$(COMPOSE_PROJECT)"

setup-githooks:
	@bash scripts/setup-githooks.sh

# `--build` 는 source 변경 후 stale 이미지 사용을 방지한다. Docker BuildKit
# layer cache 가 변경되지 않은 layer 는 재사용하므로 첫 build 이후 부담은 작다.
# 누락 시 새로 추가한 controller / 라우트가 컨테이너에 반영되지 않아 e2e 가
# 사일런트하게 404 로 실패한다 (예: 2026-05-15 background-monitoring 사전 결함).
e2e-up:
	$(COMPOSE_E2E) up -d --wait --build backend-e2e

e2e-down:
	$(COMPOSE_E2E) down -v --remove-orphans

# 인프라+backend 를 `up --wait` 로 띄운 뒤 runner 만 `run --rm` 으로 1-shot 실행.
# `--abort-on-container-exit` 패턴은 Docker Desktop 의 network race 와 충돌하는
# 사례가 있어 분리. 실패하더라도 후속 e2e-down 이 실행되도록 `; STATUS=$$?` 패턴 사용.
e2e-test:
	$(COMPOSE_E2E) up -d --wait --build backend-e2e
	$(COMPOSE_E2E) run --rm --build backend-e2e-runner; STATUS=$$?; \
	$(MAKE) e2e-down; exit $$STATUS

# `e2e-test` 와 패턴이 약간 달라 보이지만 동작은 일치한다.
# `runner1 && runner2; STATUS=$$?` 형태로, runner1 실패 시 `&&` 가 short-circuit
# 하여 runner2 가 skip 되고, `$$?` 는 마지막 실행된 명령의 exit code 를 캡처한다
# (runner1 실패 → STATUS=runner1 exit, runner2 실패 → STATUS=runner2 exit, 둘 다
# 성공 → 0). e2e-down 은 항상 실행되며 최종 exit 코드는 STATUS.
#
# 설계 의도: runner1 (backend e2e) 실패 시 runner2 (playwright) 는 실행하지
# 않는다 — 백엔드 e2e 통과가 frontend e2e 의 선행 조건이며, 백엔드가 깨진
# 상태에서 playwright 를 돌려 노이즈 실패를 발생시키지 않기 위함.
e2e-test-full:
	$(COMPOSE_E2E) up -d --wait --build backend-e2e
	$(COMPOSE_E2E) run --rm --build backend-e2e-runner && \
	  $(COMPOSE_E2E) run --rm --build playwright-runner; STATUS=$$?; \
	$(MAKE) e2e-down; exit $$STATUS

# worktree 가 `git worktree remove` 로 사라져도 docker 쪽의 stale compose project
# 가 남는다. 본 타겟은 `clemvion-e2e` 접두를 가진 모든 compose project 를 일괄
# `down -v --remove-orphans` 한다. jq 의존 — macOS 는 `brew install jq`.
e2e-prune:
	@command -v jq >/dev/null 2>&1 || { \
	  echo "e2e-prune: jq 가 필요합니다. macOS: brew install jq" >&2; exit 1; }
	@projects=$$(docker compose ls -a --filter "name=clemvion-e2e" --format json | jq -r '.[].Name'); \
	if [ -z "$$projects" ]; then echo "정리할 clemvion-e2e* compose project 없음"; exit 0; fi; \
	for proj in $$projects; do \
	  echo "→ pruning $$proj"; \
	  docker compose -p $$proj -f docker-compose.e2e.yml down -v --remove-orphans; \
	done

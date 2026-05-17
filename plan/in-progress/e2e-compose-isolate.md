---
worktree: e2e-compose-isolate-d74453
started: 2026-05-17
owner: developer
---

# e2e docker compose project name 워크트리 격리

## 배경

`docker-compose.e2e.yml` 의 `name: clemvion-e2e` 가 박제되어 있어, 어느 worktree 에서 `make e2e-test` 를 돌려도 같은 compose project namespace 를 공유한다. 병렬 작업이 일상화된 워크플로(`.claude/worktrees/<task>-<slug>/`)에서 다음 충돌이 발생한다:

1. **container name 충돌**: 두 번째 `up -d --wait` 가 `Conflict. The container name "/clemvion-e2e-postgres-1" is already in use` 로 즉시 실패.
2. **상호 파괴**: 한쪽 `make e2e-down` 이 `down -v --remove-orphans` 로 다른 worktree 의 실행 중 컨테이너·볼륨·MinIO bucket 까지 전부 날림 (가장 위험).
3. **stale healthcheck 오인**: A 가 띄운 backend-e2e 가 healthy 인 상태에서 B 의 `--wait` 가 이미 healthy 로 보고 → B 의 새 코드가 아닌 A 의 코드로 테스트 진행 가능.

호스트 포트는 노출 안 하므로(`docker-compose.e2e.yml` 의도된 설계) 포트 충돌은 없음. 오직 docker compose **project namespace 격리**만 해결하면 됨.

## 설계 (사용자 직전 대화에서 승인)

### Step 1 — `docker-compose.e2e.yml` 에서 `name:` 제거, Makefile 에서 `-p` 로 주입

- `docker-compose.e2e.yml` 상단의 `name: clemvion-e2e` 삭제.
- `Makefile` 에서 현재 worktree 디렉토리 basename 으로 project name 도출:

  ```make
  _WT := $(shell basename "$(CURDIR)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')
  COMPOSE_PROJECT ?= $(if $(filter clemvion,$(_WT)),clemvion-e2e,clemvion-e2e-$(_WT))
  COMPOSE_E2E := docker compose -f docker-compose.e2e.yml -p $(COMPOSE_PROJECT)
  ```

  - main worktree (basename=`clemvion`) → `clemvion-e2e` (기존 동작 그대로 유지, 회귀 없음).
  - 워크트리 (`.claude/worktrees/<task>-<slug>`) → `clemvion-e2e-<task>-<slug>`.
  - `?=` 로 사용자 override 허용 (`COMPOSE_PROJECT=foo make e2e-test`).

Docker Compose v2 precedence: `-p` flag > `COMPOSE_PROJECT_NAME` env > `name:` key > 디렉토리명. `-p` 가 가장 강해 깔끔하게 덮어쓴다.

### Step 2 — 빌드 서비스에 `image:` 명시 (image 캐시 공유)

project name 만 바꾸면 image 이름도 `<project>-backend-e2e:latest` 로 변해 worktree 마다 image 를 새로 빌드해야 함. 빌드 서비스에 `image:` 를 명시해 image namespace 는 공유, container/volume/network 만 project 별 격리:

```yaml
backend-e2e:
  image: clemvion-e2e/backend:latest
  build: { context: ., dockerfile: codebase/backend/Dockerfile, target: runner }

migrate:
  image: clemvion-e2e/migrate:latest
  build: { ... }

backend-e2e-runner:
  image: clemvion-e2e/backend-deps:latest
  build: { ..., target: deps }
```

`playwright-runner` 는 public image 라 변경 없음.

### Step 3 — `make e2e-prune` 추가

worktree 가 `git worktree remove` 로 사라져도 docker 쪽 namespace 는 stale 로 남는 문제 대응. 실제 구현은 `--filter` 가 compose 버전에 따라 substring/prefix 가 달라 신뢰가 어려워 jq `startswith` 로 anchor 매칭, `for` 루프로 처리한다:

```make
e2e-prune:
	@command -v jq >/dev/null 2>&1 || { ... }
	@projects=$(docker compose ls -a --format json \
	  | jq -r '.[] | select(.Name == "clemvion-e2e" or (.Name | startswith("clemvion-e2e-"))) | .Name'); \
	if [ -z "$projects" ]; then echo "정리할 ... 없음"; exit 0; fi; \
	for proj in $projects; do \
	  docker compose -p "$proj" -f "$(E2E_COMPOSE_FILE)" down -v --remove-orphans; \
	done
```

help 메시지에도 한 줄 추가. jq 의존성은 Makefile 주석 + README 사전 요구 사항에 명시.

### Step 4 — 문서 갱신

- `docker-compose.e2e.yml` 상단 주석: 격리 방식 설명 갱신
- `PROJECT.md` §빌드·린트·테스트 명령: e2e 행에 "worktree 별 자동 격리" 한 줄
- `README.md` line 245 부근: 격리 표현 갱신
- `CLAUDE.md` §Worktree 기반 작업 정책: e2e 동시 실행 가능 한 줄

## 작업 체크리스트

- [x] worktree 생성: `.claude/worktrees/e2e-compose-isolate-d74453`
- [x] plan 파일 작성 (본 문서)
- [x] consistency-check 판단: spec 변경 0, plan/문서/인프라만 → skip (사유 RESOLUTION 기록)
- [x] `docker-compose.e2e.yml` 수정 (name 제거 + image 명시 + 주석 + image race 트레이드오프 명시)
- [x] `Makefile` 수정 (COMPOSE_PROJECT + -p flag + e2e-prune + help + 외부 env/`make -C` 주의)
- [x] `PROJECT.md` 갱신 (e2e 격리 단락 + CLAUDE.md 역방향 링크)
- [x] `README.md` 갱신 (e2e 격리 단락 + jq 사전 요구 사항 + 첫 적용 시 마이그레이션 안내)
- [x] `CLAUDE.md` 갱신 (Worktree 절에 e2e 동시 실행 가능 한 줄)
- [x] TEST WORKFLOW: `make e2e-test` 현 worktree 통과 (16/16 suites, 93/93 tests)
- [x] `make e2e-prune` syntax / jq 의존성 확인 (실 실행 OK)
- [x] (best-effort) 동시 실행 검증: skip — 단일 worktree e2e 의 compose 로그에 `-p clemvion-e2e-<worktree>` 가 명확히 적용되고, 컨테이너/이미지 이름이 격리됨을 확인했으므로 격리 자체는 입증. macOS Docker 부담을 피해 추가 동시 실행 시나리오는 생략 (사유 RESOLUTION 에 기록)
- [x] `/ai-review` 실행 → 5 WARNING + 18 INFO 조치 (RESOLUTION.md 참고)
- [ ] plan → `complete/` 이동 (PR 머지 시점, 같은 PR 안 별 commit)
- [ ] PR 생성 (사용자 확인 후 push)

## Rationale

### 왜 `?=` 인가

`:=` 면 환경변수 override 가 안 먹는다. CI 나 특수 상황에서 사용자가 `COMPOSE_PROJECT=foo make ...` 로 깔끔히 덮을 수 있어야 함. Makefile 안에서 한 번만 평가되도록 `:=` 로 평가한 결과를 `?=` 의 default 로 쓰는 게 가장 안전하나, GNU Make 의 `?=` 는 그 자체로 recursive 평가가 한 번만 일어나므로 `?=` 만 써도 충분.

### 왜 `image:` 명시인가

project name 이 바뀌면 default image name 도 `<project>_<service>` 로 바뀐다. 이러면 worktree 마다 첫 e2e 가 풀 image build (수 분) 를 반복. `image:` 를 명시하면 BuildKit layer cache + 최종 image 가 모든 worktree 에서 공유되어, 두 번째 worktree 의 첫 e2e 는 container 기동 단계만 다시 돌면 된다 (~30-60s).

container/volume/network 는 여전히 project 별로 분리되므로 격리 본질은 유지.

### 왜 `e2e-prune` 가 필요한가

기존 `e2e-down` 은 현 worktree 의 project 만 정리. worktree 가 사라진 뒤 docker 만 stale 로 남는 케이스(`git worktree remove` 직후 등) 가 자연스럽게 발생. `e2e-prune` 은 `clemvion-e2e*` 접두를 가진 모든 compose project 를 일괄 정리.

jq 의존성은 macOS 표준이 아니지만 brew/Homebrew 가 거의 모든 개발 환경에 있어 실용적 부담 X. Makefile 주석으로 의존성 명시.

### 왜 dev compose 는 안 건드리는가

`docker-compose.yml` (dev) 는 이미 디렉토리 basename 으로 project name 이 자동 도출되어 worktree 별 격리됨. dev 인프라는 어차피 호스트 포트(`5432`/`6379`/...) 를 노출하므로 동시 기동 자체가 불가 → 사용자가 의식적으로 직렬화 (한 번에 한 worktree 만 dev 인프라 보유). 본 PR 의 격리 대상은 호스트 포트 노출이 없는 e2e 만.

### 기각된 대안

- `COMPOSE_PROJECT_NAME` env export 의존: shell rc 에 박아도 새 터미널마다 누락. Makefile 진입점 강제가 안전.
- 워크트리마다 docker-compose.e2e.yml 사본 + name 치환: 파일 동기화 부담 증가.
- `name: ${VAR:-clemvion-e2e}` (compose 파일 안에서 변수 보간): 사용자 export 누락 시 충돌. Makefile 보장이 더 견고.

## 영향 범위 / Side effect

- 다른 진행 중 worktree (`cafe24-401-refresh-a3f2c1`, `harness-generalize-b2c3d4`, `plan-housekeeping-a1b2c3`, `ai-agent-multiturn-persist-8bddbf`) 들은 본 PR merge 후 각자 `git rebase`/`git merge main` 으로 동기화 시 자동 적용. 본 PR 안에서는 다른 worktree 의 파일을 손대지 않음.
- 첫 worktree e2e 후 docker daemon 의 image 캐시가 `clemvion-e2e/backend:latest` 등으로 정착. 기존 default-name 이미지 (`clemvion-e2e-backend-e2e:latest` 등) 는 stale 로 남으므로 사용자가 한 번 `docker image prune` 또는 직접 제거 권장 (README 에 메모).

## 검증 계획

1. `make e2e-test` 현 worktree 에서 통과 (project name = `clemvion-e2e-e2e-compose-isolate-d74453`).
2. `make e2e-prune` syntax 확인 (jq 의존성 OK 인지).
3. (best-effort) main 워크트리에서 `make e2e-up` 띄워두고 본 worktree 에서 `make e2e-test` 가 충돌 없이 통과하는지 확인. macOS Docker 부담으로 무리면 skip 사유 RESOLUTION 에 기록.

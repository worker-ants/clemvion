# Code Review 통합 보고서

## 전체 위험도
**LOW** — e2e compose project 격리 구현 자체는 건전하나, 동시 worktree 빌드 시 공유 Docker image race condition 및 `e2e-prune`의 `--filter` 매칭 semantics 불확실성이 본 변경의 핵심 목표(병렬 e2e 격리)와 직접 충돌하는 WARNING으로 존재한다.

## Critical 발견사항

없음

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 | 공유 Docker image(`clemvion-e2e/backend:latest` 등)가 worktree 간 동시 빌드 시 race condition 유발 가능. 두 worktree가 동시에 `make e2e-test` 실행 시 같은 image tag를 경쟁적으로 덮어씀 — 본 변경의 핵심 목표인 "병렬 e2e 격리"와 충돌 | `docker-compose.e2e.yml` `image:` 필드 3곳 | `COMPOSE_PROJECT`를 image 이름에도 반영하여 완전 격리하거나, 최소한 "동시 빌드 시 image race 가능" 경고 주석 추가 |
| 2 | 요구사항/부작용 | `e2e-prune`의 `--filter "name=clemvion-e2e"` 가 Docker Compose 버전에 따라 exact 매칭으로 동작할 수 있음. `clemvion-e2e-<task>-<slug>` 형태 worktree 프로젝트가 필터링 누락되면 stale 컨테이너가 정리되지 않음 | `Makefile` `e2e-prune` 타겟 | `docker compose ls -a --format json \| jq -r '.[] \| select(.Name \| startswith("clemvion-e2e")) \| .Name'` 방식으로 jq에서 prefix 필터링 |
| 3 | 보안 | `e2e-prune` 내 `$$proj` 변수에 인용 부호 없이 사용 — word splitting 방어 코딩 부재 | `Makefile` `e2e-prune` 타겟 루프 | `docker compose -p "$$proj"`, `echo "→ pruning $$proj"` 등 모든 참조에 쌍따옴표 추가 |
| 4 | 요구사항 | plan 체크리스트에 이미 완료된 항목들(`docker-compose.e2e.yml` 수정, Makefile 수정, 문서 3종 갱신)이 `[ ]`로 남아있음 — CLAUDE.md plan 라이프사이클 규칙 위반 | `plan/in-progress/e2e-compose-isolate.md` 작업 체크리스트 | 완료된 항목을 `[x]`로 갱신 |
| 5 | 요구사항 | `e2e-prune`의 `-f docker-compose.e2e.yml`이 상대 경로 — `make`를 다른 디렉터리에서 실행하거나 파일이 없는 경로에서 실행 시 오류 | `Makefile` `e2e-prune` 타겟 `-f` 플래그 | `-f $(CURDIR)/docker-compose.e2e.yml`로 절대 경로 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | e2e 전용 시크릿(`JWT_SECRET`, `ENCRYPTION_KEY: 0123456789abcdef...`, DB/MinIO 자격증명) 평문 커밋. 의도된 설계이나 `ENCRYPTION_KEY`가 단순 패턴이라 추측 용이 | `docker-compose.e2e.yml` 환경변수 블록 | `ENCRYPTION_KEY` 값을 더 임의적인 hex로 교체. CI에서 e2e 시크릿과 운영 환경변수 일치 검사 가드 추가 권장 |
| 2 | 보안 | `COMPOSE_PROJECT` 환경변수 외부 override 경로로 임의 문자열 주입 가능 — CI 컨텍스트에서 주의 필요 | `Makefile` `COMPOSE_PROJECT ?= ...` | CI에서 외부 주입 시 Docker compose 명명 규칙으로 검증/정규화 |
| 3 | 보안 | Flyway `-password=clemvion-e2e`를 command-line 인자로 전달 — `docker inspect` Args에 평문 노출. e2e 환경이므로 우선순위 낮음 | `docker-compose.e2e.yml` migrate service command | `FLYWAY_PASSWORD` 환경변수로 전달 |
| 4 | 보안 | `e2e-prune` `--filter "name=clemvion-e2e"` 필터가 외부 동명 프로젝트를 포함할 수 있음 | `Makefile` `e2e-prune` 타겟 | `jq -r '.[].Name \| select(test("^clemvion-e2e(-\|$)"))'`로 anchor 필터링 |
| 5 | 의존성 | `make e2e-prune` 실행 시 `jq` 바이너리 신규 필요. Makefile 내 존재 체크는 적절 | `Makefile` `e2e-prune` 타겟 | README.md 사전 요구 사항에 `jq` 선택적 도구로 추가 |
| 6 | 의존성 | 로컬 빌드 이미지 `:latest` 태그 사용 — 외부 레지스트리가 아닌 로컬 전용이므로 적절. CI 환경에서 이미지 누적 가능 | `docker-compose.e2e.yml` `image:` 필드 | CI cleanup에서 `docker image prune` 별도 고려 |
| 7 | 부작용 | `make -C /path e2e-test` 외부 호출 시 `$(CURDIR)` 기반 `_WT`가 예상 외 값을 가져 격리 네임스페이스 파손 가능 | `Makefile` `_WT` 변수 | CI에서 `-C` 사용 시 `COMPOSE_PROJECT`를 명시적으로 지정하도록 문서 안내 |
| 8 | 부작용 | `name:` 키 제거로 이전 방식 생성 컨테이너/볼륨 정리 누락 가능. main worktree에서는 값이 동일하게 도출되어 정상 작동 | `docker-compose.e2e.yml` 전체 | PR 설명 또는 PROJECT.md에 "첫 적용 시 `make e2e-down` 또는 `make e2e-prune` 한 번 실행" 마이그레이션 안내 추가 |
| 9 | 부작용 | `COMPOSE_PROJECT` 환경변수가 이미 설정된 환경에서 의도치 않게 e2e project name 덮어씌워짐 (`?=` 동작) | `Makefile` `COMPOSE_PROJECT ?= ...` | Makefile 주석 또는 PROJECT.md에 "기존 환경변수 우선" 동작 명시 |
| 10 | 문서화 | CLAUDE.md → PROJECT.md 단방향 참조만 존재. 역방향 링크 없음 | `PROJECT.md` Worktree 별 e2e 자동 격리 단락 | PROJECT.md 단락 끝에 `CLAUDE.md §Worktree 기반 작업 정책` 역방향 참조 추가 |
| 11 | 문서화 | README.md 사전 요구 사항 섹션에 `jq` 미기재 (명령 표와 Makefile 주석에는 표기됨) | `README.md` 사전 요구 사항 | `jq (make e2e-prune 실행 시; macOS: brew install jq)` 선택적 도구로 추가 |
| 12 | 문서화 | `docker-compose.e2e.yml` 파일 헤더에 project name이 `-p` 플래그로 주입됨을 명시하는 주석 존재 여부 미확인 | `docker-compose.e2e.yml` 파일 상단 | 파일 독립적으로 열었을 때 의미 파악 가능하도록 1~3줄 설명 주석 확인/추가 |
| 13 | 문서화 | Makefile `e2e-prune` 주석("접두어 필터")과 실제 명령(`--filter "name=clemvion-e2e"`) 의미 불일치 가능성 | `Makefile` `e2e-prune` 타겟 주석 | 주석에 Docker compose ls name 필터의 실제 매칭 방식 보충 설명 |
| 14 | 유지보수성 | `_WT` 변수명이 축약어로 의미 파악 어려움 | `Makefile` 변수 정의부 | `_WT_BASENAME` 또는 `_WORKTREE_DIR` 등 의도를 드러내는 이름으로 변경 |
| 15 | 유지보수성 | `e2e-prune` 인라인 셸 스크립트 복잡도 — `scripts/` 패턴 이미 코드베이스에서 사용 중 | `Makefile` `e2e-prune` 타겟 | `scripts/e2e-prune.sh`로 로직 추출 고려 |
| 16 | 유지보수성 | `docker-compose.e2e.yml` 파일명이 `COMPOSE_E2E` 변수와 `e2e-prune` 두 곳에 중복 하드코딩 | `Makefile` | `E2E_COMPOSE_FILE := docker-compose.e2e.yml` 별도 변수 선언 후 공통 참조 |
| 17 | 유지보수성 | docker-compose.e2e.yml 내 서비스별 image 주석 동일 문구 3회 반복 — 헤더 주석과 중복 | `migrate`, `backend-e2e`, `backend-e2e-runner` 서비스 `image:` 상단 주석 | 인라인 주석 제거 또는 헤더 참조 한 줄로 대체 |
| 18 | 요구사항 | plan 문서 `e2e-prune` 구현 예시(`xargs` 방식)가 실제 구현(`for` 루프)과 다름 | `plan/in-progress/e2e-compose-isolate.md` Step 3 | plan을 최종 구현 기준으로 갱신 또는 변경 사유 노트 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | e2e 하드코딩 시크릿(의도된 설계), `$$proj` 인용 누락, COMPOSE_PROJECT 외부 주입 경로 |
| dependency | LOW | `jq` 신규 선택적 의존성(Makefile 내 체크 적절), `:latest` 로컬 이미지 전략 적절 |
| documentation | LOW | 단방향 교차 참조 미완성, jq 사전 요구 사항 누락, Makefile 주석-코드 불일치 |
| requirement | LOW | `--filter` semantics 불확실, `-f` 상대 경로 위험, plan 체크박스 미갱신 |
| scope | NONE | commit message 선언과 실제 diff 1:1 일치, 범위 이탈 없음 |
| side_effect | LOW | 공유 image race condition(핵심 목표와 충돌), `--filter` semantics, `make -C` 호출 시 격리 파손 |
| maintainability | LOW | `_WT` 변수명 명확성, `e2e-prune` 인라인 복잡도, 파일명 중복, 문서 스타일 불일치 |
| api_contract | NONE | API 계약 관련 변경 없음 |

## 발견 없는 에이전트

- **scope** — 변경 범위 관점에서 문제 없음. commit message 선언 5가지 변경과 실제 diff 완전 일치.
- **api_contract** — API 엔드포인트·스키마·인증 관련 변경 없음.

## 권장 조치사항

1. **[WARNING #1 — 즉시]** 공유 Docker image race condition 문서화 또는 해결: `docker-compose.e2e.yml` 주석에 "동시 빌드 시 image race 가능" 경고 추가. 완전 격리 필요 시 image 이름에 `COMPOSE_PROJECT` 반영 검토.
2. **[WARNING #2 — 즉시]** `e2e-prune` `--filter` 매칭을 jq prefix 필터로 대체: `docker compose ls -a --format json | jq -r '.[] | select(.Name | startswith("clemvion-e2e")) | .Name'`.
3. **[WARNING #3 — 즉시]** `e2e-prune` 내 `$$proj` 참조 전체에 쌍따옴표 추가.
4. **[WARNING #4 — 즉시]** plan 체크리스트 갱신: 완료된 항목 `[x]`로 체크.
5. **[WARNING #5 — 단기]** `e2e-prune` `-f` 플래그를 절대 경로로 변경: `-f $(CURDIR)/docker-compose.e2e.yml`.
6. **[INFO #5/#11 — 단기]** README.md 사전 요구 사항에 `jq` 선택적 도구 항목 추가.
7. **[INFO #8 — 단기]** PR 설명 또는 PROJECT.md에 마이그레이션 안내 추가(첫 적용 시 `make e2e-down` 한 번 실행).
8. **[INFO #10 — 단기]** PROJECT.md Worktree 별 e2e 격리 단락에 CLAUDE.md 역방향 참조 링크 추가.
9. **[INFO #16 — 장기]** `E2E_COMPOSE_FILE` 변수 추출로 파일명 중복 제거.
10. **[INFO #15 — 장기]** `e2e-prune` 로직을 `scripts/e2e-prune.sh`로 추출하여 코드베이스 내 scripts/ 패턴 일관성 확보.

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`).

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `documentation`, `dependency`, `api_contract` (8명)
- **강제 포함(router_safety)**: `dependency`, `documentation`, `security`

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | Docker Compose 명칭/메타데이터 변경만 있으며 성능 영향 없음 |
| architecture | 아키텍처 변경 없음 — e2e 인프라 격리 운영 규칙 업데이트만 해당 |
| testing | 테스트 코드 변경 없음 — 문서 및 build script 메타데이터만 갱신 |
| database | DB 마이그레이션·쿼리·ORM 변경 없음 |
| concurrency | async/Promise/락/워커/큐 코드 변경 없음 — Makefile은 순차 shell |

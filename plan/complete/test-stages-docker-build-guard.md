---
worktree: test-stages-docker-build-guard-fcb7cc
started: 2026-05-24
owner: developer
status: in-progress
---

# Plan — `cmd_build` 에 backend + frontend Dockerfile 빌드 검증 추가

## 배경

PR #311 hotfix (frontend Dockerfile 의 `@workflow/chat-channel-validation` COPY 누락) 의 회귀 분석:

- PR #309 가 backend Dockerfile 만 갱신, frontend Dockerfile 갱신 누락
- 현행 TEST WORKFLOW (`.claude/test-stages.sh`):
  - `cmd_build` = backend Nest in-process build + frontend Next in-process build
  - `cmd_e2e` = `make e2e-test` (backend supertest, backend image build 만)
- frontend Dockerfile 자체의 회귀를 검증할 stage 가 없음 — local `npm install` 로 packages 가 node_modules 에 link 돼 있어 Next in-process build 는 통과, docker context 안의 `npm ci` 가 file:dep 를 resolve 못해 deploy 시점에 실패
- 결과: Jenkins 빌드 #197 의 frontend stage 가 `Module not found: Can't resolve '@workflow/chat-channel-validation'` 으로 실패

## 목적

`cmd_build` 단계에 **backend + frontend 양쪽 Dockerfile 의 docker build 검증** 을 추가해, monorepo packages 신설 + Dockerfile 갱신 누락 회귀를 사전 차단.

## SoT 참조

- `.claude/test-stages.sh` — `cmd_lint` / `cmd_unit` / `cmd_build` / `cmd_e2e` 정의
- `.claude/tools/run-test.sh` — wrapper (stage 호출 + 로그 캡처)
- `PROJECT.md §개발 방법론` 의 build 단계 — backend + frontend cross-stack 의무
- `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile` — 본 plan 의 검증 대상

## 작업 분할 (단일 commit)

### Commit 1 — `.claude/test-stages.sh` `cmd_build` 갱신

| 항목 | 상세 |
|---|---|
| `cmd_build` 마지막에 docker build 2 회 추가 | (1) `docker build -f codebase/backend/Dockerfile -t clemvion-build-check/backend:latest .` (2) `docker build -f codebase/frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:3011/api --build-arg NEXT_PUBLIC_WS_URL=http://localhost:3011 -t clemvion-build-check/frontend:latest .` |
| 주석 추가 | "Dockerfile 자체의 monorepo packages COPY 누락 회귀 차단 — PR #311 hotfix 의 재발 방지. NEXT_PUBLIC_* 는 dummy 값 (build 시 baking 만 검증, deploy 는 실제 값 사용)" |
| Docker 미설치 환경 대응 | docker daemon 미가용 시 빌드 단계 skip — `command -v docker` 가드 또는 PROJECT.md 의 e2e 면제 패턴과 동일한 INFRA_NOT_AVAILABLE 처리 |

### Commit 2 — 검증 + plan complete

| 항목 | 상세 |
|---|---|
| 검증 1 (positive) | `.claude/tools/run-test.sh build` 호출 → backend Next build + frontend Next build + backend Dockerfile build + frontend Dockerfile build 모두 통과 |
| 검증 2 (regression test) | 임시로 frontend Dockerfile 의 `chat-channel-validation` COPY 라인 제거 → `build` stage 실패 확인 → 라인 복원 |
| `plan/in-progress/` → `plan/complete/` |

## 의식적 boundary

- **`cmd_e2e` 변경 없음** — e2e 가 자체 docker image build 를 통해 검증하므로 중복.
- **NEXT_PUBLIC_* 실제 값 노출 없음** — build-arg 는 dummy. real value 는 deploy 시점 (Jenkins / CI) 에서 주입.
- **이미지 push 없음** — `docker build` 만, tag 는 `clemvion-build-check/*:latest` throwaway. 외부 registry 영향 0.
- **build 시간 증가 — trade-off 수용**: docker layer cache 가 있으면 30-60s 추가 (이후는 빠름). first build 약 2-3분. monorepo 새 패키지 신설 시점에만 cold cache.

## 리스크 / 완화

| 리스크 | 완화 |
|---|---|
| docker daemon 미설치 환경에서 build 단계 실패 | `command -v docker` 또는 `docker info` 가드 + skip — INFRA_NOT_AVAILABLE 처리. local developer 에게 build 단계 강제 실패 방지 |
| docker layer cache 가 없으면 첫 build 가 길어짐 | 정상 동작. Jenkins / CI 는 매 빌드마다 cache 가 있을 가능성. 사용자는 한 번에 cache 채워짐 |
| `cmd_build` 안에서 backend / frontend Dockerfile 의 build context (repo root) 가 PWD 와 다를 위험 | 본 worktree 는 `git worktree` 기반이라 PWD = worktree root. `docker build ... .` 의 `.` 가 worktree root 를 가리킴 — Dockerfile 의 `COPY codebase/packages/*` 정상 작동 |

## 완료 기준

- `cmd_build` 가 backend + frontend Next build + docker build 4 단계 모두 검증
- `.claude/tools/run-test.sh build` 통과
- regression 시뮬레이션 (Dockerfile 한 줄 제거 → build 실패 확인) 통과
- `plan/in-progress/` → `plan/complete/` 이동

## 후속 plan 권고

- 없음. 본 plan 완료 시 monorepo packages COPY 누락 회귀 영구 차단.
- v2 후보 (사용자 요청 시): Dockerfile multi-stage 의 deps stage 를 별 reusable shell 함수로 추출 — backend / frontend Dockerfile 의 COPY 패턴 중복 자체 제거. 본 plan 범위 밖.

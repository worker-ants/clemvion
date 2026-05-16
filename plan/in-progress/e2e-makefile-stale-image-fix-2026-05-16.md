---
worktree: bg-monitoring-e2e-fix-f789b9
started: 2026-05-16
owner: developer
---

# `make e2e-test` Stale Docker Image — Background 모니터링 e2e 사전 결함 (2026-05-16)

## 배경

`background-monitoring.e2e-spec.ts` 의 2 테스트가 main 브랜치에서 reproducible 하게 실패. 사용자 보고 (user-guide-sync 작업의 REVIEW WORKFLOW 단계 e2e 결과) 후 본 worktree 에서 별도 조사.

## 근본 원인 (Root Cause)

`Makefile` 의 `e2e-test` / `e2e-up` / `e2e-test-full` 타겟이 `docker compose ... up -d --wait backend-e2e` 만 호출하고 **`--build` 플래그를 누락**했다. 결과:

1. 첫 e2e 실행 후 `clemvion-e2e-backend-e2e:latest` 이미지가 Docker daemon 에 캐시됨.
2. 이후 backend 소스 (controller / module / route) 가 추가·수정되어도 Compose 가 캐시된 이미지를 재사용 — rebuild 없이 그대로 컨테이너 기동.
3. 새 컨트롤러가 이미지 안 `dist/` 에 없으므로 NestJS RoutesResolver 가 등록조차 하지 않고, 외부 요청은 Express 의 `Cannot GET ...` 404 로 떨어진다.

### 증거

- `docker inspect clemvion-e2e-backend-e2e:latest --format '{{.Created}}'` → `2026-05-12T10:21:35Z`.
- `BackgroundRunsController` 추가 커밋 `cd7603df feat(executions): Background 본문 모니터링 API` → 5월 14-15일.
- 빈 stale 이미지의 컨테이너 startup log 에서 `RoutesResolver` 등록 controller 26개 (소스 28개) — `BackgroundRunsController` 와 `ThirdPartyOAuthController` 누락.
- `docker compose -f docker-compose.e2e.yml build backend-e2e` 후 동일 `make e2e-test` 실행 → 12/12 suites, 66/66 tests PASS.

## 작업 범위

- [x] `Makefile` 의 `e2e-up`, `e2e-test`, `e2e-test-full` 타겟에 `--build` 플래그 추가 — `up -d --wait --build backend-e2e`, `run --rm --build backend-e2e-runner`, `run --rm --build playwright-runner`. WHY: Docker BuildKit layer cache 가 변경되지 않은 layer 는 재사용하므로 첫 build 이후 오버헤드는 작음. 누락 시 새로 추가한 controller 가 stale 이미지에 반영되지 않아 사일런트 404.
- [x] 사전 결함 lint error 동반 수정 — `third-party-oauth.controller.spec.ts` L428~430 의 `Record<string, unknown>` 타입을 `Record<string, string>` 로 좁혀 `@typescript-eslint/no-base-to-string` 위반 해소.
- [x] consistency-check --impl-prep

## 의도적 제외

- **BackgroundRunsController / ThirdPartyOAuthController 로직 변경** — 코드 자체에는 문제 없음. stale 이미지가 유일한 원인.
- **CI workflow 변경** — CI 는 매번 fresh container 라 영향 없음 (docker layer cache 도 사용량 한도까지).

## 후속

- 이 fix 이후 `make e2e-test` 가 매번 `docker compose ... up --build` 를 실행 → BuildKit layer cache 가 변경되지 않은 layer 는 재사용하므로 첫 build 이후 부담 작음.
- (선택) `.github/workflows/*` 가 `make e2e-test` 를 그대로 호출하는지 확인. CI 는 매 실행 fresh runner 라 영향 없지만 의존성 명시 차원.

## 체크리스트

- [x] consistency-check
- [x] 구현 (Makefile 수정 + 동반 lint fix)
- [x] TEST WORKFLOW — backend lint(error 0)·unit(3580/3580 PASS)·build·e2e(`make e2e-test` 12/12 suites, 66/66 tests)
- [ ] REVIEW WORKFLOW

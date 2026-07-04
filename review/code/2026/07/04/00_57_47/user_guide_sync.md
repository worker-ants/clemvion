# 유저 가이드 동반 갱신(User Guide Sync) Review

## 점검 절차 기록

1. SSOT 적재: `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 change_type) Read 완료 + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표(L111-158) 보조 Read 완료.
2. 변경 파일 목록 (payload 28개):
   - `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (unit 테스트 재작성)
   - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (PR3 핵심 구현 — `reclaimStuckRunningExecution`/`redriveStuckExecution`/`skipExecutedNodes` 등)
   - `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts` (`skipExecutedNodes?: boolean` 옵션 추가)
   - `codebase/backend/src/modules/executions/executions.controller.ts` (`_test/recover-stuck-executions` — NODE_ENV=test 게이팅, `@ApiExcludeEndpoint()`)
   - `codebase/backend/test/execution-crash-redrive.e2e-spec.ts` (신규 e2e)
   - `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/spec-draft-crash-running-redrive.md` (plan/설계 문서)
   - `review/consistency/2026/07/03/23_50_01/**`, `review/consistency/2026/07/04/00_12_57/**` (consistency-check 산출물 14개)
   - `spec/1-data-model.md` §2.13, `spec/5-system/3-error-handling.md` §1.4, `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.3/§7.5, `spec/conventions/error-codes.md` §3, `spec/data-flow/3-execution.md` §1.1/§3.3 (spec 본문 — 이미 이 changeset 안에서 planner 가 동반 갱신 완료)
3. 매트릭스 21개 trigger 전건에 대해 glob/semantic 매칭 시도.

## 매칭 분석

- **new-node** (`codebase/backend/src/nodes/**`) — 변경 파일 없음. 미매칭.
- **node-schema-change** — 동일. 미매칭.
- **new-ui-string** (`*.tsx`) — 변경 파일 중 `.tsx` 없음. 미매칭.
- **integration-provider-change** — provider 변경 없음. 미매칭.
- **new-userguide-section-dir** (`content/docs/*/`) — 신규 섹션 디렉토리 없음. 미매칭.
- **backend-api-change** (`*.controller.ts` / `dto/**`) — `executions.controller.ts` 매칭. 단, 신설 엔드포인트(`POST /executions/_test/recover-stuck-executions`)는 `NODE_ENV!=='test'` 시 404 를 던지고 `@ApiExcludeEndpoint()`로 swagger 노출도 명시적으로 배제한 **e2e 전용 테스트 하네스**다 — 실제 프로덕션 API 표면이 아니므로 "API 노출 변경이 사용자 안내에 영향" 요건에 해당하지 않는다. INFO 로만 기록(아래).
- **new-warning-code / new-error-code** — `WORKER_HEARTBEAT_TIMEOUT` / `RESUME_CHECKPOINT_MISSING` / `EXECUTION_TIME_LIMIT_EXCEEDED` 모두 코드 문자열 자체는 **불변**(재사용) — 신규 코드 발행 없음. `WORKER_HEARTBEAT_TIMEOUT` 은 오히려 PR3 기간 동안 **미발동**으로 의미만 축소됐고, 이 사실은 이미 `spec/1-data-model.md` §2.13·`spec/5-system/3-error-handling.md` §1.4·`spec/conventions/error-codes.md` §3·`spec/data-flow/3-execution.md` 4곳에 동반 갱신됐다(payload 파일 24/25/27/28). 미매칭(신규 아님).
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 변경 파일은 `execution-engine`/`executions` 모듈이며 `modules/auth/**` 경로 밖. 미매칭.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 변경 없음. 미매칭.
- **run-debug-flow-change** (semantic, "실행·디버깅 흐름 변경") — 가장 근접한 회색 지대. `recoverStuckExecutions` 의 동작이 "부팅 시 stale RUNNING 일괄 fail" → "원자 re-claim + rehydration re-drive" 로 바뀌어 실행 엔진의 크래시 복구 흐름 자체는 분명 변경됐다. 그러나 이는 **서버 내부 장애 복구 메커니즘**으로 사용자가 트리거하거나 관찰하는 "실행·디버깅" UI 흐름(재실행 버튼, 실행 결과 패널, 에러 뱃지 등, `05-run-and-debug/*.mdx`)과는 레이어가 다르다 — 사용자 관점에서는 "크래시된 실행이 이전엔 실패로 끝났는데 이제는 자동 재개되어 완료된다"는 것은 최종 상태(완료/실패)의 차이일 뿐 사용자가 조작하는 화면 요소가 아니다. `05-run-and-debug/error-handling.mdx` 를 확인한 결과 `WORKER_HEARTBEAT_TIMEOUT`·크래시 복구 관련 서술 자체가 원래도 없다(사용자 가시 표면이 아니었음 — 이번 PR 이 새로 만든 gap 아님). INFO 로 기록.
- **spec-major-change** (`spec/{2,3,4,5}-*/**`, `spec/conventions/**`) — `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md` 매칭. frontmatter `code:`/`status:`/`pending_plans:` 정합은 이미 `review/consistency/2026/07/04/00_12_57` (`--impl-prep`, BLOCK:NO) 로 검증 완료된 것으로 payload 에 기록돼 있음. 별도 미검증 항목 없음(이 reviewer 영역 밖 — spec-coverage/consistency-checker 소관이나 payload 상 이미 통과 확인).
- 그 외 (`new-bullmq-queue`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-config-type-enum-change`, `env-runtime-change`, `userguide-gui-flow-section`, `spec-defect-found`) — 전부 미매칭.

## 발견사항

- **[INFO]** `executions.controller.ts` 신규 엔드포인트는 프로덕션 API 표면이 아니므로 갱신 불요
  - 변경 파일: `codebase/backend/src/modules/executions/executions.controller.ts` (`POST /executions/_test/recover-stuck-executions`)
  - 매트릭스 항목: `backend-api-change` — "controller·DTO 의 swagger jsdoc / API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: 신설 라우트는 `@ApiExcludeEndpoint()` + `NODE_ENV!=='test'` 404 게이팅으로 명시적으로 "존재하지 않는 것처럼" 취급되는 e2e 테스트 하네스다(주석에 "프로덕션 표면 아님" 명시). swagger 문서·user-guide 갱신 대상이 아님.
  - 제안: 조치 불요. (참고용 기록 — 향후 유사 `_test/*` 라우트 추가 시 동일 예외가 재확인되도록.)

- **[INFO]** 크래시 복구 흐름 변경은 `05-run-and-debug/` 사용자 가시 표면과 무관
  - 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`recoverStuckExecutions`/`reclaimStuckRunningExecution`/`redriveStuckExecution`)
  - 매트릭스 항목: `run-debug-flow-change` (semantic) — "실행·디버깅 흐름 변경 → `codebase/frontend/src/content/docs/05-run-and-debug/`"
  - 상세: 변경은 서버 재시작/워커 크래시 시 내부 복구 메커니즘(즉시 fail → 원자 re-claim 후 rehydration 재구동)을 바꾼 것으로, 사용자가 조작하는 실행/디버깅 UI 흐름이 아니다. `05-run-and-debug/error-handling.mdx` 확인 결과 `WORKER_HEARTBEAT_TIMEOUT`·크래시 재개 관련 서술이 원래 없었고(사전 gap, 본 PR 무관), 최종 사용자 관찰 가능 결과는 "실행이 완료됨"뿐이라 별도 사용자 가이드 문구가 필요하지 않다.
  - 제안: 조치 불요. 단, 향후 PR4(BullMQ stalled 자동 재배달 도입, `WORKER_HEARTBEAT_TIMEOUT` 실제 발동 재개)에서 사용자가 실행 결과 화면에서 이 에러 코드를 실제로 볼 가능성이 생기면 그 시점에 `05-run-and-debug/error-handling.mdx` 갱신 여부를 재검토할 것.

- **[INFO]** spec 본문 동반 갱신은 이미 같은 changeset 안에서 완료됨(참고 확인)
  - 변경 파일: `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`
  - 매트릭스 항목: `spec-major-change` — frontmatter 정합 + consistency-check
  - 상세: `WORKER_HEARTBEAT_TIMEOUT` 의미 축소(PR3 기간 미발동)가 4개 spec 문서에 일관되게 반영됐고, `review/consistency/2026/07/04/00_12_57` (`--impl-prep`, BLOCK:NO)/`review/consistency/2026/07/03/23_50_01` (`--spec`, BLOCK:NO) 로 이미 검증 통과가 payload 에 기록돼 있음. 이 reviewer 관점(frontend docs/i18n)에서는 추가 조치 없음.
  - 제안: 조치 불요.

## 요약

매트릭스 21개 trigger 중 이번 diff(백엔드 실행 엔진 크래시 re-drive 내부 로직 + unit/e2e 테스트 + plan/spec 문서 + consistency-check 산출물)에 매칭되는 것은 `backend-api-change`(e2e 전용 예외 라우트, 갱신 불요) 와 `run-debug-flow-change`(semantic, 사용자 비가시 내부 메커니즘이라 갱신 불요) 2건뿐이며 둘 다 정당한 예외로 판정됐다. 노드 추가/스키마 변경, TSX 신규 문자열, 통합 provider 변경, 신규 섹션 디렉토리, 인증/권한 흐름 변경, 표현식 언어 변경, 신규 warning/error 코드 발행 등 CRITICAL/WARNING 급 trigger 는 전혀 매칭되지 않았다. spec 본문(§2.13/§1.4/§7.1-7.5/error-codes/data-flow)은 이미 같은 changeset 안에서 planner 가 동반 갱신했고 consistency-check 로 검증 통과가 확인된다. 유저 가이드 동반 갱신 관점에서 이 PR 은 완전히 영역 무관(백엔드 내부 복구 로직)에 가깝다.

## 위험도

NONE

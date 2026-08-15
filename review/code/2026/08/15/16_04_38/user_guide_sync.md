STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===

# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows: 20개, id 목록 new-node / node-schema-change / new-ui-string / new-widget-chrome-string / integration-provider-change / new-userguide-section-dir / backend-api-change / new-bullmq-queue / new-warning-code / new-error-code / new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field / auth-session-flow-change / auth-config-type-enum-change / expression-language-change / run-debug-flow-change / env-runtime-change / spec-major-change / userguide-gui-flow-section / spec-defect-found) 를 Read, `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표(147~155행 부근)를 보조로 대조.

## 변경 파일 (13개, 전량 확인)
1. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 테스트 리팩터 (자매 함수와 동형인 트랜잭션 mock 하네스 추가)
2. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted` 의 Execution/NodeExecution 2-테이블 UPDATE 를 `dataSource.transaction` 으로 원자화 (기존엔 각각 autocommit)
3. `plan/in-progress/eia-stalled-atomicity.md` — 작업 plan
4. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 작업 plan
5~12. `review/consistency/2026/08/15/15_54_20/*` — 이전 라운드 consistency-check 산출물 (리뷰 아티팩트, 코드 아님)
13. `spec/5-system/4-execution-engine.md` — §7.1 mid-operation stalled 트리거 서술에 "이 마감은 단일 트랜잭션이다(2026-08-15)" 한 문장 추가

## 매칭 분석

- **new-node / node-schema-change** — 트리거 glob `codebase/backend/src/nodes/**` 불일치 (변경은 `execution-engine/` 모듈, 노드 디렉토리 아님). 미매칭.
- **new-ui-string / new-widget-chrome-string** — `*.tsx` 변경 없음. 미매칭.
- **integration-provider-change** — provider 변경 없음. 미매칭.
- **new-userguide-section-dir** — `content/docs/*/` 신규 디렉토리 없음. 미매칭.
- **backend-api-change** — `*.controller.ts` / `dto/**` 변경 없음 (`execution-engine.service.ts` 는 controller/DTO 아님). 미매칭.
- **new-bullmq-queue** — `system-status.constants.ts` 변경 없음. 미매칭.
- **new-warning-code / new-error-code** — `warningRules` 또는 `error-codes.ts` 변경 없음. 이번 diff 는 기존 `WORKER_HEARTBEAT_TIMEOUT` 코드(이미 존재)를 그대로 재사용 — 신규 코드 발행 아님. 미매칭.
- **auth-session-flow-change** — `codebase/backend/src/modules/auth/**` 무관. 미매칭.
- **expression-language-change** — `codebase/packages/expression-engine/**` 무관. 미매칭.
- **run-debug-flow-change** (semantic, "실행·디버깅 흐름 변경" → `05-run-and-debug/`) — 후보로 검토. 실제로는 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `finalizeStalledExhausted` 내부 DB 쓰기 순서를 autocommit 2건 → 단일 트랜잭션으로 바꾼 **내부 원자성/신뢰성 리팩터**다. 사용자 관찰 가능한 산출물(에러 코드 `WORKER_HEARTBEAT_TIMEOUT`, 에러 메시지, emit 되는 이벤트, Run 화면에 표시되는 상태)은 diff 전후로 **동일**하다 — 유일한 차이는 두 UPDATE 의 원자성(부분 커밋으로 인한 유령 `RUNNING` NodeExecution 잔류 방지)뿐이며 이는 서버 내부 신뢰성 문제이지 사용자에게 노출되는 실행/디버깅 UI 흐름이 아니다. `codebase/frontend/src/content/docs/05-run-and-debug/*.mdx` 5개 파일을 grep 했으나 `stall`/`heartbeat`/`재배달`/`크래시` 등 이 내부 재개 메커니즘을 언급하는 대목이 원래도 없어, 갱신할 기존 서술 자체가 없다. **미매칭으로 판정** (grey zone 이었으나 사용자 가시 동작 불변 확인).
- **spec-major-change** (`spec/5-*/**`) — `spec/5-system/4-execution-engine.md` 가 glob 에 매칭한다. 다만 이 행의 target 은 frontmatter `code:`/`status:`/`pending_plans:` 정합이며, 추가된 것은 이미 `implemented` 상태인 §7.1 서술에 구현 세부(트랜잭션 원자화) 한 문장을 보강한 것뿐 — 신규 코드 경로나 상태 전환이 아니라 frontmatter 영향 없음. 이 행은 spec 정합성 영역(`consistency-checker`)의 관할이며 본 리뷰어(유저 가이드 docs/i18n/backend-labels) 스코프 밖.
- **userguide-gui-flow-section** — `02-nodes/**.mdx` / `06-integrations-and-config/**.mdx` 무관. 미매칭.
- 나머지 행(new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-config-type-enum-change, env-runtime-change, spec-defect-found) — 전부 trigger 조건과 무관.

## 결론

13개 변경 파일 모두 확인했으며, `codebase/frontend/**` (docs MDX, i18n dict, backend-labels.ts, locale.ts) 어디에도 변경이 없다. 코드 변경은 백엔드 `execution-engine.service.ts` 내부의 트랜잭션 원자성 리팩터(사용자 가시 동작·에러 코드·메시지 불변)와 이를 검증하는 spec 파일뿐이며, 매트릭스 20개 행 중 어느 것도 확정 매칭되지 않는다(가장 근접했던 `run-debug-flow-change` 도 사용자 가시 동작 불변으로 배제). 나머지 파일(plan 문서, 이전 라운드 consistency-check 아티팩트)은 매트릭스 trigger 대상이 아니다.

## 요약
매트릭스 20개 trigger 행 중 매칭 0건, 누락 0건. 변경은 `execution-engine.service.ts` 의 `finalizeStalledExhausted` 2-UPDATE 를 단일 트랜잭션으로 묶는 내부 원자성 버그픽스 + 대응 테스트/spec 문장 보강으로, 사용자 가시 동작(에러 코드/메시지/UI)이 diff 전후 동일해 유저 가이드·i18n dict·backend-labels 어느 것도 갱신 대상이 아니다. 해당 없음.

## 위험도
NONE

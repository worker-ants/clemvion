# 유저 가이드 동반 갱신(User Guide Sync) Review

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows: 20개, id 목록: new-node, node-schema-change, new-ui-string, integration-provider-change, new-userguide-section-dir, backend-api-change, new-bullmq-queue, new-warning-code, new-error-code, new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-session-flow-change, auth-config-type-enum-change, expression-language-change, run-debug-flow-change, env-runtime-change, spec-major-change, userguide-gui-flow-section, spec-defect-found) 을 Read. 보조로 PROJECT.md §변경 유형 → 갱신 위치 매핑 표 확인.

## 변경 파일 식별
commit `656fc7cce1` (20 files changed):
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `execution_failed` 알림 dispatch 버그 2건 수정 (재개 세그먼트 dispatch 누락 + `NotificationsService` `@Optional` undefined → `ModuleRef` lazy resolve)
- `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` — JSDoc 주석만 보강
- `codebase/backend/src/modules/notifications/entities/notification.entity.ts` — 기존 `backgroundRunId` 컬럼에 `select: false` 추가 (REST 미노출 강제)
- `codebase/backend/src/modules/notifications/notifications.service.spec.ts` — unit 테스트 3건 추가
- `codebase/backend/src/modules/notifications/notifications.service.ts` — JSDoc 주석만 보강
- `plan/in-progress/notif-hardening-followups.md`, `plan/in-progress/spec-update-notifications-background-run-id.md` — plan tracker 갱신 (spec 은 아직 planner 위임 draft 상태, 이번 diff 범위 아님)
- `review/code/2026/07/06/21_23_13/{SUMMARY.md,_retry_state.json,meta.json,architecture.md,database.md,documentation.md,maintainability.md,performance.md,requirement.md,scope.md,security.md,side_effect.md,testing.md}` — 선행 리뷰 세션 산출물 (review artifact, docs 아님)

## trigger 매칭

- **new-node** (`codebase/backend/src/nodes/**`) — 매칭 없음. 이번 diff 는 `nodes/` 디렉토리를 전혀 건드리지 않음.
- **node-schema-change** — 매칭 없음. `notification.entity.ts` 컬럼 변경(`select: false`)은 노드 스키마가 아니라 내부 알림 엔티티이며, 새 필드 추가도 아니고 REST 미노출을 물리적으로 강제하는 방어 코드일 뿐.
- **new-ui-string** (frontend TSX) — 매칭 없음. frontend 파일이 diff 에 전혀 포함되지 않음.
- **integration-provider-change** — 매칭 없음.
- **new-userguide-section-dir** — 매칭 없음. `content/docs/` 변경 없음.
- **backend-api-change** (controller/DTO) — 매칭 없음. `NotificationsController`/DTO 파일 변경 없음(엔티티 컬럼만 변경, REST 응답 shape 은 오히려 `select: false` 로 **덜** 노출되는 방향).
- **new-warning-code / new-error-code** — 매칭 없음. `warningRules`/`error-codes.ts` 변경 없음. grep 결과 diff 대상 파일에 `ErrorCode.`/`warningRules` 참조 없음.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 매칭 없음.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 매칭 없음.
- **run-debug-flow-change** — 의미상 "실행 엔진" 변경이라 유사해 보이나, 실질은 실행 **결과 알림(notification) dispatch** 버그 수정이지 실행·디버깅 UX/로그 흐름 자체의 변경이 아님 (사용자가 05-run-and-debug 문서에서 보는 실행/디버깅 절차·화면에 영향 없음). 회색 지대로 INFO 처리.
- **spec-major-change** (`spec/2-*~5-*`, `spec/conventions/**`) — 매칭 없음. `spec/` 파일은 이번 diff 에 없음 (spec-update draft 는 `plan/in-progress/`에 있고 아직 planner 미착수 상태로 명시됨 — 의도된 지연이며 tracker 에 "planner 위임" 대기로 정확히 기록됨).

## 발견사항

- **[INFO]** 실행·디버깅 흐름과 인접하나 문서 갱신 대상은 아님
  - 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - 매트릭스 항목: `run-debug-flow-change` — targets: `codebase/frontend/src/content/docs/05-run-and-debug/`
  - 상세: 변경은 `execution_failed` **알림(notification)** 이 실제로 발사되지 않던 dispatch 버그 수정으로, 실행 엔진의 사용자 가시 동작(실행 화면·디버그 로그·재실행 UX)을 바꾸지 않는다. `05-run-and-debug/` 문서가 서술하는 "실행 실패 시 무엇이 보이는가" 자체는 이미 execution_failed 알림 존재를 전제로 서술돼 있었을 가능성이 높고(버그 수정으로 그 전제가 마침내 참이 됨), 새 사용자 행동이나 화면 변경은 아니므로 WARNING 승격 근거 약함.
  - 제안: 필요시 확인만 — `05-run-and-debug/*.mdx` 가 "실행 실패 시 알림을 받는다"고 서술 중이라면 이번 수정으로 그 서술이 이제 실제로 사실이 되었을 뿐이므로 문서 변경 불요. 별도 액션 없음.

- **[INFO]** notification.entity 컬럼 변경은 스키마 트리거이나 문서 대상 없음
  - 변경 파일: `codebase/backend/src/modules/notifications/entities/notification.entity.ts`
  - 상세: `backgroundRunId` 컬럼에 `select: false` 추가는 신규 필드 추가나 라벨/타입 변경이 아니라 기존 내부 전용 컬럼의 REST 노출을 물리적으로 차단하는 방어 코드(SUMMARY 21_23_13 WARNING #1 조치). 사용자 가이드·i18n dict 대상 필드가 아님(애초 REST 미노출 의도 컬럼).
  - 제안: 없음.

## 요약
매트릭스 20개 trigger 전건 검토 결과 이번 commit(`656fc7cce1`, notification dispatch 버그 수정 + JSDoc + plan tracker + 선행 리뷰 세션 아카이브 20개 파일)은 어떤 trigger 에도 확정적으로 매칭되지 않는다. `codebase/backend/src/nodes/**`, `codebase/frontend/**`(docs/i18n/dict/backend-labels 포함), `codebase/packages/expression-engine/**`, `codebase/backend/src/modules/auth/**` 변경이 전무하고, 신규 warningCode/errorCode 발행도 없다. `run-debug-flow-change` 와 근접해 보이는 회색 지대 1건을 INFO 로 기록했으나 사용자 가시 실행/디버그 흐름 변경이 아니라 알림 dispatch 내부 버그 수정이라 문서 갱신 의무는 없다고 판단.

## 위험도
NONE

# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 절차 요약

1. `.claude/config/doc-sync-matrix.json` (rows 21건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(L134-198)을 Read 하여 SSOT 로 적재.
2. 변경 파일 목록을 `git diff --name-only origin/main...HEAD -- codebase/` 로 보강 확인 (prompt 의 diff 가 일부 파일에서 생략돼 있어 실제 changeset 을 직접 조회).
3. 실제 changeset (`codebase/` 범위, 31개 파일)은 **전부 `codebase/backend/**` 내부**다 — `codebase/frontend/**`, `codebase/channel-web-chat/**` 변경이 **0건**. `spec/**` 변경도 0건 (plan/ 트래커 문서 1건만 갱신, 매트릭스 대상 아님).

## Trigger 매칭 결과

matrix 21행 각각을 changeset(아래 목록)과 대조:

```
codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts
codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts
codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts
codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts
codebase/backend/src/modules/schedules/schedules.controller.spec.ts
codebase/backend/src/modules/schedules/schedules.controller.ts
codebase/backend/src/modules/schedules/schedules.service.spec.ts
codebase/backend/src/modules/schedules/schedules.service.ts
codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts
codebase/backend/src/modules/triggers/triggers.service.spec.ts
codebase/backend/src/modules/triggers/triggers.service.ts
codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts
codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts
codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts
codebase/backend/src/shared/testing/response-contract.spec.ts
codebase/backend/src/shared/testing/response-contract.ts
codebase/backend/test/*.e2e-spec.ts (11개, assertMatchesContract 배선/신규 케이스)
```

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 매치 없음.
- **new-ui-string / new-widget-chrome-string** (frontend·channel-web-chat `.tsx`) — 매치 없음 (frontend 변경 0건).
- **integration-provider-change** (semantic) — `IntegrationDto` 필드가 늘었지만 신규/변경된 provider 는 없다 (기존 cafe24/makeshop 계열 필드를 선언에 반영하는 것뿐). 매치로 보지 않음.
- **new-userguide-section-dir** — `content/docs/` 변경 0건, 매치 없음.
- **new-bullmq-queue** — `system-status.constants.ts` 변경 없음, 매치 없음.
- **new-warning-code / new-error-code** — `warningRules` 정의 파일·`error-codes.ts` 변경 없음. `triggers.service.ts` 는 `chatChannelHealth`/`notificationHealth` **enum 값**을 응답에 실어 보내지만, 이는 기존 `TriggerChatChannelHealth`/`TriggerNotificationHealth` 타입(엔티티에 이미 존재, import 만 추가)의 **선언 노출**이지 신규 warningCode/errorCode 발행이 아니다. 매치 없음.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 매치 없음. `triggers.service.ts`/`schedules.service.ts` 가 secret 을 다루긴 하나 인증·세션 미들웨어가 아니라 응답 직렬화 로직이라 이 trigger 대상이 아니다.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 매치 없음.
- **run-debug-flow-change** (semantic) — 실행 엔진/디버그 로깅 변경 없음 (스케줄·트리거 CRUD 응답 정합 작업). 매치 없음.
- **AuthConfig type enum 변경 / cross-cutting enum / handler output field / bullmq** — 모두 매치 없음.
- **backend-api-change** (`**/*.controller.ts`, `**/dto/**`) — **매치**. `schedules.controller.ts` + 5개 응답 DTO 파일(`alert-rule`, `integration`, `knowledge-base`, `schedule`, `trigger`)이 필드 추가/축소.

## backend-api-change 매치에 대한 동반 갱신 점검

목표 (a) controller·DTO 의 swagger jsdoc, (b) API 노출 변경이 사용자 안내에 영향이면 관련 user-guide 페이지.

**(a) swagger jsdoc — 충족.** 신규/변경된 모든 필드에 `/** ... */` JSDoc 이 동반됐다 (예: `AlertRuleDto.createdBy` — `/** 생성한 사용자 ID (없으면 null) */`, `IntegrationDto.appUrl` — `/** cafe24 Private 앱의 관리자 URL — 그 외에는 null */`, `TriggerDto.chatChannelHealth` — `/** chat-channel 연동 상태 */` 등). `swagger-dto-contract-guard.ts` 가 이 조합을 정적으로 검증하는 별도 가드다.

**(b) user-guide 페이지 — 판단: 불필요 (신규 사용자 가시 기능 없음).** 이 PR 은 §5.4 "응답-계약 스윕" — DTO 선언과 실제 wire 응답을 대조해 **이미 나가고 있던** 필드를 뒤늦게 선언하거나(예: `IntegrationDto.appUrl`·`KnowledgeBaseDto.rerankMode` 등), 반대로 **선언 없이 새고 있던 secret**(`notificationSecretV2`·`chatChannelTokenV2`·`triggerToken`)을 응답 경계에서 제거하는 작업이다. 코드 주석이 각 필드마다 "이미 응답에 실려 나가고 있었다" · "프런트엔드가 실제로 소비하므로"라고 명시한다 — 즉 **wire 동작 자체는 이 PR 이전부터 동일**했고, 이번 변경은 Swagger 선언을 실측에 맞추는 정합화(+ 시크릿 제거 하드닝)다. `codebase/frontend/**` 변경이 0건인 것도 이와 일치한다 — 이미 소비 중인 필드라 프런트엔드 쪽 신규 배선이 필요 없었다. 따라서 "API 노출 변경이 사용자 안내에 영향"에 해당하는 **신규** 사용자 가시 동작이 없어 `06-integrations-and-config/`·`07-workspace-and-team/` 등 관련 user-guide 페이지 갱신 의무는 발생하지 않는다고 판단한다.

유일하게 실질적 wire 변경으로 볼 수 있는 부분은 `ScheduleDto.trigger`/`TriggerDto.workflow` 를 **엔티티 전체 → 참조(reference) DTO** 로 좁힌 것인데, 이는 기존에 노출되던 필드(`id`/`name`/`workflowId`) 는 그대로 유지하면서 그 외 필드(주로 secret)만 제거하는 **축소** 이고, 코드 주석상 소비처(`schedules/page.tsx`, `triggers/page.tsx`)가 참조하는 필드는 모두 보존된다. 사용자 가시 UI 동작 변화가 없으므로 문서 갱신 트리거로 보지 않는다.

## 발견사항

없음 — 이번 changeset 은 매트릭스 trigger 중 "백엔드 API 추가·변경" 1건에만 매치되며, (a) swagger jsdoc 동반은 이미 같은 diff 안에 포함돼 있고, (b) user-guide 페이지 갱신은 신규 사용자 가시 기능이 없어 불필요하다고 판단된다. 그 외 20개 trigger(노드 추가/schema, UI 문자열, provider, 신규 섹션, BullMQ 큐, warning/error code, cross-cutting enum, auth 흐름, 표현식 언어, 실행/디버깅 흐름, spec 대규모 변경 등)는 대응하는 파일이 changeset 에 전혀 없어 매칭 자체가 성립하지 않는다.

## 요약

매트릭스 21개 trigger 중 "백엔드 API 추가·변경"(semantic) 1건만 이번 backend 전용 changeset(31개 파일, 전부 `codebase/backend/**`, frontend/spec 변경 0건)에 매치됐다. 매치된 trigger 의 (a) swagger jsdoc 요건은 diff 내에서 이미 충족돼 있고, (b) user-guide 페이지 요건은 이 PR 이 신규 기능이 아니라 "이미 나가고 있던 필드의 선언 정합화 + secret 노출 제거" 임이 코드 주석·frontend 무변경으로 뒷받침되어 불필요로 판단했다. 동반 갱신 누락은 발견되지 않았다.

## 위험도

NONE

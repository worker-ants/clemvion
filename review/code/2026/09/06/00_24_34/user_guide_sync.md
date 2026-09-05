# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 절차 요약

1. `.claude/config/doc-sync-matrix.json` (rows 21건, `id` 색인) 을 Read 해 SSOT 로 적재.
2. prompt 의 변경 파일 목록(파일 1~32, `codebase/` 범위)을 전수 확인. 나머지(파일 33~208)는 `plan/in-progress/**`·`review/code/**`·`review/consistency/**` 아카이브 산출물이라 매트릭스 대상 밖(`spec/**`·`codebase/frontend/**` 아님).
3. `grep`/`git log` 로 changeset 전체에서 `codebase/frontend/**`·`codebase/packages/**`·`codebase/channel-web-chat/**` 매치 0건 확인 — 이번 changeset 은 **전부 `codebase/backend/**` 내부**다.

## 변경 파일 (codebase/ 범위, 32건)

```
codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts
codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts
codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts
codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts
codebase/backend/src/modules/schedules/schedules.controller.{ts,spec.ts}
codebase/backend/src/modules/schedules/schedules.service.{ts,spec.ts}
codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts
codebase/backend/src/modules/triggers/triggers.service.{ts,spec.ts}
codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts (신규)
codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts
codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts
codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}
codebase/backend/test/*.e2e-spec.ts (14개, assertMatchesContract 배선/신규 케이스)
CHANGELOG.md
```

## Trigger 매칭 결과

매트릭스 21행 전부를 changeset 과 대조:

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 매치 없음.
- **new-ui-string / new-widget-chrome-string** (frontend·channel-web-chat `.tsx`) — 매치 없음 (frontend 변경 0건).
- **integration-provider-change** (semantic) — `IntegrationDto` 필드가 늘었지만(`appUrl`·`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures`) 신규/변경된 provider 는 없다. 코드 주석이 "이미 응답에 실려 나가고 있었다"·"컨트롤러가 엔티티를 그대로 반환하기 때문"이라고 명시 — 기존 cafe24/makeshop 계열이 이미 채우던 값의 **선언 정합화**다. 매치로 보지 않음.
- **new-userguide-section-dir** — `content/docs/` 변경 0건, 매치 없음.
- **new-bullmq-queue** — `system-status.constants.ts` 변경 없음, 매치 없음.
- **new-warning-code / new-error-code** — `warningRules` 정의 파일·`error-codes.ts` 변경 없음. `triggers.service.ts` 는 `chatChannelHealth`/`notificationHealth` 값을 응답에 실어 보내지만, 이는 엔티티에 이미 존재하던 `TriggerChatChannelHealth`/`TriggerNotificationHealth` 타입의 **선언 노출**(import 추가)이지 신규 warningCode/errorCode 발행이 아니다. 매치 없음.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 매치 없음. `session-revocation.e2e-spec.ts` 가 `login-history.dto` 를 **import** 하지만 이는 테스트 파일의 계약 단언 추가일 뿐 `src/modules/auth/**` 자체의 수정이 아니다(그 디렉터리 아래 파일은 changeset 에 전혀 없음). 인증·세션 미들웨어 흐름 변경 없음.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 매치 없음.
- **run-debug-flow-change** (semantic) — 실행 엔진·디버그 로깅 변경 없음. 매치 없음.
- **AuthConfig type enum / cross-cutting enum / handler output field / backend zod ui 값 / env-runtime 변경** — 전부 매치 없음.
- **backend-api-change** (`**/*.controller.ts`, `**/dto/**`, semantic) — **매치**. `schedules.controller.ts` + 5개 응답 DTO(`alert-rule`·`integration`·`knowledge-base`·`schedule`·`trigger`)가 필드 추가/축소.

## backend-api-change 매치에 대한 동반 갱신 점검

목표: (a) controller·DTO 의 swagger jsdoc, (b) API 노출 변경이 사용자 안내에 영향이면 관련 user-guide 페이지.

**(a) swagger jsdoc — 충족.** 신규/변경된 모든 필드에 `/** ... */` JSDoc 이 동반됐다 (예: `AlertRuleDto.createdBy` — `/** 생성한 사용자 ID (없으면 null) */`, `IntegrationDto.appUrl` — 채우는 조건까지 명시한 JSDoc, `TriggerDto.chatChannelHealth` — `/** chat-channel 연동 상태 */`). `swagger-dto-contract-guard.ts` 가 이 조합(`@ApiProperty`/`@ApiPropertyOptional` + nullable 형태)을 정적으로 검증하는 별도 가드로 같은 diff 안에서 강화됐다.

**(b) user-guide 페이지 — 판단: 불필요 (신규 사용자 가시 기능 없음).** 이 PR 은 §5.4 "응답-계약 스윕" — DTO 선언과 실제 wire 응답을 대조해 **이미 나가고 있던** 필드를 뒤늦게 선언하거나(`IntegrationDto.appUrl`·`KnowledgeBaseDto.rerankMode` 등), 반대로 **선언 없이 새고 있던 secret**(`notificationSecretV2`·`chatChannelTokenV2`·트리거 조인 전체)을 응답 경계에서 제거하는 작업이다. 각 DTO 파일의 주석이 "이미 응답에 실려 나가고 있었다"·"프런트엔드가 실제로 소비하므로 빼면 계약 회귀"라고 명시한다 — wire 동작 자체는 이 PR 이전부터 동일했고, 이번 변경은 Swagger 선언을 실측에 맞추는 정합화 + secret 노출 축소(하드닝)다. `codebase/frontend/**` 변경이 0건인 것도 이와 일치한다 — 이미 소비 중인 필드라 프런트엔드 쪽 신규 배선이 필요 없었다.

`ScheduleDto.trigger`/`TriggerDto.workflow` 를 엔티티 전체 → 참조(reference) DTO 로 좁힌 부분(`ScheduleTriggerRefDto`/`TriggerWorkflowRefDto`)도 기존에 노출되던 필드(`id`/`name`/`workflowId`)는 유지하면서 secret 필드만 제거하는 **축소**이고, 소비처(`schedules/page.tsx`, `triggers/page.tsx`)가 참조하는 필드는 모두 보존된다 — 사용자 가시 UI 동작 변화 없음.

## 발견사항

없음 — 매트릭스 21개 trigger 중 "백엔드 API 추가·변경"(semantic) 1건에만 매치되며, (a) swagger jsdoc 동반은 같은 diff 안에 이미 포함돼 있고, (b) user-guide 페이지 갱신은 신규 사용자 가시 기능이 없어 불필요하다고 판단된다. 그 외 20개 trigger(노드 추가/schema, UI 문자열, provider, 신규 섹션, BullMQ 큐, warning/error code, cross-cutting enum, auth 흐름, 표현식 언어, 실행/디버깅 흐름, spec 대규모 변경 등)는 대응하는 파일이 changeset 에 전혀 없어 매칭 자체가 성립하지 않는다.

## 요약

매트릭스 21개 trigger 중 "백엔드 API 추가·변경"(semantic) 1건만 이번 backend 전용 changeset(32개 파일, 전부 `codebase/backend/**`+`CHANGELOG.md`, `codebase/frontend/**`·`codebase/packages/**`·`spec/**` 변경 0건)에 매치됐다. 매치된 trigger 의 (a) swagger jsdoc 요건은 diff 내에서 이미 충족돼 있고, (b) user-guide 페이지 요건은 이 PR 이 신규 기능이 아니라 "이미 나가고 있던 필드의 선언 정합화 + secret 노출 제거" 임이 코드 주석·frontend 무변경으로 뒷받침되어 불필요로 판단했다. 동반 갱신 누락은 발견되지 않았다.

## 위험도

NONE

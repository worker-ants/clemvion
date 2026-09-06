# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, code-only diff)

## 전제

이 PR 은 `spec/5-system/**` 자체를 변경하지 않는다 (scope 델타 0개 파일 — 정상, 코드 전용
스윕). 검토 대상은 diff 된 코드(`codebase/backend/src/modules/{triggers,schedules,alerts,
integrations,knowledge-base}/**`, `shared/testing/response-contract.ts`,
`repo-guards/__tests__/swagger-dto-contract-guard.ts`)가 **다른 spec 영역**(`spec/conventions/
secret-store.md`, `spec/5-system/1-auth.md` RBAC, `spec/1-data-model.md`)과 상충하는지다.
prompt 번들의 `<git diff>` 섹션 자체가 예산 초과로 절단되어, 대상 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)에서
`git diff origin/main...HEAD` 를 직접 열어 실측했다.

## 발견사항

- **[CRITICAL]** `config.interaction.triggerToken`(per-trigger 영구 평문 토큰 `itk_*`)이 이 PR
  이후에도 `GET/POST/PATCH /api/triggers` 응답에 그대로 노출된다 — 같은 PR 이 닫았다고
  주장하는 것과 **동일 등급·동일 위치**의 미해결 잔여
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 의
    `sanitizeForResponse()`(구 `sanitizeChatChannelForResponse`, L555 부근) — 이 PR 이 정확히
    이 메서드를 "세 곳(①`config.chatChannel` ②`config.notification.signing`
    ③엔티티 컬럼 `notificationSecretV2`/`chatChannelTokenV2`)을 다 덮는다" 고 확장했다. `config.
    interaction` 은 세 곳 중 어디에도 없다 — `revokePerTriggerToken()`(L1044-1082)이
    `trigger.config.interaction.triggerToken` 에 평문 `itk_*` 를 써 저장하지만,
    `sanitizeForResponse` 는 그 키를 건드리지 않는다. `TriggerDto.config`
    (`trigger-response.dto.ts` L53-55)는 `@ApiProperty({ type: 'object',
    additionalProperties: true })` 로 **열린 스키마**라, 이 PR 이 새로 세운
    §5.4 응답-계약 검증자(`response-contract.ts`)도 `swagger-dto-contract-guard.ts` 도
    이 누락을 "선언되지 않은 키" 로 잡지 못한다 — 검증자 사각지대까지 동형이다.
  - 충돌 대상: `spec/conventions/secret-store.md` §1.1 "비대상 필드도 **응답 바디에는
    나가지 않는다**" — 이 절이 `secret://` 밖에 평문으로 사는 필드로 **명시 열거**하는
    셋 중 하나가 정확히 `Trigger.config.interaction.triggerToken` 이다(L89: `"secret://
    밖에 사는 필드(AuthConfig.config 자격증명 · Trigger.config.interaction.triggerToken ·
    Trigger.notification_secret_v2)와 secret store ref(...) 는 응답 DTO 에 선언되어서도,
    응답 바디에 실려서도 안 된다."`). 이 PR 은 같은 목록의 `Trigger.notification_secret_v2`
    ·`chat_channel_token_v2`·`config.notification.signing.secretRef` 세 항목만 닫고
    `interaction.triggerToken` 은 남겼다.
  - 상세: `spec/conventions/secret-store.md` §1 이 `itk_*` 를 secret store 비통합 예외로
    인정하는 근거 (c)는 "발급 응답에 **1회만** 노출" 이다(같은 파일 L36 부근 `itk_*` 단락).
    이 전제가 무너지면 `itk_*` 를 영구 평문 저장한 설계의 안전 근거 자체가 성립하지 않는다.
    현재 코드는 그 전제를 어기고 **매 GET 요청마다** 노출한다 — RBAC §3.2
    (`spec/5-system/1-auth.md` "Trigger | CRUD | CRUD | CRUD | R")상 **Viewer 도 읽기 가능**
    이라 노출 인구가 좁지 않다. `PLAN` 트래커(`plan/in-progress/
    spec-draft-nullable-notation-followups.md`)는 "트리거 회전 secret 이 응답에 나간다" 항목을
    `[x]` 완료로 체크하며 "이 브랜치가 그 수정이다" 라 적었지만, 그 항목이 인용하는
    `secret-store.md §1.1` 자체가 열거하는 세 필드 중 하나는 이 브랜치의 수정 범위 밖이다 —
    완료 선언이 그 근거 문서의 열거 범위보다 좁다.
  - 제안: (a) 코드 — `sanitizeForResponse` 에 `NOTIFICATION_SIGNING_STRIP_KEYS` 와 동형인
    `INTERACTION_RESPONSE_STRIP_KEYS = new Set(['triggerToken'])` 를 추가해
    `config.interaction.triggerToken` 을 스트립(발급/재발급 엔드포인트의 1회성 평문 응답은
    영향 없음 — 그건 `revokePerTriggerToken` 의 직접 반환값이지 `sanitizeForResponse` 를
    거치지 않는다). 회귀 e2e 는 `per_trigger` 전략의 트리거를 만들고 `GET /api/triggers`·
    `GET /api/triggers/:id` 응답에 `triggerToken` 부재를 단언. (b) plan —
    `spec-draft-nullable-notation-followups.md` 의 "완료" 체크박스를 재오픈하거나, 별도
    항목으로 `interaction.triggerToken` 잔여를 등재해 이번 스윕의 claim 범위를
    `secret-store.md §1.1` 열거 범위와 다시 맞춘다.

- **[INFO]** 나머지 §5.4 선언 보강(TriggerDto 의 `chatChannelHealth`/`notificationHealth` 등,
  IntegrationDto 의 `appUrl`/`mallId`/`tokenExpiresAt` 등, KnowledgeBaseDto 의
  `rerankMode`/`rerankCandidateK` 등, AlertRuleDto 의 `createdBy`/`lastTriggeredAt`,
  ScheduleDto.trigger 참조 축소)은 대조한 범위 내에서 다른 spec 영역과 상충하지 않는다.
  - `rerankMode` enum(`off`/`cross_encoder`/`cross_encoder_llm`)은 `spec/1-data-model.md`
    §2.11(L358)·`spec/5-system/9-rag-search.md` §3.3 값과 정확히 일치.
  - `ScheduleDto.trigger` 를 **상시 존재**(`@ApiProperty`, 키 생략 아님)로 선언한 근거
    ("`Schedule.trigger_id` NOT NULL 1:1")는 `spec/1-data-model.md` §2.9.1(L280
    `"Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑"`)와 정확히 일치.
  - §5.4 "null vs 키 생략" 판단 기준 (a)/(b) 인용도 `spec/5-system/2-api-convention.md`
    §5.4 원문과 문구·기준 번호가 그대로 대응한다.
  - `TriggerDto.workflow`/`ScheduleDto.trigger.workflow` 를 키 생략형으로 남긴 것은 §5.4
    기준 (b)(선택적 부가 컨텍스트)에 해당하나, 그 사유가 아직 `spec/2-navigation/
    3-schedule.md`·`spec/1-data-model.md §2.9.1` 본문에는 옮겨지지 않았다 — 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 항목으로 등재돼
    있으므로 본 리뷰에서 별도 지적하지 않는다(중복 방지).

- **[INFO]** `TriggersService.sanitizeForResponse` 가 트리거 응답의 `workflow` 관계를
  `{ id, name }` 두 필드로 좁혔고(§5.4 기준 (b) 문서화), `SchedulesController.toResponse` 도
  조인된 `trigger` 를 4필드로 좁혔다 — 둘 다 [Swagger 규약 §5-1](../../spec/conventions/swagger.md)
  "엔티티를 그대로 노출하지 말 것" 과 정합. 두 좁히기가 서로 다른 계층(서비스 vs 컨트롤러)에서
  일어나는 비대칭은 코드 주석이 근거를 명시(`update` 등 내부 로직이 서비스 반환 타입을
  응답 전용이 아니게 소비하기 때문)하며 [`api-convention.md` §5.4 검증 층](../../spec/5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가)이 요구하는 "응답 경계에서 지운다" 원칙과도 어긋나지 않는다.

## 요약

이 PR 은 `spec/5-system/` 자체를 건드리지 않는 코드 전용 스윕이며, 다룬 범위(§5.4 응답-계약
선언 보강·트리거/스케줄 secret 스트립 확장)는 `spec/5-system/2-api-convention.md` §5.4,
`spec/1-data-model.md`, `spec/conventions/secret-store.md` §1과 대체로 정합했다. 다만 이번 스윕이
직접 인용·완료 선언한 바로 그 규범(`secret-store.md §1.1`)이 열거하는 세 개의 응답-노출 금지
필드 중 `Trigger.config.interaction.triggerToken` 하나가 실제로는 스트립되지 않은 채 남아
있다 — `TriggerDto.config` 가 열린 스키마(`additionalProperties: true`)라 이 PR 이 새로 세운
검증자들도 그 누락을 탐지하지 못하는 사각지대다. 나머지 DTO 선언 보강·엔티티 참조 축소는
data-model·RBAC·API 규약과 상충 없음을 확인했다.

## 위험도

CRITICAL

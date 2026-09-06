# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** 이 브랜치는 이미 8회 이상의 코드 리뷰 라운드(`review/code/2026/09/05/18_23_02` ~
  `2026/09/06/00_00_23`)를 거치며 W1~W6 수준의 Critical/Warning 을 순차 처리해 왔다. 직전 라운드
  (`00_00_23`)의 requirement WARNING#1(`IntegrationDto.appUrl` JSDoc 이 MakeShop 케이스 누락)이
  현재 `integration-response.dto.ts:126-135` 에서 "**Cafe24 Private** 과 **MakeShop ShopStore
  설치 통합** 두 갈래가 채운다" 로 정정되어 있음을 확인했다. maintainability WARNING#2
  (`sanitizeForResponse` 78줄 미분해)도 `triggers.service.ts:691-748` 에서 `stripChatChannelSecrets`
  · `stripInteractionSecrets` · `stripNotificationSigningSecrets` · `deleteSecretColumns` ·
  `narrowWorkflowRef` 로 분해되어 해소됨을 확인했다. maintainability WARNING#3(JSDoc-대상 분리)도
  `triggers.service.spec.ts:191` 이하에서 각 블록이 바로 아래 `it()` 앞에 재배치되어 있다.
  - 위치: (교차 확인, 단일 위치 아님)
  - 상세: 새로 발견한 결함은 아니며, 직전 라운드 지적이 실제로 반영됐는지 재검증한 결과다.
  - 제안: 조치 불요.

- **[INFO]** 신규 선언 필드(23개: `TriggerDto` 7 · `IntegrationDto` 6 · `KnowledgeBaseDto` 7 ·
  `AlertRuleDto` 2 · `ScheduleDto.trigger` 1)를 엔티티 정의·서비스 로직과 교차 대조했다 —
  전부 일치한다.
  - `alert-rule.entity.ts`: `createdBy`/`lastTriggeredAt` 모두 `nullable: true` 컬럼, `select:false`
    없음 → `AlertRuleDto` 의 `@ApiProperty({nullable:true})` + `T | null` 과 일치.
  - `integration.entity.ts`: `mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt` 모두 nullable
    컬럼, `consecutiveNetworkFailures` 는 `default: 0` non-null int. `appUrl` 은 컬럼이 아니지만
    `IntegrationsService.toPublic` 의 두 반환 분기(credsUnreadable 여부 무관) 모두
    `{ appType: null, appUrl: null }` 베이스라인 위에 `derived.appUrl` 을 얹어 **상시 present**
    함을 코드로 확인했다(`integrations.service.ts:1401-1421`) — DTO 의 §5.4 기본형 선언과 일치.
  - `knowledge-base.entity.ts`: `documentCount`(default 0)·`rerankMode`(default 'off')·
    `rerankCandidateK`(default 50) 는 non-null, `embeddingModelConfigId`/`rerankScoreThreshold`/
    `rerankConfigId`/`rerankLlmConfigId` 는 nullable — DTO 선언과 정확히 일치.
  - `ScheduleDto.trigger`: `Schedule.trigger_id` NOT NULL 1:1(스키마) + 응답을 내는 4경로
    (`findAll` join·`findById` relations·`create`·`update`)가 전부 `saved.trigger` 를 채우는지
    `schedules.service.ts`/`schedules.controller.ts` 를 직접 읽어 확인했다 — `create()`/`update()`
    모두 이번 diff 로 `if(isActive)` 밖으로 대입이 이동해 `isActive` 값과 무관하게 채워진다.
  - 위치: `codebase/backend/src/modules/{alerts,integrations,knowledge-base,schedules}/**`
  - 상세: 긍정 관찰 — spec fidelity 위반 없음.
  - 제안: 조치 불요.

- **[INFO]** `secret-store.md §1.1`(2026-09-05 추가)이 응답 노출을 명시 금지한 세 필드
  (`Trigger.config.interaction.triggerToken` · `Trigger.notification_secret_v2` ·
  `Trigger.chat_channel_token_v2`, 그리고 ref `config.notification.signing.secretRef` ·
  `config.*.botTokenRef`)가 `triggers.service.ts` 의 4개 strip 목록
  (`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` · `NOTIFICATION_SIGNING_STRIP_KEYS` ·
  `INTERACTION_RESPONSE_STRIP_KEYS` · `TRIGGER_RESPONSE_STRIP_COLUMNS`)과 1:1 로 대응함을
  spec 본문과 코드를 나란히 읽어 확인했다. `sanitizeForResponse` 는 조기 return 없이 모든
  트리거를 정화하며(과거 3라운드에 걸쳐 각 축이 순차로 드러난 이력이 JSDoc 에 남아 있고
  실제로 지금은 4축 모두 배선돼 있다), unit(`triggers.service.spec.ts`)·e2e
  (`chat-channel-trigger-create.e2e-spec.ts`·`schedule-trigger.e2e-spec.ts`) 양쪽에서 실제
  비밀 값을 fixture 에 채워 뮤턴트-저항적으로(vacuity 를 두 겹으로 막는 방식) 검증한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:53-114,691-748`
  - 상세: 긍정 관찰.
  - 제안: 조치 불요.

- **[INFO]** `response-contract.ts` 의 `visit()` 판정 로직(§5.4 세 형태: null-present 상시존재 ·
  키생략 · 금지조합)과 `findContractViolations` 의 `allowMissing`/`allowUndeclared` 옵션을
  spec §5.4 본문(`2-api-convention.md:191-244`)과 line-level 로 대조했다 — "키 생략형인데 `null`
  이 왔다" 를 위반으로 잡는 로직(§5.4 가 요청 바디 tri-state 와 응답 바디 규칙을 구분하는 것과
  일치), `required`+`nullable` 조합의 의미 등 표에 정의된 5가지 판정이 코드에 정확히 반영돼
  있다. `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건)·`OPTIONAL_NULLABLE_DRIFT`(10건) 등 CHANGELOG.md
  가 인용하는 정량 수치도 실제 배열 길이와 정확히 일치함을 `awk`로 재실측했다("78건" 확인).
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:236-280`, `CHANGELOG.md`
  - 상세: 긍정 관찰.
  - 제안: 조치 불요.

- **[INFO]** `optional-nullable.fixture.ts`(양성 대조군)가 `swagger-dto-contract.spec.ts` 의
  래칫 스캔 범위(`src/modules`) 밖(`src/repo-guards/__tests__/fixtures/**`)에 위치해 프로덕션
  베이스라인을 오염시키지 않음을 확인했고, 대조군 테스트 3건(위반 2형태 포착·준수 형태 불포착·
  스캔 범위 밖 확인)이 실제로 그 파일을 인자로 넘겨 호출함을 확인했다 — 과거 라운드가 지적한
  "존재하지 않는 fixture 경로를 참조해 vacuous 했다"(Critical) 결함은 이미 해소됐다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:459-503`
  - 상세: 긍정 관찰.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.update()` 의 `defined = Object.fromEntries(Object.entries(rest)
  .filter(([, v]) => v !== undefined))` 필터가 `null` 값은 보존하면서 `undefined`(값 미제공)만
  걸러낸다 — PATCH 의 tri-state 계약(키 생략=불변, `null`=초기화, 값=설정, §5.4 상단 "요청
  바디는 대상이 아니다" 각주가 규정하는 것과 별개로 실제 구현 레벨에서 지켜야 하는 의미론)을
  올바르게 보존한다. 회귀 unit(`triggers.service.spec.ts` "PATCH 에서 생략된 필드는 로드된 값을
  유지한다")이 `useDefineForClassFields` 로 인한 `undefined` own-property 문제를 정확한 입력
  모양으로 재현해 검증한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:466-475`
  - 상세: 긍정 관찰.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 남은 미완 항목
  (`@Sensitive()` 데코레이터 미도입, 열린 `config` 맵 안 신규 비밀의 e2e 의무화 미문서화,
  `CanvasSaveResultDto.nodes/.edges` 무타입 배열, `consecutiveNetworkFailures` 노출 중단 미결,
  §5.4 스윕 2차 미착수)은 PR 자신이 근거·조건과 함께 백로그로 명시 등재했고, 코드는 그 항목들을
  건드리지 않았다 — 은닉된 미완성이 아니라 문서화된 스코프 경계다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: 긍정 관찰. TODO/FIXME/HACK/XXX 주석은 diff 전체(`codebase/**`)에서 0건 검출.
  - 제안: 조치 불요.

## 요약

`sweep-response-contract` 브랜치(§5.4 응답-계약 검증자 확장 + 트리거 회전 secret 유출 수정 +
5개 DTO 23개 필드 선언 보정)를 요구사항 충족·엣지케이스·spec fidelity 관점에서 독립적으로
재검증했다. secret-store.md §1.1 이 명시한 3개 비대상 필드 + 2개 ref 필드가 코드의 4개 strip
목록과 1:1 대응함을 확인했고, api-convention.md §5.4 의 null-present/키-생략/금지조합 판정
규칙이 `response-contract.ts` 에 정확히 반영됨을 확인했으며, 신규 선언 23개 필드 전부를 엔티티
컬럼 정의·서비스 파생 로직과 대조해 nullable/상시존재 여부가 실제 동작과 일치함을 확인했다.
`ScheduleDto.trigger`/`TriggerDto.workflow` 의 상시존재·키생략 판단도 4개 응답 경로(schedules
controller `toResponse`, triggers service `findAll`/`findById`/`create`/`update`)를 직접
추적해 검증했다. 이 PR 은 이미 8회 이상의 리뷰 라운드를 거쳐 Critical 0으로 수렴한 상태이며,
직전 라운드(`00_00_23`)가 지적한 WARNING(appUrl JSDoc의 MakeShop 누락, `sanitizeForResponse`
미분해, JSDoc-테스트 분리)이 현재 HEAD 에서 모두 반영되어 있음을 재확인했다. 본 라운드에서
새로 발견한 기능 완전성·spec fidelity·에러 시나리오·반환값 결함은 없다.

## 위험도
NONE

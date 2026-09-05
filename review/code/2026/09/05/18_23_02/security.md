# 보안(Security) 코드 리뷰

## 발견사항

- **[WARNING]** `sanitizeForResponse` 가 `config.chatChannel` 만 걸러내고 `config.notification.signing.secretRef` (secret-store 참조) 는 그대로 wire 로 내보낸다 — 이번 PR 이 고친 것과 **같은 등급의 정보 노출**이 한 자리 더 남아 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `sanitizeForResponse` (약 554~591행, `TRIGGER_RESPONSE_STRIP_COLUMNS`/`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 정의는 60~80행) 및 `normalizeNotificationSecretRef` (603~634행)에서 생성되는 `secret://triggers/{id}/notification-signing` 형태의 ref.
  - 상세: 이번 PR 은 트리거 응답에서 비밀이 사는 "두 곳" — ① `config.chatChannel` JSONB 안의 `botTokenRef`/`inboundSigningRef`/평문 키(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`), ② 엔티티 컬럼 `notificationSecretV2`/`chatChannelTokenV2`(`TRIGGER_RESPONSE_STRIP_COLUMNS`) — 를 정확히 덮었다. 그런데 `config.notification.signing.secretRef` 는 이 두 목록 어디에도 없다. `normalizeNotificationSecretRef()`(create/update 경로에서만 호출)가 `signing.secret` 평문이 들어오면 secret store 로 옮기고 `config.notification.signing.secretRef = 'secret://triggers/{id}/notification-signing'` 를 남기는데, `sanitizeForResponse` 는 `cfg?.chatChannel` 이 있을 때만 `config` 를 재구성(`overrides.config = { ...cfg, chatChannel: sanitizedChatChannel }`)하며 이때도 `notification` 키는 원본 그대로 spread 되어 살아남는다. `chatChannel` 이 없는 트리거(예: webhook + outbound notification 만 쓰는 트리거)는 `config` 자체가 아예 손대지지 않는다. 결과적으로 `GET/POST/PATCH /api/triggers`(그리고 조인을 타는 `GET /api/schedules`) 응답에 이 secret-store ref 가 노출된다.
    PR 저자 자신이 `chatChannelTokenV2`(참조, 평문 아님)를 굳이 스트립한 근거로 "내부 저장 위치를 드러내므로 `botTokenRef` 를 이미 빼는 것과 같은 이유로 뺀다" 라고 명시했다 — 바로 그 논리가 `notification.signing.secretRef` 에도 그대로 적용된다. 다만 참조값 자체는 평문 secret 이 아니므로(별도로 secret store 접근이 있어야 실제 비밀을 얻음) `notificationSecretV2` 평문 유출보다는 낮은 등급이라 WARNING 으로 표기한다.
  - 추가로, `normalizeNotificationSecretRef` 는 `create`/`update` 경로에서만 호출된다(`findAll`/`findOneDetail` 조회 경로에는 없음). 즉 만약 어떤 경위로 `config.notification.signing.secret` **평문**이 이 정규화를 거치지 않고 DB 에 남아 있는 트리거가 있다면(레거시 row, 직접 DB 기록 등), `sanitizeForResponse` 는 이를 걸러낼 방어선이 전혀 없다 — `config.notification` 은 두 strip 목록 어디에도 걸리지 않기 때문이다.
  - 제안: `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 와 동급으로 `config.notification.signing` 안의 `secretRef`(및 방어적으로 `secret`)를 스트립하는 로직을 `sanitizeForResponse` 에 추가한다. `chatChannel` 유무와 무관하게 항상 `config.notification` 도 순회하도록 (현재 코드처럼 `if (cfg?.chatChannel)` 게이트 뒤에만 있지 않도록) 만들어야 한다. 회귀 테스트는 이번 PR 이 쓴 것과 같은 패턴(스트립을 되돌리는 뮤턴트에 RED)으로 고정할 것.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 내부 health 카운터를 그대로 노출한다 — 자격증명이나 직접적 보안 정보는 아니지만, PR 저자도 CHANGELOG/plan 에서 "FE 참조 0곳, wire 변경이라 별도 트래커 항목으로 남긴다" 고 이미 인지·기록했다. 새 결함이 아니라 추적 중인 항목이므로 조치 불요, 참고만.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (신규 `consecutiveNetworkFailures` 필드, diff 144~152행) / `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 항목 이미 등재).

## 핵심 수정 검증 (이번 diff 가 잘 고쳤는지)

- `TriggersService.sanitizeForResponse`(舊 `sanitizeChatChannelForResponse`): 조기 return 제거로 모든 트리거가 정화를 거치도록 바뀐 점, `notificationSecretV2`/`chatChannelTokenV2` 를 `undefined` 대입 + `delete` 로 이중 제거하는 점(중간 소비자의 `Object.keys` 노출까지 차단) 모두 확인했다 — 올바른 방어다. `findAll`/`findOneDetail`/`create`/`update` 네 응답 경로 전부 새 `sanitizeForResponse` 를 호출하도록 배선돼 있고, `TriggersController` 의 다른 엔드포인트(`getHistory`/`rotate-secret`/`revoke-token`/`rotate-bot-token`)는 애초에 `Trigger` 엔티티 전체를 반환하지 않으므로 영향 없음을 확인했다.
- `TriggerDto`: 새로 선언된 7개 필드 중 `notificationSecretV2`/`chatChannelTokenV2` 는 의도적으로 **선언하지 않았다** — 스트립 대상과 정확히 일치, 올바르다.
- `SchedulesController.toResponse` + `ScheduleTriggerRefDto`: 조인으로 실려 오는 `Trigger` 엔티티 전체 대신 `id`/`name`/`workflowId`/`workflow.name` 4필드만 **새 객체 리터럴로 재구성**해서 반환한다(엔티티 spread 가 아니라 필드별 명시 할당이라 위젯/폭 확장 시에도 안전). `findAll`/`findOne`/`create`/`update` 네 곳 모두 적용을 확인했고, `trigger` 를 반환하지 않는 `runNow`/`remove` 는 대상 밖이라 문제 없다.
- `response-contract.ts`(`src/shared/testing/**`)는 `tsconfig.build.json` 의 `exclude` 에 명시돼 있어 프로덕션 빌드에 포함되지 않음을 직접 확인했다 — 테스트 전용 계약 검증 유틸이 배포 아티팩트로 새 나갈 위험은 없다.
- `allowMissing` 옵션(response-contract.ts)은 "선언된 required 가 실제로 없다"는 실제 계약 위반을 조용히 숨기는 문이 될 수 있지만, 호출부가 1건(`ExportWorkflowDto.formatVersion`, 보안과 무관한 포맷 협상 필드)뿐이고 JSDoc 이 "spec 에 Planned 로 이미 적힌 경우만" 이라는 좁은 사용 조건과 "갭을 닫으면 이 목록에서 뺀다" 는 종료 조건을 명시해 오남용 방지 장치가 갖춰져 있다. 현재로선 문제 없음.
- 새로 추가된 DTO 필드들(`AlertRuleDto.createdBy/lastTriggeredAt`, `IntegrationDto.appUrl/mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt`, `KnowledgeBaseDto.*`, `ScheduleDto.trigger`)은 전부 이미 wire 로 나가고 있던 비민감 메타데이터의 **사후 선언**이며, `IntegrationDto.credentials` 는 diff 밖(기존 코드)에서 이미 마스킹돼 있음을 확인했다 — 신규 노출 없음.
- 하드코딩 시크릿, SQL/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 관련 새 코드는 diff 범위 내에 없다.

## 요약

이번 PR 은 `TriggersService`/`SchedulesController` 응답 경계에서 실제로 나가고 있던 평문 서명 secret(`notificationSecretV2`)과 secret-store 참조(`chatChannelTokenV2`)를 정확하고 견고하게(이중 제거 + 조기 return 제거 + 조인 경로까지) 막았고, 나머지 DTO 선언 보강도 기존 wire 동작을 문서화하는 안전한 변경이다. 다만 같은 함수(`sanitizeForResponse`)가 다루는 같은 클래스의 문제 — `config.notification.signing.secretRef`(및 이론상 미정규화된 평문) — 는 이번 스윕이 놓쳤다. PR 저자 스스로 세운 "참조도 내부 저장 위치를 드러내므로 뺀다" 는 원칙을 그대로 적용하면 이 자리도 막아야 계약이 닫힌다. 이 한 건을 제외하면 보안 관점에서 이번 변경은 순수 개선이다.

## 위험도

MEDIUM

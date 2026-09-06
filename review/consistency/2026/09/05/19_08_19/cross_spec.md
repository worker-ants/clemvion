# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

검토 대상: scope=`spec/5-system/` 의 spec 델타는 0(코드 전용 PR). diff(26파일/1417줄, 브랜치
`sweep-response-contract-5ba0ad`)는 §5.4 응답-계약 검증자를 `SchedulesController`/
`TriggersService`/`AlertRuleDto`/`IntegrationDto`/`KnowledgeBaseDto`/`TriggerDto`로 확장하고,
그 과정에서 발견된 트리거 회전-secret 응답 유출(`notificationSecretV2`·`chatChannelTokenV2`)을
수정한 것이다. 아래는 그 코드 diff(및 diff가 다시 확인시킨 사실)를 `spec/1-data-model.md` ·
`spec/5-system/14-external-interaction-api.md` · `spec/5-system/15-chat-channel.md` ·
`spec/conventions/secret-store.md` 등 다른 영역과 대조한 결과다.

## 발견사항

### [CRITICAL] `notification_secret_v2` 의 저장 형태 — EIA §7.1 이 "ref only" 라고 못박은 것이 실제로는 평문이다

- target 위치: diff `codebase/backend/src/modules/triggers/triggers.service.ts` (신규
  `sanitizeForResponse`/`TRIGGER_RESPONSE_STRIP_COLUMNS`), `schedules.controller.ts`
  (`toResponse`), CHANGELOG.md 신규 항목 — 전부 "`notificationSecretV2` 는 **평문 서명
  secret**" 이라고 명시한다.
- 충돌 대상:
  - `spec/5-system/14-external-interaction-api.md` §7.1 (line 922): *"`notification_secret_v2`
    컬럼도 동일하게 **ref 만 보관** (rotation grace 기간)"* — `config.notification.signing.secretRef`
    가 secret_store 의 ciphertext 만 가리키는 것과 **똑같이** v2 컬럼도 ref 라고 명시적으로
    주장한다 (2026-05-22, `ad0ea7cdb` #264 에서 작성).
  - `spec/conventions/secret-store.md` §0/§1: "모든 도메인 모듈은 `SecretResolver` 를
    경유해 secret 을 읽고 쓴다 — **§1 하단의 필드 단위 명시적 비대상 예외는 제외**" 라며
    예외를 **두 개만** 열거한다 — `AuthConfig.config`, `Trigger.config.interaction.triggerToken`
    (결정 2026-08-16). `notification_secret_v2` 는 그 예외 목록에 **없다**. 같은 문서
    SS-SE-01: *"plaintext ... DB 는 항상 ciphertext 만 본다"*.
- 상세: 실제 코드를 3개 지점에서 교차 확인했다 — 전부 "ref" 가 아니라 **원문 그대로의
  평문**이다.
  1. `TriggersService.rotateNotificationSecret` (line ~1002): `trigger.notificationSecretV2 = newSecret`
     — `newSecret = wsk_<32-byte hex>` 를 **컬럼에 직접** 대입한다. secret store 호출 없음.
  2. `TriggersService.promoteRotatedNotificationSecrets` (line ~1274-1298): grace 종료 시
     `const secretV2 = trigger.notificationSecretV2;` 를 읽어 `this.secrets.rotate(ref, ..., secretV2)`
     로 **그제서야** secret store 에 씨앗을 넣는다 — 즉 grace 기간 **내내** 컬럼 값 자체가
     평문이고, ref 로의 전환은 24h 후 승격 시점에야 일어난다.
  3. `NotificationWebhookProcessor.sendOne` (line ~211-215): `secondarySecret = trigger.notificationSecretV2`
     를 **그대로** `computeHmacSignature` 에 넘긴다 — 어떤 `resolve()`/secret store 조회도
     없다. (반대로 `primarySecret` 은 `resolveSigningSecret` 이 `secretRef` 를 secret store 로
     resolve 한다 — 그 비대칭 자체가 v2 가 ref 가 아님을 보여준다.)

  대조군으로 `chat_channel_token_v2` 는 실제로 ref 다 (`triggers.service.ts` 의
  `chatChannelTokenV2 = v2RefUsed` — 변수명부터 ref). 즉 diff 자신의 구분(엔티티 컬럼
  주석 "notification_secret_v2 는 참조가 아니라 평문", "chatChannelTokenV2 는 secret
  store ref")이 **코드 사실과 일치**하고, 이번에 응답에서 새로 스트립한 이유도 바로 그
  평문성 때문이다. 반면 EIA §7.1 은 두 컬럼을 "동일하게 ref" 라고 뭉뚱그려 놓아 **스스로와
  모순**인 상태다.

  이 발견은 단순 오타가 아니다 — `secret-store.md` 의 SS-SE-01("DB 는 ciphertext 만")을
  위반하는 컬럼이 예외 목록에 미등재 상태로 24h 씩 존재한다는 뜻이고, 이번 PR 이 고친
  "API 응답으로 새는" 문제와 **같은 근본 원인**(엔티티 컬럼이 평문이라는 사실이 여러
  소비자에게 감춰져 있었다)이다. 이번 스윕은 응답 경계만 막았을 뿐 DB 저장 형태 자체는
  바꾸지 않았다.
- 제안: (택1, 또는 병행)
  1. **spec 정정** — `14-external-interaction-api.md §7.1` 의 "ref 만 보관" 문장에서
     `notification_secret_v2` 를 제외하고, 그 컬럼이 rotation-grace 동안 **평문**임을
     명시. `secret-store.md §1` 예외 목록에 `Trigger.notification_secret_v2` 를 세 번째
     비대상 예외로 추가(근거: dual-secret HMAC 검증 중 ref resolve 왕복을 grace 서명
     경로마다 피하기 위함 등, 실제 채택 근거를 명시).
  2. **또는 코드 정정** — `notification_secret_v2` 도 secret store ref 로 전환해
     `secretRef`-only 원칙을 실제로 지키게 한다(설계 변경, 별도 PR).
  어느 쪽이든 **현재 상태(문서=ref, 코드=평문)를 방치하면** 다음 사람이 EIA spec 을 근거로
  "DB 유출 시 notification secret 은 안전(ciphertext)" 이라고 잘못 판단할 위험이 있다.

### [WARNING] `IntegrationDto` 신규 5필드가 §9.1 API SoT 표에 미등재

- target 위치: diff `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
  — `mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures` 5필드
  신규 선언.
- 충돌 대상: `spec/2-navigation/4-integration.md` §9.1(`GET /api/integrations/:id`) — `IntegrationDto`
  의 "**두** derived 필드" 로 `appUrl`·`autoRefresh` 만 명시하고 위 5필드는 언급하지 않는다.
- 상세: 데이터 모델(`spec/1-data-model.md §2.10`)에는 다섯 필드 모두 엔티티 컬럼으로 이미
  정의돼 있어 **모순은 아니다** — 다만 §9.1 이 "IntegrationDto 는 다음을 포함한다" 는 서술
  방식이라, 신규 독자가 그 표를 응답 계약의 전체 목록으로 오독할 여지가 있다. 실제로 이번
  diff 는 이미 wire 에 나가고 있던 필드의 **선언만** 뒤늦게 맞춘 것이라 신규 노출은 아니다.
- 제안: `spec/2-navigation/4-integration.md §9.1` 문서에 "derived 2필드 + 엔티티-그대로
  노출 필드는 `1-data-model.md §2.10` 참조" 정도의 포인터 한 줄 추가 권장(정보 동기화,
  차단 사유 아님).

### [INFO] `IntegrationDto.consecutiveNetworkFailures` 노출 지속 여부 미결정 — 이미 트래커에 등재됨

- target 위치: diff 동일 파일, CHANGELOG.md, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  신규 체크박스.
- 상세: 내부 health 카운터가 FE 미소비 상태로 응답에 노출된다. 이번 diff 가 **이미**
  "노출 중단 검토" 항목을 plan 에 등재했으므로 별도 조치 불요 — 중복 등재 방지 차원에서
  기록만 남긴다.

## 요약

이번 diff 는 §5.4(응답 `null` vs 키 생략) 및 swagger.md 컨벤션과 `spec/1-data-model.md` 의
엔티티 필드 정의에 **정확히 부합**하도록 5개 응답 DTO 를 확장하고, 트리거 회전-secret
(`notificationSecretV2`)이 두 엔드포인트(`triggers`/`schedules` 조인)에서 새던 것을 응답
경계에서 막은, 잘 근거된 보안 수정이다. 다만 그 수정 과정에서 스스로 재확인시킨 사실 —
`notification_secret_v2` 컬럼이 rotation-grace 동안 **평문**으로 DB 에 존재한다는 것 — 이
`spec/5-system/14-external-interaction-api.md §7.1` 과 `spec/conventions/secret-store.md` 의
명시적 "ref-only" 주장과 정면으로 어긋난다. 이는 이번 PR 이 새로 만든 문제는 아니지만(2026-05-22
부터 존재), 이번 PR 의 코드·CHANGELOG 가 그 모순을 가장 선명하게 드러낸 자리이므로 이 기회에
spec 정정(또는 코드 정정)이 필요하다. 그 외에는 `IntegrationDto` 확장 필드가 nav-spec §9.1
표에 미등재된 경미한 문서 동기화 지연 정도이며, 나머지 데이터 모델·API 계약·RBAC·상태 전이
축에서는 발견된 충돌이 없다.

## 위험도

CRITICAL

# Rationale 연속성 검토 — §5.4 응답-계약 스윕 (`sweep-response-contract-5ba0ad`)

## 검토 방법

target scope(`spec/5-system/`)는 이 브랜치에서 델타 0(문서 변경 없음)이라, 검토는 (1) diff(26개
파일)가 만지는 코드가 기존 spec 의 `## Rationale`/규약 본문이 이미 확정한 결정·invariant 와
계속 정합한지, (2) 같은 diff 안에서 스스로 "동결" 이라 적은 것을 넓혔다가 되돌린 자기수정
경로가 실제로 깨끗이 닫혔는지를 실측했다. `git -C <worktree> diff origin/main...HEAD`,
`git show dfb2664af / cb17f0870`, 관련 entity·migration·service 코드를 절대경로로 직접 읽었다.

## 발견사항

- **[CRITICAL] `notification_secret_v2` 가 `SecretResolver` 를 우회하는 평문 컬럼인데, target spec 은 "ref 만 보관"이라고 반대로 선언하고 있고, 이 diff 는 그 사실(평문임)을 코드 주석에 새로 명문화하면서도 그 모순을 해소하지 않았다**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §7.1 (Trigger 엔티티 확장) 의
    blockquote — "`config.notification.signing.secretRef` 의 plaintext 는 `SecretResolver` 가
    관리하는 `secret_store` 테이블에 ... 암호화되어 보관 (DB 는 ciphertext 만) ... **`notification_secret_v2` 컬럼도 동일하게 ref 만 보관** (rotation grace 기간)."
  - 과거 결정 출처: [`spec/conventions/secret-store.md`](spec/conventions/secret-store.md) 도입부
    (line 12) — "모든 도메인 모듈은 본 convention 의 `SecretResolver` 를 경유해 secret 을 읽고
    쓴다 — **[§1 하단의 필드 단위 명시적 비대상 예외]는 제외**하며, 그 예외는 각각 자기 근거를
    갖는다" — 그리고 §4 보안 요구사항 `SS-SE-01`("필수" — "DB 는 항상 ciphertext 만 본다").
    §1 의 "비대상" 등재는 정확히 **두 건**뿐이다: `AuthConfig.config`(별도 컬럼 transformer 로
    동등 암호화)와 `Trigger.config.interaction.triggerToken`(2026-08-16 결정, (a)(b)(c) 근거
    명시). 그 문단 끝에 명시적 경고가 있다: **"이 블록을 '평문 보관 일반의 선례' 로 인용하면
    안 된다 — (a)~(c) 를 함께 만족하지 않는 **세 번째 필드**가 같은 문단을 근거로 예외를 얻는
    것이 **이 등재의 실패 모드**다."**
  - 상세: 실제 코드를 3중으로 대조한 결과, `notification_secret_v2` 는 **ref 가 아니라 진짜
    평문**이다.
    - 마이그레이션: `codebase/backend/migrations/V059__trigger_notification_interaction_columns.sql`
      — `ADD COLUMN notification_secret_v2 TEXT` (주석: "Secret rotation 기간 (24h grace) 동안의
      **신규 secret**" — "ref" 라는 표현이 없다).
    - 엔티티: `codebase/backend/src/modules/triggers/entities/trigger.entity.ts:104-105` —
      `@Column({ name: 'notification_secret_v2', type: 'text', nullable: true }) notificationSecretV2: string | null;`
    - 소비처: `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts:211-214` —
      `trigger.notificationSecretV2` 를 **그대로** `computeHmacSignature` 의 secondary secret 으로
      넘겨 서명한다. `SecretResolver.resolve()` 를 거치지 않는다.
    - 승격 로직: `triggers.service.ts` 의 `promoteRotatedNotificationSecrets` — `secretV2 = trigger.notificationSecretV2`
      를 읽어 `this.secrets.rotate(ref, workspaceId, secretV2)` 로 **비로소** SecretResolver 에
      넘긴다(그 전까지는 DB 컬럼에 평문 그대로 상주). 코드 자체 주석이 "notificationSecretV2
      평문이 DB 에 영구 잔류하지 않도록" 이라고 표현해 스스로 평문임을 확인한다.
    - **이번 diff**(`codebase/backend/src/modules/triggers/triggers.service.ts:67-69`, 새로
      추가된 JSDoc)도 동일하게 명문화한다: *"`notification_secret_v2` 는 참조가 아니라 **평문
      서명 secret** 이다(24h rotation grace 동안 non-null) ... `chat_channel_token_v2` 는 secret
      store ref 라 등급이 한 단계 낮지만"* — 즉 diff 작성자 스스로 이 필드가 **ref 가 아니라
      평문**이며 형제 컬럼(`chat_channel_token_v2`, 실제로 ref 로 확인됨 — `triggers.service.ts:1298`
      `v2Ref = trigger.chatChannelTokenV2`)보다 **등급이 높은 비밀**이라고 정확히 서술했다.
    - 결과: `notification_secret_v2` 는 secret-store.md 가 "비대상" 으로 **등재하지 않은 세 번째
      평문 필드**이고, target spec(`14-external-interaction-api.md`)은 이 필드가 ref 만 보관한다고
      (실제와 반대로) 서술해 그 위반을 감추고 있다. diff 는 이 사실을 정확히 재확인하는 주석을
      새로 썼으면서도 (i) secret-store.md §1 에 독립 근거를 갖는 예외로 등재하지 않았고,
      (ii) 14-external-interaction-api.md 의 거짓 서술을 정정하지 않았다 — "결정의 무근거 번복"
      이 아니라 **이미 문서화된 invariant(SS-SE-01 + SecretResolver 전량 경유 원칙)를 우회하는
      기존 설계를, 그 우회를 정확히 알면서도 문서 정합화 없이 그대로 확정**한 경우다.
  - 제안: 둘 중 하나를 택해 이번 PR 또는 즉시 후속에서 닫는다.
    1. **정직화**: `secret-store.md` §1 에 `notification_secret_v2` 를 세 번째 "비대상" 항목으로
       등재하되, `triggerToken` 근거를 재사용하지 말고(그 문단이 명시적으로 금지) 독립 근거를
       세운다(예: "24h 회전 grace 동안 dual-sign 을 위해 hot-path 서명 시점마다 두 secret 을
       동시에 읽어야 하고, 짧은 grace 창은 위험을 한정한다" 등 — 실제로 SS-SE-01 완화가 정당한지
       실측 근거 필요). 그리고 `14-external-interaction-api.md §7.1` 의 "ref 만 보관" 서술을
       사실(평문)로 정정한다.
    2. **봉합**: 승격 로직을 뒤집어 `notification_secret_v2` 도 처음부터 `secrets.rotate()` 로
       기록하고 컬럼에는 ref 만 두게 해 spec 서술을 실제로 참으로 만든다(단, 서명 시점마다
       resolve 왕복이 필요해진다 — hot-path 비용 트레이드오프 재평가 필요).
    어느 쪽이든 **현재 상태(문서는 준수를 주장하고 코드는 위반)를 그대로 둔 채 이 PR 을 merge
    하면, secret-store.md 자신이 이름 붙인 실패 모드("세 번째 필드가 근거 없이 예외를 얻는다")
    가 이미 소리 없이 발생한 채로 고착**된다.

- **[INFO] §5.4 "금지 조합" 자기수정은 diff 내에서 완전히 닫혔다 — 후속 조치 불필요**
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 "DTO 선언 형태" 규칙("`| null` 금지"),
    검증 층 표.
  - 과거 결정 출처: origin/main 시점 이미 존재하던
    `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts` 의
    `OPTIONAL_NULLABLE_DRIFT`(10건, "이 가드는 고치는 것이 아니라 고정한다") 주석.
  - 상세: 이 브랜치의 1차 커밋(`dfb2664af`)이 `AlertRuleDto`/`IntegrationDto`/`KnowledgeBaseDto`/
    `TriggerDto` 에 **새로** 추가한 23개 필드를 `@ApiPropertyOptional({ nullable: true })` +
    `field?: T | null` — 즉 §5.4 가 응답 바디에서 명시적으로 금지하는 바로 그 조합 —으로
    선언했다. 이는 "이미 문서화된 필드는 소급 적용 대상이 아니다"(§5.4 소급 규정)라는 예외가
    **새로 도입되는 필드**에는 적용될 수 없으므로 규칙 위반이었다. 같은 브랜치의 2차 커밋
    (`cb17f0870`)이 이를 스스로 잡아(impl-done Critical 2 + ai-review Critical 1) 전량
    `@ApiProperty({ nullable: true })` 기본형으로 재선언했고, `EXPECTED_OPTIONAL_NULLABLE_DRIFT`
    래칫 가드(78건 베이스라인)를 신설해 향후 재발을 봉쇄했다. 새로 추가된 필드들은 최종
    `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 목록에 하나도 없음을 확인했다(전수 대조) — 즉 최종
    HEAD 상태는 §5.4 를 위반하지 않는다.
  - 제안: 없음(기록용). 다만 "정의를 한 칸 좁게 잡는다" 류 실수가 같은 커밋 안에서 반복되는
    패턴이 보이므로(§5.4 조합·plan 표 숫자 기재 금지 재위반, 아래 참고), 스윕성 PR 은 커밋 전에
    자신이 그 턴에 쓴 "동결/금지" 문구를 grep 으로 한 번 자가 대조하는 습관을 권장한다.

## 요약

target(`spec/5-system/`)는 이번 브랜치에서 직접 수정되지 않았지만, diff 가 정확히 그 문서가
"비밀 처리" 를 규정하는 두 축(§5.4 응답 표현, secret-store convention 의 저장 invariant) 을
건드린다. §5.4 축은 diff 내부에서 스스로 위반→발견→교정이 완결돼 문제가 없다. 반면 secret-store
축에서는 `notification_secret_v2` 가 `SecretResolver` 를 우회하는 평문 컬럼이면서도 target spec
(`14-external-interaction-api.md §7.1`)에는 "ref 만 보관" 이라고 반대로 기록돼 있고, 그 컨벤션
문서(`secret-store.md §1`)가 명시적으로 경고한 "세 번째 필드가 근거 없이 예외를 얻는 실패 모드"
그 자체가 이미 코드에 실현돼 있다. 이번 diff 는 이 사실을 정확하게 재확인하는 주석을 새로
작성했음에도 그 모순을 해소하지 않고 지나쳤다 — Rationale 연속성 관점에서 이 PR 의 유일한
실질 Critical 이다.

## 위험도
CRITICAL

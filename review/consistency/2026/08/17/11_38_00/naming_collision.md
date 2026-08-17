# 신규 식별자 충돌 검토 — `spec/5-system/` (--impl-prep)

## 커버리지 한계 (선행 고지)

전달된 프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/` 18개 파일 중
`1-auth.md` · `2-api-convention.md` · `3-error-handling.md` · `4-execution-engine.md`
(앞부분)만 본문이 실려 있고, 나머지 14개(EIA·WS·webhook·chat-channel 포함) 와
"검색 대상 코퍼스" 절의 교차 참조 문서 전량이 "본문 생략됨" placeholder 로 절단돼
있었다. 브랜치 맥락(`eia-masking-round2`)상 실제 신규/변경 식별자가 몰려 있는
문서는 정확히 그 절단된 쪽(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md`
§4.1, `12-webhook.md` §5.3)이라, 번들 지시("Read 로 직접 열어라")에 따라 저장소의
실제 파일을 직접 읽어 보강했다. 아래 판정은 (a) 번들에 본문이 실린 4개 파일과
(b) 직접 Read 로 확인한 EIA/WS/webhook 마스킹 관련 절을 근거로 한다 — 나머지
미확인 절에 대해서는 "충돌 없음"을 단정하지 않는다.

## 발견사항

- **[INFO]** `sanitize-error-message.ts` 동일 파일명이 두 디렉터리에 존재
  - target 신규 식별자: 해당 없음 — target 문서(spec)가 직접 도입한 이름은 아님
  - 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (공유 SoT,
    `redactSecrets`/`deepRedactSecrets` 등 export) vs
    `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`
    (알림/이메일 표면 전용 `sanitizeErrorMessage` 단일 함수 export)
  - 상세: 같은 basename 이 서로 다른 두 계층에서 서로 다른 함수 집합을 export 한다.
    다만 `modules/execution-engine/sanitize-error-message.ts` 의 모듈 JSDoc 이 "두
    경로가 쓰는 마스킹 SoT 는 `shared/utils/sanitize-error-message.ts` 로 같다" 고
    명시적으로 교차 참조하고 있어, 실제 혼동 사고는 이미 방지돼 있다. spec 본문
    (R17/§4.1)에는 이 두 파일 중 어느 것도 이름으로 노출되지 않으므로 spec 독자
    관점의 충돌은 아니다.
  - 제안: 실제 조치 불요(이미 문서화된 의도적 분리). 후속 코드 리뷰에서 파일명을
    `notification-error-sanitizer.ts` 류로 바꿔 basename 충돌 자체를 없애는 선택지는
    있으나 우선순위 낮음.

- **[INFO]** WS ack 필드 `resumed` (boolean) 와 `NodeExecution` 상태 enum 값 `"resumed"` 이름 중복 — 이미 자체 disambiguate 됨
  - target 신규 식별자: 없음(기존 계약) — 확인 대상으로만 점검
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md` §4.2 공통 ack payload 표
    (`resumed: boolean`, "재개 시작 수락(enqueue) 여부") vs 동일 문서 내
    `NodeExecution` 상태 enum 의 `"resumed"` 값(별도 의미)
  - 상세: 같은 문자열 `resumed` 가 (1) WS ack 의 boolean 필드명과 (2) NodeExecution
    상태 enum 의 리터럴 값으로 동시에 쓰인다 — 전형적인 신규 식별자 충돌 패턴이다.
    다만 spec 이 스스로 각주로 "이 ack boolean `resumed` 는 이름이 같은
    `execution.resumed` 이벤트(§4.1)·NodeExecution status enum `"resumed"` 와
    별개다" 라고 명시해 두어 독자가 오인할 여지를 이미 차단했다.
  - 제안: 조치 불요. 신규 필드를 추가할 계획이 있다면 `resumed` 라는 이름 재사용을
    피하는 것을 권장(이미 3-way 로 오버로드된 이름이라 4번째 재사용은 피할 것).

- **[INFO]** 인증 엔드포인트(`forgot-password`/`reset-password`/`resend-verification`) 가 두 SoT 문서에 완전한 형태로 중복 정의됨(내용은 일치, 충돌 아님)
  - target 신규 식별자: 없음 — 기존 정의 간 정합성 점검
  - 기존 사용처: `spec/5-system/1-auth.md` §5 API 엔드포인트 표(509–532행) vs
    `spec/2-navigation/10-auth-flow.md` (464, 470, 471행)
  - 상세: `1-auth.md` Overview 는 "인접 엔드포인트는 각 SoT 문서를 포인터로
    참조한다(중복 정의 금지)" 라고 선언하면서도, 세 엔드포인트(forgot-password·
    reset-password·resend-verification)는 §5 자체 표에 전체 정의로 재기재돼 있고
    `10-auth-flow.md` 에도 독립적으로 완전히 기재돼 있다. 두 정의는 method·path·
    설명이 서로 어긋나지 않으므로 "다른 의미의 충돌"은 아니지만, naming_collision
    관점의 원칙(SoT 단일화)에는 어긋나는 중복이라 cross_spec/convention_compliance
    리뷰어의 판정 대상으로 넘긴다(본 리뷰어의 핵심 판정 기준인 "충돌"에는 해당하지
    않아 등급을 INFO 로 낮춤).
  - 제안: 조치 필요 시 `1-auth.md` §5 표에서 이 세 행을 포인터 참조로 축약하거나,
    Overview 문구를 "인증 자체 흐름(§1.1)에 속한 엔드포인트는 예외" 로 명시해
    선언과 실제를 맞출 것.

- 그 외 R17 마스킹 카탈로그(`toTerminalErrorPayload`/`deepRedactSecrets`/
  `deepRedactSecretsPreserving`/`stripExternalOnlyFields`/`sanitizePayloadForWs`/
  `redactStoredErrorForResponse`)와 §4.1 값-패턴 마스킹 캐비엇을 직접 대조했으나,
  신규로 도입되는 식별자가 기존 이름을 다른 의미로 뒤덮는 사례는 발견되지 않았다.
  오히려 이 절 자체가 과거 라운드(`23_49_05` naming W1 — 표면 번호를 아라비아
  숫자로 통일해 같은 절의 원형숫자(①②③)와 글리프 충돌을 없앤 사례)에서 이미
  naming_collision 지적을 반영해 정정된 이력이 보인다.

## 요약

번들 본문이 실제로 도달한 4개 파일(`1-auth.md`/`2-api-convention.md`/
`3-error-handling.md`/`4-execution-engine.md`)과, 브랜치 맥락상 핵심인
`14-external-interaction-api.md` §R17·`6-websocket-protocol.md` §4.1·
`12-webhook.md` §5.3 을 직접 Read 로 보강 확인한 결과, target 이 새로 도입해
기존 식별자와 **다른 의미로 충돌**하는 사례는 발견되지 않았다. 발견된 세 항목은
모두 이미 문서 자체가 disambiguate 했거나(WS `resumed`), 코드 주석이 교차
참조로 방지했거나(동일 basename 두 파일), 내용이 일치하는 순수 중복(SoT 미준수
후보, 다른 리뷰어 영역)이라 CRITICAL/WARNING 이 아닌 INFO 로 등재했다. 다만
컨텍스트 예산으로 절단된 나머지 다수 파일(및 교차 참조 코퍼스)은 이번 세션에서
전수 검증되지 못했으므로, 그쪽에서 새 ID/엔드포인트/이벤트명을 도입하는 후속
커밋이 있다면 별도 확인이 필요하다.

## 위험도
LOW

## 발견사항

### 발견사항

- **[WARNING]** §3.1 API 명세 테이블의 "요청 본문 최대 크기 1MB" — 현실과 괴리
  - target 위치: `spec/5-system/12-webhook.md` §3.1 Webhook 수신 엔드포인트 표 (`| 요청 본문 최대 크기 | 1MB |`)
  - 충돌 대상: 동일 파일 §WH-NF-02 ("`1MB 통일 임계는 미구현 (Planned)`") 및 §8 보안 고려사항 표 ("인증 webhook 은 별도 게이트 없음. 1MB 통일 임계는 미구현")
  - 상세: §3.1 의 API 명세 테이블은 수신자 관점에서 "1MB" 를 마치 현행 계약인 것처럼 제시한다. 그러나 동일 문서 내 WH-NF-02 와 §8 은 1MB 가 미구현(Planned)이며 현행은 공개 webhook 에만 32KB 게이트가 적용됨을 명시한다. 외부 통합 개발자가 §3.1 만 보면 인증 webhook 에도 1MB 제한이 있다고 오인할 수 있다.
  - 제안: §3.1 표를 `현행: 공개 webhook 32KB / 인증 webhook 무제한(express 기본값). 목표(Planned): 1MB 통일` 로 갱신하거나, "(WH-NF-02 참조 — Planned)" 주석을 인라인 추가한다.

- **[WARNING]** `PUBLIC_WEBHOOK_BODY_TOO_LARGE` (413) 에러 코드가 공용 카탈로그에 미등재
  - target 위치: `spec/5-system/12-webhook.md` §WH-NF-02, §8 보안 고려사항 (`413 PUBLIC_WEBHOOK_BODY_TOO_LARGE`)
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.7 "Webhook 수신 에러 코드" 카탈로그
  - 상세: target 이 `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` 코드를 정의하고 구현됨으로 명시하지만, §1.7 카탈로그는 `INVALID_WEBHOOK_PAYLOAD`(400) / `PUBLIC_WEBHOOK_RATE_LIMIT`(429) / `PUBLIC_WEBHOOK_HOURLY_LIMIT`(429) 3건만 등재하고 있다. 공용 카탈로그 가시성을 위한 등재 원칙(error-handling §1.7 서두)에 따르면 이 코드도 카탈로그에 있어야 한다.
  - 제안: `spec/5-system/3-error-handling.md` §1.7 에 `PUBLIC_WEBHOOK_BODY_TOO_LARGE | 413 | 공개 webhook body 32KB 초과 (PublicWebhookThrottleGuard) | 구현` 행 추가.

- **[INFO]** `PublicWebhookThrottleGuard` 정책 SoT 이중 선언
  - target 위치: `spec/5-system/12-webhook.md` §6 구현 파일 구조 ("(SoT: [Spec 웹채팅 보안 §4])") 및 Rationale ("본 spec 을 webhook 도메인 SoT 로 확정한다")
  - 충돌 대상: `spec/7-channel-web-chat/4-security.md` 도입부 ("공개·무인증 webhook 남용 방어(rate-limit·크기 제한·비용 가드, §4) … 단일 진실로 정의한다")
  - 상세: 채널 웹챗 보안 spec 은 공개 webhook 남용 방어 전체(PublicWebhookThrottleGuard 정책·수치·Redis 구현 특성)를 자신의 단일 진실로 선언하고, webhook spec §6 은 이를 인정해 "(SoT: 웹채팅 보안 §4)" 를 명시한다. 그러나 webhook spec Rationale 은 "본 spec 을 webhook 도메인 SoT 로 확정한다" 고 선언한다. 스코프가 다른 두 SoT 선언이 겹쳐 있어 혼란을 줄 수 있다. 실질적 정합성은 있으나 독자가 두 SoT 선언을 보고 어느 쪽이 우선인지 판단해야 한다.
  - 제안: webhook spec Rationale 의 SoT 선언에 "PublicWebhookThrottleGuard 정책 수치는 [Spec 웹채팅 보안 §4] 가 단일 진실" 이라는 명시적 예외 문장을 추가하거나, §6 의 "(SoT: 웹채팅 보안 §4)" 를 Rationale 로 이동해 일관성을 높인다. 현 상태에서 기능 작동을 막는 모순은 아니다.

---

### 요약

Cross-Spec 일관성 관점에서 `spec/5-system/12-webhook.md` 는 데이터 모델(`spec/1-data-model.md` §2.8·§2.17), 에러 처리(`spec/5-system/3-error-handling.md`), Chat Channel(`spec/5-system/15-chat-channel.md`), 채널 웹챗 보안(`spec/7-channel-web-chat/4-security.md`), API 규약(`spec/5-system/2-api-convention.md`) 등 참조 영역과 전반적으로 정합하다. CRITICAL 수준의 직접 모순은 없다. 다만 두 가지 WARNING 이 확인된다: ① §3.1 API 명세 표의 "1MB 최대 크기" 기술이 동일 문서 내 WH-NF-02·§8 의 "Planned·미구현" 설명과 불일치해 외부 통합 개발자에게 오신호를 줄 수 있으며, ② `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(413) 에러 코드가 공용 카탈로그(`error-handling §1.7`)에 미등재되어 있다. 추가로 INFO 하나: webhook spec 의 "본 spec 이 SoT" 선언과 채널 웹챗 보안 spec 의 "공개 webhook 남용 방어 SoT" 선언이 스코프 중첩으로 미세한 이중 선언을 형성하나 실질 기능 충돌은 없다.

### 위험도

LOW

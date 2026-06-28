# Rationale 연속성 검토 결과

대상: `spec/5-system/12-webhook.md`
검토 모드: spec draft 검토 (--spec)

---

### 발견사항

- **[WARNING]** 아키텍처 다이어그램(§1)의 처리 순서가 §7 처리 흐름 및 WH-EP-07 과 불일치
  - target 위치: `spec/5-system/12-webhook.md` §1 아키텍처 개요 다이어그램 (`2. isActive 확인` → `3. 인증 검증` 순서)
  - 과거 결정 출처: 동일 문서 §7 step 5 및 WH-EP-07; Chat Channel spec §5.5 — "`HooksService.handle` 의 chatChannel 분기가 isActive 검사보다 선행한다"
  - 상세: §1 다이어그램은 `1. endpointPath 조회 → 2. isActive 확인 → 3. 인증 검증 → 4. 202 즉시 반환 → 5. execute()` 순서로 기술한다. 그러나 §7(처리 흐름)과 WH-EP-07 본문은 chatChannel 트리거에서 "chatChannel 분기가 isActive 검사보다 선행"하고 "인증을 먼저 수행한 뒤(서명 실패 시 401) silent skip"으로 동작한다고 명시한다. 즉 실제 실행 순서는 ① chatChannel 유무 판단 → ② 인증 → ③ isActive 이지만, 다이어그램은 ② isActive → ③ 인증 의 단순화된 순서를 표시하고 있어 Rationale 에서 합의된 chatChannel 선행 분기 invariant 와 충돌한다. 이 다이어그램을 보고 구현하는 개발자가 chatChannel 선행 분기를 누락할 수 있다.
  - 제안: §1 다이어그램에 chatChannel 분기와 그 우선순위를 명시하거나, 다이어그램 하단에 "chatChannel 트리거는 isActive 검사 전 chatChannel 분기 + 인증을 먼저 수행한다 — §7 참조" 주석을 추가한다. 또는 다이어그램을 "일반 webhook 경로" 로 스코프를 명시해 단순화 의도를 밝힌다.

- **[WARNING]** §3.1 API 명세 표의 "요청 본문 최대 크기 | 1MB" 가 WH-NF-02 와 모순
  - target 위치: `spec/5-system/12-webhook.md` §3.1 Webhook 수신 엔드포인트 표 (`요청 본문 최대 크기 | 1MB`)
  - 과거 결정 출처: 동일 문서 WH-NF-02, §8 보안 고려사항 "본문 크기 제한" 행 — "**1MB 통일 임계는 미구현 (Planned)**"
  - 상세: §3.1 표는 `요청 본문 최대 크기 | 1MB` 를 현재 사실처럼 기술하나, WH-NF-02 와 §8은 현행 구현이 "공개 webhook 만 32KB(PublicWebhookThrottleGuard), 인증 webhook 은 별도 게이트 없음(express 기본값)"이고 "1MB 통일 임계는 미구현(Planned)"임을 명시한다. 이는 API 규약 표가 미구현 목표값을 현행 사실처럼 노출하는 inconsistency 다. Rationale 에서 확정된 "현행/Planned 구분 명시" 원칙(WH-NF-02의 기술 방식)을 §3.1 표가 따르지 않고 있다.
  - 제안: §3.1 표의 해당 셀을 `32KB (공개 webhook, PublicWebhookThrottleGuard) / 무제한 (인증 webhook, Planned: 1MB 통일 — WH-NF-02)` 으로 수정하거나, 셀에 `(Planned: 1MB)` 주석을 추가해 현행과 목표를 구분한다.

- **[INFO]** §1 아키텍처 다이어그램이 Chat Channel 분기를 전혀 표현하지 않아 Rationale 에서 결정된 "chatChannel 별도 spec 분리 + 트리거 내 분기 정의" 설계와 불완전 정합
  - target 위치: `spec/5-system/12-webhook.md` §1 아키텍처 개요 다이어그램
  - 과거 결정 출처: 동일 문서 Rationale "Chat Channel 어댑터 — 별도 spec 으로 분리"; WH-MG-08; §7 step 7
  - 상세: Rationale는 chatChannel 분기를 "본 spec 의 처리 흐름(§7)이 정의한다"고 확정했으나 §1 다이어그램은 그 분기를 생략한다. 독자가 다이어그램만 보면 chatChannel 경로 존재 자체를 파악하지 못한다. INFO 수준이나 다이어그램 신뢰성 관련해 보완 가치가 있다.
  - 제안: §1 다이어그램 하단에 "Chat Channel 분기 포함 상세 흐름은 §7 참조" 한 줄 주석을 추가하거나, `config.chatChannel` 유무 분기를 다이어그램에 표현한다.

- **[INFO]** §6 구현 파일 구조 내 `PublicWebhookThrottleGuard` 의 SoT 참조가 `spec/7-channel-web-chat/4-security.md` 로 지목되어 있으나 webhook 도메인 SoT 와 역할 불명확
  - target 위치: `spec/5-system/12-webhook.md` §6, Rate Limiting 공개 webhook 설명 마지막 "(SoT: [Spec 웹채팅 보안 §4](../7-channel-web-chat/4-security.md))"
  - 과거 결정 출처: 동일 문서 Rationale "webhook URL base 결정 규약 명문화" — "본 spec 을 webhook 도메인 SoT 로 확정한다"
  - 상세: 동일 Rationale 에서 "본 spec 을 webhook 도메인 SoT 로 확정한다"고 명시했음에도, §6 에서 PublicWebhookThrottleGuard 의 SoT 를 `spec/7-channel-web-chat/4-security.md` 로 외부 위임하고 있다. 보안 guard 의 상세 정의가 다른 영역 spec 에 있다면 webhook 도메인 SoT 원칙과 충돌할 수 있다. 실제 기능 충돌이라기보다 SoT 위임 범위 명시 부재다.
  - 제안: 해당 SoT 참조가 "규칙 상세 명세는 웹채팅 보안 spec 에 있으나 webhook 수신 시 적용 범위는 본 spec 이 결정한다"는 취지라면, 그 의미를 주석으로 명확화한다. 또는 PublicWebhookThrottleGuard 의 정책(IP 단위 한도·Redis 카운터)이 webhook domain SoT 이고, 웹채팅 보안 spec 은 구현 상세 참고 문서임을 명시한다.

---

### 요약

`spec/5-system/12-webhook.md` 는 Rationale 에서 합의된 핵심 결정(inline auth 폐지·AuthConfig 단일 진입·POST 전용·webhook 도메인 SoT 확정·chatChannel 별도 spec 분리)을 전반적으로 충실히 반영하고 있다. 기각된 대안(inline 인증 path, `/toggle` 별도 엔드포인트, `/api/webhooks` URL 등)의 재도입은 발견되지 않는다. 다만 §1 아키텍처 다이어그램이 chatChannel 선행 분기 invariant 를 누락해 §7 및 WH-EP-07 과 순서가 불일치하고, §3.1 표의 본문 크기 제한이 현행(32KB 분리)과 목표(1MB 통일, Planned)를 혼용해 WH-NF-02 의 명시적 구분을 따르지 않는 두 가지 WARNING 이 있다. 어느 쪽도 Rationale 에서 합의된 설계 원칙을 직접 번복하지는 않으나 다이어그램과 API 표의 정확성을 개선해야 한다.

### 위험도

LOW

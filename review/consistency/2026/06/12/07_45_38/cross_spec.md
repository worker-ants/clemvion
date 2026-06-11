# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
Target 영역: `spec/4-nodes/4-integration/` (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24 신규/갱신 내용 포함)
검토 기준일: 2026-06-12

---

## 발견사항

### [WARNING] `spec/5-system/3-error-handling.md §3.2` 대표 에러 코드 표에 `EMAIL_HOST_BLOCKED` 미등재

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md §6`, `spec/4-nodes/4-integration/0-common.md §4.2` 주석 포함
- **충돌 대상**: `spec/5-system/3-error-handling.md §3.2` — 대표 에러 코드 표의 Email 행
- **상세**: `spec/5-system/3-error-handling.md §1.4` 에는 `EMAIL_HOST_BLOCKED` 가 `EMAIL_SEND_FAILED` 와 함께 정상 등재되어 있다. 그러나 동일 문서 §3.2 의 "대표 에러 코드 (후속 PR 에서 enum 확장)" 표의 Email 행에는 `EMAIL_SEND_FAILED` 만 기재되고 `EMAIL_HOST_BLOCKED` 가 누락됐다. `spec/2-navigation/4-integration.md §10.3` 과 `chat-channel-adapter.md §3.1` 의 `DB_*` wildcard 는 `DB_HOST_BLOCKED` 를 커버하지만 Email 쪽은 명시적 열거 방식이라 누락이 가시적이다.
- **제안**: `spec/5-system/3-error-handling.md §3.2` Email 행에 `EMAIL_HOST_BLOCKED` 를 추가한다. `Email | EMAIL_SEND_FAILED · EMAIL_HOST_BLOCKED`. §1.4 와의 대칭 유지.

---

### [WARNING] `spec/conventions/chat-channel-adapter.md §3.1` 에 `EMAIL_HOST_BLOCKED` 명시 미등재

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md §8.0 Rationale` — "chat-channel 분류표 영향 없음" 분석
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §3.1` 에러 매핑 표
- **상세**: send-email §8.0 Rationale 은 "`EMAIL_HOST_BLOCKED` 가 노드 레벨 `output.error.code` 로만 surface 되므로 `ERROR_PORT_FALLBACK` 을 통해 이미 INTERNAL 군에 포함되어 분류표 행 추가가 불필요하다" 고 설명한다. 이는 올바른 분석이다. 그러나 `DB_HOST_BLOCKED` 의 target 문서(`spec/4-nodes/4-integration/2-database-query.md §Rationale`) 는 "chat-channel 분류: `DB_*` 매핑에 포함돼 `executionFailedInternal` 로 분류"라고 명시한다. 두 노드의 SSRF 차단 코드가 분류 표에서 처리되는 경로가 다르다: `DB_HOST_BLOCKED` 는 `DB_*` wildcard 로 명시적으로 커버되고, `EMAIL_HOST_BLOCKED` 는 `ERROR_PORT_FALLBACK` 경유 간접 포함이라는 차이가 있다. 이 비대칭이 향후 혼란의 씨앗이 될 수 있다. 현재 chat-channel-adapter §3.1 표의 fallback 행("그 외 모든 code")이 `executionFailedInternal` 이므로 실제 동작은 문제없지만, 명시적 예시가 없어 오해를 유발할 수 있다.
- **제안**: `spec/conventions/chat-channel-adapter.md §3.1` 의 `EMAIL_SEND_FAILED` 행 옆 또는 별도 행으로 `EMAIL_HOST_BLOCKED` 를 추가해 `executionFailedInternal` 로 명시한다. `DB_*` wildcard 와 대칭을 맞추기 위해서는 Email 관련 SSRF 코드를 명시적으로 열거하는 것이 일관성이 높다.

---

### [INFO] `spec/5-system/3-error-handling.md §3.2` 대표 에러 코드 표의 Database 행은 이미 `DB_HOST_BLOCKED` 를 포함해 target 과 일치

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md §6.2`
- **충돌 대상**: `spec/5-system/3-error-handling.md §3.2`
- **상세**: §3.2 의 Database 행에 `DB_HOST_BLOCKED` 가 정상 등재됐다. §1.4 와도 일치한다. 추가 조치 불필요. 확인 기록 목적으로 INFO 등재.

---

### [INFO] `spec/4-nodes/4-integration/2-database-query.md` SSRF 가드 적용 시점 — `assertSafeOutboundHostResolved` 만 사용 (URL 리터럴 검사 없음), http-request 의 이중 검사와 차이

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md §4` SSRF 가드 callout
- **충돌 대상**: `spec/4-nodes/4-integration/1-http-request.md §4` step 8
- **상세**: http-request 는 URL 리터럴 검사(`assertSafeOutboundUrl`) 후 DNS rebinding 검사(`assertSafeOutboundHostResolved`)의 이중 단계를 거친다. database-query 는 `assertSafeOutboundHostResolved` 만 사용한다고 명시한다. DB 의 경우 URL 형식이 아닌 host + port 분리형 자격증명이므로 URL 리터럴 검사가 적용 불가한 것은 의미론적으로 타당하다. 모순이 아닌 합당한 비대칭이지만 문서에 명시되지 않아 혼동 여지가 있다.
- **제안**: `spec/4-nodes/4-integration/2-database-query.md §4` SSRF 가드 callout 에 "DB 자격증명은 host 분리형이라 URL 파싱 단계(`assertSafeOutboundUrl`)를 건너뛰고 `assertSafeOutboundHostResolved` 만 적용" 문구를 한 줄 추가해 의도적 차이를 문서화한다.

---

## 요약

`spec/4-nodes/4-integration/` target 영역이 기존 `spec/**` 과 구조적으로 충돌하는 CRITICAL 항목은 발견되지 않았다. `DB_HOST_BLOCKED` 신설(database-query Rationale), SSRF 가드 전 인증 공통 적용(http-request §8.2 Rationale), `meta.durationMs` 명명 통일(0-common §6.1) 등 주요 결정이 `spec/5-system/3-error-handling.md`, `spec/conventions/chat-channel-adapter.md`, `spec/2-navigation/4-integration.md`, `spec/0-overview.md §2.6` 에 이미 반영돼 정합성이 유지됐다. 다만 `spec/5-system/3-error-handling.md §3.2` 의 Email 대표 에러 코드 표에 `EMAIL_HOST_BLOCKED` 가 누락된 것과, `spec/conventions/chat-channel-adapter.md §3.1` 에 Email SSRF 코드의 명시적 열거가 없는 것은 동기화 갱신이 권장된다(WARNING 2건). 두 WARNING 은 실제 런타임 동작에는 영향이 없으나 문서 단일 진실 원칙상 함께 갱신해야 할 보완 관계 사항이다.

---

## 위험도

LOW

STATUS: SUCCESS

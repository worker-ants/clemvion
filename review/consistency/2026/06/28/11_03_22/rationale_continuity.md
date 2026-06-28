# Rationale 연속성 검토 결과

대상 문서: `spec/5-system/12-webhook.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### 1. INFO — §3.1 표 내 "요청 본문 최대 크기 1MB" 와 WH-NF-02 의 "1MB 통일 미구현(Planned)" 상충 가능성

- **target 위치**: `§3.1 Webhook 수신 엔드포인트` 표, "요청 본문 최대 크기 | 1MB" 행
- **과거 결정 출처**: 동일 문서 `WH-NF-02` (§4 비기능 요구사항) 및 `§8 보안 고려사항` "본문 크기 제한" 항
- **상세**: §3.1 표 셀에는 단순히 "1MB" 만 기재되어 있어 "현행 구현이 1MB 를 시행한다" 는 인상을 준다. 그러나 WH-NF-02 는 동일 문서에서 "현행 구현은 공개 webhook 에 한해 32KB, 인증 webhook 는 무제한(express 기본값), **1MB 통일 임계는 미구현(Planned)**" 을 명시한다. §3.1 표는 1MB 가 계획 값임을 표시하지 않아, 본문 내부에서 구현 사실과 spec 목표가 혼재한다.
- **제안**: §3.1 표의 "1MB" 셀을 "1MB (공개 webhook 현행 32KB, 인증 webhook 무제한 — WH-NF-02 참조)" 또는 "1MB (Planned, 현행: 공개 32KB / 인증 무제한 — WH-NF-02)" 로 보완해 표만 봐도 구현 상태를 인지할 수 있도록 한다.

---

### 2. INFO — §6 Rate Limiting SoT 참조가 이질적 spec 파일(웹채팅 보안)을 가리킴

- **target 위치**: `§6 구현 파일 구조`, "Rate Limiting (공개 webhook 전용 추가)" 설명 끝의 `(SoT: [Spec 웹채팅 보안 §4](../7-channel-web-chat/4-security.md))`
- **과거 결정 출처**: 동일 문서 Rationale "webhook URL base 결정 규약 명문화" 항 — "본 spec 을 webhook 도메인 SoT 로 확정한다"
- **상세**: 이 Rationale 은 응답 래핑·rate limit 글로벌 throttler·POST 전용·URL 정본을 모두 본 spec(12-webhook.md)의 SoT 로 선언했다. 그러나 §6 에서 공개 webhook 전용 IP rate-limit 규칙의 SoT 를 `spec/7-channel-web-chat/4-security.md` 로 위임하면, 본 webhook spec 이 자신이 SoT 라고 선언한 영역(rate limiting)의 정의를 외부 파일에 넘기는 구조적 모순이 발생한다. Rationale 이 "본 spec = webhook 도메인 SoT" 라고 선언한 원칙에 거스른다.
- **제안**: 공개 webhook IP rate-limit 의 정책 세부(`publicWebhook.startupPerMinute`, `hourlyNewMax` 기본값 등)를 본 문서 §8(보안 고려사항) 또는 §6 내부에 명시하고, `spec/7-channel-web-chat/4-security.md` 는 "웹채팅 보안 영역에서의 동일 guard 사용 사례" 로 역전시킨다. 또는 Rationale 의 SoT 선언 범위에서 rate-limit IP 세부 설정을 명시적으로 제외한다.

---

### 3. INFO — 아키텍처 흐름도(§1)가 chatChannel 분기를 반영하지 않음

- **target 위치**: `§1 아키텍처 개요` ASCII 다이어그램 — "2. isActive 확인 → 3. 인증 검증" 순서
- **과거 결정 출처**: 동일 문서 §7 처리 흐름(step 5) + Rationale `Chat Channel 어댑터 — 별도 spec 으로 분리` + `spec/5-system/15-chat-channel.md §5.5 / R-CC-12(d)`
- **상세**: §7 처리 흐름은 "chatChannel 분기가 isActive 검사보다 선행"함을 명시하고, 비활성 chatChannel 트리거에서 인증 수행 후 202 silent skip 한다는 이유까지 Rationale 에 기록해 두었다. §1 다이어그램은 여전히 "1. endpointPath로 조회 → 2. isActive 확인 → 3. 인증 검증" 으로 단순화된 순서를 보여줘 chatChannel 분기 우선 처리라는 합의된 설계를 다이어그램에서는 누락하고 있다. 이것이 오탐을 유발하는 반복 오류 지점(PR #738 W3)과 관련 있을 수 있다.
- **제안**: §1 다이어그램에 chatChannel 분기 존재 및 순서 차이를 주석("chatChannel 트리거는 §7 step 5 참조 — isActive 검사 전 분기") 으로 추가하거나, 다이어그램을 §7 처리 흐름과 일관되게 갱신한다.

---

## 요약

`spec/5-system/12-webhook.md` 는 Rationale 에 기록된 핵심 결정들(inline auth 폐지 → AuthConfig 단일 진입, endpointPath mutable 정책, chatChannel 분기 우선, POST 전용 + URL 정본 선언)을 본문에서 일관되게 따르고 있다. 명시적으로 기각된 대안(inline authType / `/toggle` 서브경로 / per-node task queue / `?wait` 동기모드 등)이 재도입된 사례는 없으며, 합의된 invariant(AuthConfig 단일 SoT, isActive 편집 단일 경로 등)를 위반하는 설계도 발견되지 않았다. 발견된 세 항목은 모두 INFO 등급으로, §3.1 "1MB" 표현의 구현 상태 혼재, §6 의 SoT 참조 역전(웹채팅 보안 → webhook), §1 다이어그램의 chatChannel 분기 누락이다. 이 세 지점은 명시적 결정 번복이 아니라 문서 표현의 정합성 결함이므로 간단한 표현 보완으로 해소 가능하다.

---

## 위험도

LOW

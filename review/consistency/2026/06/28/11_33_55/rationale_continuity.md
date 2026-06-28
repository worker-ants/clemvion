# Rationale 연속성 검토 결과

대상 파일: `spec/5-system/12-webhook.md`

---

## 발견사항

### 1. **[WARNING]** 아키텍처 개요 다이어그램이 합의된 처리 순서를 반영하지 않음

- **target 위치**: `spec/5-system/12-webhook.md` §1 아키텍처 개요 — 다이어그램 내 `2. isActive 확인` / `3. 인증 검증` 순서
- **과거 결정 출처**:
  - `spec/5-system/12-webhook.md ## Rationale` — webhook URL base SoT 확정 항목은 직접 관련 없으나,
  - `spec/5-system/12-webhook.md` WH-EP-07: "구현상 `config.chatChannel` 분기가 `isActive` 검사보다 선행"
  - `spec/5-system/12-webhook.md` §7 처리 흐름 step 5: "즉 `HooksService.handle` 의 chatChannel 분기가 isActive 검사보다 선행한다"
  - `spec/5-system/15-chat-channel.md ## Rationale R-CC-12` (d) 항: "비활성 트리거도 인증 수행" — auth 실패 401 가시성 필요 + chatChannel 분기가 isActive보다 선행함을 명문화
- **상세**: §1 다이어그램은 단순 5단계 박스로 `2. isActive 확인` → `3. 인증 검증` 순서를 표기하고 있다. 그러나 WH-EP-07·§7 step 5·Chat Channel R-CC-12 는 chat-channel 트리거에서 `config.chatChannel` 분기(→ 인증 포함 handleChatChannelWebhook)가 `isActive` 검사보다 선행함을 합의된 invariant 로 명문화했다. 다이어그램이 chatChannel 분기 존재를 아예 표현하지 않아 단순 독자가 "isActive 를 먼저 확인하고 그 다음 인증"이라는 잘못된 멘탈모델을 가질 수 있다.
- **제안**: §1 다이어그램을 `chatChannel` 분기 선행 + 인증 포함 분기를 간략히 표현하거나, 다이어그램 아래에 "※ chatChannel 트리거는 단계 2–3이 반전됨 — §7 참조" 주석을 추가한다. 또는 다이어그램이 일반 webhook 경로만을 나타내는 것임을 명시한다.

---

### 2. **[WARNING]** §3.1 API 표의 `요청 본문 최대 크기: 1MB` 가 합의된 "미구현(Planned)" 상태와 불일치

- **target 위치**: `spec/5-system/12-webhook.md` §3.1 Webhook 수신 엔드포인트 표 — `| 요청 본문 최대 크기 | 1MB |`
- **과거 결정 출처**:
  - 동일 문서 WH-NF-02: "**1MB 통일 임계는 미구현 (Planned)** — `plan/in-progress/spec-sync-webhook-gaps.md`"
  - 동일 문서 §8 보안 고려사항: "현행: 공개 webhook 만 32KB 초과 시 ... 인증 webhook 은 별도 게이트 없음. 1MB 통일 임계는 미구현 (WH-NF-02, Planned)"
- **상세**: §3.1 표의 `요청 본문 최대 크기` 행이 `1MB` 를 단순 표기하고 있어, 독자가 이를 현행 구현 사실로 오독할 수 있다. 같은 문서 내 WH-NF-02 와 §8 은 일관되게 "현행 공개 webhook=32KB, 인증 webhook=무제한(express 기본), 1MB 통일은 Planned"를 명시하고 있다. §3.1 이 이 정보를 반영하지 않아 동일 문서 내에서 내부 불일치가 발생했다. 과거 결정(현행 구현을 정직하게 기술하고 Planned 상태를 명시)을 역행하는 표기다.
- **제안**: §3.1 표의 해당 행을 `| 요청 본문 최대 크기 | **현행**: 공개 webhook 32KB, 인증 webhook 무제한 (express 기본). **1MB 통일 Planned** — WH-NF-02 참조 |` 로 갱신한다.

---

### 3. **[INFO]** WH-MG-04 의 "사용자 명시 토글" 표현이 Rationale R-4 / R-16 과 완전 정합

- **target 위치**: `spec/5-system/12-webhook.md` §3.4 관리 WH-MG-04
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md ## Rationale R-4`, R-16
- **상세**: WH-MG-04 가 "사용자 명시 토글 한정 — 시스템 자동 비활성화는 WH-MG-07 / EIA §R6 참조"로 명시하고 있어 R-4(PATCH body 단일 경로, `/toggle` 미채택)·R-16(drawer read-only 배지)·EIA R6(자동 비활성화 금지) 와 정합된다. 추가 조치 불필요.

---

## 요약

`spec/5-system/12-webhook.md` 는 전반적으로 합의된 설계 원칙(AuthConfig 단일 진입, EIA/Chat Channel 분리, 자동 비활성화 금지, POST 전용 SoT, endpointPath v4 UUID 강제 등)을 잘 따르고 있다. 그러나 두 가지 내부 불일치가 존재한다. 첫째, §1 아키텍처 다이어그램이 chatChannel 분기 선행 + 인증-then-isActive 순서를 표현하지 못해, 본문 WH-EP-07·§7·Chat Channel R-CC-12 가 합의한 처리 순서 invariant 와 어긋나는 misleading 표현을 남기고 있다. 둘째, §3.1 API 표의 본문 크기 행이 "1MB"를 단순 기재하여 같은 문서 WH-NF-02·§8 이 Planned 임을 명시한 상태와 불일치한다. 두 항목 모두 새로운 결정 번복이 아니라 기존 합의를 표에/다이어그램에 반영하지 못한 누락이므로, target 문서 내 표기를 기존 Rationale 기반 서술과 정합되도록 수정하면 해소된다.

---

## 위험도

MEDIUM

# 정식 규약 준수 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`
**검토 모드**: spec draft (`--spec`)
**기준 규약**: `spec/conventions/chat-channel-adapter.md`, `plan-lifecycle.md`, `CLAUDE.md`

---

## 발견사항

### [CRITICAL] §3.1 섹션 번호 충돌 — 기존 §3.1 과 신설 §3.1 이 중복

- **target 위치**: 문서 "Spec 갱신안 A. chat-channel-adapter.md" 의 "§3.1 신설 — ChatChannelInternalEvent → renderPresentationNode 매핑" 항목
- **위반 규약**: `spec/conventions/chat-channel-adapter.md` §3.1 (현재 "Execution Failed 분류 알고리즘" 로 이미 정의됨)
- **상세**: 현재 live `chat-channel-adapter.md` 의 §3 하위에는 `§3.1 Execution Failed 분류 알고리즘` 이 이미 존재한다. draft 는 동일한 번호 `§3.1` 을 "ChatChannelInternalEvent → renderPresentationNode 매핑" 의 별도 표 신설에 재사용하도록 제안하고 있다. 이 충돌이 그대로 spec 본문에 반영되면 두 개의 `§3.1` 절이 공존하게 되어 cross-reference 와 앵커 링크가 깨진다. spec 변경 관리 §7 의 cross-ref 연쇄 갱신 의무도 무력화된다.
- **제안**: 신설 매핑 표를 `§3.2` 로 번호를 조정한다. 아울러 `§3` 진입 문장("`renderNode(event)` 가 처리해야 하는 5종 EIA 이벤트...")도 "5종 EIA 이벤트 + 1종 internal 이벤트" 또는 별 단락으로 분리 기술하도록 갱신이 필요하다.

---

### [CRITICAL] §1.1 함수 수 카운트 오류 — "6함수 → 7함수" 는 실제로 "7행 → 8행"

- **target 위치**: 문서 "§1.1 — 6함수 → 7함수 표 확장" 설명 및 `renderPresentationNode` 행 추가 제안
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §1.1` 현행 표 (이미 7개 행 포함)
- **상세**: 현재 live `chat-channel-adapter.md §1.1` 의 헤더는 "6함수 책임 / 부작용 / 멱등성" 이나, 표에는 `setupChannel` / `teardownChannel` / `parseUpdate` / `renderNode` / `sendMessage` / `ackInteraction` / `revokeBotToken?` 의 **7개 행**이 이미 존재한다 (헤더 자체가 이미 live 에서 실수로 "6함수" 로 고정되어 있음). draft 는 이를 "6함수 → 7함수 확장" 이라 표현하지만, `renderPresentationNode` 를 추가하면 실제로 **8개 행**이 된다. draft 대로 적용하면 §1.1 헤더가 "7함수" 로 갱신되나 실제 행은 8개가 되어 또 다른 drift 가 발생한다.
- **제안**: §1.1 헤더를 "8함수 책임 / 부작용 / 멱등성" 으로 갱신 (또는 `revokeBotToken?` 이 옵션 메서드임을 감안해 "7함수 + 1 옵션 메서드" 등으로 명확화). `revokeBotToken?` 은 `ChatChannelAdapter` interface 의 선택 메서드이므로 별도 분리 표기하는 것이 헤더 카운트 혼란을 방지한다. draft 의 "6함수 → 7함수" 표현 전체를 해당 실제 수로 정정해야 한다.

---

### [CRITICAL] `renderPresentationNode` 가 `ChatChannelAdapter` interface 블록에 누락

- **target 위치**: 문서 "§1.1 — 6함수 → 7함수 표 확장" 의 `renderPresentationNode` 행 추가 제안. `ChatChannelAdapter` TypeScript interface 블록(`§1`) 에는 해당 추가가 없음.
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §1` (`interface ChatChannelAdapter` 블록) — 함수 표와 interface 블록은 단일 계약의 두 표현 (표 = 요약, interface = 타입 정의). 이 둘이 불일치하면 구현자가 어느 쪽을 따라야 할지 모호해져 convention 의 invariant 가 깨진다.
- **상세**: draft 는 §1.1 함수 표에 `renderPresentationNode` 를 추가하도록 제안하지만, 실제 `interface ChatChannelAdapter { ... }` TypeScript 블록에 해당 메서드 시그니처를 추가하는 갱신안이 없다. 모든 provider 어댑터 구현자는 interface 를 기준으로 계약을 만족시키므로, interface 누락은 "모든 provider 어댑터가 구현 의무" (spec 갱신안 영향 평가 항목) 라는 결정과 직접 충돌한다.
- **제안**: spec 갱신안 A 에 `interface ChatChannelAdapter` 블록에 `renderPresentationNode(event: ChatChannelInternalEvent, config: ChatChannelConfig): Promise<ChannelMessage[]>` 메서드 시그니처를 추가하는 내용을 명시한다. 시그니처의 입력 타입은 신설 `ChatChannelInternalEvent` (§1.3) 를 참조해야 한다.

---

### [WARNING] Frontmatter `type` 필드가 `plan-lifecycle.md` 스키마에 없음

- **target 위치**: 문서 frontmatter 첫 줄 (`type: spec-draft`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` — 정의된 필드는 `worktree`, `started`, `owner` 3종
- **상세**: `plan-lifecycle.md §4` 는 plan frontmatter 에 `worktree` / `started` / `owner` 만 정의한다. target 문서는 `type: spec-draft` 를 추가로 사용하고 있으며, 이는 규약에 없는 비정의 필드다. Round 1 consistency check (C-4) 에서 이 필드 자체는 "spec-draft prefix 누락" 해소를 위해 추가된 것으로 기록되어 있으나, frontmatter 필드 자체가 규약에 반영된 바 없다.
- **제안**: `plan-lifecycle.md §4` 에 `type: spec-draft | impl | ...` 와 같은 선택 필드를 공식화하거나, target 문서의 frontmatter 에서 `type` 필드를 제거하고 파일명 prefix (`spec-draft-`) 만으로 구분한다. 규약을 갱신하는 쪽이 적절하다면 `plan-lifecycle.md` 를 함께 갱신할 것.

---

### [WARNING] §1.2 도입 문장 부정합 — `EiaEvent` 5종 도입 문장과 `presentations?` 필드 추가의 논리 긴장

- **target 위치**: 문서 "§1.2 도입 문장은 그대로 ('EIA §6 outbound notification payload 의 5종 union') — drift 회피 원칙 보존"
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §1.2` 도입 문장 ("EIA §6 outbound notification payload 의 5종 union — 별 신규 타입 정의 없이 EIA spec 의 payload shape 을 재사용")
- **상세**: draft 는 `EiaAiMessageEvent` 에 `presentations?: PresentationPayload[]` 를 추가하면서 §1.2 도입 문장("5종 union")을 그대로 유지한다고 명시한다. 5종 union 자체는 변경되지 않으므로 "5종 union" 문장 유지는 옳다. 그러나 도입 문장의 두 번째 절 "별 신규 타입 정의 없이 EIA spec 의 payload shape 을 재사용 (drift 회피)" 는 `presentations?: PresentationPayload[]` 필드 추가와 약한 긴장 관계에 있다. `PresentationPayload` 가 어디서 import/define 되는지, 그리고 "EIA spec 의 payload shape 재사용" 원칙에서 이 필드 추가가 어떻게 정당화되는지 §1.2 본문에 별도 주석 없이는 독자가 혼동할 수 있다.
- **제안**: §1.2 에 `presentations?` 추가 시 "EIA §6.5 line 536 에 이미 약속된 필드를 type 에 반영한 것 — EIA spec 의 payload shape 재사용 원칙 충족" 과 같은 인라인 주석 또는 각주를 한 줄 추가해 도입 문장과의 긴장을 해소한다.

---

### [WARNING] spec 갱신안 D (CHANGELOG 항목) — 변경 사유 설명 최소화로 추적성 저하

- **target 위치**: 문서 "D. CHANGELOG 항목 추가" 항목
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §Changelog` 의 기존 기재 패턴 (날짜 + 변경 내용 + plan 이름 또는 결정 링크를 포함한 문장)
- **상세**: draft 의 D 항목은 "2026-05-25 행" 이라고만 적고 실제 changelog 기재 내용을 명시하지 않는다. live `chat-channel-adapter.md` 의 changelog 는 각 행이 "변경 내용 요약 + 관련 plan/PR 이름" 을 포함한 충분한 문장으로 구성되어 있다. draft 대로 spec 본문을 갱신하면 기재 내용이 불확실하거나 후속 작업자가 다시 결정해야 하는 상황이 생긴다.
- **제안**: D 항목에 세 파일 각각에 기재할 changelog 행의 구체 문장 초안을 포함시킨다. 적어도 "어떤 기능이 추가됐고 어떤 plan 에 의한 변경인지" 를 명시해야 한다.

---

### [INFO] `ChatChannelInternalEvent` 타입 위치 — §1.3 신설의 의미 경계 명확화 권장

- **target 위치**: 문서 "§1.3 (신설) ChatChannelInternalEvent — chat-channel-internal in-process listener 입력"
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §1.2` 도입 맥락 ("EIA §6 outbound payload 5종 union" 을 기술하는 §1 내부)
- **상세**: §1 은 "Adapter Interface" 의 타입 계약을 다루고, §1.2 는 `EiaEvent` (외부 오리진 5종), §1.3 (신설) 은 `ChatChannelInternalEvent` (in-process 오리진) 를 정의한다. 두 타입의 오리진이 다름에도 같은 §1 하위에 나란히 배치되면, 독자가 `ChatChannelInternalEvent` 를 EIA outbound 이벤트의 변형으로 오인할 수 있다. 비-blocking 이지만 외부 노출 없음이라는 속성이 §1.3 도입 문장에 이미 명시됐으나, §1.1 의 6(또는 8)함수 표와의 관계 — 즉 `renderPresentationNode` 가 `ChatChannelInternalEvent` 를 입력으로 받는다는 점 — 도 상호 참조가 없다.
- **제안**: §1.3 도입 문장에 "`renderPresentationNode` (§1.1 표) 의 입력 타입" 이라는 한 줄 cross-reference 를 추가해 §1.1 표와의 연결을 명확히 한다.

---

### [INFO] 계획 문서 구조 — `## Overview` 섹션 부재 (plan 문서로서 허용 범위)

- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 단, 이 규칙은 spec 문서에 적용되며, plan 문서(`plan/in-progress/`)에는 명시적 적용 의무가 없음
- **상세**: target 은 plan 문서이므로 3섹션 의무가 없다. 다만 문서가 spec 갱신안을 직접 포함하고 있어 spec 문서로 오인될 수 있는 형태다. 현재 구조는 "회귀 원인 → 진단 → 결정 → Spec 갱신안 → 영향 평가 → Consistency-check 회차 → 절차 → 담당" 순서로, plan 문서로서는 충분하다.
- **제안**: 조치 불필요. 다만 spec 본문 반영 단계(절차 5번째 체크박스)에서 실제 spec 파일(`chat-channel-adapter.md` 등)에 내용을 옮길 때는 3섹션 구조를 준수해야 한다.

---

## 요약

target plan 문서는 round 1 consistency check 에서 발견된 4개 CRITICAL (C-1 ~ C-4) 을 모두 해소했으나, 이번 검토에서 새로운 정식 규약 위반 3건을 발견했다. 가장 심각한 것은 `§3.1` 섹션 번호 충돌(기존 "Execution Failed 분류 알고리즘" §3.1 과 신설 "ChatChannelInternalEvent 매핑" §3.1 이 중복), `§1.1` 함수 수 카운트 오류("7함수"라고 쓰지만 실제로는 8행이 됨), 그리고 `renderPresentationNode` 메서드 시그니처가 `interface ChatChannelAdapter` 블록에 누락된 것이다. 이 세 가지가 그대로 spec 본문에 반영되면 구현자 계약의 단일 진실이 깨지고 cross-reference 링크가 오동작한다. BLOCK 권고.

---

## 위험도

**HIGH**

CRITICAL 3건 해소 전까지 spec 본문 반영(절차 5단계) 진행을 차단한다. 각 항목은 draft 수정만으로 해소 가능하며 EIA spec 이나 다른 파일의 추가 변경은 불필요하다.

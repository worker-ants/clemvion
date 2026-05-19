# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-conversation-ui-contract.md`
Target spec: `spec/conventions/conversation-thread.md` §9 확장 (§9.6 ~ §9.10, §9.A 신설)

---

## 발견사항

### 1. WS 이벤트명 약칭 혼동 가능성 (INFO)

- **target 신규 식별자**: §9.7 표의 이벤트명 `tool_call_started`, `tool_call_completed`, `ai_message`, `waiting_for_input`
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md` §4.1 에 `execution.tool_call_started`, `execution.tool_call_completed`, `execution.ai_message`, `execution.waiting_for_input` 로 네임스페이스 포함 형식으로 정의
- **상세**: target 의 §9.7 표는 동일한 이벤트를 `execution.` prefix 없이 단축 표기한다. 본문 주석에 "spec/5-system/6-websocket-protocol.md §4.4 의 의미를 따른다" 가 있으므로 사실상 동일 이벤트를 가리키지만, 표 안에서만 보면 기존 spec 의 정식 이름과 형태가 다르다. 차후 본 표를 인용하는 구현자가 약칭과 정식명이 같은 이벤트임을 놓칠 수 있다.
- **제안**: §9.7 표의 이벤트 열 헤더에 "WS 이벤트 (`execution.*` 생략)" 등의 주석을 달거나, 첫 등장에 `execution.tool_call_started` 정식명을 bracket으로 병기하는 것으로 충분히 해소된다. 별도 식별자 추가 불필요.

---

### 2. `§9.A` 절 번호 형식 — 기존 명명 컨벤션 미적용 (WARNING)

- **target 신규 식별자**: `§9.A` (알파벳 suffix 절 번호)
- **기존 사용처**: `spec/conventions/conversation-thread.md` §1 ~ §10, `spec/conventions/node-output.md` Principle 1.1 ~ 8.2, `spec/5-system/6-websocket-protocol.md` §1 ~ §4.4.6 — 모두 숫자 점 숫자 체계
- **상세**: 본 codebase의 spec 문서 전체에서 `§N.A` 형식의 알파벳 suffix는 단 한 건도 발견되지 않는다. 기존 관례는 `§9.10`, `§9.11`처럼 숫자를 계속 늘리거나, 별도 H3 헤더 (`###`)로 분리한다. `§9.A`는 독자가 "16진수 번호인가, 부록 표기인가"를 즉시 파악하기 어렵고, cross-reference URL anchor가 `#9a`로 생성되어 기존 anchor 패턴(`#9-6-…`, `#10-…`)과 이질적이다.
- **제안**: `§9.A`를 `§9.11`로 변경하거나, "### 변환 함수 contract (Appendix)" 헤더로 교체한다. 절 번호 체계를 숫자로 통일하면 cross-reference 표기와 URL anchor 모두 기존 패턴과 일치한다.

---

### 3. `isAssistantContentBlank` — 이미 codebase에 구현되어 있으나 spec 위치 지정 불일치 (WARNING)

- **target 신규 식별자**: spec §9.8 에서 정의하는 `isAssistantContentBlank(content: unknown): boolean` 함수
- **기존 사용처**:
  - `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` line 63 — 동일 시그니처·동일 로직으로 이미 구현됨
  - `codebase/frontend/src/components/editor/run-results/__tests__/conversation-inspector.test.tsx` line 603–620 — 동일 함수명으로 단위 테스트 존재
- **상세**: 함수명·시그니처·동작(null/undefined/whitespace-only → true)이 target의 §9.8 정의와 100% 일치하므로 의미 충돌은 없다. 그러나 현재 구현은 `conversation-inspector.tsx` 내 비공개 위치에 있어 `spec/conventions/conversation-thread.md §9.5` 의 `messagesToConversationItems` / `threadTurnsToConversationItems` 사용처(§9.8 에서도 나열)와 다른 파일에 분산된다. spec 이 §9.8 에서 "단일 결정 함수"로 격상하면서 구현을 `conversation-utils.ts`로 이동·재export 해야 단일 진실 원칙이 지켜진다 — spec에 명시된 "사용처 3곳"이 동일 함수를 import하려면 현재 위치(inspector.tsx)에서는 계층이 역전된다.
- **제안**: spec §9.8 에 "구현 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts` 로 이전·export 필수" 한 줄 추가. 현재 이미 `isAssistantContentBlank`가 `conversation-inspector.tsx` 에 있으므로 developer 단계에서 이전 작업이 필요함을 명시해 충돌 없이 단일화한다.

---

### 4. `mergeOrphanToolItems` — spec에 없는 신규 함수명 (INFO)

- **target 신규 식별자**: §9.A `mergeOrphanToolItems(threadItems, prev)` 함수
- **기존 사용처**: `spec/conventions/conversation-thread.md` §9.5 에는 `messagesToConversationItems`, `threadTurnsToConversationItems`, `parseHistoryMessages` 세 함수만 언급. `codebase/`에서 `mergeOrphanToolItems`는 검색되지 않음 (미구현 상태).
- **상세**: 기존 spec이나 codebase에서 동일 이름으로 다른 의미로 사용된 사례가 없으므로 충돌 없음. spec §9.A가 신규 도입하는 함수이며, 기존 §9.5 의 세 함수 목록에 없다가 이번에 추가된다.
- **제안**: §9.A 에서 함수를 정의한 뒤, §9.5 의 "사용처 (3곳)" 목록(현재 `messagesToConversationItems`, `threadTurnsToConversationItems`, `parseHistoryMessages`)에 `mergeOrphanToolItems`를 4번째로 추가하면 §9.5의 목록과 §9.A의 정의가 동기화된다.

---

### 5. `Inv-1 ~ Inv-4` 식별자 — 기존 invariant 명명 패턴과 이질적 (INFO)

- **target 신규 식별자**: §9.9 의 `Inv-1`, `Inv-2`, `Inv-3`, `Inv-4`
- **기존 사용처**: `spec/conventions/node-output.md` 는 불변량을 "Principle N.M" 형식으로 표기. 다른 spec 어디에도 `Inv-N` 형식이 사용되지 않음.
- **상세**: 의미 충돌(같은 이름이 다른 뜻으로 이미 사용)은 없다. 다만 기존 컨벤션이 "Principle" 형식을 불변규칙의 레이블로 사용하므로, `Inv-N` 이 본 문서에만 등장하는 이질적 패턴이 된다. 혼동보다는 일관성 문제.
- **제안**: `Inv-N` 를 `Principle 9.N` 형식으로 교체하거나, 독자적 형식을 유지한다면 §9.9 서두에 "본 절은 `Inv-N` 레이블을 사용한다(node-output.md Principle N.M 패턴의 §9 한정 별칭)" 한 줄 명시하면 오해가 없다.

---

### 6. `S1 ~ S7` 시나리오 ID — 기존 요구사항 ID 네임스페이스와 분리 필요 (INFO)

- **target 신규 식별자**: §9.10 의 `S1` ~ `S7` (회귀 차단 시나리오 ID)
- **기존 사용처**: 기존 spec 의 요구사항 ID는 `NAV-WF-*`, `ED-AI-*`, `ND-IF~ND-BG`, `EH-DETAIL-*`, `ENG-RC-*` 등 도메인 prefix 패턴. `S1`~`S7` 처럼 단문자-숫자 형식은 다른 spec 에서 사용되지 않음.
- **상세**: 의미 충돌은 없다. 그러나 단문자 `S` prefix 는 앞으로 다른 영역(예: 시스템 요구사항 `S-*`, Storage `S3` 참조 등)에서도 자연스럽게 출현할 수 있으므로, 전체 spec 공간에서 고유성이 약하다.
- **제안**: `CT-S1` ~ `CT-S7` (Conversation Thread Scenario) 혹은 `RG-1` ~ `RG-7` (Regression Guard) 처럼 도메인 prefix를 달면 spec 전체에서 충돌 가능성이 사라진다. 단, §9.10 이 `conversation-thread.md` 내부에서만 참조되는 local ID 라면 단문자도 허용 가능 — 이 경우 §9.10 서두에 "본 표의 ID는 §9.10 스코프 한정" 을 명시한다.

---

## 요약

target 문서(`spec-draft-conversation-ui-contract.md`)가 도입하는 신규 식별자 중 동일 이름이 다른 의미로 이미 사용 중인 CRITICAL 충돌은 없다. 주요 함수명(`messagesToConversationItems`, `threadTurnsToConversationItems`, `parseHistoryMessages`)은 기존 spec §9.5 및 codebase와 이름·의미가 일치하므로 재정의 충돌이 아닌 공식화다. `isAssistantContentBlank`는 codebase에 이미 동일 시그니처·동작으로 구현되어 있어 충돌 없이 spec이 사후 격상하는 구조이나, 현재 구현 위치(`conversation-inspector.tsx`)가 spec이 선언하는 "단일 결정 함수" 위상과 불일치하므로 developer 단계에서 `conversation-utils.ts` 이전이 필요하다. `§9.A` 절 번호 형식은 본 프로젝트 spec 전체에서 전례 없는 알파벳 suffix로, 기존 숫자 체계와 혼용되어 URL anchor가 이질적으로 생성된다는 WARNING을 제기한다. WS 이벤트명의 `execution.` prefix 생략과 `Inv-N`·`S1~S7` 패턴은 일관성 측면의 INFO 수준 제안 사항이다.

---

## 위험도

LOW

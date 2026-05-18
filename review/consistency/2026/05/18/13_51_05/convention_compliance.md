# Convention Compliance — `spec/conventions/conversation-thread.md` (draft)

## 발견사항

---

- **[WARNING]** §2.5 가 §3 뒤에 위치 — 섹션 번호 순서 위반
  - target 위치: 파일 전체 구조. `## 3. 스코프 규칙` / `### 3.3 컨테이너 상속 근거` 뒤에 `### 2.5 nextSeq 원자성` 등장.
  - 위반 규약: CLAUDE.md 명명 컨벤션 및 일반 문서 구조 규약 — 숫자 prefix 는 정렬 보장 목적이므로 섹션 번호가 순서대로 배치되어야 한다.
  - 상세: `### 2.5 nextSeq 원자성` 절이 `### 3.3 컨테이너 상속 근거` 뒤에 독립 블록으로 삽입되어 있다. 이는 committed 파일(`spec/conventions/conversation-thread.md`)에도 동일하게 존재하는 기존 구조 문제이며, draft 가 이를 그대로 계승하고 있다.
  - 제안: `### 2.5 nextSeq 원자성` 절을 `### 2.4 opt-out` 바로 뒤, `## 3. 스코프 규칙` 앞으로 이동한다.

---

- **[WARNING]** §1.4 표 컬럼 구성 변경 — committed 버전과 구조적 확장 불일치
  - target 위치: `### 1.4 text 변환 규칙` 표.
  - 위반 규약: `spec/conventions/conversation-thread.md` 자체가 정식 규약(conventions)이므로, draft 가 committed 버전의 표 구조를 확장할 때 그 의미 변화를 명시해야 한다.
  - 상세: committed 버전은 `interaction.type` / `text` 2열 표다. draft 는 이를 `interaction.type` / `text (LLM-facing)` / `UI 카드 헤더 (참고)` / `UI 카드 본문 (참고)` 4열 표로 확장했다. 컬럼 이름 변경(`text` → `text (LLM-facing)`)은 기존 구현이 참조하던 명세의 의미 변경이므로 CHANGELOG 에 명시해야 한다. draft §10 CHANGELOG 에는 "§1.4 의 `text` / `data` 의미 명확화" 라고 기재되어 있으나, 컬럼 이름·구조 변경이 포함된 사실은 기록되지 않았다.
  - 제안: §10 CHANGELOG 2026-05-18 행에 "`§1.4 표를 4열로 확장 (UI 카드 헤더·본문 열 추가), text 컬럼명을 'text (LLM-facing)' 으로 명확화`" 내용을 보충한다.

---

- **[WARNING]** §1.2 `text` 필드 설명 변경 — committed 버전과 의미 충돌 가능성
  - target 위치: `### 1.2 ConversationTurn` 표의 `text` 행.
  - 위반 규약: `spec/conventions/conversation-thread.md` 정식 규약의 단일 진실 원칙.
  - 상세: committed 버전의 `text` 설명은 `"system_text injection 과 UI 의 1차 텍스트. 빈 문자열 가능 (구조화 데이터만 있는 경우)"` 이다. draft 는 이를 `"system_text injection 과 messages 모드의 user/assistant content. **LLM-facing 1차 텍스트** — ... UI 표시는 §11 의 매핑표를 따라..."` 로 대폭 변경했다. 특히 committed 버전에서는 `text` 가 "UI 의 1차 텍스트" 였으나 draft 에서는 "UI 는 §11(§9) 의 매핑표를 따라 source + nodeLabel + data 로 분기 — text 를 raw 로 직접 노출하지 않는다" 로 정반대의 방향이 된다. 이는 §8.1 Rationale 의 핵심 결정을 반영한 의도적 변경이지만, committed 버전이 아직 구 명세를 담고 있어 스펙 롤아웃 중 구현과의 해석 충돌이 발생할 수 있다.
  - 제안: draft 내용이 올바른 최신 명세이므로 빠른 커밋이 필요하다. 단, §10 CHANGELOG 에 "`§1.2 text 필드: 'LLM-facing 1차 텍스트' 로 의미 재정의, UI 직접 노출 금지 명시`" 를 추가한다. 현재 CHANGELOG 에는 이 항목이 명시적으로 누락되어 있다.

---

- **[WARNING]** §1.2 `data?` 설명이 `node-output.md §4.5` 와 중복 명시 — 단일 진실 원칙 위험
  - target 위치: `### 1.2 ConversationTurn` 표의 `data?` 행.
  - 위반 규약: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" — `spec/conventions/node-output.md §4.5` 가 `interaction.data` 의 SoT.
  - 상세: draft 의 `data?` 설명은 `form_submitted → { [fieldName]: value }`, `button_click → { buttonId, buttonLabel, selectedItem? }`, `button_continue → { buttonId, buttonLabel, url }`, `message_received → { content, role }` 를 인라인으로 열거한다. `node-output.md §4.5` 가 동일 내용의 정식 SoT 이므로, 여기서 shape 을 다시 열거하면 두 문서가 drifting 할 수 있다. 이미 문장 안에 `([Spec node-output §4.5])` 링크가 있지만 shape 을 인라인으로 다시 전부 기재하고 있어 불필요한 중복이다.
  - 제안: shape 상세는 §4.5 링크로 위임하고, `data?` 설명에서 각 type 별 shape 인라인 열거를 제거하거나 "§4.5 의 정의를 그대로 따른다" 한 문장만 남긴다.

---

- **[INFO]** §9 이모지 사용 — 문서 일관성 관점
  - target 위치: `### 9.1 source 별 시각 매핑 (강제)` 표.
  - 위반 규약: CLAUDE.md "사소한 형식 일관성" — 이모지 사용은 명시 요청 시만.
  - 상세: `👤`, `🤖`, `🧩`, `🔧`, `ℹ️` 이모지가 UI 형식 설명에 사용되어 있다. 이 문서는 `spec/conventions/` 정식 규약이므로 이모지보다는 텍스트 식별자(예: `[user]`, `[assistant]`, `[presentation]`)가 더 일관적이다. 다만 이모지가 실제 UI 아이콘 사양을 전달하려는 목적이라면 의도적 선택으로 볼 수 있다.
  - 제안: 이모지가 UI 글리프 사양의 일부라면 그 역할을 주석으로 명시("UI 에서 사용할 글리프")하고, 순수 문서 구분 기호라면 텍스트 식별자로 대체한다.

---

- **[INFO]** §5 → `spec/4-nodes/3-ai/1-ai-agent.md §1` 참조 — 섹션 이름 명시 권장
  - target 위치: `## 5. AI Agent 자동 주입` 첫 문장.
  - 위반 규약: 문서 구조 규약 (내부 참조 정확성).
  - 상세: `spec/4-nodes/3-ai/1-ai-agent.md §1 의 5 신규 필드` 로 섹션을 참조하는데, §1 이 어느 섹션인지 앵커 없이 숫자만 기재되어 있다. committed 버전도 동일하나 draft 에서도 개선되지 않았다.
  - 제안: `spec/4-nodes/3-ai/1-ai-agent.md#1-노드-설정` 처럼 앵커를 명시하거나, 섹션 이름을 병기한다.

---

- **[INFO]** §8.1 Rationale 이 본문 섹션(§9) 보다 앞에 위치
  - target 위치: `### 8.1 Conversation Preview 의 렌더 규칙 분리 (2026-05-18)`.
  - 위반 규약: CLAUDE.md 권장 3섹션 구조 — Overview / 본문 / Rationale 순서.
  - 상세: §8 Rationale 는 §9 (미리보기 UI 렌더 규칙) 을 설명하는 Rationale 임에도 §9 앞에 위치한다. §8.1 은 §9 에서 결정된 내용에 대한 배경 설명이므로, 독자가 §9 를 먼저 읽지 않으면 §8.1 의 맥락을 이해하기 어렵다. 단, conventions 문서의 현재 구조 관례(§8 Rationale → §9 이후 본문 추가)가 있어 완전 재구성은 과도할 수 있다.
  - 제안: §8 를 §10(CHANGELOG) 바로 앞, §9(UI 렌더 규칙) 뒤로 이동해 Overview(§1-§7) → 본문(§9) → Rationale(§8·§8.1) → CHANGELOG(§10) 순서로 정돈하거나, §8 상단에 "§9 의 결정 근거" 임을 안내 문구로 명시한다.

---

## 요약

draft 의 신규 섹션(§1.5, §1.6, §8.1, §9, §9.1-§9.5, §10)과 §1.2·§1.4 의 확장은 전반적으로 정식 규약(`spec/conventions/`)이 요구하는 단일 진실·명명 컨벤션·문서 구조 규약을 준수하고 있다. `node-output.md §4.5` 를 SoT 로 교차 참조하고 있으며, Rationale 섹션을 포함한 3섹션 구조도 갖추고 있다. 다만 세 가지 WARNING — §2.5 위치 이탈(기존 문제 계승), §1.4 표 구조 확장 미기록, §1.2 text 의미 반전 미기록 — 이 CHANGELOG 불완전성 및 버전 간 의미 충돌 위험을 야기한다. `data?` 의 shape 인라인 중복 열거도 §4.5 와의 drift 위험을 안고 있다. Critical 수준의 규약 위반(정식 규약 직접 위반·invariant 파괴)은 발견되지 않았으며, 지적사항 모두 CHANGELOG 보충과 소규모 구조 조정으로 해결 가능하다.

## 위험도

LOW

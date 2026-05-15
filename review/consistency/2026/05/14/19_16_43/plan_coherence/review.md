실제 spec 파일 내용을 확인했습니다. 이제 점검 결과를 정리하겠습니다.

---

## 발견사항

### [WARNING] W1 — 교체 블록에 기존 `message_received` 행 중복 포함

- **target 위치**: `spec-draft-thread-followups.md` §1 "기존 표 마지막 행을 다음으로 교체" 블록
- **관련 spec 현황**: `spec/conventions/conversation-thread.md` §1.4 현재 마지막 두 행이 `| message_received (ai_user) | ... |` → `| ai_assistant final | ... |` 순으로 존재
- **상세**: 드래프트 교체 블록에 `| \`message_received\` (ai_user) | ... |`가 첫 행으로 포함되어 있다. "기존 표 마지막 행을 교체"를 문자 그대로 적용하면 바로 위 행인 기존 `message_received` 행이 그대로 남아 동일 행이 연속으로 두 번 등장한다.
- **제안**: 교체 블록에서 `message_received` 행을 제거하고, 실제 교체 대상은 `ai_assistant final` 단일 행 → `ai_agent` / `text_classifier` / `information_extractor` 3행으로 명확히 표기할 것.

---

### [WARNING] W5 — step 번호 재정리 주석과 블록 내용 상호 모순

- **target 위치**: `spec-draft-thread-followups.md` §5 "기존 step list 의 1.5 다음에 두 step 추가" 블록 및 괄호 주석
- **관련 spec 현황**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 현재 step 순서 — 1 → 1.5 → 2(LLM 호출) → 3(도구 처리) → 4 → 5 → 6 → 7
- **상세**: 드래프트 블록에서는 LLM 호출을 step 2로 유지하고 신규 push 단계를 step 2.5로 표기한다. 그런데 괄호 주석 "(번호 재정리 — 기존 step 2 가 2.5 로 밀리고, 후속 step 도 따라 갱신.)"은 LLM 호출 단계가 2.5로 이동한다고 명시하여 블록과 정반대의 구조를 제시한다.
- **제안**: 두 가지 해석 중 하나를 선택해야 한다.
  - **(A)** ConversationThread push가 LLM 호출 **이후**에 위치하는 경우: `1→1.5→2(LLM)→2.5(push)→3→...` — 블록이 맞고 주석 수정
  - **(B)** ConversationThread push가 LLM 호출 **이전**에도 위치하는 경우(ai_user push는 LLM 직전): 구조 자체를 재검토하거나 push 단계를 2a/2b로 분리

---

### [WARNING] W4 — "Stage 3" cross-link 참조 대상 plan 미정의

- **target 위치**: `spec-draft-thread-followups.md` §4 추가 주석 블록
- **관련 plan 상황**: `plan/in-progress/` 어디에도 "Stage 3" 또는 "presentation Principle 1.1 재작성" plan 문서가 없다
- **상세**: W4 주석이 "Stage 3 (presentation Principle 1.1 재작성) 의 일부로 별도 진행"을 migration 경로로 명시하나, 해당 plan 문서가 존재하지 않아 dangling 참조가 된다. `node-output-redesign` plan은 conventions 비수정 원칙을 명시하므로 여기에 해당하지 않는다.
- **제안**: 두 가지 처리 방안 중 선택:
  - Stage 3 plan 문서를 `plan/in-progress/` 에 선 생성하고 해당 경로로 cross-link를 걸거나
  - "별도 진행" 표현을 "별도 plan 에서 진행 예정 (plan 미정)"처럼 미확정임을 명시

---

### [INFO] W1 — text_classifier / information_extractor push 구현 상태 미확인

- **target 위치**: `spec-draft-thread-followups.md` §1 드래프트 — "v1 push 적용" 표기
- **관련 plan 상황**: `plan/in-progress/conversation-thread.md` Phase 4 (✅)는 `ai-agent.handler.ts`만 명시적으로 다루고, W1 follow-up 메모에 "현 Phase 4 는 ai_agent 만 다룸 — v1 의 '모든 AI 노드 push' 정책과 일관성 확인" 이 남아있다
- **상세**: spec이 "v1 push 적용"이라 선언하는데, text_classifier·information_extractor 핸들러에 ConversationThread push hook이 실제로 구현되었는지 plan 차원에서 확인되지 않는다. 구현이 없으면 spec이 사실과 다르게 된다.
- **제안**: spec write 전에 두 핸들러 (`backend/src/nodes/ai/text-classifier/`, `backend/src/nodes/ai/information-extractor/`) 에 push hook 구현 여부를 grep으로 확인. 미구현이면 "v1 push 적용" 대신 "v2 자동 주입과 함께 push 도입 예정 (v1 미적용)"으로 표기 수정 필요.

---

### [INFO] W6 — node-output-redesign 진단 산출물과 필드명 일치 확인 권장

- **target 위치**: `spec-draft-thread-followups.md` §6 — `output.items / output.rows / output.data / output.rendered` 확정
- **관련 plan 상황**: `plan/in-progress/node-output-redesign/` 계획에 carousel·table·chart 노드가 포함되어 있으며, 해당 plan은 노드별 output 필드 개선안을 작성 중
- **상세**: node-output-redesign plan이 "conventions 자체는 변경하지 않는다"고 명시하므로 CRITICAL은 아니다. 다만 W6으로 Principle 8.2를 확정하면 이후 node-output-redesign 산출물이 해당 필드명을 기준으로 작성될 것이므로, 기존 carousel/table/chart spec과 사전 정합 확인이 좋다.
- **제안**: 각 노드 spec(`spec/4-nodes/2-presentation/`)의 현행 `output` 필드명이 W6의 `output.items / output.rows / output.totalRows / output.data / output.rendered`와 이미 일치하는지 brief 검토 후 확정.

---

## 요약

CRITICAL 없음. 두 개의 WARNING — W1(교체 블록 중복 행)과 W5(번호 재정리 내부 모순) — 이 spec write 전 수정이 필요한 명확한 오기다. W4는 dangling cross-link로 plan 문서 생성 또는 표현 수정으로 해소 가능하다. 두 INFO는 사전 확인을 권장하나 차단 요인은 아니다. Worktree 충돌 없음 — 세 파일 모두 `conversation-thread-e509c5` 단일 worktree에서 수정되며 node-output-redesign plan은 conventions 비수정 원칙으로 충돌에서 제외된다.

## 위험도

**MEDIUM** — W1·W5 오기가 spec에 반영되면 향후 구현자나 다른 spec 참조 시 혼란이 발생할 수 있으나, spec write 직전 수정 가능한 수준이다.
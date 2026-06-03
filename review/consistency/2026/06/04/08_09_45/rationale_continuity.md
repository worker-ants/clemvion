# Rationale 연속성 검토 결과

검토 범위: `spec/4-nodes/3-ai/` (구현 완료 후 --impl-done, diff-base=origin/main)
검토 대상 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/ai-context-memory-9c7e6e/spec/4-nodes/3-ai/0-common.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/ai-context-memory-9c7e6e/spec/4-nodes/3-ai/1-ai-agent.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/ai-context-memory-9c7e6e/spec/4-nodes/3-ai/3-information-extractor.md`

---

## 발견사항

### 1. INFO: §12.10 에서 v1/v2 경계 번복 Rationale 은 있으나 conversation-thread spec §7 과 표현 불일치

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.10 (conversation-thread v1/v2 경계 번복의 근거)
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.1 v1/v2 경계표 ("token-aware cap·DB 컬럼은 v2"), `spec/conventions/conversation-thread.md` §7 v2 로드맵
- **상세**: §12.10 이 번복 근거를 상세히 기술하고 있으므로 "무근거 번복" 에 해당하지 않는다. 단, §12.10 이 "번복이 아니라 합의된 실현" 이라고 표현하지만, `token-aware cap` 항목의 v2 잔존 여부가 `spec/conventions/conversation-thread.md §7` 에서 `token-approximate` 방식과 `tokenizer-exact` 방식으로 상세 분리된 증거를 확인하기 어렵다. §12.10 에서는 "부분 실현" 이라고 표기했다고 언급하나, conversation-thread §7 에서 그 분리 표기가 실제로 반영되었는지 여부는 본 검토에서 직접 확인 범위 밖이다. §12.10 자체의 Rationale 은 충분하게 기술되어 있다.
- **제안**: 정보 제공 수준. `spec/conventions/conversation-thread.md §7` 에서 "Token-aware cap" 항목이 "token-approximate (부분 실현, v1)" 과 "tokenizer-exact (v3 유보)" 으로 실제 분리되어 있는지 확인하고, 미분리 시 §7 갱신 권장.

---

### 2. INFO: §12.12 기각 대안 (`summaryModel` 별도 필드) 이 기각 근거와 함께 명시되나 v2 로드맵 링크 대칭 확인 필요

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.12
- **과거 결정 출처**: 동일 §12.12 (기각 대안 명시), `spec/conventions/conversation-thread.md §7` v2 로드맵
- **상세**: `summaryModel` 별도 필드는 §12.12 에서 v1 기각 + v2 로드맵 유보가 명시되었다. 기각 근거도 충분하다. 합의 원칙 위반은 없다.
- **제안**: 적합. 추가 조치 불필요.

---

### 3. INFO: `KB 검색 prefill 금지` 원칙이 target 에서 지켜지고 있음 확인

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §2, `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 1.b
- **과거 결정 출처**: `spec/4-nodes/3-ai/0-common.md` §2 ("KB 검색은 LLM 의 능동 호출 시에만 실행되며 prefill 하지 않는다"), `spec/5-system/9-rag-search.md` §2 — 기존 invariant
- **상세**: §6.1 단계 1.b "KB 검색은 LLM 의 능동 호출 시에만 실행되며 prefill 하지 않음" 이 신규 내용과 충돌 없이 유지된다. `memoryStrategy: 'persistent'` 의 회수 블록은 `agent_memory` 에서의 회수로, KB prefill 과는 명확히 다른 경로이며 Spec 의 `ragTopK`/`ragThreshold` 와 독립된 `memoryTopK`/`memoryThreshold` 로 설계되어 두 경로를 혼동하지 않도록 되어 있다.
- **제안**: 적합. 추가 조치 불필요.

---

### 4. INFO: `render_form` 에서 `rendered: false` 기각 대안이 Rationale 에 명시적으로 기록됨 — 연속성 보장

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.6 "기각된 추가 필드"
- **과거 결정 출처**: 동일 §12.6
- **상세**: `rendered: false` (display-only 의 `rendered: true` 와 키 충돌 위험) 및 `status: 'form_submitted'` (기존 `type` 키와 중복) 두 대안이 기각 근거와 함께 명시되어 있다. 향후 이 두 필드를 다시 도입하려 할 경우 참고 가능.
- **제안**: 적합. Rationale 기록 충분.

---

### 5. INFO: `contextScope` enum 에 `auto` 확장 대안이 기각되고 `memoryStrategy` 별도 필드 채택 — Rationale §12.9 에 명시

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.9, `spec/4-nodes/3-ai/0-common.md` §10
- **과거 결정 출처**: §12.9 (기각 대안: `contextScope` enum 에 `auto` 값 추가)
- **상세**: `contextScope` enum 에 `auto` 를 끼워넣는 방식이 명시적으로 기각되었고, 별도 1급 필드 `memoryStrategy` 를 채택한 근거가 §12.9 에 충분히 기술되어 있다. target 문서는 이 결정에 부합하며 `contextScope` enum 에 `auto` 가 추가된 흔적이 없다.
- **제안**: 적합.

---

### 6. INFO: Presentation Tool 의 "워크플로 그래프 분기 흉내 금지" 원칙이 target 에서 유지됨

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §4.1, §12.4
- **과거 결정 출처**: §12.4 ("Render 결과의 워크플로 분기 흉내 (버튼 클릭 → 다른 출력 포트) 는 `cond_*` 와 책임이 중복돼 배제")
- **상세**: `render_*` 도구의 버튼 클릭이 AI Agent 의 출력 포트 분기에 영향을 주지 않는다는 원칙이 §4.1 의 역할 분리 섹션에서 명시적으로 유지되고 있다. v2 로드맵에 "render_* 페이로드를 별도 출력 포트로 라우팅하는 옵션" 이 예정되어 있으나, 이는 사용자 명시 opt-in 조건부이며 기각된 원칙의 재도입이 아니라 확장이다.
- **제안**: 적합.

---

### 7. INFO: `_resumeCheckpoint` TTL 없음 결정 — Rationale 미기술이나 §7.4 비교표에서 관련 invariant 확인 가능

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 `_resumeState/_resumeCheckpoint/_retryState` 생명주기 비교표
- **과거 결정 출처**: 동일 §7.4 비교표 (TTL(`expiresAt`) 없음 명시)
- **상세**: `_resumeCheckpoint` 에 TTL 을 두지 않는 것은 "대화는 장시간 후에도 재개 가능" 이라는 설계 원칙에서 비롯된다. 이 결정 자체가 Rationale 섹션에 별도로 기술되지 않고 비교표 안 주석으로만 기록된다. 이후 "장기 대화의 checkpoint 만료 정책 논의" 가 있을 경우 별도 항목으로 Rationale 에 추가하는 것이 좋다.
- **제안**: 현재 수준은 무난하나, checkpoint TTL 정책 결정 배경을 §12.x 로 분리 기록하면 향후 정책 변경 시 연속성이 높아진다.

---

## 요약

`spec/4-nodes/3-ai/` target 문서는 기존 Rationale 에서 명시적으로 기각된 대안 (KB prefill, contextScope enum `auto` 확장, render_form `rendered: false` 가드 필드, `summaryModel` 별도 필드, 워크플로 분기 흉내 render_* 등)을 재도입하지 않으며, 합의된 설계 원칙(KB LLM-driven pull, prefill 금지; render_* vs cond_* 역할 분리; memory 관리 축과 범위 축의 분리; schema-violation silent fallback + meta 누적)을 모두 준수하고 있다. v1/v2 경계 번복에 해당하는 `memoryStrategy` 도입은 §12.10 에 충분한 근거가 기술되었다. INFO 수준의 보완 제안으로 `conversation-thread §7` 의 token-aware cap 분리 표기 확인 및 `_resumeCheckpoint` TTL 무설정 결정의 Rationale 별도 기록이 있다.

---

## 위험도

NONE

STATUS: SUCCESS

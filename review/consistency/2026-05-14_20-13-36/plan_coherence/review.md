## Plan Coherence Check — `spec/conventions/` (--impl-prep)

검토 대상: `spec/conventions/` 5개 문서
기준 plan: `plan/in-progress/` 7개 문서

---

### 발견사항

---

**[WARNING] `ai_tool` ConversationTurnSource 명칭 — 향후 rewrite 결정 결과에 따른 잠재 충돌**

- **target 위치**: `spec/conventions/conversation-thread.md §1.1` — `ai_tool: "KB / MCP / condition tool 결과 (opt-in 시 includeToolTurns: true)"`
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "결정 기록 TBD" + `plan/in-progress/conversation-thread.md` W8
- **상세**: tool rewrite plan 은 "결정 (c) AI Tool 노드 신설 채택 시 `ai_tool` 명칭을 `tool_result` / `agent_tool` 로 재검토" 를 미해결 상태로 남겨 두었다. 현재 `spec/conventions/conversation-thread.md` 에는 `ai_tool` 이 공식 정의로 기록되어 있어, rewrite 결정 (c) 를 채택하면 convention 문서 변경이 필요하다. conversation-thread plan 의 W8 이 이를 추적하고 있으나 아직 결정이 없다.
- **제안**: tool rewrite plan §1 "도구 등록 모델" 결정 직후, W8 에 따른 `ai_tool` 명칭 고정 여부를 conversation-thread spec 에 반영하거나 "v1 고정, v2 재검토" 를 명시 추가. 본 impl-prep 을 block 할 Critical 은 아니나, rewrite plan 착수 직전 이 항목을 먼저 해소해야 한다.

---

**[INFO] `conversation-thread.md` plan — 모든 Phase ✅ 완료이나 `in-progress/` 잔류**

- **target 위치**: `plan/in-progress/conversation-thread.md` frontmatter + 체크리스트
- **관련 plan**: 동일 plan
- **상세**: Phase 1~11 전체 ✅, W1~W6+I1 Phase 9 commit 으로 정정 완료, W7 (DEFAULT_THREAD_ID 상수) Phase 2 ✅ 포함, W8 `ai_tool` 재검토는 tool rewrite 결정 의존으로 명시적 deferred. 미체크 항목 없음. 단, plan 파일이 아직 `in-progress/` 에 있어 PR merge 이후 `git mv` 가 누락되면 CLAUDE.md 의 "완료 즉시 이동" 규약에 어긋난다.
- **제안**: PR merge 시 `git mv plan/in-progress/conversation-thread.md plan/complete/conversation-thread.md` 로 이동.

---

**[INFO] `background-monitoring-api.md` — spec 편집 순서 의존성 (별도 action 불필요)**

- **target 위치**: `spec/5-system/4-execution-engine.md §3.3` (spec/conventions/ 외부)
- **관련 plan**: `plan/in-progress/background-monitoring-api.md` §4 "순서 의존성"
- **상세**: background-monitoring plan 자체에 "conversation-thread-e509c5 merge 이후 spec 편집" 이 명시되어 있다. spec/conventions/ 대상 문서와는 직접 충돌 없음. 본 worktree merge 후 background plan 재착수 시 이 조건이 자동 해소된다.

---

**[INFO] `node-output.md` follow-up W3·W6 — 이미 반영 확인**

- **target 위치**: `spec/conventions/node-output.md` Principle 2 LLM 계열 + Principle 8.2 프레젠테이션 뷰 행
- **관련 plan**: `plan/in-progress/conversation-thread.md` W3·W6
- **상세**: W3 (`meta.contextInjection?` LLM 계열 추가) 는 Principle 2 표에 이미 포함됨. W6 (프레젠테이션 뷰 행을 `output.view` 래퍼 없이 실제 필드명으로 교체) 는 Phase 9 commit 에서 처리되어 현행 spec 에 반영됨. 추가 작업 불필요.

---

### 요약

`spec/conventions/` 5개 문서는 진행 중 plan 들과 실질적인 충돌이 없다. 유일한 비-trivial 위험은 `ai-agent-tool-connection-rewrite.md` 의 설계 결정 (c) 채택 시 `ai_tool` ConversationTurnSource 명칭 변경이 필요해지는 경우로, W8 follow-up 이 이를 추적하고 있어 현 impl-prep 을 block 하지 않는다. 나머지 사항은 sequencing note 와 plan 이동 리마인더 수준이다.

### 위험도

**LOW**
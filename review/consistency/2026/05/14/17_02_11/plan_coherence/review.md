plan/in-progress 내 다른 진행 중 plan 들과 target 문서의 정합성을 점검합니다.

---

### 발견사항

---

**[WARNING-1] `spec/4-nodes/3-ai/1-ai-agent.md §1` 이중 수정 — 순서 의존성 미명시**

- **target 위치**: 변경 범위 표 `spec/4-nodes/3-ai/1-ai-agent.md` 행, §3.1 §1 설정 표 변경
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 "Spec 작성" — 동일 §1 표에 `toolNodeIds`/`toolOverrides` 및 도구 관련 config 필드 복원 예정
- **상세**: target 은 §1 config 표에 5개 신규 필드 추가 + `conversationHistory`/`historyCount` DEPRECATED 처리를 한다. `ai-agent-tool-connection-rewrite` 도 추후 같은 §1 표를 수정한다. 작업이 순차 진행되면 실제 충돌은 없지만, `ai-agent-tool-connection-rewrite` plan 에 "conversation-thread spec 이 §1 표를 먼저 수정함 — 해당 변경을 베이스로 작업할 것"이 명시되어 있지 않다. 더불어 target §2.3에 "`tool_*` 도구 결과의 thread 누적 여부는 v2 결정으로 미룸"이 자체 메모로만 남아 있고, `ai-agent-tool-connection-rewrite` plan 의존성 섹션에는 이 v2 경계가 기록되어 있지 않다.
- **제안**: `ai-agent-tool-connection-rewrite.md` §의존성·리스크 또는 §결정 기록에 두 항목 추가 — (1) "conversation-thread spec 이 §1 표를 먼저 개정하므로 해당 변경 merge 이후에 착수" (2) "일반 `tool_*` turn 누적 정책은 conversation-thread v2 결정에서 다뤄짐 — 본 재설계에서 별도 결정 불필요".

---

**[WARNING-2] `spec/5-system/4-execution-engine.md §3.3` 이중 수정 — background-monitoring-api 와 순서 의존성 미명시**

- **target 위치**: §4.3 "§3.3 Background — snapshot 항목 보강"
- **관련 plan**: `plan/in-progress/background-monitoring-api.md` §4 "spec 갱신" — 같은 `spec/5-system/4-execution-engine.md §3.3` Background 섹션에 모니터링 API 포인터 추가 예정
- **상세**: target 은 §3.3에 `conversationThread shallow copy` 문구를 삽입한다. `background-monitoring-api` plan 도 동일 §3.3 영역을 나중에 수정할 때, target 이 이미 삽입한 문구를 기반으로 작업해야 한다. 순차 진행이면 충돌 없지만 plan 어느 쪽에도 이 순서 의존성이 명시되어 있지 않다.
- **제안**: `background-monitoring-api.md` §4 spec 갱신 항목에 주석 추가 — "execution-engine §3.3 은 conversation-thread spec (worktree: conversation-thread-e509c5) 에서 먼저 수정됨 — 기존 내용을 베이스로 편집할 것".

---

**[WARNING-3] `spec/conventions/node-output.md §4.5` 앵커 안정성 — node-output-redesign 개정 시 cross-link 위험**

- **target 위치**: §5 변경 — `node-output.md §4.5` `interaction.data` payload 표 아래 cross-link 1줄 추가
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` — conventions 자체는 변경하지 않는다고 명시했으나, "plan 검토 → 합의 → 별도 phase 에서 project-planner 가 spec 본문 갱신" 경로에서 `node-output.md` 개정이 포함될 가능성이 있음
- **상세**: target 이 추가한 cross-link는 `§4.5` 번호와 `interaction.data` 앵커에 의존한다. node-output-redesign 의 후속 적용 phase 에서 §4.5 위치·번호가 재편되면 cross-link 가 끊어질 수 있다.
- **제안**: node-output-redesign 이 `node-output.md` 개정 phase 로 진입할 때 §4.5 cross-link 재검증을 체크리스트에 추가. target 자체는 현재 low-risk 로 진행 무방.

---

**[INFO-1] `spec/4-nodes/3-ai/1-ai-agent.md` DEPRECATED 필드 — node-output-redesign 초안과 정합 검토 필요**

- **target 위치**: §3.1 `conversationHistory`/`historyCount` DEPRECATED 표기
- **관련 plan**: `plan/in-progress/node-output-redesign/ai-agent.md` (초안 단계, spec 즉시 반영 아님)
- **상세**: node-output-redesign 의 ai-agent.md 초안이 §1 config 표를 재검토할 때 DEPRECATED 표기된 두 필드를 인식하지 못하면 해당 필드를 활성 필드로 잘못 분류하거나 제거 제안을 낼 수 있다.
- **제안**: node-output-redesign `ai-agent.md` 초안에 메모 추가 — "`conversationHistory`/`historyCount` 는 conversation-thread spec(worktree: conversation-thread-e509c5) 에서 DEPRECATED 처리됨 — v2 schema 제거 전까지 표에 잔존".

---

**[INFO-2] `spec/1-data-model.md §2.14` `interactionType` enum 정정 — DB 마이그레이션 필요 여부 미명시**

- **target 위치**: §9 "`form_submit` → `form_submitted` 정정"
- **관련 plan**: 어떤 in-progress plan 에도 기존 NodeExecution `interaction_data` DB row 의 enum 값 마이그레이션이 명시되어 있지 않음
- **상세**: 이 변경이 spec 문서 표기 동기화만인지 (코드·DB 가 이미 `form_submitted` 를 사용 중), 아니면 기존 저장된 `form_submit` 값의 마이그레이션도 수반하는지 불명확. 후자라면 이력 화면·API 응답에서 불일치가 발생할 수 있다.
- **제안**: target 의 §9 또는 `conversation-thread.md` 개발자 plan 에 항목 추가 — "interactionType DB 마이그레이션 필요 여부 확인: 코드가 이미 `form_submitted` 를 생성 중이면 spec-only 정정, 기존 row 에 `form_submit` 잔존 시 one-off 마이그레이션 스크립트 필요".

---

### 요약

target 의 핵심 변경(ConversationThread 신규 컨벤션 + AI Agent 5필드 추가 + 실행 엔진 컨텍스트 확장)은 전반적으로 plan 간 정합이 양호하다. 동일 worktree(`conversation-thread-e509c5`) 안에서 spec draft 와 개발자 plan 이 Phase 1-8 로 명확히 직렬화되어 있고, 핵심 설계 결정도 이미 확정되어 있다. 다만 동일 spec 파일(`1-ai-agent.md`, `execution-engine.md §3.3`)을 후속에서 수정하는 두 plan(`ai-agent-tool-connection-rewrite`, `background-monitoring-api`) 이 현 변경을 베이스로 삼아야 한다는 순서 의존성이 plan 문서에 명시되어 있지 않아 WARNING 수준이다. CRITICAL 위배는 없으므로 spec 작성 차단 사유는 없다.

### 위험도

**LOW** — CRITICAL 없음. WARNING 2건은 후속 plan 이 현 변경 이후에 순차 진행만 보장되면 실제 충돌이 발생하지 않는 수준. plan 문서 2곳(ai-agent-tool-connection-rewrite, background-monitoring-api)에 순서 의존성 메모 추가 권장.
필요한 파일들을 확인했습니다. 분석 결과를 정리합니다.

---

## Plan Coherence Check 결과

### 발견사항

---

**[WARNING] `spec/4-nodes/3-ai/1-ai-agent.md` 미래 병렬 수정 위험**

- **target 위치**: spec draft §3 (`conversationHistory` DEPRECATED, 신규 5필드 추가)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 — "Spec 작성" 단계에서 동일 파일의 §1 설정 표를 수정 예정 (`toolNodeIds`/`toolOverrides` 필드 복원, Tool Area 명세)
- **상세**: 두 plan 모두 `spec/4-nodes/3-ai/1-ai-agent.md` §1 설정 표를 수정 대상으로 삼는다. 현재 `ai-agent-tool-connection-rewrite.md`는 frontmatter/worktree 미설정으로 활성 상태가 아니므로 지금 당장의 충돌은 없다. 그러나 이 spec draft 반영 후 도구 연결 재설계가 활성화될 때, 필드 행 위치·DEPRECATED 마커·`Source of truth` 주석 충돌이 발생할 수 있다.
- **제안**: `ai-agent-tool-connection-rewrite.md` §1 "디자인 결정" 완료 시점에, 이 spec draft가 추가한 신규 5필드와의 위치 조율을 명시적으로 체크리스트에 추가할 것.

---

**[WARNING] `node-output-redesign/ai-agent.md` 의 `output.messages` 통일 제안과 영속화 가정 충돌 가능성**

- **target 위치**: spec draft §4 "영속화" — "`output.messages` / `output.result.messages` (AI 노드) 가 SoT"
- **관련 plan**: `plan/in-progress/node-output-redesign/ai-agent.md` §개선안 — "waiting/resumed 시 `output.messages` ↔ 종결 시 `output.result.messages` 의 경로 통일 검토"
- **상세**: 이 spec draft는 NodeExecution 의 `output.messages`(waiting/resumed)와 `output.result.messages`(종결)를 **분산 SoT**로 명시한다. node-output-redesign의 ai-agent 분석은 이 두 경로의 통일을 제안한다(`output.result.messages`로 단일화 또는 `output.messages`를 종결에도 병존). 만약 이 제안이 승인되어 spec에 반영되면, conversation-thread의 영속화 섹션("재구성 가능한 derived view")이 잘못된 필드 경로를 참조하게 된다.
- **제안**: node-output-redesign의 ai-agent 개선안이 합의될 때 conversation-thread §4 영속화 섹션의 SoT 경로 기술을 함께 점검하도록 `plan/in-progress/node-output-redesign/README.md`에 follow-up 항목을 추가할 것.

---

**[INFO] `spec/5-system/5-expression-language.md` 섹션 번호 오류**

- **target 위치**: spec draft §6.2 — "`§4.5 $thread` 속성 신설 (§4.4 다음)"
- **상세**: 현재 `spec/5-system/5-expression-language.md`의 §4 내장 참조 변수 하위는 §4.1(변수 목록), §4.2(`$execution`), §4.3(`$loop`)이며 §4.4가 없다. 신설 섹션을 §4.5로 표기하면 §4.4가 공란으로 남는다. §4.4로 번호를 정정하거나, §4.4를 별도 섹션으로 먼저 추가해야 한다. plan 정합성 문제는 아니지만, spec 작성 시 번호 정정이 필요하다.
- **제안**: spec 반영 시 `$thread` 속성 섹션을 §4.4로 작성할 것.

---

**[INFO] `plan/in-progress/conversation-thread.md` Phase 1 체크박스 갱신 필요**

- **target 위치**: N/A (spec draft 통과 후 developer plan 갱신)
- **관련 plan**: `plan/in-progress/conversation-thread.md` Phase 1 — 7개 spec 파일 관련 체크박스 전부 `[ ]`
- **상세**: 이 spec draft가 consistency-check 통과 후 spec/ 본문에 반영되면 Phase 1 체크박스 7개를 `[x]`로 갱신해야 Phase 2(developer) 착수가 명확해진다. 정상 워크플로이나 누락 시 plan 분류 기준("미체크 체크박스가 하나라도 있으면 in-progress")에 의해 Phase 2 이후가 진행되어도 Phase 1 항목이 계속 미완으로 표기된다.
- **제안**: spec 반영 직후 `plan/in-progress/conversation-thread.md` Phase 1 전체를 `[x]`로 갱신할 것.

---

**[INFO] 동시 진행 plan 3종의 frontmatter 부재 — plan_coherence 자동 검출 취약**

- **관련 plan**: `ai-agent-tool-connection-rewrite.md`, `background-monitoring-api.md`, `merge-p2-async-fanin.md` — 모두 frontmatter(`worktree`, `started`, `owner`) 없음
- **상세**: spec draft §consistency-check 포인트 #5에서 이미 인지됨. `background-monitoring-api.md`는 `spec/5-system/4-execution-engine.md` §3.3을 추후 수정할 가능성이 있으며, 이 spec draft도 동일 섹션을 수정한다. 현재는 해당 plan에 활성 worktree가 없어 충돌 없음.

---

### 요약

spec draft는 구조적으로 잘 설계되어 있으며, 동시 활성 worktree 간 실질적 충돌은 없다. WARNING 2건은 모두 **미래 잠재 충돌**로, 현 시점에서는 차단 사유가 되지 않는다. `node-output-redesign`의 `output.messages` 통일 제안이 아직 합의 단계이고 `ai-agent-tool-connection-rewrite`의 디자인 결정이 미완인 상태이므로, 이 spec draft를 지금 반영하는 것이 안전하다. spec 반영 후 나열한 INFO 항목들의 후속 조치(섹션 번호 §4.4 정정, Phase 1 체크박스 갱신)를 놓치지 않으면 된다.

### 위험도

**LOW** — Critical 0건, Warning 2건(미래 잠재 충돌), Info 3건
# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` (구현 착수 전 `--impl-prep` 모드)
검토 기준: target 문서(`spec/5-system/`)가 다른 spec 영역과 충돌하는지 분석

---

## 발견사항

### [WARNING] §3.2 body 서브그래프 제약에서 Parallel 미명시 — 선형 스택 불변식과 표면 불일치

- **target 위치**: `spec/5-system/4-execution-engine.md` 행 928 (선형 스택 불변식), 행 1308 (Rationale exec-park D6), 행 416/418 (Phase B 구현 메모)
- **충돌 대상**: `spec/5-system/4-execution-engine.md` §3.2 `body 서브그래프 제약` (행 297-302), 행 217 (`컨테이너 body(Loop / ForEach / Map)는 blocking 노드... 금지`)
- **상세**: 선형 스택 불변식 및 exec-park D6 Rationale 에서는 `컨테이너(Loop/ForEach/Map/Parallel) body 의 blocking 은 §3.2 로 금지` 라고 Parallel 을 포함해 서술하나, 실제 §3.2 의 `body 서브그래프 제약` 본문(행 300)과 행 217 의 서술은 `Loop / ForEach / Map` 만 명시한다. Parallel 의 blocking 금지는 `spec/4-nodes/1-logic/10-parallel.md §168` 에 별도 정의(`PARALLEL_INVALID_CHILD`)되어 있고 `spec/4-nodes/_product-overview.md §135`에서도 확인되므로 사실은 일치하나, §3.2 cross-reference 가 Parallel 을 포함하지 않아 문서 독자가 선형 스택 불변식의 전제를 검증하려 할 때 §3.2 만으로는 Parallel 포함 여부를 확인할 수 없는 불완전 cross-reference 상태다.
- **제안**: `spec/5-system/4-execution-engine.md` 행 217 의 `컨테이너 body(Loop / ForEach / Map)는` 을 `컨테이너 body(Loop / ForEach / Map / Parallel 분기)는` 으로 수정하고, §3.2 body 서브그래프 제약 헤더를 Parallel 분기에도 동일 제약이 적용됨을 명시하도록 보완하거나, 선형 스택 불변식(행 928)에 `§3.2 및 spec/4-nodes/1-logic/10-parallel.md §PARALLEL_INVALID_CHILD` 로 dual cross-ref 를 추가할 것.

---

### [WARNING] `Execution.resume_call_stack` (V087) — data-model 과 execution-engine 서술 범위 차이

- **target 위치**: `spec/5-system/4-execution-engine.md` §6.2 (행 743 — `waiting_for_input 진입 시` 저장 매체 표에서 `resume_call_stack` 구현 완료 명시), §7.5 frame-by-frame 재진입 절차
- **충돌 대상**: `spec/1-data-model.md` §2.13 Execution 컬럼 행 (행 467, `resume_call_stack`)
- **상세**: `spec/1-data-model.md §2.13`(행 467)에는 `resume_call_stack` 에 대해 `**구현·사용 중** — exec-park D6, PR-B2b 2026-06-06` 이라고 구현 완료 표식이 있고, `spec/5-system/4-execution-engine.md §6.2` 행 743 도 동일한 완료 표식을 가진다. 따라서 두 문서 간 데이터 모델 정의 자체는 일관성 있게 일치한다. 단, data-model 의 `frames` shape(`{version, frames:[{workflowId, invokerNodeId, recursionDepth}]}`)이 execution-engine §6.2 `(e)` 항과 §7.5 의 서술과 정합하나, `invokerNodeId` 의 의미("부모 그래프의 Workflow Node id" — plan 파일 `plan/in-progress/exec-park-durable-resume.md` L197)가 두 spec 모두에서 충분히 명시되어 있지 않아 구현 시 오해 소지가 있다. 이 필드의 의미(executeInline 호출자 nodeId vs. 중첩 sub-workflow 의 내부 nodeId 등)를 spec/5-system 에 한 줄 추가로 명확화하면 충분하다.
- **제안**: `spec/5-system/4-execution-engine.md §7.5` 의 frame-by-frame 재진입 절차 또는 §6.2 (e) 에 `invokerNodeId = 부모 그래프에서 Workflow(서브워크플로 호출) 노드의 id (InlineExecutionOptions.invokerNodeId 로 전달)` 를 명시. data-model 의 동일 행에도 brief cross-ref 추가 권장.

---

### [INFO] `spec/5-system/4-execution-engine.md` §1.1 `failed → running` 전이 설명과 `spec/5-system/6-websocket-protocol.md` `retry_last_turn` 의 cross-reference

- **target 위치**: `spec/5-system/4-execution-engine.md` §1.1 상태 전이표 (행 65 — `failed → running` 전이), §1.3 `_retryState` 설명
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2 실행 제어 명령`
- **상세**: `spec/5-system/4-execution-engine.md` §1.1 은 `failed → running` 전이를 `execution.retry_last_turn` WS 명령과 연결하고 `allowRetryReentry opt-in` 을 언급한다. `spec/5-system/6-websocket-protocol.md §4.2` 는 `execution.retry_last_turn` 명령을 정의한다. 이 두 문서 간 직접 모순은 없으나, execution-engine §1.1 행 65 의 "replay 가 RUNNING 으로 도는 중 도착한 cancel 은 graceful no-op" 서술과 §12.2 `cancelParkedExecution` 의 WAITING 가드 설명이 WS protocol spec 에 명시적으로 반영되어 있지 않다. 구현에는 문제없으나 `spec/5-system/6-websocket-protocol.md §4.2` 에 `retry_last_turn` 처리 중 cancel 의 no-op 동작을 brief note 로 추가하면 완전한 양방향 일관성이 확보된다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.2` 의 `execution.retry_last_turn` 항목에 "RUNNING replay 중 cancel 은 graceful no-op — 다음 `waiting_for_input` park 에서 발효 (4-execution-engine §1.1)" cross-ref 한 줄 추가. 낮은 우선순위.

---

### [INFO] `spec/5-system/4-execution-engine.md §1.3` — `ai_agent || information_extractor` 확장 후 `spec/4-nodes/3-ai/3-information-extractor.md` cross-reference 동기화 필요

- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` `_resumeCheckpoint` 보존 예외 (행 122-128) — `ai_agent 와 information_extractor` 모두 명시됨
- **충돌 대상**: `spec/4-nodes/3-ai/3-information-extractor.md`
- **상세**: plan 파일(`exec-park-durable-resume.md A2b`)에 따르면 A2b 작업 시 `spec/4-nodes/3-ai/3-information-extractor.md §357` 와 `spec/4-nodes/3-ai/1-ai-agent.md §703` 의 `ai_agent 한정` 문구 3곳을 갱신 완료했다고 명시되어 있다. `spec/5-system/4-execution-engine.md §1.3` 은 이미 `ai_agent 와 information_extractor` 두 핸들러를 포함해 서술하므로 target 내 모순은 없다. 단, 이 spec 이 다른 AI 노드 spec 과 완전히 동기화되었는지 구현 착수 전 확인 권장.
- **제안**: 구현 착수 전 `spec/4-nodes/3-ai/3-information-extractor.md §357` 와 `spec/4-nodes/3-ai/1-ai-agent.md §703` 가 `ai_agent || information_extractor` 표현으로 갱신되어 있는지 확인. plan 에 따르면 이미 완료됐으므로 코드 레벨 리뷰 항목으로 처리 가능.

---

### [INFO] `spec/5-system/4-execution-engine.md` §7.5 `RESUME_CHECKPOINT_MISSING` 분류 — `spec/1-data-model.md §2.13` Execution.error 어휘와 일관성

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5` rehydration 실패 코드 (`RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`)
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution.error` 코드 어휘 (행 526)
- **상세**: `spec/1-data-model.md §2.13` 행 526 의 `Execution.error.code` 어휘 목록에 `RESUME_FAILED / RESUME_CHECKPOINT_MISSING / RESUME_INCOMPATIBLE_STATE` 세 코드가 명시되어 있으며 `spec/5-system/4-execution-engine.md §7.5` 도 동일 코드를 사용한다. 직접 모순 없음. 단 data-model 의 해당 행이 매우 길고 여러 코드가 함께 열거되어 있어 navigation 이 어렵다. INFO 수준 유지.
- **제안**: 별도 조치 불요. 향후 error-codes 어휘 테이블 정비 시 함께 검토.

---

## 요약

`spec/5-system/` 내 target 문서들(1-auth, 10-graph-rag, 11-mcp-client 및 그 연관 spec)은 상호 간, 그리고 `spec/1-data-model.md`, `spec/0-overview.md` 와 전반적으로 잘 정렬되어 있다. exec-park D6 관련 변경사항(`Execution.resume_call_stack` V087, frame-by-frame rehydration, full B3 제거)은 data-model 과 execution-engine spec 양쪽에 일관되게 반영됐다. 주요 WARNING 은 두 가지다: (1) §3.2 body 서브그래프 제약 본문이 `Parallel` 을 명시하지 않아 선형 스택 불변식의 전제를 §3.2 만으로 검증할 수 없는 incomplete cross-reference, (2) `resume_call_stack.frames[].invokerNodeId` 의 의미가 spec 에 충분히 서술되지 않아 구현 시 오해 소지. 두 WARNING 모두 실제 동작 모순이 아닌 문서 완전성 이슈이며, CRITICAL 충돌은 발견되지 않았다.

## 위험도

LOW

---

STATUS: SUCCESS

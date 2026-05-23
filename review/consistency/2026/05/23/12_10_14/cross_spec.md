# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-prep`
- 검토 대상: `spec/4-nodes/`
- 검토 일시: 2026-05-23

---

## 발견사항

### [INFO] Node.category 열거값에 `trigger` 누락
- target 위치: `spec/4-nodes/0-overview.md §1.2 노드 정의 속성` — `category` 필드에 `trigger / logic / flow / ai / integration / data / presentation` 기술
- 충돌 대상: `spec/1-data-model.md §2.6 Node.category` — `logic / flow / ai / integration / data / presentation` (trigger 없음)
- 상세: `spec/4-nodes/0-overview.md §1.2` 의 Node Definition 속성 표는 `category` Enum 으로 `trigger` 를 포함해 7개를 나열한다. 그러나 `spec/1-data-model.md §2.6` 의 `Node.category` 필드는 `logic / flow / ai / integration / data / presentation` 6개만 열거하고 `trigger` 를 포함하지 않는다. `Node.type` 전체 목록에 `manual_trigger` 가 `trigger` 카테고리로 기재되어 있으므로 데이터모델 열거값에 `trigger` 가 실제로 존재할 가능성이 높으나, 두 문서가 동일하게 명시하지 않아 구현 시 혼동 여지가 있다.
- 제안: `spec/1-data-model.md §2.6` 의 `category` Enum 설명에 `trigger` 값을 추가하거나, `spec/4-nodes/0-overview.md §1.2` 에서 Node Instance 다이어그램과 정의 표의 category 열거 목록을 데이터 모델과 일치시킨다.

---

### [INFO] container_id 가 참조할 수 있는 노드 타입 — `background` 누락 경고
- target 위치: `spec/1-data-model.md §2.6 Node` — `container_id` 제약조건: `"container_id가 참조하는 노드의 type은 loop, foreach, map 중 하나여야 함 (Background는 도입 시 추가)"`
- 충돌 대상: `spec/4-nodes/1-logic/12-background.md §3.2` / `spec/4-nodes/1-logic/0-common.md §3` — Background 노드는 `containerId` 멤버십 패턴을 **사용하지 않는다** 고 명시 (`background` 출력 포트 엣지로 본문 식별)
- 상세: 데이터 모델의 `container_id` 제약조건 주석에 "Background는 도입 시 추가" 라는 미완 표현이 남아있다. 그러나 Background 노드 spec 은 이미 `containerId` 멤버십 패턴을 쓰지 않는다고 확정되어 있다 (`spec/4-nodes/1-logic/0-common.md §3` 비고, `spec/4-nodes/1-logic/12-background.md §3.2`). 결과적으로 데이터 모델의 `container_id` 제약조건 주석이 오해를 유발할 수 있다.
- 제안: `spec/1-data-model.md §2.6` 의 `container_id` 제약조건 주석에서 `(Background는 도입 시 추가)` 를 제거하고, Background 가 `containerId` 를 사용하지 않는다는 것을 명시한다.

---

### [INFO] Parallel 노드의 `count` 필드 — 다른 컨테이너 노드와의 불일치 명명
- target 위치: `spec/4-nodes/1-logic/10-parallel.md §5.2` — "`count` 필드는 제거됨 (P1.1 직교성 — `branches.length` 가 SSOT)"
- 충돌 대상: `spec/4-nodes/1-logic/0-common.md §5 반복/분기 출력 구조` — `{ <컬렉션>, count }` 형태로 결과 내보냄. Loop `{ iterations, count }`, ForEach `{ items, count }`, Map `{ mapped, count }`, Parallel `{ branches, count }` 로 명시
- 상세: `spec/4-nodes/1-logic/0-common.md §5` 와 `§9.1 컨테이너 노드 핸들러 ↔ 엔진 오버라이트 컨트랙트` 표에는 Parallel 완료 시 output 이 `{ branches: [...], count }` 로 기재되어 있다. 반면 `spec/4-nodes/1-logic/10-parallel.md §5.2` 에는 `count` 필드 제거 결정이 명시되어 있고 실제 JSON 예시에도 `count` 가 없다. 두 문서가 다른 output shape 를 기술하고 있다. `0-common.md` 는 Parallel 을 포함한 모든 컨테이너에 `{ <컬렉션>, count }` 를 공통 규칙으로 선언하고 있으며, Parallel spec 문서만 예외를 적용하고 있어 공통 규약 문서와 개별 문서 간 모순이 존재한다.
- 제안: `spec/4-nodes/1-logic/0-common.md §5` 및 `§9.1` 표에서 Parallel 행의 완료 시점 output 컬럼을 `{ branches: [...] }` (`count` 없음) 로 수정하여 `10-parallel.md §5.2` 와 동기화한다. 또는 plan/in-progress/spec-drift-parallel-count.md 가 이를 추적 중이라면 구현 전 해소 여부를 확인한다.

---

### [INFO] `spec/1-data-model.md` `NodeExecution.interaction_data` 의 `interactionType` 열거값 불일치
- target 위치: `spec/4-nodes/6-presentation/0-common.md §3 Blocking Mode 실행 흐름 step 5` — `interactionType: "buttons"` 기술
- 충돌 대상: `spec/1-data-model.md §2.14 NodeExecution.interaction_data` — `interactionType: "form_submitted" | "button_click" | "button_continue"` 열거
- 상세: 데이터 모델의 `interaction_data` JSONB 필드 정의에는 `interactionType` 열거값이 `form_submitted / button_click / button_continue` 세 가지다. `spec/4-nodes/6-presentation/0-common.md §3 step 5` 에서 WS 이벤트 `execution.waiting_for_input` 의 `interactionType` 로 `"buttons"` 가 사용된다. `"buttons"` 는 `NodeExecution.interaction_data.interactionType` 의 열거값이 아니라 WS 이벤트 레벨의 값이므로 직접 충돌은 아니지만, 동일 필드명(`interactionType`)이 두 레이어에서 다른 값 집합을 사용하고 있어 구현 시 혼동 가능성이 있다. `plan/in-progress/ai-presentation-tools.md` 에서 `ai_form_render` 라는 새 interactionType 값을 추가하는 결정(#12)이 있으므로 이 변경이 NodeExecution.interaction_data 의 `interactionType` enum 에도 반영되어야 하는지 명확하지 않다.
- 제안: `spec/1-data-model.md §2.14` 의 `interaction_data` 설명에 WS 이벤트 레이어의 `interactionType` 값(`"buttons"`, `"ai_form_render"` 등) 과 NodeExecution 기록용 `interactionType` 값의 차이를 명확히 구분하거나, 두 레이어의 값 집합을 동기화한다.

---

### [INFO] Background 노드 `§8.5 WebSocket 채널` — `execution.background_run.completed` 에 `cancelled` 상태
- target 위치: `spec/4-nodes/1-logic/12-background.md §8.2 응답 스키마` — `status` 필드에 `'pending' | 'running' | 'completed' | 'failed'` 열거 (cancelled 없음)
- 충돌 대상: 같은 파일 `§8.5 WebSocket 채널` — `execution.background_run.completed` 이벤트 payload 에 `status: 'completed' | 'failed' | 'cancelled'` 포함
- 상세: `§8.2` REST GET 응답 스키마에는 `status` 가 4개 값(`pending / running / completed / failed`)이고 `cancelled` 는 "메인 Execution cancel 이 본문 run 으로 전파되는 흐름은 아직 없어 별도 `cancelled` 상태는 발행되지 않는다" 라고 명시한다. 그러나 `§8.5` WS 이벤트 payload 의 동일 `status` 필드에는 `'cancelled'` 값이 포함되어 있다. 같은 문서 내에서 두 섹션이 `status` 의 가능 값에 대해 모순된 정의를 제공하고 있다 — 이는 동일 파일 내부의 자기모순으로, 구현 시 어느 쪽을 따를지 불명확하다.
- 제안: `§8.5` WS payload 의 `status` 열거에서 `'cancelled'` 를 제거하고 `§8.2` 와 일치시키거나, `§8.2` 에 `'cancelled'` 상태를 추가하고 발행 조건을 명시한다.

---

### [WARNING] `spec/4-nodes/0-overview.md §2.6 Presentation 노드` 목록과 개별 spec 의 출력 포트 수 불일치
- target 위치: `spec/4-nodes/0-overview.md §2.6` — `form` 노드: `출력: 1`, `table/chart/template`: `출력: 1 (out) 또는 N (동적 버튼 포트)`, Carousel: `출력: 1 (out) 또는 N (동적 버튼 포트)`
- 충돌 대상: `spec/4-nodes/6-presentation/0-common.md §2 포트 토폴로지` — "버튼 설정 시 `out` 포트는 제거된다. link 타입 버튼만 존재할 경우 `continue` 포트가 `out` 을 대체한다"
- 상세: `spec/4-nodes/0-overview.md §2.6` 의 노드 목록 표에서 Carousel/Table/Chart/Template 의 출력 표기는 `1 (out) 또는 N (동적 버튼 포트)` 이다. 그런데 `spec/4-nodes/6-presentation/0-common.md §2` 에 따르면 버튼 설정 시 `out` 포트는 **제거**되며, link 타입만 있을 때는 `continue` 포트가 `out` 을 대체한다. 즉, 버튼이 있을 때 `out` 포트와 버튼 포트가 공존하는 것이 아니라 `out` 이 제거된다. `0-overview.md` 의 `1 (out) 또는 N` 표기는 마치 `out` + N 동적 포트가 동시 존재하는 것처럼 읽힐 수 있어 오해 소지가 있다.
- 제안: `spec/4-nodes/0-overview.md §2.6` 의 Carousel/Table/Chart/Template 출력 컬럼을 `N (버튼 포트) 또는 1 (out, 버튼 없을 때)` 또는 유사한 더 명확한 표현으로 수정하여 `presentation/0-common.md §2` 와 정합시킨다.

---

### [WARNING] `plan/in-progress/ai-presentation-tools.md` 결정과 spec 동기화 상태
- target 위치: `spec/4-nodes/` 전반 (구현 착수 전 검토)
- 충돌 대상: `plan/in-progress/ai-presentation-tools.md` §4.1 체크리스트 — 여러 spec 문서 갱신이 미완료 상태(`[ ]`)
- 상세: `ai-presentation-tools.md` 의 §4.1 에 따르면 다음 spec 문서 갱신이 아직 완료되지 않았다 (`[ ]` 상태):
  - `spec/conventions/conversation-thread.md §1.2` — `ConversationTurn` 표에 `presentations?: PresentationPayload[]` 행 추가
  - `spec/5-system/6-websocket-protocol.md §4.4` — `execution.ai_message` payload 에 `presentations` 추가, `interactionType` 에 `ai_form_render` 추가
  - `spec/5-system/14-external-interaction-api.md §6.5` — SSE payload 에 `presentations` 추가
  - `spec/conventions/node-output.md §4.5` — `form_submitted` shape 에 `via: 'ai_render'` sentinel 추가
  이 미완료 spec 갱신들이 구현 영역(`spec/4-nodes/`) 의 AI Agent render_* 관련 계약과 교차한다. 구현 착수 전에 해당 spec 동기화가 완료되지 않으면, AI Agent node 구현 시 ConversationThread / WS protocol / node-output conventions 와의 계약이 불명확한 상태가 된다.
- 제안: `spec/4-nodes/` 구현 착수 전에 `plan/in-progress/ai-presentation-tools.md §4.1` 의 미완료 spec 갱신(`[ ]` 항목)을 먼저 완료하고, `/consistency-check --spec` 재실행으로 Critical 0 을 확인 후 구현 단계로 진입한다.

---

### [INFO] `spec/4-nodes/1-logic/0-common.md §9.1` 의 Loop `시작 시점 output` 표기
- target 위치: `spec/4-nodes/1-logic/0-common.md §9.1` 컨테이너 노드 핸들러 ↔ 엔진 오버라이트 컨트랙트 표 — Loop 행: `시작 시점 output: (없음 — Loop는 입력 분배 안 함)`
- 충돌 대상: `spec/4-nodes/1-logic/3-loop.md §5.1` (loop spec 문서 자체 — 프롬프트에 일부 포함)
- 상세: Loop 노드는 `emit` 포트 기반의 컨테이너로 `body` 서브그래프가 반복 실행되지만 body 에 분배할 items 배열이 없으므로 시작 시점 handler output 이 사실상 없다(`output: null`). `0-common.md §9.1` 표의 Loop 행 `시작 시점 output` 컬럼에 `(없음)` 로 기재하고 있으나, 다른 컨테이너(foreach/map)는 `items[]` 를 반환하는 반면 Loop 은 `null` 을 반환하는 것이 spec 어딘가에 명시적으로 기술되지 않아 "없음" 의 구체적 의미(undefined vs null)가 모호하다. `10-parallel.md §5.1` 의 예시에서 Parallel 은 `output: null` 명시하고 있다.
- 제안: `spec/4-nodes/1-logic/0-common.md §9.1` 의 Loop 행 `시작 시점 output` 컬럼을 `output: null` 로 명시하여 Parallel `§5.1` 과 일관된 표현을 사용한다.

---

## 요약

`spec/4-nodes/` 영역은 다른 spec 영역과 전반적으로 높은 정합성을 유지하고 있다. 가장 주의해야 할 사항은 두 가지다. 첫째, `plan/in-progress/ai-presentation-tools.md §4.1` 의 미완료 spec 갱신 항목들(`conversation-thread.md`, `websocket-protocol.md`, `external-interaction-api.md`, `node-output.md §4.5`)이 구현 착수 전에 완료되어야 AI Agent render_* 구현이 확정된 계약 위에서 진행될 수 있다 (WARNING). 둘째, Parallel 노드의 `count` 필드 제거 결정이 `spec/4-nodes/1-logic/0-common.md §5` / `§9.1` 의 공통 규약과 불일치하고 있어 (INFO), 이 불일치가 `plan/in-progress/spec-drift-parallel-count.md` 에서 이미 추적 중인지 확인이 필요하다. 그 외 발견사항들은 모두 INFO 등급으로, 구현을 차단하지는 않으나 다음 spec 정비 사이클에서 해소를 권장한다.

---

## 위험도

MEDIUM

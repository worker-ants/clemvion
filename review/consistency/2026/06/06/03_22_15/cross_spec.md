# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system` 전역 (impl-done, diff-base=origin/main)
검토 기준일: 2026-06-06

---

## 발견사항

### [INFO] data-flow/3-execution.md Schema 매핑 — `resume_call_stack` 컬럼 누락

- **target 위치**: `spec/5-system/4-execution-engine.md §6.2` — `Execution.resume_call_stack jsonb` (V087) 가 park commit 5개 항목 중 하나로 명시 (`waitForX` 블로킹 진입 시 commit 대상)
- **충돌 대상**: `spec/data-flow/3-execution.md §2.1 Postgres` Schema 매핑 표 (line 51/114)
- **상세**: `data-flow/3-execution.md` §1.3 Sequence 에서는 "conversation_thread / user_variables durable commit" 과 "ExecutionContext 재구성 (execution_node_log + node_execution.output_data + conversation_thread + user_variables)" 만 언급한다. 4-execution-engine.md §6.2 가 정의한 `resume_call_stack` 컬럼(D6 결정 — 중첩 sub-workflow park 시 executeInline 호출 체인 영속)이 data-flow 다이어그램과 Schema 매핑 표 양쪽에서 누락돼 있다.
- **제안**: `spec/data-flow/3-execution.md` §1.3 Sequence Note 와 §2.1 Schema 매핑 `execution` 행에 `resume_call_stack` commit 추가. 4-execution-engine.md §6.2 SoT 이므로 data-flow 만 동기화.

---

### [INFO] data-flow/3-execution.md §2.1 Schema 매핑 — `conversation_thread` / `user_variables` 컬럼 명시 누락

- **target 위치**: `spec/5-system/4-execution-engine.md §6.2` 및 `spec/1-data-model.md` Execution 테이블 (V084/V085)
- **충돌 대상**: `spec/data-flow/3-execution.md §2.1` Postgres Schema 매핑 표 (line 140-145)
- **상세**: §2.1 표의 `execution` "상태 전이" 행은 UPDATE 컬럼으로 `status, finished_at, duration_ms, output_data, error` 만 열거하고 `conversation_thread`, `user_variables` 가 없다. Sequence 다이어그램 Note (line 51)에서는 "conversation_thread / user_variables durable commit" 을 언급하지만, 명세 테이블에는 반영이 안 돼 있어 독자가 두 위치를 따로 확인해야 한다.
- **제안**: `spec/data-flow/3-execution.md §2.1` 의 `execution` "park 진입(waiting_for_input)" 전용 행을 추가하거나 기존 행에 `conversation_thread, user_variables, resume_call_stack` 를 명시해 1-data-model.md/4-execution-engine.md 와 동기화.

---

### [INFO] spec/5-system/4-execution-engine.md §4.x 구현 메모 — Phase B 현황 표현이 다른 참조 문서와 동기화 필요

- **target 위치**: `spec/5-system/4-execution-engine.md §4.x` 구현 메모 (Phase B 현황, line 406-408)
- **충돌 대상**: `spec/data-flow/3-execution.md §1.3` (line 111-116)
- **상세**: 4-execution-engine.md §4.x 메모는 "형식적 동기화 필요"가 아니라 정확히 두 스펙이 일치하는 것을 확인. data-flow §1.3 의 alt 분기 "멀티턴 AI 로컬 pendingContinuations hit (잠정 fast path — PR-B2 에서 제거)" 가 실행 엔진 §7.4 Worker 동작의 잠정 경로와 일치한다. 현재 일관성은 유지되고 있으나, PR-B2 완료 시 data-flow §1.3 의 `alt` 분기 삭제와 단일 slow-path 로 단순화해야 한다는 점이 data-flow 에 명시되지 않아 추적 위험이 있다.
- **제안**: data-flow §1.3 line 111 에 "PR-B2 완료 시 이 alt 분기 제거 예정" 주석 추가 (4-execution-engine.md 의 §4.x 메모 수준으로 동기화).

---

### [INFO] spec/5-system/16-system-status-api.md — `execution-run` concurrency 주석이 data-flow 큐 카탈로그와 표현 방식 상이

- **target 위치**: `spec/5-system/16-system-status-api.md §1` QueueRegistry 표 `execution-run` 행 — `1 (env EXECUTION_RUN_WORKER_CONCURRENCY)` + 비고 "Execution intake — 첫 active 세그먼트 work-stealing (intake 큐 burst 시 `waiting>0 && active===0` 일시 오탐 가능)"
- **충돌 대상**: `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` (line 93)
- **상세**: 실제 모순이 아니라 표현 수준 차이. data-flow 큐 카탈로그는 `execution-run` 을 목록에 포함하나 concurrency·group·비고 메타는 system-status-api.md §1 을 단일 진실 레지스트리로 명시(§1 SoT 주의 섹션). 이 위임 구조는 올바르지만 카탈로그와 레지스트리가 기술하는 항목 set 의 일치를 보장하는 공식 절차가 없다.
- **제안**: data-flow §4 비고 또는 16-system-status-api.md §1 서두에 "두 목록을 반드시 동시 갱신" 규약 문구 추가.

---

### [INFO] spec/1-data-model.md `Execution.active_running_ms` — §8 동시-실행-제한 링크 대상이 target 내부에서 참조하는 섹션과 표기 불일치

- **target 위치**: `spec/1-data-model.md` Execution 테이블 `active_running_ms` 행 — `[4-execution-engine §8](./5-system/4-execution-engine.md#8-동시-실행-제한)` 링크
- **충돌 대상**: `spec/5-system/4-execution-engine.md` 섹션 구조
- **상세**: 1-data-model.md 가 참조하는 앵커 `#8-동시-실행-제한` 는 4-execution-engine.md 가 "§8 동시 실행 제한 (Planned)" 등으로 존재하는 경우 일치하나, 4-execution-engine.md 에서 이 섹션이 rename 되거나 번호가 변경되면 dead link 가 된다. 현재 단계의 spec 에서는 기능적 모순은 없고 링크 안정성 위험.
- **제안**: 섹션 번호 변경 시 1-data-model.md 링크도 함께 갱신하는 규약 메모를 4-execution-engine.md §8 에 남기는 것을 권장.

---

### [INFO] spec/5-system/4-execution-engine.md §1.1 상태 전이표 — `waiting_for_input → failed` 전이의 설명이 AI Agent spec 과 표현 차이

- **target 위치**: `spec/5-system/4-execution-engine.md §1.1` 허용 상태 전이 표 `waiting_for_input → failed` 행: "AI Agent multi-turn turn 처리 중 LLM throw (429/timeout/connection) — `handleAiTurnError` 가 §7.9 shape으로 finalize"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §7.9` — "Multi Turn 모드 — 오류(Error 포트)"
- **상세**: 두 spec 이 같은 경로를 설명하는데, 4-execution-engine.md 에서는 `rehydration 실패(§7.5)` 가 NodeExecution → `failed` 전이를 유발하고 동반 Execution 은 `cancelled` 로 마감한다고 §1.2 NodeExecution 상태 표에 기술돼 있다. §1.1 Execution 전이표의 `waiting_for_input → cancelled` 행 설명에 `RESUME_*` 코드가 나오지만, rehydration 실패 시 Execution 이 `failed` 가 아닌 `cancelled` 로 가는 이유가 §1.1 표에서 직접 확인하기 어렵다. AI Agent §7.9 는 `failed` 로 기술한다. 이 두 경로(LLM throw → failed vs rehydration 실패 → cancelled/failed)는 사실 서로 다른 경로이나, 표 읽기에 혼동 가능성이 있다.
- **제안**: 4-execution-engine.md §1.1 `waiting_for_input → cancelled` 행의 설명에 "rehydration 실패 케이스에서 NodeExecution 은 `failed`, 동반 Execution 은 `cancelled`" 구분을 명시적으로 표기.

---

## 요약

Cross-Spec 일관성 관점에서 `spec/5-system` 의 핵심 영역(4-execution-engine/PR-B1 park 변경, 16-system-status-api, 17-agent-memory, 10-graph-rag, 11-mcp-client, 1-auth)은 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 측면에서 다른 spec 영역과 직접 모순되는 CRITICAL 또는 WARNING 충돌이 발견되지 않는다. 주요 발견사항은 모두 INFO 수준으로, PR-B1(form/button park 즉시 해제) 변경이 4-execution-engine.md 에 정확히 반영됐으나 `spec/data-flow/3-execution.md` Schema 매핑 표에서 `resume_call_stack` (V087) 컬럼 및 `conversation_thread`/`user_variables` 의 공식 테이블 항목이 누락돼 있는 문서 동기화 갭이 가장 주목할 항목이다. 나머지는 data-flow 큐 카탈로그와 system-status 레지스트리 간 동기화 절차 부재, Phase B 롤아웃 추적 메모 위치 차이, 상태 전이 설명의 미세한 표현 차이 등이다.

## 위험도

LOW

STATUS: OK

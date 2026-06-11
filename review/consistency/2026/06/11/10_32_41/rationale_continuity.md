# Rationale 연속성 검토 결과

**검토 대상**: `spec/2-navigation/14-execution-history.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-06-11

---

## 발견사항

- **[INFO]** AI agent spec 의 구 `LLM Information Tab` 참조가 정리되지 않음
  - target 위치: §3.4.2 본문 + R-3 Rationale — 이전 구조 `LLM Information` 탭 → 하위 `Response/Request/Usage` 를 "평탄화로 교체"한다고 기록함
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md` 1016번째 줄 — "프론트엔드 Conversation Inspector / **LLM Information Tab**" 을 여전히 현행 명칭으로 표기
  - 상세: target 은 R-3 에서 `LLM Information` 탭 구조를 폐기하고 최상위 평탄화를 채택했다고 선언한다. 그러나 `spec/4-nodes/3-ai/1-ai-agent.md §12.3(turnDebugHistory 스키마)` 본문 설명은 여전히 "LLM Information Tab" 이라는 옛 명칭을 사용하고 있다. target 이 폐기 사실을 R-3 에 적었어도, 관련 spec 이 동일 폐기를 반영하지 않으면 spec 독자가 두 문서 사이에서 어떤 구조가 현행인지 혼동할 수 있다.
  - 제안: `spec/4-nodes/3-ai/1-ai-agent.md` 해당 줄을 "LLM Usage 탭(노드 레벨) / Response·Request·LLM Usage 탭(메시지 레벨)" 등 현행 명칭으로 갱신하거나, 적어도 "(구 명칭, 현재는 LLM Usage 등 최상위 탭으로 평탄화)" 와 같이 주석을 달아 R-3 의 폐기 사실과 연결한다.

- **[INFO]** `executionPath` 빈 배열 정책이 이미 execution-engine spec 과 data-model spec 에 존재하며, target R-1 의 서술과 완전 일치 — 충돌 없음 (확인 기록)
  - target 위치: §5 목록 API 비고 + R-1
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` 842번째 줄 "목록 조회 응답에서는 N+1 회피 위해 빈 배열로 반환한다"; `spec/1-data-model.md` §2.13 + Rationale "Execution.execution_path → ExecutionNodeLog"
  - 상세: target R-1 의 근거(N+1 회피, 배치 집계 3카운트, executionPath 빈 배열 고정)는 이미 정립된 Rationale 의 자연스러운 연장이며, 충돌이나 번복 없이 정합한다.

- **[INFO]** `triggerSource` 5종 정규화 판정 우선순위가 기존 `__triggerSource` 3종 내부 마커와 명확히 분리 선언됨 — 합의 원칙 준수 확인
  - target 위치: §2.4 Trigger 출처 분류 + R-2
  - 과거 결정 출처: `spec/4-nodes/7-trigger/0-common.md` — `__triggerSource: 'manual' | 'webhook' | 'schedule'` 3종 내부 마커 정의; `spec/data-flow/10-triggers.md` Rationale "Schedule 을 Trigger 의 sub-type 으로 둔 이유"
  - 상세: R-2 는 응답 DTO `triggerSource` (5종) 가 엔진 내부 마커 `__triggerSource` (3종) 와 "별개의 식별자"임을 명시한다. 이는 기존 Rationale 에 기록된 "trigger.type 한 컬럼으로 진입 경로 추적" 원칙과 충돌하지 않고, 레이어를 명시적으로 분리해 오히려 명확성을 높인다.

- **[INFO]** per-node task queue 기각 결정과의 일관성 — target 이 이 결정을 우회하지 않음
  - target 위치: §5 API 엔드포인트 (목록/상세 endpoint 분리) + R-1
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` Rationale "per-node task queue → execution-level intake 큐" — per-node task queue 는 기각됐으며, 노드 dispatch 는 in-process
  - 상세: target 은 목록 API 에서 nodeExecutions 를 제외하는 이유로 N+1 회피를 들고, 상세 API 에서만 노드 실행 본문을 반환한다. 이는 per-node task queue 기각과 직접 관련은 없지만, "단건 노드 조회 경로를 분리"하는 설계 방향이 엔진의 in-process dispatch + 상세 조회 분리 원칙과 일관된다.

- **[INFO]** Skipped 노드 제외 정책(R-4) 이 execution-engine 의 `skipped` 상태 정의와 완전 정합
  - target 위치: EH-DETAIL-05 + R-4
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` 51번째 줄 — "`skipped` 는 NodeExecution 전용", all-skipped 실행은 Execution 레벨에서 `completed` 로 표기
  - 상세: target R-4 의 "분기로 실행되지 않은 노드는 진단 가치가 없다" 근거는 엔진 spec 의 skipped 정의와 충돌이 없다. Execution 필터에 `skipped` 항목이 없다는 사실도 target §2.3 필터 목록과 일치한다.

---

## 요약

`spec/2-navigation/14-execution-history.md` 는 기존 spec 의 Rationale 에서 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 항목을 포함하지 않는다. R-1(N+1 회피 · 배치 집계)·R-2(triggerSource 정규화)·R-3(LLM 탭 평탄화)·R-4(skipped 노드 제외) 모두 기존 execution-engine spec, data-model spec, trigger spec 의 Rationale 와 정합하거나 그것을 명시적으로 연장한다. 단, R-3 에서 폐기 선언된 `LLM Information` 탭 명칭이 `spec/4-nodes/3-ai/1-ai-agent.md` 에 아직 남아있어, 독자가 현행 탭 구조를 오독할 가능성이 있다. 이는 cross-spec 정리 누락으로 INFO 수준이다.

---

## 위험도

LOW

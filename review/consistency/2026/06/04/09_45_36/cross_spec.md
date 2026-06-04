# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-update-exec-intake-queue-pr1.md`
**검토 대상 spec**: `spec/5-system/4-execution-engine.md` §4 배너 / §9.3 / §11

---

## 발견사항

### [WARNING] `data-flow/3-execution.md §1.1` 시퀀스 다이어그램 — `execution-run` 큐 누락

- target 위치: target draft §4 배너 변경 (SUMMARY#5)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-intake-queue/spec/data-flow/3-execution.md` §1.1 "메인 워크플로우 실행 (executeInline 경로)"
- 상세: target draft 가 §4 배너를 "PR1 구현 완료"로 변경하면, `execute()` 가 `execution-run` 큐에 job 을 발행하고 즉시 반환하는 것이 현재 구현이 된다. 그러나 `data-flow/3-execution.md §1.1` 의 시퀀스 다이어그램은 여전히 `Eng->>PG: UPDATE execution SET status='running'` 이 `INSERT execution` 직후에 인라인으로 발생하는 old in-process fire-and-forget 흐름을 기술한다. 새 흐름은 `execute()` → `INSERT execution (status='pending')` → `execution-run` 큐 enqueue → 즉시 반환 → worker 가 pick up → `status='running'` 으로 전이하는 비동기 경로다. 두 흐름이 모순된다.
- 제안: `data-flow/3-execution.md §1.1` 시퀀스 다이어그램에 `execution-run` 큐 enqueue 및 `ExecutionRunProcessor` 소비 단계를 추가하고, `§2.2 Redis (BullMQ)` 표에 `execution-run` 큐 행을 추가해야 한다. 이 작업은 본 draft 의 범위 외이므로 draft 본문에 "data-flow §1.1·§2.2 갱신 필요" 주석을 추가하거나 별도 후속 plan 으로 등록 권장.

---

### [WARNING] `spec/data-flow/3-execution.md §2.2` BullMQ 표 — `execution-run` 큐 행 없음

- target 위치: target draft §9.3 표 변경 (SUMMARY#3)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-intake-queue/spec/data-flow/3-execution.md` §2.2 Redis (BullMQ) 표
- 상세: target draft 는 `spec/5-system/4-execution-engine.md §9.3` 에서 `execution-run` 큐를 "PR1 구현 완료"로 표기한다. 그러나 `data-flow/3-execution.md §2.2` BullMQ 표는 `execution-continuation` 과 `background-execution` 두 개만 나열한다. `execution-run` 의 producer(`ExecutionEngineService.execute`) / consumer(`ExecutionRunProcessor`) / payload 핵심 필드가 누락되어 data-flow 문서와 §9.3 spec 이 불일치한다.
- 제안: `data-flow/3-execution.md §2.2` 에 `execution-run` 행 추가 (producer = `ExecutionEngineService.execute`, consumer = `ExecutionRunProcessor`, payload = `{executionId, workflowId, workspaceId, ...}`, jobId = `executionId` (PR1 1:1)). 본 draft 범위 외이므로 후속 plan 등록 권장.

---

### [WARNING] `spec/5-system/4-execution-engine.md §9.2` Redis 키 표 — `exec:run:seq` 가 여전히 "(target — §4) 구현 시 결정"

- target 위치: target draft §9.3 표 변경 (SUMMARY#3) — draft 는 `jobId = executionId` (PR1 은 1:1 enqueue, seq 없음)로 명기
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-intake-queue/spec/5-system/4-execution-engine.md` §9.2 Redis 키 표 line 988
- 상세: §9.2 에 `exec:run:seq:<executionId>` 키가 `(target — §4) ... 구현 시 결정`으로 여전히 등재되어 있다. 반면 target draft §9.3 변경안은 `jobId = executionId (PR1 은 1:1 enqueue, re-enqueue 없음 — PR3/PR4 에서 seq 추가 예정)`으로 기술한다. PR1 에서 `exec:run:seq` Redis 키를 사용하지 않는다면 §9.2 의 해당 행은 여전히 "(target — §4)" 마커를 달거나, PR1 구현에서 seq 키 없이 jobId=executionId 로 동작함을 명기해야 한다. 두 섹션의 jobId 기술이 상충한다: §9.2 는 "seq 키로 jobId 를 구성" 을 암시하는 반면, §9.3 draft 는 "PR1 은 seq 없이 executionId 그대로" 를 명기한다.
- 제안: target draft 가 §9.3 을 갱신하는 동시에 §9.2 의 `exec:run:seq:<executionId>` 행도 함께 수정해야 한다. PR1 에서 seq 키를 사용하지 않는다면 해당 행에 "(PR3/PR4 seq 추가 시 활성화 — PR1 에서는 미사용, jobId=executionId 직접 사용)" 을 명기. 본 항목은 같은 spec 파일 내 두 섹션의 충돌이므로 target draft 가 §9.2 수정도 포함해야 한다. CRITICAL 은 아니지만 내부 자기-충돌이므로 WARNING 으로 분류.

---

### [WARNING] `spec/5-system/4-execution-engine.md §11` Graceful Shutdown item 2 — `execution-run` worker 언급 없음

- target 위치: target draft §11 ENV 표 변경 (SUMMARY#4)
- 충돌 대상: `/Volumes/project/private/clemvion/.claire/worktrees/impl-exec-intake-queue/spec/5-system/4-execution-engine.md` §11 item 2
- 상세: §11 item 2 는 "BullMQ `execution-continuation` / `background-execution` 의 active job 처리 중인 worker 는 현재 노드를 완료까지 진행. 신규 job consume 중단. (일반 노드 실행은 큐 미경유, in-process while-loop 종결까지 대기 — §2.1 / §9.3)" 로 기술한다. PR1 구현 완료 후에는 `execution-run` worker 도 동일한 graceful drain 정책을 따라야 한다. 현재 item 2 는 `execution-run` 을 언급하지 않아 "일반 노드 실행은 큐 미경유" 설명이 PR1 이후에도 그대로 남아 있으면 오해를 유발한다.
- 제안: target draft 가 §11 ENV 표를 갱신하는 시점에 item 2 의 큐 목록도 `execution-run` / `execution-continuation` / `background-execution` 으로 확장하고, "일반 노드 실행은 큐 미경유" 괄호 주석을 제거하거나 §9.3 과 일치하도록 수정해야 한다. draft 적용 절차 step 3 에 포함하거나 별도 항목으로 명기 권장.

---

### [INFO] `spec/0-overview.md §Rationale "실행 엔진"` — worktree 기준 이미 갱신됨, 불일치 없음

- target 위치: 전반
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-intake-queue/spec/0-overview.md` §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀 (§2.4)"
- 상세: worktree 내 `spec/0-overview.md` §2.4·§2.6·Rationale 섹션은 이미 `execution-run` intake 큐 / execution-level active 세그먼트 모델 / 세 큐 분리를 반영하고 있다. target draft 의 §4·§9.3·§11 변경과 일치. 추가 충돌 없음.
- 제안: 현 worktree 상태 유지. 본 항목은 잠재 충돌이 아님을 명확히 기록하는 INFO.

---

### [INFO] `spec/5-system/_product-overview.md` — 실행 엔진 구현 상태 요약 동기화 권장

- target 위치: 전반 (SPEC-DRIFT 분류)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-intake-queue/spec/5-system/_product-overview.md` (미확인)
- 상세: `spec/5-system/_product-overview.md` 가 실행 엔진 구현 상태를 요약하는 항목을 가지고 있을 경우, `execution-run` 큐 PR1 완료를 반영해야 할 수 있다. 직접 확인하지 않았으나 §4 배너 변경과 연동해 점검 권장.
- 제안: draft 적용 후 `spec/5-system/_product-overview.md` 의 실행 엔진 상태 기술이 §4 배너와 일치하는지 검토.

---

## 요약

target draft 의 세 가지 변경(§4 배너·§9.3 큐 표·§11 ENV 표) 자체는 내부적으로 일관되며, `spec/0-overview.md` 의 기 갱신된 worktree 내용과도 충돌하지 않는다. 단, draft 범위가 한 파일(`spec/5-system/4-execution-engine.md`)의 세 지점으로 제한됨으로써 발생하는 파생 불일치가 세 곳에서 확인된다. (1) `spec/data-flow/3-execution.md §1.1` 시퀀스 다이어그램이 old in-process 흐름을 유지하여 §4 배너 "PR1 구현 완료"와 모순, (2) 같은 파일 §2.2 BullMQ 표에 `execution-run` 큐 행이 없어 §9.3 변경과 불일치, (3) 같은 spec 파일(`4-execution-engine.md`) §9.2 의 `exec:run:seq` Redis 키 행이 §9.3 draft 변경의 "PR1 은 seq 없이 jobId=executionId" 설명과 내부 모순을 일으킨다. §11 Graceful Shutdown item 2 의 큐 목록 미갱신도 동기화가 필요하다. 이 중 §9.2 (같은 파일 내 섹션 충돌)는 동일 PR 에서 함께 수정하는 것이 안전하고, 나머지 `data-flow` 파일 변경은 후속 plan 으로 처리 가능하다.

## 위험도

MEDIUM

---

STATUS: OK

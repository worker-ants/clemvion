# Cross-Spec 일관성 검토 결과

**target**: `plan/in-progress/spec-draft-exec-intake-queue.md`
**검토 일시**: 2026-06-04
**검토자**: cross-spec consistency checker

---

## 발견사항

### [INFO] spec/0-overview.md §2.4 Worker Pool 표현 — draft 정정 방향 확인

- **target 위치**: draft §6 "§0-overview §2.4 + Rationale 정직화"
- **충돌 대상**: `spec/0-overview.md §2.4 Execution Engine` (현재 텍스트: "**Worker Pool** (N개 인스턴스, 수평 확장) — 큐에서 태스크를 소비하여 노드 실행")
- **상세**: draft 는 §2.4 의 "노드 실행" 표현을 "execution-level intake 큐(`execution-run`)에 실행 시작을 발행 / 워커가 실행 1건(active 세그먼트)을 통째로 처리" 로 정정하겠다고 명시한다. `spec/0-overview.md` 의 실제 §2.4 현재 텍스트와 draft 가 제안하는 정정 방향이 일치하므로 충돌이 아닌 예고된 동기화. 단, spec 반영 시 §2.4 의 해당 표현과 Rationale 의 "NodeExecution = 워커가 핸들러 호출" 문구를 **함께** 갱신하지 않으면 내부 불일치가 발생한다.
- **제안**: spec 반영 시 `spec/0-overview.md` §2.4 본문 + Rationale "실행 엔진: Redis 큐 + 분산 워커 풀" 의 "NodeExecution = 워커가 핸들러 호출" 표현을 동시 갱신.

---

### [INFO] spec/0-overview.md §2.6 Redis 큐 목록 — `execution-run` 미기재

- **target 위치**: draft §6 "§2.6 Data Layer 의 Redis BullMQ 큐 목록에 `execution-run` 추가"
- **충돌 대상**: `spec/0-overview.md §2.6 Data Layer` (현재: `실행 태스크 / execution-continuation / background-execution`)
- **상세**: draft 가 `execution-run` 추가를 예고하고 있으며, 현 spec 에는 해당 큐가 없다. 충돌이 아니라 draft 가 의도하는 추가 사항이다.
- **제안**: spec 반영 시 `spec/0-overview.md §2.6` 을 함께 갱신.

---

### [INFO] spec/5-system/4-execution-engine.md §9.3 BullMQ 큐 목록 — `execution-run` 미기재

- **target 위치**: draft §1 "§4.1 아키텍처 (execution-level intake 큐)"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §9.3 BullMQ 큐 목록` (현재 2개 큐: `execution-continuation`, `background-execution`)
- **상세**: draft 는 `execution-run` 큐를 신설하나, 현 §9.3 큐 목록에는 이 큐가 없다. spec 반영 시 §9.3 에도 추가 항목이 필요하다.
- **제안**: spec 반영 시 `spec/5-system/4-execution-engine.md §9.3` 에 `execution-run` 큐 행(역할·attempts·비고) 추가 필요.

---

### [INFO] spec/5-system/4-execution-engine.md §9.2 Redis 키 — `execution-run` 워커 관련 키 미기재

- **target 위치**: draft §1 "§4.3 수평 확장" — `EXECUTION_RUN_WORKER_CONCURRENCY` 신규 env var
- **충돌 대상**: `spec/5-system/4-execution-engine.md §9.2 / §11` 환경 변수 표 (현재 `CONTINUATION_WORKER_CONCURRENCY`, `RESUME_BULLMQ_ATTEMPTS`, `SIGTERM_GRACE_MS` 등 기재)
- **상세**: draft 는 `EXECUTION_RUN_WORKER_CONCURRENCY` 를 신설하나, 기존 env var 표에 없다. 충돌은 아니며 신규 추가 사항이지만 spec 본문에 반영하지 않으면 환경 변수 목록이 누락 상태가 된다.
- **제안**: spec 반영 시 `EXECUTION_RUN_WORKER_CONCURRENCY` 를 §11 또는 §4.3 환경 변수 표에 추가.

---

### [WARNING] spec/5-system/4-execution-engine.md §7.1 heartbeat 표현 — draft 가 폐기 선언하는 표현이 현 spec 에 "미구현(Planned)" 으로 살아 있음

- **target 위치**: draft §3 "§7.1 재정의 — stalled-job 재큐 (active 세그먼트 한정)"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §7.1 Worker Heartbeat` — "Heartbeat 간격 5초 / 미응답 판정 3회 연속(15초) / 미응답 시 동작: 해당 태스크를 큐에 재발행(재큐)" 로 기재되어 있으며, 현재 "미구현(Planned)" 상태다
- **상세**: draft 는 이 heartbeat 메커니즘 표현을 **폐기**하고 BullMQ stalled-job 검출로 대체하겠다고 한다. 현 spec §7.1 은 해당 표현을 aspirational(목표) 로 두고 있으므로 방향 변경이다. draft 가 채택 이후 §7.1 본문 전체를 "BullMQ stalled-job 검출" 기반으로 재작성하지 않으면 두 서술이 spec 내에 공존해 혼동이 발생한다.
- **제안**: spec 반영 시 §7.1 본문의 "Heartbeat 간격 5초 / 미응답 판정 15초 / 태스크 재큐" 표를 "BullMQ stalled-job 검출 (active 세그먼트 job 한정)" 으로 재작성. `recoverStuckExecutions()` 의 절대 시간 30분 일괄 fail 를 "대체 예정" 으로 표기하는 것은 draft 의 의도와 일치하므로 유지 가능.

---

### [WARNING] spec/5-system/4-execution-engine.md §7.2 체크포인트 — "미완료 태스크 재큐 → 새 Worker" 표현이 execution-level 세그먼트 모델과 뉘앙스 불일치

- **target 위치**: draft §4 "§7.2 (체크포인트 Resume): '미완료 태스크 재큐 → 새 Worker 가 해당 노드부터 재실행' 은 stalled 재큐 모델과 정합. 단 재큐 대상은 active 세그먼트 job 이고 RUNNING 한정임을 명시"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §7.2 체크포인트 기반 Resume` — 현재 "미완료 태스크(현재 실행 중이던 **노드**)를 재큐 / 해당 **노드**만 재실행" 이라고 노드 단위로 서술
- **상세**: §7.2 의 현 서술은 per-node task queue 모델을 전제한 표현("해당 노드만 재실행, 이전 완료 노드는 재실행하지 않음")이다. draft 가 채택하는 execution-level 세그먼트 모델에서는 재큐 단위가 '노드' 가 아니라 'active 세그먼트 job(execution-run / execution-continuation)'이며, 세그먼트 재개는 §7.5 rehydration(완료 노드 재실행 안 함 원칙 적용)으로 처리된다. 표현은 다르지만 "완료 노드 재실행 안 함" 원칙 자체는 동일하므로 모순은 아니다. 그러나 §7.2 를 갱신하지 않으면 여전히 per-node 뉘앙스가 남아 오해 소지가 있다.
- **제안**: spec 반영 시 §7.2 의 "미완료 태스크(노드)" → "미완료 active 세그먼트 job" 으로 표현 정정. "해당 노드만 재실행" → "§7.5 rehydration 으로 세그먼트 재개 (완료 노드 재실행 안 함 원칙 동일 적용)".

---

### [WARNING] spec/5-system/4-execution-engine.md §8 동시 실행 — "단일 Execution 최대 실행 시간 30분" 의 wall-clock vs active-running 미명시가 draft 와 충돌

- **target 위치**: draft §5 "§8 재정의 — active-running 누적 시간 기준"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §8 동시 실행 제한` — "단일 Execution 최대 실행 시간 | 30분 | Workflow.settings" 로만 기재. wall-clock 인지 active-running 인지 미명시 상태
- **상세**: 현 §8 는 wall-clock vs active-running 을 구분하지 않는다. draft 는 이를 "active-running 누적 시간 기준(waiting 대기 제외)" 으로 확정하고 미구현(Planned) banner 를 유지하면서 목표 아키텍처를 갱신한다고 명시한다. 두 서술이 직접 모순하지는 않으나(§8 가 wall-clock 이라고 명시하지 않으므로), spec 반영 전까지 §8 는 모호한 상태로 남아 있다. 구현 진입 시 오해 가능성이 있다.
- **제안**: spec 반영 시 §8 에 "단일 Execution 최대 실행 시간 = active-running 누적 시간 기준(waiting_for_input 대기 제외)" 을 명시 추가. `EXECUTION_TIMEOUT` 에러 → `failed` 전이 도 §8 에 명시.

---

### [INFO] spec/5-system/4-execution-engine.md §4 미구현(Planned) 표현 — draft 가 재정의하는 per-node 모델이 현 spec 에 aspirational 로 존재

- **target 위치**: draft §1 "per-node task queue (1 Worker = 1 NodeExecution) 모델은 폐기한다"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §4.1~§4.3` — "미구현(Planned)" 로 표기된 per-node task queue 아키텍처(1 Worker = 1 NodeExecution, `taskId`/`nodeId`/`timeout` 포함 태스크 메시지)
- **상세**: 현 spec §4.1~§4.3 의 aspirational 아키텍처(per-node)를 draft 가 execution-level 세그먼트 모델로 대체한다. 직접 모순이 아니라 aspirational 을 다른 aspirational 로 교체하는 것으로, draft 가 spec 본문에 반영되기 전까지는 §4.1~§4.3 의 per-node 표현이 살아 있다. spec 반영이 완료되어야만 일관성이 확보된다.
- **제안**: spec 반영 시 §4.1~§4.3 전체를 draft §1(4.1~4.4)로 교체. 기존 per-node 태스크 메시지(`taskId`/`nodeId`/`nodeType`/`context.loopContext` 등 필드)는 제거하고 `execution-run` job 메시지 스키마로 대체.

---

### [INFO] spec/1-data-model.md §2.13 Execution.error.code — `WORKER_HEARTBEAT_TIMEOUT` 코드 의미 변화 가능성

- **target 위치**: draft §3 "§7.1 재정의 — BullMQ stalled-job 검출로 대체"
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution.error` 설명 — `WORKER_HEARTBEAT_TIMEOUT` 은 "부팅 시 recovery — 30분 이상 heartbeat 없는 RUNNING Execution" 이라고 기재
- **상세**: draft 가 §7.1 을 BullMQ stalled-job 기반으로 재정의하면, `recoverStuckExecutions()` 의 절대 시간 방식이 대체될 때 `WORKER_HEARTBEAT_TIMEOUT` 코드의 의미가 변경될 수 있다. 현재 `spec/1-data-model.md` 에 이 코드의 설명이 "30분 이상 heartbeat 없는 RUNNING" 으로 구체적으로 박혀 있어 향후 코드 이름과 실제 검출 방식이 달라질 수 있다(코드 이름 자체를 바꾸거나 설명을 갱신해야 한다). draft 는 이 점을 다루지 않는다.
- **제안**: spec 반영 또는 구현 단계에서 `WORKER_HEARTBEAT_TIMEOUT` 에러 코드를 유지할지, `STALLED_JOB_RECOVERED` 등으로 재명명할지 결정하고 `spec/1-data-model.md §2.13 Execution.error` 설명을 동기화.

---

### [INFO] spec/5-system/4-execution-engine.md §6.1 ExecutionContext — `pending` 상태에서의 `execute()` 동작 변화

- **target 위치**: draft §7 "구현 선결조건 1 — 동기 실행 경로 식별"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §6.1.1 트리거 입력 파라미터 seeding` 및 `§5.6 노드 실행 흐름`
- **상세**: draft 는 `execute()` 가 현재 in-process `runExecution()` 을 직접 await 하는 동기 호출자(REST API / chat-channel / EIA 등)가 있으면 큐 전환이 계약을 비동기로 바꾼다는 점을 구현 선결조건으로 식별한다. 이는 spec 모순이 아니라 구현 리스크 경보이며, 현재 spec 상의 `execute()` 계약이 "fire-and-forget 인지 await 인지" 를 명시하지 않아 발생하는 gap 이다. spec 영역에서 명시적으로 다루지 않으면 구현 시 조용한 계약 파괴 가능성이 있다.
- **제안**: spec 반영 시 §4(또는 §6.1.1 진입 API) 에 "`execute()` 는 Execution row 를 `pending` 으로 생성 후 `execution-run` 큐에 발행하고 즉시 반환한다(비동기)" 를 명시. 동기 결과를 소비하는 기존 caller 의 contract 변경 여부는 구현 선결조건으로 명시.

---

## 요약

target draft 는 `spec/5-system/4-execution-engine.md` §4·§7.1·§7.2·§7.4–7.5·§8 과 `spec/0-overview.md` §2.4·§2.6 을 재정의하는 내용을 담고 있으며, 기존 spec 과의 **직접 모순(CRITICAL)은 없다**. 현 spec §4.1–4.3 이 aspirational(미구현) 로 표기되어 있고, draft 가 이를 다른 aspirational 로 교체하는 구조이기 때문이다. 다만 §7.1 heartbeat 표현 폐기 선언, §7.2 체크포인트 표현의 per-node 뉘앙스 잔존, §8 timeout 기준 모호성, §9.3 큐 목록 누락이 WARNING 또는 INFO 수준의 동기화 요건으로 존재한다. spec 본문 반영 시 위 발견사항의 §들을 **동시에** 갱신하지 않으면 같은 문서 내 여러 섹션 간 표현 불일치가 남는다. `spec/1-data-model.md §2.13` 의 `WORKER_HEARTBEAT_TIMEOUT` 에러 코드 설명도 구현 단계에서 재검토 대상이다.

## 위험도

LOW

---

STATUS: OK

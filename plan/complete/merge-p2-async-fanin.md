---
worktree: (unstarted)
started: 2026-05-11
owner: developer
spec_impact:
  - spec/4-nodes/1-logic/11-merge.md
---

# Merge 노드 P2 — 비동기 fan-in barrier + timeout / partialOnTimeout 활성화

> 작성일: 2026-05-11
> 분리 출처: `logic-node-followups.md` §5 (D3 결정의 fallback 경로) — *2026-05-30 삭제된 문서라 링크하지 않는다. 그 §5 의 D3 결정 내용과 본 plan 분리 경위는 아래 §결정 히스토리에 요약돼 있다 (consistency `00_55_57` INFO#3).*
>
> ## 🏛 ADR 로 마감 (2026-07-17, 사용자 결정) — 미착수 종결
>
> **본 plan 의 수용 기준(§수용 기준) 두 번째 분기가 충족돼 `complete/` 로 종결한다**:
> *"§1 PoC 결과가 **비현실적** 이면, 본 plan 을 architectural decision record 로 마감하고 Merge spec 의
> dormant 표기를 명시적 'P3 (엔진 비동기 모델 도입 후 재검토)' 로 전환"*.
>
> **§1 PoC 를 실행하지 않고 종결하는 이유 — 그 사이 엔진이 답을 확정했다**: §1 PoC 가 답하려던 질문은
> "`runExecution` 루프를 비동기 dispatch 가능한 형태로 재설계할 수 있는가" 였다. 그런데 그 사이
> 실행 엔진이 **정반대 방향을 명문화**했다 —
> [`spec/5-system/4-execution-engine.md`](../../spec/5-system/4-execution-engine.md) §4 가
> "**per-node task queue(1 Worker = 1 NodeExecution)는 채택하지 않는다**",
> "**한 세그먼트 내부의 노드 dispatch 는 여전히 in-process while-loop — per-node `task-queue` 는
> 존재하지 않는다**" 로 확정하고 그 근거를 §Rationale "per-node → execution-level intake 큐" 에 남겼다.
> 엔진은 per-node 가 아니라 **execution-level intake 큐**(1 Worker = 1 active 세그먼트)를 택했고, 이는
> 컨테이너·중첩 스코프·back-edge·Parallel 의미론을 무변경 보존하려는 **의도된 설계 결정**이다.
> 즉 PoC 의 질문에 엔진 spec 이 이미 "하지 않는다" 로 답했으므로, PoC 를 돌리는 것은 이미 내려진
> 결정을 재확인하는 토큰 소모일 뿐이다. 본 plan 의 §선결 조건 1(엔진 비동기 dispatch 도입)이 기각된
> 이상 §2~§4 는 전제를 잃는다.
>
> **처분**:
> - ADR 본문 → [`spec/4-nodes/1-logic/11-merge.md` §Rationale `R-wontdo-async-fanin`](../../spec/4-nodes/1-logic/11-merge.md) 에 기록
>   (기각한 대안 2건 · 재검토 트리거 · 남은 UX 이슈 포함). `11-merge.md` 에 `## Rationale` 절 자체가
>   없었으므로 CLAUDE.md 3섹션 구성에 맞춰 **신설**했다.
> - spec dormant 표기 **P2 → P3** 전환 완료 (§1 note, §6 "Phase P2 예정" note).
> - `timeout` / `partialOnTimeout` 은 **무기한 dormant** 확정.
>
> **재검토 트리거**: 엔진이 per-node 비동기 dispatch 도입으로 **결정을 번복**하는 경우에 한함 —
> 그것은 Merge 가 아니라 실행 엔진 차원의 RFC 사안이다.
>
> **⚠ 사용자 판단 필요 (본 ADR 범위 밖, 종결과 무관)**: `timeout`/`partialOnTimeout` 이 무기한 dormant 인데도
> schema/UI 에 노출되며, 값을 설정하면 warningRule 이 기본 severity `blocking` 으로 평가돼 **캔버스 배지 +
> `handler.validate` 차단 에러**가 난다. 영구 dormant 필드를 노출한 채 설정 시 차단하는 것이 적절한지
> (필드 제거 vs severity 완화 vs 현행 유지)는 제품 결정이라 여기서 정하지 않았다 — `11-merge.md`
> §Rationale 말미에도 동일 내용을 남겨 durable 하게 추적한다.
>
> *`started: 2026-05-11` 이라 Gate C 는 grandfather 면제이나, 본 종결이 실제로 `11-merge.md` 를 갱신하므로
> `spec_impact` 를 자발 선언한다.*

## Context

Merge 노드의 `config.timeout` 과 `config.partialOnTimeout` 필드는 schema·UI 에 노출되어 있지만 P1 sequential 엔진에서는 dormant — `MergeHandler` 가 두 값을 받아 warn 로그 + `meta.dormantFields` 만 누적하고 실제 동작은 없다.

`logic-node-followups.md` D3 결정은 본 plan 에 흡수 활성화였으나, 활성화 작업의 선결 조건인 엔진 fan-in 모델을 조사한 결과(2026-05-11) **현 sequential 엔진에서는 의미 있는 barrier 구현이 불가능**한 것으로 판단되어 별도 plan 으로 분리한다.

## 조사 요약 (P1 sequential 엔진의 한계)

핵심 코드: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`

| 항목 | 현재 동작 | barrier 활성화 가능성 |
| --- | --- | --- |
| 노드 dispatch | 토폴로지 정렬 → 순차 포인터 루프 (`while (pointer < sortedNodeIds.length)` ~L1155-1376) | sequential 모델에서는 모든 predecessor 가 동시 해소됨 — "도착 순서" 개념 무의미 |
| `gatherNodeInput()` | `executedNodes.has(sourceId)` 확인 후 캐시에서 입력 수집 (~L3098-3115) | Merge dispatch 시점에 모든 predecessor 의 출력이 이미 `structuredOutputCache` 에 존재 |
| Background 노드 | BullMQ enqueue 후 즉시 main 포트로 진행 (~L1324-1333, L3665-3723) | Merge 가 background predecessor 를 가지면 background 가 완료되지 않은 상태로 "출력 캐시" 에 기록됨 → barrier 가 기다릴 의미 없음 |
| Per-edge 도착 추적 | 자료구조 부재 | barrier 활성화 시 신규 추가 필요 |
| Promise.race / timeout 패턴 | Sub-Workflow 전체 timeout, Background timeout 에만 사용 (~L1034-1081, L3750-3763) | per-branch 도착 대기 패턴 부재 |
| ParallelExecutor | `Promise.allSettled` + `p-limit` (parallel-executor.ts:42-112) | **공간 분할** (N branch 동시 실행). Merge 의 **시간 분할** (시간차 도착 대기) 와 패턴 다름 |

**결론**: barrier 자체는 작은 변경으로 흉내낼 수 있지만, `timeout` / `partialOnTimeout` 의 의미는 sequential 모델에서 본질적으로 성립하지 않는다 (모든 predecessor 가 한 번에 해소되어 "기다릴 시간" 자체가 0).

## 선결 조건 (활성화 전 필요한 엔진 변경)

P2 의미 있는 활성화는 다음 중 하나가 선결되어야 한다:

1. **엔진 비동기 dispatch 모델 도입** — `runExecution` 루프를 재설계해 "진행 중" 상태의 노드를 추적하고, 시간차 도착을 허용. 영향 범위: 모든 컨테이너 / non-container 실행 경로.
2. **Merge 전용 부분 비동기 처리** — Merge 노드만 도착 대기를 지원하도록 dispatch 분기. background 노드와의 호환성 처리 필요.
3. **Background 노드 동기 완료 대기 옵션** — Merge 가 background predecessor 를 가질 때 main 포트로 즉시 진행하지 않고 background 완료까지 대기. 사용자 의미 변경 우려.

각 옵션의 비용은 별도 조사 필요 — 본 plan 의 첫 작업 단위.

## 작업 단위

> **⛔ 전 항목 미착수 종결 (2026-07-17 ADR)**: 아래 §1~§4 의 미체크 항목은 **수행하지 않는다**.
> §1(PoC)은 엔진이 답을 확정해 불요, §2~§4 는 §1 을 전제로 하므로 함께 무효. 상단 ADR 배너 참조.
> 체크박스는 "미이행" 사실을 보존하기 위해 `[ ]` 그대로 둔다 — 완료가 아니라 **폐기**다.

### 1. 엔진 비동기 dispatch 가능성 검토 (필수 선결)

- [ ] `runExecution` 의 노드 스케줄링 루프 (1155-1376) 를 비동기 dispatch 가능한 형태로 리팩토링 가능한지 PoC
- [ ] 기존 컨테이너 실행 경로 (`runContainer`, `runParallel`, `runForeach`) 와의 양립성 검증
- [ ] Background 노드와의 상호작용 케이스 도출
- [ ] 기존 단위/통합 테스트 회귀 영향 추정
- [ ] (EIA cross-ref) [Spec External Interaction API §R7](../../spec/5-system/14-external-interaction-api.md) 의 monotonic seq 보장 검증 — 비동기 dispatch 후에도 `WebsocketService.emitExecutionEvent` 의 in-memory seq counter (PR2 P0 도입) 가 같은 execution 내 단조 증가하는지 PoC 안에 포함. 분산/병렬 환경에서 race 가 발견되면 EIA §R7 보강 노트의 "Redis INCR 또는 DB row-level lock" 으로 강화 follow-up.
  - **(업데이트 2026-06-27)** 강화 follow-up 은 **완료**: in-memory v1 → `ExecutionSeqAllocator`(Redis `INCR`, Redis-only) 채택([`plan/complete/eia-distributed-seq-counter.md`](../complete/eia-distributed-seq-counter.md)), 부하 하 단조성·latency 는 EIA-NF-06/07 로 정량화·실-Redis e2e 검증(PR #730). 본 PoC 항목은 비동기 dispatch 후 단조성 PoC 포함 여부만 merge-p2 범위로 잔존.

→ 결과에 따라 §2 진행 여부 / 범위 결정.

### 2. Merge fan-in barrier 구현 (PoC 통과 시)

- [ ] `MergeHandler` 에 per-edge 도착 상태 추적
- [ ] `setTimeout` 기반 timeout 타이머 + cleanup
- [ ] `partialOnTimeout=true` 시 도착한 입력만 strategy 적용
- [ ] `MERGE_TIMEOUT` 에러 코드 + Merge 노드 schema 에 `error` 포트 추가
- [ ] `meta.timeoutTriggered` / `meta.arrivedBranches` 신규 메트릭
- [ ] `meta.dormantFields` 제거 (활성 표기로 전환)

### 3. spec / 문서 동기화

- [ ] `spec/4-nodes/1-logic/11-merge.md` 의 dormant 표기 → 활성 표기로 전환 (L7-9, L19-20, L74-75, L132, L187, L203)
- [ ] frontend MDX (`logic.mdx` / `logic.en.mdx`) 의 timeout / partialOnTimeout 설명 갱신
- [ ] 마이그레이션 영향 — 기존 워크플로의 `timeout > 0` 설정이 이제 동작하므로, 사용자에게 미리 공지 필요

### 4. 검증

- [ ] backend lint / unit / integration / build 통과
- [ ] frontend lint / build 통과
- [ ] 통합 테스트 — timeout 도달 + partial off (throw) / on (부분 결과), 정상 완료 회귀
- [ ] background predecessor 시나리오의 동작 명세 + 테스트
- [ ] ai-review Critical/Warning 0

## 수용 기준

- ~~§1 PoC 결과가 "가능" 이면 §2~§4 모두 완료~~ → **미해당** (엔진이 per-node dispatch 미채택 확정)
- [x] §1 PoC 결과가 "비현실적" 이면, 본 plan 을 **architectural decision record** 로 마감하고 Merge spec 의 dormant 표기를 명시적 "P3 (엔진 비동기 모델 도입 후 재검토)" 로 전환 → **이 분기로 종결 (2026-07-17)**. ADR = `11-merge.md` §Rationale `R-wontdo-async-fanin`, dormant 표기 P2→P3 전환 완료. 상단 배너 참조.

## 의존성·리스크

- **의존**: 엔진 비동기 dispatch 모델 도입 결정 (별도 RFC 후보)
- **리스크**:
  - 엔진 비동기화는 본 plan 단독으로 결정할 수 있는 변경이 아님 — 워크플로 결정성 / 디버깅 / Background 노드 의미 등 광범위 영향
  - 부분 비동기화 (Merge 만) 는 코드 복잡도 증가 + 두 dispatch 모델 공존 부담
  - "도착 순서" 의미가 사용자 워크플로에서 어떻게 표현되어야 하는지 PRD 차원의 정의 필요

## 결정 히스토리

- 2026-05-11: D3 (사용자) — "본 plan(logic-node-followups) 에 흡수" 결정. 그러나 엔진 조사 결과 sequential 모델에서 진정한 barrier 가 불가능하여 본 plan 으로 분리. 원 plan 의 §5 는 dormant spec 정합 마감으로 종료.

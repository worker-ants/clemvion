# Merge 노드 P2 — 비동기 fan-in barrier + timeout / partialOnTimeout 활성화

> 작성일: 2026-05-11
> 분리 출처: `../complete/logic-node-followups.md` §5 (D3 결정의 fallback 경로)

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

### 1. 엔진 비동기 dispatch 가능성 검토 (필수 선결)

- [ ] `runExecution` 의 노드 스케줄링 루프 (1155-1376) 를 비동기 dispatch 가능한 형태로 리팩토링 가능한지 PoC
- [ ] 기존 컨테이너 실행 경로 (`runContainer`, `runParallel`, `runForeach`) 와의 양립성 검증
- [ ] Background 노드와의 상호작용 케이스 도출
- [ ] 기존 단위/통합 테스트 회귀 영향 추정
- [ ] (EIA cross-ref) [Spec External Interaction API §R7](../../spec/5-system/14-external-interaction-api.md) 의 monotonic seq 보장 검증 — 비동기 dispatch 후에도 `WebsocketService.emitExecutionEvent` 의 in-memory seq counter (PR2 P0 도입) 가 같은 execution 내 단조 증가하는지 PoC 안에 포함. 분산/병렬 환경에서 race 가 발견되면 EIA §R7 보강 노트의 "Redis INCR 또는 DB row-level lock" 으로 강화 follow-up.

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

- §1 PoC 결과가 "가능" 이면 §2~§4 모두 완료
- §1 PoC 결과가 "비현실적" 이면, 본 plan 을 **architectural decision record** 로 마감하고 Merge spec 의 dormant 표기를 명시적 "P3 (엔진 비동기 모델 도입 후 재검토)" 로 전환

## 의존성·리스크

- **의존**: 엔진 비동기 dispatch 모델 도입 결정 (별도 RFC 후보)
- **리스크**:
  - 엔진 비동기화는 본 plan 단독으로 결정할 수 있는 변경이 아님 — 워크플로 결정성 / 디버깅 / Background 노드 의미 등 광범위 영향
  - 부분 비동기화 (Merge 만) 는 코드 복잡도 증가 + 두 dispatch 모델 공존 부담
  - "도착 순서" 의미가 사용자 워크플로에서 어떻게 표현되어야 하는지 PRD 차원의 정의 필요

## 결정 히스토리

- 2026-05-11: D3 (사용자) — "본 plan(logic-node-followups) 에 흡수" 결정. 그러나 엔진 조사 결과 sequential 모델에서 진정한 barrier 가 불가능하여 본 plan 으로 분리. 원 plan 의 §5 는 dormant spec 정합 마감으로 종료.

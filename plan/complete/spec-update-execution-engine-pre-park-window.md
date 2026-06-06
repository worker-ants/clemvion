---
worktree: .claude/worktrees/spec-pre-park-window-doc
started: 2026-06-06
owner: project-planner
status: complete
spec_impact: [spec/5-system/4-execution-engine.md]
---
# Spec Update — execution-engine pre-park window & defense-in-depth

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) — 두 항목 통합. **반영 완료**.

## 작업 항목
- [x] `/consistency-check --spec` 수행 (2026-06-06 15_05_45 — BLOCK: NO, INFO만)
- [x] spec §1.1 에 "Pre-park read-window 정규화 (intra-row inconsistency)" blockquote 삽입
- [x] spec `## Rationale` 에 "Pre-park read-window 정규화 — read-side 채택 + 양측 중복 방어" 항목 추가
- [x] 참조 완전 경로화 + cross-entity 배경 포함 (consistency INFO #3·#5·#10 반영)

## 처리 결정 (2026-06-06)
#498(코드 fix) 머지 후, 사용자 요청으로 **별도 PR(`claude/spec-pre-park-window-doc`)** 에서
spec 에 반영. `/consistency-check --spec` BLOCK: NO 확인 후 §1.1 본문 + Rationale 에 적용 완료.

> **삽입 순서 NOTE (impl-done consistency W-1)**: 본 §1.1 삽입은 `exec-park-durable-resume`
> Phase-B 의 §1.1 전이표 편집과 **순서 의존**이다 (텍스트 충돌 아님). 반영 시점에
> **그때의 main HEAD 기준으로 §1.1 원자성 보장 blockquote 의 정확한 끝 위치를 재확인**한
> 뒤 신규 blockquote 를 삽입할 것. exec-park Phase-B spec 갱신이 main 에 먼저 랜딩되면
> 그 결과 뒤에 이어 붙인다.

## 원본 발견사항

SUMMARY#1: `spec/5-system/4-execution-engine.md` §1.1 "원자성 보장" 이 `pre-park window` intra-row inconsistency 와 `reconcilePreParkWaitingStatus` 보정 전략을 기술하지 않음. 코드가 올바르고 spec 이 낡음.

SUMMARY#2: frontend `isNodeWaitingForInput` 의 "WS snapshot·read-replica 경로에서도 intra-row 도달 가능" 2차 defense-in-depth 전략이 spec 에 미기재.

## 배경
`executeNode` blocking 분기는 핸들러 봉투 `outputData.status='waiting_for_input'` 를
**NodeExecution.status 컬럼이 아직 `running` 인 채** 먼저 저장하고, 직후 `waitForXxx` 가
NodeExecution.status 를 `waiting_for_input` 으로 atomic 전이한다. 두 save 사이의
read window 에서 snapshot 이 읽히면 `status='running' + outputData.status='waiting_for_input'`
인 intra-row inconsistent row 가 소비자에게 노출된다.

기존 Phase 3 fix (REPEATABLE READ 트랜잭션)는 Execution.status vs NodeExecution.status
cross-query straddle 만 막는다 — intra-row(컬럼 vs outputData 봉투) 불일치는 잡지 못한다.

해결책으로 두 레이어에 독립 방어를 도입했다:
1. **Backend read-side normalization**: `executions.service.ts:findById` 가
   `reconcilePreParkWaitingStatus` 로 snapshot 단계에서 봉투 status 를 surface.
2. **Frontend defense-in-depth**: `apply-execution-snapshot.ts:isNodeWaitingForInput` 이
   `ne.status` 뿐 아니라 `outputData.status` 봉투도 함께 확인해 WS snapshot·read-replica
   경로에서도 intra-row를 잡는다.

## 제안 변경

### spec/5-system/4-execution-engine.md §1.1

현행 §1.1 원자성 보장 blockquote 끝에 다음 항목을 추가한다.

**before** (현행 끝):
```
> **원자성 보장**: `running ↔ waiting_for_input` 전이는 짝이 되는 `NodeExecution` 상태 변경 (`waiting_for_input` / `completed`) 과 **단일 DB 트랜잭션** 으로 묶여 commit / rollback 된다. 서버가 두 save 사이에 크래시해도 `Execution` 과 `NodeExecution` 의 상태 불일치가 발생하지 않는다 (구현: `ExecutionEngineService.updateExecutionStatus` 의 `linkedNodeExec` 파라미터). WebSocket 이벤트 발행은 트랜잭션 commit 후 수행한다. `waiting_for_input → failed` 전이도 동일한 원자성 — `NodeExecution.status=FAILED` save + `Execution.status=FAILED` 가 단일 트랜잭션으로 묶이고, WS 이벤트 순서는 `NODE_FAILED` → `EXECUTION_FAILED`.
```

**after** (위 blockquote 내용 뒤에 신규 blockquote 삽입):
```
> **Pre-park read-window 정규화 (intra-row inconsistency)**: `executeNode` blocking 분기는 핸들러 봉투 (`NodeHandlerOutput.status='waiting_for_input'`) 를 `NodeExecution.outputData` 에 **먼저** 저장하고 `NodeExecution.status` 컬럼은 `running` 으로 유지한 채 직후 `waitForXxx` 가 atomic 전이한다. 두 save 사이의 read window 에서 snapshot 이 조회되면 같은 row 가 `status='running'` 인데 `outputData.status='waiting_for_input'` 인 **intra-row inconsistent** 상태로 노출된다 — 위 cross-entity 원자성 보장은 이 창을 막지 않는다.
>
> 이 창은 두 레이어에서 방어된다:
>
> 1. **Backend read-side normalization** (`executions.service.ts:findById` — `reconcilePreParkWaitingStatus`): snapshot 응답 직전, `status=running|pending` 이면서 `outputData.status='waiting_for_input'` 인 row 의 status 를 `waiting_for_input` 으로 surface 한다. DB write 와 엔진 원자성은 불변(read-only 정규화). 모든 snapshot 소비자(웹 앱·channel-web-chat·external-interaction-api)에 일관 적용된다.
>
> 2. **Frontend defense-in-depth** (`apply-execution-snapshot.ts:isNodeWaitingForInput`): WS snapshot 이벤트·read-replica 경로·legacy 응답 shape 등 backend normalization 이 적용되지 않은 경로에서도 intra-row 를 탐지할 수 있도록, frontend 가 `ne.status === 'waiting_for_input'` 단 필드만 신뢰하지 않고 `ne.outputData.status === 'waiting_for_input'` 봉투도 함께 확인한다(`running|pending` row 한정, terminal row 제외). 이 두 레이어는 **의도적 중복 방어**이며, 한쪽만 변경할 경우 불일치 창이 재개방된다 — 변경 시 양측을 동기화할 것.
```

### 변경 이유 (Rationale)
- spec §1.1 은 cross-entity 원자성(Execution↔NodeExecution 전이)만 기술하고 intra-row(컬럼 vs outputData) 창을 다루지 않아 코드 동작의 설계 의도를 추론할 수 없다.
- `reconcilePreParkWaitingStatus` 와 `isNodeWaitingForInput` 이 왜 outputData 봉투를 함께 보는지, 왜 running/pending 만 채택하고 terminal 을 제외하는지 spec 레벨 근거가 없어 유지보수자가 조건 변경의 위험을 인식하지 못한다.
- 두 함수의 "의도적 중복 방어" 관계를 spec 에 선언해 향후 한쪽만 수정되는 사고를 구조적으로 차단한다.

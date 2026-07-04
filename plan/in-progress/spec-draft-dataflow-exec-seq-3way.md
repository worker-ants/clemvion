---
worktree: dataflow-exec-seq-338f46
started: 2026-07-04
owner: project-planner
spec_impact:
  - spec/data-flow/3-execution.md
---

# spec-draft — data-flow §1.1 시퀀스 다이어그램 `runExecutionFromQueue` 3-way 반영

## 배경 (실제 갭)

`exec-intake-queue-impl.md` line 27 이 "§1.1 시퀀스 다이어그램이 old in-process 흐름 기술" 을 잔여로 남겨뒀으나, **그 표현은 이미 낡음** — §1.1 다이어그램은 이미 `execute()→INSERT pending→execution-run add→runExecutionFromQueue→SELECT pending 재검증` intake 큐 모델을 정확히 그린다.

대신 **PR4(#798) drift** 가 있다: 다이어그램의 `alt` 분기가 여전히 PR1~PR3 시절 **2-way**(`status !== pending → ack-discard` / `pending → run`)다. PR4 에서 `runExecutionFromQueue` 는 **3-way**가 됐다(코드 `execution-engine.service.ts` 확인):

- (a) `PENDING` → 정상 첫 active 세그먼트 시작.
- (b) `RUNNING` → **BullMQ stalled 재배달**(워커 크래시). `recordRunningSegmentStart` + `redriveStuckExecution`(§7.5 case B 재구동). ← **다이어그램 누락, 현재 (c)로 오분류돼 "ack-discard" 로 잘못 표현됨.**
- (c) terminal(completed/failed/cancelled)·`waiting_for_input` → ack-discard(재실행 금지).

## 변경 (§1.1 mermaid `alt` 블록)

**before**
```
  alt status !== pending (큐 대기 중 cancel 등)
    Eng-->>Proc: ack-discard (재실행 금지)
  else pending
    Eng->>Eng: routing context 재등록 (triggerId 있을 때 — consume 한 인스턴스에 등록)
    Eng->>Eng: runExecution(execution, input) — §1.2 첫 active 세그먼트
  end
```

**after** (3-way — RUNNING stalled 재배달 arm 추가)
```
  alt status == 'running' (BullMQ stalled 재배달 — 워커 크래시, §7.1)
    Eng->>Eng: recordRunningSegmentStart + redriveStuckExecution(executionId)
    Note over Eng: §7.5 case B 재구동 (완료 노드 skip) — 상세 §3.3
  else status ∉ {pending, running} (terminal / waiting_for_input — 큐 대기 중 cancel·park 등)
    Eng-->>Proc: ack-discard (재실행 금지)
  else pending
    Eng->>Eng: routing context 재등록 (triggerId 있을 때 — consume 한 인스턴스에 등록)
    Eng->>Eng: runExecution(execution, input) — §1.2 첫 active 세그먼트
  end
```

+ prose bullet 1줄 추가(3-way 요약, §7.1/§3.3 링크).

## side-effect
- 순수 문서 drift 정정(코드 무변경). §3.3(비정상 종료 회수 표) / §7.5(case B) 는 PR4 에서 이미 stalled 재배달 반영 완료 — §1.1 다이어그램만 잔여였다.
- `exec-intake-queue-impl.md` line 27 의 "잔여" 를 closed 로 정리(plan-hygiene).

## Rationale
- 신규 설계 아님 — PR4 로 이미 구현·spec(§7.1/§7.5/§3.3) 반영된 3-way 를 §1.1 다이어그램에만 뒤늦게 정합화하는 drift cleanup.

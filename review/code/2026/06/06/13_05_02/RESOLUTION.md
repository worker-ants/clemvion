# RESOLUTION — exec-park-b2b-04a2f8 / 2026-06-06T13_05_02

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 (Testing) | e8aaeaa7 | driveCallStackResume/driveResumeFrame/injectInvokerOutput 단위 테스트 5케이스 신설 |
| #2 | 코드 (Testing) | e8aaeaa7 | resumeFromCheckpoint callStack non-null 분기 통합 테스트 (spyOn + version:999 가드) |
| #6 | 코드 (Requirement) | e8aaeaa7 | frames.length===0 방어 가드 — try 블록 내 RehydrationError |
| #7 | 코드 (Testing) | e8aaeaa7 | WorkflowHandler ParkReleaseSignal re-throw 케이스 단위 테스트 추가 |
| #8 | 코드 (Testing) | e8aaeaa7 | executeInline _callStack 스택 적재/반환 동작 4케이스 단위 테스트 추가 |
| #9 | 코드 (Testing) | e8aaeaa7 | park-release-signal.spec.ts 신설 (4케이스) |
| #10 | 코드 (Testing) | e8aaeaa7 | snapshotCallStack 테스트 하드코딩 1 → CALL_STACK_SCHEMA_VERSION 상수 |
| #11 | 코드 (Documentation) | e8aaeaa7 | waitForFormSubmission @todo B3 리마인더 주석 복원 |
| #16 (INFO) | spec (SPEC-DRIFT) | (draft 위임) | plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md |
| #17 (INFO) | spec (SPEC-DRIFT) | (draft 위임) | plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md |

### 부가 코드 개선 (INFO 항목)

| INFO # | 조치 | 비고 |
|--------|------|------|
| INFO#8 | 코드 | NESTED_FIRE_MAX_ATTEMPTS/NESTED_FIRE_POLL_MS → private static 상수 승격 |
| INFO#9 | 코드 | injectInvokerOutput contextKey 중복 호출 제거 |

## TEST 결과

- lint  : 통과 (0 errors, 43 warnings — 모두 기존 파일 pre-existing)
- unit  : 통과 (6354 passed, 1 skipped — 모두 pre-existing skip)
- build : 통과 (backend; frontend next: command not found — pre-existing worktree 환경 문제)
- e2e   : 통과 (175/175)

## 보류·후속 항목

### Architecture (W#1, W#2, W#3) — full B3 착수 시 처리

- WARNING #1: ExecutionEngineService SRP 위반 → NestedResumeOrchestrator/CallStackResumeService 추출 (full B3)
- WARNING #2: ParkReleaseSignal 예외-흐름 안티패턴 → NodeHandlerOutput 유니언 반환 패턴 전환 (full B3)
- WARNING #3: driveCallStackResume 책임 집중 → 헬퍼 분리 (full B3)

참조: plan/in-progress/exec-park-durable-resume.md §PR-B2b 진행 상태 / §B3

### WARNING #4 (Requirement) — 이미 해결됨

markExecutionCancelled/markNodeExecutionFailed 양쪽 모두 내부 try/catch 로 2차 예외를 suppress. 추가 조치 불필요.

### WARNING #5 (Requirement) — 과도기 보류

fireNested polling 5초 한도 초과 시 silent drop — B3 전 과도기 설계. 기존 warn log 존재. full B3 에서 fireNested 자체 제거 예정.

### SPEC-DRIFT 위임

- plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md
  → spec §7.5 step 2 문구 갱신 (project-planner 위임, ESCALATE=spec)

### Architecture (W#1/W#3) 인용 — 본 PR 의 의도적 과도기 코드

본 PR-B2b 는 "durable nested sub-workflow resume" 의 중간 단계. pendingContinuations/
firePayload/barriers/runAiConversationLoop 의 in-memory continuation machine 은
의도적으로 남겨진 과도기 코드 (full B3 제거 대상). 이에 대한 리뷰 발견이
SPEC-DRIFT 또는 과도기 기술 부채로 분류된 것은 예상된 결과.

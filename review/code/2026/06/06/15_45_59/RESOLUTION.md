# RESOLUTION — 15_45_59

> PR-B2b "full B3" 코드 리뷰 후속 처리 (0 Critical, 12 Warnings)
> 처리 범위: SUMMARY W1–W7, W10 (코드·테스트). W8/W9(SPEC-DRIFT) 는 부모 에이전트가 spec 편집 중. W11/W12 는 아키텍처 개선으로 deferred.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드/테스트 | `a053630f` | `processFormResumeTurn` 4-branch 단위 테스트 추가: sentinel unwrap, non-sentinel warn 폴백, RUNNING skip-transition vs !RUNNING transition, nodeExec null skip |
| #2 | 테스트 | (기존 커버) | `driveCallStackResume/driveResumeFrame` version-guard·multi-frame·bubble-up·ParkReleaseSignal 이미 CRITICAL #1/C2-b 에서 커버됨 — 추가 불필요 |
| #3 | 테스트 | `a053630f` | nested-AI re-park 시 `driveResumeFrame {parked:true}` → `runNodeDispatchLoop` 미호출 검증 추가 |
| #4 | 테스트 | (기존 커버) | `applyCancellation` `affected:0`/`affected:1` — `cancelParkedExecution (W10)` describe 블록에서 이미 커버됨 |
| #5 | 테스트 | `a053630f` | `runExecution` spy `mockRejectedValueOnce` → `failFirstSegmentSetup` 직접 spy 호출 검증 추가 |
| #6 | 코드/테스트 | `a053630f` | `rehydrateAndResume` outer catch 가 예외 흡수 확인 (드라이브 자체 catch + outer catch 이중 방어) + 검증 테스트 |
| #7 | 코드/테스트 | `a053630f` | `runExecutionFromQueue` catch 블록 내 `failFirstSegmentSetup(..).catch(secondary logger)` 추가 — BullMQ 이중 재시도 방지 + 검증 테스트 |
| #8 | SPEC-DRIFT | (부모 병렬 처리 중) | `spec/5-system/4-execution-engine.md §7.5` 흐름도 갱신 — 부모가 `spec/` 편집 중 |
| #9 | SPEC-DRIFT | (부모 병렬 처리 중) | spec 상태 전이표·§12.2 갱신 — 부모가 `spec/` 편집 중 |
| #10 | 코드 | `a053630f` | `rehydrateAndResume` 스테일 주석 정정: "drive detached" → "drive awaited", `pendingContinuations` 언급 제거, 로그 메시지 갱신 |
| #11 | Architecture | (deferred) | `ProcessTurnResult` named type alias — 저위험 유지보수성 개선, 보류 |
| #12 | Architecture | (deferred) | `updateExecutionStatus` 멱등 가드 / `alreadyRunning` 파라미터 — 저위험 DRY 개선, 보류 |

## TEST 결과

- lint  : 통과 (backend 0 errors, 43 pre-existing warnings; frontend eslint/vitest 바이너리 미설치는 pre-existing worktree infra 이슈)
- unit  : 통과 (326 suites, 6357 passed, 1 skipped — 신규 테스트 포함)
- e2e   : 통과 (176 passed)

## 보류·후속 항목

- SUMMARY #11 (Architecture): `ProcessTurnResult = void | ParkSignal` named type alias — 컴파일 타임 계약 개선. 저위험. 다음 정기 유지보수 배치.
- SUMMARY #12 (Architecture): `updateExecutionStatus` 멱등 가드 또는 `alreadyRunning` 명시 파라미터 — DRY 개선. 저위험. 다음 정기 유지보수 배치.
- SUMMARY #8 / #9 (SPEC-DRIFT): 부모 에이전트가 `spec/5-system/4-execution-engine.md` 병렬 편집 중 — 본 sub-agent 는 spec 파일 무수정.
- INFO 항목들: 전부 INFO 수준 — 자동 수정 대상 아님.

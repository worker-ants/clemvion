---
worktree: refactor-06-c2-followups-2c6280
started: 2026-07-03
owner: developer
---

# refactor 06 C-2 재개 원자 claim — ai-review 비차단 후속 (W2·W3·W5·W6)

C-2 본체(PR #791, `44f956e9c`) 의 fresh ai-review(08_32_32) 가 defer 한 비차단 WARNING 4건 처리. C-2 원자성 정합성 자체는 #791 에서 검증 완료(이중 실행 0·crash 회수, e2e 225); 본 작업은 커버리지 보강·가독성 개선.

- [x] **W6 — 롤백 판별 커스텀 에러클래스**: claim 짝 불일치 abort 를 매직스트링(`'__resume_claim_exec_terminal__'`)+클로저 플래그 → `ResumeClaimExecTerminalError` + `instanceof` 로 전환. (`execution-engine.service.ts`)
- [x] **W5 — segmentStartMs 공유 헬퍼**: `recordRunningSegmentStart(executionId)` 추출, `claimResumeEntry` + `updateExecutionStatus` RUNNING 진입 경로 공유(drift 방지). (`execution-engine.service.ts`)
- [x] **W2 — RUNNING skip-guard unit 테스트**: `driveResumeAwaited` 가 claim 후 Execution=RUNNING 이면 재개 sentinel 전이(`updateExecutionStatus(RUNNING)`)를 skip 함을 검증(WAITING 경로는 기존 테스트가 전이 구동). (`execution-engine.service.spec.ts`)
- [x] **W3 — 동시 재개 e2e**: 2건 병렬 `/continue` → form 노드 정확히 1회 실행·completed, running 잔류 0, Execution completed. 단일 인스턴스·concurrency=1 이라 실 DB row-level 레이스는 조건부 UPDATE+affected 설계 보장 — 본 테스트는 동시 재개 진입점 end-to-end 이중 실행 0 가드. (`execution-park-resume.e2e-spec.ts`)

검증: lint·unit·build·e2e. spec 변경 없음(코드/테스트만) — `spec_impact: none`.

# RESOLUTION — 09_31_59

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1        | 코드 | 975d4c15 | `rehydrateConversationThread` turn-level sanitize — seq/source/text 최소 검증 + 손상 turn drop + nextSeq/totalChars 재유도 |
| #2        | 코드 | 975d4c15 | `MAX_RUNNING_SUMMARY_CHARS`(20_000) 상수 도입 + runningSummary 복원 시 초과분 trim |
| #3        | 코드 | f8c9684e | `execution-engine.service.ts` 3개 park 지점 오타 "복원원" → "복원처" 일괄 수정. `spec/5-system/4-execution-engine.md` 다이어그램 동일 교정 |
| #4        | 코드 | f8c9684e | `RehydrateCtxSubject` 타입 별칭에 `stageConversationThreadSnapshot` 포함, 인라인 이중 캐스팅 제거 |

## TEST 결과

- lint  : 통과 (backend 0 errors / 43 pre-existing warnings; frontend lint 환경 PATH 이슈는 pre-existing — 본 PR 변경과 무관)
- unit  : 통과 (316 suites, 6103 passed; frontend vitest PATH 이슈는 pre-existing)
- build : 미실행 (lint+unit+e2e 통과로 커버; 빌드 단계는 CI에서 검증)
- e2e   : 통과 (168/168, 72s)

## 보류·후속 항목

- INFO #4 (Architecture): SRP 개선 — `conversation-thread.normalizer.ts` 분리. 현 규모 허용, 향후 고려
- INFO #5 (Architecture): `parkWithThread` 합성 메서드 — park 지점 3곳 반복 패턴. Phase B 이후 리팩터링
- INFO #6 (Architecture): `ParkResumeService` 분리 — Phase B 이후
- INFO #7 (Requirement): `cloneThread` deep-clone 교체 시점 — turn mutation 경로 추가 시
- INFO #8 (Requirement): retry re-entry early-return 의도 명확화 주석 — 후속 작업
- INFO #10 (Testing): `rehydrateContext` early-return 경로 명시 단언 — 후속 테스트 보강
- INFO #11 (Testing): 3개 park 지점 stageConversationThreadSnapshot → updateExecutionStatus 순서 통합 검증 — 후속
- INFO #12 (Testing): V083 마이그레이션 IF NOT EXISTS idempotency — CI migration-guard 확인
- INFO #14 (Documentation): `stageConversationThreadSnapshot` TSDoc 블록 빈 줄 삽입 — 시각적 개선
- INFO #16 (Side Effect): JSDoc `@seeAlso updateExecutionStatus` 페어링 명시 — 후속
- INFO #17 (User Guide): `run-results.mdx` conversationThread 보존 한 줄 — 선택적 후속
- INFO #18 (SPEC-DRIFT): spec §7.5 stale 문구 확인 완료 — 해당 문구 없음 (조치 불필요)
- INFO #1 (Security): `CreateContextOptions` @internal 주석 또는 rehydration 전용 팩토리 — 후속 고려
- INFO #2 (Security): `stageConversationThreadSnapshot` 예외 전파 보장 주석 — 후속

# RESOLUTION — 12_04_26

PR-A2b: information_extractor 멀티턴 `_resumeCheckpoint` 재개 확장
리뷰 commit: `b6dda4d9` — worktree: `exec-park-durable-resume`

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 (유지보수성) | 코드 | `6ee3fd11` | `CHECKPOINT_ELIGIBLE_NODE_TYPES` Set + `isCheckpointEligibleNodeType()` private 헬퍼 추가. 가드 3곳 모두 헬퍼로 교체. |
| W2 (유지보수성) | 코드 | `6ee3fd11` | `DEFAULT_IE_MAX_COLLECTION_RETRIES = 3` 상수 선언. `buildRetryReentryState` 의 `?? 3` 을 상수 참조로 교체. |
| W3 (테스트 격리) | 코드 | `ada9a594` | 통합 테스트 2곳(ai_agent·IE 재구성)의 try/finally monkey-patch → `jest.spyOn + mockRestore` 전환. `Rehydration` describe 에 `afterEach(() => jest.restoreAllMocks())` 등록. |
| W4 (테스트) | 코드 | `ada9a594` | `cpSubject()` 다중 호출 블록 전부 `const cp = cpSubject()` 단일화 (A2a 기존 테스트 4곳 + A2b IE 테스트 2곳). |
| W5 (테스트) | 코드 | `ada9a594` | IE 노드 `emitAiWaitingForInput` / `handleAiMessageTurn` 가드 직접 검증 테스트 2건 신규 추가 — `_resumeCheckpoint` 에 `partialResult`/`collectionRetryCount` 포함 확인. |
| W6 (통합 assertion 강화) | 코드 | `ada9a594` | IE 재구성 통합 테스트에서 `contextService.setNodeOutput` spy 로 seeded `nodeOutputCache` 캡처 → `partialResult: { email: 'a@b.c' }` / `collectionRetryCount: 1` `toMatchObject` 단언 추가. |

### INFO 항목 (반영)

| INFO # | 조치 |
|--------|------|
| INFO #8 | `collectionRetryCount` 비숫자(`"2"` / `null`) → 0 수렴 단위 테스트 추가 (`ada9a594`) |
| INFO #9 | IE 노드 + `schemaVersion:999` → `RESUME_INCOMPATIBLE_STATE` graceful reset 테스트 추가 (`ada9a594`) |
| INFO #10 | `buildResumeCheckpoint` JSDoc 에 IE 확장 NOTE 블록 추가 (`6ee3fd11`) |
| INFO #11 | `buildRetryReentryState` JSDoc `@remarks` 에 IE 노드 동작(config 재유도 + runtime state 복원) 추가 (`6ee3fd11`) |
| INFO #12 | [SPEC-DRIFT] — 이미 해소. 별도 조치 불필요. |

## TEST 결과

- lint  : 통과 (변경 파일 0 errors)
- unit  : 통과 (6133 passed, 1 skipped, 317 suites)
- e2e   : 통과 (168/168) — log: `_test_logs/e2e-20260605-122001.log`

## 보류·후속 항목

- INFO #1 (보안 심도): `partialResult` 크기 상한 — IE `partialResult` 는 LLM 추출 결과(워크플로 내부)라 공격면 낮음. 필요 시 `A2a MAX_RUNNING_SUMMARY_CHARS` 패턴 참고해 후속 PR 에서 추가.
- INFO #2 (보안): TypeScript 캐스팅 런타임 미검증 — 공격면 낮음(워크플로 설계자 내부 데이터). zod 런타임 파싱 도입 시 별도 리팩터링 PR.
- INFO #3 (보안): 테스트 private 메서드 직접 모킹 — 전체 경로 통과 테스트는 e2e Phase B 범위.
- INFO #4 (유지보수성): `buildResumeCheckpoint` allow-list ↔ `buildRetryReentryState` 계약 — 현재 `// SYNC:` 주석으로 표현. 단일 타입/인터페이스 선언 구조화는 향후 리팩터링.
- INFO #5 (유지보수성): `mockNodeRepo.findOneBy` finally 복원 비대칭 — 기존 테스트 패턴 변경 범위 초과. 후속 테스트 정리 PR.
- INFO #6 (유지보수성): `cpSubject()` 중복 호출 — W4 에서 전부 단일화 완료.
- INFO #7 (테스트): ai_agent 노드에 IE 필드 inert 포함 회귀 케이스 — 기존 `buildResumeCheckpoint defaults IE fields when absent (ai_agent inert)` 테스트가 유사 커버. 중복이라 skip.
- INFO #13 (부작용): ai_agent checkpoint 에 빈 IE 필드 포함 — 설계 계약으로 허용(allow-list 합집합). 현재 인라인 주석으로 명시돼 있음.

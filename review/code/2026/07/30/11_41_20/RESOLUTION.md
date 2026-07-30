# RESOLUTION — 2026/07/30/11_41_20

Critical 0건 (7라운드 수렴 확인 — 14개 reviewer 전원이 6R 수정의 정확한 적용을 독립 확인).
지시된 5건(W1/W2/W3/W4/W6)만 집행하고 W5/W7/W8/W9 는 지시대로 defer/저비용 정리만 수행.
구조 변경·리팩토링 없음.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | spec (SPEC-DRIFT) | (draft 위임) | `plan/in-progress/spec-update-retry-claim-backstop-gap.md` — 코드 무수정, project-planner 위임 |
| #2 | 코드(문서) | `7a05c6ec8` | `claimSpawnedRetryRow` JSDoc 자기모순(백스톱 커버리지 구/신 문단) 정정 |
| #3 | 코드(문서/구조) | `7a05c6ec8` | 재진입 절차 JSDoc 2곳의 stale `runAiConversationLoop` 참조 → `processAiResumeTurn`/`PARK_RELEASED` 정정 |
| #4 | 코드(테스트) | `886ca9395` | claim 성공+in-memory `_retryState` 부재 방어 분기 회귀 테스트 추가(mutation 검증 완료) |
| #5 | 코드(구조, defer) | — | `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #18 신규 등재 (P2) |
| #6 | 코드(부작용+테스트) | `7a05c6ec8`, `886ca9395` | `NODE_STARTED` payload 의 `_retryState` 비노출을 JSDoc 명시 + 회귀 테스트(mutation 검증 완료) |
| #7 | 코드(유지보수, defer) | — | 같은 plan §코드 표 #19 신규 등재 (P3) |
| #8 | 코드(유지보수, defer) | — | 같은 plan §코드 표 #9 (1R W3 = 5R W5) 에 "7R 재지적" 만 추가, 신규 등재 없음 |
| #9 | 의존성(저비용 허용분) | `7a05c6ec8` | typeorm 0.3.30 주석 → "버전-불문 방어" 로 다듬기만(체크리스트 신설 없음) |

관련 plan 문서 위생 정리(라운드 이력·검증 근거 기록): `986ea0c23`.

## TEST 결과

- lint  : 통과 (45s)
- unit  : 통과 — backend 412 suites/8338 tests(1 skipped, 8337 passed, 신규 2건 포함) ·
  frontend 281 files/5751(1 skipped, 5750 passed) · `@workflow/web-chat` 3 suites/48 ·
  channel-web-chat 23 files/409 · 내부 packages(sdk/ai-end-reason/expression-engine/
  graph-warning-rules/node-summary/chat-channel-validation) 9 suites/218 — 전부 0 실패
- build : 통과 (123s, Dockerfile 이미지 검증 포함)
- e2e   : 통과 (260s, backend jest 46 suites/260 tests + Playwright 51 tests, 전부 0 실패)

### mutation 검증 (신규 회귀 테스트 2건이 실제로 대상 분기를 잠그는지)

| 대상 | 방법 | 결과 |
|---|---|---|
| W4 신규 테스트 | `applyRetryLastTurn` 의 "claim 성공+in-memory `_retryState` 부재" 방어 분기(`if (!retryState) {...return;}`, 12줄) 삭제 — 사전 `grep -c` 로 치환 앵커(`불변식 위반(이론상 도달 불가능)`) 매칭 1건 확인 후 적용 | RED — `row.status`: expected `running`, received `failed` (execution/node not-found 분기로 fallthrough) |
| W6 신규 테스트 | `delete spawnedRow.inputData[RETRY_STATE_KEY];` 1줄 비활성화 — 사전 `grep -c` 로 매칭 1건 확인 후 적용 | RED — 신규 테스트 + 기존 CRITICAL#2 회귀 테스트 (d)/(e) 3건 동반 실패(`_retryState` 가 payload/inputData 에 잔존 관측) |

두 mutation 모두 `cp` 절대경로로 사전 백업한 fixed 스냅샷으로 원복 후 `diff` 로 무변경 확인,
전체 spec 파일 43/43 GREEN 재확인.

## 보류·후속 항목

- **spec draft 위임 (#1, SPEC-DRIFT)**: `plan/in-progress/spec-update-retry-claim-backstop-gap.md`
  — `spec/5-system/4-execution-engine.md:1387-1391` 의 "복구는 `recoverStuckExecutions`
  백스톱이 담당한다" 무조건 서술을, 이 PR 자신의 실측(코드 JSDoc + plan #15)이 반증한 대로
  "이 2차 claim 경로는 그 백스톱이 닿지 않는다"로 정정하는 제안. 코드/plan 은 이미 정정 완료 —
  spec 문구만 project-planner 턴 대기.
- **#5(architecture, defer)**: claim↔in-memory 동기화 불변식의 타입/캡슐화 부재 —
  `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #18(P2, 신규).
- **#7(maintainability, defer)**: `claimAndSyncRetryState` 헬퍼 추출 — 같은 plan §코드 표
  #19(P3, 신규).
- **#8(maintainability, defer)**: not-found 2블록 `markSpawnedRowFailed` 중복 — 같은 plan
  §코드 표 #9(기존 항목, 1R W3 = 5R W5)에 "7R 재지적" 만 추가.
- INFO 20건: 지시 범위 밖 — 조치 없음(SUMMARY 자체 INFO 목록 참조, 대부분 이미 추적 중이거나
  범위 밖으로 재확인된 항목).

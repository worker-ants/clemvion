# RESOLUTION — 02_23_50 (7차 라운드, 마지막 조치 라운드)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1  | 코드 | `0481b4554` | `failFirstSegmentSetup`/`executeSync` timeout catch 를 guarded `updateExecutionStatus` 경유로 교체 — 잔여 SELECT~UPDATE TOCTOU 차단. PENDING 소스는 상태머신이 의도적으로 금지(`state-machine.spec.ts` "disallow pending -> failed")하므로 강제 우회하지 않고 `CoreEngineDriver` JSDoc 에 choke point 예외로 명시 |
| #2  | 문서(plan 등재만) | (코드 변경 없음) | god-class — plan "7차 라운드 추가 후속" 절 |
| #3  | 문서(plan 등재만) | (코드 변경 없음) | 공유 SET 절 `error` 컬럼 확대 — plan 동일 절 |
| #4  | 문서(plan 등재만) | (코드 변경 없음) | 신규 metrics 발사 — plan 에 "배포 시 공지" 로 등재 |
| #5  | 문서(plan 등재만) | (코드 변경 없음) | `FinalizeSubject` 타입 중복 — plan 동일 절 |
| #6  | 문서(plan 등재만) | (코드 변경 없음) | 트랜잭션 mock 헬퍼 중복 — plan 동일 절 |
| #7  | 문서(plan 등재만) | (코드 변경 없음) | raw SQL 파라미터 매직 인덱스 — plan 동일 절 |
| #8  | 문서(plan 등재만) | (코드 변경 없음) | `handleAiMessageTurn` 길이 — plan 동일 절(6차 라운드 항목 재확인) |
| #9  | 문서(plan 등재만) | (코드 변경 없음) | 3항 OR 가드 부분 커버리지 — plan 동일 절 |
| #10 | 문서 | `b772789dd` | CHANGELOG.md 6번째 항목 + plan 체크리스트 줄로 `82b0d1561` 동기화 관례 이탈 정정 |
| INFO 전반 | 문서(plan 등재만) | (코드 변경 없음) | INFO #8(`retry-turn.service.ts` 동일 클래스 lost-update) 포함 전부 plan 동일 절에 등재 |

## TEST 결과

- lint  : 통과
- unit  : 통과
- build : 통과
- e2e   : 통과 (260/260, `_test_logs/e2e-20260727-030331.log`)

## 보류·후속 항목 (plan `plan/in-progress/ie-resume-turn-boundary-cancel.md` "7차 라운드 추가 후속" 절 참조)

- WARNING #2 (architecture) — `ExecutionEngineService` god-class 8,484줄. 알림 dispatch 등
  핵심과 무관한 부가 책임부터 우선 추출 권고.
- WARNING #3 (side_effect) — guarded UPDATE SET 절의 `error` 컬럼 확대가 8개 호출부 공유.
  인라인 계약 주석 강화 또는 FAILED 전이로 조건부 제한 검토.
- WARNING #4 (side_effect) — `finalizeFailedExecution` guarded 전환에 따른 신규 metrics
  발사. 조치 불요(버그 아님) — **배포 시 공지 필요**: "top-level FAILED 종결 메트릭이
  이번부터 정확히 집계됨(과거 undercounted)".
- WARNING #5~#7 (maintainability) — 테스트 코드 중복 3건(`FinalizeSubject` 타입 중복,
  트랜잭션 mock 헬퍼 중복, raw SQL 매직 인덱스). 별도 라운드로 묶어 처리 권고.
- WARNING #8 (maintainability) — `handleAiMessageTurn` SRP 부채(6차 라운드부터 반복
  확인). 신규 가드 블록만이라도 private 메서드 추출 권고.
- WARNING #9 (testing) — `processAiResumeTurn` 3항 OR 가드 중 2항 미검증. 회귀 케이스
  추가 권고.
- INFO #8 (database) — `retry-turn.service.ts:636,658` 의 `failRetryExecution` 이 이
  PR 이 형제 함수에서 닫은 것과 동일한 무가드 full-entity save lost-update 패턴을 diff
  범위 밖에서 보유. 별도 PR 로 `updateExecutionStatus` 재배선 검토 트래킹.
- INFO #1~#7, #9 — 전부 조치 불요로 판정(기존 방어 설계 확인, 의도된 pin, 기존 인지된
  설계 한계 등). 상세는 SUMMARY.md INFO 표 참조.

## 구조적 판단 근거 (WARNING #1 관련)

`updateExecutionStatus` 는 호출 시 `assertTransition(execution.status, newStatus)` 을
무조건 먼저 통과해야 한다. `ALLOWED_TRANSITIONS[PENDING]` 은 `RUNNING`/`CANCELLED` 만
허용하고 `FAILED` 는 명시적으로 배제돼 있으며(`state-machine.spec.ts`
"should disallow pending -> failed" 로 직접 테스트됨), 이는 우발적 누락이 아니라
의도된 설계 결정이다. `failFirstSegmentSetup`/`executeSync` 의 reload 시점 row 가
(극히 좁은 이중 DB 장애 또는 소-timeoutMs 레이스로) PENDING 인 경우 이 가드가 throw
하므로, 두 호출자 모두 이를 best-effort 로 흡수해 마킹만 skip 하도록 구현했다 — 상태
머신을 억지로 우회(예: `ALLOWED_TRANSITIONS` 확장)하지 않았다. 이 판단과 근거는
`CoreEngineDriver`(`engine-driver.interface.ts`) JSDoc 에 "choke point 예외" 로도
명시했다.

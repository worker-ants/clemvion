# RESOLUTION — 06 C-2 재개 원자 claim (ai-review 00_18_25)

## 조치 항목

| # | 발견 | 조치 | commit |
|---|------|------|--------|
| Critical 1 | claim 이 NodeExecution 만 원자 전이, Execution 별도 → 크래시 시 stuck + spec 불일치 | **Option A(페어링, 사용자 승인)** — claimResumeEntry 가 NodeExecution+Execution WFI→RUNNING 을 dataSource.transaction 단일 tx 로. recoverStuckExecutions 가 Execution(+자식 NodeExecution cascade) 회수 | `6b83d741a` |
| Critical 1 연계 | orphan NodeExecution=RUNNING 회수 경로 부재 | recoverStuckExecutions `.returning('id')` + 자식 RUNNING NodeExecution cascade FAILED | `6b83d741a` |
| Warning 1 | legacy 우회 빈 문자열 근거 부재 | claimResumeEntry JSDoc 에 '' = legacy 방어값 근거 1줄 | `6b83d741a` |
| INFO 8 | L680 stale 주석 isNodeExecutionWaiting | claimResumeEntry 로 갱신 | `6b83d741a` |
| INFO 4/5 | JSDoc 중복·테스트 헬퍼 | 유지(기존 관례) / 테스트 재작성 시 정리 | — |
| (e2e 포착) | claim 후 Execution 이 RUNNING 인데 rehydrateAndResume 가 WAITING 만 허용 → cancelled | Execution·NodeExecution status 체크를 WAITING/RUNNING 허용으로 | `6b83d741a` |
| (e2e 포착) | reparkAiResumeTurn 이 node status=WAITING 미설정 → claim RUNNING 잔류 stuck | nodeExec.status=WAITING 명시 설정 | `6b83d741a` |

INFO 7(동시성 unit 은 mock, 실 DB 레이스는 e2e 담당) → dockerized e2e 225 PASS 로 검증.

## TEST 결과

- lint: 통과
- unit: 통과 (backend 384 suites / 7532 tests)
- build: 통과 (docker 이미지 빌드 — 초기 registry DeadlineExceeded 환경 차단 후 회복, 재시도 PASS)
- e2e: 통과 (225 tests — execution-park-resume 포함. e2e 가 unit 미검출 2버그[Execution 체크·repark node status] 포착·수정)

## 보류·후속 항목

- 재시도 필요였던 5 reviewer(security·scope·side_effect·testing·documentation, 파일 유실)는 아래 fresh /ai-review 로 전수 재검.

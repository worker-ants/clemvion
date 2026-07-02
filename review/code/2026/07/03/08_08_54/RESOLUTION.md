# RESOLUTION — 06 C-2 fresh ai-review (08_08_54)

## 조치 항목

| # | 발견 | 조치 | commit |
|---|------|------|--------|
| Critical 1 (testing) | WAITING∪RUNNING 확장으로 negative 테스트 무효화(status:RUNNING=reject → false-green) | terminal(CANCELLED)로 교체 + rehydrate 미진입 단언 + RUNNING 허용 positive 테스트 신규 | `46335b1ff` |
| W2 (testing) | reparkAiResumeTurn nodeExec.status=WAITING 재설정 미테스트 | nodeExec RUNNING mock 테스트 추가 | `46335b1ff` |
| W3 (testing) | claimResumeEntry segmentStartMs 부수효과 미검증 | 성공/실패 케이스 단언 추가 | `46335b1ff` |
| W4 (arch/side_effect) | claimResumeEntry choke-point 우회 문서화 | updateExecutionStatus JSDoc 상호참조 | `46335b1ff` |
| W5 (side_effect) | Execution 짝 UPDATE affected 미검사 → cancel-vs-resume 짝 불일치 | exec UPDATE status IN(waiting,running) 가드 + affected=0 시 tx 롤백 discard + 테스트 | `46335b1ff` |
| INFO 8 | plan C-2 체크박스 미갱신 | 후속(본 PR 내 plan complete 커밋에서 처리) | — |
| INFO 9 | spec Rationale ALLOWED_TRANSITIONS 노트 부정확 | claim=assertTransition 우회 raw UPDATE 로 정정 | `46335b1ff` |
| INFO 11 | dockerized e2e 동시 재개 검증 | e2e 225 PASS(park-resume 포함)로 충족 | — |

INFO 6(서비스 비대화)·7(암묵 계약)·12(반복)·13(row-lock 주석) = 비차단, 후속 리팩터 후보.

## TEST 결과
- lint: 통과
- unit: 통과 (backend 384 suites / 7535 tests)
- build: 통과 (docker 이미지)
- e2e: 통과 (225 tests, execution-park-resume 포함)

## 보류·후속 항목
- 재시도 필요였던 security·scope·documentation reviewer → 아래 최종 fresh /ai-review 로 전수 재검.

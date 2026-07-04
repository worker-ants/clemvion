# Code Review 통합 SUMMARY — PR3 크래시/재시작 RUNNING re-drive (§7.5 case B)

**전체 위험도: MEDIUM · Critical 0 · Warning 10 · (Info 다수)**
diff base: `origin/main`. Reviewer 14종 전원 실행(fallback 평문 Agent fan-out — bg-isolation 우회).

## Critical
없음.

## Warning (10) — 조치

| # | Reviewer | 발견 | 조치 |
|---|----------|------|------|
| W1 | side_effect / requirement(INFO) | 옛 cascade(회수 Execution 의 자식 RUNNING NodeExecution → FAILED) 삭제로 mid-dispatch orphan RUNNING row 영구 잔존 → 타임라인·진행률 오염 | **FIX**: `failOrphanRunningNodeExecutions` 신설, `redriveStuckExecution` 재구동 진입 시 호출(RUNNING→FAILED). unit 추가 |
| W2 | security | `_test/recover-stuck-executions` 가 `@Roles()` 없이 인증만 + 전역 스캔 | **FIX**: `@Roles('owner')` 추가(인가 이중화) |
| W3 | api_contract | 동 엔드포인트가 런타임 `NODE_ENV` 만으로 게이팅 → 단일 env 오설정 시 노출 | **FIX**: `NODE_ENV==='test'` **AND** `E2E_TEST_HOOKS==='1'` 이중 게이트(compose 에 플래그 추가). 단일 오설정 무력화 |
| W4 | concurrency | stale 오판(zombie: 원 워커 생존) 시 이중 실행 가능 — 노드단위 fencing 부재 | **문서화**: 이미 spec §Rationale 에 zombie 잔여 race + PR4 BullMQ fencing 기록. `redriveStuckExecution` 코드 주석에 명시 추가. (동작은 Q1 결정대로 PR4 로 fencing 이연 — 신규 회귀 아님: 현행 fail-path 도 동일 노출) |
| W5 | testing | `driveStuckRedrive` 완료/park/에러 3분기 unit 부재 | **FIX**: `driveStuckRedrive` describe 3분기 추가 |
| W6 | testing | `runNodeDispatchLoop` skipExecutedNodes 직접 unit 부재 | **e2e 커버**: crash-redrive e2e 가 trigger·codeA row 수 불변(완료노드 미재실행 = skipExecutedNodes 종단 검증). unit 직접화는 graphState full-mock 비용 과다라 e2e 로 대체(RESOLUTION 기록) |
| W7 | testing | `redriveStuckExecution` 비-RehydrationError catch 미테스트 | **FIX**: loadAndBuildGraph 일반 Error → RESUME_CHECKPOINT_MISSING unit 추가 |
| W8 | testing | `redriveStuckExecution` execution 부재(findOneBy null) 미테스트 | **FIX**: null → skip unit 추가 |
| W9 | testing / requirement | 컨트롤러 `triggerStuckRecoveryForTest` NODE_ENV 게이팅(404) 미테스트 | **FIX**: controller.spec 게이팅 3-case(정상/NODE_ENV/플래그) 추가 |
| W10 | requirement | (=W9 중복) 프로덕션 차단 분기 자동 테스트 부재 | W9 로 해소 |

## Info (요지)
- 여러 reviewer 가 test-only endpoint 은닉 관행·fire-and-forget re-drive(설계 의도, .catch 방어)·에러 응답 포맷 등 저위험 관찰 제시. 대부분 조치 불요 또는 PR4 관측성 트랙.
- performance/architecture/scope/maintainability/database/documentation/user_guide_sync/dependency = Critical/Warning 0.

## 결론
Critical 0 → BLOCK 아님. Warning 10 중 8건 코드 fix(orphan cascade·endpoint 이중게이트+role·unit 4종), 1건 문서화(zombie 주석), 1건 e2e 대체(skipExecutedNodes 종단). fresh `/ai-review` + `--impl-done` 로 수렴.

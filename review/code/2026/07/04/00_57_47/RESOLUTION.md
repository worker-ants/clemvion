# RESOLUTION — PR3 크래시/재시작 RUNNING re-drive (§7.5 case B) ai-review

review 산출: `review/code/2026/07/04/00_57_47` (14 reviewer, Critical 0 / Warning 10). 아래 조치는 단일 resolution 커밋(`refactor(execution-engine): PR3 ai-review resolution`)에 포함.

## 조치 항목

| SUMMARY # | Reviewer | 조치 | 방식 |
|---|---|---|---|
| W1 | side_effect / requirement | `failOrphanRunningNodeExecutions` 신설 — `redriveStuckExecution` 진입 시 크래시 orphan `NodeExecution(RUNNING)`→FAILED 마감(옛 cascade 복원). 유령 running 노드/진행률 오염 제거 | 코드 fix + unit(orphan cascade UPDATE·redrive happy-path 호출) |
| W2 | security | `_test/recover-stuck-executions` 에 `@Roles('owner')` — 게이트 실패 시에도 owner 만 트리거(인가 이중화) | 코드 fix |
| W3 | api_contract | 동 엔드포인트 게이트를 `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중화 + compose 에 `E2E_TEST_HOOKS: "1"` 추가 — 단일 env 오설정으로 프로덕션 노출 불가 | 코드 fix + docker-compose.e2e.yml |
| W4 | concurrency | zombie 잔여 race(원 워커 생존 시 이중 실행)를 `redriveStuckExecution` 코드 주석에 명시(이미 spec §Rationale 기록). 노드단위 fencing 은 Q1 결정대로 PR4(BullMQ stalled)로 이연 — 현행 fail-path 도 동일 노출이라 신규 회귀 아님 | 문서화(코드 주석) |
| W5 | testing | `driveStuckRedrive` 완료(COMPLETED+emit)/park/에러(finalize) 3분기 unit | unit 추가 |
| W6 | testing | `runNodeDispatchLoop` skipExecutedNodes 종단 검증 = crash-redrive e2e(trigger·codeA row 수 불변 = 완료노드 미재실행). 직접 unit 은 graphState full-mock 비용 과다라 e2e 로 대체 | e2e 커버(신규 아님, 기존 e2e 가 이미 검증) |
| W7 | testing | `redriveStuckExecution` 비-RehydrationError setup 실패 → RESUME_CHECKPOINT_MISSING terminal unit | unit 추가 |
| W8 | testing | `redriveStuckExecution` execution 부재(findOneBy null)→skip unit | unit 추가 |
| W9/W10 | testing / requirement | 컨트롤러 게이팅 404 (NODE_ENV·플래그 각각) + 정상 트리거 unit 3-case | controller.spec 추가 |

Info 다수는 저위험 관찰(대부분 조치 불요) 또는 PR4 관측성 트랙 — SUMMARY 참조.

## TEST 결과
- lint: 통과
- unit: 통과 (execution-engine 366 + controller — full suite green)
- build: 통과
- e2e: 통과 (dockerized 38 suites/227 — crash-redrive 포함, endpoint 이중게이트+E2E_TEST_HOOKS 로 재검증)

## 보류·후속 항목
- (PR4 관측성 트랙) 운영용 on-demand recovery 트리거의 정식 route/scope 설계 + endpoint 조건부 등록(ConditionalModule) 검토 + zombie 노드단위 fencing(BullMQ stalled). test-only endpoint 은 그때 정리.

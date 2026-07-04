# RESOLUTION — PR4 BullMQ stalled 자동 재배달 (ai-review 13_08_20)

## 조치 항목

| SUMMARY # | Severity | 조치 | 위치 |
| --- | --- | --- | --- |
| 1 | Warning (security, api_contract) | test-hook 에 `@WorkspaceId()` + `verifyOwnership(id, workspaceId)` 추가 (cross-workspace IDOR 차단, `:id` 라우트 관례 정합) | `executions.controller.ts` `simulateExecutionRunRedeliveryForTest` |
| 2 | Warning (documentation) | `buildExecutionRunJobId` docstring 을 네이티브 stalled(같은 jobId, seq 불요)로 정정 | `execution-run.queue.ts` |
| 3 | Warning (testing) | 신규 test-hook 게이팅 unit 4-case(정상/IDOR 전파/NODE_ENV≠test/플래그 없음) + `runExecutionFromQueue` mock 추가 | `executions.controller.spec.ts` |
| 4 | Warning (side_effect) | `finalizeStalledExhausted` vs 부팅 backstop 재구동 narrow race 를 코드 주석 + §Rationale 에 문서화 (concurrency reviewer 가 조건부 UPDATE 원자성 검증 — 신규 defect 아님, zombie double-drive 와 동일 class) | `execution-engine.service.ts` `finalizeStalledExhausted` JSDoc + `spec/5-system/4-execution-engine.md` §Rationale |
| INFO (testing) | 비차단 | `EXECUTION_RUN_STALLED_INTERVAL_MS` 값 assertion 추가 | `execution-run.queue.spec.ts` |

### Won't-fix (근거 기록)
| SUMMARY # | 판단 |
| --- | --- |
| 5 (architecture, Warning) | `ExecutionRunDlqMonitorService` 의 `ContinuationDlqMonitorService` 미러 중복은 **의도된 sibling-mirror 패턴** — 본 프로젝트는 미러 중복을 의도적으로 허용(reviewer 자인, continuation 모니터 자체가 동형 선례). Base 추상화는 과결합 유발. 조치 안 함. |

## TEST 결과 (fix 후 재수행)
- lint: 통과 (prettier 1건 자동수정 후)
- unit: 통과 (7573 passed, 0 failed — +5: test-hook 게이팅 4 + stalledInterval 1)
- build: 통과
- e2e: 통과 (228 passed — controller 재빌드 후, `verifyOwnership` 추가가 stalled-redelivery e2e 무영향: 러너가 X-Workspace-Id 전송)

## 보류·후속 항목
- 완전 fencing(finalizeStalledExhausted/zombie race 완전 배제)은 세그먼트-start/owner-token 영속에 의존 — Q2 defer 로 migration-free 유지, 후속 candidate(§Rationale 명기).

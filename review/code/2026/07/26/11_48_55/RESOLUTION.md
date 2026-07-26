# RESOLUTION — review/code/2026/07/26/11_48_55

## 배경

`dad70c7b2` ("외부 cancel 후에도 하류 노드가 계속 dispatch 되던 결함")에 대한 ai-review 결과
CRITICAL 4 / WARNING 8. 리뷰는 "Stop 이 부수효과를 멈춘다" 는 PR 의 주장이 3개 가드 지점 중
1곳만 실제로 작동하고, 컨테이너/Parallel 범위는 애초에 적용 밖이며, 회귀 커버리지가 mutation
실측으로 0(가드 제거해도 GREEN)임을 밝혔다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|---|---|---|---|
| C1 | 코드 | `ff87ede27` | `WorkflowHandler` catch 에 `ExecutionCancelledError` 재throw 추가(`ParkReleaseSignal` 과 대칭). `ExecutionCancelledError` 의 `@internal` JSDoc 을 sanctioned 예외로 갱신(`workflow-errors.ts`). 회귀 테스트 2건 추가(`workflow.handler.spec.ts`). mutation 검증: 가드 제거 시 2건 RED 확인 |
| C2 | 코드+테스트 | `ff87ede27`, `107133cfd` | `runNodeDispatchLoop`(재개 경로) · `executeInline` 각각에 "하류 노드 미도달" 회귀 테스트 추가. mutation 검증: 가드 제거 시 RED, 복원 시 GREEN(둘 다) |
| C3 | 코드+테스트 | `ff87ede27`, `107133cfd` | `executeContainerBody`(ForEach/Loop/Map, **아이템 경계**마다 — 대량 반복에 노드당 폴링이 곱해지지 않도록)·`executeParallelBranchBody`(브랜치, **노드 경계**마다)에 §2.3 가드 확장. `ForEachExecutor` 의 `errorPolicy:'skip'\|'continue'` 가 취소를 "아이템 실패"로 흡수하지 않도록 별도 재throw 가드 추가(`loop-executor.ts` 는 원래 per-iteration try/catch 가 없어 코드 변경 불요 — 근거 주석만 추가). 회귀 테스트 3건(컨테이너·Parallel·ForEachExecutor 단위) 추가. mutation 검증: 5개 지점 전부 RED → 복원 시 GREEN |
| C4 | 코드 | `ff87ede27` | `runExecution`·`finalizeResumedExecutionOutcome` 의 `ExecutionCancelledError` catch 2곳을 raw `save()` 대신 `updateExecutionStatus`(M-3 guarded UPDATE, 이미 terminal 이면 no-op)로 전환 — `stop()` 이 쓴 `finishedAt`/`durationMs` 가 재-마킹으로 덮어써지지 않는다. `assertExecutionNotCancelled` JSDoc 의 "보존된다" 주장이 이제 실제로 성립 |
| W1 | 코드 | `ff87ede27` | `assertExecutionNotCancelled` 의 `findOneBy`(전체 row, JSONB 6개 포함) → `findOne({select:{id:true,status:true}})` 컬럼 투영. 테스트 mock 은 `findOneBy` 로 위임(기존/신규 테스트 무변경 재사용) |
| W2 | 코드+테스트 | `ff87ede27` | `executeBackgroundSubgraph` catch 에 `ExecutionCancelledError` 분기 추가 — `ParkReleaseSignal` 과 동일하게 graceful 종료(swallow, 재throw 없음) → 허위 실패 알림·BullMQ 재시도 방지. 회귀 테스트 추가 |
| W3 | 코드 | `ff87ede27` | C4 가 손댄 두 catch 의 `EXECUTION_CANCELLED` emit 을 공용 `emitCancellationEvent(..., {cancelledBy:'user'})` 로 통일 |
| W4 | 문서 | `ff87ede27` | `node-cancellation-propagation.e2e-spec.ts` 상단 "⚠ 기전 미확인" JSDoc 을 기전 규명 완료 + 수정 내용으로 갱신 |
| W5 | 문서 | `ff87ede27` | `CHANGELOG.md` Unreleased 항목 추가(C1-C4/W1-W3 전체 요약) |
| W6 | spec 위임 | `ff87ede27` | spec §2.3/§5.1/§6·`code:` 갱신 제안을 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` **"추가 위임 (2026-07-26 #6)"** 절에 작성 + `node-cancellation-residual-signal-propagation.md` 에 위임 기록 명시(자매 항목과 대칭). **spec 본문 자체는 미반영 — planner 턴 대기** |
| W7 | 문서 | `a3e169317` | plan 의 "mutation 검증 완료 — RED 3회" 문구가 실측(RED 1회뿐)과 불일치하던 것을, C2/C3 테스트 추가 후 7개 지점 전부 재검증한 결과로 정정 |
| W8 | 백로그(무조치) | — | 코드 수정 불요(지시사항). 가드 시퀀스 헬퍼 승격은 중간 크기 후속 작업으로 이미 plan 에 명시돼 있음(`node-cancellation-residual-signal-propagation.md` §6 표 W8 원문). `executeInline` 이 `assertActiveTimeWithinLimit` 를 호출하지 않는 기존 비대칭은 **본 세션에서 미확인** — 아래 "보류·후속 항목" 참조 |

## TEST 결과

- lint  : 통과 (backend/frontend/web-chat/channel-web-chat/internal packages 전부)
- unit  : 통과 (`.claude/tools/run-test.sh unit` PASS — backend 8258+ 케이스 포함 전 패키지)
- build : 통과 (`.claude/tools/run-test.sh build` PASS — Docker 이미지 빌드 포함)
- e2e   : 통과 (`.claude/tools/run-test.sh e2e` PASS, backend Jest 46 suites / 259 tests 전부
  통과 — `test/node-cancellation-propagation.e2e-spec.ts` 포함. 로그:
  `_test_logs/e2e-20260726-124725.log`)

### mutation 검증 상세 (C2/C3 요구사항)

가드 7개 지점을 각각 `cp` 로 원본 백업 후 1줄씩 제거 → 대상 회귀 테스트 실행(RED 확인) →
`cp` 로 원복 → 재실행(GREEN 확인). `git checkout` 은 사용하지 않음(미커밋 작업 유실 방지
원칙 — 실제로는 각 단계 전에 커밋해 두어 안전 마진을 이중으로 확보).

| # | 지점 | 대상 테스트 | 결과 |
|---|---|---|---|
| 1 | `runExecution` (§2.3, line ~4268) | "선형 경로 외부 cancel 전파" (기존) | RED(1 failed) → 복원 GREEN |
| 2 | `runNodeDispatchLoop` (§2.3, line ~1638) | "재개 중 외부 cancel 관측 시 runNodeDispatchLoop..." (신규) | RED(1 failed) → 복원 GREEN |
| 3 | `executeInline` (§2.3, line ~3736) | "executeInline 이 하류를 dispatch 하지 않고..." (신규) | RED(1 failed) → 복원 GREEN |
| 4 | `executeContainerBody` (C3, line ~6480) | "아이템 경계에서 외부 cancel..." (신규) | RED(1 failed) → 복원 GREEN |
| 5 | `executeParallelBranchBody` (C3, line ~7120) | "브랜치 내부 노드 경계에서 외부 cancel..." (신규) | RED(1 failed) → 복원 GREEN |
| 6 | `WorkflowHandler` C1 재throw | "ExecutionCancelledError re-throw" 2건 (신규) | RED(2 failed) → 복원 GREEN |
| 7 | `ForEachExecutor` errorPolicy 우회 재throw | "ExecutionCancelledError bypasses errorPolicy" 3건(신규, stop/skip/continue) | RED(skip·continue 2건 failed, stop 은 기존 switch 로 방어돼 그대로 PASS — 의도된 결과) → 복원 GREEN |

전체 7/7 지점 mutation-verified. 전 구간 복원 후 `execution-engine.service.spec.ts`
(412 tests) · `workflow.handler.spec.ts`(50 tests) · `foreach-executor.spec.ts`(15 tests)
재실행 = 전부 통과, `git diff --stat` = 무변경(원복 확인).

## 보류·후속 항목

- **spec draft 위임 (W6)**: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
  의 "추가 위임 (2026-07-26 #6)" 절. §2.3 에 "노드 경계 Execution-cancel 재확인" 생산자 bullet
  추가, §5.1 에 `ExecutionCancelledError` 분류 단락 추가, §6 표에 새 행(+ 기존 `:140` 행 비고
  분리) 추가, `frontmatter.code:` 에 `execution-engine.service.ts` 추가, `:60` 행 비고 갱신을
  제안했다. **`spec/` 쓰기 권한이 없어 코드에 반영하지 않음 — project-planner 턴 필요**
  (ESCALATE=spec). 완료 후 `/consistency-check --spec` → BLOCK:NO 확인.
- **W8 잔여 확인 사항 (무조치, 참고용)**: `executeInline` 이 `assertActiveTimeWithinLimit` 를
  호출하지 않는 기존 비대칭이 의도인지는 **본 세션에서 조사하지 않았다** — SUMMARY 가 "확인
  필요" 로만 표시했고 코드 수정을 요구하지 않았기 때문. 필요 시 별도 턴에서 판단.
- **가드 시퀀스 헬퍼 승격 (W8)**: `assertActiveTimeWithinLimit` + `assertExecutionNotCancelled`
  쌍이 5곳(선형 3 + 컨테이너/Parallel 2)에 손으로 복제돼 있다. 전면 통합은 과거 "엔진 재작성급
  고위험" 으로 기각된 범위 — 노드 경계 가드 시퀀스만 단일 헬퍼로 승격하는 중간 크기 후속 작업을
  백로그로 유지(코드 변경 없음, 이번 세션에서 착수하지 않음).
- **INFO 항목 4건** (`assertExecutionNotCancelled` DB 조회 실패 경로 미검증 · e2e 매직넘버
  네이밍 관행 불일치 · 로그 레벨 `log`/`warn` 비일관 · `createNodeExecution` 조건부 INSERT
  대안 기각)은 SUMMARY 원문에 근거가 이미 기록돼 있고 자동 수정 대상이 아니어서 그대로 둔다.

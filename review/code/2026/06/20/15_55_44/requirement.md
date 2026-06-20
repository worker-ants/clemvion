# 요구사항(Requirement) 리뷰 — 3 regression 테스트 추가

## 발견사항

### [INFO] parallel-p2-integration.spec.ts JSDoc 재설명 — 의도와 구현 일치
- 위치: `parallel-p2-integration.spec.ts` 파일 헤더 (diff 행 39~48)
- 상세: `PARALLEL_NESTED_DEPTH_EXCEEDED` 런타임 가드 테스트를 `execution-engine.service.spec.ts` 로 이전하고 `parallel.schema.spec.ts` 가 정적 save-time 규칙을 커버한다는 사실을 JSDoc 에 명기했다. `parallel-p2-followups.md §2-4` 가 JSDoc-only 약속 (미작성) 이었던 것이 이 PR 에서 실제 테스트 구현으로 해소됐음을 JSDoc 이 정확히 설명하고 있다. 의도와 구현이 일치한다.

### [INFO] planParallelBody depth=2 런타임 가드 테스트 — 기능 완전성 충족
- 위치: `execution-engine.service.spec.ts` 행 235~285
- 상세: `planParallelBody(inner, [...], forwardEdges, [], 1, 2)` 호출 시 `PARALLEL_NESTED_DEPTH_EXCEEDED` throw 를 단언하고, depth=1 호출에서 throw 없음 + `allBodyNodeIds.has('p3')` 를 동시에 단언한다. 전자는 "런타임 depth 가드 발화" 를, 후자는 "edge 위상이 우연 escape 가 아님" 을 확정한다. spec `4-nodes/1-logic/10-parallel.md` 행 170 ("중첩 Parallel 깊이 > 2 → `PARALLEL_NESTED_DEPTH_EXCEEDED`") 과 일치. RESOLUTION.md W1 조치 완료.
- 제안: 없음 (충족).

### [INFO] cancel-others-on-fail signal cascade 테스트 — 기능 완전성 충족
- 위치: `parallel-p2-integration.spec.ts` 행 90~165
- 상세: branch_0 즉시 throw → branch_1 의 AbortSignal abort 후 `fetchAbortObserved` 1회 호출을 검증. `errorPolicy=stop` 에서 branch_1 이 끝까지 완료(abortSignal undefined) 를 별도 케이스로 확인. `spec/conventions/node-cancellation.md §2.3` 및 `10-parallel.md §5 concurrency` 계약과 일치.

### [INFO] nested concurrency clamp 테스트 — 기능 완전성 충족
- 위치: `parallel-p2-integration.spec.ts` 행 167~208
- 상세: `parentEffective=16, branchCount=8 → allowed=floor(32/16)=2` clamp 를 `observedPeak≤2` 및 `result.clampedConcurrency={intended:8, actual:2, parentEffective:16, cap:32}` 로 검증. 두 번째 케이스는 `parentEffective=8, branchCount=4 → 8×4=32≤32` 로 clamp 없음(`clampedConcurrency` undefined) 을 검증. `spec/4-nodes/1-logic/10-parallel.md` 행 219~223 의 `{ intended, actual, parentEffective, cap }` shape 및 `effectiveConcurrency = floor(32/parentEffective)` 계산식과 정확히 일치.

### [INFO] IE single-turn abortSignal 전파 테스트 — 기능 완전성 충족
- 위치: `information-extractor.handler.spec.ts` 행 864~893
- 상세: `handler.execute()` 의 single-turn 경로가 `llmService.chat` 의 4번째 인자에 `{ signal: controller.signal }` 을 전달하는지 `toHaveBeenCalledWith(anything, anything, objectContaining({executionId}), objectContaining({signal}))` 패턴으로 검증. `spec/conventions/node-cancellation.md §2.1` ("Anthropic SDK signal 전파 구현됨") 및 §6 표 "AI 노드 signal 전파 ✓" 항목을 단위 테스트로 잠근다. multi-turn 경로(W4)는 기존 테스트에서 커버됐으므로 신규 테스트가 single-turn 갭을 메운다.

### [INFO] text-classifier abortSignal 전파 테스트 — 기능 완전성 충족
- 위치: `text-classifier.handler.spec.ts` 행 2135~2150
- 상세: `toHaveBeenCalledWith(anything, anything, anything, objectContaining({signal}))` 패턴으로 4번째 인자 signal 전파를 검증. RESOLUTION.md W3 조치 완료 (기존 `mock.calls[length-1]` 인덱스 접근 대신 `toHaveBeenCalledWith` 패턴으로 교체).

### [WARNING] [SPEC-DRIFT] node-cancellation.md §6 구현 현황 표 — 단위 테스트 행 미반영
- 위치: `/Volumes/project/private/clemvion/spec/conventions/node-cancellation.md` §6 표 (행 129)
- 상세: §6 표에 "HTTP 단위 테스트 ✓ `http-request.handler.spec.ts`" 행은 있으나, 이번 추가된 "IE single-turn 단위 테스트 (`information-extractor.handler.spec.ts`)" 및 "text-classifier 단위 테스트 (`text-classifier.handler.spec.ts`)" 에 대응하는 행이 없다. 코드 구현(signal 전파)은 §6 표에 이미 "AI 노드 signal 전파 ✓" 로 기재됐지만, 단위 테스트 커버리지 행이 HTTP 패턴과 달리 분리 기재되지 않았다. 코드 옳음, spec 갱신 누락.
- 제안: 코드 유지. `spec/conventions/node-cancellation.md §6` 표에 다음 행 추가(project-planner 영역):
  - `| AI 노드 signal 단위 테스트 | ✓ | information-extractor.handler.spec.ts (single-turn), text-classifier.handler.spec.ts |`
  이는 코드 fix 대상이 아니라 spec 반영 대상이다.

### [INFO] RESOLUTION.md / SUMMARY.md — 일관성
- 위치: `review/code/2026/06/20/15_43_17/RESOLUTION.md`, `SUMMARY.md`
- 상세: RESOLUTION 이 SUMMARY W1·W3 조치 완료, W2 현행 유지 disposition, SPEC-DRIFT 2건 planner 위임을 명시했다. 본 후속 리뷰 코드(execution-engine.service.spec.ts 의 `allBodyNodeIds.has('p3')` 단언, text-classifier 의 `toHaveBeenCalledWith` 교체)가 W1·W3 조치를 정확히 반영하고 있다. 의도와 구현 일치.

### [INFO] 엣지 케이스 — concurrency clamp 경계 케이스 미검증
- 위치: `parallel-p2-integration.spec.ts` concurrency clamp 섹션
- 상세: `parentEffective=32` 인 경우 `floor(32/32)=1` (최소 clamp) 케이스와, `parentEffective=0` 또는 `undefined` 경우의 분모 0 방어 동작이 테스트되지 않았다. SUMMARY.md INFO 로 이미 식별됐으며 프로덕션 코드 무변경이므로 회귀 위험이 낮다. 별도 이슈로 추적 가능.

### [INFO] TODO/FIXME 없음
- 위치: 변경된 파일 전체
- 상세: TODO, FIXME, HACK, XXX 주석 없음.

## 요약

변경된 4개 테스트 파일(parallel-p2-integration.spec.ts, execution-engine.service.spec.ts, information-extractor.handler.spec.ts, text-classifier.handler.spec.ts) 및 2개 리뷰 산출물(SUMMARY.md, RESOLUTION.md)은 모두 프로덕션 코드 무변경의 regression 테스트 추가다. 신규 테스트는 (1) `PARALLEL_NESTED_DEPTH_EXCEEDED` 런타임 depth 가드(JSDoc-only 약속이던 갭 해소), (2) cancel-others-on-fail signal cascade, (3) nested concurrency silent clamp, (4) IE single-turn abortSignal 전파, (5) text-classifier abortSignal 전파를 각각 커버한다. 각 테스트의 단언 조건은 관련 spec(`4-nodes/1-logic/10-parallel.md`, `conventions/node-cancellation.md`)의 요구사항 ID·행위 명세와 line-level 로 일치한다. RESOLUTION W1·W3 조치도 코드에 정확히 반영됐다. 유일한 미비점은 `spec/conventions/node-cancellation.md §6` 표에 신규 AI 노드 단위 테스트 행이 갱신되지 않은 SPEC-DRIFT 로, 코드 되돌리기가 아니라 spec 반영이 필요하다.

## 위험도
LOW

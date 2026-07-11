# API 계약 리뷰 — `InteractionService.getStatus()` 2단계 컬럼 projection

- 대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()`, line 245-381)
- 엔드포인트: `GET /api/external/executions/:executionId` (EIA §5.3)
- diff base: `origin/main`
- 관련: `plan/in-progress/eia-getstatus-column-projection.md`, `review/consistency/2026/07/10/22_25_21/SUMMARY.md`

## 결론 먼저

"HTTP wire 응답 형식 무변경" 주장은 **사실로 확인**된다. 필드별 값·존재 여부(`id`/`workflowId`/`status`/`seq`/`currentNode`/`context`(키 생략 vs null 포함)/`result`/`error`/`updatedAt`)가 변경 전후 동일 소스 컬럼에서 동일 로직으로 조립됨을 line-by-line 대조로 확인했고, 신규 unit 테스트(`interaction.service.spec.ts` 하단 5건)가 이를 회귀 가드로 고정한다. `ExecutionStatusDto`/swagger 갱신 불필요, `EXECUTION_NOT_FOUND` 404 조건 동일, 외부 소비자(`channel-web-chat/src/lib/eia-types.ts`, `eia-client.ts`)의 필드는 전부 optional/loose-typed 라 파싱 영향 없음. 다만 아래 INFO 항목 2건은 참고용으로 기록한다.

## 발견사항

### [INFO] 2단계 조회가 `conversationThread` 읽기 시점을 `status` 캡처 시점에서 분리 — 기존 스냅샷 계약과 정합, 새 위험 클래스 아님
- 위치: `interaction.service.ts:245-301` (1단계 `select`, 2단계 `Promise.all([threadRow, nodeExec])`)
- 상세: 변경 전에는 `execution.conversationThread` 가 `status` 를 읽은 **같은 row 읽기**에서 나왔다(원자적 단일 SELECT). 변경 후에는 1단계에서 `status` 를 확정한 뒤, `WAITING_FOR_INPUT` 분기에서 별도 쿼리로 `conversationThread` 를 재조회한다. 이론상 그 사이 interaction/park-resume 이 진행돼 두 번째 쿼리가 "status 판정 시점 이후" 상태를 반영한 thread 를 가져올 수 있는 좁은 race window 가 새로 생긴다.
  - 다만 이 클래스의 race 는 이미 spec 이 명시적으로 수용한 계약이다: EIA §5.3 응답은 "스냅샷"이고(spec 1104-1131 R17 rationale), `nodeExecutionRepository.findOne` 도 기존부터 `execution` 읽기 이후의 별도 쿼리였다(같은 파일, 변경 전 코드에서도 순차 실행). `plan/in-progress/eia-getstatus-column-projection.md` 결정 메모와 consistency-check Info 항목도 "새 위험 클래스 아님"으로 동일하게 평가했다.
  - 실질 영향은 두 방향 모두 무해: (a) thread 가 status 캡처 시점보다 최신이면 클라이언트는 더 신선한 데이터를 받을 뿐, (b) row 자체가 사라지면(실무상 execution 은 hard-delete 경로가 없고, `workflow.remove()` cascade 로만 이론상 가능) 기존 "durable thread 없음" graceful 경로(키 생략)로 흡수되며 이는 spec 441-442 행이 이미 "부재 시 키 생략" 을 명문화한 정상 상태다.
- 제안: 조치 불필요. 다만 이 race window 확장이 코드 주석/plan 에는 있으나 spec 본문(§5.3)에는 "2단계 조회 결과 conversationThread 는 status 확정 시점 대비 최대 O(1 query) 지연될 수 있다" 는 문구가 없다 — 향후 유사 최적화(예: `currentNode` 조회도 조건부 분리)가 누적되면 스냅샷 정합성 서술을 spec 에 한 줄 명시해 두는 편이 추적에 유리하다(강제 아님).

### [INFO] `waiting_for_input` 상태의 요청당 DB round-trip 증가 (2→3 쿼리) — rate-limit SLA 자체엔 영향 없음
- 위치: `interaction.service.ts:251-294`
- 상세: 변경 전은 `waiting_for_input` 응답 조립에 쿼리 2회(전체 execution row 1회 + nodeExec 1회, 순차)였다. 변경 후는 3회(얇은 execution row 1회 + [threadRow, nodeExec] 병렬 2회) — `Promise.all` 병렬화로 latency 증가는 상쇄되지만 커넥션 풀 사용량(동시 커넥션 점유 수)은 순간적으로 늘어난다. `@RateLimit('status')` 는 분당 120 요청(execution 당)이라는 **요청 수** 제약이지 DB 커넥션 예산이 아니므로 이 자체가 계약 위반은 아니다.
- 제안: 별도 조치 불필요 — 성능/용량 관점 참고 사항. 다만 `waiting_for_input` 상태의 execution 이 다수 동시 폴링되는 시나리오(위젯 폴백 폴링 등)에서 커넥션 풀 포화가 관측되면 이 지점을 1차 후보로 검토할 것.

## 항목별 확인 결과 (요청된 6가지)

1. **필드별 동일성** — `id`/`workflowId`/`status`/`seq`(`SSE_SEQ_PLACEHOLDER`) 는 조립 로직 불변. `currentNode`/`context` 는 동일 `nodeExec` 기반 조립(선택 컬럼만 소스가 분리됐을 뿐 결과 shape 동일, `context.conversationThread` 키 생략 vs 존재 분기도 `? {conversationThread} : {}` 스프레드 그대로 유지 — 신규 unit 테스트 `not.toHaveProperty('conversationThread')` 로 고정). `result`/`error` 는 `outputData` 를 1단계 `select` 에 명시 포함(`interaction.service.ts:259`)해 완료/실패 시 동일 마스킹 로직(`deepRedactSecrets`) 적용. `updatedAt` 은 `startedAt`/`finishedAt` 둘 다 1단계 `select` 에 포함(`:257-258`)돼 있고, "누락 시 `new Date()` 침묵 fallback" 회귀를 막는 전용 단언 테스트(`updatedAt — finishedAt 우선, 없으면 startedAt 의 실값`)가 신설됨 — 확인 완료.
2. **`ExecutionStatusDto` 정합/swagger** — `dto/responses.dto.ts` 는 이번 diff 에 포함되지 않았고, 조사 결과 필드 shape 변경이 없어 swagger jsdoc 갱신 불필요가 맞다. `context`/`result`/`error` 는 이미 `additionalProperties: true` 로 느슨하게 선언돼 있어 내부 조립 방식 변경에 영향받지 않음.
3. **`EXECUTION_NOT_FOUND` 404 조건** — 1단계 조회 실패 시에만 404(`:262-266`, 변경 전과 동일). 2단계(`threadRow`) 가 null 이면 404 로 승격하지 않고 "durable thread 없음" 그레이스풀 경로로 흡수한다(`:299-301`, 테스트 `2단계 재조회가 null(조회 간 row 소멸)이면 conversationThread 키 미동봉` 로 고정). 이 설계는 spec 441-442 행의 "부재 시 키 생략(형제 필드의 null 관례와 다름)" 규약과 합치하며, execution row 는 코드베이스 전체에서 직접 hard-delete 경로가 없음(검색 결과 0건, `workflow.remove()` cascade 로만 이론상 가능)을 확인했다 — 2단계 null 을 404 로 승격하지 않는 결정은 계약상 타당.
4. **외부 소비자 (`channel-web-chat`)** — `eia-types.ts` 의 관련 필드(`status`/`context`/`result`/`error`/`seq`/`updatedAt`/`conversationThread`)는 전부 optional 또는 `unknown` 타입으로 선언돼 있어 파싱 계약에 영향 없음. `eia-client.ts::getStatus` 는 응답을 그대로 통과시키는 thin wrapper — 계약 변화 없음 확인.
5. **rate-limit 영향** — `@RateLimit('status')` 는 분당 120 요청(execution 당)의 **요청 수** 제한이며 이번 변경은 요청 수가 아닌 요청당 내부 쿼리 수만 바꾼다. 계약(SLA) 문서상 쿼리 수 약속은 없으므로 위반 아님 — 위 INFO 항목 참고.
6. **하위 호환성** — breaking change 없음. 기존 클라이언트(웹챗 위젯, 향후 3rd-party EIA 소비자) 모두 영향 없음.

## 요약

`getStatus()` 의 2단계 컬럼 projection 변경은 응답 조립에 사용하는 6개 컬럼(`id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData`)을 1단계에 완전히 포함하고, `waiting_for_input` 전용 `conversationThread` 만 조건부 재조회로 분리한 순수 내부 최적화로, HTTP wire 응답 형식·`ExecutionStatusDto` 계약·404 에러 조건·외부(`channel-web-chat`) 소비 계약 모두 변경 전과 동일함을 코드 대조와 신규 unit 테스트로 확인했다. 유일한 부수 효과는 `waiting_for_input` 상태에서 status 확정과 conversationThread 재조회 사이에 좁은 스냅샷 race window 가 미세하게 늘어난 점과 요청당 DB round-trip 이 1회 늘어난 점인데, 둘 다 spec 이 이미 "응답은 스냅샷" 으로 수용한 계약 범위 내이고 rate-limit(요청 수 기반)에도 영향이 없어 Critical/Warning 급 계약 위반은 발견되지 않았다.

## 위험도

LOW

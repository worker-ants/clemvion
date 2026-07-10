# 성능 리뷰 — `InteractionService.getStatus()` 2단계 projection

대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts`
diff base: `origin/main...HEAD`

## 발견사항

### F1 — [INFO] TOAST 회피 주장은 기술적으로 타당함 (과장 아님)
- 위치: `interaction.service.ts:251-260` (1단계 thin select) vs 변경 전 `findOne({where:{id}})`
- 상세: Postgres 는 row-store 라 PK lookup 시 heap page 자체는 select list 와 무관하게 읽히지만, **out-of-line TOAST 값의 실제 fetch/역직렬화는 해당 컬럼이 target list 에 있을 때만 발생**한다. `conversation_thread` 상한(500 turn × 4000자 ≒ 2MB)은 Postgres TOAST 임계값(~2KB, 압축 후 기준)을 크게 초과하므로 거의 항상 out-of-line 저장이며, 큰 스레드일수록 TOAST 청크 수가 많아진다(2MB ÷ ~2KB 청크 ≈ 1000개 안팎). 이 컬럼을 select 에서 빼면 해당 TOAST 청크들에 대한 추가 조회·압축해제·네트워크 직렬화가 **실제로** 회피된다. `waiting_for_input` 이 아닌 상태(running/pending/completed/failed) 에서는 순수 이득.
- 제안: 없음 — 판단만 확인. 다만 PR 설명/plan 문서에 이 TOAST 메커니즘 근거를 한 줄 추가해두면 향후 "PK 조회인데 컬럼 projection 이 의미 있냐"는 재질문을 줄일 수 있음(선택).

### F2 — [WARNING] `waiting_for_input` 경로: `Promise.all` 이 상쇄하는 건 nodeExec 쿼리 시간뿐, 신규 왕복 자체는 상쇄되지 않음
- 위치: `interaction.service.ts:277-294`
- 상세: 변경 전은 "풀 로우 조회(스레드 포함) 1회 + nodeExec 조회 1회" = 순차 2쿼리, peak 커넥션 사용 1. 변경 후는 "얇은 조회 1회 + (스레드 재조회 ∥ nodeExec 조회)" = 3쿼리, peak 커넥션 사용 2. `Promise.all` 은 2단계 내부의 두 쿼리를 병렬화하지만, **1단계에서 이미 발생한 신규 왕복(같은 row 를 PK 로 두 번 찾는 것) 자체는 상쇄 대상이 아니다.** 즉 스레드가 큰 경우 총 지연시간은 "1단계(얇은 조회, 빠름) + max(2단계 스레드 재조회 ≈ 기존 풀 로우 조회와 동등한 detoast 비용, nodeExec 조회)" 로, 기존 "풀 로우 조회(스레드 포함) 1회" 보다 **왕복 1회만큼 순수하게 늘어난다.** 절감은 0, 손실만 존재하는 경로.
  - 손실 규모 자체는 작다(PK 인덱스 lookup 1회, 통상 서브 ms~수 ms) — CRITICAL 아님.
  - peak 커넥션 사용량이 1→2 로 늘어나는 점도 유의: `database.config.ts:14` 의 pg pool 기본 `max=10` 은 앱 전체(엔진·웹훅 등)와 공유되는 자원이라, `waiting_for_input` 상태의 동시 폴링이 몰리는 시나리오(아래 F4)에서는 pool 대기/`connectionTimeoutMs` 초과 리스크가 (미미하게나마) 커진다.
- 제안: JSDoc 주석("추가 왕복이 latency 로 드러나지 않게 한다")의 표현을 "nodeExec 조회 시간만 흡수, 신규 execution 재조회 자체의 지연은 상쇄 대상이 아님"으로 정정 권장. 실질 개선을 원하면 F5 참조.

### F3 — [INFO] `outputData` 를 base projection 에 남긴 판단은 타당
- 위치: `interaction.service.ts:259`, `executions/entities/execution.entity.ts:74-78`
- 상세: `output_data` 는 엔진이 `COMPLETED`/`FAILED` 처리 시점에만 채운다(`execution-engine.service.ts:2124,2289,3232,4367`). 즉 `running`/`pending`/`waiting_for_input` 구간에는 사실상 `NULL` 이라 이 컬럼을 base projection 에 포함해도 실질 낭비가 거의 없다. 2단계로 미루면 terminal 상태에서 왕복만 늘고 얻는 게 없다는 plan 문서(`eia-getstatus-column-projection.md` 결정 메모)의 근거도 정합.
- 제안: 없음.

### F4 — [WARNING] "hot-path 실익" 재평가 — waiting_for_input 이 실제로는 폴링 트래픽의 다수를 차지할 가능성
- 위치: `interaction.controller.ts:171-175` (`"polling 클라이언트를 위한 경량 상태 조회"`), `interaction-rate-limiter.service.ts:9-10` (execution 당 분당 120)
- 상세: 이 endpoint 는 SSE 폴백/재연결용으로 설계돼 있으나 "polling 클라이언트" 를 명시적으로 지원 대상에 포함한다. AI 대화형 워크플로우 특성상 `waiting_for_input` (봇 응답 대기/사용자 입력 대기) 은 세션 내 **체류 시간이 가장 긴 상태**일 가능성이 높다. 즉 실제 트래픽 분포가 문서의 "폴링이 잦은 running/pending, 종료 후 completed/failed" 가정과 달리 오히려 `waiting_for_input` 에 쏠릴 수 있고, 이 경우 F2 의 "이득 없는" 경로가 트래픽의 다수를 차지해 이번 최적화의 실효 규모가 plan 문서 서술보다 작아질 수 있다.
- 제안: 배포 후 `getStatus` 호출을 상태별로 계측(로그/메트릭)해 waiting_for_input 비중을 확인 권장. 비중이 크다면 F5(쿼리 병합)와 F8(반복 재-redact 비용)이 다음 최적화 우선순위.

### F5 — [INFO] 2단계 쿼리를 execution↔nodeExecution LEFT JOIN 단일 쿼리로 병합 가능 (제안, 필수 아님)
- 위치: `interaction.service.ts:281-294`
- 상세: 2단계의 두 쿼리는 서로 다른 테이블(`execution`, `node_execution`)을 각각 PK/FK 로 조회하지만, `execution` 은 이미 1단계에서 같은 PK 로 한 번 찾은 바로 그 row 다. QueryBuilder 로 `node_execution` 을 LEFT JOIN 하면서 `execution.conversation_thread` 를 함께 select 하면 waiting 경로의 총 쿼리 수를 3→2 로, peak 커넥션 사용을 다시 1로 되돌릴 수 있어 F2 의 손실을 상쇄한다.
- 제안: 필수는 아님(이득이 서브 ms 수준). 다만 pool 압박이 실측으로 확인되면(F4 계측 이후) 우선 검토.

### F6 — [INFO] 문서화되지 않은 부수적 이득 — 나머지 jsonb 컬럼 오버페치도 함께 제거됨
- 위치: `interaction.service.ts:283-285` (`select: ['id', 'conversationThread']`) vs 변경 전 `findOne({where:{id}})` (select 미지정)
- 상세: 변경 전 코드는 `conversation_thread` 뿐 아니라 `input_data`/`error`/`user_variables`/`resume_call_stack` 등 `Execution` 엔티티의 **다른 모든 jsonb 컬럼**도 매 상태에서 통째로 읽고 있었다. 이번 변경으로 2단계에서 `conversationThread` 만 명시 select 하게 되어, 문서(plan/주석)에 언급되지 않은 이 부수 컬럼들의 오버페치도 함께 제거됐다 — 실제 절감 규모는 plan 문서가 서술한 것보다 오히려 더 클 수 있음(다른 jsonb 컬럼들의 실측 크기에 따라 다름).
- 제안: 없음(긍정적 부수효과, 기록 목적).

### F7 — [INFO] 쿼리 플랜/인덱스 회귀 없음
- 위치: 전체 diff
- 상세: 세 조회 모두 `where: { id }` (PK) 조건이며 select 컬럼 목록 변경은 Postgres 플래너의 access path(Index Scan on `execution_pkey` + heap fetch)에 영향을 주지 않는다. 컬럼 projection 은 target list 단계에서만 작용. 인덱스 신설/제거 없음, 회귀 없음.
- 제안: 없음.

### F8 — [INFO] (범위 밖, 회귀 아님) `redactThreadForPublic` 의 O(스레드 크기) 비용은 waiting 폴링마다 여전히 반복
- 위치: `interaction.service.ts:299-301`, `shared/conversation-thread/thread-renderer.ts:60-70` (`redactThreadForPublic`/`redactTurnForPublic`)
- 상세: `waiting_for_input` 상태에서 클라이언트가 짧은 간격으로 반복 폴링하면, 스레드 내용이 이전 폴링과 동일해도 **매 요청마다** 전체 턴을 순회하며 정규식 기반 secret 마스킹을 다시 수행하고(`turns.map(redactTurnForPublic)`), 최대 2MB 페이로드를 매번 JSON 직렬화·전송한다. 이는 본 diff 이전부터 존재하던 동작(구버전도 같은 분기에서 `redactThreadForPublic(execution.conversationThread)` 호출)이라 **회귀는 아니다.** 다만 F4 처럼 waiting_for_input 폴링이 실제 트래픽의 다수라면, 이번 projection 최적화보다 이쪽(반복 fetch+redact 자체를 줄이는 것 — 예: 최근 조회 이후 변경 없으면 304/캐시, 또는 turn 개수 기반 델타)이 더 큰 잠재 절감처.
- 제안: 이번 PR 범위에 포함할 필요는 없음. 계측(F4) 결과에 따라 후속 최적화 후보로 plan 백로그에 남길 것을 권장.

## 요약

이번 변경은 `getStatus()` 를 상태 무관 풀 로우 조회에서 2단계 조건부 조회로 바꿔, `running`/`pending`/`completed`/`failed` 상태(그리고 부수적으로 `input_data`/`error`/`user_variables`/`resume_call_stack` 등 다른 jsonb 컬럼도)에서 최대 2MB 급 `conversation_thread` TOAST 값을 더 이상 읽지 않는 실질적 절감을 제공한다. Postgres TOAST 메커니즘상 이 절감 주장은 과장이 아니라 기술적으로 타당하다. 다만 `waiting_for_input` 경로는 같은 row 를 PK 로 두 번 찾는 구조가 되어 왕복 1회·peak 커넥션 2배라는 작은 순손실이 생기고, `Promise.all` 은 이 신규 왕복 자체가 아니라 nodeExec 조회 시간만 상쇄한다는 점에서 주석의 "상쇄" 표현은 다소 과장이다. 더 근본적으로, AI 대화형 워크플로우 특성상 실제 폴링 트래픽이 오히려 `waiting_for_input` 상태에 쏠릴 가능성이 있어, 이번 최적화의 실익 규모는 트래픽 분포 계측 전까지는 확정하기 어렵다(문서가 전제한 "폴링 대부분은 non-waiting" 가정이 뒤집힐 수 있음). PK 조회 기반이라 인덱스/쿼리 플랜 회귀는 없다. 종합적으로 방향은 옳고 위험은 낮으나, WARNING 항목(F2/F4)은 배포 후 상태별 호출 비중 계측으로 실증하는 것을 권장한다.

## 위험도

LOW

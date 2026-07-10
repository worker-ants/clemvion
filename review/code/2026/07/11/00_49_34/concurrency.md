# 동시성(Concurrency) Review

검토 대상: `resolveWaitingNodeExecutionId` 2왕복(find→findOne) → 단일 JOIN QueryBuilder(getRawMany) 통합
(직전 리뷰 `review/code/2026/07/11/00_03_25/SUMMARY.md` WARNING #6 "TOCTOU 윈도우 소폭 확장" 에 대한 fix 검증)

## 검증 방법

- `git diff origin/main -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 로 실제 diff 전문 확인 (prompt 페이로드가 크기 제한으로 이 파일 diff 를 생략했음)
- `claimResumeEntry`(execution-engine.service.ts:984) 원자 claim 구현부 직접 확인 — 본 diff 대상 밖, 무변경
- `continuation-bus.service.ts::publish` — BullMQ enqueue 경로, 상태 전이 없음을 확인
- `node-execution.entity.ts` / `node.entity.ts` — QueryBuilder 가 참조하는 컬럼명(`node_id`/`output_data`/`started_at`/`type`) 매핑 확인
- `execution-engine.service.spec.ts` diff — 신규 mock(`mockWaitingQb`)이 실제 QueryBuilder 체인(`innerJoin`/`select`/`addSelect`/`where`/`andWhere`/`orderBy`/`getRawMany`)을 그대로 미러링하는지 확인
- `execution-park-resume.e2e-spec.ts` diff — 실 Postgres 대상 회귀 e2e(form/buttons 표면) 확인

## 발견사항

- **[INFO]** TOCTOU 윈도우가 실제로 이전 수준(단일 왕복)으로 좁혀짐 — 확인됨
  - 위치: `execution-engine.service.ts::resolveWaitingNodeExecutionId` (구 `find()` + 신규 `nodeRepository.findOne()` 2왕복 → `createQueryBuilder('ne').innerJoin('ne.node','n')...getRawMany()` 단일 왕복)
  - 상세: 직전 리뷰가 지적한 "find→findOne→publish 2왕복" 은 이번 diff 에서 `nodeRepository.findOne` 호출이 완전히 제거되고, WAITING row(`id`/`nodeId`) + `node.type` + `interactionType`(JSONB path 투영) 을 단일 SELECT 로 가져오도록 재작성됐다. 이어지는 `assertCommandMatchesWaitingSurface(executionId, rows[0], expectedCommand)` 는 `handlerRegistry.getMetadata()`(in-memory 동기 조회) + `resolveWaitingSurface`(순수 함수)만 호출해 **추가 I/O 가 없다**. 따라서 "대기 행을 읽은 시점" 과 "publish(enqueue) 시점" 사이의 비원자(non-atomic) 구간은 이 PR 계열이 표면 가드를 추가하기 이전(feature 도입 전) 의 단일-`find()` 베이스라인과 동일한 폭으로 복귀했다 — RESOLUTION.md #5/#6 의 주장과 실제 diff 가 일치한다.
  - 제안: (조치 불요, 확인 목적) — 후속으로 이 chokepoint 에 유사 로직을 추가할 때는 반드시 "표면 판정을 위한 추가 필드는 같은 QueryBuilder 의 `addSelect`" 원칙을 유지해 왕복 수를 다시 늘리지 않도록 register 해 둘 것.

- **[INFO]** publisher-advisory / worker-authoritative 계약 불변 확인
  - 위치: `execution-engine.service.ts::claimResumeEntry` (984-1041행, 본 diff 미포함)
  - 상세: 실제 "동일 turn 이중 실행 0" 불변식은 `resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface` 가 아니라, worker 측 `claimResumeEntry` 의 **단일 트랜잭션 내 조건부 UPDATE 페어링**(NodeExecution `WAITING_FOR_INPUT→RUNNING`, 이어 Execution `{WAITING_FOR_INPUT,RUNNING}→RUNNING`, `affected=0` 이면 discard)이 담당한다. publisher 사전 검증은 이 트랜잭션에 관여하지 않는 순수 read-only SELECT + in-memory 판정이며, 이번 diff 는 `claimResumeEntry` 를 전혀 건드리지 않았다. 즉 publisher 는 여전히 "advisory"(빠른 동기 거부로 UX 개선), worker(`claimResumeEntry`)가 여전히 "authoritative"(데이터 무결성) — 계약 분리가 그대로 보존된다. 이는 SUMMARY.md INFO #22("claimResumeEntry 원자 claim 계약 불변")의 주장과 일치.
  - 제안: 조치 불요.

- **[INFO]** second-arrival 409 직렬화는 "단일 find 수준" 으로 복귀했으나, 그 수준 자체가 본래 hard guarantee 가 아님 (pre-existing, 본 diff 로 인한 신규 리스크 아님)
  - 위치: `execution-engine.service.ts::resolveWaitingNodeExecutionId` (SELECT), `continuation-bus.service.ts::publish` (enqueue), `execution-engine.service.ts::claimResumeEntry` (실제 승자 결정)
  - 상세: EIA §5.1 (`spec/5-system/14-external-interaction-api.md:508`)의 "second-arrival 은 409 STATE_MISMATCH — 첫 명령이 이미 waiting_for_input→resumed 전이를 일으킨 뒤" 서술은, 두 명령이 **그 전이가 실제로 관측 가능한 시간 간격**을 두고 도착하는 경우를 전제로 한다. `resolveWaitingNodeExecutionId` 의 SELECT 는 락(`FOR UPDATE`)도 advisory lock 도 걸지 않는 plain read 이고, `publish()` 는 상태를 바꾸지 않고 BullMQ 에 enqueue 만 한다(각 호출은 Redis `INCR` 로 서로 다른 `seq`→다른 `jobId` 를 받으므로 BullMQ dedup 도 두 요청을 걸러주지 않는다). 따라서 **진짜 동시(서브-밀리초) 도착**이라면 두 요청 모두 SELECT 를 통과하고 두 요청 모두 enqueue 될 수 있고, 최종 승자는 `claimResumeEntry` 의 조건부 UPDATE 가 가리며, 패자는 `affected=0` → **ack-and-discard**(HTTP 계층에는 이미 202 가 나간 뒤이므로 동기 409 가 아님)로 처리된다. 이는 본 diff 가 새로 만든 동작이 아니라 이 chokepoint 가 애초부터 가진 best-effort 특성이며, 이번 fix 는 그 윈도우를 "표면 가드 도입으로 넓어진 상태" 에서 "가드 도입 이전 폭" 으로 되돌린 것뿐이라 회귀는 아니다.
  - 제안: 조치 불요 (정보 제공 목적). 만약 향후 "second-arrival 409" 를 진짜 hard guarantee 로 승격할 필요가 있다면 `resolveWaitingNodeExecutionId` SELECT 에 `pg_advisory_xact_lock(execution_id 해시)` 또는 `SELECT ... FOR UPDATE` 를 추가하는 별도 트랙이 필요하다(현재 스코프 밖).

- **[INFO]** 리소스 풀링 관점 — 왕복 감소는 순부수효과로 긍정적
  - 위치: `execution-engine.service.ts::resolveWaitingNodeExecutionId`
  - 상세: 2왕복→1왕복 통합은 이 hot-path chokepoint(모든 인터랙션 명령이 통과)가 커넥션 풀에서 커넥션을 점유하는 시간·횟수를 줄인다. 동시 다발 continuation 트래픽 하에서 풀 경합을 완화하는 방향이라 concurrency/리소스 풀링 관점에서 순전히 개선.
  - 제안: 조치 불요.

## 요약

직전 리뷰가 지적한 "find→findOne→publish 2왕복이 TOCTOU 윈도우를 넓힘" WARNING 은 실제 diff 확인 결과 정확히 해소됐다 — `nodeRepository.findOne` 이 제거되고 단일 QueryBuilder JOIN(`getRawMany`)으로 WAITING row·`node.type`·`interactionType` 을 한 번에 가져오며, 이어지는 표면 판정(`assertCommandMatchesWaitingSurface`)은 추가 I/O 없는 순수 동기 로직이라 read-to-publish 구간이 가드 도입 이전의 단일-`find()` 베이스라인 폭으로 복귀했다. 데이터 무결성을 실제로 지키는 worker-authoritative 원자 claim(`claimResumeEntry`, 단일 트랜잭션 조건부 UPDATE 페어링)은 이번 diff 에서 전혀 손대지 않았으며 publisher 는 여전히 advisory 지위만 가진다 — 두 계약의 역할 분리는 그대로 보존된다. "second-arrival 409" 직렬화는 서술적으로는 이전 수준으로 복귀했지만, 그 수준 자체가 본래 진짜 동시 도착에 대한 hard guarantee 가 아니라 best-effort 라는 점은 이 diff 이전부터 존재하던 특성이며 본 PR 이 새로 유발한 리스크가 아니다. 신규 CRITICAL/WARNING 급 동시성 결함은 발견되지 않았다.

## 위험도

LOW

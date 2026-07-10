# 동시성 코드 리뷰 — getStatus() 2단계 projection

대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`
diff base: `origin/main` (변경: 단일 `findOne` → 1단계 thin projection + 2단계 `Promise.all([thread, nodeExec])`)

## 발견사항

- **[INFO]** 1단계(status)와 2단계(conversationThread) 조회 사이 TOCTOU 윈도우 신설 — 실질 위험 낮음
  - 위치: `interaction.service.ts:251-294`
  - 상세: 변경 전에는 `execution.status` 와 `execution.conversationThread` 가 **동일한 단일 `findOne` 행 읽기**에서 나와 서로 다른 시점 값이 될 수 없었다. 변경 후에는 status(1단계, T1)와 conversationThread(2단계, T2, `Promise.all` 내부)가 별도 쿼리라 이론상 T1≠T2 시점 값이다. 다만 `Execution.conversation_thread` 컬럼은 park 진입 시점(`stageDurableResumeSnapshot` → `updateExecutionStatus` 와 **동일 트랜잭션**, `ai-turn-orchestrator.service.ts:427-432`, `button-interaction.service.ts:391`, `form-interaction.service.ts:106` 3개 park 지점)에만 갱신되고 그 사이(resume~다음 park)에는 불변이다. 즉 T1 에서 `status===WAITING_FOR_INPUT` 로 확정된 직후 T2 에서 thread 가 실제로 달라지려면, 그 극히 짧은 두 DB 왕복 간격 안에 **resume 완료 → 노드 실행(대개 외부 API 호출 포함) → 재-park 커밋**까지 전부 끝나야 한다 — 실무상 무시 가능한 확률.
  - 제안: 별도 조치 불요. 이미 plan 문서(`plan/in-progress/eia-getstatus-column-projection.md` "결정 메모")에 동일 결론이 기록돼 있고, 응답은 어차피 point-in-time 스냅샷(폴링 계약)이라 다음 poll/SSE 가 보정한다.

- **[INFO]** thread(2단계)와 nodeExec(2단계) 사이 상호 정합성은 두 개의 독립 커넥션/쿼리에 의존
  - 위치: `interaction.service.ts:281-294` (`Promise.all([threadRow, nodeExec])`)
  - 상세: 변경 전엔 thread 는 T1(status 와 동일 스냅샷)에서 이미 확정, nodeExec 만 T2 에서 별도 조회 — thread 가 nodeExec 보다 "뒤처질" 수는 있어도 "앞설" 수는 없는 단방향 staleness 였다. 변경 후엔 thread·nodeExec 둘 다 T2 대의 독립 쿼리라, 그 사이에 새 park 커밋이 끼어들면 이론상 thread 는 새 park 값을, nodeExec 쿼리는 (커밋 타이밍에 따라) 이전 waiting 노드 또는 null 을 반환하는 **양방향 불일치**가 가능해졌다. 다만 이 역시 두 병렬 쿼리의 왕복 시간(수 ms) 안에 완전한 resume→재-park 사이클이 끼어야 하므로 실무 발생 확률은 극히 낮고, 어느 조합이 나와도 결과는 "약간 stale 하거나 약간 fresh 한 자기완결적 스냅샷"이라 렌더링 오류(예: 존재하지 않는 노드 참조)로 이어지지 않는다.
  - 제안: 조치 불요. 필요 시 후속 관찰 항목으로만 기록.

- **[INFO]** `status===WAITING_FOR_INPUT`(T1)인데 `nodeExec` 가 null 이면 "waiting 이지만 context 없음" 응답 — 기존에도 존재하던 race, 신규 아님
  - 위치: `interaction.service.ts:276, 302` (`if (nodeExec?.node)`)
  - 상세: T1 과 T2 사이 실제로 resume 이 일어나 해당 NodeExecution 이 `WAITING_FOR_INPUT` 을 벗어나면 2단계 nodeExec 쿼리는 매치되는 행이 없어 `null` 을 반환한다. 이 경우 `currentNode`/`context` 는 `null` 로 남고, 최상위 `status` 필드는 T1 값(`waiting_for_input`)을 그대로 반환해 "waiting 인데 상호작용할 게 없는" 응답이 나갈 수 있다. **그러나 이 race 는 변경 전 코드에도 동일하게 존재했다** — 구 코드도 `execution`(단일 findOne)을 읽은 뒤 별도로 `nodeExecutionRepository.findOne(...)` 을 호출했으므로, 그 사이 resume 이 끝나면 구 코드도 동일하게 nodeExec=null 을 반환했다. `Promise.all` 로 병렬화하면서 nodeExec 쿼리 dispatch 시점이 (구 코드의 "동기 redact 변환 이후" 대비) 오히려 더 빨라졌으면 빨라졌지 늦어지지 않았으므로 윈도우가 넓어지지도 않았다.
  - 제안: 조치 불요 — 회귀 아님, 기존 동작 보존. (참고: 완전한 정합성을 원한다면 응답 조립 시 `nodeExec` 가 null 이면 `status` 도 T1 대신 nodeExec 부재를 반영해 재보정하는 방법이 있으나, 이는 이번 diff 범위(순수 조회 최적화)를 넘어서는 별도 기능 변경이라 여기서 요구하지 않음.)

- **[INFO]** `Promise.all` 병렬 dispatch로 요청당 순간 최대 동시 커넥션 수가 1→2로 증가
  - 위치: `interaction.service.ts:281-294`
  - 상세: `getStatus` 는 트랜잭션/QueryRunner 로 감싸여 있지 않음을 확인했다(컨트롤러에 `IdempotencyInterceptor` 는 POST(`interact`/`cancel`)에만 붙고 GET `getStatus`(`interaction.controller.ts:167-190`)에는 없음, 별도 `TransactionInterceptor`/`@Transactional` 도 이 모듈에 없음). 따라서 각 `Repository.findOne` 은 독립적으로 pool 커넥션을 획득/반납하며 트랜잭션 격리 이슈(같은 트랜잭션 내 교차 커넥션에 의한 self-lock 등)는 없다. `Promise.all` 이 두 쿼리를 동시에 dispatch 하는 순간 이 요청 하나가 pool 커넥션을 2개까지 동시 점유할 수 있어(변경 전은 항상 1개씩 순차 점유), rate limit 이 execution 당 분당 120건(§8.4, `interaction.controller.ts:178-181`)인 고빈도 폴링 엔드포인트인 만큼 다수의 동시 waiting 상태 execution 이 함께 폴링될 때 pool 순간 부하가 소폭 늘어난다. 두 쿼리 모두 `id` 인덱스 단건 조회로 매우 짧게 끝나 실질적 pool 고갈/데드락 위험은 낮다.
  - 제안: 조치 불요. pool `max` 여유가 충분한지 정도만 운영 관점에서 참고.

- **[INFO]** 실패 표면이 1개(구코드 nodeExec)→2개(신코드 threadRow+nodeExec)로 늘어남 — 관찰 가능한 차이는 미미
  - 위치: `interaction.service.ts:281-294`
  - 상세: 구코드는 waiting 분기에서 실패할 수 있는 추가 쿼리가 `nodeExecutionRepository.findOne` 하나였다(thread 는 이미 1단계에서 읽은 값 재사용). 신코드는 `executionRepository.findOne(threadRow)` 와 `nodeExecutionRepository.findOne` 둘 다 실패 가능 지점이다. `Promise.all` 은 둘 중 하나라도 reject 하면 즉시 reject(다른 쪽은 백그라운드에서 계속 진행되지만 `Promise.all` 배열 원소로 이미 핸들러가 붙어 있어 unhandled rejection 은 아님)하고, 이는 그대로 `getStatus()` 를 throw 시켜 최종적으로 500 으로 귀결 — 구코드도 nodeExec 실패 시 동일하게 500. 관찰 가능한 클라이언트 시맨틱 차이는 없다(둘 다 "일부 쿼리 실패 → 전체 500").
  - 제안: 조치 불요.

## 요약

`getStatus()` 를 1단계(status thin projection) + 2단계(`Promise.all`: thread + nodeExec) 조회로 바꾼 변경은 순수 조회 최적화 의도(불필요한 시점에 최대 ~2MB `conversation_thread` jsonb 를 매 폴링마다 읽지 않기 위함)이며, `getStatus` 는 트랜잭션/QueryRunner 밖의 단순 read-only facade 라 커넥션 교차 점유로 인한 데드락·격리 문제는 없다. 1·2단계 사이, 그리고 2단계 내부 thread/nodeExec 두 병렬 쿼리 사이에 이론적인 TOCTOU 윈도우가 존재하지만, `conversation_thread` 컬럼이 park 커밋 시점에만 갱신되는 쓰기 패턴과 REST 응답이 애초에 point-in-time 스냅샷이라는 폴링 계약 덕분에 실무적 발생 확률·영향 모두 낮다. 특히 "waiting 상태인데 nodeExec 가 null" 케이스는 변경 전 코드에도 동일하게 존재하던 race 로, 이번 diff 가 새로 만든 결함이 아님을 코드·git history 비교로 확인했다. 개발자가 이미 plan 문서(`plan/in-progress/eia-getstatus-column-projection.md`)에 동일한 race 분석과 결론을 기록해 뒀고, 테스트(`interaction.service.spec.ts` 신규 5건)가 thread-row-null 시 graceful degrade·secret redaction 유지 등 핵심 회귀 지점을 커버한다. Critical/Warning 급 결함은 발견되지 않았다.

## 위험도

LOW

STATUS: OK

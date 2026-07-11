# 데이터베이스(Database) 리뷰

대상: EIA-RL-07 공개 웹채팅 위젯 idle-wait execution 회수 reaper (`WebchatIdleReaperService` +
`InteractionTokenService.findIdleWebchatExecutionIds` + `ExecutionEngineService.markWebchatIdleTimeout`).
DB 관점에서 실질적으로 관련 있는 파일: `execution-engine.service.ts`,
`interaction-token.service.ts`, `webchat-idle-reaper.service.ts`, `webchat-idle-reaper.types.ts`
및 대응 테스트/e2e. 나머지(CHANGELOG, `.env.example`, `system-status.constants.ts`,
`plan/**`, `review/consistency/**`, `spec/**`)는 큐 이름 등록·문서·산출물로 DB 코드 아님.

## 발견사항

- **[WARNING]** `findIdleWebchatExecutionIds` 의 `INNER JOIN e.trigger` 가 trigger 삭제 시
  회수 대상에서 영구 제외된다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts`
    (`findIdleWebchatExecutionIds`, `.innerJoin('e.trigger', 't')` + `.andWhere('t.authConfigId IS NULL')`)
  - 상세: `execution.trigger_id` 는 `REFERENCES trigger(id) ON DELETE SET NULL`
    (`migrations/V001__initial_schema.sql:218`)이고, `Execution.trigger` 관계도
    `{ nullable: true, onDelete: 'SET NULL' }` 로 매핑돼 있다(`execution.entity.ts`). Trigger 삭제는
    `TriggersController`/`WorkflowsController` 의 `DELETE` 로 활성 execution 존재 여부와 무관하게
    가능해 보인다(가드 미확인). 즉, 익명 공개 위젯 트리거를 소유한 workflow/trigger 가
    "waiting_for_input" execution 이 아직 살아있는 도중 삭제되면 `execution.trigger_id` 가 `NULL`
    로 바뀌고, 이후 해당 execution 은 `INNER JOIN e.trigger` 조건에서 걸러져 **이 reaper 의 후보
    집합에서 영구 제외**된다. `execution_token` 이 자연 만료돼도(즉 provably un-continuable 조건을
    만족해도) 회수되지 않는다. EIA §7.4/§R19 서술상 "park 는 BullMQ job 이 없어 engine recovery
    scanner 대상이 아니다" — 즉 이 reaper 가 유일한 backstop 인데, 그 backstop 자체가 trigger 삭제
    라는 흔치 않지만 재현 가능한 경로에서 조용히 우회된다. 결과적으로 해당 execution/연관
    NodeExecution row 가 `waiting_for_input` 상태로 DB 에 무기한 잔존(§7.4 무기한 보존 불변식이
    "곧 올 입력을 기다림" 케이스만 보호하려던 취지와 어긋남)하며, `system-status`/executions 목록에도
    계속 "대기 중"으로 노출된다.
  - 제안: (a) trigger 가 이미 사라진 execution 도 회수 대상에 포함하도록
    `LEFT JOIN e.trigger` 로 바꾸고 `(t.authConfigId IS NULL OR t IS NULL)` 로 조건을 완화하거나,
    (b) 이 경로가 의도적으로 범위 밖이라면 그 근거를 spec(§R19)에 명시하고 trigger/workflow 삭제 시
    활성 `waiting_for_input` execution 존재를 막는 별도 가드를 두는 것도 대안. 현재 상태로는 코드도
    spec 도 이 edge case 를 언급하지 않아 조용한 데이터 누수(silent leak)로 남는다.

- **[INFO]** `markWebchatIdleTimeout` 의 Execution/NodeExecution 2단 UPDATE 가 단일 트랜잭션이 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`markWebchatIdleTimeout`, 963~ 라인 부근)
  - 상세: `executionRepository` UPDATE(조건부, `WAITING_FOR_INPUT` 가드) 성공 후 별도로
    `nodeExecutionRepository` UPDATE 를 실행한다. 두 UPDATE 사이에 프로세스가 죽으면 Execution 은
    `cancelled` 인데 NodeExecution 은 `waiting_for_input` 로 남는 짧은 비정합 창이 생긴다. 다만 이는
    새로 도입된 위험이 아니라 동일 파일의 기존 `cancelParkedExecution`(890~937 라인)·
    `markQueueWaitTimeout`(2702~ 라인) 과 동일한 확립된 패턴이며, 각 UPDATE 가 독립적으로
    상태 가드(WHERE status = ...)로 멱등하므로 재시도/다음 tick 에 자연 수렴한다. 이 PR 단독의
    결함이라기보다 코드베이스 전반의 수용된 트레이드오프 — 다만 트랜잭션으로 원자화하면 이 창 자체가
    사라지므로, 이 계열 함수들을 한 번에 정리할 기회가 있다면 고려할 만하다(이번 PR 스코프에서
    강제할 사항은 아님).

- **[INFO]** `execution_token.exp_at` 에 별도 인덱스 없음 — 현재 규모에선 문제 없음
  - 위치: `codebase/backend/migrations/V060__execution_token_jti_tracking.sql` (기존),
    `findIdleWebchatExecutionIds` 의 `HAVING MAX(et.expAt) < :threshold`
  - 상세: 쿼리는 `execution.status = 'waiting_for_input'`(기존 `idx_execution_status` 활용 가능) →
    `execution_token`(기존 `idx_execution_token_execution_id` 로 join) → `trigger`(PK join) 순으로
    플래너가 최적화할 여지가 있어, `waiting_for_input` 활성 집합이 작게 유지되는 한(공개 위젯의
    실질 동시 대기 세션 수) 문제되지 않는다. `HAVING MAX(expAt) < threshold` 는 이미 좁혀진
    그룹에서만 평가되므로 `exp_at` 전용 인덱스는 현 단계에서 불요. 다만 플랫폼 전체
    `waiting_for_input` 볼륨(공개 위젯 외 form/button 대기 포함)이 크게 늘어나는 경우
    `execution(status)` 만으로는 선택도가 낮아질 수 있어 장기적 관찰 포인트로만 남긴다.

## 좋은 점 (참고)

- 파라미터화된 쿼리만 사용(`:id`, `:waiting`, `:threshold` 등 named binding) — SQL 인젝션 벡터 없음.
- `findIdleWebchatExecutionIds`/`reap()` 모두 배치 상한(`WEBCHAT_IDLE_REAP_BATCH_LIMIT=500`,
  기존 `RECONCILE_BATCH_MAX=1000` 으로 clamp)과 `REAP_CONCURRENCY=10` bounded-concurrency
  (`Promise.allSettled` 청크 처리)로 대량 데이터에서 직렬 N+1 왕복을 피한다 —
  `reconcileTerminalRevocations`(EIA-RL-06)와 동형 패턴 재사용.
- 스키마 변경 없음(기존 `execution_token`/`execution`/`trigger` 테이블만 재사용) — 마이그레이션
  lock/데이터 손실 리스크 자체가 없다.
- 조건부 UPDATE(`WHERE status = ...`)로 멱등·race-safe — 동시 재개(resume)와 경합해도 `affected:0`
  으로 안전하게 no-op.
- 커넥션 관리는 TypeORM injected repository/`createQueryBuilder` 표준 경로만 사용, 수동 커넥션
  획득/해제 없음 — 누수 위험 없음.
- `revokeAllForExecution` 은 `cancel=true` 인 execution 에 한해서만 호출(불필요 토큰 조회/삭제
  스킵) — 소규모 최적화지만 대량 데이터 상황에서 의미 있음.

## 요약

새 EIA-RL-07 reaper 는 기존 EIA-RL-06(`terminal-revoke-reconciler`) 패턴을 그대로 재사용해 파라미터화된
쿼리, 배치 상한, bounded-concurrency, 스키마 무변경, 멱등 조건부 UPDATE 등 DB 관점에서 견고하게
구현됐다. 다만 `findIdleWebchatExecutionIds` 의 `INNER JOIN e.trigger` 가 trigger 삭제
(`ON DELETE SET NULL`) 시 대상 execution 을 조용히 영구 배제하는 실제 재현 가능한 edge case 가 있어
WARNING 으로 플래그한다 — 이 reaper 가 해당 상태의 유일한 backstop 이라는 spec 상 위치를 고려하면
방치 시 무기한 DB row 잔존(§7.4 취지 위배)으로 이어질 수 있다. Execution/NodeExecution 2단
UPDATE 의 비-트랜잭션 처리는 기존 코드베이스 관행과 동일해 신규 리스크로 보지 않는다.

## 위험도
WARNING(부분) — 전체 위험도: LOW

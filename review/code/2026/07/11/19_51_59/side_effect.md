# 부작용(Side Effect) 리뷰 — EIA-RL-07 공개 위젯 idle-wait execution reaper

## 발견사항

- **[WARNING]** `markWebchatIdleTimeout` 내부 2단계 DB UPDATE 가 비-트랜잭션이라 부분 실패 시 상태 불일치 + cleanup 스킵이 자동·대량 스윕에서 반복 노출
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:221-279` (`markWebchatIdleTimeout`)
  - 상세: `Execution` UPDATE(→`cancelled`) 성공 후 `NodeExecution` UPDATE 가 (DB 예외 등으로) 실패하면, 두 쿼리를 감싸는 단일 outer `try/catch` 가 예외를 흡수하고 `false` 를 반환한다. 이 경우 (1) `Execution` row 는 이미 `cancelled` 로 커밋돼 있지만 (2) `finalizeRehydrationCleanup`(in-memory context/resolver/llm 캐시 정리)·`emitExecution`(SSE/WS `EXECUTION_CANCELLED`)·`releaseExecutionRouting` 이 전부 스킵된다. 결과: 연결된 클라이언트는 취소를 통지받지 못하고, in-memory 캐시가 누수될 수 있으며(정상 종료 경로가 항상 호출하는 `finalizeRehydrationCleanup` 미실행), `websocket.service.ts` 의 `executionRouting` Map 엔트리도 방치된다(terminal emit 이 없으니 자동 release 도 안 되고, 명시적 `releaseExecutionRouting` 호출도 도달하지 못함). `NodeExecution` 은 `waiting_for_input` 로 남아 Execution(`cancelled`)과 상태가 어긋난다.
  - 이 패턴 자체는 기존 `cancelParkedExecution`(같은 파일 910-963행)에서 이미 쓰이던 것으로 **본 diff 가 새로 만든 결함은 아니다**. 다만 `cancelParkedExecution` 은 사용자의 1회성 수동 취소 액션에서만 호출되는 반면, `markWebchatIdleTimeout` 은 `WebchatIdleReaperService` 가 **매분 자동으로, 최대 500건/tick 을 무인 반복**해서 호출한다(`webchat-idle-reaper.service.ts` `REAP_CONCURRENCY=10` 병렬). 노출 빈도·볼륨이 원 패턴 대비 크게 늘어 이 엣지 케이스가 실제로 발생할 확률과 그 결과의 누적(아무도 지켜보지 않는 백그라운드 잡이라 감지가 늦음)이 커진다.
  - 참고: 토큰 revoke 자체는 안전망이 있다 — `Execution` row 가 `cancelled` 로만 커밋돼도 `TerminalRevokeReconcilerService`(EIA-RL-06, `RECONCILE_TERMINAL_STATUSES` 에 `CANCELLED` 포함)가 다음 tick 에 이 execution 의 잔여 `execution_token` 을 별도로 회수하므로 **토큰 유출 위험은 없음**. 문제는 emit 누락·in-memory cleanup 누락·`NodeExecution`/`Execution` 상태 불일치에 국한.
  - 제안: 두 UPDATE 를 한 트랜잭션으로 묶거나(TypeORM `queryRunner`), 최소한 `NodeExecution` UPDATE 실패 시에도 `finalizeRehydrationCleanup`/`emitExecution`/`releaseExecutionRouting` 후속 단계는 best-effort 로 계속 시도하도록 `try` 스코프를 세분화. 부분 실패 케이스에 대한 unit 테스트도 현재 부재(추가된 테스트는 affected:0/affected:1(전부성공) 두 케이스뿐).

- **[INFO]** 새 이벤트 발생원 — 이전에는 무기한 침묵 대기하던 실행이 이제 자동으로 `EXECUTION_CANCELLED`(`cancelledBy:'timeout'`, `error.code:'WEBCHAT_IDLE_TIMEOUT'`) 를 emit
  - 위치: `execution-engine.service.ts:252-260`
  - 상세: `cancelledBy:'timeout'` 값 자체는 기존 `markQueueWaitTimeout`(2702행)이 이미 사용 중인 규약이라 이벤트 vocabulary 신규 도입은 아니다. 다만 이 reaper 가 가동되면 이전에는 `waiting_for_input` 로 영구 잔존해 어떤 terminal 이벤트도 만들지 않던 익명 공개 위젯 세션들이, 매분 스윕마다 새로 `EXECUTION_CANCELLED` 를 발생시킨다. `emitExecution` 은 `NotificationFanout`/`SseAdapter`/WS 등 기존 terminal-이벤트 구독자 전원에게 그대로 전파되므로(코드 변경 없음, 새 구독자 없음), 조직에 이미 webhook 알림이 설정돼 있다면 "취소됨" 알림 볼륨이 이 reaper 도입 이후 늘어날 수 있다. 이는 §R19 가 의도한 backstop 동작이라 버그는 아니지만, 운영 관점에서 알림 폭주 여부를 모니터링할 필요가 있다는 점만 기록.
  - 제안: 별도 조치 불요 — spec 의도된 동작. 배포 후 notification-webhook 큐 볼륨 관찰 권장.

- **[INFO]** 새 BullMQ 큐·워커 등록 — 앱 부팅 시 Redis 의존성 fail-fast 확대
  - 위치: `codebase/backend/src/modules/external-interaction/external-interaction.module.ts:16,55` (`WEBCHAT_IDLE_REAPER_QUEUE` 등록), `webchat-idle-reaper.service.ts:32-46` (`onModuleInit` → `upsertJobScheduler`)
  - 상세: `WebchatIdleReaperService.onModuleInit` 이 실패(예: Redis 장애)하면 예외가 전파돼 Nest 모듈 부팅 자체가 실패한다(`webchat-idle-reaper.service.spec.ts` 의 "fail-fast" 테스트로 명시적으로 의도됨). 이는 이미 존재하는 형제 서비스 `TerminalRevokeReconcilerService`(EIA-RL-06)와 **완전히 동일한 선례 패턴**이라 신규 리스크 유형은 아니다. 다만 인스턴스 부팅 시 Redis 헬스체크에 걸리는 지점이 하나 더 늘었다는 점은 배포/운영 관점에서 인지해 둘 필요가 있다.
  - 제안: 조치 불요 — 기존 규약 준수. 배포 런북에 반영돼 있는지만 확인.

- **[INFO]** `system-status.constants.ts` `MONITORED_QUEUES` 에 항목 추가 — System Status API 응답 표면 변경(additive)
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts:87-91`, `codebase/backend/test/system-status.e2e-spec.ts:39`
  - 상세: 공개 API(`GET /api/system-status` 류)가 반환하는 큐 목록에 `webchat-idle-reaper` 항목이 추가된다. e2e 의 `EXPECTED_QUEUE_NAMES` 도 동반 갱신돼 있어 회귀 테스트는 갖춰짐. 이 API 를 정확한 개수/목록으로 파싱하는 외부 소비자(대시보드 등)가 있다면 영향 있음 — 다만 순수 additive 라 기존 파서가 "포함 여부"만 확인한다면 문제 없음.
  - 제안: 조치 불요 — 문서(`spec/data-flow/0-overview.md` 큐 카탈로그, 17→18개)도 동반 갱신됨을 확인함.

- **[INFO]** 신규 환경 변수 `WEBCHAT_IDLE_REAP_GRACE_MS` — 순수 읽기, 부작용 없음
  - 위치: `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.types.ts:35-43` (`resolveWebchatIdleReapGraceMs`), `.env.example:217-223`
  - 상세: `process.env` 를 매 tick 호출 시점에 읽기만 하고(모듈 로드 시 캐싱 없음, 기존 `resolveQueueWaitTimeoutMs` 와 동일 관용), 쓰기·다른 env 오염 없음. 파싱 실패/`0`/음수는 안전하게 기본값(1h)로 fallback. 별도 조치 불요.

## 요약

이 변경은 EIA-RL-06(`terminal-revoke-reconciler`)의 확립된 BullMQ repeatable sweep 패턴을 거의 그대로 복제해 새 backstop(`WebchatIdleReaperService`)을 추가하는 순수 additive 기능이다. 기존 함수 시그니처·공개 인터페이스는 변경되지 않았고(모두 신규 메서드/파일), 신규 env 변수·신규 BullMQ 큐·`system-status` 모니터링 목록 추가는 모두 문서(spec·CHANGELOG·`.env.example`·data-flow 카탈로그)와 동기화돼 있으며 부팅 시 fail-fast 등 운영 동작도 기존 형제 서비스와 동형이라 신규 리스크 유형은 아니다. 다만 `markWebchatIdleTimeout` 이 재사용한 "Execution UPDATE → NodeExecution UPDATE" 비-트랜잭션 2단계 패턴(원 출처: `cancelParkedExecution`)은, 사람이 트리거하는 1회성 취소가 아니라 **매분 최대 500건을 무인·자동으로 반복 처리하는 백그라운드 reaper** 에서 재사용되면서 부분 실패 시(emit·in-memory cleanup·routing release 스킵 + Execution/NodeExecution 상태 불일치) 노출 빈도와 감지 지연이 실질적으로 커진다. 토큰 revoke 자체는 EIA-RL-06 reconciler 가 상태 기반으로 백업하므로 안전하지만, 그 외 부수 정리 단계 누락은 이 diff 가 상속한 리스크를 스케일업한 지점이라 WARNING 으로 기록한다.

## 위험도

MEDIUM

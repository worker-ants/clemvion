---
id: "CLE-EXEC-RECOVERY-SHUTDOWN"
title: "장애 복구와 안전 종료 — 안전 종료와 영속 재개 큐"
type: "design"
version: 4
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-RECOVERY"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-RECOVERY"]
area: "CLE-EXEC"
content_hash: "75caa65474fe7cfc52f0ce510a9fcd303071c3f81231fa47009192c6549243d1"
read_as: "approved_fallback"
task: "CLE-T-CPZBVH"
source_paths: []
mirror_sha256: "541b93606065edee6f864a34dd73d9bbad3e2c4debf67882de6bdcbb763e0c79"
etag: "sha256-2fc6e8f3638aba6ddd66010d790138266a904b0195937fb61b329ffb6896c9dc"
---
## 개요

이 문서는 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 의 하위 문서로 SIGTERM 안전 종료(graceful shutdown) 절차를 정한다. 영속 재개 큐를 택한 결정, 안전 종료 때의 시간 과소 계산 허용, 재개 큐 DLQ 경고를 로그로 남기는 결정은 이 문서의 Rationale 이 맡는다. 재개 큐의 재시도 층 합산은 [체크포인트와 rehydration](CLE-EXEC-RECOVERY-REHYDRATE.md#재시도-층의-합산) 에 있다. 재개 큐의 계약과 발행 규칙은 [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) 이 정한다.

## 안전 종료

SIGTERM 을 받았을 때의 절차다. k8s 재배포, Docker Compose `docker compose down` 등 모든 정상 종료에 적용한다.

1. **수동 실행 진입점은 새 실행을 거부한다.** 수동 실행 진입점 두 곳(`POST /api/workflows/:id/execute`, 단일 노드 실행 `POST /api/workflows/:id/nodes/:nodeId/execute`)이 **503 Service Unavailable** 로 응답한다. 본문은 표준 에러 응답 봉투(`{ error: { code: 'SERVER_SHUTTING_DOWN', message: '...' } }`)이고 `Retry-After: <ceil(SIGTERM_GRACE_MS / 1000)>` 헤더를 함께 싣는다. 에러 응답 봉투의 기준은 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 다. 로드 밸런서 drain 동안 트래픽은 다른 인스턴스로 간다.
   - 다른 시작 경로는 거부하지 않는다. 웹훅, 채팅 채널 인바운드, 스케줄 정기 실행, 스케줄 「지금 실행」, 실행 재실행은 실행 행을 `pending` 으로 저장하고 영속 시작 큐 `execution-run` 에 넣기만 한다. 큐 작업은 Redis 에 남아 다른 인스턴스나 다시 뜬 인스턴스의 워커가 시작한다.
   - WebSocket `execution.start` 는 비채택(won't-do)으로 끝났다(REST 로 대체, 핸들러 없음). 근거는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 에 있다.
2. **이 인스턴스의 BullMQ 워커를 모두 멈춘다.** 실행 큐 세 개(`execution-run` · `execution-continuation` · `background-execution`)의 워커도 여기에 든다. 멈춘 워커는 새 작업을 가져가지 않는다. 워커는 진행 중 작업이 끝날 때까지 기다린다. 실행 큐 워커의 진행 중 작업은 현재 세그먼트를 완료까지 진행한다. 한 세그먼트 안의 노드 dispatch 는 큐를 거치지 않는 in-process 반복문이라 세그먼트의 다음 노드도 계속 시작된다.
3. **입력 대기 실행은 건드리지 않는다.** DB 상태를 그대로 둔다. park 에서 이미 메모리를 비웠으므로 잃는 것이 없다. 사용자 입력이 오면 rehydration 으로 재개한다.
4. **실행 중 노드**는 다음과 같이 처리한다.
   - `SIGTERM_GRACE_MS`(기본 30초)까지 완료를 기다린다.
   - 완료하면 평상시 흐름대로 다음 노드로 진행한다. 재개 큐가 영속이므로 이후 재개는 다른 인스턴스가 가져간다.
   - 완료하지 못하면 그 노드 실행과 실행을 `failed` + `error.code='SERVER_INTERRUPTED'` 로 표시한다. 노드 에러 처리 정책은 보지 않는다. 실행이 `failed` 로 끝나므로 다른 인스턴스가 이어받지 않는다. 다시 돌리려면 재실행한다.
5. `SIGTERM_GRACE_MS` 가 지나면 강제로 끝낸다.

**구현**: `ShutdownStateService` 가 Nest 의 `onModuleDestroy` 에서 종료를 시작한다. Nest 는 전역 모듈의 `onModuleDestroy` 를 마지막에 부르므로 `@nestjs/bullmq` 가 워커를 close 하기 전에 시작한다. `onApplicationShutdown` 은 같은 작업이 끝나기를 기다리기만 한다. 유예 시간은 종료를 시작한 시각부터 한 번만 센다.

- 첫 동작으로 종료 표시를 켠다. 그 뒤로 수동 실행 진입점은 503 + `Retry-After` 로 거부한다. HTTP 서버는 워커를 기다리는 동안 열려 있다.
- 이 인스턴스의 BullMQ 워커를 실행 큐 세 개만이 아니라 **모두** `pause` 한다. 워커 단위 pause 라 다른 인스턴스는 같은 큐에서 계속 작업을 가져간다. 진행 중 작업이 모두 끝나고 추적 중인 노드 실행이 없으면 유예 시간을 다 기다리지 않고 끝낸다. 모든 워커를 멈추는 이유는 이 문서 Rationale 「종료는 워커 close 보다 먼저 시작한다」에 있다.
- 멈출 워커는 `DiscoveryService` 로 찾는다. `@Processor` 로 등록된 이 인스턴스의 워커가 대상이다. `DiscoveryService` 가 배선되지 않으면 경고만 남기고 워커 pause 와 강제 close 를 건너뛴다. 그래서 운영 모듈 `ExecutionEngineModule` 은 `DiscoveryModule` 을 import 한다. pause 가 실패한 워커는 경고를 남기고 끝난 것으로 센다.
- 노드 실행은 실행 시작 때 `ShutdownStateService.registerInFlight` 로 등록되고 끝날 때 해제된다(try 첫 줄과 finally).
- 유예 시간이 지나면 **이 인스턴스가 추적 중인** 노드 실행과 실행만 대상으로(`WHERE id IN (...)`) 각각 원자 UPDATE 로 `failed` + `error.code='SERVER_INTERRUPTED'` 로 표시한다. 그다음 진행 중 작업이 하나라도 남았으면 이 인스턴스의 워커를 모두 강제 close 한다. 그래서 `@nestjs/bullmq` 의 워커 close 도 유예 시간 안에 끝난다. 강제 close 한 실행 큐 작업은 잠금이 만료되면 stalled 로 다른 워커에 재배달될 수 있고, 실행이 `failed` 라 버려진다.
- 노드와 노드 사이(한 노드를 해제하고 다음 노드를 등록하기 전)에 유예 시간이 끝나면 표시할 노드 실행이 없다. 실행은 `running` 으로 남고 강제 close 한 작업은 워커 크래시처럼 [운영 중 stalled 재배달](CLE-EXEC-RECOVERY-REDRIVE.md#운영-중-stalled-재배달) 로 재구동한다.
- 노드 경계의 취소 확인(`assertExecutionNotCancelled`)은 `cancelled` 만 본다. 그래서 유예 시간이 지나 실행을 `failed` 로 표시한 뒤에도 프로세스가 끝날 때까지 dispatch 반복문이 다음 노드를 돌릴 수 있다. 이 틈은 NERV Task `CLE-T-6WSCPE` 가 맡는다.

끊긴 노드 실행과 실행은 `cancelled` 가 아니라 `failed` 다. 안전 종료를 노드 취소 신호로 이어도(NERV Task `CLE-T-6WSCPE`) 같은 상태로 기록한다. 규칙은 [노드 취소](CLE-EXEC-CANCEL.md#취소-에러-분류) 규칙 23 에 있고 결정 근거는 이 문서 Rationale 「끊긴 노드는 정책과 상관없이 `failed` 로 끝낸다」에 있다.

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `SIGTERM_GRACE_MS` | `30000`(30초) | k8s `terminationGracePeriodSeconds` 와 맞춰 설정한다. 셀프 호스팅 Helm Chart 권장값은 `terminationGracePeriodSeconds = ceil(SIGTERM_GRACE_MS / 1000) + 5` 다(5초는 readiness drain 여유). |

워커 동시성, 실행 시간 한도, 재개 큐 시도 횟수는 [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) 의 환경 변수 표에 있다.

## Rationale

### 영속 재개 큐와 안전 종료 (Durable Continuation)

**운영 회귀**: k8s 재배포 때 입력 대기 실행이 한꺼번에 "Execution failed: server restarted while waiting for user input" 으로 끝났다. 원인은 셋이었다. (a) 재개 resolver 가 메모리에만 있었다(`pendingContinuations: Map`). (b) 부팅 복구 스캔이 입력 대기도 stale 대상에 넣었다. (c) SIGTERM 안전 종료가 구현되지 않았다.

**채택, BullMQ 영속 재개 큐(`execution-continuation`) + rehydration**: `background-execution` 큐로 같은 방식이 이미 검증됐고 멱등 키와 DLQ 까지 BullMQ 에 내장돼 있어 새 인프라가 없다. 폼 제출, 버튼 클릭, AI 메시지 응답은 어느 인스턴스로 들어올지 모르므로 입력 대기 실행을 깨우려면 인스턴스 사이 신호 전달이 필요하다. 영속 큐는 at-least-once 의미, jobId 멱등 키, DLQ 를 모두 준다. 메모리 resolver 만 쓰던 방식은 컨테이너가 죽으면 fan-out 수신자 누구도 resolve 하지 못해 사용자 입력이 조용히 사라졌다. 신호가 영속되므로 인스턴스가 죽었다 살아나도 다음 인스턴스가 rehydration 으로 재개한다. 이 결정은 원본 설정 노출 결정([노드 핸들러 계약](CLE-EXEC-HANDLER.md))과 관계가 없다. 그것은 핸들러 층, 이것은 엔진 인프라 층 결정이다.

검토 후 택하지 않은 방향:

- **Temporal·Inngest 같은 전용 워크플로우 엔진으로 이전**: 엔진은 표현식 해석, 멀티턴, 컨테이너, 채팅 채널 트리거 등 도메인 코드를 노드 핸들러 30여 개에 나눠 두고 있어 전면 이전 비용이 너무 크다. durable timer, signal, child workflow 요구가 쌓이면 다시 검토한다.
- **`WAITING_FOR_INPUT → INTERRUPTED` 새 상태 값 도입**: 실행 상태 enum 을 넓히면 DB 마이그레이션, 프론트엔드 상태 표시, 외부 API 응답, 재실행, 실행 내역 필터 등 여러 문서가 함께 흔들린다. 외부 상태는 그대로 두고 안에서 rehydrate 하는 편이 바꿀 곳이 적다.
- **Redis pub/sub 유지 + "Map 에 키가 없으면 기다렸다 재시도"**: 대기·재시도 조정이 작업마다 다르고 at-most-once 한계를 돌아갈 뿐 근본 해결이 아니다.

**sticky fast-path 제거, "항상 큐에 넣는다" 원칙 유지**: 초기 검토안에는 "발행자 인스턴스에 키가 있으면 큐를 건너뛰고 바로 resolve" 하는 sticky fast-path 가 있었다. 옛 원칙 "모든 진입점은 항상 발행한다. '내 Map 에 있으면 바로' 분기는 race 창이다" 와 정면으로 부딪친다. 채택안은 sticky fast-path 를 없애고 "항상 재개 큐에 넣는다" 로 통일한다. 로컬 resolve 로 아끼는 마이크로초는 운영 단순성과 디버깅 가능성보다 가치가 낮다. 옛 원칙은 BullMQ 시대에도 유효하다.

**"키가 없으면 즉시 throw 하지 않는다" 원칙의 확장**: 옛 pub/sub 시대에 "키 없음 → 조용히 건너뜀" 으로 정한 것은 다른 인스턴스의 Map 에 있을 가능성 때문이었다. BullMQ 로 영속한 뒤에는 "키 없음 = DB 에서 다시 만든다" 로 뜻이 강해져 case A rehydration 경로가 됐다. 원칙은 폐기되지 않고 이어진다.

**새 WebSocket 이벤트를 만들지 않는다**: `execution.resumed_after_restart` 같은 새 이벤트는 만들지 않는다. 기존 `execution.resumed`(transient)와 뜻이 비슷해 클라이언트가 헷갈릴 위험이 크고 SSE 매핑까지 고쳐야 한다. 재개 사실은 평상시의 `execution.node.completed` / `execution.node.started` 이벤트로 충분히 보인다. 디버깅용 백엔드 인스턴스 id 가 필요하면 백엔드 로그나 별도 텔레메트리 export 로 처리한다.

**재개 경로에서 outbound routing context 를 다시 등록한다**: 느린 경로 재개는 다른 프로세스나 재시작 뒤의 워커가 가져가므로 `execute()` 때 등록한 routing context(triggerId / workflowId / chatChannel)가 항상 사라져 있다. 특히 `RESUME_INCOMPATIBLE_STATE` 는 "인스턴스 재시작으로 멀티턴 상태를 잃은" 경우다. routing context 를 다시 등록하지 않고 취소를 표시하고 발행하면 채널 어댑터 안내(CCH-AD-05)가 conversationKey 없이 나가 채널에서 조용히 사라진다. 사용자는 "응답 없음" 을 겪고 다음 메시지가 새 대화로 시작된다. 그래서 rehydration 은 실행 행을 확인한 직후 영속된 triggerId / workflowId / `input_data.chatChannel` 로 routing context 를 다시 등록한다(`execute()` 최초 등록과 같은 형태). 새 WS 이벤트 없이 기존 발행 경로의 fan-out 봉투만 되살리므로 위 원칙과 맞는다.

- **best-effort 교환**: 재등록이 예외를 던져도 rehydration 을 막지 않고 warn 로그만 남기고 진행한다. 등록 실패는 "안내가 채널에 닿지 못함" 이라는 부작용이 있지만 그것만으로 실행 재개(또는 취소 표시)를 실패시킬 이유는 아니다. 알림 전달과 실행 정합성을 나눈다.

**안전 종료 때 세그먼트 시간이 덜 세어지는 것을 허용한다(PR2a 결정)**: 실행 시간 한도는 세그먼트 진행 경과분을 메모리의 `segmentStartMs` Map 에 두었다가 세그먼트가 끝날 때(`updateExecutionStatus` 가 `running` 을 떠날 때) `Execution.active_running_ms` 에 flush 한다. SIGTERM 안전 종료로 진행 중 세그먼트가 멈추면 그 경과분이 DB 에 쓰이지 않고 사라질 수 있다. 그 세그먼트가 stalled 로 다른 워커에 재배달되면 새 워커는 `segmentStartMs` 가 없어 그 구간을 세지 못한다. 크래시 재구동(PR3)과 stalled 재배달(PR4)도 세그먼트 시작 시각을 영속하지 않으므로 같은 과소 계산이 남는다. 이 교환을 일부러 허용한다.

- 안전 종료는 드문 인프라 이벤트이고 단일 세그먼트 길이(초~분)는 총 한도(기본 30분)보다 작다. 한도 우회 효과는 미미하다.
- flush 훅(`OnModuleDestroy` + 부분 누적 + DB 저장)을 더하면 SIGTERM 경로가 복잡해지고 재배달 워커의 `segmentStart` 재기록과 경합한다.
- 경합 없는 flush(세그먼트 시작 시각을 Redis·DB 에 영속)는 세그먼트 시작 시각 영속에 달려 있다. PR4 는 사용자 결정(Q2 미룸)으로 마이그레이션 없이 진행해 이를 영속하지 않았다. 과소 계산은 후속 후보로 남는다.
- 그래서 무한 재구동을 막는 1차 경계는 실행 시간 한도가 아니라 **트리거 자체**다(부팅 때 한 번, stalled 1회). 실행 시간 한도는 과소 계산을 감안한 best-effort 2차 경계다. 과소 계산은 "한도를 덜 적용" 하는 방향이라 fail-open 이 아니라 보수적인 과소 적용이며 조용히 과하게 끊을 위험은 없다.

### DLQ 경고는 로그로 남긴다 (Phase 3.1)

재개 큐 DLQ 모니터(`ContinuationDlqMonitorService`)가 OTel 메트릭 대신 구조화된 `logger.error` 경고를 쓰는 근거다.

- Phase 3.1 당시 백엔드는 OTel traces 만 있었다(MeterProvider 미구성, custom 메트릭 0건). DLQ 적재량 경고 하나를 위해 metrics SDK 파이프라인 전체를 들이는 것은 지나쳤다. 지금은 MeterProvider 와 PrometheusExporter 가 구성돼 있고 큐 깊이(DLQ 의 `failed`/`delayed` 포함)는 `clemvion.queue.depth` ObservableGauge 로 나간다. 메트릭 카탈로그는 [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 의 NF-OB-07 에 있다. 그래도 **임계 초과 경고(능동 통지)는 로그 기반을 유지한다.** gauge 는 "관측" 이고 cooldown 경고는 "통지" 라 역할이 다르다. 경고 규칙은 Prometheus/Grafana 나 로그 경고 어느 쪽으로도 만들 수 있다.
- 로그 기반 경고는 기존 운영 인프라에서 바로 쓸 수 있다. `logger.error('[DLQ ALARM] ...')` 는 로그 수집·경고 파이프라인(Sentry, 로그 기반 alert)이 별도 코드 없이 잡는다. cooldown 으로 경고 폭주를 막는다.
- `/health` 엔드포인트에 DLQ 적재량을 싣지 않는다. readiness probe 가 DLQ 누적으로 unhealthy 가 되면 정상 트래픽까지 막힌다. 적재량은 gauge 관측과 경고의 대상이지 readiness 대상이 아니다.
- DLQ 모니터 환경 변수 4종(`CONTINUATION_DLQ_*`)은 안전 종료 유예 시간과 같은 `useFactory` 주입 방식을 따른다. 서비스가 `process.env` 를 직접 읽지 않는다. 안전 종료 쪽의 DI 토큰 이름은 `SHUTDOWN_GRACE_MS` 이고 그 값을 주는 환경 변수는 `SIGTERM_GRACE_MS` 다.

### 끊긴 노드는 정책과 상관없이 `failed` 로 끝낸다 (2026-11-14, CLE-T-GQ7WHS)

원래 4단계는 유예 시간을 넘긴 노드의 실행을 노드 에러 처리 정책대로 처리한다고 적었다. `stop` 이면 실행이 `failed` 로 끝나고 `continue` 면 다음 노드로 진행하며 다른 인스턴스가 미완료 세그먼트를 이어받을 수도 있다는 약속이었다. 노드 에러 처리 정책 enum 에는 `continue` 가 없고 구현은 늘 노드 실행과 실행을 `failed` 로 끝냈다. 사람 결정(2026-11-14, 질문 `01a1d831-1847-7708-9d89-32bc5322ea64` · `01a1d831-1cd9-77a3-bff3-024ba0abd51b`)으로 약속을 거두고 구현을 계약으로 삼았다.

- **에러 처리 정책을 보지 않는다**: 끊긴 노드는 외부 호출이나 부수효과를 반쯤 끝낸 상태일 수 있다. 그 출력으로 다음 노드를 돌리면 결과를 예측할 수 없다. 실행 전체를 `failed` 로 끝내고 사용자가 재실행하는 쪽이 결과를 읽기 쉽다. 취소된 노드에 노드 에러 처리 정책을 쓰지 않는 것([노드 취소](CLE-EXEC-CANCEL.md#취소-에러-분류) 규칙 20)과 같은 이유다.
- **상태는 `cancelled` 가 아니라 `failed` 다**: 노드를 돌리던 중에 서버가 끊은 중단은 사용자가 의도한 멈춤이 아니고 부수효과가 반쯤 남았을 수 있다. 노드를 시작하기 전에 회수하는 큐 대기 초과(`EXECUTION_QUEUE_WAIT_TIMEOUT`)나 재개 인프라 실패(`RESUME_*`)가 실행을 `cancelled` 로 끝내는 것과는 경우가 다르다. 부팅 복구 스캔이 크래시로 남은 행을 닫을 때도 `failed` 를 쓴다([크래시 재구동과 부팅 복구 스캔](CLE-EXEC-RECOVERY-REDRIVE.md)). 안전 종료를 노드 취소 신호로 이어도 상태가 바뀌지 않도록 [노드 취소](CLE-EXEC-CANCEL.md#취소-에러-분류) 규칙 23 이 생산자 태그로 가른다.
- **다른 인스턴스는 이어받지 않는다**: 실행을 `failed` 로 표시한 뒤 프로세스가 끝나면 그 실행의 `execution-run` 작업이 stalled 로 다른 워커에 재배달될 수 있다. 재배달을 받은 워커는 실행 상태가 `pending` 도 `running` 도 아니면 작업을 버린다. 그래서 같은 실행에 새 세그먼트가 시작되지 않고 [크래시 재구동과 부팅 복구 스캔](CLE-EXEC-RECOVERY-REDRIVE.md#남은-zombie-race) 의 세그먼트 직렬화 불변식과 부딪치지 않는다. 표시한 뒤에도 같은 프로세스의 dispatch 반복문이 다음 노드를 돌릴 수 있는 틈(「안전 종료」 구현 항목, NERV Task `CLE-T-6WSCPE`)은 그 프로세스 안의 일이고 새 세그먼트를 만들지 않는다.
- **기각: `continue` 를 노드 에러 처리 정책으로 정의하기**: 끊긴 노드 뒤를 이어 돌리려면 인스턴스 사이에서 세그먼트를 넘겨받는 재개 경로를 새로 만들어야 한다. 그렇게 해도 반쯤 끝난 부수효과 문제는 남는다. 이 방향을 맡던 NERV Task `CLE-T-FTBSKJ` 는 닫았다.
- **기각: `cancelled` 로 바꾸기**: 이미 구현하고 테스트한 `failed` + `SERVER_INTERRUPTED` 계약을 바꿔야 한다. [실행 데이터와 흐름](CLE-EXEC-DATA.md) 의 상태별 에러 코드 표와 [에러 코드 카탈로그 — 워크플로우 실행](../CLE-API/CLE-API-ERRCODES-EXEC.md) 도 함께 바뀐다. 실패 목록에서 서버 중단이 빠지는 것에 비해 얻는 것이 없다.

### 종료는 워커 close 보다 먼저 시작한다 (2026-11-14, CLE-T-9YHJSD)

**실측**: 원래 구현은 `onApplicationShutdown` 에서 종료 표시를 켜고 유예 시간을 셌다. Nest 는 SIGTERM 을 받으면 모든 모듈의 `onModuleDestroy` 를 먼저 부르고 HTTP 서버를 닫은 뒤에야 `onApplicationShutdown` 을 부른다. `@nestjs/bullmq` 는 `onModuleDestroy` 에서 워커를 close 하고, BullMQ 의 기본 close 는 진행 중 작업이 끝날 때까지 기다린다. 2026-11-14 e2e 이미지로 잰 결과(Nest 12.4.0 · `@nestjs/bullmq` 12.0.1 · BullMQ 6.7.2)는 다음과 같았다.

- 노드 10초 시나리오: 워커 close 에 9.45초가 걸렸다. 그동안 수동 실행 요청 58건이 503 이 아니라 202 를 받았다.
- 노드 60초 시나리오(35초에 SIGKILL): 유예 시간이 시작되기 전에 SIGKILL 을 받아 실행과 노드 실행 행이 `running` 으로 남았다. `SERVER_INTERRUPTED` 표시도 없었다.

1단계(503), 4단계(표시), 5단계(유예 시간 뒤 강제 종료)가 지켜지지 않았다.

**결정**(사람 결정 2026-11-14, 질문 `01a1d93d-db04-7382-8461-0fad66c41fe1`): 종료 표시 · 워커 pause · 유예 시간을 모두 `onModuleDestroy` 로 옮긴다. 유예 시간이 끝나면 표시한 뒤 워커를 강제 close 해 `@nestjs/bullmq` 의 close 가 유예 시간을 넘기지 않게 한다. 유예 시간은 한 번만 센다.

**고친 뒤 실측**(같은 방법, 2026-11-14):

- 노드 10초 시나리오: SIGTERM 뒤 첫 요청(171ms)부터 수동 실행 요청 44건이 모두 503 + `Retry-After: 30` 을 받았고 202 는 없었다. 작업은 9.5초에 끝났고 워커 close 는 15ms 걸렸다. 실행은 `completed` 로 끝났다.
- 노드 60초 시나리오: 30초 동안 요청 187건이 모두 503 이었다. 30초에 노드 실행과 실행이 `failed` + `SERVER_INTERRUPTED` 로 표시됐고 워커 close 는 1ms 걸렸다.

결정의 세부:

- **실행 큐 세 개가 아니라 모든 워커를 멈춘다**: 질문의 선택지 문안은 실행 큐 워커 세 개(`execution-run` · `execution-continuation` · `background-execution`)를 멈춘다고 적었다. 그런데 `@nestjs/bullmq` 는 다른 큐의 워커도 같은 `onModuleDestroy` 에서 close 하고, 그 close 도 진행 중 작업을 한도 없이 기다린다. 세 개만 멈추면 다른 큐의 긴 작업 때문에 종료가 유예 시간을 넘긴다. 그래서 이 인스턴스의 워커를 모두 멈추고 유예 시간이 지나도 진행 중 작업이 남았으면 워커를 모두 강제 close 한다. 실행 큐가 아닌 작업에는 노드 실행이 없어 `SERVER_INTERRUPTED` 로 표시하지 않는다. 강제 close 된 뒤에는 그 큐의 stalled 처리를 따른다.
- **워커 단위로 멈춘다**: 큐 단위 pause 는 Redis 의 큐 상태를 바꿔 다른 인스턴스도 멈춘다. 워커 단위 pause 는 이 프로세스만 멈춘다.
- **세그먼트 시간은 여전히 flush 하지 않는다**: 종료를 `onModuleDestroy` 로 옮겼지만 세그먼트 경과 시간을 저장하는 훅은 더하지 않았다. 위 「안전 종료 때 세그먼트 시간이 덜 세어지는 것을 허용한다」 결정은 그대로다.
- **남은 틈**: 노드와 노드 사이에 유예 시간이 끝나면 표시할 노드 실행이 없어 실행이 `running` 으로 남고 stalled 재배달이 거둔다(「안전 종료」 구현 항목). Makeshop · Cafe24 모듈의 `queueEvents.close()` 가 워커 close 뒤 종료를 31초 더 끄는 문제는 이 결정과 별개이고 NERV Task `CLE-T-7H7VET` 가 맡는다.
- **기각: 종료 표시만 앞당기기**: 503 은 바로 나가지만 워커 close 가 진행 중 작업을 한도 없이 기다리는 문제가 남는다. 긴 노드는 여전히 SIGKILL 로 끝나 `SERVER_INTERRUPTED` 표시를 놓친다.
- **기각: 워커 close 대기에만 유예 시간 한도를 걸기**: 표시는 지켜지지만 종료 표시가 여전히 HTTP 서버를 닫은 뒤에 켜져 워커를 기다리는 동안 수동 실행 진입점이 계속 202 를 준다.

### 2단계 문안을 구현에 맞췄다 (2026-11-14, CLE-T-CPZBVH)

2단계는 실행 큐 워커 세 개만 적었다. 구현과 「구현」 항목은 이 인스턴스의 BullMQ 워커를 모두 멈춘다. 그래서 2단계를 이 인스턴스의 워커 전체로 고쳤다. 동작은 바꾸지 않았다. 모든 워커를 멈추는 이유는 위 「종료는 워커 close 보다 먼저 시작한다」에 있다.

pause 가 실패하거나 `DiscoveryService` 가 배선되지 않아도 경고만 남기고 종료를 이어 간다. 종료 훅이 막히면 프로세스가 오케스트레이터의 강제 종료(SIGKILL)까지 남아 결과가 더 나쁘다. pause 가 실패한 워커는 끝난 것으로 세어 4 · 5단계(유예 시간과 강제 close)로 넘어간다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` (안전 종료)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (수동 실행 진입점 두 곳의 `SERVER_SHUTTING_DOWN` 503 거부)
- `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` (`DiscoveryModule` import. 종료 때 멈출 워커를 찾는 데 쓴다)
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.spec.ts` (안전 종료 단위 테스트)
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-lifecycle.spec.ts` (종료 훅 순서 테스트)
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-module-wiring.spec.ts` (`DiscoveryModule` 배선 테스트)
- `codebase/backend/test/execution-shutdown-order.e2e-spec.ts` (종료 순서 e2e)

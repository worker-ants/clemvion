---
id: "CLE-GLOSSARY-EXEC"
title: "용어 사전 — 실행"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "3a4223aeb7e77fee508247b8a80d2561efb978e0611e6a36f88f0e2bc743993f"
read_as: "approved_fallback"
task: "CLE-T-SJAYNM"
source_paths: []
mirror_sha256: "c1eb1eda5255c51ceb4ce43fa96494bccceaabe3da2fe131c31bb6933046ecde"
etag: "sha256-8241b6642c80d5b3d134a99a642d9c1d56ca2094b530995422e75f1a336b2d36"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「실행」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기는 [용어 사전](CLE-GLOSSARY.md) 에 있고, 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

표는 `표준 용어 · 영문과 코드 식별자 · 정의 · 쓰지 않는 표기 · 기준 문서` 순서다. "쓰지 않는 표기" 에 괄호로 붙은 조건은 그 뜻일 때만 쓰지 않는다는 뜻이다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 실행 | Execution, `execution` | 워크플로우가 한 번 도는 단위와 그 기록. 상태·입력·출력·에러를 담는다. | 실행 인스턴스, 실행 레코드, Execution(본문) | [실행 데이터와 흐름](CLE-EXEC/CLE-EXEC-DATA.md) |
| 노드 실행 | NodeExecution, `node_execution` | 한 실행 안에서 노드가 한 번 도는 단위와 그 기록. 반복 회차와 재시도마다 행이 따로 생긴다. | 실행 이력 행, NodeExecution row | [실행 데이터와 흐름](CLE-EXEC/CLE-EXEC-DATA.md) |
| 실행 상태 | `ExecutionStatus` | 실행의 상태 값. 대기 중·실행 중·입력 대기·완료·실패·취소됨 여섯 가지이고, 노드 실행에는 건너뜀이 더 있다. | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 대기 중 | pending, `pending` | 실행 기록은 만들어졌지만 아직 워커가 시작하지 않은 상태. | 실행 대기, 큐 대기(상태 이름으로) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 입력 대기 | waiting for input, `waiting_for_input` | Form·버튼·멀티턴 AI 노드가 사용자 입력을 기다리며 멈춘 상태. | Waiting, Waiting for Input, WFI, 대기(단독) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 취소됨 | cancelled, `cancelled` | 사용자 중지나 시스템 사유로 끝난 상태. 노드 실행이 취소됐으면 실패가 아니라 중단이다. | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| park | park | 입력 대기에 들어가면서 세그먼트를 끝내고 큐 없이 DB 에만 실행을 남기는 동작. 기한 없이 보존한다. | 파킹, durable park(본문) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 세그먼트 | active segment | 워커가 실행을 한 번 이어서 진행하는 구간. 시작이나 재개부터 다음 park 또는 종료까지다. | active 세그먼트, active-running 세그먼트 | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 재개 | resume, continuation | 입력 대기 실행에 사용자 입력이 들어와 다시 진행하는 것. | 재수화(이 뜻으로), 재구동(이 뜻으로) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| rehydration | rehydration, `rehydrateContext` | DB 에 저장한 내용으로 실행 컨텍스트를 되살리는 단일 경로. 재개와 재구동이 함께 쓴다. | 재수화 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 재구동 | re-drive | 서버가 죽을 때 실행 중이던 실행을 다른 워커가 다시 굴리는 것. | 재개(이 뜻으로) | [장애 복구와 안전 종료](CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| 재개 명령 | continuation command | 입력 대기 실행에 보내는 사용자 입력 명령(`submit_form`, `click_button`, `submit_message`, `end_conversation`). | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 재개 큐 | `execution-continuation` | 재개 명령을 워커로 넘기는 영속 BullMQ 큐. | Continuation Bus, continuation-queue | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 시작 큐 | `execution-run` | 실행 시작 요청을 받아 워커에 나누는 큐. 우선순위는 수동 실행, 웹훅, 스케줄 순이다. | intake 큐, execution intake | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 동시 실행 제한 | admission gate, `maxConcurrentExecutions` | 워크스페이스(기본 10)와 워크플로우(기본 3)마다 동시에 돌 수 있는 실행 수의 상한. | admission gate(본문), 동시성 cap | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 큐 대기 한도 | `EXECUTION_QUEUE_WAIT_TIMEOUT` | 동시 실행 제한에 걸린 실행이 5분 넘게 기다리면 취소하는 한도. | 없음 | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 실행 시간 한도 | `EXECUTION_MAX_ACTIVE_RUNNING_MS` | 입력 대기 시간을 뺀 세그먼트 누적 시간의 상한(기본 30분). 넘으면 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 실패한다. | Workflow timeout, Workflow 단위 timeout | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| stalled 재배달 | stalled redelivery | 워커가 죽어 잠금이 풀린 시작 큐 작업을 BullMQ 가 한 번 더 배달하는 동작. | 없음 | [장애 복구와 안전 종료](CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| 부팅 복구 스캔 | `recoverStuckExecutions` | 서버가 뜰 때 오래 멈춘 실행 중 실행을 재구동하고 방치된 대기 중 실행을 취소하는 스캔. | 부팅 backstop, stuck recovery | [장애 복구와 안전 종료](CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| 안전 종료 | graceful shutdown | SIGTERM 을 받으면 새 실행을 거부하고 진행 중 세그먼트를 기다렸다가 끝내는 절차. | Graceful Shutdown(본문) | [장애 복구와 안전 종료](CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| DLQ | dead-letter queue | 재시도를 다 쓴 큐 작업이 쌓이는 곳. 쌓인 양이 임계를 넘으면 경고 로그를 남긴다. | 없음 | [비동기 큐와 Redis 키 목록](CLE-PLAT/CLE-PLAT-QUEUE.md) |
| 실행 중지 | stop execution, `POST /api/executions/:id/stop` | 사용자가 진행 중인 실행을 멈추는 동작. 결과 상태는 취소됨이다. | 실행 중단(버튼 이름으로), 실행 취소(버튼 이름으로) | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 취소 주체 | `result.cancelledBy` | 취소 원인을 나누는 값(`user`, `system`, `timeout`). | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 노드 취소 | node cancellation, `abortSignal` | 실행 중인 노드의 외부 작업을 멈추는 규약. 신호로 알리는 경로와 DB 를 다시 읽어 알아채는 경로가 있다. | abort(본문) | [노드 취소](CLE-EXEC/CLE-EXEC-CANCEL.md) |
| 재실행 | Re-run | 끝난 실행을 바탕으로 새 실행을 만드는 기능. 원본 실행과 재실행 체인으로 묶인다. | Re-run(본문), 리플레이, replay(이 뜻으로), 다시 실행(기능 이름으로) | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| 원본 실행 | `re_run_of` | 재실행이 가리키는 바로 앞 실행. | 없음 | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| 재실행 체인 | re-run chain, `chain_id` | 재실행으로 이어진 실행 묶음. 깊이는 32까지다. | chain(본문) | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| dry-run | dry-run, `dry_run` | 외부 부수효과가 있는 노드를 실제로 부르지 않고 모의 출력으로 대신하는 재실행 모드. | dryRun(본문), 드라이런 | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| 부수효과 노드 | `supportsDryRun` | 외부 시스템 상태를 바꿀 수 있어 dry-run 때 모의 출력으로 바꾸는 노드. | 외부 호출 노드 | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| 마지막 턴 재시도 | `retry_last_turn` | 재시도 가능한 에러로 끝난 멀티턴 AI 노드의 마지막 LLM 호출을 같은 실행 안에서 다시 돌리는 명령. 재실행과 다르다. | 재진입(단독), replay(이 뜻으로) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 전체 실행 | Run | 에디터에서 워크플로우 전체를 실행하는 기본 방식. | 없음 | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 입력과 함께 실행 | Run with Input | 테스트 입력 JSON 을 넣어 실행하는 방식. | Run with Input(본문) | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 선택 노드부터 실행 | run from selected, `input.fromNodeId` | 고른 노드부터 뒤쪽 끝까지만 실행하는 방식. | 부분 실행, 여기서부터 실행, Run from Selected | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 단일 노드 실행 | single node run, `single_node_id` | 대상 노드 하나만 실행하는 디버그 실행. 화면 메뉴 이름은 "이 노드 실행" 이다. | 단일 노드 테스트, 테스트 실행(이 뜻으로) | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 테스트 입력 | Mock Input | 에디터 실행에 넣는 입력 JSON. | Mock Input(본문), Test Input Data | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 테스트 데이터셋 | test dataset, `WorkflowTestDataset` | 이름을 붙여 저장한 테스트 입력. 기본은 나만 보고, 워크스페이스에 공유하면 읽기 전용이다. | 데이터셋(단독) | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 실행 결과 드로어 | Run Results drawer | 에디터 아래쪽에서 노드 타임라인과 결과 상세를 보여 주는 패널. | Run Results 드로어, Run Results Drawer | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 실행 트리 | Run Tree | 실행 결과 드로어 왼쪽의 노드 실행 타임라인. | Run Tree 패널, 좌측 실행 트리 | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 결과 상세 탭 | `ResultDetail` | 노드 결과를 미리보기·입력·출력·응답·요청·LLM 사용량·참조·설정·메타·포트·상태·오류 탭으로 나눠 보여 주는 묶음. 실행 상세 화면도 같은 탭을 쓴다. | 서브 탭, LLM Information 탭 | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 대화 미리보기 | Conversation Preview | 대화 스레드를 출처별 모양으로 그리는 AI 노드 결과 탭. | Preview 탭, conversation Preview, Conversation Inspector | [대화 미리보기](CLE-EXEC/CLE-EXEC-PREVIEW.md) |
| 실행 내역 | Execution History | 워크플로우별 실행 목록 화면과 실행 상세 화면. 에디터 안 패널은 "실행 내역 패널" 이다. | 실행 이력, 실행 히스토리, 실행 기록, Execution History(본문) | [실행 내역](CLE-EXEC/CLE-EXEC-HISTORY.md) |
| 실행 출처 | `triggerSource` | 실행이 어디서 시작됐는지 화면용으로 정리한 값(서브 워크플로우·수동 실행·스케줄·웹훅·알 수 없음). 엔진 내부 마커(`__triggerSource`)나 우선순위용 값(`triggerType`)과 다르다. | 트리거 출처, Trigger 출처 | [실행 내역](CLE-EXEC/CLE-EXEC-HISTORY.md) |
| 노드 실행 순서 로그 | `ExecutionNodeLog` | 노드가 처리된 순서를 쌓는 append-only 테이블. 응답의 `executionPath` 를 채운다. | execution_path(현행 컬럼처럼) | [실행 데이터와 흐름](CLE-EXEC/CLE-EXEC-DATA.md) |
| 실행 컨텍스트 | `ExecutionContext` | 엔진이 핸들러에 넘기는 실행 상태 객체(변수, 노드 출력 캐시, 대화 스레드 등). 세그먼트가 끝나면 사라지고 재개할 때 DB 에서 다시 만든다. | 컨텍스트(단독) | [실행 컨텍스트](CLE-EXEC/CLE-EXEC-CONTEXT.md) |
| 호출 스택 | `resume_call_stack` | 중첩 서브 워크플로우 안에서 park 할 때 저장하는 호출 체인. | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| AI 재개 체크포인트 | `_resumeCheckpoint` | 서버가 다시 시작된 뒤 멀티턴을 이어 가려고 매 턴 DB 에 남기는 상태 일부. | 체크포인트(단독) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 실행 이벤트 | execution events, `execution.*` | 엔진이 내보내는 실시간 이벤트. WebSocket·SSE·EIA 알림 웹훅이 받아 간다. | 없음 | [WebSocket 이벤트와 명령](CLE-API/CLE-API-WS-EVENTS.md) |
| 이벤트 순번 | `seq` | 한 실행 안에서 이벤트마다 1씩 늘어나는 번호. WebSocket·SSE·EIA 알림 웹훅이 같은 값을 쓴다. | seq(본문 단독) | [WebSocket 이벤트와 명령](CLE-API/CLE-API-WS-EVENTS.md) |
| 실행 스냅샷 이벤트 | `execution.snapshot` | 다시 구독할 때 실행 전체 상태를 한 번 보내는 이벤트. | 스냅샷(단독) | [WebSocket 이벤트와 명령](CLE-API/CLE-API-WS-EVENTS.md) |
| 상태 불일치 에러 | invalid execution state | 입력 대기가 아닌 실행에 재개 명령을 보냈을 때의 거부. WebSocket 은 `INVALID_EXECUTION_STATE`, REST 는 `INVALID_STATE`(422), EIA 는 `STATE_MISMATCH`(409)로 같은 뜻이다. | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 엔진 에러 코드 | `EngineErrorCode` | 실행 자체를 끝내는 에러 코드(`EXECUTION_TIME_LIMIT_EXCEEDED`, `SERVER_INTERRUPTED`, `RESUME_*` 등). 노드 에러 코드는 `output.error.code` 로 에러 포트에 실린다. | 엔진 수준 에러(코드 이름으로) | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| 실행 화면 복원 | hydration | 저장된 노드 출력을 실시간·대기·내역 화면에 되살리는 프론트엔드 동작. 엔진의 rehydration 과 다르다. | 하이드레이션 | [실행 화면 복원 규약](CLE-EXEC/CLE-EXEC-HYDRATION.md) |
| WebSocket | WebSocket, Socket.IO, `/ws` | 서버와 화면 사이 실시간 채널. 구현은 Socket.IO 다. | 웹소켓 | [WebSocket 연결과 채널 구독](CLE-API/CLE-API-WS.md) |
| 구독 채널 | subscription channel, `execution:<id>` | WebSocket 이벤트를 받으려고 구독하는 이름(`execution:`, `workflow:`, `kb:`, `notifications:`). | room, 채널(단독) | [WebSocket 연결과 채널 구독](CLE-API/CLE-API-WS.md) |
| SSE | Server-Sent Events | 서버에서 클라이언트로 한 방향으로 흐르는 스트림. AI 어시스턴트 응답과 EIA 이벤트 스트림이 쓴다. 둘은 재연결 규칙이 다르다. | 스트리밍(단독) | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |

## Rationale

2026-10-02 까지 이 표는 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「실행」 절이었다. 그 문서가 약 195KB 가 되어 NERV 초안 저장 한 번에 담기지 않아 영역별 문서로 나눴다. 정의는 옮기기만 했다. 표준을 고른 기준과 검토한 다른 선택은 [용어 사전](CLE-GLOSSARY.md) 의 Rationale 에 있다.

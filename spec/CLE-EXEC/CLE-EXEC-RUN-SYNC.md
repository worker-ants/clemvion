---
id: "CLE-EXEC-RUN-SYNC"
title: "에디터 실행과 디버깅 — 실시간 수신·내역·Background"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-RUN"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-RUN"]
area: "CLE-EXEC"
content_hash: "e01b7a486b4ea9c62c5a7531791e2b3a6557286e53f402acd9eb6cc1297ac371"
read_as: "approved_fallback"
task: "CLE-T-51KBTG"
source_paths: []
mirror_sha256: "9cdc997f8696f6c0ac2349ba8427abe8ff6d3bf77443d22491737de6e35088f6"
etag: "sha256-d802fa8a36e91bd848500d2b3b3d468d9a23e7dcf4ebe33ba25e3761f7f13f84"
---
## 개요

이 문서는 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 의 하위 문서로 에디터가 실행 이벤트로 노드 결과를 모으는 방식과 실시간 경로가 막혔을 때의 REST 폴링 대체 경로, 에디터가 보내는 실행 명령, 에디터 안 실행 내역 패널, 드로어의 재실행 진입점, Background 본문 결과 표시를 정한다. 드로어의 화면 구성은 [에디터 실행과 디버깅 — 실행 결과 드로어](CLE-EXEC-RUN-DRAWER.md) 가 정한다.

## 노드 결과 수집

에디터는 모든 노드 이벤트(`execution.node.started`·`completed`·`failed`·`skipped`·`cancelled`)를 받아 실행 트리에 반영한다. 각 이벤트에 어떤 필드가 실리는지는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 이 정한다. 실시간 경로가 막히면 REST 폴링으로 노드 관계가 포함된 `NodeExecution` 데이터를 받아 맞춘다.

**REST 폴링 대체 경로**: 에디터는 WebSocket 을 기본 경로로 쓰고 REST 폴링은 실시간 경로가 막혔을 때만 켠다. 채널 구독과 `subscribed` 응답 형식은 [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 이 정한다.

| 항목 | 동작 |
| --- | --- |
| 바로 켜는 경우 | 연결이나 구독 요청이 실패할 때, 또는 `subscribed` 의 `success: false` 응답을 받을 때. 실패 응답에는 `channel` 필드가 없어 어느 구독 채널의 실패인지 가릴 수 없다. 그래서 이 실행의 `execution.snapshot` 이나 실행 이벤트가 아직 오지 않은 동안 받은 실패 응답은 이 실행의 실패로 본다. 이미 왔으면 그 응답으로 폴링을 켜지 않는다. 게이트웨이가 `subscribed` 응답 없이 `exception` 으로 끝나는 경우는 10초 경로가 잡는다 |
| 10초 뒤 켜는 경우 | 구독 뒤 10초 안에 이 실행의 `execution.snapshot` 이나 실행 이벤트가 하나도 오지 않을 때 |
| 지연 토스트 | "실시간 업데이트 연결이 지연되고 있어요. 폴링으로 진행됩니다." 는 10초 시점에만 띄운다. 바로 켜는 경우에도 토스트는 10초를 기다린다 |
| 요청 | 켜지면 `GET /api/executions/:id` 를 바로 한 번 받는다. 응답을 받고 2초 뒤에 다음 요청을 예약하므로 요청이 겹치지 않는다 |
| 요청이 실패할 때 | 400·401·403·404 는 다시 보내도 결과가 같으므로 폴링을 멈춘다. 401 은 공용 HTTP 클라이언트가 토큰 갱신을 한 번 시도해 다시 보낸 뒤에도 남은 401 이다. 429·5xx·네트워크 에러는 2초에서 시작해 두 배씩 늘려 30초에서 멈추는 간격으로 다시 받는다. 응답에 `Retry-After`(초)가 있고 브라우저가 읽을 수 있으면 그 값을 2초~60초 범위로 잘라 따른다([미결 사항](CLE-EXEC-RUN.md#미결-사항) 참조). 성공하면 간격을 2초로 되돌린다. 화면 뒤에서 도는 요청이라 실패해도 토스트를 띄우지 않는다. 429 · 404 에 토스트나 404 페이지를 띄우는 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) §4.1 과 다르다(Rationale 「요청 빈도」) |
| store 채우기 | 응답은 실행 스냅샷 이벤트(`execution.snapshot`)와 같은 진입점(`applyExecutionSnapshot`)으로 같은 store 자리에 넣는다. 노드 출력 필드를 복원하는 규칙은 [실행 화면 복원 규약](CLE-EXEC-HYDRATION.md) 을 따른다. 내역 보기 경로(`loadHistoricalExecution`)는 쓰지 않으므로 라이브 대화 상태가 비지 않는다 |
| 멈추는 경우 | 이 실행의 `execution.snapshot` 이나 실행 이벤트가 다시 올 때(WebSocket 복구), 응답 상태가 종결 상태(`completed`·`failed`·`cancelled`, [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md))일 때, store 가 이미 끝난 실행일 때, 위의 회복할 수 없는 에러를 받았을 때. store 는 `cancelled` 를 `failed` 로 담으므로 store 쪽 판정은 `completed`·`failed` 두 값이다. 멈춘 뒤 도착한 응답은 버린다. 응답을 넣기 직전에도 store 의 실행 ID 가 이 실행과 같고 store 가 끝나지 않았는지 확인해 아니면 버린다. 요청을 보낸 뒤 응답이 오기 전에 실행 이벤트나 사용자의 대기 응답으로 store 의 노드 상태·노드 결과·실행 상태가 바뀌었으면 그 응답만 버리고 다음 요청은 그대로 보낸다 |
| 다시 판단하는 경우 | 실행 ID 가 바뀌면 새 실행 기준으로 처음부터 판단한다. 연결이 끊기면 이 실행의 실시간 데이터를 받았다는 표시를 지우고 10초를 다시 잰다 |
| 따라가지 못하는 경우 | 대체 경로 중에 마지막 턴 재시도(`failed → running`, [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md))를 하면 화면은 `failed` 에 머문다. store 를 `running` 으로 돌리는 것은 WebSocket 이벤트뿐이고 구독이 실패한 클라이언트에는 그 이벤트가 오지 않는다. `applyExecutionSnapshot` 도 `failed` 다음의 `running` 응답을 반영하지 않는다. [다시 시도] 버튼은 `nodeExecutionId` 가 있는 `system_error` 에만 보이고 그 값은 실시간 이벤트로 만든 항목에만 있다([대화 미리보기](CLE-EXEC-PREVIEW.md) 의 「[다시 시도] 버튼 조건」). 그래서 이 경우는 WebSocket 으로 `system_error` 를 받은 뒤 대체 경로로 넘어갔을 때만 생기고 처음부터 대체 경로로 받은 실행에서는 버튼이 숨는다. NERV Task `CLE-T-GKVH1B` 가 다룬다 |

현재 구현에서 실행 상세 화면(`executions/[executionId]/page.tsx`)의 상시 폴링과 Background 본문 결과(`use-background-run.ts`)의 폴링은 이 대체 경로와 관계없이 그대로다. 근거는 [Rationale](#rationale) 의 "에디터의 REST 폴링은 실시간 경로가 막혔을 때만 켠다" 항목에 있다.

## 실행 이벤트와 명령

채널 구독·인증·heartbeat·재연결·메시지 형식은 [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md), 이벤트와 명령의 필드·ack·명령별 식별자(예: `retry_last_turn` 은 `nodeExecutionId`)는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 이 정한다. 에디터가 받는 이벤트와 그 반응은 [라이프사이클](CLE-EXEC-RUN-DRAWER.md#라이프사이클) 에 있다. 입력 대기 이벤트의 `interactionType` 값은 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) 가 정한다.

실행 **시작**은 WebSocket 명령이 아니라 REST `POST /api/workflows/:id/execute` 이고 **중지**는 REST `POST /api/executions/:id/stop` 이다. WebSocket 명령은 채널 구독과 입력 대기 상호작용에만 쓴다 (`websocket.gateway.ts` 의 `@SubscribeMessage` 핸들러는 subscribe·unsubscribe·ping 과 아래 상호작용 명령이다).

| 사용자 동작 | 보내는 명령 |
| --- | --- |
| 실행·Background 채널 구독과 해제 | `subscribe`, `unsubscribe` |
| Form 폼 제출 | `execution.submit_form` |
| 버튼 대기 노드의 버튼 클릭 | `execution.click_button`. `buttonId` 는 port 버튼 UUID 또는 `__continue__` |
| 멀티턴 메시지 전송 | `execution.submit_message` |
| 멀티턴 대화 종료 | `execution.end_conversation` |
| `system_error` 의 [다시 시도] | `execution.retry_last_turn` |

## 에디터 안 실행 내역 패널

에디터 더보기(⋮) 메뉴의 "실행 히스토리" 항목을 누르면 모달 형태의 실행 내역 패널이 열린다 (`editor-toolbar.tsx` → `run-results/execution-history-panel.tsx`). 새 백엔드나 엔티티 없이 기존 API 를 다시 쓴다. 목록은 `GET /api/executions/workflow/:id`, 상세는 `GET /api/executions/:id` 다. 페이지네이션·필터·정렬이 필요한 탐색은 [실행 내역](CLE-EXEC-HISTORY.md) 화면이 맡는다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 머리 | 위 | 제목 "Execution History", "전체 실행" 링크, 닫기 `[✕]` | "전체 실행" 은 실행 내역 화면으로 이동한다 |
| 목록 | 가운데 | 최근 실행 20건(시작 시각 내림차순) | 항목을 누르면 아래처럼 그 실행을 불러온다 |

각 항목에는 상태 아이콘, 실행 출처(아이콘과 라벨, [실행 내역](CLE-EXEC-HISTORY.md) 의 실행 출처 분류와 같다), 실행 시간(입력 대기를 뺀 순수 실행 시간, 끝나지 않았거나 측정되지 않았으면 `—`), 노드 카운트(`완료/전체`, 실패가 있으면 `(N failed)`), 상대 시각이 표시된다.

항목을 누르면 다음처럼 동작한다.

- 그 실행의 상세(`GET /api/executions/:id`)를 받아 모든 노드 결과로 실행 결과 드로어를 채운다. 라이브 실행과 같은 store 채우기 경로(`applyExecutionSnapshot`)를 쓴다.
- 캔버스 노드마다 그 실행의 상태 링을 겹쳐 표시한다(`custom-node.tsx` 의 `nodeStatuses`). 라이브 실행 표시와 같다. 노드별 시간과 입출력은 드로어에서 본다.
- "이 입력으로 다시 실행" 은 드로어 머리의 재실행 버튼이 맡는다. 불러온 실행에 대해 그 실행의 입력으로 [재실행](CLE-EXEC-RERUN.md) 모달을 띄운다. 새 버튼은 두지 않는다. 재실행으로 새 실행이 시작되면 드로어는 초기화된다.

**범위 한계 (v1)**: 연결선에 흐른 데이터의 hover 미리보기는 라이브 실행에도 없어 이 패널에서도 뺀다. 노드별 입출력은 드로어 상세 탭에서 본다. 패널은 페이지네이션 없이 최근 20건만 보여 주고 그 이상은 "전체 실행" 링크의 실행 내역 화면이 맡는다.

## 재실행 진입점

실행 결과 드로어 머리 오른쪽에 재실행(Re-run) 버튼이 있다. 워크플로우를 만드는 도중에 직전 실행을 빠르게 다시 돌리는 보조 진입점이다. 실행 상세 화면의 진입점([실행 내역](CLE-EXEC-HISTORY.md))과 같은 모달을 띄운다.

| 요소 | 표시 조건 | 동작 |
| --- | --- | --- |
| `[⟳ Re-run]` 버튼 | 드로어가 끝난 실행을 보여 줄 때. 어느 상태까지 "끝난 실행" 으로 볼지는 정의가 갈린다. [미결 사항](CLE-EXEC-RUN.md#미결-사항) 참조 | 권한이 없으면 숨긴다. 누르면 [재실행](CLE-EXEC-RERUN.md) 모달을 연다 |
| 진행 중 실행 | `running` 이거나 멀티턴 대화가 진행 중일 때 | 버튼을 숨긴다 |
| 새 실행 시작 뒤 | 모달이 새 실행 ID 를 받았을 때 | 드로어를 초기화하고 [라이프사이클](CLE-EXEC-RUN-DRAWER.md#라이프사이클) 의 실행 시작 순서로 들어간다. 실행 상세 화면으로 이동하지 않고 지금 에디터에서 새 실행을 지켜본다 |

진입점이 두 곳이어도 모달·정책·API 의 기준은 [재실행](CLE-EXEC-RERUN.md) 하나다.

## Background 본문 결과

실행 트리에서 Background 노드 카드를 고르면 결과 상세에 본문 서브그래프의 실행 결과가 펼침 섹션으로 표시된다. 데이터는 Background 모니터링 API 로 가져온다. API·채널·권한은 [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 가 정한다.

**카드 표시(실행 트리)**:

- Background 노드는 일반 카드처럼 한 줄로 표시한다. 컨테이너 박스로 그리지 않는다. 격리 계약을 사용자에게 보이는 방식이다.
- 카드 오른쪽에 본문 상태 배지를 단다. 예: `🟢 main`(메인 흐름 완료)과 `⏳ bg: 3/8 running`(본문 진행도). 진행 중에는 스피너를 표시한다.
- 본문이 끝나면 `🟢 main` 과 함께 실패 시 `❌ bg: failed at "Send Email"`(처음 실패한 노드 라벨), 성공 시 `✅ bg: 8 nodes, 12.4s` 를 표시한다.

**결과 상세(Background 노드 선택 시)**:

| 영역 | 들어가는 요소 | 데이터 출처 |
| --- | --- | --- |
| Main 섹션 | 메인 상태·소요 시간(예: `✅ completed (0ms)`), "Input pass-through → 다음 노드로 전달" | Background 노드 자체의 `NodeExecution`(status, durationMs, output) |
| Status·Run ID·Started | 본문 상태와 소요 시간, `backgroundRunId`(복사 버튼), 시작 시각 | 모니터링 API 의 `status`, `backgroundRunId`, `startedAt` |
| Body timeline | 본문 노드 목록(유형·라벨·상태·시간), "Load more (5 of 8)" | `nodeExecutions.data`. 커서 페이지네이션, 기본 50, 더 보기는 `nextCursor` |
| Notifications | 알림 수와 목록(없으면 "No failures") | 모니터링 API 의 `notifications` |

**실시간 갱신**:

- Background 노드 카드가 처음 표시되면 `background:run:<backgroundRunId>` 채널을 자동으로 구독한다.
- 본문 안 개별 노드 이벤트(`execution.node.started`·`completed`·`failed`)는 기존 `execution:<id>` 채널로 받는다. 에디터는 `parentNodeExecutionId === <Background 노드의 NodeExecution.id>` 로 걸러 본문 타임라인을 갱신한다.
- `execution.background_run.completed` 를 받으면 카드 배지를 최종 상태로 바꾸고 `background:run:<id>` 채널 구독을 해제한다. 최종 상태 값은 [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 의 이벤트 정의를 따른다.
- 드로어를 닫거나 다른 실행으로 옮기면 활성 Background 채널을 모두 구독 해제한다.

**페이지네이션**: 본문 노드가 50개를 넘으면 "Load more" 버튼을 표시한다. 누르면 `?cursor=<nextCursor>` 로 다음 페이지를 이어 붙인다. 무한 스크롤이 아니라 명시적 버튼이다. 사용자가 본문 노드 수를 알아차리게 하려는 것이다.

**권한**: Background 카드와 본문 섹션은 메인 실행을 조회할 수 있는 사용자에게 표시한다. 조회 권한은 [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 의 모니터링 API 권한을 따른다.

실행 상세 화면에도 드로어와 같은 모양으로 Background 본문 결과 섹션이 표시된다([실행 내역](CLE-EXEC-HISTORY.md), [컨테이너 실행](CLE-EXEC-CONTAINER.md)).

## Rationale

### 에디터의 REST 폴링은 실시간 경로가 막혔을 때만 켠다 (2026-10-22)

2026-10-22 에 실행 채널 구독이 깨지자 에디터의 실행 결과 드로어가 비었다(NERV Task `CLE-T-A3W8B8`). "폴링으로 진행됩니다" 토스트가 떴지만 상시 폴링은 실행 상세 화면에만 있었고 에디터에는 폴링이 없었다. 이 결정은 NERV Task `CLE-T-KMQ43W` 에서 내렸다.

- **고른 안**: 에디터는 WebSocket 을 기본 경로로 둔다. 구독이 실패하거나 10초 동안 이 실행의 `execution.snapshot` 이나 실행 이벤트가 오지 않을 때만 REST 폴링을 켠다. 구독 실패가 분명하면 폴링은 바로 켜고 토스트는 10초에 띄운다. 만료된 토큰으로 다시 연결하는 경우처럼 금방 회복되는 상황에서 토스트가 깜빡이지 않게 하려는 것이다. 2026-10-22 장애처럼 `subscribed` 응답 없이 `exception` 으로 끝나는 구독은 바로 켜는 조건에 들지 않고 10초 경로가 잡는다.
- **수신 진입점은 하나로 유지한다**: 폴링 응답과 실행 스냅샷 이벤트(`execution.snapshot`)는 `applyExecutionSnapshot` 한 진입점으로 store 를 채운다. 새 표면을 만들지 않으므로 [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 의 2026-07-08 REST 대체 항목 비채택과 부딪치지 않는다. 그 결정이 막은 것은 REST 가 이미 하는 일을 WebSocket 명령으로 한 번 더 만드는 중복 경로다. 옛 REST 응답이 앞선 store 를 덮는 위험은 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 의 "대기 진입 직전 읽기 창" 과 같은 종류라서 꺼진 뒤 도착한 응답과 store 의 실행 ID · 종결 여부가 맞지 않는 응답을 버린다. WebSocket 이 복구된 직후 폴링이 꺼지기 전(렌더 한 번 사이)에 떠 있던 요청의 응답은 실행 ID 와 종결 여부로 가를 수 없어서 요청 뒤 store 가 바뀌었는지로 가려 버린다. 이 응답이 WebSocket 이 채운 노드 결과 행을 실행 중·출력 없음으로 덮으면 WebSocket 이 그 노드를 다시 보내지 않는 한 옛 값으로 남기 때문이다.
- **요청 빈도**: 폴링은 실행 하나에 분당 30건이다. 일반 API 요청 빈도 한도(사용자 기준 100 req/min, [HTTP API 규약](../CLE-API/CLE-API-CONV.md) §7)의 약 30% 다. 실시간 경로가 막혔을 때만 켜지므로 이 비용을 받아들인다. `waiting_for_input` 동안에도 같은 간격으로 받는다. 여러 탭에서 막힌 실행을 동시에 보면 한도에 닿을 수 있어서 실패한 요청은 간격을 늘려 다시 받고 회복할 수 없는 에러에서는 멈춘다. 401 마다 토큰 갱신을 되풀이하거나 429 를 받고도 같은 간격으로 보내 사용자 요청 한도를 스스로 쓰지 않게 하려는 것이다. `Retry-After` 의 날짜 형식은 읽지 않고 늘리는 간격으로 대신한다. 사용자가 일으킨 요청이 아니므로 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) §4.1 의 토스트 · 404 페이지 처리를 따르지 않는다. 폴링 훅이 에러를 직접 처리하므로 [오류 화면과 빈 상태](../CLE-UI/CLE-UI-ERRORS.md) 의 에러 바운더리도 타지 않는다. 실패에 토스트를 띄우지 않는 것은 화면 뒤에서 2초마다 도는 요청이라 실패할 때마다 토스트가 쌓이기 때문이다. `Retry-After` 를 2초~60초로 자르는 것은 잘못된 헤더 값 하나로 폴링이 사실상 멈추지 않게 하려는 것이다.
- **실시간 수신 신호에 실행 이벤트도 센다**: `execution.snapshot` 은 소켓의 첫 구독에서만 한 번 온다([WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) §6.2). 같은 소켓이 이미 구독한 채널을 다시 구독하면 `execution.snapshot` 없이 실행 이벤트만 온다. 그래서 이 실행의 실행 이벤트가 와도 실시간 경로가 살아 있다고 본다.
- **실패 응답으로는 구독 채널을 가리지 않는다**: `subscribed` 실패 응답에는 `channel` 필드가 없다. 같은 소켓의 다른 구독(Background 본문 결과 등)이 실패해도 이 실행의 `execution.snapshot` 이나 실행 이벤트가 오기 전이면 폴링이 켜진다. `execution.snapshot` 이나 실행 이벤트가 오면 바로 꺼지므로 그 비용을 받아들였다. 실패 응답에 `channel` 을 더하는 계약 변경(추가 필드라 옛 클라이언트에는 영향이 없다)은 이 결정에서 하지 않았고 NERV Task `CLE-T-7MBBA7` 에서 정한다.
- **마지막 턴 재시도는 이번에 다루지 않는다**: 대체 경로 중 재시도를 따라가려면 재시도 뒤 폴링을 다시 켜는 신호와 `applyExecutionSnapshot` 의 `failed → running` 분기가 함께 필요하다. `applyExecutionSnapshot` 은 실행 상세 화면의 상시 폴링도 쓰는 진입점이라 그 화면의 동작까지 다시 따져야 한다. 구독 실패와 AI 턴 실패가 겹칠 때만 생기므로 후속 Task `CLE-T-GKVH1B` 로 넘겼다.
- **기각 (a) 에디터도 실행 상세 화면처럼 늘 폴링한다**: WebSocket 으로 받는 동안에도 실행 하나에 2초마다 REST 요청이 더 나간다(분당 30건). WebSocket 으로 이미 앞선 store 를 옛 REST 응답이 덮을 수도 있다. `running` 응답이 이전 `waiting_for_input` 상태와 만나면 `applyExecutionSnapshot` 의 재개 분기가 입력 대기 UI 를 지운다.
- **기각 (b) React Query `refetchInterval` 로 켜고 끈다**: 꺼진 뒤 도착한 응답이 store 에 들어가고, 다시 켤 때 캐시에 남은 옛 응답도 store 에 들어간다. (a) 의 덮어쓰기와 같은 문제가 생긴다. 그래서 effect 안에서 응답을 받은 뒤 다음 요청을 예약하고, 꺼지면 도착한 응답을 버린다.
- **기각 (c) 토스트 문구에서 "폴링으로 진행" 만 지운다**: 문구와 동작은 맞아지지만 구독이 막히면 드로어가 계속 빈다. 2026-10-22 장애(`CLE-T-A3W8B8`)가 바로 그 상황이었다.
- (b) · (c) 는 구현하면서 비교한 안이다.

### 에디터 안 실행 내역 패널은 프런트만으로 만들고 기존 API 를 다시 쓴다 (2026-06-16)

- **새 엔드포인트 없음**: 목록·상세 모두 실행 내역 화면이 이미 쓰는 검증된 API 를 그대로 쓴다.
- **라이브 실행과 같은 store 채우기 경로**: 항목을 누르면 `applyExecutionSnapshot`(WebSocket 스냅샷과 REST 폴링이 함께 쓰는 진입점)을 그대로 불러 드로어와 캔버스 `nodeStatuses` 를 채운다. 내역 전용 렌더 경로를 만들지 않아 라이브와 내역 표시가 저절로 같아진다. 끝난 실행은 `applyExecutionSnapshot` 이 `executionId`·`startedAt` 을 채우지 않으므로 그 직전에 `startHistoryView`(executionId·과거 startedAt 설정과 실행별 상태 초기화)를 부르는 얇은 래퍼 `loadHistoricalExecution` 만 더했다.
- **"이 입력으로 다시 실행" 은 드로어 재실행을 쓴다**: 버튼을 새로 두지 않고 불러온 실행의 `executionId` 를 채워 드로어 재실행 버튼이 그 역할을 하게 했다. 모달·정책·API 의 기준은 [재실행](CLE-EXEC-RERUN.md) 하나다.
- **실행 내역 화면과 중복하지 않는다**: 패널은 최근 20건만 보여 주는 에디터 안 진입점이고 깊은 탐색은 [실행 내역](CLE-EXEC-HISTORY.md) 화면에 넘긴다. 연결선 데이터 미리보기는 라이브 실행에도 없어 v1 에서 뺐다.

### 드로어의 재실행 버튼은 권한이 없으면 숨긴다

실행 상세 화면은 권한이 없을 때 버튼을 비활성화하고 툴팁을 단다. 드로어는 워크플로우를 만드는 도중의 화면이라 쓸 수 없는 버튼이 소음이 된다. 그래서 드로어에서는 숨긴다. 두 화면의 차이는 의도한 것이다.

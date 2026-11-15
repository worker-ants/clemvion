---
id: "CLE-EXEC-RUN-START"
title: "에디터 실행과 디버깅 — 실행 시작·중지와 캔버스 표시"
type: "design"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-RUN"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-RUN"]
area: "CLE-EXEC"
content_hash: "3ec36e1f17fcf8b28476ef263b03af943ae91574bd2f5d12885a3ee7d3c6096f"
read_as: "approved_fallback"
task: "CLE-T-VXPW7G"
source_paths: []
mirror_sha256: "6d792cc89fbecba462409f76f0df11d857cd9d9e9651ae582840fb7ccf7999da"
etag: "sha256-c319bd2b1f4114ffe25c38dc8b25f3ace3c989dda344d7edf207922b958c5b19"
---
## 개요

이 문서는 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 의 하위 문서로 에디터에서 실행을 시작하는 세 가지 방식(전체 실행·선택 노드부터 실행·단일 노드 실행), 테스트 입력과 테스트 데이터셋, 캔버스의 실행 표시, 실행 중지, 노드 결과 조회, 이 기능들의 API, 미구현 로드맵인 브레이크포인트를 정한다. 실행 결과 드로어는 [에디터 실행과 디버깅 — 실행 결과 드로어](CLE-EXEC-RUN-DRAWER.md), 실시간 수신과 REST 폴링 대체 경로는 [에디터 실행과 디버깅 — 실시간 수신·내역·Background](CLE-EXEC-RUN-SYNC.md) 가 정한다.

## 실행 방식

에디터에는 실행 방식이 세 가지 있다. 셋 모두 실행(`Execution`) 한 건을 새로 만들고 결과는 같은 실행 결과 드로어에 표시된다.

### 전체 실행

| 항목 | 설명 |
| --- | --- |
| 시작 | 툴바의 실행(Run) 버튼. Ctrl+Enter 단축키는 정의가 갈린다. [미결 사항](CLE-EXEC-RUN.md#미결-사항) 참조 |
| 시작점 | 워크플로우의 루트 노드(들어오는 연결선이 없는 노드) |
| 입력 데이터 | 테스트 입력 또는 빈 입력 |
| 종료 | 모든 리프 노드 실행이 끝나거나 에러가 나면 끝난다 |

### 선택 노드부터 실행

| 항목 | 설명 |
| --- | --- |
| 시작 | 노드를 고른 뒤 툴바 실행 드롭다운의 "선택된 노드부터 실행"(Run from Selected). 노드를 고르지 않으면 비활성 |
| 시작점 | 고른 노드 |
| 입력 데이터 | `POST /api/workflows/:id/execute` 본문의 `input.fromNodeId` 로 시작 노드를 넘긴다. 부분 실행 전용 엔드포인트는 없다 |
| 범위 | 고른 노드부터 하류(downstream) 끝까지 |

진입점은 툴바 드롭다운 하나다. 노드 우클릭 메뉴에는 이 항목이 없다.

### 단일 노드 실행

| 항목 | 설명 |
| --- | --- |
| 시작 | 노드 우클릭 메뉴의 "이 노드 실행" (`workflow-canvas.tsx` 컨텍스트 메뉴) |
| 엔드포인트 | `POST /api/workflows/:id/nodes/:nodeId/execute` ([API](#api)) |
| 범위 | 그 노드만 실행한다. 하류로 진행하지 않는다. 선택 노드부터 실행과 다르다 |
| 입력 데이터 | 직전 실행(`previousExecutionId`)의 직속 상류(predecessor) 노드 출력을 자동으로 넣는다. 엔진이 노드 출력 캐시(`nodeOutputCache`)에 미리 채워 두므로 정상 실행과 같은 방식으로 입력이 재구성된다. `previousExecutionId` 가 없으면 요청 본문 `input` 을 수동 입력으로 쓴다 |
| 출력 | 새 실행으로 기록한다. 설정 패널 Info 탭에 결과(출력·오류·소요 시간)가 표시되고 드로어 실행 트리에는 대상 노드만 나온다. `GET /api/executions/:id` 로도 조회할 수 있다 |

**동작 방식**: 엔진(`runExecution`)은 `single_node_id` 가 채워진 실행에서 대상 노드만 도달 가능 노드로 등록하고 하류 전파(`propagateReachability`)·컨테이너 본문·Parallel 분기·되돌아가는 연결선 재진입을 하지 않는다. `previous_execution_id` 의 직속 상류 출력은 `nodeOutputCache`·`structuredOutputCache` 에 복원되므로 `$node['predecessor']` 표현식과 입력 게이트가 정상 실행과 똑같이 동작한다.

**범위 한계 (v1)**: 대상은 최상위(top-level) 비블로킹 노드다(표준·AI·코드·HTTP 등). 다음은 채워 주는 범위 밖이다.

- 블로킹 대화형 노드(form·buttons·AI 멀티턴)의 park
- 컨테이너 안 노드
- 직속 상류가 아닌 노드를 가리키는 `$node[...]` 와 트리거 컨텍스트

비활성(disabled) 노드를 대상으로 하면 일반 실행과 같이 건너뛰고 빈 결과로 완료된다. 근거는 [Rationale](#rationale) 의 "단일 노드 실행" 항목에 있다.

## 테스트 입력과 테스트 데이터셋

### 입력과 함께 실행 대화상자

툴바의 "입력과 함께 실행"(Run with Input)을 고르면 테스트 입력 대화상자가 열린다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 머리 | 위 | 제목, "히스토리에서 불러오기"(Load from History) 버튼 | 누르면 이전 실행 목록(`GET /api/executions/workflow/:id`)이 펼쳐진다. 고른 실행의 `inputData` 가 입력란에 채워진다 |
| 입력란 | 가운데 | JSON textarea | 테스트 입력을 JSON 으로 직접 편집한다. 입력할 때마다 JSON 유효성을 검사하고 무효면 빨간 인라인 오류를 표시한다 (`editor-toolbar.tsx`) |
| 데이터셋 | 입력란 옆 | "데이터셋으로 저장"(이름 + 워크스페이스 공유 선택), "데이터셋" 목록(불러오기·복제·삭제) | 자주 쓰는 테스트 입력을 이름 붙여 저장하고 다시 쓴다(`WorkflowTestDataset`, V097). [테스트 데이터셋](#테스트-데이터셋) 참조 |
| 버튼 | 아래 | 취소, 실행 | JSON 이 무효하거나 마스킹 마커가 남아 있으면 실행이 비활성 |

JSON 편집·실시간 검증·히스토리 불러오기·데이터셋 저장 기능은 모두 구현됐다.

### 마스킹 마커 차단

마스킹 마커 세 문자열(`***`, `[REDACTED]`, `[REDACTED_DEPTH]`)은 값 자리에서 예약어다. 히스토리에서 왔든 직접 입력했든 에디터가 실행을 막고 서버도 `400` 과 `details[].code = MASKED_VALUE_RESUBMITTED` 로 거부한다. 정확히 일치하는 값만 보므로 `a***b` 처럼 다른 문자와 섞이면 통과한다.

- **히스토리에서 불러온 입력**: 실행의 `inputData` 는 응답 마스킹을 거쳐 내려온다. 그래서 자격 증명 자리에 마커가 실려 온다. 그대로 실행하면 마커가 새 실행의 실제 입력이 되므로 입력에 마커가 남아 있는 동안 실행 버튼이 비활성이다. 마커를 실제 값으로 바꾸면 풀린다. 표시는 실시간 검증과 같은 인라인 오류 자리를 쓴다 (`editor-toolbar.tsx`).
- **서버 2층 차단**: 에디터의 차단은 화면 경로에만 있어 API 를 직접 부르면 우회된다. 그래서 서버가 같은 값을 한 번 더 거부한다. 에디터 차단은 어느 필드가 문제인지 그 자리에서 보여 주는 안내로 남는다.

마스킹 범위와 근거는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다. 재실행 모달의 같은 차단은 [재실행](CLE-EXEC-RERUN.md) 에 있다.

### 테스트 데이터셋

테스트 데이터셋은 워크플로우에 딸린 이름 있는 테스트 입력이다. 엔티티 컬럼은 [실행 데이터와 흐름](CLE-EXEC-DATA.md) 이 정한다.

| 규칙 | 설명 |
| --- | --- |
| 기본 공개 범위 | `private`. 소유자만 조회·수정·삭제한다 |
| 워크스페이스 공유 | 소유자가 `workspace` 로 올리면 같은 워크스페이스 멤버가 불러오기만 할 수 있다(읽기 전용) |
| 복제 | 다른 멤버는 공유본을 복제(clone)해 자기 소유 `private` 사본을 만든 뒤 고친다. 원본은 소유자만 바꾼다 |
| 이름 중복 | `(workflow_id, owner_id, name)` 이 UNIQUE 다. 같은 이름으로 저장하거나 복제하면 409 `DUPLICATE_NAME` |
| 워크스페이스 격리 | `workspace_id` 를 비정규화해 저장한다. 공유 목록 조회와 격리에 쓴다 |
| 권한 | 목록·저장·수정·삭제·복제 모두 편집자 이상 |

## 캔버스 실행 표시

### 실행 상태 바

실행이 시작되면 에디터 위쪽에 실행 상태 바가 나타나고 모든 노드가 대기 표시로 초기화된다.

| 상태 | 상태 바 표시 | 캔버스 표시 |
| --- | --- | --- |
| 실행 중 | `▶ Running...  0.5s elapsed  [■ Stop]` | 실행 중 노드는 파란 테두리 펄스. 완료 노드는 아래에 초록 체크와 실행 시간. 연결선에는 점이 움직이는 데이터 흐름 애니메이션 |
| 완료 | `✅ Completed  2.3s  10/10 nodes  [Details]` | 실행된 경로만 강조 |
| Form·버튼 입력 대기 | `⏸ Waiting for input  "Approval Form"  [Results ↑] [■]` | 대기 노드에 입력 대기 아이콘(⏸)과 분홍 테두리 펄스 |
| 멀티턴 대화 | `💬 Conversing  "CS Bot"  Turn 2/20  [Results ↑] [■]` | AI 에이전트 노드에 💬 아이콘과 초록 테두리 펄스 |
| 실패 | `❌ Failed at "Node C"  1.2s  5/10 nodes` 와 `Error: Connection timeout  [Details]` | 실패 노드를 빨간색으로 강조. 누르면 에러 상세 |

### 실행 경로 표시

- 실행된 노드와 연결선을 강조하고 실행되지 않은 노드와 연결선은 흐리게 표시한다.
- If/Else·Switch 처럼 분기하는 노드는 어느 분기를 탔는지 분명히 보인다.
- Presentation 노드가 끝나면 노드 오른쪽 아래에 👁 배지가 붙는다. 누르면 드로어에서 그 노드로 이동한다.

### 입력 대기 중 동작

Form 노드가 입력을 기다리면 다음처럼 동작한다.

1. 실행 결과 드로어가 자동으로 펼쳐지고 그 노드의 미리보기 탭이 선택된다.
2. 미리보기 탭에 실제 폼 UI 가 렌더되고 사용자가 제출할 수 있다.
3. 제출하면 실행이 자동으로 재개된다. 미리보기 탭은 제출 결과 표시로 바뀌고 상태 바는 "▶ Running..." 으로 돌아간다.

AI 에이전트 노드가 멀티턴으로 입력을 기다리면 다음처럼 동작한다.

1. 드로어가 자동으로 펼쳐지고 그 AI 에이전트 노드가 선택된다.
2. 실행 트리에 대화 메시지(사용자 메시지·AI 응답·도구 호출)가 미리보기 카드로 표시된다.
3. 결과 상세 아래쪽에 메시지 입력 UI(textarea, 보내기, 종료 버튼)가 나온다.
4. 사용자 메시지를 보내면 실행 트리에 즉시 추가되고(optimistic), AI 응답을 기다리는 동안 입력이 비활성이다.
5. AI 응답이 오면 실행 트리에 추가되고 입력이 다시 활성화된다.
6. 종료를 누르면 대화가 끝나고 실행이 재개된다. 상태 바는 "▶ Running..." 으로 바뀐다.

버튼이 설정된 Presentation 노드(Carousel·Table·Chart·Template)도 입력 대기로 멈춘다. 이때도 드로어가 펼쳐지고 그 노드가 선택되며 미리보기 탭에 렌더된 콘텐츠와 버튼 바가 표시된다. port 버튼을 누르면 그 포트로 실행이 재개된다. 버튼별 동작은 [라이프사이클](CLE-EXEC-RUN-DRAWER.md#라이프사이클) 의 버튼 행을 따른다.

실시간 연결이 막혀 REST 폴링 대체 경로로 받는 동안에도 입력 대기 UI 는 같다. AI 대화 타임라인은 폴링 응답의 저장된 대화로 갱신한다([노드 결과 수집](CLE-EXEC-RUN-SYNC.md#노드-결과-수집) 의 「입력 대기」). 소켓 연결이 끊겨 있으면 폼 제출만 REST 로 보내고, 버튼·멀티턴 메시지·대화 종료·[다시 시도] 는 보내지 않고 안내한다([실행 이벤트와 명령](CLE-EXEC-RUN-SYNC.md#실행-이벤트와-명령) 의 「소켓이 끊겼을 때」).

## 실행 중지

| 항목 | 설명 |
| --- | --- |
| 버튼 | 실행 상태 바의 중지 버튼 |
| 동작 | 현재 실행 중인 노드가 끝난 뒤 멈춘다 (graceful) |
| 강제 중단 | 중지 버튼을 3초 이상 누르면 즉시 중단한다(Force). 정의가 갈린다. [미결 사항](CLE-EXEC-RUN.md#미결-사항) 참조 |
| 결과 상태 | 실행 상태 `cancelled` |
| 권한 | 편집자 이상. 뷰어에게는 중지 버튼이 보이지 않고(프런트 `canEdit` 가드), 서버도 `@Roles('editor')` 로 403 을 낸다. 근거는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 권한 매트릭스의 "Workflow 실행" 행(소유자·관리자·편집자 허용, 뷰어 불가)이다 |

중지는 REST `POST /api/executions/:id/stop` 으로 보낸다. 진행 중인 노드가 중지를 언제 알아채는지는 [노드 취소](CLE-EXEC-CANCEL.md) 가 정한다.

## 노드 결과 조회

캔버스에서 노드를 누르면 설정 패널 아래쪽(또는 Info 탭)에 마지막 실행 결과가 표시된다.

| 영역 | 들어가는 요소 |
| --- | --- |
| 머리 | "Last Execution", 상태와 소요 시간(예: `✅ Completed (0.12s)`) |
| 입력 | 접을 수 있는 Input JSON |
| 출력 | 접을 수 있는 Output JSON |
| 버튼 | Copy Input, Copy Output |

Presentation 노드 결과는 실행 결과 드로어와 설정 패널 Info 탭 양쪽에 렌더된 모양으로 표시된다. 렌더 방식은 [Presentation 노드 콘텐츠](CLE-EXEC-RUN-DRAWER.md#presentation-노드-콘텐츠) 를 따른다. 실행 중이거나 끝난 뒤 Presentation 노드 결과를 보는 주 경로는 실행 결과 드로어다.

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/workflows/:id/execute` | 워크플로우 실행. 선택 노드부터 실행은 본문 `input.fromNodeId` 로 시작 노드를 정한다. 단일 노드 실행은 아래 전용 경로를 쓴다. 서버가 종료 중이면 503 `SERVER_SHUTTING_DOWN` 이고 `Retry-After` 헤더(초)를 싣는다([안전 종료](CLE-EXEC-RECOVERY-SHUTDOWN.md#안전-종료)) |
| POST | `/api/workflows/:id/nodes/:nodeId/execute` | 단일 노드 실행. 대상 노드만 실행하고 하류로 진행하지 않는다. 본문 `{ previousExecutionId?, input? }`. `previousExecutionId` 는 상류 출력을 가져올 실행, `input` 은 수동 입력이다. 대상 노드가 워크플로우에 없거나 `previousExecutionId` 가 다른 워크플로우의 실행이면 400. 서버가 종료 중이면 503 `SERVER_SHUTTING_DOWN` 이고 `Retry-After` 헤더(초)를 싣는다([안전 종료](CLE-EXEC-RECOVERY-SHUTDOWN.md#안전-종료)). 결과는 `GET /api/executions/:id`. 편집자 이상 |
| POST | `/api/executions/:id/continue` | 입력 대기(`waiting_for_input`) 실행을 폼 데이터로 이어 간다. 본문 `{ formData? }`. `/continue` 는 폼 제출 전용이다. 실행이 입력 대기가 아니거나 대기 노드가 Form 표면이 아니면 422 `INVALID_STATE` (보내는 쪽 사전 검증, [큐 워커 — 재개 큐와 사전 검증](CLE-EXEC-WORKER-RESUME.md#발행-전-사전-검증) 의 대기 표면 검사). 폼 필드 검증에 실패하면 400 `VALIDATION_ERROR` 이고 입력 대기는 그대로라 다시 보낼 수 있다. 성공 응답은 접수만 뜻한다. 에디터가 이 경로를 쓰는 경우와 실패 문구는 [실행 이벤트와 명령](CLE-EXEC-RUN-SYNC.md#실행-이벤트와-명령) 의 「소켓이 끊겼을 때」 가 정한다 |
| POST | `/api/executions/:id/stop` | 실행 중지. 편집자 이상 |
| GET | `/api/workflows/:workflowId/test-datasets` | 데이터셋 목록(내 것과 워크스페이스 공유본, 최근 갱신순). 항목에 `isOwner` 포함. 편집자 이상 |
| POST | `/api/workflows/:workflowId/test-datasets` | 데이터셋 저장. 본문 `{ name, input, visibility? }`(`input` 은 테스트 입력 JSON, `visibility` 기본 `private`). 같은 이름이면 409 `DUPLICATE_NAME`. 편집자 이상 |
| PATCH | `/api/test-datasets/:id` | 데이터셋 수정. 소유자만, 아니면 403. 본문 `{ name?, input?, visibility? }`. 편집자 이상 |
| DELETE | `/api/test-datasets/:id` | 데이터셋 삭제. 소유자만. 편집자 이상 |
| POST | `/api/test-datasets/:id/clone` | 조회할 수 있는 데이터셋(내 것·워크스페이스 공유본)을 자기 소유 `private` 사본으로 복제. 같은 이름 사본이 있으면 409 `DUPLICATE_NAME`. 편집자 이상 |

실행 목록(`GET /api/executions/workflow/:workflowId`)과 실행 상세(`GET /api/executions/:id`)는 [실행 내역](CLE-EXEC-HISTORY.md), 버전 목록과 복원은 [버전 기록](../CLE-WF/CLE-WF-VERSION.md) 이 정한다.

## 브레이크포인트 (미구현 로드맵)

> 상태: 미구현. 프런트·백엔드·실행 엔진 어디에도 구현돼 있지 않다. `execution.continue`·`execution.step` 명령, `execution.paused` 이벤트, `execution.start.breakpoints`, 브레이크포인트 설정 UI 가 모두 없다. 다시 도입할 때까지 설계 참고용으로만 둔다([Rationale](#rationale)). 지금의 입력 대기(`waiting_for_input`, Form·버튼이 설정된 Presentation 노드·AI 멀티턴) 멈춤과는 관계가 없다.

**설정**: 노드 왼쪽을 누르거나 우클릭 메뉴의 "브레이크포인트 설정" 으로 건다. 브레이크포인트가 있는 노드에는 빨간 점(●)이 붙는다.

| 동작 | 설명 |
| --- | --- |
| 일시 정지 | 브레이크포인트 노드 실행 직전에 멈춘다 |
| 상태 바 | "⏸ Paused at Node C" 와 [Continue] [Step Over] [Stop] 버튼 |
| Continue | 다음 브레이크포인트나 완료까지 실행한다 |
| Step Over | 현재 노드만 실행하고 다시 멈춘다 |
| 데이터 확인 | 멈춘 상태에서 현재 노드의 입력 데이터를 확인한다 |

계획된 실시간 표면은 `execution.paused` 이벤트(브레이크포인트 도달)와 `execution.continue`(다음 브레이크포인트까지 계속)·`execution.step`(한 노드만 실행) 명령이다.

## Rationale

### 단일 노드 실행은 전용 진입점과 상류 출력 복원으로 만든다 (2026-06-15)

- **전용 엔드포인트**: 선택 노드부터 실행은 `execute` 본문 `input.fromNodeId` 로 "노드부터 하류 끝까지" 를 실행한다. 단일 노드는 범위가 분명히 달라서(하류 미진행) 본문 플래그로 나누면 두 방식이 헷갈린다. 그래서 진입점을 따로 두었다. 경로는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 자원 액션 패턴(`/execute`·`/stop` 선례)을 따라 노드 하위 자원의 `execute` 액션으로 지었다. 그 패턴이 정하는 것은 동사의 개수가 아니라 목적어의 위치다. 목적어(노드)는 경로에 두고 액션 이름에 넣지 않는다(`execute-node` 를 피함).
- **입력은 직전 실행의 상류 출력을 자동으로 넣는다**: 단일 노드를 의미 있게 테스트하려면 상류 입력이 필요하다. 직속 상류 `NodeExecution.output_data` 를 캐시에 복원하면 `gatherNodeInput` 과 표현식 해석기가 정상 실행과 같은 경로로 입력을 만들어 별도 입력 격리 로직이 필요 없다. `previousExecutionId` 를 지정하지 않으면 본문 `input` 으로 대신해 "입력을 직접 준 단발 테스트" 도 지원한다.
- **하류로 진행하지 않는다**: 대상 노드 실행 직후 루프를 끝내 선택 노드부터 실행과의 구분을 엔진 수준에서 보장한다.
- **호출 기록 엔티티를 따로 두지 않는다**: 단일 노드 실행도 일반 실행으로 기록해 기존 실행 이벤트·드로어·`GET /api/executions/:id` 를 그대로 쓴다. nullable 컬럼 `single_node_id`·`previous_execution_id` 두 개만 더했다(`dry_run`·`re_run_of` 처럼 실행 방식을 컬럼에 담은 선례).
- **범위 한계**: 블로킹 대화형 노드의 park, 컨테이너 안 노드, 인접하지 않은 컨텍스트는 디버그 도구 v1 범위 밖으로 두었다. [재실행](CLE-EXEC-RERUN.md) 향후 확장의 C3(single-node debug) 중 "표현식 컨텍스트 mock" 을 직속 상류 출력 복원으로만 채운다. 전체 mock 은 아니다.

### 테스트 데이터셋은 사용자 소유, 워크스페이스 읽기 전용 공유, 복제 모델로 둔다 (2026-06-14)

- **기본은 사용자 소유(`private`)**: 테스트 입력은 개인 디버깅 자료다. 작성자 전용이 기본이어야 사생활과 목록 소음 면에서 자연스럽다. 워크스페이스 공유를 기본으로 하면 다른 사람의 임시 데이터셋이 목록을 어지럽힌다.
- **워크스페이스 공유는 읽기 전용**: 공유본을 여러 사람이 직접 고치면 "누구의 테스트인가" 가 흐려지고 동시 수정 충돌이 생긴다.
- **다른 멤버는 복제해서 고친다**: 공유본을 바꾸려면 복제해 자기 소유 사본을 만든다. 원본은 소유자만 바꿔 출처가 분명하고 충돌이 없다. 워크플로우 복제와 같은 "복제 후 자기 소유" 패턴이다.
- **워크플로우에 딸리고 `(workflow_id, owner_id, name)` 이 UNIQUE**: 데이터셋은 특정 워크플로우의 입력이다. 한 사용자가 같은 워크플로우에 같은 이름을 두 번 저장하면 409 다. `workspace_id` 는 격리와 공유 목록 조회를 위해 비정규화해 저장한다.
- **모든 작업이 편집자 이상**: 테스트 입력 자체가 에디터(편집자 이상) 기능이라 데이터셋 CRUD 와 복제도 편집자 이상으로 맞췄다.
- 이 결정은 "사용자 소유 + 워크스페이스 읽기 전용 공유 + 복제" 권한 모델의 코드베이스 첫 사례다.

### 브레이크포인트는 v1 에서 빼고 로드맵으로 둔다

브레이크포인트와 단계 실행은 2026-05-31 확인 때 어디에도 구현돼 있지 않았다. 실행 엔진이 임의 노드 경계에서 멈추고 재개하는 새 능력이 필요한 큰 작업이라 v1 범위에서 뺐다.

- **근거**: 약속한 표면이 하나도 없는데 구현됨으로 두면 거짓 약속이 되고 맡은 계획도 없어 영원히 부분 구현 부채로 남는다. 설계는 이 문서에 남기되 미구현임을 밝혀 문서 전체의 구현 상태와 맞춘다. 나머지 기능은 모두 구현됐다.
- **함께 정리한 곳**: WebSocket 이벤트·명령의 브레이크포인트 행, 옛 에디터 PRD 의 ED-DB-05, 사용자 가이드의 브레이크포인트 안내를 모두 미구현 표기로 맞췄다(가이드 안내는 삭제).
- **다시 도입하는 길**: 우선순위가 올라가면 별도 계획과 스펙 개정으로 정식 기능으로 올리고 위 표기를 되돌린다.

---
id: "CLE-EXEC-DATA-MODEL"
title: "실행 데이터와 흐름 — 데이터 모델"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-DATA"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-DATA"]
area: "CLE-EXEC"
content_hash: "e1619d8ee0e90b1eb0b7b6a0909d771ed3f6c88f79bc3849cc543c6d07f0c1d3"
read_as: "approved_fallback"
task: "CLE-T-51KBTG"
source_paths: []
mirror_sha256: "e2d108020e16fc9cfd4410eb38c7b00540bddf6e434f6551ea2fb8745723de8f"
etag: "sha256-5c0a89336aa16a2bdffd4c1e45c72bab5c8e6cf87083d0f210a38fcd2b7d8a36"
---
## 개요

이 문서는 [실행 데이터와 흐름](CLE-EXEC-DATA.md) 의 하위 문서로 실행 데이터 엔티티 넷(실행 · 노드 실행 · 노드 실행 순서 로그 · 테스트 데이터셋)의 필드, 행 생성 규칙, 에러 기록 규칙을 정한다. 이 데이터가 어느 흐름에서 어떤 저장소에 쓰이는지는 [실행 데이터와 흐름 — 흐름과 저장소 매핑](CLE-EXEC-DATA-FLOW.md) 에, 삭제 연쇄와 종결 코드는 부모 문서에 있다.

## 실행

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow (CASCADE). 워크플로우를 지우면 실행도 지워진다. |
| trigger_id | UUID? | FK → Trigger (SET NULL). 트리거로 시작한 실행 |
| status | Enum | pending / running / completed / failed / cancelled / waiting_for_input. 전이 규칙은 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) |
| queued_at | Timestamp? | 시작 큐 대기에 들어간 시각(`execute()` 가 `pending` 행을 INSERT 한 시점). 큐 대기 한도(`now - queued_at` 가 5분 초과) 판정 기준이다. `started_at`(`running` 전이 시각)과 별개다. 마이그레이션 V104. 규칙은 [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) |
| started_at | Timestamp | 실행 시작 시각. 부팅 복구 스캔의 stale 판정과 re-claim 에도 쓴다([장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md)). |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 실행 소요 시간(wall-clock, 시작부터 종료까지). **취소·타임아웃으로 끝난 경로에서는 실행 시간이 아니라 대기 경과 시간**이다. 기준은 [External Interaction API](../CLE-IX/CLE-EIA.md) §6.5 다. 컬럼이 `INTEGER`(int4, 약 24.8일)라 쓰는 쪽은 상한을 반드시 잘라야 한다. 화면과 API 에서는 「전체 경과」(`durationMs`)로 보인다. |
| active_running_ms | Integer | 세그먼트 누적 시간(ms). 워커가 노드를 전진시킨 구간의 합이며 입력 대기 park 시간은 뺀다. 기본 0. 실행 시간 한도(`EXECUTION_TIME_LIMIT_EXCEEDED`)의 측정 기준이다(V083). 화면과 API 에서는 「실행 시간」(`activeRunningMs`)으로 보인다. 응답 값과 `null` 규칙은 [실행 내역](CLE-EXEC-HISTORY.md) 의 API 절이 정한다. 실행이 끝나기 전에는 끝난 구간만 더해져 있다. V083 이전 실행은 0 이고 백필하지 않는다. 실행 중(`running`)에 REST 중지로 끝나면 마지막 구간이 빠진다(후속 작업 CLE-T-ES1J1E). |
| input_data | JSONB? | 실행 입력. **응답·발행 때 자격 증명 값 패턴을 가린다**(DB 는 원문 보존). 자매 `NodeExecution.input_data` 와 같은 규칙이다. 범위는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다. 서버도 2층으로 거부한다. 수동 실행 경로(저작 주체 기준, 재제출뿐 아니라 직접 입력도 포함)에서 값 leaf 가 마스킹 마커와 정확히 같으면 `400` `details[].code = MASKED_VALUE_RESUBMITTED` 로 거부한다(UI 를 거치지 않은 API 직접 호출 대비). 프론트엔드 마커 가드(프리필 건너뜀, 제출 차단)는 [재실행](CLE-EXEC-RERUN.md) 과 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 에 있다. |
| output_data | JSONB? | 실행 최종 출력. 응답·발행 때 자격 증명 값 패턴을 가린다(DB 는 원문 보존). 범위는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) |
| error | JSONB? | 에러 정보. 최초 `failed` 노드 실행의 에러를 복사하거나 엔진이 직접 쓴다. [실행 에러와 노드 실행 에러](#실행-에러와-노드-실행-에러) 참조 |
| executed_by | UUID? | FK → User (NO ACTION). 수동 실행 때 |
| parent_execution_id | UUID? | FK → Execution (SET NULL). 서브 워크플로우 실행의 부모 실행 |
| recursion_depth | Integer | 서브 워크플로우 호출 깊이(root = 0) |
| re_run_of | UUID? | FK → Execution (SET NULL). 재실행의 바로 앞 실행(원본 실행). NULL 이면 이 실행이 재실행 체인의 시작이다. 정책은 [재실행](CLE-EXEC-RERUN.md) |
| chain_id | UUID? | NULL 허용(V067). v1 은 NULL 허용이 정식 모델이다. 같은 재실행 체인(re-run chain)의 실행을 모두 묶는 식별자다. 일반 실행(원본, 서브 워크플로우, Background)은 `chain_id = NULL` 이다. 재실행으로 만든 실행만 `chain_id = <체인 root id>`(= 원본 실행 id)다. 체인 전체 조회는 `id = rootId OR chain_id = rootId` 다. 체인 깊이 32 제한은 애플리케이션이 지킨다. 초기 설계(NOT NULL, 자기 참조)에서 NULL 허용으로 바꾼 근거는 [재실행](CLE-EXEC-RERUN.md#chain_id-는-nullable-이다-2026-05-31-결정-f2) 과 `migrations/V067__execution_re_run_chain.sql` 헤더에 있다. |
| dry_run | Boolean | `NOT NULL DEFAULT false`(V068). dry-run 재실행(RR-PL-01)으로 만든 실행만 true 다. 엔진이 `createContext` 때 `variables.__dryRun` 으로 넣어 부수효과 노드가 모의 출력을 돌려주게 한다. rehydration 때도 되살린다. 기준은 [재실행](CLE-EXEC-RERUN.md) |
| conversation_thread | JSONB? | NULL 허용(V084). 입력 대기 park 에 들어갈 때 대화 스레드(`ExecutionContext.conversationThread`) 전체 스냅샷을 커밋하는 영속 재개 매체다. rehydration 이 여기서 대화 스레드를 손실 없이 되살린다(`runningSummary` / `summarizedUpToSeq` 포함). park 밖 단계에서는 낡을 수 있다(마지막 park 때 쓴 값). 실행 내역 타임라인의 분산 기준(`NodeExecution.output_data` / `interaction_data`)과 목적·소비처가 다르다. 정책은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) |
| user_variables | JSONB? | NULL 허용(V085). park 에 들어갈 때 실행 컨텍스트 변수 중 **시스템 예약 변수(`__*`)를 뺀 사용자 정의분**(변수 선언 노드·변수 수정 노드 값)을 커밋하는 영속 재개 매체다. rehydration 이 되살려 park 뒤 노드가 park 전 변수를 손실 없이 참조한다(`$var.X`). 시스템 `__*` 변수는 rehydration 이 따로 다시 넣으므로 담지 않는다. park 밖 단계에서는 낡을 수 있다. 커밋 규칙은 [실행 컨텍스트](CLE-EXEC-CONTEXT.md) |
| resume_call_stack | JSONB? | NULL 허용(V087). **중첩 서브 워크플로우(`executeInline`) 안의 블로킹 노드**가 park 할 때 재개에 필요한 `executeInline` 호출 체인(바깥쪽부터 입력 대기 안쪽 직전까지, `{version, frames:[{workflowId, invokerNodeId, recursionDepth}]}`)을 커밋하는 영속 재개 매체다. rehydration 이 이 스택을 따라 가장 안쪽 입력 대기 노드부터 frame 단위로 재진입한다. **NULL = 최상위 park(중첩 깊이 0), park 한 적 없는 실행, 배포 이전 행**이며 단일 수준으로 재개한다. 컨테이너 본문 블로킹이 금지라 선형 스택만 담는다(반복 회차·분기 상태 없음). `version` 은 `CALL_STACK_SCHEMA_VERSION`(체크포인트와 독립)이다. 재진입 절차는 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) |
| source_ip | Varchar(45)? | NULL 허용(V096). 웹훅·채팅 채널 트리거가 발화할 때 `hooks.service` 의 `extractClientIpFromHeaders` 결과다(CF-Connecting-IP 를 믿을 때, 아니면 X-Forwarded-For 첫 IP. 헤더 기반이며 `req.ip` 로 대신하지 않는다). HTTP 가 아닌 트리거(스케줄), 수동 실행, 배포 이전 행은 NULL 이다. [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) 사용 내역의 호출 이력 "소스 IP" 컬럼 출처다. 길이 45 는 IPv6 표기 최대(IPv4-mapped 포함)다. |
| response_code | Varchar(10)? | NULL 허용(V096). 웹훅 호출이 받는 **실제 HTTP 응답 코드** 문자열이다(실행 생성 성공 경로 = `'202'` Accepted. 채팅 채널의 인터랙션 요청(Discord 슬래시 명령 · 컴포넌트 · 모달 제출, Slack Interactivity)으로 시작한 실행은 `'200'` 이다. 응답 계약은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 정한다. 인증·검증 실패는 execute 전에 throw 해 행이 생기지 않는다). HTTP 가 아닌 트리거는 HTTP 코드가 없어 NULL 이고 `getUsage` 가 실행 `status` 로 대신 표시한다. [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) 호출 이력 "응답 코드" 컬럼 출처다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 이행). |
| single_node_id | UUID? | NULL 허용(V098). 단일 노드 실행(`single_node_id`)의 대상 노드 id 다. 값이 있으면 엔진(`runExecution`)이 그 노드만 실행하고 하류로 가지 않는다. 선택 노드부터 실행과 다르다. NULL 이면 일반 실행이나 선택 노드부터 실행이다. `_node_id` 접미사는 Node FK 도메인을, `single_` 한정자는 `fromNodeId`(컬럼이 아니라 `input_data` 로 전달)와의 구분을 나타낸다. `dry_run` / `re_run_of` 와 같은 모드 표시 컬럼이다. 명시적 FK 제약과 인덱스가 없다(`re_run_of` 선례, 디버그 전용이라 조회 패턴 없음). `dry_run` 과 직교하며 단일 노드 실행은 항상 `dry_run = false` 다(두 모드 조합 미지원, v1). 기준은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) |
| previous_execution_id | UUID? | NULL 허용(V098). 단일 노드 실행 때 입력 seed 를 가져올 직전 실행 id 다. 그 실행에서 대상 노드의 직속 선행 노드 실행 `output_data` 를 현재 실행 컨텍스트에 되살려 상류 출력을 자동으로 넣는다. NULL 이면 seed 가 없다(수동 입력만). `re_run_of`(재실행 부모)와 뜻이 다르다. 입력 주입 참조일 뿐 체인 관계가 아니다. API 응답 DTO 에는 없다(whitelist 매핑에서 저절로 빠진다). |

**인증 설정 호출 집계**: 인증 설정 사용 내역(`GET /api/auth-configs/:id/usage`)의 `totalCalls` / `periodCounts` / `recentCalls` 는 **전용 로그 엔티티 없이** `Execution.trigger_id → Trigger.auth_config_id` 조인으로 계산한다. 인증 설정에 연결된 트리거들의 실행 행이 곧 "호출" 이다. `periodCounts` 는 `Execution.started_at` 의 롤링 윈도 조건부 집계(`COUNT(*) FILTER`), `recentCalls` 는 최근 20건의 `triggerName` / `status` / `source_ip` / `response_code` / `started_at` 이다. 화면과 API 는 [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) 에 있다.

**`dryRun` 응답 필드의 출처**는 `dry_run` 컬럼(V068)이다. 응답 DTO(`ExecutionDto.dryRun`)는 이 컬럼을 그대로 내보낸다. 노드 실행을 집계해 만든 값이 아니다. 노드 실행 수준의 `output_data._dryRun` 은 노드별 결과 표시용으로 별개다. 기준은 [재실행](CLE-EXEC-RERUN.md) 이다.

**`error` 의 엔진 인프라 코드**: `error.code` 어휘는 노드 핸들러가 정한 코드([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 `output.error` 표준 형태)에 더해 엔진 인프라 코드를 포함한다. 아래 여섯 코드는 **등재처가 서로 다르다.** 이 목록이 단일 등재처를 뜻하지 않는다.

| 코드 | 등재처 | 뜻 | 기준 문서 |
| --- | --- | --- | --- |
| `SERVER_INTERRUPTED` | `EngineErrorCode` const | 안전 종료 때 끝나지 못한 노드 | [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) |
| `WORKER_HEARTBEAT_TIMEOUT` | `EngineErrorCode` const | 세그먼트 작업이 stalled 재배달(`maxStalledCount=1`) 시도를 모두 소진함. 워커 쪽 최종 실패다. 부팅 복구 스캔 재구동은 이 코드를 쓰지 않는다(재구동 불가는 `RESUME_CHECKPOINT_MISSING`). | [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) |
| `EXECUTION_TIME_LIMIT_EXCEEDED` | `ErrorCode` const | 엔진 수준 세그먼트 누적 시간 초과(입력 대기 시간 제외) | [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) |
| `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` | `RehydrationError.code` 리터럴 유니온 | 재개 rehydration 실패 | [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) |

상수로 한 번 더 옮기지 않는 이유는 `codebase/backend/src/nodes/core/error-codes.ts` 의 JSDoc 에 있다. 에러 코드 전체 카탈로그는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 다.

## 노드 실행

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| execution_id | UUID | FK → Execution (CASCADE) |
| node_id | UUID | FK → Node (CASCADE) |
| parent_node_execution_id | UUID? | FK → NodeExecution (SET NULL). 이 행을 묶는 그룹 노드의 노드 실행이다. 서브 워크플로우(인라인 실행), Background(본문), Parallel(분기) 노드가 자기 행 id 를 자식 행에 찍는다. 실행 결과 타임라인은 이 값으로 자식을 부모 아래에 묶는다. 부모 행이 지워져도 자식 이력은 남고 묶음만 잃는다(V012). |
| status | Enum | pending / running / completed / failed / cancelled / skipped / waiting_for_input. `cancelled` 는 노드가 실패한 것이 아니라 **중단된** 상태다. 두 경로가 여기로 온다. (1) 외부 `abortSignal` 로 외부 I/O 가 끊겨 핸들러가 던진 `AbortError`. (2) 엔진이 노드 경계, AI 턴 경계, park 짝 전이에서 실행 행을 다시 읽어 외부 취소를 알아채고 던진 `ExecutionCancelledError`. 사용자 실행 중지는 신호를 만들지 않으므로 선형 경로와 재개 경로에서는 (2)가 유일한 관측 수단이다. 규칙은 [노드 취소](CLE-EXEC-CANCEL.md) 와 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) |
| started_at | Timestamp | 실행 시작 시각 |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 소요 시간 |
| input_data | JSONB | 노드 입력. **응답·발행 때 자격 증명 값 패턴을 가린다**(DB 는 원문 보존). 상위 `Execution.input_data` 와 **같은 규칙**이다. 한쪽만 가리면 REST 폴링이 WS 의 가린 값을 덮어 값이 번갈아 바뀐다. 범위는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) |
| output_data | JSONB? | 노드 출력. 응답·발행 때 자격 증명 값 패턴을 가린다(DB 는 원문 보존). 범위는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) |
| error | JSONB? | 에러 정보 `{ code, message, stack? }` |
| retry_count | Integer | 재시도 횟수 |
| interaction_data | JSONB? | 사용자 인터랙션 기록(Form 제출이나 버튼 클릭). `{ interactionType: "form_submitted" \| "button_click" \| "button_continue", buttonId?, buttonLabel?, clickedAt, clickedBy }`. 여기의 `interactionType` 은 **사용자가 한 행동의 기록**(사용자 행동 기록) enum 이다. 노드의 대기 상태를 나누는 대기 표면(`WaitingInteractionType`: `form` / `buttons` / `ai_conversation` / `ai_form_render`)과 **이름만 같고 다른 enum** 이다. 기준은 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md). 이 필드와 AI 노드의 `output_data.messages` 가 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 분산 기준이며 실행 뒤 타임라인 UI 가 이것으로 다시 구성한다. |

**행 생성**:

- 엔진은 노드 실행 행을 처음부터 `status='running'` 으로 INSERT 한다(`executeNode`, `createNodeExecution` 호출부). 비활성(`is_disabled`) 노드는 `status='skipped'` 로 바로 INSERT 한다(`running` 을 거치지 않는다).
- `pending` 은 엔티티 기본값일 뿐 어떤 엔진 경로도 쓰지 않는다(현재 구현). 엔진 원문의 상태 설명과 갈린다. [미결 사항](CLE-EXEC-DATA.md#미결-사항) 참조.
- 노드 실행에는 실행의 `ALLOWED_TRANSITIONS` 같은 코드 수준 전이표가 없다. 노드 실행 상태 전이는 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 가 정한다.
- 크래시 재구동이 미완료 노드를 다시 실행할 때와 마지막 턴 재시도가 턴을 다시 돌릴 때는 **새 노드 실행 행**을 만든다. 규칙은 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 와 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 에 있다.

## 실행 에러와 노드 실행 에러

| 항목 | 설명 |
| --- | --- |
| 원본 | `NodeExecution.error`. 개별 노드 실행이 실패할 때 기록한다. |
| 복사 | `Execution.error`. 실행이 `failed` 로 바뀔 때 **최초 `failed` 노드 실행**의 에러 정보에 `nodeId` 를 붙여 복사한다. |
| 직접 기록 | **복사가 유일한 채움 경로는 아니다.** 엔진 인프라 사유로 끝날 때는 복사할 노드 에러가 없어 엔진이 `Execution.error` 를 직접 쓴다. 큐 대기 한도 초과는 노드가 시작된 적이 없어 `Execution.error = { code: EXECUTION_QUEUE_WAIT_TIMEOUT, message }` 를 직접 UPDATE 한다. 이 경로의 종결 상태는 `failed` 가 아니라 **`cancelled`** 라 에러 코드 문서의 "엔진 수준 에러"(실패) 목록에는 나오지 않는다. rehydration 실패, stalled 재배달 소진, 실행 시간 한도 초과, 안전 종료도 노드 에러 복사가 아니다. `RESUME_*` 는 `cancelled`, `WORKER_HEARTBEAT_TIMEOUT` 은 `failed` 로 끝난다. 코드와 종결 상태 전체는 [상태별 종결 코드](CLE-EXEC-DATA.md#상태별-종결-코드) 에 있다. |
| 구조 | `{ nodeId: "uuid" \| null, code: "ERROR_CODE" \| null, message: "에러 설명", details?: {...} }`. `nodeId` 는 노드 없는 엔진 인프라 실패(워커 크래시 등)에서 `null` 이다. `code` 는 분류할 코드가 없는 일반 `catch` 경로에서 `null` 이다. `details` 는 노드 핸들러 결과의 `output_data.error.details`([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md))에서 오며 `NodeExecution.error` 표에는 없다. 억지 대체 코드를 넣지 않는 이유는 [External Interaction API](../CLE-IX/CLE-EIA.md) §6.4 에 있다. |
| 용도 | 실행 목록에서 노드 실행을 조회하지 않고도 실행 단위로 에러 원인을 바로 볼 수 있다. |
| 응답 마스킹 | **열거된 경로에서만** 자격 증명 값 패턴을 가린다. DB 는 원문을 보존한다. 위 "복사" 관계 때문에 **한쪽만 가리면 같은 문자열이 같은 응답에 함께 실려 방어가 뚫린다.** 그래서 가리는 경로에서는 `Execution.error` 와 `NodeExecution.error` 를 반드시 함께 가린다. "어디로 나가든 가려진다" 로 읽으면 안 된다. 적용 표면과 남은 틈은 열거로만 정의하며 목록과 개수를 여기 다시 적지 않는다. 기준은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 의 "적용 범위는 총칭이 아니라 열거다" 항목이다. 2026-08-16 부터 WebSocket `execution.node.*` 와 종결이 아닌 `execution.*` **발행** 경로도 가림 대상이다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). |

## 노드 실행 순서 로그

노드 실행 순서 로그(`ExecutionNodeLog`, `execution_node_log`)는 노드가 처리된 순서를 쌓는 append-only 테이블이다. `(execution_id, id)` 정렬이 곧 노드 실행 순서다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | BIGSERIAL | PK. PostgreSQL sequence 가 매기는 순서가 곧 실행 순서다. |
| execution_id | UUID | FK → Execution (ON DELETE CASCADE) |
| node_id | UUID | 실행된 노드 ID |
| created_at | TimestampTZ | append 시각(기본 `NOW()`) |

**인덱스**: `(execution_id, id)`(V035). 한 실행의 노드 순서를 조회한다.

- **다중 인스턴스 안전**: BIGSERIAL `id` 는 PostgreSQL sequence 가 매기므로 여러 백엔드 인스턴스가 동시에 INSERT 해도 순서가 결정적이다.
- **처리 완료 로그다**: 진입 로그가 아니다. `appendExecutionPath` 호출 지점은 핸들러 실행이 끝난 뒤(`completed` 마감이나 블로킹 출력 저장 뒤) 한 곳뿐이다. 노드가 throw 해 catch 로 빠지면 기록하지 않는다. rehydration 이 이 로그를 "실행된 노드 집합" 으로 다시 읽는 의미와 맞는다.
- **응답의 `executionPath`**: 외부 API 응답의 `executionPath: string[]` 모양은 유지한다. `findById` 가 이 테이블의 정렬 쿼리(`(execution_id, id) ASC`)로 채운다. 목록 조회 응답은 N+1 을 피하려고 빈 배열을 돌려준다.
- **옛 컬럼 없음**: `execution_path` 컬럼은 V036 에서 DROP 했다([Rationale](#execution_path-배열-대신-노드-실행-순서-로그-v035--v036)).

## 테스트 데이터셋

테스트 데이터셋(`WorkflowTestDataset`)은 워크플로우 에디터의 테스트 입력(Mock Input)을 이름 붙여 저장하고 다시 쓰는 데이터셋이다(V097). 권한과 소유 모델의 기준은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 이다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow (CASCADE, 같은 워크스페이스). 데이터셋이 속한 워크플로우 |
| owner_id | UUID | FK → User (CASCADE). 소유 사용자. 만들 때 항상 요청 사용자이며 수정·삭제 권한의 단일 기준이다. |
| workspace_id | UUID | FK → Workspace (CASCADE). 워크스페이스 격리와 공유 목록 쿼리용(워크플로우의 워크스페이스를 비정규화). 복합 FK `fk_workflow_test_dataset_workflow_id`(V141)가 워크플로우의 워크스페이스와 같게 지킨다([데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)) |
| visibility | Enum | `private`(기본, 소유자만) / `workspace`(워크스페이스에 읽기 전용 공유). 소유자가 아니면 공유본을 복제해 고친다. |
| name | Varchar(255) | 데이터셋 이름 |
| data | JSONB | 테스트 입력 JSON(`POST /workflows/:id/execute` 본문의 `input` 으로 쓴다). **API 표면 키는 `input`** 이다. TransformInterceptor 의 최상위 `data` 키 감싸기 휴리스틱과 부딪치지 않게 하려는 것이다(DB 컬럼은 `data`, 엔티티·DTO 속성은 `input`). |
| created_at / updated_at | TimestampTZ | 생성·수정 시각 |

**제약**: `(workflow_id, owner_id, name)` UNIQUE. 한 사용자가 같은 워크플로우에 같은 이름을 두 번 저장할 수 없다(어기면 409 `DUPLICATE_NAME`).

**인덱스**: `(owner_id, workflow_id)` 는 사용자의 그 워크플로우 데이터셋 조회용이다. `(workspace_id, visibility)` 는 워크스페이스 공유본 목록 필터용이다.


## 구현 위치

- `codebase/backend/src/modules/executions/entities/execution.entity.ts` (실행 엔티티)
- `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts` (노드 실행 엔티티)
- `codebase/backend/src/modules/execution-engine/entities/execution-node-log.entity.ts` (노드 실행 순서 로그)
- `codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts` (테스트 데이터셋)

## Rationale

### `execution_path` 배열 대신 노드 실행 순서 로그 (V035 → V036)

V001 은 `execution.execution_path UUID[]` 컬럼에 노드 실행 순서를 담았다. 단일 인스턴스에서는 동작했지만 여러 백엔드 인스턴스가 동시에 `array_append()` 로 갱신하면 인스턴스 사이 절대 순서가 보장되지 않았다. 배열 append 는 read-modify-write 를 줄 세워야 해 충돌과 성능 모두 문제였다. 대신 append-only 테이블 `execution_node_log` 를 들였다. BIGSERIAL `id` 를 PostgreSQL sequence(동시성 안전)가 매기므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서다.

운영 DB 의 DDL lock 영향을 줄이려고 이행을 두 단계로 나눴다.

- `codebase/backend/migrations/V035__execution_node_log_create.sql`: 테이블을 만들고 `UNNEST WITH ORDINALITY` 로 기존 배열 데이터를 옮긴다. `executeInTransaction=false`.
- `codebase/backend/migrations/V036__execution_drop_execution_path.sql`: 컬럼을 지운다. `lock_timeout=3s` 로 운영 영향을 줄인다.
- Flyway 규약상 알파벳 접미사(V035a 등)는 조용히 건너뛰므로 항상 정수 prefix 를 쓴다. 규약은 [DB 마이그레이션 규약](../CLE-ENG/CLE-ENG-MIGRATION.md) 에 있다.

### 실행 입력도 응답에서 가린다 (2026-08-20)

`Execution.input_data` 는 2026-08-20 전까지 응답 마스킹의 예외였다. 재실행 프리필이 이 값을 읽어 다시 제출하므로 가리면 `***` 가 실제 입력이 됐기 때문이다. 프론트엔드 마커 가드(프리필 건너뜀, 제출 차단)가 생기면서 그 조건이 사라져 가리는 쪽으로 바꿨다. 같은 날부터 서버도 수동 실행 경로에서 마스킹 마커를 그대로 다시 보낸 값을 `MASKED_VALUE_RESUBMITTED` 로 거부한다. UI 를 거치지 않은 API 직접 호출에 대비한 것이다. 노드 실행 `input_data` 는 그전부터 가리고 있었으므로 이 전환으로 두 필드의 규칙이 같아졌다.

### `dryRun` 응답은 컬럼에서 읽는다

응답의 `dryRun` 을 노드 실행 집계로 만드는 방식은 택하지 않았다. 부수효과 노드가 없는 dry-run 워크플로우를 `false` 로 잘못 도출하기 때문이다. 그래서 `dry_run` 컬럼(V068)을 그대로 내보낸다.

### 인증 설정 호출 집계는 실행 행을 다시 쓴다

통합은 전용 `IntegrationUsageLog` 를 두지만 인증 설정의 "호출" 은 워크플로우 실행과 1:1 이다. 전용 로그를 두면 같은 사실을 두 번 기록하게 된다. 그래서 인증 설정 사용 내역은 실행 행을 트리거 조인으로 다시 쓴다.

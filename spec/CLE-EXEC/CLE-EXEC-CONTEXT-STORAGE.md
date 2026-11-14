---
id: "CLE-EXEC-CONTEXT-STORAGE"
title: "실행 컨텍스트 — 저장 전략과 재개"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-CONTEXT"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-CONTEXT"]
area: "CLE-EXEC"
content_hash: "486d6277936c5dfbb8da59b04b10ec4838a2f2e73941b1ba5ea094879f613042"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "485c2f223ef7327ba78542c100d626c8aa4cbebe710da05550ac3919e1d29c8b"
etag: "sha256-0b6c3cc8be087cf561fddd0657869cf0840647812dac492eff4ae4d4d9d4a424"
---
## 개요

이 문서는 [실행 컨텍스트](CLE-EXEC-CONTEXT.md) 의 하위 문서로 실행 중 상태를 어디에 저장하는지, 멀티턴 재개 때의 `rawConfig` 스냅샷, 저장된 실행을 다시 쓰는 모드의 경계를 정한다.

## 저장 전략

| 단계 | 저장소 | 설명 |
| --- | --- | --- |
| 실행 중 | 메모리(`ExecutionContextService` 의 세그먼트 로컬 Map) | 실행 컨텍스트(변수, 노드 출력 캐시, 대화 스레드 등)를 인스턴스 로컬 `Map<contextKey, ExecutionContext>` 에 둔다. park(세그먼트 종료)나 완료 때 사라진다. 크래시·재시작·다른 인스턴스 재개는 아래 durable 컬럼에서 rehydration 이 다시 만든다. Redis 에 저장하지 않는다 |
| 노드 완료 때 | 메모리 + PostgreSQL | 메모리 컨텍스트의 노드 출력 캐시를 갱신하고 노드 실행 행과 `execution_node_log`(노드 순서)를 PostgreSQL 에 저장한다 |
| 노드 훅 때 | 메모리(`ExecutionContext.conversationThread` 일부) | `ConversationThreadService.append*` 가 Presentation 재개 `interaction`, 멀티턴 AI 메시지와 응답이 생길 때 메모리 스레드를 갱신한다. 실행 내역 화면의 기준은 `NodeExecution.outputData`(`output.interaction`·`output.messages`·`output.result.response`)이고 재개용 스냅샷은 아래 입력 대기 행에서 따로 커밋한다 |
| 입력 대기 진입 때 | PostgreSQL(`NodeExecution.outputData`, `Execution.conversation_thread`, `Execution.user_variables`, `Execution.resume_call_stack`) | 다음 노드를 재개하는 데 필요한 모든 것을 커밋한다. 커밋 항목은 아래 목록과 같다 |
| AI 대화 재개 때 | PostgreSQL(`NodeExecution.outputData`, 조건부 갱신) | 멀티턴 AI 노드가 사용자 메시지나 `render_form` 제출로 재개하면 엔진이 다음 턴 LLM 호출 전에 `resumed` 스냅샷을 노드 실행 행에 저장한다. 행 상태가 `running` 이나 `waiting_for_input` 일 때만 쓰는 조건부 갱신이다. `_resumeState` 는 싣지 않고 체크포인트 대상 노드면 직전 대기와 같은 `_resumeCheckpoint` 를 싣는다. 형태와 시점은 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)가 정한다 |
| 실행 완료 때 | PostgreSQL | 최종 출력과 상태를 영구 저장하고 메모리 실행 컨텍스트를 지운다(`finalizeRehydrationCleanup` 또는 세그먼트 종료) |

입력 대기에 들어갈 때 커밋하는 항목:

1. 대기 표면(`interactionType`)과 노드의 `rawConfig` 스냅샷.
2. 멀티턴이면 `_resumeState` 에서 자격 증명을 뺀 부분집합 `_resumeCheckpoint`([실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md)). `_resumeState` 전체는 메모리에만 있다.
3. 현재 `context.conversationThread` 전체 스냅샷을 `Execution.conversation_thread`(jsonb)에 저장한다. 마지막 쓰기가 최신 스냅샷이고 rehydration 이 여기서 그대로 되살린다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)).
4. `context.variables` 가운데 시스템 `__*` 를 뺀 사용자 정의분을 `Execution.user_variables`(jsonb)에 저장한다.
5. 중첩 서브 워크플로우(`executeInline`) 안에서 park 하면 호출 체인(가장 바깥에서 대기 중인 안쪽 직전까지)을 `Execution.resume_call_stack`(jsonb)에 저장한다. rehydration 이 이 스택으로 서브 워크플로우 프레임을 하나씩 다시 들어간다. 최상위 park(중첩 깊이 0)는 `NULL` 이다. 버전은 체크포인트와 따로 진화하는 `CALL_STACK_SCHEMA_VERSION` 이다.

재개용 별도 컬럼 `_continuationCheckpoint` 는 만들지 않는다. 1·2 는 기존 기준인 `NodeExecution.outputData` 를 rehydration 의 단일 기준으로 쓴다. 5 의 `resume_call_stack` 은 park 시점의 **중첩 실행 위치**(호출 체인)를 저장한다. 재개 데이터를 나르는 컬럼이 아니므로 `_continuationCheckpoint` 기각과 범주가 다르다.

**실시간 조기 표시 신호는 저장하지 않는다**: 멀티턴 재개 공통 경로(WebSocket `execution.submit_message` 와 채널 텍스트 수신이 함께 지나는 `message_received` 재개 시점)는 다음 턴 LLM 호출 전에 WebSocket `execution.user_message` 이벤트를 내 사용자 발화를 바로 보여 준다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). 이 신호는 `tool_call_*` 와 같은 실시간 진행 신호이고 저장 대상이 아니다. `NodeExecution.outputData` 는 위 표의 시점에만 저장한다. AI 대화 재개 때의 `resumed` 스냅샷 `output.result.messages` 에 든 사용자 발화는 노드 출력의 저장이고 이 이벤트의 저장이 아니다. 사용자 발화의 최종 저장 정합은 턴이 끝날 때의 `execution.ai_message` 스냅샷(`output.result.messages`)이 보장한다. "재개 전용 WebSocket 이벤트를 새로 만들지 않는다" 는 원칙은 `node.*` 이벤트로 알 수 있는 재개 사실을 다시 알리는 이벤트(`resumed_after_restart`)를 기각한 것이라 이 신호에는 해당하지 않는다([장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md)).

## 멀티턴 재개 때의 `rawConfig` 스냅샷

- 첫 턴의 `executeNode` 가 `waiting_for_input` 에 들어가면 엔진이 `state.rawConfig = Object.freeze({ ...node.config })` 로 스냅샷을 뜬다.
- 뒤 턴의 `processMultiTurnMessage(message, state)` 는 `state` 만 받으므로(실행 컨텍스트 없음) 핸들러는 `state.rawConfig` 로 일관되게 읽는다.
- `context.rawConfig` 는 노드를 실행할 때마다 DB 에서 새로 읽은 값이고 `state.rawConfig` 는 한 턴을 처리하는 동안 고정된 스냅샷이다. 이 차이는 의도한 것이다.
- 멀티턴 AI 는 턴마다 입력 대기에서 코루틴을 해제하고(턴 단위 park) 다음 메시지가 오면 rehydration 으로 재개한다. 재개 때 `buildRetryReentryState` 가 **현재 `node.config` 에서 `rawConfig` 를 새로 만들어 다시 고정한다**. 그래서 고정 범위는 한 턴이고 park 중에 워크플로우 정의를 고치면 다음 턴부터 새 정의가 적용된다. 대화 전체를 첫 턴 정의로 고정하던 이전 동작을 대신한다.

## 재실행과 조회 정책

저장된 실행 기록을 다시 쓰는 시나리오의 정책이다. 뜻이 다른 모드를 나눠 정한다. 한쪽은 외부 부수 효과가 없고 다른 쪽은 새 실행으로 부수 효과를 다시 일으킨다.

| 모드 | 뜻 | 구현 상태 | 외부 부수 효과 | 표현식 평가 |
| --- | --- | --- | --- | --- |
| 조회(View) | 실행 내역 조회. `NodeExecution.outputData` 를 그대로 보인다 | ✅ 구현됨(실행 내역 화면) | ❌ 없음 | ❌ 없음 |
| 재실행(Re-run) | 새 실행 시작. 현재 워크플로우 정의의 원본 설정을 다시 평가한다 | ✅ 정의됨([재실행](CLE-EXEC-RERUN.md)) | ✅ 다시 일으킨다(이메일 재발송, HTTP 재호출 등). dry-run 으로 건너뛸 수 있다 | ✅ `$now`·`random()` 등을 새 실행 시점으로 다시 고정 |
| 멀티턴 재개 | 같은 실행의 다음 턴 진행. `state.rawConfig` 고정 스냅샷을 쓰고 고정 범위는 한 턴이다 | ✅ 구현됨(WebSocket `execution.submit_message`, EIA `interact`) | 해당 노드 한정(`processMultiTurnMessage`) | 해당 노드 한정 |

- **조회와 멀티턴 재개는 재실행이 아니다**. 조회는 지난 기록을 보는 것이고 멀티턴 재개는 진행 중인 실행의 다음 턴이다.
- **재실행은 새 실행 행을 만든다**. 기존 행의 입력을 복사할 수 있지만 결과는 현재 워크플로우 정의, 현재 시각, 외부 응답에 따라 달라진다.
- 재실행의 부수 효과 가드(확인 모달과 dry-run 토글)와 dry-run 정의는 [재실행](CLE-EXEC-RERUN.md) 이 정한다.

원본 설정 노출 이전의 옛 노드 실행 행:

- 옛 행의 `outputData.config` 는 표현식 **평가 후** 모양이다(예: `{ subject: "Hello Alice" }`). 새 행은 평가 **전** 모양이다(예: `{ subject: "Hello {{ name }}" }`).
- 소급 변환하지 않고 지난 기록으로 보존한다.
- 표현식 컨텍스트는 다른 실행을 참조하지 않는다(실행마다 자기 노드 출력 캐시만 쓴다). 그래서 옛 행의 차이는 **화면 표시 차이뿐**이고 실행 동작에는 영향이 없다.
- 조회는 best-effort 다. 옛 실행의 Send Email·HTTP Request 는 새 `output.{subject, body, requestBody, responseHeaders, bodyTruncated}` 필드가 없을 수 있다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (park 저장)
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts`
- `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`

## Rationale

### 실행 컨텍스트는 메모리에 두고 durable 은 DB 로 한다 (2026-07-04)

초기 설계는 실행 컨텍스트(변수·노드 출력 캐시), 실행 상태, 노드 출력, 워커 heartbeat, 실행 잠금, 우선순위 큐를 각각 Redis 키(`exec:{ws}:…:context`·`:status`·`:output`·`:heartbeat`·`:lock`·`queue:priority`)로 두는 안이었다. **이 설계는 구현되지 않았고** 실제 구조는 다음으로 모였다.

- **실행 컨텍스트는 메모리의 세그먼트 로컬 Map 이다**. park·완료 때 사라지고 재개는 rehydration 이 durable 컬럼(`Execution.conversation_thread`·`user_variables`·`resume_call_stack`), `NodeExecution.outputData`, `execution_node_log` 에서 **DB 로부터 다시 만든다**. Redis 컨텍스트 저장소를 두지 않는 이유는 셋이다.
  - park 해제 모델과 겹친다. park 때 durable 기준은 이미 PostgreSQL 이므로 Redis 사본은 rehydration 원천을 둘로 나눠 기준이 갈리게 한다.
  - 인스턴스 사이 문제는 구조로 이미 풀었다. 시작 큐 작업 ID 중복 제거로 한 실행의 세그먼트는 늘 하나이고 아무 인스턴스나 DB rehydration 으로 재개하며 크래시 재구동도 DB 에서 다시 만든다. 세그먼트 로컬 메모리는 의도한 설계다.
  - 노드 출력마다 Redis 를 왕복하는 비용 없이 세그먼트 안에서는 메모리로 처리하고 경계(park·완료)에서만 DB 에 커밋한다.
- 실행 상태는 PostgreSQL `Execution.status` 이고 Redis 사본이 없다. 노드 출력은 `NodeExecution.outputData` 와 순서 기록 `execution_node_log` 다. 워커 heartbeat 는 만들지 않고 BullMQ stalled 검출이 대신한다. 실행 잠금은 재개 진입의 DB 원자 claim 과 부팅 복구의 전역 `exec:recover:lock` 으로 충분하다. 우선순위는 BullMQ 기본 작업 우선순위다.

남는 손실은 세그먼트 누적 시간 추적(`segmentStartMs`)이 메모리에 있다는 점이다. 이는 안전 종료 때 누적 시간을 덜 세는 것을 받아들인 결정이고 세그먼트 시작 시각 저장은 확정되지 않은 후속 후보로 남긴다([큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md), [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md)). 전면적인 Redis 컨텍스트 저장소는 기준이 둘로 갈릴 위험 때문에 채택하지 않는다.

### 멀티턴 설정은 턴마다 새로 만든다 (D3)

턴마다 rehydration 이 `buildRetryReentryState` 로 `node.config` 를 새로 만들므로 park 중 워크플로우 편집이 다음 턴부터 반영된다. 체크포인트에 원본 설정을 저장해 대화 전체를 고정하는 대안은 구현 복잡도를 더하고 최신 정의를 반영하는 편이 더 자연스러워 택하지 않았다. 같은 입력의 재현성이 턴 단위로 약해지는 것은 모든 재개를 rehydration 한 경로로 모으기 위한 trade-off 다. park 해제 결정의 전체 경위는 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 에 있다.

### AI 대화 재개 스냅샷을 턴 중간에 저장한다 (2026-11-12)

그 전에는 `NodeExecution.outputData` 를 턴 경계(노드 완료, 입력 대기 진입, 실행 완료)에서만 저장했다. AI 대화 경로가 재개 스냅샷을 내면서 사람 결정으로 이를 노드 실행 행에도 저장하게 됐다. 메모리 캐시에만 실으면 LLM 응답이 곧 덮어 실행 내역 어디에서도 보이지 않는다. 결정과 기각한 대안은 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md#rationale) Rationale 의 2026-11-12 항목에 있다.

- **조건부 갱신으로 출력 컬럼만 쓴다**: 행 상태가 `running` 이나 `waiting_for_input` 일 때만 쓴다. 엔티티를 통째로 저장하면 메모리에 있던 낡은 상태가 그사이 들어온 취소를 덮는다.
- **재개 체크포인트를 지우지 않는다**: 저장본에 직전 대기와 같은 `_resumeCheckpoint` 를 싣는다. 이 저장이 체크포인트 없는 출력으로 행을 덮으면 LLM 호출 중 서버가 재시작했을 때 재개 체크포인트가 사라진다.
- **`execution.user_message` 이벤트는 여전히 저장하지 않는다**: 저장하는 것은 노드 출력이다. 이벤트는 실시간 진행 신호로 남는다.

---
id: "CLE-WF-ASSIST-PROTO-STORE"
title: "AI 어시스턴트 스트리밍과 세션 API — 저장 엔티티와 턴 저장 규칙"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-ASSIST-PROTO"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-ASSIST-PROTO"]
area: "CLE-WF"
content_hash: "6e345d685f5b1ae094cfa151650bf68cf61e01a77ed3bad3fabf47b6bd7120ba"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "7a688bab8b1fc608abf3f81795c81cfdb9481cf2f111c105ca7e35689871328b"
etag: "sha256-df36e69246d422d0738b0363f71aa3665073a82bd708537e95da93e4a4072f3c"
---
## 개요

이 문서는 [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md) 의 하위 문서로 대화를 서버에 남기는 두 엔티티(어시스턴트 세션 · 어시스턴트 메시지), 삭제 연쇄, 자동 이어서 진행 때의 턴 저장 규칙을 정한다. 이 행을 돌려주는 REST 응답 필드는 [부모 문서 §메시지 응답 필드](CLE-WF-ASSIST-PROTO.md#메시지-응답-필드)가 정한다.

## 엔티티

### 어시스턴트 세션

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → Workspace (CASCADE) |
| `workflow_id` | UUID | FK → Workflow (CASCADE, 같은 워크스페이스). 세션은 워크플로우 하나에 종속된다 |
| `user_id` | UUID | FK → User (CASCADE). 세션을 만든 사용자 |
| `title` | String? | 세션 제목(첫 메시지 요약 또는 사용자 수정) |
| `llm_config_id` | UUID? | FK → ModelConfig (SET NULL, 같은 워크스페이스, `kind=chat`). 없으면 워크스페이스 기본 Chat 설정을 쓴다 |
| `status` | Enum | `active` / `archived`. `archived` 는 화면에서 숨긴다 |
| `message_count` | Int | 메시지 수 캐시(비정규화) |
| `last_interaction_at` | Timestamp | 마지막 메시지·도구 호출 시각. 기본값 `now()` |
| `created_at` | Timestamp | 생성 시각 |
| `updated_at` | Timestamp | 수정 시각 |

| 상태 | 들어가는 경로 | 결과 |
|------|---------------|------|
| `active` | 생성(INSERT) | 패널에 보이고 메시지를 더할 수 있다 |
| `archived` | `PATCH` 로 `{status: 'archived'}` | 화면에서 숨긴다. 행은 남는다 |

- 생성할 때 `workspace_id`·`workflow_id`·`user_id` 와 `status='active'`, `message_count=0`, `last_interaction_at`(생성 시각)을 넣는다. `title`·`llm_config_id` 는 요청에 있을 때만 채우고 없으면 null 이다.
- 새 메시지를 저장하면 `message_count`·`last_interaction_at`·`updated_at` 을 함께 갱신한다. 현재 구현은 메시지 INSERT 와 세션 UPDATE(`message_count = message_count + 1`)를 한 트랜잭션에서 한다.
- 인덱스: `(workflow_id, user_id, status, last_interaction_at DESC)` 는 `sessions/latest` 조회용이다. `(workspace_id, user_id, updated_at DESC)` 가 있다(V019). 모델 설정 삭제 때 SET NULL 을 위해 `(llm_config_id)` 부분 인덱스가 있다(V125).

### 어시스턴트 메시지

사용자 입력과 어시스턴트 응답을 시간 순서로 남기고 도구 호출 결과는 어시스턴트 행의 `tool_calls[].result` 에 담는다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `session_id` | UUID | FK → AssistantSession (CASCADE) |
| `role` | Enum | `user` / `assistant` / `tool` / `system`. 실제로 저장하는 값은 `user`·`assistant` 다. `tool` 은 CHECK 가 허용하지만 지금은 행을 쓰지 않는다. `system` 은 감사·디버그용 값이고 프롬프트 빌더가 매 요청 조립하므로 저장하지 않는다. V019 의 CHECK 는 `user`·`assistant`·`tool` 만 허용해 `system` 행은 저장할 수 없다 |
| `content` | Text? | 사용자·어시스턴트 텍스트 본문 |
| `tool_calls` | JSONB? | `role=assistant` 행과 함께 발행된 tool_call 목록. 항목마다 `{id, name, arguments, kind: 'explore'\|'plan'\|'edit', result, planStepId?}` |
| `tool_call_id` | String? | `role=tool` 행이 어느 tool_call 의 결과인지 가리키는 자리. 지금은 `tool` 행을 쓰지 않아 비어 있다 |
| `plan` | JSONB? | `propose_plan` 발행 시점 스냅샷. `{title, summary, steps[], openQuestions[], approvedAt?}` |
| `usage` | JSONB? | `{inputTokens, outputTokens, totalTokens, thinkingTokens?, model}`. `role=assistant` 의 턴 종료 시점에만 채운다 |
| `finish_reason` | String? | `role=assistant` 에만 있다. 모델 프로바이더 값 `stop` / `tool_calls` / `length` / `content_filter` / `aborted` 와 서버 합성 표시 `error`(턴이 에러로 끝남, 예: 라운드 한도 초과) / `auto_resume_pending`(이어서 진행으로 나뉜 턴의 중간 행) |
| `auto_resumed` | Boolean | 자동 이어서 진행으로 새로 시작된 어시스턴트 행이면 true(기본 false). 이어서 진행 직전까지의 행은 false. 응답 필드 `autoResumed`. V020 |
| `auto_resume_reason` | String? | `auto_resumed=true` 행에만. 현재 `stall_pending_steps` 한 가지 (V020) |
| `auto_resume_attempt` | Integer? | `auto_resumed=true` 행에만. 턴 안의 이어서 진행 순번(1부터) (V020) |
| `created_at` | Timestamp | 생성 시각 |

- `tool_calls[].result` 는 사용자가 기록에서 맥락을 다시 볼 수 있게 Shadow 검증 결과나 탐색 결과의 축약본을 담는다. 큰 원본(예: 50MB 워크플로우)은 요약으로만 남긴다.
- 저장되는 한 턴의 정상 순서는 `user` → `assistant`(`tool_calls` 포함)다. 도구 호출 왕복(`tool` × N → 최종 `assistant`)은 LLM 컨텍스트 안에서만 일어난다.
- 턴 끝에 저장하는 최종 행의 `finish_reason` 은 보통 `stop`·`tool_calls`·`error`·`aborted` 다. `aborted` 는 응답 중단 버튼 경로다. LLM 클라이언트가 돌려준 `length`·`content_filter` 도 손대지 않고 그대로 저장될 수 있다.
- 사고 토큰은 별도 컬럼 없이 `usage` JSONB 의 선택 키 `thinkingTokens` 로 둔다(이유는 [사용량을 JSONB 한 칸에 둔다](#사용량을-jsonb-한-칸에-둔다)). `usage` 키는 모두 camelCase 다. 정규화된 `thinking_tokens` 컬럼은 V018 이 사용량 로그에만 더했다([LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)).
- 인덱스: `(session_id, created_at)` 가 세션 메시지를 시간순으로 읽는 조회용이다(V019).
- 현재 구현의 `appendMessage` 는 엔티티를 만들 때 `role`·`content`·`tool_calls`·`tool_call_id`·`plan`·`usage`·`finish_reason` 만 옮겨 담는다. 그래서 `auto_resumed`·`auto_resume_reason`·`auto_resume_attempt` 는 호출부가 값을 넘겨도 늘 기본값(false·null)으로 저장되고, 세션을 다시 불러올 때 이어서 진행 구분선이 나오지 않는다.

### 삭제 연쇄

워크스페이스를 지우면 워크플로우가, 워크플로우를 지우면 어시스턴트 세션이, 세션을 지우면 어시스턴트 메시지가 지워진다. 마이그레이션에서 ON DELETE CASCADE FK 로 건다.

## 턴 저장 규칙

보통 턴은 어시스턴트 행 하나로 저장한다. 자동 이어서 진행이 일어나면 행을 나눈다. 이어서 진행의 발동 조건은 [워크플로우 AI 어시스턴트 §자동 이어서 진행](CLE-WF-ASSIST.md#자동-이어서-진행)에서 정한다.

1. 서버가 이어서 진행으로 다음 라운드를 시작하는 순간, 지금까지 쌓인 어시스턴트 텍스트와 도구 호출을 중간 행으로 먼저 저장한다. 이 행은 `finish_reason='auto_resume_pending'`, `auto_resumed=false` 다.
2. 텍스트·도구 호출 누적을 비운다. 다음 라운드는 새 행에 쌓인다.
3. `auto_resume` 이벤트를 보낸다.
4. 턴이 끝나면 최종 행을 저장한다. 이번 턴에 이어서 진행이 한 번이라도 있었으면 `auto_resumed=true`, `auto_resume_reason='stall_pending_steps'` 로 저장하고 `auto_resume_attempt` 에는 이어서 진행 횟수를 넣는다.
5. 계획은 같은 턴에서 처음 발행된 행에만 싣고 뒤이어 나뉜 행은 `plan=null` 로 저장한다.

| 경우 | 저장되는 어시스턴트 행 |
|------|------------------------|
| 이어서 진행 없음 | 1개 |
| 이어서 진행 1회 | 2개(`auto_resume_pending` 중간 행 + 최종 행). 최종 행만 `auto_resumed=true` |
| 이어서 진행 2회 | 3개. 최종 행의 `auto_resume_attempt=2` |
| `MAX_STALL_ROUNDS` 에 걸려 포기 | 마지막 행도 `auto_resumed=true` 로 저장한다. 포기 직전에는 "이어서 진행해줘." 를 넣지 않지만 행은 이미 나뉘었으므로 텍스트가 새 버블로 나뉘는 것은 같다 |

## 구현 위치

- `codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` (턴 저장, `makeResumeMeta`)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts` (`appendMessage`, 세션·메시지 CRUD)
- `codebase/backend/src/modules/workflow-assistant/entities/*.ts` (세션·메시지 엔티티)

## Rationale

### 사용량을 JSONB 한 칸에 둔다

어시스턴트 메시지의 토큰 수와 모델을 컬럼 여러 개로 나누지 않고 `usage` JSONB 하나에 담는다. 모델 프로바이더마다 사용량 키 구조가 다르기 때문이다. 사고 토큰처럼 중간에 새 필드가 생겨도(V018) 마이그레이션 없이 차차 채울 수 있다. 집계가 필요하면 정규화된 카운트를 따로 담는 [LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)의 사용량 로그를 쓴다.

### 자동 이어서 진행 때 메시지 행을 나눈다

여러 라운드의 텍스트를 행 하나에 쌓으면 gpt-oss-120b 처럼 라운드 끝마다 "계속 진행해도 될까요?" 같은 확인 문구를 되풀이하는 모델에서 같은 문구가 한 버블 안에 두세 번 겹친다. 그래서 구조로 풀었다. 서버가 이어서 진행으로 다음 라운드를 시작하는 순간 누적 텍스트를 중간 행으로 먼저 저장하고(`finishReason='auto_resume_pending'`, `makeResumeMeta(0)`) 누적을 비운 뒤 `auto_resume` 이벤트로 새 버블을 알리고 nudge 를 넣어 이어 간다([턴 저장 규칙](#턴-저장-규칙)). 메시지 엔티티의 `autoResumed`·`autoResumeReason`·`autoResumeAttempt` 세 필드는 마이그레이션 `V020__assistant_message_auto_resume.sql` 이 기본값 false·null 로 더해 기존 행과 호환한다.

- 중간 행에는 `planPersisted ? null : planForTurn` 을 넘기고 계획이 있으면 `planPersisted = true` 로 둔다. 그래서 계획은 그 턴에서 처음 저장되는 행 하나에만 실리고 뒤 행에는 null 이 들어간다.
- 턴 끝의 최종 저장에는 `makeResumeMeta(totalStallCount)`(곧 `autoResumed: totalStallCount > 0`)를 넘긴다. 누적 카운터 `totalStallCount` 는 진척이 있어도 0 으로 돌아가지 않아 "이번 턴에 이어서 진행이 한 번이라도 있었는지" 를 판정한다. 진척 때 0 으로 돌아가는 `consecutiveStallRounds` 는 루프 상한과 SSE `attempt` 에만 쓴다.
- `persistAssistantTurn` 은 마지막 파라미터로 `resumeMeta` 를 받고 기본값은 `makeResumeMeta(0)`(= `{autoResumed: false, autoResumeReason: null, autoResumeAttempt: null}`)이다. 이 메서드와 `makeResumeMeta`, 사용자 메시지 저장(`persistUserTurn`)은 `AssistantTurnPersistenceService` 가 맡는다. `totalStallCount` 는 스트림 서비스가 들고 있다가 `makeResumeMeta` 로 넘긴다. 상태 없는 협력 객체 경계를 지키기 위해서다.
- 프론트엔드는 `AssistantSseEvent` union 에 `auto_resume` 을, 표시 메시지에 `autoResume?: {reason, attempt, max}` 를 더했다. `sendMessage` 의 이벤트 콜백이 `auto_resume` 을 받으면 스트리밍 메시지 ID 를 새 UUID 로 바꾸고 새 행을 추가한다. `hydrateMessage` 는 서버의 `autoResumed=true` 행을 `autoResume` 메타로 되살린다.
- 회귀 테스트는 `stream.service.spec.ts` 의 "auto-continue on stall with pending plan" 묶음(`appendMessage` 호출 횟수로 센 행 수 N+1(이어서 진행 N회 + 최종 1개), 중간 행의 `finishReason='auto_resume_pending'`·`autoResumed=false`, 최종 행의 `autoResumed=true`·`autoResumeReason`·`autoResumeAttempt=N`, `auto_resume` 이벤트 N회와 `attempt` 1..N 증가, 첫 행에만 계획)과 `assistant-store.test.ts`(새 행 · ID 교체 · `autoResume` 메타)다.

### 유지보수 점검

- 어시스턴트 메시지에 필드를 더하면 마이그레이션 SQL 과 엔티티의 nullable·기본값을 맞춘다(`autoResumed` 기본 false, 나머지 null). `appendMessage` 가 엔티티를 만들 때 골라 담는 필드 목록에도 새 필드를 더해야 저장된다([어시스턴트 메시지](#어시스턴트-메시지)).

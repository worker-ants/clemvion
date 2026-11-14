---
id: "CLE-NODE-AGENT-OUTPUT"
title: "AI 에이전트 노드 출력과 디버그"
type: "design"
version: 7
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AI"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI"]
area: "CLE-NODE-AI"
content_hash: "64d347887af904509a5b135a0042b83af20e9aee13c7c5c53ef9032070dace84"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/3-ai/1-ai-agent.md"]
mirror_sha256: "a2a140885326b3d444a965ed58d59bf7d94a6a6b032c5b2940ba01eb9de2fa23"
etag: "sha256-261c0370091814c836705c48b9b4f18ee98c7cace8057b518f466310a2b8da0c"
---
> 구현 상태: 부분 구현 · 원문: `spec/4-nodes/3-ai/1-ai-agent.md` (§7 출력 구조, §8 디버그 데이터) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 출력 구조를 케이스별로 정한다. 단일 턴·멀티턴 종결 출력, 멀티턴 입력 대기·재개 스냅샷, 표시 도구 페이로드 운반, LLM 호출 기록(`meta.turnDebug`)이 여기에 속한다.

노드 동작(도구·조건·실행 단계)은 [AI 에이전트 노드](CLE-NODE-AGENT.md) 가 정한다. 세 AI 노드가 함께 쓰는 출력 묶음(`output.result`·`output.error`·`output.interaction`)과 토큰 회계는 [AI 노드 공통](CLE-NODE-AI-COMMON.md), 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md), 입력 대기·재개·마지막 턴 재시도의 상태 전이는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한다.

## 출력 케이스

출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 0~11 형식을 따른다. JSON 예시는 `undefined` 필드를 뺀다. 최상위 키는 5필드(`config`·`output`·`meta?`·`port?`·`status?`)만 쓴다. 예외로 `_resumeState`·`_resumeCheckpoint`·`_retryState` 는 멀티턴의 내부 전달·재개 필드라 최상위에 두지만 표현식 resolver 에는 노출하지 않는다(Principle 4.2, 4.2.1).

출력은 종결 6케이스와 멀티턴의 일시 재개 1케이스, 모두 7케이스다. 도메인 결과는 `output.result.*`, 에러는 `output.error.{code, message, details?}`, 사용자 입력 기록은 `output.interaction.{type, data, receivedAt}` 에 둔다.

| 절 | 모드 | 종결 사유 | port | status | 문서 |
|---|---|---|---|---|---|
| 단일 턴 정상 완료 | 단일 턴 | 정상 완료 | `out` | `ended` | [단일 턴](CLE-NODE-AGENT-OUTPUT-SINGLE.md) |
| 단일 턴 조건 매칭 | 단일 턴 | 조건 매칭 | `{condition.id}` | `ended` | [단일 턴](CLE-NODE-AGENT-OUTPUT-SINGLE.md) |
| 단일 턴 에러 | 단일 턴 | 오류 | `error` | `ended` | [단일 턴](CLE-NODE-AGENT-OUTPUT-SINGLE.md) |
| 멀티턴 입력 대기 | 멀티턴 | 사용자 입력 대기 | 없음 | `waiting_for_input` | [멀티턴](CLE-NODE-AGENT-OUTPUT-MULTI.md) |
| 멀티턴 재개 | 멀티턴 | 사용자 메시지 수신(일시) | 없음 | `resumed` | [멀티턴](CLE-NODE-AGENT-OUTPUT-MULTI.md) |
| 멀티턴 조건 매칭 | 멀티턴 | 조건 매칭 | `{condition.id}` | `ended` | [멀티턴](CLE-NODE-AGENT-OUTPUT-MULTI.md) |
| 멀티턴 사용자 종료 | 멀티턴 | 사용자 종료 | `user_ended` | `ended` | [멀티턴](CLE-NODE-AGENT-OUTPUT-MULTI.md) |
| 멀티턴 최대 턴 도달 | 멀티턴 | 최대 턴 도달 | `max_turns` | `ended` | [멀티턴](CLE-NODE-AGENT-OUTPUT-MULTI.md) |
| 멀티턴 에러 | 멀티턴 | 오류 | `error` | `ended` | [멀티턴](CLE-NODE-AGENT-OUTPUT-MULTI.md) |
| 표시물 페이로드 운반 | 둘 다 | 표시 도구 페이로드(공통) | 없음 | 없음 | [표시물과 LLM 호출 기록](CLE-NODE-AGENT-OUTPUT-DEBUG.md) |

## 종료 사유 값

종료 사유(`endReason`) 값 목록의 단일 기준은 패키지 [`@workflow/ai-end-reason`](../CLE-IX/CLE-IX-TYPES.md) 의 `AiAgentEndReason` 이다. 이 문서는 각 값의 뜻과 포트 매핑을 정하고, 값 목록 자체는 패키지가 정한다. 정보 추출기와 값 목록이 다른 것은 의도다(정보 추출기에는 `condition` 이 없다). 자세한 규칙은 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) 에 있다.

패키지 값은 멀티턴 종결 4값(`user_ended`·`max_turns`·`condition`·`error`)이다. 단일 턴 정상 완료의 `endReason: "out"` 은 일부러 패키지 밖에 둔다. 백엔드가 유니온으로 선언한 적 없이 그 자리에서 추론할 뿐이고, 단일 턴 정상 완료에는 `result.messages` 가 없어 대화 판정 대상이 아니다(대화 UI 게이트가 `messages` 부재로 먼저 거른다). `'out'` 이 `AiAgentEndReason` 에 없는 것은 누락이 아니므로 더하지 않는다(유니온 분기 결정).

## 설정 에코 정책

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 7 에 따라 모든 종결 시점(`out`·`{condition.id}`·`user_ended`·`max_turns`·`error`)과 멀티턴 입력 대기·재개 시점에 `output.config` 는 사용자가 입력한 원본 값(템플릿 `{{ ... }}` 보존)을 에코한다. 엔진이 dispatch 직전 평가한 값이 아니다.

- 멀티턴 후속 턴도 `state.rawConfig` 로 같은 원본을 에코한다. 고정 범위는 한 턴 처리다. 매 턴 재개(rehydration) 때 엔진이 현재 `node.config` 에서 새로 유도해 다시 고정한다(D3 fresh-per-turn). park 중 워크플로우를 고치면 다음 턴부터 반영된다([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)).
- 후속 노드의 `$node["X"].config.{mode, model, systemPrompt, userPrompt, maxTurns, maxToolCalls, knowledgeBases, conditions, responseFormat, includeSystemContext?, systemContextSections?, memoryStrategy?, memoryTokenBudget?, memoryKey?, memoryTopK?, memoryThreshold?, memoryTtlDays?, embeddingModelConfigId?, summaryModelConfigId?, extractionModelConfigId?}` 는 노드 수명 내내 원본 값을 본다.
- `includeSystemContext`·`systemContextSections` 와 메모리 필드(`memoryStrategy`·`memoryTokenBudget`·`memoryKey`·`memoryTopK`·`memoryThreshold`·`memoryTtlDays`·`embeddingModelConfigId`·`summaryModelConfigId`·`extractionModelConfigId`)는 기본값이나 미설정과 같으면 에코에서 뺀다. 사용자가 명시적으로 바꾼 경우에만 나온다([AI 노드 공통](CLE-NODE-AI-COMMON.md) 과 같은 패턴).
- 멀티턴 종결·조건 출력의 `config.model` 도 `rawConfig.model` 이 템플릿이면 그대로 에코한다. 평가한 모델 ID 는 `meta.model` 에서 읽는다.
- 자격 증명(`llmConfigId` 가 가리키는 provider secret 등)은 에코를 조립할 때 애초에 넣지 않는다. 위 필드 목록이 곧 허용 목록이고 `llmConfigId` 는 거기 없다(`assembleSingleTurnConfigEcho`·`buildMultiTurnConfigEcho` 양쪽 실측 0건). 마스킹과는 무관하다.

## 하위 문서

- [AI 에이전트 노드 출력 — 단일 턴](CLE-NODE-AGENT-OUTPUT-SINGLE.md) — 단일 턴 정상 완료(`out`) · 조건 매칭 · 에러 출력의 예시와 필드 표. 요구사항 번호: 없음
- [AI 에이전트 노드 출력 — 멀티턴](CLE-NODE-AGENT-OUTPUT-MULTI.md) — 멀티턴 입력 대기 · 재개 스냅샷 · 조건 매칭 · 사용자 종료 · 최대 턴 도달 · 에러 출력, 세 내부 필드(`_resumeState`·`_resumeCheckpoint`·`_retryState`)의 수명 주기, 마지막 턴 재시도. 요구사항 번호: 없음
- [AI 에이전트 노드 출력 — 표시물과 LLM 호출 기록](CLE-NODE-AGENT-OUTPUT-DEBUG.md) — 표시 도구 페이로드 운반(`PresentationPayload` 단일 기준)과 턴별 LLM 호출 기록(`meta.turnDebug`). 요구사항 번호: 없음

## 표시물 페이로드 운반

이 절은 다른 문서가 가리키는 앵커를 유지하려고 남긴다. 내용은 [표시물과 LLM 호출 기록 §표시물 페이로드 운반](CLE-NODE-AGENT-OUTPUT-DEBUG.md#표시물-페이로드-운반) 에 있다.

## 구현 위치

- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (설정 에코, 단일 턴 출력(정상 · 조건 · 에러), 멀티턴 입력 대기와 종결 출력, 표시물 페이로드 운반, `meta.turnDebug`)
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (멀티턴 사용자 종료와 최대 턴 도달의 진입점)
- `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` (조건 매칭의 `condition.reason`)
- `codebase/backend/src/nodes/ai/shared/llm-error-payload.ts` (단일 턴 에러 출력의 LLM 에러 분류. 멀티턴 재개와 공유)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (멀티턴 에러와 재개 경로, 재개 스냅샷 싣기 · 저장)
- `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts` (`buildAiResumedSnapshot`, 재개 스냅샷 형식)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (마지막 턴 재시도)
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (재개 체크포인트와 재시도 상태 필드)
- `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` (표시물 페이로드 타입)
- `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (LLM 호출 기록 타입)
- `codebase/frontend/src/components/editor/run-results/llm-call-trace.ts` (실행 결과 화면의 LLM 호출 기록 표시)
- `codebase/frontend/src/components/editor/run-results/output-shape.ts` (턴별 디버그 데이터 정규화)

## Rationale

### 대화 상태를 `output.result.*` 한 경로로 모은 이유 (D6)

입력 대기·재개의 `messages`·`message`·`turnCount` 를 종결 시점(`output.result.*`)과 한 경로로 통일했다. 옛 최상위 `output.messages`·`output.message`·`output.turnCount` 는 폐기했다. 다운스트림 표현식은 `$node["X"].output.result.messages` 처럼 한 경로로 접근한다. `maxTurns` 는 정적 설정이라 출력에 에코하지 않고 `config.maxTurns` 로만 노출한다(진행률 분모는 화면이 설정에서 읽는다). 사용자 입력 기록은 뜻을 나눠 `output.interaction.*` 에 둔다.

### 자격 증명을 허용 목록으로 배제하는 이유

설정 에코와 세 내부 필드(`_resumeState`·`_resumeCheckpoint`·`_retryState`)는 옮길 키를 열거하는 허용 목록 방식으로 자격 증명을 애초에 뺀다. `adaptHandlerReturn` 경계의 자동 마스킹(`maskSensitiveFields`)은 2026-08-24 에 제거됐으므로([실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)) 배제는 허용 목록이 보장한다. `turnDebug` 의 자격 증명 마스킹은 나가는 응답(REST·WS) 단계에서 한다.

### AI 대화 경로도 재개 스냅샷을 낸다 (2026-11-12)

대화 턴 경로도 `resumed` 스냅샷을 내고 노드 실행 행에 저장한다(사람 결정). 근거는 [AI 에이전트 노드 출력 — 멀티턴 §Rationale](CLE-NODE-AGENT-OUTPUT-MULTI.md#rationale) 에 있다.

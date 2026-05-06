# AI Agent — 도구 연결 입력 경로 재작성

## 배경

AI 에이전트 노드의 "도구 연결" 입력 경로(과거 `toolNodeIds`, `toolOverrides` 두 config 필드 + 캔버스 Tool Area UX) 는 추후 전면 재설계·재작성 예정이다. 그동안 사용자가 새로 설정해도 어차피 폐기될 데이터이고, 잘못된 멘탈 모델을 형성할 위험이 있어, 두 필드를 **config 스키마에서 제거**한 상태다.

이 plan 문서는 제거된 영역을 추적하고 재작성 시 누락이 없도록 하기 위한 체크리스트다.

## 제거 범위

- **Backend schema** — `toolNodeIds`, `toolOverrides` 필드 + `toolOverrideSchema` 정의 제거 (`backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`)
- **Backend handler** — multi-turn state init / `buildTools` / `turnConfig` 의 두 필드 참조 제거. dead helper `toolName()` 제거 (`backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`)
- **Backend tests** — 일반 도구 의존 케이스 3건 삭제 (`should handle external (tool_node) tool calling loop` / `should use tool_ prefix with sanitized nodeId` / `should execute normal tools first when condition + normal tools ...`)
- **Spec** — §Tool Area 연동·일반 도구 이름 규칙(`tool_*`)·`ToolOverride` 구조에 "재작성 예정 (현재 제거됨)" 박스
- **PRD** — `ND-AG-06`, `ND-AG-10`, `ND-AG-21` 에 "재작성 예정 (현재 제거됨)" 라벨

## 데이터 호환성

스키마는 `aiAgentNodeConfigSchema.passthrough()` 이므로 DB 의 legacy 워크플로 데이터에 `toolNodeIds` / `toolOverrides` 키가 남아 있어도 silently 통과한다. 핸들러가 이를 읽지 않으므로 LLM 에 일반 도구가 등록되지 않고, 다음 워크플로 저장 시 자연 정리된다(저장 시 schema 가 strict-narrowing 하지는 않으나 form 에서 노출되지 않으므로 새 저장에는 두 키가 포함되지 않음).

회귀 가드 — `backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` 의 `describe('legacy passthrough: tool connection inputs', ...)` 블록이 legacy 데이터 호환을 보장한다.

## 영향 받지 않는 영역

- 조건(`conditions`, `cond_*` 도구) — `ND-AG-15~20`, `ND-AG-22`
- Knowledge Base / RAG (`kb_*` 도구)
- MCP 서버 (`mcp_*` 도구)
- AI Agent 의 그 외 모든 설정 (LLM, mode, prompts, history, 포트 구조 등)

## 재작성 시 체크리스트

새 도구 연결 디자인이 결정되면:

- [ ] 새 스키마 필드 추가 (`backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`) — 기존 두 필드 그대로 복원할지, 새 디자인에 맞춰 새 이름·구조로 정의할지 결정
- [ ] 핸들러 빌드 로직 추가 (`backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` `buildTools`) — 일반 도구 이름 규칙 (`tool_*` 유지 여부 결정) + override 적용
- [ ] multi-turn state·turnConfig 에 새 필드 전파
- [ ] 테스트 신규 작성 — 새 디자인 기준 (legacy 케이스는 git history 참조)
- [ ] `legacy passthrough: tool connection inputs` describe 블록 — 새 필드 호환성 가드로 갱신 또는 제거
- [ ] spec/PRD 의 "재작성 예정 (현재 제거됨)" 박스 + `_(제거됨 — 재작성 예정)_` 라벨 모두 제거 및 본문 갱신
- [ ] 캔버스 Tool Area UX 신규 구현 (프론트 신규 영역)
- [ ] 본 plan 문서를 `plan/complete/` 로 `git mv`

## 재작성 시 함께 검토할 backlog

ai-review 결과 중 도구 연결 재작성과 직접 맞물리는 항목들이다. 본 plan 으로 이관해 누락 방지. 자세한 상세·위치는 `review/2026-05-06_13-01-52/SUMMARY.md` + `review/2026-05-06_13-01-52/RESOLUTION.md` 참조.

- **WARN #9 (Architecture/Maintainability)** — `executeSingleTurn` (`handler.ts:492–623`) 과 `processMultiTurnMessageInner` (`handler.ts:877–1010`) 의 tool loop ~130줄 구조적 중복. 재작성 시 `runToolLoop(params)` 추출 + 정책 단일화.
- **WARN #11 (Architecture)** — `_resumeState: { ...state, ... }` 스프레드로 미지 필드 암묵 전파 (`handler.ts` 의 multi-turn resume 지점). state 타입을 명시적 interface 로 환원해야 함.
- **WARN #17 (Performance)** — `classifyToolCalls` 가 tool loop 매 이터레이션마다 `condNameToCondition` Map 재구성. `runToolLoop` 추출과 같이 가는 게 자연스러움.
- **WARN #20 (Testing)** — single_turn(미증가) vs multi_turn(증가) 의 `toolCallCount` 정책 비대칭. 카운팅 정책 자체가 재작성 시 재정립 대상.
- **INFO #5 (Requirement)** — `endReason: 'out' as const` 가 multi_turn endReason 유니온에 미포함. multi_turn 종료 사유 정합과 같이 정리.

## 미해결 설계 질문 (재작성 시 결정 필요)

- `inputMapping` DSL 의 형태 — 과거 `Array<Record<string, unknown>>` 의 정의가 모호했다. 명시적 mapping schema 또는 expression 기반 중 어느 쪽?
- Tool Area 시각 모델 — AI Agent 우측 점선 영역으로 그대로 갈지, 아니면 새 메타포 (예: 트리, 사이드 패널)?
- 일반 도구 이름 prefix `tool_*` 유지 여부 — 다른 카테고리(`cond_`, `kb_`, `mcp_`) 와의 일관성
- 조건 + 일반 도구 혼재 시나리오의 UX — LLM 재평가 루프를 그대로 둘지, 새 디자인에서 다르게 다룰지

이 질문들이 결정되어 모두 처리된 순간 본 문서를 `plan/complete/` 로 옮긴다.

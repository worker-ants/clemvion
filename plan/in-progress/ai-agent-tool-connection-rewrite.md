# AI Agent — 도구 연결 입력 경로 재작성

## 배경

AI 에이전트 노드의 "도구 연결" 입력 경로(현재 `toolNodeIds`, `toolOverrides` 두 config 필드 + 캔버스 Tool Area UX) 는 추후 전면 재설계·재작성 예정이다. 그동안 사용자가 새로 설정해도 어차피 폐기될 데이터이므로, 재작성 시점까지 **임시로 비활성(feature out)** 한다.

이 plan 문서는 feature-out 상태를 추적하고 재작성 시 복원이 누락되지 않도록 하기 위한 체크리스트다.

## 현재 비활성 범위

- AI Agent 설정 폼의 두 필드 — `toolNodeIds`, `toolOverrides` (Advanced 그룹)
- 캔버스 Tool Area UX — 시각·드래그/드롭 인터랙션 (현재 프론트엔드 미구현 상태이지만 spec 차원에서 비활성 명시)
- 일반 도구 이름 규칙 `tool_*` (도구가 등록되지 않으므로 자연 비활성)
- 영향 받는 PRD 항목: `ND-AG-06`, `ND-AG-10`, `ND-AG-21`

## 영향 받지 않는 영역

- 조건(`conditions`, `cond_*` 도구) — `ND-AG-15~20`, `ND-AG-22`
- Knowledge Base / RAG (`kb_*` 도구)
- MCP 서버 (`mcp_*` 도구)
- AI Agent 의 그 외 모든 설정 (LLM, mode, prompts, history, 포트 구조 등)

## 동결된 코드/문서 위치

### Backend
- `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` — `toolNodeIds`, `toolOverrides` 필드의 `.meta({ ui: { ..., hidden: true, hint: '...' } })`
- `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  - Multi-turn state init 지점 (대략 line 737–738) — 빈 배열 강제
  - `buildTools` 본체 (대략 line 1313–1319) — 빈 배열 강제

### Backend Tests
- `backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts`
  - `it.skip` 처리된 일반 도구 의존 케이스들 (single_turn round-trip, `buildTools - tool naming`, 조건+일반 도구 혼재)
  - 신규 `describe('feature-out: tool connection inputs', ...)` 블록 — feature-out 동작 회귀 가드

### Spec / PRD
- `spec/4-nodes/3-ai-nodes.md` — §1 상단 + §Tool Area 연동 박스
- `spec/3-workflow-editor/0-canvas.md` — §12 + §3.3 표
- `prd/6-phase2-ai.md` — §3.2 박스 + ND-AG-* 라벨
- `prd/3-node-system.md` — §6.1 박스 + ND-AG-* 라벨

## 복원 시 체크리스트

도구 연결 재설계가 결정되어 복원할 때 다음을 모두 처리한다:

- [ ] schema 의 `hidden: true` / `hint` 제거 (또는 새 디자인에 맞게 갱신)
- [ ] handler 두 지점의 강제 빈 배열 제거 — `(config.toolNodeIds as string[]) || []` 형태로 환원 (또는 새 입력 경로로 교체)
- [ ] `it.skip` 케이스 복구 / 새 입력 경로 기준으로 재작성
- [ ] 신규 `feature-out` describe 블록 제거
- [ ] spec/PRD 의 "Feature Out" 박스 + `_(feature out)_` 라벨 모두 제거
- [ ] 캔버스 Tool Area UX 신규 구현 (현재 프론트 미구현)
- [ ] 본 plan 문서를 `plan/complete/` 로 `git mv`

## 미해결 설계 질문 (재작성 시 결정 필요)

- `inputMapping` DSL 의 형태 — 현재 `Array<Record<string, unknown>>` 의 정의가 모호함. 명시적 mapping schema 또는 expression 기반?
- Tool Area 시각 모델 — AI Agent 우측 점선 영역으로 그대로 갈지, 아니면 새 메타포 (예: 트리, 사이드 패널)?
- 일반 도구 이름 prefix `tool_*` 유지 여부 — 다른 카테고리(`cond_`, `kb_`, `mcp_`) 와의 일관성
- 조건 + 일반 도구 혼재 시나리오의 UX — LLM 재평가 루프를 그대로 둘지, 새 디자인에서 다르게 다룰지

이 질문들이 결정되어 모두 처리된 순간 본 문서를 `plan/complete/` 로 옮긴다.

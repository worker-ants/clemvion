# 신규 식별자 충돌 검토 결과

검토 대상: `spec/4-nodes/3-ai` (구현 착수 전 검토 —  M-1 3단계 `AiTurnExecutor` 추출)
검토 기준 코드 커밋: `6faefe48` (refactor: M-1 3단계 — AiTurnExecutor 추출)

---

## 발견사항

### 발견사항 1
- **[INFO]** `AiTurnExecutor` 클래스명 — spec frontmatter `code:` 미등재
  - target 신규 식별자: `class AiTurnExecutor` (`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록에는 `ai-agent.handler.ts` / `tool-providers/*.ts` 등만 등재. `ai-turn-executor.ts` 미등재
  - 상세: 이는 의미 충돌이 아니라 spec frontmatter의 코드 목록 누락이다. plan `/plan/in-progress/refactor/02-architecture.md §M-1` 에 "M-1 전체 완료 시 일괄 처리 권장"으로 이미 planner 후속(비차단 SPEC-DRIFT)으로 분류됨
  - 제안: planner 후속 작업(`1-ai-agent.md` frontmatter `code:` 에 `ai-turn-executor.ts`·`ai-condition-evaluator.ts`·`ai-memory-manager.ts` 등재)은 M-1 3단계 완료 선행 계획에 이미 포함되어 있음. 현 단계에서 차단 사안 아님

### 발견사항 2
- **[INFO]** `ToolCallTrace` vs `PresentationCallTrace` — 유사 이름의 별개 trace 인터페이스
  - target 신규 식별자: `export interface ToolCallTrace` (`ai-turn-executor.ts:59`)
  - 기존 사용처: `export interface PresentationCallTrace` (`tool-providers/agent-tool-provider.interface.ts:168`)
  - 상세: 두 인터페이스는 **다른 의미**를 담는다. `PresentationCallTrace` 는 `render_*` 도구의 presentation 렌더 결과(`status: 'rendered' | 'schema_violation' | 'dropped' | 'form_pending'`)를 기록하는 반면, `ToolCallTrace` 는 provider tool(KB·MCP) 호출의 실행 메트릭(`status: 'success' | 'error'`, `durationMs`)을 `meta.turnDebug[].toolCalls`에 누적하는 용도다. 두 인터페이스가 같은 파일이나 같은 export scope에 있지 않아 직접 충돌은 없으나, 이름이 유사하여 읽는 사람에게 역할 혼동을 줄 수 있다
  - 제안: `PresentationCallTrace` 와의 명확한 구분을 위해 JSDoc에 "provider tool(KB·MCP) 전용 — `render_*` 의 `PresentationCallTrace` 와 구별" 을 명시하는 것이 권장되나 기능 충돌이 없어 비차단

### 발견사항 3
- **[INFO]** `FORM_SUBMITTED_GUIDANCE_MESSAGE` / `FORM_SUBMITTED_MAX_BYTES` — 이동 후 re-export
  - target 신규 식별자: `export const FORM_SUBMITTED_GUIDANCE_MESSAGE`, `export const FORM_SUBMITTED_MAX_BYTES` (신규 위치: `ai-turn-executor.ts:241, 258`)
  - 기존 사용처: 이전에는 `ai-agent.handler.ts` 에 정의되어 있었으며, 현재는 `ai-agent.handler.ts` 가 이를 `ai-turn-executor.ts` 에서 re-export함. `spec/4-nodes/3-ai/1-ai-agent.md §12.7` 이 `FORM_SUBMITTED_MAX_BYTES` 를 직접 참조
  - 상세: re-export 패턴으로 기존 import 경로(`./ai-agent.handler`)를 유지해 하위 호환성 보존. `ai-agent.handler.ts:21-24` 에 re-export 명시됨. 의미·값 불변. 충돌 없음
  - 제안: 없음. 적절한 이전 패턴

---

## 요약

M-1 3단계(`AiTurnExecutor` 추출)가 도입하는 신규 식별자들은 기존 영역과 실질적 충돌이 없다. `AiTurnExecutor` / `ToolCallTrace` / `capFormDataBytes` / `RagDiagnostics`(private) / `RagAccumulator`(private) 는 코드베이스 전체에서 동일 이름의 선행 정의가 없으며, `FORM_SUBMITTED_*` 상수는 handler에서 이동 후 re-export로 하위 호환성을 보존한다. `AI_RETRY_STATE_TTL_MINUTES` 환경변수는 `spec/5-system/4-execution-engine.md` 와 `spec/5-system/6-websocket-protocol.md` 에 이미 명시된 기존 식별자이므로 새로 도입되는 것이 아니다. `ai-turn-executor.ts` 파일명은 동일 디렉토리의 `ai-condition-evaluator.ts`·`ai-memory-manager.ts` 선례와 일관된 명명 컨벤션을 따른다. 비차단 INFO 2건(spec frontmatter 코드 목록 누락·유사 trace 인터페이스 명 혼동 가능성)은 모두 plan에 이미 기록된 planner 후속 사안이다.

## 위험도

NONE

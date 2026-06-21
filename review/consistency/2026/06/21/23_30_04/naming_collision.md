# 신규 식별자 충돌 검토 결과

검토 대상: `spec/4-nodes/3-ai` — 구현 완료 후 검토 (M-1 3단계 `AiTurnExecutor` 추출, diff-base=origin/main)

변경 파일:
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (신규)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` (신규)
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (변경 — 대부분 제거·위임)

---

## 발견사항

### 발견사항 1
- **[WARNING]** `AiTurnExecutor` vs `AiTurnOrchestrator` — 유사 명칭의 별개 레이어 클래스
  - target 신규 식별자: `export class AiTurnExecutor` (`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:512`)
  - 기존 사용처: `export class AiTurnOrchestrator` (`codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:73`) — spec 여러 곳에 명시 (`spec/5-system/4-execution-engine.md §1.3·§Rationale`, `spec/conventions/interaction-type-registry.md §46~47`, `spec/4-nodes/3-ai/1-ai-agent.md §10.1` 등)
  - 상세: 두 클래스는 **레이어·책임·라이프사이클이 다르다**. `AiTurnOrchestrator`는 NestJS `@Injectable()` 서비스로 execution-engine 레이어에서 AI 멀티턴 생명주기(park·resume·finalize)를 관장한다. `AiTurnExecutor`는 non-Injectable 무상태 collaborator로 nodes/ai/ai-agent 레이어에서 단일 LLM 호출 턴(tool 실행·메시지 조립·출력 구성)을 실행한다. 직접 이름 충돌은 없으나 `AiTurn*` 접두어를 공유하므로, spec·code를 처음 읽는 사람이 두 클래스의 레이어 경계와 책임 범위를 혼동할 여지가 있다. plan `02-architecture.md §M-1`은 `AiTurnExecutor` 명칭을 확정 계획으로 명시해뒀으므로 의도적 명명이다.
  - 제안: 실질 충돌이 아닌 가독성 사안. 각 파일 상단 JSDoc에 "본 클래스는 nodes 레이어 내부 협력자이며 execution-engine 레이어의 `AiTurnOrchestrator`(서비스, 멀티턴 lifecycle)와 다른 책임이다" 라는 단 한 줄 주석을 추가하면 혼동 방지에 충분하다. 현재 `ai-agent.handler.ts:187` 주석에 `ai-turn-orchestrator` 참조가 이미 있어 컨텍스트 파악은 가능하다. 기능 차단 사안은 아님.

### 발견사항 2
- **[INFO]** `interface RagDiagnostics` — backend 비공개 재정의 vs frontend 공개 export 형상 차이
  - target 신규 식별자: `interface RagDiagnostics` (`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:113`, 비공개 — `export` 없음)
  - 기존 사용처: `export interface RagDiagnostics` (`codebase/frontend/src/components/editor/run-results/output-shape.ts:331`, 공개 export)
  - 상세: 이 두 정의는 M-1 3단계가 도입한 것이 아니다. `RagDiagnostics`는 origin/main의 `ai-agent.handler.ts:116`에도 동일 비공개 인터페이스로 존재했고, frontend에도 origin/main 시점부터 별도 정의가 있었다. M-1 3단계는 backend 정의를 `ai-agent.handler.ts → ai-turn-executor.ts`로 **이동**했을 뿐이다. 두 정의 사이의 형상 차이(`skipReason` frontend 판에는 `"empty_user_prompt"` 포함, backend 판에는 없음; backend 판에는 `rerank?` 필드 추가)는 선행 상태이며 본 단계의 변경 범위 밖이다.
  - 제안: 선행 drift — 본 PR 범위 밖. 별도 spec-coverage 또는 consistency 후속 사안으로 추적.

### 발견사항 3
- **[INFO]** `export interface ToolCallTrace` — 이동 후 re-export 미제공
  - target 신규 식별자: `export interface ToolCallTrace` (`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:59`)
  - 기존 사용처: origin/main의 `ai-agent.handler.ts:62`에 동일 식별자로 export됐으나 `ai-agent.handler.ts`에서 re-export 없이 제거됨
  - 상세: `FORM_SUBMITTED_GUIDANCE_MESSAGE`/`FORM_SUBMITTED_MAX_BYTES`/`capFormDataBytes`는 handler에서 이동 또는 re-export되지만, `ToolCallTrace`는 re-export가 없다. 현재 codebase 전체에서 `ai-agent.handler.ts`로부터 `ToolCallTrace`를 import하는 외부 소비자가 없으므로(grep 결과 0건) 런타임·컴파일 파손이 없다. 그러나 공개 타입의 이동 후 re-export 미제공은 추후 외부 소비 시 breaking change 가능성을 남긴다.
  - 제안: `ToolCallTrace`가 실제로 handler 외부에서 소비되지 않으므로 현재 차단 사안 아님. 향후 외부(e.g., WS 진단 모듈)에서 이 타입이 필요해질 경우 `ai-agent.handler.ts` re-export 또는 `ai-turn-executor.ts` 직접 import 경로를 명시해두면 충분.

### 발견사항 4
- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` — `ai-turn-executor.ts` 미등재
  - target 신규 식별자: 파일 경로 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (신규 파일)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록에는 `ai-agent.handler.ts` / `tool-providers/*.ts` / `ai-turn-orchestrator.service.ts` 등만 등재
  - 상세: 이는 의미 충돌이 아닌 spec frontmatter 코드 목록 누락이다. plan `02-architecture.md §M-1 §130`에 "M-1 전체 완료 시 일괄 처리 권장"으로 planner 후속(비차단 SPEC-DRIFT)으로 이미 분류됐다. M-1 1단계(`ai-condition-evaluator.ts`)·2단계(`ai-memory-manager.ts`)도 동일 패턴으로 frontmatter 미갱신 상태로 PR됐고 BLOCK:NO 판정을 받았다.
  - 제안: planner 후속. `1-ai-agent.md` frontmatter `code:`에 `ai-turn-executor.ts` 등재는 M-1 완료 시 일괄 처리.

---

## 요약

M-1 3단계(`AiTurnExecutor` 추출)가 도입하는 신규 식별자들은 기존 영역과 실질적 의미 충돌이 없다. `AiTurnExecutor` / `ToolCallTrace` / `capFormDataBytes` / `FORM_SUBMITTED_*` / `RagAccumulator` / `RagAccumulatorGroup` 는 모두 origin/main의 `ai-agent.handler.ts`에 이미 존재하던 동일 식별자의 **이동**이며, 새 의미로 재정의되지 않았다. `FORM_SUBMITTED_GUIDANCE_MESSAGE`·`FORM_SUBMITTED_MAX_BYTES`는 handler re-export로 하위 호환성을 보존한다. `AiTurnExecutor` vs `AiTurnOrchestrator` 는 레이어·책임이 명확히 다른 의도적 명명으로 기능 충돌은 없으나 `AiTurn*` 접두어 공유로 가독성 혼동 가능성이 있어 WARNING으로 기록한다. `RagDiagnostics` 형상 차이는 본 단계 이전부터 존재한 선행 사안이다.

## 위험도

LOW

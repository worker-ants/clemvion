# 신규 식별자 충돌 Check — 결과

검토 모드: --impl-done, scope=spec/4-nodes/3-ai, diff-base=origin/main

## 검토 대상

M-1 1단계 커밋(`ff72c57d`) — `AiConditionEvaluator` 추출:

- 신규 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`
- 신규 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.spec.ts`
- 변경 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`

---

## 발견사항

### [INFO] spec §6.1 구현 참조가 핸들러 메서드를 명시 — 이동 후 stale

- target 신규 식별자: `AiConditionEvaluator.classifyToolCalls` (새 파일 `ai-condition-evaluator.ts` 소재)
- 기존 사용처: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 3.a — `"(구현: ai-agent.handler.ts classifyToolCalls)"`
- 상세: spec 본문이 구현 위치를 `ai-agent.handler.ts` 의 private 메서드 `classifyToolCalls` 로 못박고 있다. 리팩터 후 해당 로직은 `AiConditionEvaluator.classifyToolCalls` 로 이동하였고, 핸들러에는 동명 메서드가 더 이상 존재하지 않는다. spec 참조가 stale 상태이나 행위·명세 자체의 변경은 없다.
- 제안: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 3.a 의 구현 괄호 주석을 `"(구현: ai-agent.handler.ts → AiConditionEvaluator.classifyToolCalls)"` 또는 `"(구현: ai-condition-evaluator.ts AiConditionEvaluator)"` 로 갱신 (planner 위임). plan §M-1 의 "spec 갱신: 불요" 노트는 행위·계약 변경이 없어 타당하나 구현 파일 참조 주석 한 줄은 precision 보완 대상.

---

### [INFO] ConditionDef — 기존 private interface 를 export 로 승격

- target 신규 식별자: `export interface ConditionDef` (`ai-condition-evaluator.ts:12`)
- 기존 사용처: `ai-agent.handler.ts:155` (origin/main) — 동일 이름의 `interface ConditionDef` 가 `private` (파일 내부, non-export) 로 존재했다. 현재 워크트리 핸들러에서는 제거 후 `ai-condition-evaluator.ts` 로부터 import 중.
- 상세: 이름 자체는 동일하나 기존에는 파일 내부 한정이었고 신규에는 module-public export 로 승격되었다. 의미는 동일(AI Agent 조건 정의 구조). 외부 모듈에서 동일 이름으로 다른 의미의 `ConditionDef` 가 존재하는지 전수 조사 결과 없음 — 충돌 없음.
- 제안: 해당 없음 (동일 의미 이전).

---

### [INFO] ConditionClassification — 기존 private interface 를 export 로 승격

- target 신규 식별자: `export interface ConditionClassification` (`ai-condition-evaluator.ts:23`)
- 기존 사용처: `ai-agent.handler.ts:178` (origin/main) — 동일 이름의 `interface ConditionClassification` 이 파일 내부 한정으로 존재했다.
- 상세: 위 ConditionDef 와 동일 패턴. 코드베이스 전수 조사 결과 동명 타입 없음. 충돌 없음.
- 제안: 해당 없음.

---

### [INFO] condToolName — 기존 private 함수를 export 로 승격

- target 신규 식별자: `export function condToolName` (`ai-condition-evaluator.ts:43`)
- 기존 사용처: `ai-agent.handler.ts:191` (origin/main) — `function condToolName` 이 파일 내부 한정으로 존재했다. 워크트리 핸들러는 import 로 전환.
- 상세: 이름 동일, 의미 동일 (조건 ID → `cond_` 접두사 LLM 도구명 생성). 코드베이스 전수 조사 결과 다른 모듈에 동명 함수 없음. 충돌 없음.
- 제안: 해당 없음.

---

### [INFO] 파일명 패턴 — `ai-condition-evaluator.ts`

- target 신규 식별자: 파일 경로 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`
- 기존 사용처: 해당 경로에 기존 파일 없음. 같은 디렉토리 내 `ai-agent.handler.ts` / `ai-agent.schema.ts` / `ai-agent.component.ts` 의 `ai-agent.*` 패턴과 일관하지 않는 `ai-` prefix 사용이지만, plan §M-1 "배치는 `nodes/ai/ai-agent/` 하위" 가 명시적 설계로 공식화됨.
- 상세: `ai-condition-evaluator` 이름은 기존 `condition-evaluator.util.ts` (`nodes/core/`) 및 `condition-eval.util.ts` (`nodes/logic/_shared/`) 와 혼동 가능 여부를 점검: 두 파일은 일반 조건(field + operator + value) 평가를 담당하며 AI Agent 의 LLM 조건 도구와 의미가 다르다. 파일명 prefix `ai-` 가 구별자 역할을 하므로 독자에게 혼동은 낮다.
- 제안: 현행 유지 적합. 단, `ai-agent.handler.ts` 의 동반 파일 패턴(`ai-agent.*`)과의 일관성을 위해 `ai-agent-condition-evaluator.ts` 로의 이름 변경을 선택적으로 검토할 수 있으나, 기능 범위와 파일명의 의미 일치도(`ai-condition-evaluator`) 가 충분히 명확해 강제 변경 대상은 아님.

---

### [INFO] `Condition` (core) vs `ConditionDef` (AI Agent) — 동종 의미 아님

- target 신규 식별자: `export interface ConditionDef` (`ai-condition-evaluator.ts`)
- 기존 사용처: `codebase/backend/src/nodes/core/condition-evaluator.util.ts:128` — `export interface Condition { field, operator, value? }` (논리 노드 계열의 필드 비교 조건)
- 상세: 이름은 다르고(`ConditionDef` vs `Condition`) 의미도 명확히 다르다(AI LLM 도구 포트 vs 값 비교 조건). 충돌 없음. 다만 "condition" 개념을 다루는 두 계통이 co-exist 함을 기록.
- 제안: 해당 없음 — 기존 패턴 유지.

---

### [INFO] 요구사항 ID — M-1 식별자

- target 신규 식별자: plan 참조 ID `M-1` (`plan/in-progress/refactor/02-architecture.md §M-1`)
- 기존 사용처: spec 본문에 `M-1` 로 시작하는 다른 의미의 요구사항 ID 없음 (전수 grep 결과). plan 파일 내에서만 사용되는 내부 refactor 항목 번호.
- 상세: 충돌 없음.
- 제안: 해당 없음.

---

## 요약

M-1 1단계 커밋이 도입하는 신규 공개 식별자(`AiConditionEvaluator`, `ConditionDef`, `ConditionClassification`, `condToolName`, 파일 `ai-condition-evaluator.ts`)는 기존 코드베이스 어디에서도 다른 의미로 사용 중이지 않다. 기존에 핸들러 파일 내부에 동명으로 존재하던 세 identifier(`ConditionDef`, `ConditionClassification`, `condToolName`)는 동일 의미 그대로 새 파일로 이전·export 승격된 것이므로 의미 충돌이 아닌 범위 확장이다. 단 `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 3.a 에 구현 위치 참조 `"ai-agent.handler.ts classifyToolCalls"` 가 stale 상태로 남아 있어 INFO 수준의 문서 일관성 보완이 필요하다.

## 위험도

LOW

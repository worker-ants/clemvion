# 신규 식별자 충돌 검토

## 발견사항

### [WARNING] `ConditionDef` 인터페이스명 — 기존 `Condition` 인터페이스와 도메인 혼동 가능성

- **target 신규 식별자**: `ConditionDef` — `/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` line 12
- **기존 사용처**: `Condition` 인터페이스 — `/codebase/backend/src/nodes/core/condition-evaluator.util.ts` line 128 (if-else / switch / filter / transform 공통 조건 평가에 사용)
- **상세**: 두 인터페이스는 완전히 다른 의미다. 기존 `Condition`은 `{field, operator, value}` 구조(데이터 비교 술어)이고, 신규 `ConditionDef`는 `{id, label, prompt}` 구조(AI Agent 가 LLM 도구로 변환하는 대화 분기 조건)다. 파일명도 동일한 어근 `condition-evaluator`를 사용한다 — `nodes/core/condition-evaluator.util.ts` (논리 노드용)와 `nodes/ai/ai-agent/ai-condition-evaluator.ts` (AI Agent용). 폴더 계층이 다르므로 런타임 충돌은 없으나, 새 코드를 읽는 개발자가 두 파일을 혼동하거나 잘못 임포트할 수 있다.
- **제안**: 현재 `ConditionDef` 명은 spec(`1-ai-agent.md §1 ConditionDef 구조` 표)과 일치하므로 변경보다는 파일 헤더 JSDoc에 "논리 노드의 `core/condition-evaluator.util.ts` 의 `Condition` 인터페이스(필드·연산자·값 술어)와 별개" 임을 명시하는 방향이 적절하다. 파일명은 `nodes/ai/ai-agent/` 하위이므로 `nodes/core/condition-evaluator.util.ts`와 경로가 분리되어 있어 IDE 자동완성 혼동은 낮다. 조치 불필요하나 인지 권장.

---

### [INFO] `ai-condition-evaluator.ts` 파일 경로 — spec `1-ai-agent.md` frontmatter `code:` 미등재

- **target 신규 식별자**: 파일 경로 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록 (line 4~13) — `ai-agent.handler.ts`, `ai-agent.schema.ts`, `ai-agent.component.ts`, `tool-providers/*.ts` 등 등재, 신규 파일 없음
- **상세**: plan `02-architecture.md` line 129가 "planner 후속(비차단 SPEC-DRIFT): `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` 등재"를 명시하고 있다. 이 작업이 완료되지 않은 상태다. spec-impl coverage 추적 관점에서 누락.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록에 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 를 추가한다. plan이 비차단으로 분류했으므로 이번 PR에 포함하지 않아도 되나, 별도 planner 작업으로 처리 필요.

---

### [INFO] `CONDITION_REASON_MAX_CHARS` 상수 — 기존 유사 cap 상수와 명명 패턴 일관성

- **target 신규 식별자**: `CONDITION_REASON_MAX_CHARS = 500` — `/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` line 35
- **기존 사용처**: `/codebase/backend/src/nodes/core/condition-evaluator.util.ts` line 45 의 `MAX_REGEX_LENGTH = 200`; handler 레이어의 `TOOL_RESULT_PREVIEW_CHARS` (파일 내 주석에서 언급 line 33~34)
- **상세**: 신규 상수는 동일 도메인의 다른 cap 상수들과 명명 패턴이 다르다 (`MAX_*` 접두사 vs `*_MAX_CHARS` 접미사). 충돌은 아니고 패턴 비일관성이다. 파일 범위가 `ai-condition-evaluator.ts`에 한정되어 영향 범위가 좁다.
- **제안**: 현재 명으로도 의미가 명확하여 변경 불필요. INFO 수준 참고 사항.

---

## 요약

target이 도입하는 신규 식별자(`AiConditionEvaluator`, `ConditionDef`, `ConditionClassification`, `CONDITION_REASON_MAX_CHARS`, `condToolName`, 파일 `ai-condition-evaluator.ts`)는 기존 식별자와 의미 충돌이 없다. 단, 기존 `nodes/core/condition-evaluator.util.ts`에 동일 어근 파일명과 유사 어근 인터페이스(`Condition`)가 존재하여 개발자 혼동 가능성이 있으나, 폴더 계층이 명확히 분리(`nodes/core/` vs `nodes/ai/ai-agent/`)되어 있고 두 인터페이스의 구조가 완전히 달라 런타임 또는 타입 충돌은 없다. spec `ConditionDef` 명을 그대로 채택한 것은 spec 정합성 측면에서 올바른 선택이다. 나머지 발견은 spec frontmatter 미등재(비차단 플래너 후속 과제)와 상수 명명 패턴 비일관성(INFO)뿐이다.

## 위험도

LOW

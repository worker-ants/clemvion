# Convention Compliance Review

**Target**: `spec/4-nodes/3-ai` (0-common.md, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md, _product-overview.md)
**Mode**: impl-done (diff-base=origin/main)
**Reviewer**: convention_compliance sub-agent

---

## 발견사항

### 1. [WARNING] `1-ai-agent.md` frontmatter `code:` 에 `ai-memory-manager.ts` 미등재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 배열
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 본 spec 이 약속한 surface 의 구현 경로를 열거해야 하며, `status: partial` 의 경우 `pending_plans:` 의무 + `code:` ≥1 매치 의무
- **상세**: 현재 브랜치(M-1 2단계)에서 `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 가 신규 추출됐다. 이 파일은 AI Agent 의 메모리 관리 로직(summary_buffer / persistent 전략, 롤링 요약 압축, persistent 회수/추출)을 담당하는 핵심 구현체로, spec `1-ai-agent.md §6.1 단계 1.3 / 1.5 / 2.7` 및 `memoryStrategy` 필드 전체가 의존한다. 그러나 `1-ai-agent.md` 의 `code:` 는 `ai-agent.handler.ts` / `ai-agent.schema.ts` / `ai-agent.component.ts` / `tool-providers/*.ts` / `agent-memory-injection.ts` / `agent-memory-schema.ts` / `execution-engine.service.ts` / `ai-turn-orchestrator.service.ts` / `llm-call-record.ts` 만 열거하고 있으며, 추출된 `ai-memory-manager.ts` 가 누락됐다. `spec-code-paths.test.ts` 는 glob 매칭이므로 현재도 통과하겠지만, 단일 진실 원칙 측면에서 spec 의 `code:` 가 실제 구현 모듈 목록과 어긋난다.
- **제안**: `1-ai-agent.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 추가.

---

### 2. [WARNING] `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` 미등재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 배열
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 본 spec 이 약속한 surface 의 구현 경로를 열거
- **상세**: M-1 1단계(PR #665)에서 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 가 추출됐다. 이 파일은 spec `1-ai-agent.md §5 (조건)` / `§6.1 단계 3 (tool 분류 로직)` / `§5.2` 의 조건 도구 감지·처리 로직의 단일 진실 구현체다. `1-ai-agent.md` frontmatter `code:` 에 미등재 상태다.
- **제안**: `1-ai-agent.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 추가.

---

### 3. [INFO] `0-common.md` frontmatter `id` 가 basename 과 불일치

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` frontmatter `id: common`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id` 는 "파일 basename(확장자 제외) 기반 권장". 단, 같은 basename 중복 회피를 위한 예외 허용
- **상세**: 파일명은 `0-common.md` 이지만 frontmatter `id` 는 `common` (숫자 prefix 제거). `spec-impl-evidence.md §2.1` 은 "파일 basename 기반 권장" 으로 명시하나 강제가 아니다. `0-overview.md` 는 `EXCLUDE_BASENAMES` 면제이며 인덱스 성격이므로 `0-common.md` 는 가드 대상이다. `id: common` 자체는 다른 영역에 동일 basename 충돌 없는 한 규칙 위반이 아니나, basename 과의 거리감이 있어 INFO 수준으로 기록한다. 가드(`spec-frontmatter.test.ts`)는 `id` 의 kebab-case 여부만 검증하므로 빌드 차단은 없음.
- **제안**: 현행 `id: common` 유지 가능. 단, 다른 영역에 동명 `id: common` 이 추후 생기면 충돌이 발생하므로 `id: ai-common` 으로 변경 고려.

---

### 4. [INFO] `_product-overview.md` 에 `## Rationale` 섹션 없음

- **target 위치**: `spec/4-nodes/3-ai/_product-overview.md`
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고"
- **상세**: `_product-overview.md` 는 밑줄 prefix 로 `spec-impl-evidence.md §1` 의 frontmatter 가드 면제 대상이며 PRD 성격의 overview 문서다. CLAUDE.md 는 3섹션 권장 사항을 "각 SKILL.md 참고" 로 위임하고 있고, PRD 성격의 진입 문서에는 Rationale 이 없는 경우가 많다. 실질적 규약 위반이 아닌 형식 제안 수준이다.
- **제안**: 현행 유지 가능. 필요 시 주요 제품 결정 배경을 `## Rationale` 로 추가.

---

### 5. [INFO] `1-ai-agent.md` — `output.error.details.retryable` 를 에러 섹션(§7.3 / §7.9)에서 상세 정의하나 `0-common.md §5` 의 공통 wrapper 표에 `details.retryable` 필수 명시 누락

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §5 응답 형식 규약 (Principle 11)` 의 `output.error` 행 설명
- **위반 규약**: `spec/conventions/node-output.md Principle 3.2.1` — LLM 계열 노드는 `output.error.details.retryable: boolean` 필수
- **상세**: `0-common.md §5` 의 wrapper 표에서 `output.error.{code, message, details?}` 를 정의할 때 `details?` 로 optional 처럼 표기하고, "LLM 계열 노드는 `details.retryable: boolean` 필수" 라는 주석이 인라인 참조(`[CONVENTIONS Principle 3.2.1]`) 로만 걸려 있다. spec 가 직접 명시하지 않고 convention 링크로만 위임하는 형태라 공통 규약과 spec 사이의 표현 거리가 있다. 이는 정보의 중복을 피하는 의도적 패턴일 수 있으나, 공통 규약 wrapper 표의 `details?` 가 오독될 여지가 있다. `1-ai-agent.md §7.3` 은 `details.retryable` 을 명확히 필수로 기재해 단독으로는 정합적이다.
- **제안**: `0-common.md §5` 의 `output.error` 행 설명에 "LLM 계열 노드는 `details.retryable: boolean` 필수 (`details` 자체는 선택이나 LLM 노드에서는 set 의무)" 를 명시. CONVENTIONS 링크는 유지.

---

## 요약

`spec/4-nodes/3-ai` 영역의 문서는 전반적으로 정식 규약(`spec/conventions/`)을 충실히 따르고 있다. 문서 구조(Overview/본문/Rationale), 출력 포맷 규약(Principle 0~11), error 계약(Principle 3.2.1), config echo(Principle 7), 동적 포트 네이밍(Principle 6) 모두 규약에 부합한다. 다만 이번 브랜치(M-1 1/2단계)에서 추출된 두 신규 모듈 — `ai-condition-evaluator.ts`, `ai-memory-manager.ts` — 이 `1-ai-agent.md` frontmatter `code:` 에 반영되지 않아 spec-impl evidence 규약(`spec-impl-evidence.md §2.1`)과 미세한 어긋남이 있다. 두 항목이 WARNING 이며 나머지는 INFO 수준으로 즉각적인 invariant 파괴는 없다.

---

## 위험도

LOW

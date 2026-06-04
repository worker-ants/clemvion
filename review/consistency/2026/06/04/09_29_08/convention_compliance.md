# 정식 규약 준수 검토 — `spec/4-nodes/3-ai/`

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/3-ai/, diff-base=origin/main)
**검토 일시**: 2026-06-04

---

## 발견사항

### **[INFO]** `1-ai-agent.md` 에 `## Rationale` 섹션 없음 — 번호 붙은 섹션으로 흡수됨

- target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/persistent-enhance-32f236/spec/4-nodes/3-ai/1-ai-agent.md` §12 — `## 12. Rationale`
- 위반 규약: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 권장 명명
- 상세: CLAUDE.md 는 섹션 이름을 `## Rationale` 로 권장한다. `1-ai-agent.md` 는 이를 `## 12. Rationale` (번호 prefix 포함) 로 표기한다. 같은 폴더의 `0-common.md` 는 `## Rationale` (번호 없음), `spec/5-system/17-agent-memory.md` 도 `## Rationale` (번호 없음) 을 사용해 동일 폴더 내 불일치가 존재한다. `spec/conventions/conversation-thread.md` 는 `## 8. Rationale` (번호 포함) 형태다.
- 제안: 폴더 내 일관성을 위해 `## 12. Rationale` → `## Rationale` 로 변경 권장. 단, 기존 내부 앵커 링크(`#12-rationale` 등)가 있다면 동시 갱신 필요. 또는 규약 자체에 "번호 prefix 포함 Rationale 도 허용" 을 명시해 현행 유지. INFO 등급 — 기능 영향 없음.

---

### **[INFO]** `spec/conventions/conversation-thread.md` 에 `## Overview` 섹션 없음

- target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/persistent-enhance-32f236/spec/conventions/conversation-thread.md` — 섹션 구조
- 위반 규약: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항 → `_product-overview.md` 또는 진입 문서의 `## Overview`"; 스킬 SKILL.md 가 언급하는 "Overview / 본문 / Rationale 3섹션 권장"
- 상세: `conversation-thread.md` 는 `## 1. 자료구조` 로 바로 시작하며 별도 `## Overview` 섹션이 없다. `## 8. Rationale` 은 존재한다. `spec/5-system/17-agent-memory.md` 는 `## Overview (제품 정의)` 를 갖고 있어 동일 spec 영역에서 패턴 불일치. conventions 문서는 정식 규약 정의 목적이라 Overview 생략이 의도적일 수 있으나, CLAUDE.md 가 "3섹션 권장" 으로 명시했으므로 INFO 수준 제안.
- 제안: `conversation-thread.md` 상단에 `## Overview` 한 문단(무엇을 정의하는지, 적용 범위) 추가 권장. 신규 변경분(`runningSummary`/`summarizedUpToSeq` 추가 등)이 있는 이번 PR 기회에 정비하면 이상적. 또는 conventions 파일은 3섹션 권장에서 면제 가능성이 있으면 규약에 명시.

---

### **[INFO]** `0-common.md` §10 테이블에 `memoryStrategy` 행 추가 — 하지만 `0-common.md` `code:` frontmatter 에 `ai-agent.schema.ts` 미포함

- target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/persistent-enhance-32f236/spec/4-nodes/3-ai/0-common.md` frontmatter `code:` 목록
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"를 나열해야 함
- 상세: `0-common.md §10` 에 `memoryStrategy` 필드를 공통 규약 표에 추가했다. 이 필드의 스키마 단일 진실은 `spec/4-nodes/3-ai/1-ai-agent.md §1` 에서 "Source of truth: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`" 로 명시된다. `0-common.md` 의 `code:` 목록에는 `ai-agent.schema.ts` 가 없어 이 파일이 `0-common.md` 의 구현 경로로 추적되지 않는다. 단, `1-ai-agent.md` 의 `code:` 에는 `ai-agent.schema.ts` 가 포함되어 있어 다른 파일에서 추적은 됨 — 중요도 낮음.
- 제안: `0-common.md` 는 "공통 규약 인터페이스" 정의 목적이므로 `1-ai-agent.md` 의 schema 경로가 이미 추적하는 것으로 충분하다고 볼 수 있다. 만약 `memoryStrategy` 필드 정의의 권위가 `0-common.md §10` 에 있다고 간주한다면 `0-common.md code:` 에 `ai-agent.schema.ts` 추가를 검토.

---

### **[INFO]** `meta.memory.compactedMessages` 필드 — Principle 2 meta 규칙과의 정합 확인 권장

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 d.6` 및 `§7.1 meta` 표
- 위반 규약: `spec/conventions/node-output.md Principle 2` — "`meta` 는 실행 메트릭만 담는다"
- 상세: `meta.memory.compactedMessages` (물리 제거된 LLM messages 수) 는 실행 중 메모리 압축 동작의 수치이며 Principle 2 "실행 메트릭" 범주에 합치한다. 다만 `meta.memory` 오브젝트가 `strategy`, `summarized` (Boolean), `recalledCount`, `tokenBudgetUsed`, `compactedMessages` 를 혼재한다. Principle 2 의 LLM 계열 메트릭 목록(`meta.model`, `meta.inputTokens` 등)에 `meta.memory.*` 가 명시 열거되어 있지 않다.
- 제안: CRITICAL/WARNING 없음 — 실질적으로 Principle 2 위반이 아니나, `spec/conventions/node-output.md Principle 2` 의 "LLM 계열" 메트릭 목록에 `meta.memory?` 필드를 한 줄 추가하면 규약 ↔ spec 드리프트를 명시 차단할 수 있다. 단기 backlog 수준.

---

## 요약

`spec/4-nodes/3-ai/` 의 변경 내용(memoryStrategy / persistent / summary_buffer 신설, System Context Prefix §11, runningSummary / summarizedUpToSeq, 물리 압축 d.6 등)은 `spec/conventions/node-output.md` 의 Principle 0~11 컨트랙트, `spec-impl-evidence.md` frontmatter 스키마 (`status: partial` + `pending_plans` 규약), 명명 규약 (camelCase 식별자, UPPER_SNAKE_CASE 에러 코드, `_product-overview.md` 구조) 을 전반적으로 준수하고 있다. `status: partial` + `pending_plans` 는 적절히 설정됐고 plan 파일 실존도 확인된다. 출력 포맷 (`output.result.*` / `output.error.{code, message, details?}` / `output.interaction.*` wrapper) 도 Principle 11 패턴을 따른다. 발견된 사항은 모두 INFO 등급 — 섹션 명명 불일치 (Rationale 번호 prefix 유무), Overview 섹션 미포함 (conventions 파일), code: frontmatter 보완 가능성, meta.memory 필드 규약 명시 갭이며, 어떤 항목도 다른 시스템의 invariant 를 깨거나 채택을 차단할 수준이 아니다.

## 위험도

NONE

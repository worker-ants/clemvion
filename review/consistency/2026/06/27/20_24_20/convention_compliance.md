# Convention Compliance Review
Target: `plan/in-progress/spec-draft-ai-mem-precision.md`
Mode: spec draft (--spec)

---

## 발견사항

### [INFO] `related_plan` 필드는 plan-lifecycle.md §4 비표준 추가 필드
- **target 위치**: frontmatter `related_plan: plan/in-progress/ai-context-memory-followup-v2.md`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — plan frontmatter 필수 3필드(`worktree`/`started`/`owner`)만 정의; 추가 필드는 "허용"이나 부모 plan 참조 표준 키 이름은 없음
- **상세**: `related_plan` 은 현재 정식 스키마에 없는 커스텀 필드. 의미는 명확하나, 향후 계층 plan 참조를 표준화할 때 키 이름이 달라질 수 있음
- **제안**: 현재 상태로 유지 가능(허용된 추가 필드). 부모 plan 참조 패턴이 반복된다면 plan-lifecycle.md §4 에 `parent_plan` 또는 `related_plan` 으로 선택 필드 등재 검토

---

### [INFO] 문서 레벨 `## Overview` 섹션 부재
- **target 위치**: 문서 구조 전반 (제목 직후 intro 단락만 있고 `## Overview` 헤딩 없음)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 단, 이 규약은 spec 문서 대상. plan 문서에는 별도 section 구조 요건이 없음
- **상세**: 본 문서는 `plan/in-progress/` plan 문서이므로 3섹션 요건 적용 외 영역. intro 단락("이미 배포된 코드 동작을 문서에 정확히 반영하는 doc precision…")이 비형식적 개요 역할을 대신함. 규약 위반이 아닌 스타일 제안 수준
- **제안**: 현행 구조 유지 가능. 선택적으로 `## 개요` 헤딩을 추가해 가독성을 높일 수 있음

---

## 주요 점검 항목 결과 (위반 없음)

### 1. Plan frontmatter 스키마 (plan-lifecycle.md §4)
- `worktree: ai-mem-spec-precision-035adf` — `<task_name>-<slug>` 형식 일치, 실제 worktree 경로와 매칭
- `started: 2026-06-27` — ISO YYYY-MM-DD 형식 준수
- `owner: planner` — 유효 역할명
- **적합**

### 2. 제안 spec 변경의 필드명 및 출력 포맷 규약
- 제안 필드 `meta.memory?` shape: `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }`
- **`1-ai-agent.md §7.1` (line 530) SoT 와 완전 일치**: "handler return `memoryStrategy != 'manual'` 시에만 echo. `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }`"
- 기존 `meta.contextInjection?` 내부 필드(`appliedScope`, `appliedMode`, `injectedTurns`, `droppedTurns`, `totalInjectedChars`)와 동일한 camelCase 패턴
- **적합**

### 3. 제안 cross-reference 링크 경로
- 제안 텍스트 내 `[Spec Agent Memory](../5-system/17-agent-memory.md)` — `spec/conventions/node-output.md` 기준 상대 경로 → `spec/5-system/17-agent-memory.md`
- 해당 파일 실존 확인(`spec/5-system/17-agent-memory.md`)
- **적합**

### 4. 노드 범위 — `information_extractor` 포함
- draft: "`ai_agent` / `information_extractor`" 양측 노드가 `meta.memory` 를 emit
- `17-agent-memory.md` 확인: IE 는 persistent 메모리 producer/consumer 로 동일 규약 적용
- **적합**

### 5. 조건 표기 `memoryStrategy != 'manual'`
- `1-ai-agent.md §7.1` 표현: "`memoryStrategy != 'manual'` 시에만 echo"
- draft 표현: "`memoryStrategy != 'manual'` 적용 시"
- **일치**

### 6. 변경 2 (§5.4/§5.5 transient 노트) 패턴
- 정밀화 방향("추가하면 spec 이 코드를 거짓 기술" → 대신 의도 명시 노트 추가)은 doc precision 범주에 정확히 해당
- Rationale 에 코드 근거(`buildWaitingOutput` handler, line 번호)를 기록한 것은 plan 문서의 적절한 내용(spec 자체에 들어가는 것은 아님)
- **적합**

---

## 요약

`plan/in-progress/spec-draft-ai-mem-precision.md` 는 plan 문서 규약(`plan-lifecycle.md §4` 필수 3필드)을 모두 충족하고, 제안하는 spec 변경 내용(필드명·shape·링크 경로·노드 범위·조건 표기)도 기존 SoT(`1-ai-agent.md §7.1`, `17-agent-memory.md`, `node-output.md` Principle 2 선례)와 정합한다. 발견된 항목은 모두 INFO 수준의 스타일 제안이며, `spec/conventions/` 규약을 직접 위반하는 패턴은 없다.

## 위험도

NONE

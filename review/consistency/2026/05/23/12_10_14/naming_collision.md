# 신규 식별자 충돌 검토 결과

**검토 모드**: 구현 착수 전 (--impl-prep, scope=spec/4-nodes/)
**대상 변경**: `spec/4-nodes/6-presentation/0-common.md` §1 `ButtonDef.userMessage` 신설, §10.8 신설

---

## 발견사항

### 1. [INFO] `ButtonDef.userMessage` — 기존 인터페이스와의 필드 불일치 (아직 충돌 아님, 갱신 필요)

- **target 신규 식별자**: `ButtonDef.userMessage: String` (optional, `spec/4-nodes/6-presentation/0-common.md` §1)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/codebase/backend/src/nodes/presentation/_shared/button.types.ts` line 1~7 — `ButtonDef` 인터페이스가 `id / label / type / url? / style?` 5필드만 정의하고 있으며 `userMessage` 필드가 없다.
- **상세**: spec 이 `ButtonDef.userMessage` 를 신설했으나 codebase 의 `ButtonDef` TypeScript 인터페이스와 `validateButtons()` 함수는 해당 필드를 모르는 상태다. 충돌(동일 식별자 다른 의미) 은 아니나, 구현 착수 후 누락 시 TypeScript 컴파일 경고나 런타임에서 필드가 무시된다. `render-tool-provider.ts` 내 zod 스키마도 현재 `userMessage: z.string().optional()` 가 없음 (grep 결과 해당 라인 없음).
- **제안**: 구현 단계에서 `button.types.ts` 의 `ButtonDef` 인터페이스에 `userMessage?: string` 필드를 추가하고, `render-tool-provider.ts` 의 button zod schema 에도 `userMessage: z.string().optional()` 을 추가해야 한다. 이는 spec 이 plan 에 명시한 변경 범위 (C) 와 일치하므로 식별자 충돌이 아닌 구현 미완 상태 안내다.

---

### 2. [INFO] `userMessage` — 백엔드 함수 파라미터명과 동명이지만 의미 레이어가 다름

- **target 신규 식별자**: `ButtonDef.userMessage` — 버튼 클릭 시 chat 에 발화될 user message 텍스트 (data field)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` line 1554, 1568 — `processMultiTurnMessage(userMessage: string, ...)` 함수의 파라미터명
  - `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` line 475 — 동일 패턴
  - `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/codebase/frontend/src/lib/stores/assistant-store.ts` line 321 — `const userMessage: AssistantDisplayMessage` 지역 변수명
- **상세**: 기존 사용처들은 모두 "사용자가 chat 입력 박스로 보낸 메시지 문자열" 이라는 의미의 로컬 변수·파라미터명으로 `userMessage` 를 사용한다. target 이 새로 도입하는 `ButtonDef.userMessage` 는 같은 단어를 "버튼 클릭 시 발화될 텍스트" 라는 config 필드명으로 사용한다. 레이어(데이터 모델 필드 vs 함수 파라미터명)가 다르므로 런타임 충돌은 없다. 그러나 독자 입장에서 "userMessage 는 어떤 의미인가" 라는 혼동이 발생할 수 있다.
- **제안**: 현행 수준에서 실질 충돌은 없다. spec 의 §10.8 및 §1 에서 `ButtonDef.userMessage` 의 의미·범위(AI Agent `render_*` tool 모드 한정, `type:"port"` 한정)를 명확히 기술하고 있어 문서 독자 혼동도 제한적이다. 구현 시 `render-tool-provider.ts` 의 zod 스키마 필드명을 `userMessage` 로 통일 적용하면 충분하다.

---

### 3. [INFO] `findButtonContext` — 기존 `findButtonLabel` 함수명과 책임 확장 충돌 없음, 명명 교체 필요

- **target 신규 식별자**: `findButtonContext(payload, buttonId): {button, item?} | undefined` — spec `§10.8` 의 4-layer SSOT 에서 명시
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` line 37 — `findButtonLabel(payload, buttonId)` 함수가 존재하며, line 126 에서 `findButtonLabel(...)` 로 호출된다.
- **상세**: spec 이 `findButtonLabel` 을 `findButtonContext` 로 교체(책임 확장 — label 뿐 아니라 `{button, item?}` 컨텍스트 반환)하도록 명시한다. 현재 codebase 에는 두 이름이 공존하지 않고 `findButtonLabel` 만 있다. 식별자 충돌이 아닌 "구현 시 함수명 교체가 필요한 상태" 안내다. 교체 없이 `findButtonLabel` 만 수정하면 `userMessage` 우선순위 로직을 담기에 반환 타입이 달라지므로 혼동 가능성이 있다.
- **제안**: 구현 단계에서 `findButtonLabel` 을 `findButtonContext` 로 교체 또는 `findButtonLabel` 을 `findButtonContext` 를 호출하는 래퍼로 리팩터링한다. `findButtonLabel` 이라는 이름을 유지하면서 반환 타입을 `{button, item?}` 로 바꾸면 의미와 이름의 불일치가 생기므로 spec 이 명시한 `findButtonContext` 명명이 권장된다.

---

### 4. [INFO] `backfillButtonUuids` — spec 명칭과 codebase 구현 이미 정합

- **target 신규 식별자**: `backfillButtonUuids` — `spec/4-nodes/6-presentation/0-common.md` §10.5 step 3 및 §Rationale 에서 함수명 명시
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` line 365 — `export function backfillButtonUuids(...)` 로 이미 구현됨
- **상세**: spec 과 codebase 모두 동일 이름 `backfillButtonUuids` 를 사용하며 의미도 동일 (LLM tool 모드에서 `button.id` 누락 시 UUID v4 부여). `normalizeNodeButtonIds` (그래프 노드 본체용 label→slug) 와의 구분도 spec 과 codebase 가 동일하게 인지한다. 충돌 없음.
- **제안**: 이상 없음. 확인 완료.

---

### 5. [INFO] `§10.8` 섹션 번호 — 기존 §10.5 재번호 누락 없음 확인

- **target 신규 식별자**: `§10.8 render_* 클릭 user-message 합성` (새 섹션), §10.5 step 3 신설로 기존 step 3→4, 4→5 재번호
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/spec/4-nodes/3-ai/1-ai-agent.md` line 333 — `[Presentation 공통 §10.5 step 3]` 로 cross-ref. `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/spec/4-nodes/6-presentation/0-common.md` 의 §10.4 cross-ref 문구도 갱신 기록됨 (CHANGELOG 2026-05-23 항목).
- **상세**: `spec/4-nodes/3-ai/1-ai-agent.md` line 333 의 `[Presentation 공통 §10.5 step 3]` 링크 anchor 는 갱신된 제목 (`#105-schema-위반-처리-및-정규화`) 을 가리키는데, spec 의 CHANGELOG 에 "§10.4 의 cross-ref 문구를 신규 제목에 맞춰 갱신" 이 기록되어 있으므로 실제 ai-agent.md 가 이미 갱신됐는지 또는 아직인지 확인이 필요하다. 단, 이는 섹션 번호·anchor 문자열이 아니라 섹션 제목 변경의 연파 문제로, 식별자 충돌이 아니다. 현재 ai-agent.md line 333 의 anchor `#105-schema-위반-처리-및-정규화` 와 presentation 0-common.md 의 실제 섹션 `## 10.5 Schema 위반 처리 및 정규화` 가 일치하므로 사실상 정합 상태다.
- **제안**: 이상 없음. cross-ref anchor 정합 확인 완료.

---

## 요약

`spec/4-nodes/6-presentation/0-common.md` 가 새로 도입하는 식별자(`ButtonDef.userMessage`, `findButtonContext`, `backfillButtonUuids`, `§10.8`) 중 기존 사용처와 의미가 충돌하는 CRITICAL 또는 WARNING 수준의 문제는 없다. `backfillButtonUuids` 는 이미 codebase 에 동일 이름·동일 의미로 구현되어 있어 완전히 정합한다. `userMessage` 는 백엔드 함수 파라미터명과 동명이지만 레이어(data field vs parameter name)가 달라 런타임 충돌이 없고 spec 에서 의미 범위도 명확히 한정된다. `findButtonContext` 는 기존 `findButtonLabel` 함수를 교체해야 하는 구현 지시로, 혼동 방지를 위해 spec 이 명시한 새 이름을 그대로 사용하도록 주의가 필요하다. 가장 중요한 실천 포인트는 `codebase/backend/src/nodes/presentation/_shared/button.types.ts` 의 `ButtonDef` 인터페이스에 `userMessage?: string` 을 누락 없이 추가하는 것이다.

## 위험도

NONE

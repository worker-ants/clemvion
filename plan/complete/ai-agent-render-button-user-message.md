---
worktree: ai-agent-render-button-user-message-521f33
started: 2026-05-23
owner: developer
---

# AI Agent render_* 버튼 클릭 user-message 합성 — 아이템 컨텍스트 보존

## 배경

PR #279 (`fix(render-tools): button click + isSelected guard`) 머지 후 사용자 보고:

- 캐러셀 안 per-item 버튼 ("샘플상품 1 / 문의하기") 클릭은 정상 동작 (PR #279 의 backfill + 가드 덕분에 onClick 발화).
- 그러나 chat 으로 전송되는 user message 가 `btn.label` 만 ("문의하기"). LLM 입장에서 **어떤 아이템에 대한 문의인지 식별 불가**.

## 사용자 결정 (2026-05-23)

> 하이브리드로 진행. fallback 은 `"{item.title} → {button.label}"`.

- **하이브리드**: LLM 이 emit 한 `button.userMessage` 가 있으면 그것을 그대로 user message 로 발화. 없으면 frontend 가 합성.
- **Fallback 규칙**:
  - per-item 버튼 (carousel `items[].buttons` / dynamic `itemButtons` 의 런타임 `{id}__item_{idx}` ID): `"{item.title} → {button.label}"`
  - global 버튼 (carousel `buttons` / table / chart / template `buttons`): `"{button.label}"` (현 동작 유지)

## 변경 범위 (S/A/C 3축)

### (S) spec
- `spec/4-nodes/6-presentation/0-common.md`
  - §1 ButtonDef 표에 `userMessage` 옵션 필드 추가 — String, ✗ 필수, "type=port 버튼 클릭 시 chat 에 발화될 user message 텍스트. 미설정 시 frontend 가 합성"
  - §1.1 유효성: link 타입에 `userMessage` 설정 시 무시 (외부 URL 이동, 메시지 발화 없음) — warning 정도
  - §9 CHANGELOG: 2026-05-23 항목 추가
  - §Rationale: 하이브리드 결정·fallback 형식 결정 근거 (사용자 명시) 기록
- `spec/4-nodes/3-ai/1-ai-agent.md`
  - §4.1 또는 §7.10 (render_* tool family 의 사용자 인터랙션 절) — 버튼 클릭 시 user-message 합성 규칙 명시 + ButtonDef.userMessage cross-ref
  - 누락 시 frontend fallback (`"{item.title} → {button.label}"` for per-item, `"{button.label}"` for global)

### (C) backend
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts`
  - Button zod schema 에 `userMessage: z.string().optional()` 추가 (carousel `buttons` / `itemButtons` / `items[].buttons`, table / chart / template `buttons`)
  - 별도 backfill 로직 불필요 (옵션 필드)
- `render-tool-provider.spec.ts`
  - userMessage 가 schema 에서 보존되는 케이스 (LLM emit) + 미지정 케이스 (그대로 통과) 단위 테스트

### (A) frontend
- `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx`
  - `findButtonLabel` → `findButtonContext(payload, buttonId): { button, item? } | undefined` 로 확장
  - 검색 우선순위는 기존과 동일: global → items[].buttons (dynamic ID `__item_${idx}` 접미사 포함)
  - `handlePortButtonClick` 에서 message 합성:
    ```ts
    const ctx = findButtonContext(payload, buttonId);
    const msg = ctx?.button.userMessage
      ?? (ctx?.item
            ? `${itemTitle(ctx.item)} → ${ctx.button.label}`
            : ctx?.button.label)
      ?? buttonId;
    onSendMessage(msg);
    ```
  - `itemTitle(item)`: carousel item 의 title 추출 — `item.title` 우선, fallback 으로 `item.name` / `item.label` (방어적). spec 의 carousel item 구조 확인 후 정확한 키 결정.
- `__tests__/presentation-renderers.test.tsx` 또는 신규 `assistant-presentations-block.test.tsx`
  - LLM emit `userMessage` → 그대로 발화
  - per-item 버튼 클릭 (userMessage 없음) → `"{item.title} → {button.label}"`
  - global 버튼 클릭 (userMessage 없음) → `"{button.label}"`
  - 매칭 실패 (id 못찾음) → `buttonId` 그대로 (기존 fallback 유지)

## TDD 체크리스트

- [x] (S) project-planner 위임 — spec §1 ButtonDef.userMessage 신설 + ai-agent §user-message 합성 규칙
- [x] (S) `/consistency-check --spec plan/in-progress/spec-draft-...md` BLOCK:NO 확인
- [x] (S) spec commit (bf22ea80)
- [x] (impl-prep) `/consistency-check --impl-prep spec/4-nodes/`
- [x] (C) backend test 선작성
- [x] (C) backend zod schema 갱신 (28ca194e)
- [x] (C) backend test PASS
- [x] (A) frontend test 선작성 (3 케이스)
- [x] (A) frontend findButtonContext + handlePortButtonClick 구현 (fbd05c12)
- [x] (A) frontend test PASS
- [x] (8) TEST WORKFLOW — lint / unit / build / e2e
- [x] (9) REVIEW WORKFLOW — `/ai-review` + resolution-applier (review/code/2026/05/23/12_39_18)
- [x] (10) PR 생성

## 의사결정 메모

- **함수명 `findButtonContext`** — 기존 `findButtonLabel` 의 확장. `findButton` 도 후보였으나 반환이 `{ button, item }` 구조라 `Context` 가 더 적합.
- **link 타입의 userMessage** — 무시 (외부 URL 이동이 우선 시맨틱). spec 에 명시.
- **다른 noise field (예: subtitle, description) 합성 안함** — 사용자 결정대로 `title → label` 만. 추후 사용자 보고 시 spec 확장.
- **i18n 처리** — `"{item.title} → {button.label}"` 의 ` → ` 구분자는 텍스트 그대로 직렬화 (UI 라벨 아님). 한·영 동일 형식.

## Follow-up (별 plan)

ai-review (`review/code/2026/05/23/12_39_18`) 의 결과로 다음 항목이 별 plan 으로 분리됨 — 본 PR 의 scope 한정 결정:

- **`buttonDefSchema` 4-file DRY refactor** (W#5/W#6/W#7) — pre-existing 패턴이며 본 PR 이 신설하지 않음. `_shared/button.schema.ts` 단일 정의 + `export type ButtonDef = z.infer<typeof buttonDefSchema>` 로 interface 파생 권장.
- **table/chart/template global 버튼 클릭 user-message 발화 경로** (INFO #3) — 현 단계 carousel 한정. 후속 task 로 추적.
- **spec §10.8 `userMessage` 빈 문자열 처리 규칙 명문화** (INFO #4) — project-planner 위임. 현행 동작은 유지 (frontend 무시, backend Zod 허용).
- **기타 INFO 사항** — RESOLUTION.md `## 보류·후속 항목` 참조.

## Closeout (2026-05-23)

본 worktree 작업 완료. commit hash:

- spec: `bf22ea80` — `docs(spec): presentation §1 — ButtonDef.userMessage 옵션 필드 신설`
- backend zod: `28ca194e` — `feat(presentation): ButtonDef.userMessage 옵션 필드 (spec §1, §10.8)`
- frontend logic: `fbd05c12` — `feat(ai-agent): render_* 버튼 클릭 user-message 합성 — item 컨텍스트 보존 (spec §10.8)`
- prettier style: `e4436505`
- i18n parity: `147fa4b8` — `fix(i18n): backend ui.label 'User Message' KO 매핑`
- ai-review fix: `117463b1` — `fix(presentation): SUMMARY#1~#4,#8~#14,#19 — security+testing+docs resolution`

TEST 최종: lint PASS / unit 4541 PASS / build PASS / e2e 98/98 PASS.
PR: https://github.com/worker-ants/clemvion/pull/280

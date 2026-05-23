---
worktree: render-presentation-button-click-fix-683f3a
started: 2026-05-23
owner: developer
---

# render_* presentation tool 버튼 무반응 회귀 fix

## 배경

사용자 보고 (2026-05-23): AI Agent 의 `render_carousel` 페이로드 안 "문의하기" / "주문하기" 버튼이 클릭되지 않음. PR #273 (onSendMessage prop drill) + d6107ce5 안에 흡수된 stopPropagation 가드까지 main 에 있으나 여전히 무반응.

## Root cause (확정)

`codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`:

```tsx
// CarouselContent line 242 / PresentationContent line 591
const isSelected = selectedButtonId === btn.id;
...
onClick={() => {
  if (isSelected) return;   // ← early return
  ...
  onPortButtonClick?.(btn.id);
}}
```

- `AssistantPresentationsBlock` 은 `CarouselContent` 를 호출할 때 `selectedButtonId` 를 넘기지 않음 (resume snapshot 이 없는 surface) → `undefined`.
- LLM 이 emit 한 `render_carousel.items[].buttons[]` 는 `buttonDefSchema.id` 가 optional 이라 거의 항상 `id: undefined`.
- `undefined === undefined === true` → `isSelected = true` 가 모든 버튼에 적용.
- `isSelected = true` → primary 스타일 (스크린샷의 까만 버튼 색이 정확히 이 분기) + onClick 의 `if (isSelected) return;` 으로 클릭이 즉시 단락.
- 부수적: `disabled = !isInteractive && !isSelected = !true && !true = false` → disabled 표시 안 됨 → 사용자 시각엔 "클릭은 되는데 효과 없음" 으로 보임.

## 스펙 정합

- `spec/4-nodes/3-ai/1-ai-agent.md` §4.1: render_* 버튼 클릭은 graph routing 흉내 X — **다음 LLM turn 의 user 메시지로 흡수**. 따라서 onClick 이 실제로 호출되어 `onPortButtonClick?.(btn.id)` → `AssistantPresentationsBlock.handlePortButtonClick` → `commands.sendMessage` 경로가 열려야 spec 의도가 성립한다 (consistency W5 / I9).
- `spec/4-nodes/6-presentation/0-common.md` §1: ButtonDef.id 는 "UUID v4 자동 생성, 불변" 이 SoT. LLM 이 빠뜨리는 케이스는 backend 가 정규화해 SoT 를 채워야 함.
- `spec/4-nodes/6-presentation/0-common.md` §10.5: 현 spec 파이프라인은 validate → defaults overlay → 1MB cap 3단계. 본 PR 에서 "단계 3.5: `button.id` 미설정 시 UUID v4 자동 보완 (`backfillButtonUuids`) — cap 이후 적용해 truncate 된 element 안의 버튼은 처리하지 않는다 (의도된 최적화)" 1행을 spec 에 동반 추가한다.

## 작업 범위 (A + C 동시)

### (A) Frontend defense-in-depth 가드

`codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`:

| 위치 | 변경 |
|------|------|
| line 242 CarouselContent per-item | `const isSelected = selectedButtonId != null && selectedButtonId === btn.id;` |
| line 591 PresentationContent global | 동일 가드 |

### (C) Backend root-cause 정규화

`codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts`:

- `backfillButtonUuids(type, payload)` helper 추가 — zod validate → defaults overlay → 1MB cap **이후** 단계에서 누락 `button.id` 를 `crypto.randomUUID()` 로 채움.
- 처리 대상:
  - carousel: `buttons[].id` + `itemButtons[].id` + `items[].buttons[].id`
  - table / chart / template: `buttons[].id`
  - form: button 개념 없음 (skip)
- 사용자가 이미 박은 id 는 보존.
- cap 이후에 호출되므로 truncate 된 item 의 button id 는 처리되지 않음 — frontend 에 도달하지 않으므로 의도된 최적화 (consistency I10).

### (S) Spec 동반 갱신 (사용자 명시 결정)

`spec/4-nodes/6-presentation/0-common.md §10.5`:

- 기존 파이프라인 "1. validate → 2. defaults overlay → 3. 1MB cap" 에 "3.5. `button.id` 미설정 시 UUID v4 자동 보완" 1행 삽입.
- `spec/4-nodes/6-presentation/0-common.md §1` 의 ButtonDef.id "자동 생성" 원칙이 LLM tool 모드까지 일관 적용됨을 명시.

## TDD 체크리스트

- [ ] backend: render-tool-provider.spec.ts
  - [ ] carousel items[].buttons 에 id 누락 → 각 버튼에 unique UUID 부여
  - [ ] carousel 글로벌 buttons / itemButtons id 누락 → UUID 부여
  - [ ] table / chart / template buttons id 누락 → UUID 부여
  - [ ] 사용자가 id 명시한 경우 보존
  - [ ] 정규화는 cap 이후에 일어나 truncate 된 아이템 안의 버튼은 처리 안 함 (불필요한 work 제거)
- [ ] frontend: presentation-renderers 테스트 보강
  - [ ] selectedButtonId = undefined + btn.id = undefined → isSelected=false → onPortButtonClick 호출됨
  - [ ] selectedButtonId 일치 시 isSelected=true → 클릭 무효 (기존 동작 보존)

## TEST WORKFLOW

- [ ] lint
- [ ] unit
- [ ] build
- [ ] e2e

## REVIEW WORKFLOW

- [ ] /ai-review
- [ ] (post-impl consistency check) — spec 변경 없음, skip 가능
- [ ] RESOLUTION.md
- [ ] PR

## 완료 조건

- 사용자 환경에서 render_carousel 안 버튼 클릭 → 라벨이 user 메시지로 LLM 에 흡수되어 다음 응답 진입
- backend 가 emit 한 페이로드의 button.id 가 모두 truthy (UUID 또는 사용자 박은 값)
- frontend 가 selectedButtonId 가 미설정인 surface 에서 click 단락 회귀 안 일으킴

## Closeout

(미작성 — fix PR 머지 시점에 기록)

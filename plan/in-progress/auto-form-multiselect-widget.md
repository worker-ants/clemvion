---
worktree: multiselect-widget-f72348
started: 2026-05-26
owner: developer
status: in-progress
---

# Auto-form `multiselect` widget 구현 — AI 노드 systemContextSections UI 회복

## 배경

Backend 가 `widget: 'multiselect'` 로 정의한 AI 노드 `systemContextSections` 필드 (`codebase/backend/src/nodes/ai/shared/system-context-schema.ts:69`) 가 frontend 의 widget 미구현으로 인해 `UnsupportedWidget` (read-only JSON pre) 으로 fallback 되고 있다.

`spec/4-nodes/3-ai/0-common.md §11` 은 이미 multiselect 위젯을 전제로 작성되어 있어 frontend 의 widget 구현이 spec 의 의도를 따라가지 못한 상태 — **구현 누락 보완** 성격.

## 사전 검토

- `/consistency-check --impl-prep spec/4-nodes/3-ai/` 세션: `review/consistency/2026/05/26/17_18_37/` (BLOCK: YES — but unrelated)
- BLOCK 사유 (C-1 `details.retryable` 누락, C-2 `status: ended` 누락) 는 본 작업의 변경 set (`codebase/frontend/src/components/editor/settings-panel/auto-form/**`, `codebase/frontend/src/lib/node-definitions/types.ts`) 과 무관 — `text-classifier` / `information-extractor` spec 본문 결함. `plan/in-progress/spec-update-ai-error-output-fields.md` 로 분리.
- 사용자 응답 (2026-05-26): "별도 plan 으로 이관 후 본 작업 진행" → 본 PR 은 multiselect widget 만 다룬다.
- Warning / Info 항목 중 본 작업에 영향 있는 것: 없음.

## 변경 set (예상)

| 파일 | 변경 |
|---|---|
| `codebase/frontend/src/lib/node-definitions/types.ts` | `UiWidget` 에 `"multiselect"` 추가 |
| `codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx` | `MultiSelectWidget` 컴포넌트 추가 (체크박스 리스트) |
| `codebase/frontend/src/components/editor/settings-panel/auto-form/widget-registry.ts` | `WIDGET_REGISTRY` 에 `multiselect: MultiSelectWidget` 등록 |
| `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/multi-select-widget.test.tsx` (신규) | DOM 단위 테스트 |

## DOCUMENTATION 매핑 (`PROJECT.md §변경 유형 → 갱신 위치`)

| 변경 유형 | 영향 | 동반 갱신 필요? |
|---|---|---|
| 신규 backend zod `ui.label` / `hint` / `group` / `itemLabel` 값 | 추가 없음 (이미 등록됨 `backend-labels.ts:69-74, 295, 327-331, 215-218`) | 불필요 |
| 신규 UI 문자열 (TSX) | widget 안에 신규 i18n 키 도입 없음 — 라벨·hint 모두 backend translator 경유 | 불필요 (단 i18n parity 가드는 그대로 통과 확인) |
| 노드 schema 변경 | 본 PR 은 schema 변경 없음 — frontend rendering 만 | 불필요 |
| spec 신규/대규모 변경 | 없음 | 불필요 |
| user-guide GUI 흐름 절 | 없음 (특정 노드 UI 가이드 영향 없음 — 본 변경은 cross-node infra) | 불필요 |

## 작업 체크리스트

- [ ] 테스트 선작성 (TDD red)
- [ ] `UiWidget` 타입에 `"multiselect"` 추가
- [ ] `MultiSelectWidget` 컴포넌트 구현
- [ ] `WIDGET_REGISTRY` 에 등록
- [ ] TEST WORKFLOW: lint / unit / build / e2e
- [ ] REVIEW WORKFLOW: `/ai-review`
- [ ] (post-impl) `/consistency-check --impl-done` — 본 PR 은 spec 영역 변경이 없으므로 skip

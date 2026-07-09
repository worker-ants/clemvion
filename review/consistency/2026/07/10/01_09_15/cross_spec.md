This is a high-level pointer table (not a full trigger-condition enumeration), so no duplication conflict with the new `$params.` row in `5-expression-language.md §7.1`.

Based on the review, the actual change under review is narrow: one new table row in `spec/5-system/5-expression-language.md §7.1` documenting `$params.` autocomplete trigger condition, backed by matching frontend implementation (`ROOT_VARIABLES` + `$params.` drill handler in `use-expression-suggestions.ts`) and test coverage.

### 발견사항

No CRITICAL or WARNING findings. Cross-checked:

- **데이터 모델 / API 계약**: no new entity, field, or endpoint introduced; no conflict.
- **`$params` definition consistency**: `$params` is already defined consistently across `spec/5-system/5-expression-language.md:171`, `spec/5-system/4-execution-engine.md:607,779`, `spec/4-nodes/7-trigger/0-common.md:38,74,85`, `spec/4-nodes/7-trigger/1-manual-trigger.md:150`, and `spec/5-system/12-webhook.md:54,274` — all describe `$params` as an alias/shortcut for `$input.parameters`. The new autocomplete row (`spec/5-system/5-expression-language.md:401`) does not redefine `$params`; it only adds an editor-UX row under `## 7. 자동완성 (에디터 지원)`, which is a distinct concern (compile-time UI hinting) from runtime resolution (already documented, unaffected).
- **Scope wording ("트리거 직속 successor 한정")**: this describes only the autocomplete-hint data source limitation (enricher only projects `config.parameters[].name` into the trigger's direct successor's `inputSchema.parameters`), not a runtime access restriction. Runtime docs (`webhook.md:274`, `execution-engine.md:779`) describe `$params`/`$input.parameters` access generically ("다운스트림에서"), which remains true — actual runtime values resolve for any node via `$input`; only the *pre-run schema hint* is narrower. No contradiction, since the two statements answer different questions (design-time hint vs runtime value).
- **요구사항 ID / 상태 전이 / RBAC / 계층 책임**: not touched by this change; no new IDs, no state machine, no permission model, no cross-layer responsibility shift (purely frontend expression-editor autocomplete, backend resolver `paramsFromInput` unchanged and pre-existing).
- **관련 plan 문서 동기화**: `plan/in-progress/trigger-param-output-enricher.md` and `plan/in-progress/node-output-redesign/manual-trigger.md` were updated in the same change set to mark the previously-tracked `$params.<name>` root-shortcut gap as resolved — consistent with the new spec row and implementation, no stale/duplicate tracking left behind.
- No other spec document (`spec/3-workflow-editor/1-node-common.md`, `spec/4-nodes/**`) duplicates the §7.1 autocomplete-trigger-condition table in a way that could drift from this new row; other "자동완성" mentions found via repo-wide grep are either generic pointers or unrelated node-specific features (carousel/chart/template/code/database-query autocomplete UI), not competing definitions of `$params`.

### 요약
검토 대상 변경은 `spec/5-system/5-expression-language.md §7.1` 자동완성 트리거 조건 표에 `$params.` 입력 행 1건을 추가한 것이 전부이며, 이는 이미 문서 전역(§4.1, execution-engine, trigger 공통·webhook spec)에서 확립된 `$params ≡ $input.parameters` 정의를 재천명할 뿐 새로 정의하지 않는다. 새 엔티티·API·요구사항 ID·상태 머신·RBAC·계층 책임 변경이 전혀 없고, 관련 plan 추적 문서도 동일 커밋에서 정합하게 갱신되어 다른 spec 영역과의 충돌 소지가 없다.

### 위험도
NONE
# 변경 범위(Scope) Review

## 발견사항

### [INFO] plan/complete/spec-sync-data-common-gaps.md — spec 결정 전 구현 진행
- 위치: `plan/complete/spec-sync-data-common-gaps.md` 마지막 섹션, `codebase/backend/src/nodes/data/code/code.schema.ts`
- 상세: plan 파일 자체가 "결정 필요(planner): `{{language|upper}}` 만 vs DSL 확장"이라고 명시하면서, 동시에 `code.schema.ts`에 `summaryTemplate: { template: '{{language|upper}}' }`를 구현하고 plan 항목을 `[x]`로 체크한 채 `plan/complete`로 이동했다. plan 파일에서 "결정 필요"로 분류된 항목이 planner 결정을 거치지 않고 개발자 레벨에서 downscope 결정을 내리고 구현까지 완료했다.
- 제안: planner가 "downscope 허용"을 명시적으로 결정하기 전까지 이 변경은 범위를 벗어난 것이다. plan 상태가 "결정 필요"로 재분류된 상태에서 구현을 포함하는 것은 의도된 작업 흐름 위반이다.

### [INFO] plan/complete/spec-sync-template-gaps.md — spec 결정 전 구현 진행
- 위치: `plan/complete/spec-sync-template-gaps.md`, `codebase/backend/src/nodes/presentation/template/template.schema.ts`
- 상세: code.schema.ts와 동일 패턴. plan 파일이 "결정 필요: buttons-only 로 downscope vs DSL 확장"이라고 명시하면서 `template.schema.ts`에 `summaryTemplate: { template: '{{outputFormat}} · {{buttons.length}} buttons' }`를 구현했다. spec/4-nodes/6-presentation/0-common.md도 "Template (버튼 없음)/Template (버튼 있음)" 두 행을 단일 행으로 축소하면서 원래 spec 약속(`N lines` + `N buttons` 분기)과 다른 형태로 spec을 수정했다.
- 제안: 동일하게 planner 결정 이후에 구현해야 한다.

### [INFO] plan/complete/spec-sync-foreach-gaps.md — spec 결정 전 구현 진행
- 위치: `plan/complete/spec-sync-foreach-gaps.md`, `expression-resolver.service.ts`, `expression-resolver.service.spec.ts`, `expression-constants.ts`, `packages/expression-engine/src/evaluator.ts`
- 상세: plan 파일이 "(a) 새 top-level 변수 `$itemIsFirst`/`$itemIsLast`, (b) `$loop.isFirst/isLast` 형태 재사용, (c) spec 변경 — 어느 쪽이든 spec 변경 동반"이라며 "결정 필요"로 재분류했다. 그러나 `$itemIsFirst`/`$itemIsLast` top-level 변수 추가(선택지 a)가 결정 없이 구현됐다. 다만 spec(`spec/4-nodes/1-logic/9-foreach.md`, `spec/5-system/5-expression-language.md`)도 함께 수정되어 있어, planner가 결정하고 spec 먼저 갱신한 다음 구현이 따라온 순서일 가능성도 있다. 그러나 worktree와 작업 주체가 `spec-inprogress-groom`으로 spec 정비 작업이므로, spec 갱신은 범위 내이고 구현이 이 worktree에 함께 포함된 점이 과잉 범위에 해당할 수 있다.
- 제안: foreach 관련 구현 변경(파일 1, 2, 20, 25)이 spec groom worktree에 포함된 것이 적절한지 확인. spec 갱신만 해당 worktree 범위이고 구현은 별도 developer worktree에서 해야 하는 것이 아닌지 검토.

### [INFO] node-settings-panel.tsx — 넓은 구현 범위 (error handling 전면 재설계)
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx`
- 상세: plan 파일(`spec-sync-node-common-gaps.md`)이 "결정 필요: config 스키마 통일(flat vs nested) + policy 값 vocabulary"라고 명시했으나, nested `errorHandling` 계약으로 완전히 전환하는 구현이 포함됐다. LEGACY_POLICY_MAP 추가, retry 입력 UI, default output JSON 에디터, 마이그레이션 로직이 모두 이 변경에 포함됐다. plan이 "결정 필요"로 분류된 상태에서 이만큼의 구현이 포함된 것은 범위 초과 가능성이 있다. 단, spec/3-workflow-editor/1-node-common.md 갱신도 함께 있어 planner 결정이 내부적으로 이루어진 것으로 보인다.
- 제안: plan 파일에 "결정 A 채택: nested errorHandling" 결정 근거가 명시되지 않았다. plan 상태가 "결정 필요" 표시를 제거하고 채택된 결정을 기록했어야 한다.

### [INFO] spec 파일들의 status 변경 — 일부 조기 `implemented` 승격 가능성
- 위치: `spec/3-workflow-editor/1-node-common.md`, `spec/4-nodes/1-logic/9-foreach.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/6-presentation/5-template.md`, `spec/5-system/8-embedding-pipeline.md`
- 상세: 모두 `status: partial` → `status: implemented`로 승격됐다. embedding-pipeline, foreach, node-common은 이번 변경에서 실제로 구현이 이루어졌으므로 적절하다. 단, `spec/4-nodes/5-data/0-common.md`의 경우 Code 노드 summaryTemplate이 원래 spec 약속(`JavaScript · 12 lines`)과 다른 downscoped 형태(`JAVASCRIPT`)로 구현됐는데 `implemented`로 표기했다. 이 downscope 결정이 planner 레벨에서 공식화되지 않은 상태라면 `partial` 유지가 더 정확하다.
- 제안: downscoped 구현을 `implemented`로 표기하려면 spec 본문에 원래 약속과 다른 형태를 명시하고(이미 됨), planner가 downscope를 공식 결정으로 승인해야 한다.

### [INFO] embedding.service.ts — empty-text 조기 반환 로직 제거
- 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts` diff hunk (파일 6)
- 상세: 기존 코드에는 `parseDocument` 결과가 빈 텍스트인 경우 `embeddingStatus: 'completed', chunkCount: 0`으로 조기 반환하는 로직이 있었다. `parseDocumentSegments` 로 전환하면서 이 조기 반환 로직이 제거됐다. 새 경로에서는 `chunks.length === 0` 체크로 동일 처리를 하므로 기능상 등가이나, 빈 text segment가 `chunkText`를 통과할 때 `[]` 반환됨을 보장하는지 추가 확인이 필요하다 (text-chunker.ts에서 `!text.trim() → []` 처리가 있으므로 실제로 등가). 범위 관점에서 의도된 동작 보존이므로 범위 이탈은 아니다.
- 제안: 범위 이탈 아님. 동작 등가 확인됨.

## 요약

이번 변경은 `spec-inprogress-groom` worktree에서 이루어진 것으로, spec 정비(groom) 작업에서 크게 세 가지 독립적인 구현이 함께 포함됐다: (1) embedding pipeline의 `parseDocumentSegments` + `chunkText` metadata 전파, (2) foreach의 `$itemIsFirst`/`$itemIsLast` top-level 변수 노출, (3) node-settings-panel의 errorHandling nested 계약 전환 + retry/default-output UI. 이 세 구현은 모두 plan 파일에서 "결정 필요"로 재분류됐던 항목들이다. spec groom의 의도가 "spec 정비 + decision-free 항목 구현"이라면 결정이 내부에서 이루어졌다고 볼 수 있으나, plan 파일에 "결정 필요" 표기가 명시적으로 제거되지 않고 단지 항목이 체크되고 `plan/complete`로 이동된 것은 추적성 관점에서 아쉽다. code.schema.ts와 template.schema.ts의 summaryTemplate downscope는 planner 결정이 명시적으로 기록되지 않은 상태에서 구현이 포함된 점이 범위 관점의 주요 주의사항이다. 그 외 각 구현의 내부 변경은 의도된 기능 범위 안에서 이루어졌으며 불필요한 리팩토링·포맷팅 변경·무관한 수정은 발견되지 않았다.

## 위험도

LOW

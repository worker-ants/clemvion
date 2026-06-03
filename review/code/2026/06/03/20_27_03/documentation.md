# Documentation Review

## 발견사항

### [INFO] $thread 변수 detail 문자열 — 확장 가능 필드 문서화 미흡
- 위치: `codebase/frontend/src/components/editor/expression/expression-constants.ts` 라인 35
- 상세: 새로 추가된 `$thread` 항목의 `detail` 값은 `"Conversation thread"` 라는 단순 레이블만 제공한다. 다른 expandable 변수들(`$execution`, `$node` 등)과 마찬가지로 `isExpandable: true` 가 붙어 있으나, 어떤 하위 필드가 노출되는지(예: `$thread.length`, `$thread[n].role` 등) detail 에 힌트가 없다. 동 spec(`spec/5-system/5-expression-language.md §4.4`)에는 `text`, `length`, 인덱스 접근 등이 기술되어 있다.
- 제안: detail 을 `"Conversation thread (length, text, indexed access)"` 수준으로 보강하거나, 파일 상단 JSDoc 의 `ROOT_VARIABLES` 설명에 `$thread` 가 추가되었음을 `expression-constants.ts` 내 인라인 주석으로 명시한다.

### [INFO] `spec/4-nodes/0-overview.md §1.4.1` — filter DSL 표에 `length` 필터 미기재
- 위치: `spec/4-nodes/0-overview.md` 신규 섹션 `#### 1.4.1 템플릿 문법 (filter DSL)`
- 상세: 신규 추가된 filter 표에는 `upper`, `lower`, `default:LIT`, `fallback:path` 4종만 기재되어 있다. `plan/complete/spec-fix-node-summary-fallback-filter.md` 및 실제 `evaluator.ts` 구현에서는 `length` 필터(문자 수 반환)도 존재한다고 암시된다. 또한 `spec-sync-data-common-gaps.md` 의 재분류 노트는 `"DSL 에 줄 세기 없음"` 이라 하면서 `length` 가 문자 수임을 언급한다. 이 점이 표에 명시되지 않으면 독자가 `length` 의 존재·의미를 추론할 수 없다.
- 제안: 표에 `length` 행(문자 수 반환, 예: `{{query\|length}}`)을 추가하고 "줄 세기 불가"를 각주로 기술한다.

### [INFO] `spec/5-system/8-embedding-pipeline.md §6.1` — 미구현 marker 제거 여부 불명확
- 위치: `spec/5-system/8-embedding-pipeline.md §6.1 chunk metadata`
- 상세: 이번 변경에서 §4.3 CSV 청킹의 `(미구현 — Planned)` 표기는 제거되었으나, §6.1 `DocumentChunk.metadata {page?, section?}` 는 여전히 미구현이다. `plan/in-progress/spec-sync-embedding-pipeline-gaps.md` 에서도 이를 명시적으로 재확인했다. 해당 spec 본문에서 §6.1 이 여전히 `(미구현 — Planned)` 로 표기되어 있는지 이번 diff 에서 확인되지 않는다(변경 없음). 미구현 marker 가 그대로 남아 있다면 문제없지만, 만약 이번 작업 중 의도치 않게 제거됐을 가능성에 대한 명시적 확인이 없다.
- 제안: `spec/5-system/8-embedding-pipeline.md §6.1` 의 `(미구현 — Planned)` 표기가 현재 파일에 정확히 남아 있는지 확인한다. 이번 diff 상 해당 행은 변경되지 않았으므로 현황은 정합적이지만, `plan/in-progress` 티켓에서 marker 유지 근거를 spec 본문 주석으로 보강하면 추후 혼동을 줄일 수 있다.

### [INFO] `plan/complete/spec-draft-workspace-settings-api.md` — GET endpoint 문서화 위치 미확인
- 위치: `plan/complete/spec-draft-workspace-settings-api.md` 라인 426
- 상세: `@Get(':id/settings')` 엔드포인트가 구현되었음을 언급하지만, 이 GET 엔드포인트에 대한 스펙 등재(spec/2-navigation/9-user-profile.md §6.1 API 표, 또는 data-flow/12-workspace.md)가 실제로 반영되었는지 이번 diff 에서 확인되지 않는다. `spec-draft` 에는 `PATCH /api/workspaces/:id/settings` 만 §6.1 API 표에 명시되어 있다.
- 제안: GET `/api/workspaces/:id/settings` 도 spec §6.1 API 표에 별도 행으로 등재되어 있는지 확인한다. 없다면 추가가 필요하다.

### [INFO] `plan/complete/spec-sync-information-extractor-gaps.md` — 별건 이슈 추적 누락
- 위치: `plan/complete/spec-sync-information-extractor-gaps.md` 비고 섹션
- 상세: 비고에 "(1) 정적 backend schema `informationExtractorNodePorts` 의 `out` type 불일치, (2) `information-extractor.component.ts` 의 `conversationThreadService` 미주입 → `pushExtractorTurn` no-op" 두 건이 "spec 범위 밖, 본 plan 추적 아님" 으로 언급되어 있다. 그러나 별도 plan 티켓이 신설되었는지 이번 변경 범위에서 확인되지 않는다. 특히 `pushExtractorTurn no-op` 는 `$thread` 자동완성 추가(파일 1)와 연계되어 기능 불완전성을 유발할 수 있다.
- 제안: 이 두 별건을 추적하는 별도 plan 티켓이 있는지 확인하고, 없다면 신설한다. 특히 `$thread` 가 자동완성에 노출된 시점에 `pushExtractorTurn no-op` 이슈가 사용자에게 혼란을 줄 수 있으므로 문서화 주석이 필요하다.

### [INFO] `spec/4-nodes/2-flow/1-workflow.md §7` — `warnWhen` 표현식 DSL 참조 미기재
- 위치: `spec/4-nodes/2-flow/1-workflow.md §7` 캔버스 요약
- 상세: 새 본문에 `warnWhen: 'workflowId && !workflowName'` 이 등장하지만, 이 `warnWhen` DSL 의 문법·평가 방식에 대한 cross-ref 가 없다. 독자가 이 표현식이 어떻게 평가되는지(JavaScript 표현식인지, config path 기반인지) 알기 어렵다.
- 제안: `warnWhen` 의 평가 규약을 정의하는 spec 문서(예: node-common 또는 0-overview)로의 cross-ref 를 추가한다.

### [INFO] `plan/complete/spec-update-c-sync-promotions.md §3/§4` — 후속 작업 plan 파일 신설 여부 미확인
- 위치: `plan/complete/spec-update-c-sync-promotions.md §3`, §4
- 상세: §3 에서 `plan/in-progress/switch-regex-noop-fix.md` 를 신설했다고 기술하고, §4 에서 `workspace (owner_id,type) UNIQUE 마이그레이션 갭` 을 developer 후속으로 분리한다고 언급한다. 이번 diff 에서 해당 plan 파일의 실제 생성 여부가 포함되어 있지 않다.
- 제안: `plan/in-progress/switch-regex-noop-fix.md` 파일이 실제로 존재하는지 확인한다. 해당 파일이 없으면 plan 기술과 파일 상태가 불일치하는 문서 부정확성이 된다.

---

## 요약

이번 변경은 spec-sync groom 작업의 핵심 산출물로, 38개 파일에 걸쳐 "(미구현/Planned)" 마커 제거 및 spec 본문 현실화를 수행했다. 코드 파일은 `expression-constants.ts` 의 `$thread` 항목 추가 1건이며, 나머지는 모두 plan/spec 문서이다. 전반적으로 문서화 품질이 높다: 변경된 spec 본문에 Before/After 가 명확히 기록되고, Rationale 섹션이 결정 근거를 보존하며, plan 파일들이 구현 증거(commit hash)를 포함하고 있다. 주요 개선 여지는 (1) `$thread` 변수의 detail 문자열에 하위 접근자 힌트 부재, (2) `spec/4-nodes/0-overview.md §1.4.1` filter 표에 `length` 필터 누락, (3) `information-extractor` 의 `pushExtractorTurn no-op` 등 별건 이슈에 대한 독립 추적 plan 부재다. 보안·API 계약상의 비차단 수준 문서 부정확성은 발견되지 않았다.

## 위험도

LOW

# 요구사항(Requirement) Review — spec/conventions/cross-node-warning-rules.md

## 대상

`spec/conventions/cross-node-warning-rules.md` — frontmatter `status: partial → implemented`, `pending_plans` 항목 제거, `code:` 목록에 `tool-payload-save-warning.ts` 추가, §8 표의 `ai_agent:tool-payload-budget` 행에서 "⚠ 구현 예정(Planned)" 서술 제거 → 실제 구현 서술("`WorkflowsService` 가 `getGraphWarnings`(조회) 결과에 append 하고 `saveCanvas`(저장) 가 severity `error` 시 차단한다")로 대체.

이 문서 자체는 순수 spec 텍스트(코드 없음)이므로, 리뷰는 "spec 본문이 서술하는 동작 ↔ 실제 구현 코드"의 line-level 일치 여부에 집중했다. 대응 코드: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts`, `codebase/backend/src/modules/workflows/workflows.service.ts` (`saveCanvas`/`getGraphWarnings`/`evaluateToolPayloadWarnings`/`evaluateToolPayloadWarningsAndThrow`/`loadIntegrationsForBudget`), `codebase/frontend/src/lib/i18n/backend-labels.ts`(`GRAPH_WARNING_KO`), 대응 유닛테스트(`workflows.service.spec.ts`, `backend-labels.test.ts`).

## 발견사항

- **[INFO]** §8 표 새 서술과 실제 구현의 line-level 일치 확인 — 이상 없음
  - 위치: `spec/conventions/cross-node-warning-rules.md` §8 표 4번째 행 vs `workflows.service.ts:408-470`(`saveCanvas`), `:565-608`(`getGraphWarnings`), `:645-685`(`evaluateToolPayloadWarnings*`)
  - 상세: "`getGraphWarnings`(조회) 결과에 append" → `getGraphWarnings`가 `toolBudgetResults`를 `results` 배열에 spread(:593)로 확인. "`saveCanvas`(저장) 가 severity `error` 시 차단" → `saveCanvas`가 `evaluateToolPayloadWarningsAndThrow`(:451)를 호출하고, 이 메서드는 `toolBudgetStrictSave()` env 플래그가 켜져 있을 때만 평가해 `error` 발생 시 `GRAPH_VALIDATION_FAILED`로 throw(:666-685). §4.2/§10(`ai-agent.md`)의 "기본 warning, `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 시 hard 초과만 `error` 승격" 서술과도 `evaluateNodeToolPayload`(`tool-payload-save-warning.ts:184-234`)의 `severity = hardExceeded && toolBudgetStrictSave() ? 'error' : 'warning'` 로직이 정확히 일치.
  - 유닛테스트로도 직접 커버됨: `workflows.service.spec.ts:931`(getGraphWarnings가 append), `:962`(strict-save off 시 warning만), `:984`(strict-save+hard초과 시 GRAPH_VALIDATION_FAILED), `:1025`(strict-save off 시 saveCanvas가 통합 조회 자체를 skip).

- **[INFO]** i18n 매핑 의무(§5 예외 문단의 "backend-labels.test.ts 수동 등록" 서술) 이행 확인
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:634-645`(`GRAPH_WARNING_KO['ai_agent:tool-payload-budget']`), `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:300-315`(`BACKEND_ONLY_GRAPH_WARNING_RULE_IDS`)
  - 상세: KO 템플릿의 `{{node}}`/`{{bytes}}`/`{{toolCount}}`/`{{budget}}` 보간 키가 `tool-payload-save-warning.ts:219-225`의 `params` 필드(`node`/`bytes`/`toolCount`/`budget`/`culprit`)와 정확히 대응. `culprit`은 optional이라 KO 템플릿에서 미사용이나 이는 §3 `params` optional 원칙과 정합.

- **[SPEC-DRIFT 아님, WARNING]** `pending_plans` 제거 시점과 `plan/complete/` 이동 시점의 불일치 — spec-impl-evidence §3.1 문언과 실제 순서가 어긋남
  - 위치: `spec/conventions/cross-node-warning-rules.md` frontmatter `pending_plans` 삭제 vs `plan/in-progress/ai-agent-tool-payload-budget-followups.md`(여전히 `plan/in-progress/`에 존재, 체크리스트 마지막 항목 `[ ] PR (항목 A 단독)` 미완)
  - 상세: `spec/conventions/spec-impl-evidence.md` §3.1은 "`partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격"이라 명시한다. 그러나 실제로는 plan 파일이 `complete/`로 이동하지 않은 채(항목 B가 같은 plan 문서에 남아 in-progress 유지) `pending_plans` 항목만 제거되고 상태가 `implemented`로 승격됐다. 커밋 메시지(`7231f7006`)에 "항목 A 완료, 항목 B는 별도 후속 PR — plan은 in-progress 유지"로 의도가 명시돼 있고, 자동 가드(`spec-status-lifecycle.test.ts`(b)/(c), `spec-pending-plan-existence.test.ts`)는 필드 존재/실존만 검사하므로 이 케이스에서는 fail하지 않는다(실측 확인). 즉 build는 통과하지만, §3.1의 "동일 commit에서 plan이 complete로 이동해야 승격"이라는 문언과는 어긋나는 사례다. 다만 이는 이 파일(cross-node-warning-rules.md) 자체의 버그가 아니라 **복수 항목을 담은 plan 문서를 부분 완료 처리하는 케이스**를 §3.1/R-5가 명시적으로 다루지 않아 생기는 컨벤션 공백이며, 코드 동작 자체는 정확히 구현돼 있으므로 CRITICAL로 분류하지 않는다.
  - 제안: 이 자체는 project-planner가 판단할 사안 — (a) §3.1에 "plan 문서가 여러 독립 항목을 다룰 때는 해당 spec에 관련된 항목만 완료되면 그 spec의 pending_plans 참조를 제거할 수 있다"는 예외 문구를 추가하거나, (b) 항목 A/B를 애초에 별도 plan 파일로 분리해 §3.1의 "1 plan ↔ 1 완료 이동" 가정을 유지하는 방향을 고려. 코드 되돌리기 대상 아님.

- **[INFO]** `ai-agent.md` frontmatter `status: partial` 잔존은 이 파일(cross-node-warning-rules.md)의 범위 밖
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md:3`(리뷰 대상 diff 밖, 참고용으로만 확인)
  - 상세: 같은 PR에서 `ai-agent.md`도 pending_plans에서 followups plan을 제거했으나 `status: partial`은 그대로다(다른 미구현 surface, 예: `tool_call_not_implemented` 미구현이 남아있어 타당). cross-node-warning-rules.md는 이 node의 다른 미구현 항목과 무관한 독립 컨벤션이므로 `implemented` 승격이 그 자체로는 타당하다.

## 요약

`spec/conventions/cross-node-warning-rules.md`의 frontmatter status 승격과 §8 표 서술 변경은 실제 구현 코드(`tool-payload-save-warning.ts`, `workflows.service.ts`의 `saveCanvas`/`getGraphWarnings`/`evaluateToolPayloadWarnings*`)와 line-level로 정확히 일치하며, severity 정책(`AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 승격 규칙)·i18n `params` 계약·backend-only P3-C-1 가드 등록까지 유닛테스트로 교차 검증된다. 유일한 특이사항은 `pending_plans` 제거가 §3.1이 규정한 "plan이 `complete/`로 이동한 동일 commit에서 승격" 문언과 엄밀히 일치하지 않는다는 점인데(plan 파일은 항목 B 때문에 여전히 in-progress), 이는 커밋 메시지에 의도가 명시된 의식적 결정이고 자동 가드도 통과하며 코드 동작 자체는 완전하므로 기능 결함이 아니다. 코드 fix가 필요한 CRITICAL/WARNING 발견사항은 없다.

## 위험도

NONE

# 문서화(Documentation) Review

대상: AI Agent 도구 payload 예산 — 저장 시점(config-time) graph warning 추가 (`ai_agent:tool-payload-budget`), `WorkflowsService.getGraphWarnings`/`saveCanvas` 배선, cafe24/makeshop pure 추출 함수 승격, 신규 env var `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`.

## 발견사항

- **[WARNING]** 존재하지 않는 파일명(`config-time-tool-budget.ts`)을 가리키는 stale 주석 4곳
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts:199, :707`, `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts:205, :718`
  - 상세: 두 provider 파일의 인라인 주석·JSDoc 이 "저장 시점 payload 예산 경고(WorkflowsService, `config-time-tool-budget.ts`)"라고 언급한다. 그러나 본 PR 이 실제로 생성한 config-time 평가 모듈의 파일명은 `tool-payload-save-warning.ts` 다 — `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 에 "파일명 결정: config-time 평가 모듈은 `tool-payload-save-warning.ts`(런타임 `tool-payload-budget.ts` 와 명확히 구분)"라고 명시돼 있고, `spec/conventions/cross-node-warning-rules.md` 도 `tool-payload-save-warning.ts` 를 정확히 참조한다. `config-time-tool-budget.ts` 라는 파일은 리포지토리 어디에도 존재하지 않는다(grep 0건). 이 주석만 보고 config-time 모듈을 찾으려는 개발자가 잘못된 경로를 검색하게 된다. 4곳 모두 같은 문구가 반복돼(복붙) 동일 실수가 두 provider 파일에 중복됐다.
  - 제안: 네 곳 모두 `config-time-tool-budget.ts` → `tool-payload-save-warning.ts` 로 정정.

- **[WARNING]** 신규 env var `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 가 `.env.example` 에 미등재
  - 위치: `codebase/backend/.env.example:319-336` (AI Agent 도구 payload 예산 섹션)
  - 상세: 같은 예산 체계의 선행 3종(`AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`/`_HARD_BYTES`/`AI_AGENT_TOOL_COUNT_MAX`)은 이 섹션에 값·설명과 함께 정확히 등재돼 있으나, 이번 PR 이 도입한 네 번째 env var `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`(`true` 설정 시 저장 시점 hard 초과를 severity `warning`→`error` 로 승격해 `saveCanvas` 를 `GRAPH_VALIDATION_FAILED` 400 으로 차단하는 운영 스위치)는 `.env.example` 전체를 grep 해도 등장하지 않는다. `spec/4-nodes/3-ai/1-ai-agent.md` §4.2 표에는 정확히 등재돼 있지만, 운영자가 실제 배포 값을 조정할 때 1차로 참조하는 소스는 `.env.example` 이므로 발견성이 크게 떨어진다. 이 플래그는 opt-in 시 워크플로 저장 자체를 막는 실질적 동작 변화가 있는 설정이라 누락의 영향이 작지 않다. (참고: 직전 런타임 가드레일 PR 리뷰에서도 동일 패턴 — spec 표에는 있지만 `.env.example` 에 없음 — 이 지적된 뒤 그 PR 의 3종은 수정됐는데, 이번 PR 이 추가한 4번째 var 가 같은 문제를 반복한다.)
  - 제안: 기존 섹션에 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=false` 한 줄과 짧은 설명("true 시 저장 시점 hard 초과를 error 로 승격해 저장 차단") 추가.

- **[WARNING]** CHANGELOG 에 이번 후속(config-time 저장 경고) 항목이 반영되지 않음
  - 위치: `CHANGELOG.md` 최상단 "Unreleased — AI Agent 도구 정의 payload 예산 가드레일" 섹션
  - 상세: 해당 섹션 항목 4는 "**후속(본 PR 범위 밖)**: config-time 저장 경고(backend-only graph warning, `getGraphWarnings`/`saveCanvas` strict surface)... 는 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 로 분리했다"라고 명시적으로 이번 기능을 향후 별도 변경으로 예고해 두었다. 그런데 본 diff(항목 A 구현)는 `CHANGELOG.md` 를 전혀 건드리지 않는다(4개 관련 커밋 `60a80fda2`/`7231f7006`/`e9d7f676d`/`808017aaf` 어디에도 CHANGELOG 변경 없음). 병합되면 "새 backend-only graph warning rule 추가 + `GET /workflows/:id/graph-warnings` 응답에 새 rule 포함 + `saveCanvas` 400 차단 조건 신설 + 신규 env var" 라는 사용자/운영자 영향 변경이 CHANGELOG 상 기록 없이 반영된다.
  - 제안: 새 "Unreleased" 항목(또는 기존 섹션에 이어)에 config-time 저장 경고 rule(`ai_agent:tool-payload-budget`)·응답 변경·`AI_AGENT_TOOL_BUDGET_STRICT_SAVE` env var 추가를 명시.

- **[INFO]** `WorkflowsService.getGraphWarnings` 메서드 JSDoc 이 새 `workspaceId` 파라미터·backend-only 결과 append 를 설명하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`getGraphWarnings` 상단 JSDoc, 약 547-554행)
  - 상세: JSDoc 은 여전히 "워크플로 nodes/edges 를 로드하고 graphWarningRules 를 평가한다"로만 서술한다. 실제로는 (a) 신규 `workspaceId` 파라미터가 추가됐고(용도는 컨트롤러 호출부 주석에만 설명돼 있음), (b) 반환 `results` 에 이제 `evaluateGraphWarningRulesForGraph`/`evaluateGraphCycleWarnings` 외에 backend-only `ai_agent:tool-payload-budget` 평가 결과도 append 된다(메서드 본문 내부에는 정확한 인라인 주석이 있음). 메서드 상단 공개 JSDoc 자체는 갱신되지 않아, 시그니처·JSDoc 만 보고 동작을 파악하려는 소비자에게는 불완전한 정보를 준다.
  - 제안: `@param workspaceId` 설명 한 줄 + "AI Agent 도구 payload 예산 backend-only rule 도 결과에 포함된다" 한 줄 추가.

- **[INFO]** `/workflows/:id/graph-warnings` Swagger `@ApiOperation.description` 이 이번에 추가된 backend-only rule 을 언급하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`graphWarnings` 핸들러의 `@ApiOperation`)
  - 상세: description 은 "NodeComponentMetadata 의 graphWarningRules(cross-node) 를 워크플로우 nodes/edges 전체에 대해 평가해 위반 목록을 반환합니다"로만 서술한다. 이제 응답에는 그 범주 밖의 backend-only async rule(`ai_agent:tool-payload-budget`, `WorkflowsService` 가 통합 조회 후 직접 append)도 섞여 나온다. Swagger 문서만 보는 API 소비자 입장에서는 일부 응답 항목의 출처·평가 시점(async 통합 조회 포함)이 설명에서 빠져 있다.
  - 제안: description 에 "graph 전역 사이클 경고 및 backend-only async rule(예: AI Agent 도구 payload 예산)도 포함됩니다" 한 문장 추가.

## 긍정적으로 확인된 사항 (참고)

- `tool-payload-save-warning.ts`(신규 모듈), `tool-payload-budget.ts` 의 `toolBudgetStrictSave()`, `cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts` 의 신규 export 함수(`buildCafe24ToolDefsForIntegration`/`buildCafe24JsonSchema`/`buildMakeshopToolDefsForIntegration`) 는 모두 배경·계약·side-effect 유무·spec SoT 링크를 포함한 상세 JSDoc 을 갖췄다.
- `workflows.module.ts`/`workflows.service.ts`의 신규 인라인 주석은 순환 참조 회피 이유·트랜잭션 밖 read-only 조회 근거 등 "왜" 를 정확히 설명한다.
- 신규 e2e 스펙(`test/ai-agent-tool-payload-warning.e2e-spec.ts`)의 파일 상단 docstring은 단위/통합 테스트와의 책임 분담·결정성 근거(makeshop 163 operation > count 상한 128)를 명확히 기술한다.
- spec 문서(`spec/4-nodes/3-ai/1-ai-agent.md` §4.2/§10, `spec/conventions/cross-node-warning-rules.md` §5/§8)는 별도 커밋(`7231f7006`)으로 이미 "Planned" 마커를 제거해 구현 완료 상태로 갱신돼 있다.
- `frontend/src/lib/i18n/backend-labels.ts`/`backend-labels.test.ts`의 KO 매핑·backend-only ruleId 수동 등재 목록 추가는 주석으로 "왜 수동 등록이 필요한지"(P3-C-1 자동 스캔 사각지대)를 정확히 설명한다.

## 요약

핵심 로직(`tool-payload-save-warning.ts`, pure 추출 함수 승격, `WorkflowsService` 배선)의 JSDoc·인라인 주석 품질은 전반적으로 높고 spec SoT 참조도 정확하다. 다만 두 provider 파일에 실재하지 않는 파일명(`config-time-tool-budget.ts`)을 가리키는 복붙 주석이 4곳 남아 있고, 이번에 도입한 운영 스위치 env var(`AI_AGENT_TOOL_BUDGET_STRICT_SAVE`)가 `.env.example` 에 등재되지 않았으며, 이 후속 PR을 명시적으로 예고했던 CHANGELOG 항목이 실제 구현 반영 시점에 갱신되지 않았다 — 세 가지 모두 조치 권장 수준(WARNING)의 실제 문서 정합성 갭이다. `getGraphWarnings` 메서드 JSDoc 과 Swagger description 은 새 파라미터·새 rule 포함 사실을 반영하지 않아 보완이 필요하지만 참고 수준(INFO)이다.

## 위험도

MEDIUM

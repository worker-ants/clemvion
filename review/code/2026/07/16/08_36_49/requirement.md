# 요구사항(Requirement) Review 결과

## 대상

AI Agent 도구 정의 payload 예산의 **저장 시점(config-time) graph warning** 배선
(항목 A, `plan/in-progress/ai-agent-tool-payload-budget-followups.md`) — 17개
파일(backend `WorkflowsService`/`WorkflowsController`/`WorkflowsModule` +
신규 `tool-payload-save-warning.ts` + cafe24/makeshop provider pure 함수 추출 +
`toolBudgetStrictSave()` + frontend i18n + e2e).

관련 spec: `spec/4-nodes/3-ai/1-ai-agent.md` §4.2·§10·§12.15,
`spec/conventions/cross-node-warning-rules.md` §5·§8 — 두 문서 모두 본 PR 에서
함께 갱신되었고(§8 rule 표 신설, cross-node-warning-rules `status: partial→
implemented`), 아래 line-level 대조 결과 코드와 spec 본문이 정확히 일치한다.

## 검증 수행

- `spec/4-nodes/3-ai/1-ai-agent.md` §4.2 (env 4개: `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`
  =98304 / `_HARD_BYTES`=262144 / `AI_AGENT_TOOL_COUNT_MAX`=128 /
  `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`=false) ↔ `tool-payload-budget.ts` 구현 —
  기본값·동작 모두 일치.
- §10 "도구 정의 payload 예산 경고 (저장 시점)" 문단 ↔ `WorkflowsService.
  getGraphWarnings`(append)/`saveCanvas`(error 시 `GRAPH_VALIDATION_FAILED`
  차단) 배선 — line-level 일치. rule id `ai_agent:tool-payload-budget`,
  severity 승격 조건(hard 또는 count 초과 **AND** strict-save) 일치.
- `cross-node-warning-rules.md` §5 "backend-only async rule" 예외 조항(가드②
  생략, 가드①+런타임 가드③ 로 대체) ↔ 구현의 3중 가드 배선 일치. §8 rule 표
  ↔ `AI_AGENT_TOOL_PAYLOAD_BUDGET_RULE_ID` 상수·severity 문구 일치.
- `GraphWarningRuleResult` 필드(`ruleId/severity/nodeId/message/params`, 패키지
  `@workflow/graph-warning-rules/src/types.ts`) ↔ `evaluateNodeToolPayload` 반환
  객체 shape 일치.
- 테넌트 경계: `getGraphWarnings(id, workspaceId)` → `loadIntegrationForBudget`
  → `integrationRepository.findOne({ where: { id, workspaceId } })` — runtime
  `IntegrationsService.getForExecution`/`requireEntity` 와 동일한 스코프 패턴
  (IDOR 방지: config 의 `mcpServers[].integrationId` 가 타 workspace 의
  integration 을 가리켜도 조회 자체가 null).
- 단위 테스트 실행: `tool-payload-save-warning.spec.ts` /
  `tool-payload-budget.spec.ts` / `workflows.service.spec.ts` /
  `workflows.controller.spec.ts` / `cafe24-mcp-tool-provider.spec.ts` /
  `makeshop-mcp-tool-provider.spec.ts` — 6 suites, 207 tests 전부 통과.
  frontend `backend-labels.test.ts` — 20 tests 통과.
- `npx tsc --noEmit -p codebase/backend/tsconfig.build.json` — 에러 없음
  (참고: `tsconfig.json`(spec 파일 포함) 로 돌리면 본 PR 무관 사전 존재
  타입 에러 다수가 나오나 이는 `nest build` 가 쓰는 `tsconfig.build.json`
  범위 밖 — 오탐).
- `Cafe24McpToolProvider`/`MakeshopMcpToolProvider` 의 `buildJsonSchema`/
  `applyAllowlist` 인스턴스 메서드 → module-level pure 함수 승격 리팩터가
  런타임 동작을 바꾸지 않음을 diff 로 직접 대조 확인(로직 이동만, side-effect
  분리는 diff 주석대로).

## 발견사항

- **[INFO]** `restoreVersion`(스냅샷 복원)은 `skipLegacyDataGates=true` 로
  Manual Trigger/예약변수명 게이트만 건너뛰고, 새로 추가된 tool-payload
  budget 저장 게이트(`evaluateToolPayloadWarningsAndThrow`)는 건너뛰지 않는다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:407-465` (`saveCanvas`), `restoreVersion` 이 내부적으로 `saveCanvas` 호출
  - 상세: `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 인 환경에서, 과거엔 정상
    저장됐던 오래된 워전 버전을 복원할 때 그 사이 연결된 integration 의
    카탈로그가 커졌다면(예: 스코프 추가) 복원이 `GRAPH_VALIDATION_FAILED`
    로 막힐 수 있다. 다만 이는 신규 버그가 아니라 기존 `evaluateGraphWarnings`
    (parallel-p2 게이트)도 동일하게 `skipLegacyDataGates` 예외 대상이 아닌
    기존 패턴을 그대로 따른 것 — 의도적 일관성으로 보인다.
  - 제안: spec/plan 어디에도 이 상호작용이 명시되어 있지 않으므로, strict-save
    운영 시 "버전 복원이 저장 시점 게이트에 걸릴 수 있다"는 점을 인지하고
    있으면 충분 (코드 수정 불필요, spec 침묵 영역).

- **[INFO]** `evaluateAiAgentToolPayloadWarnings` 는 노드마다 `deps.
  loadIntegration` 을 개별 호출하며 caller(`WorkflowsService.
  loadIntegrationForBudget`) 도 노드/서버 참조별 캐시가 없다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts:1401-1471`, `codebase/backend/src/modules/workflows/workflows.service.ts:547-557`
  - 상세: 동일 integration 을 참조하는 ai_agent 노드가 다수인 대형 그래프의
    경우 `getGraphWarnings` 호출마다 같은 integration row 를 중복 조회한다.
    기능 정확성에는 영향 없음(각 조회 결과는 동일 pure 재현으로 이어짐).
  - 제안: 없음(현재 규모에서 문제 없음) — 향후 대형 워크플로 성능 이슈가
    보고되면 `Map<integrationId, Promise<Integration|null>>` 메모이제이션
    검토.

- **[INFO]** `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` 한국어 템플릿은
  `{{node}}/{{bytes}}/{{toolCount}}/{{budget}}` 만 보간하고 영문 SoT 메시지에
  있는 "largest contributor"(`culprit` param)는 KO 문구에서 생략된다.
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:638-643`
  - 상세: `params.culprit` 자체는 optional(존재할 때만 세팅)이라 P3-C-1 가드
    위반은 아니며, "범인 provider 지목" 정보가 한국어 사용자에게는 노출되지
    않는 정도의 정보 손실. spec §4.2/§10 은 KO 문구의 각 param 노출 여부까지
    규정하지 않아 spec 위반은 아니다(회색지대).
  - 제안: UX 상 도움이 된다면 KO 템플릿에 `({{culprit}} 이 가장 큼)` 류 문구
    추가 검토(선택사항).

- **[INFO]** `workflows.service.ts` 의 `settings: { ...dto.settings } as
  Record<string, unknown>` → `{ ...dto.settings }` 캐스트 제거는 본 기능과
  무관한 별개 정리(리베이스 후속 커밋 `808017aaf`)로 diff 에 섞여 있다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:308-316` (`importWorkflow`)
  - 상세: `manager.create(Workflow, {...})` 의 구조적 타입 추론상 캐스트가
    불필요했던 것으로 보이며 동작 변화 없음(단순 타입 정리). 기능 결함 아님.
  - 제안: 없음 — 참고용 기록.

## 요약

`WorkflowsController`→`WorkflowsService`(`getGraphWarnings(id, workspaceId)`/
`saveCanvas`)→`evaluateAiAgentToolPayloadWarnings`(신규 `tool-payload-save-
warning.ts`)→cafe24/makeshop provider 에서 추출한 pure 재현 함수까지 이어지는
배선이 `spec/4-nodes/3-ai/1-ai-agent.md` §4.2·§10·§12.15 와
`spec/conventions/cross-node-warning-rules.md` §5·§8 본문과 필드명·에러
코드(`GRAPH_VALIDATION_FAILED`)·기본값·severity 승격 조건·rule id 까지
line-level 로 정확히 일치한다. 두 spec 문서가 이 PR 안에서 함께 갱신돼
spec-drift 도 없다. 테넌트 스코프(workspaceId) 조회, best-effort skip(비
connected/generic MCP/조회 실패), 런타임-config-time 도구 정의 drift-0
계약(pure 함수 공유 + 회귀 테스트), i18n backend-only ruleId 강제 등록까지
빠짐없이 구현·테스트(207+20 unit tests 통과, tsc 클린)됐다. 발견된 3건은 모두
INFO 수준으로 기능 결함이 아니라 향후 참고 사항(버전 복원과 strict-save 상호
작용, integration 조회 캐싱 부재, KO 문구 정보 손실)이다.

## 위험도

NONE

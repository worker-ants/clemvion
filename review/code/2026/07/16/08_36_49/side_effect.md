# 부작용(Side Effect) 리뷰 결과

대상: AI Agent 도구 payload 예산 config-time 저장 경고 (`ai_agent:tool-payload-budget`) — `WorkflowsService`/`WorkflowsController`/`WorkflowsModule` 배선, `tool-payload-save-warning.ts` 신설, cafe24/makeshop tool provider pure 함수 추출, i18n 등재, spec 갱신.

## 발견사항

- **[WARNING]** `saveCanvas` 트랜잭션 내부에서 트랜잭션 매니저가 아닌 별도 커넥션으로 `Integration` 을 조회
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `saveCanvas` (L441-459) → `evaluateToolPayloadWarningsAndThrow` → `evaluateToolPayloadWarnings` → `loadIntegrationForBudget` (L546-556)
  - 상세: `saveCanvas` 는 `this.dataSource.transaction(async (manager) => {...})` 로 커넥션을 하나 점유한 채 실행되는데, 새로 추가된 `evaluateToolPayloadWarningsAndThrow(savedNodes, workspaceId)` 는 `manager.getRepository(Integration)` 이 아니라 클래스에 주입된 `this.integrationRepository`(트랜잭션 밖 기본 커넥션)를 사용한다. 즉 트랜잭션이 열려 있는 동안 ai_agent 노드의 `mcpServers[]` 항목마다 커넥션 풀에서 별도 커넥션을 추가로 빌려 쓰는 라운드트립이 발생한다. 코드 주석은 "통합 조회는 트랜잭션 밖 커밋 데이터에 대한 read-only 라 rollback 무관"이라 정합성만 검토했고, 커넥션 풀 점유량이 저장 1건당 최대 2배(트랜잭션용 1 + 통합 조회용 1)로 늘어나는 리소스 측면은 다루지 않았다. 커넥션 풀이 작은 환경에서 동시 저장이 몰리면 통합 조회가 풀 고갈로 대기하다가 트랜잭션 보유 시간이 늘어나는 방향으로 상호작용할 수 있다. 또한 이 조회는 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 가 꺼져 있어도(기본값) 매 `saveCanvas` 호출마다 무조건 수행되어, 이 기능이 실질적으로 아무것도 차단하지 않는 배포에서도 쓰기 경로에 지연을 추가한다.
  - 제안: 가능하면 `manager.getRepository(Integration)` (트랜잭션 매니저 스코프)으로 조회해 커넥션을 하나로 유지하거나, 최소한 부하 테스트/모니터링으로 커넥션 풀 여유를 확인. 별도 커넥션 사용이 의도적이라면(예: 통합 조회 실패가 트랜잭션에 영향 주지 않도록 격리) 그 트레이드오프를 주석에 명시.

- **[INFO]** `getGraphWarnings` 시그니처 변경 — 파라미터 삽입 (breaking 형태지만 영향 없음 확인)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` L556 (`getGraphWarnings(workflowId, workspaceId, opts = {})`, 기존은 `(workflowId, opts = {})`)
  - 상세: `WorkflowsService` 는 모듈에서 `export` 되므로 이론상 다른 모듈이 주입해 호출할 수 있다. `grep` 결과 저장소 전체에서 호출자는 `workflows.controller.ts` 1곳뿐이며 정확히 갱신돼 있다. TypeScript 타입 시스템상 `opts` 객체를 두 번째 인자로 넘기면 컴파일 에러가 나므로 silent 런타임 landmine 은 아니다. REST 엔드포인트(`GET /workflows/:id/graph-warnings`)는 URL/응답 계약 불변 — `workspaceId` 는 기존에도 `@WorkspaceId()` 데코레이터로 추출해 쓰던 값을 서비스 메서드에 추가로 넘기는 것뿐이라 외부 API 소비자에는 영향 없음.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** config-time 도구 재현이 `RenderToolProvider.buildTools` 를 더미 `workspaceId: ''` 로 재사용
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` L1432-1440 (`reproduceConfigToolDefs`)
  - 상세: 현재 `RenderToolProvider.buildTools` 는 `ctx.config.presentationTools` 만 읽는 사실상 pure 함수라 안전하지만, 이 재사용은 "향후에도 workspaceId 를 안 쓴다"는 암묵적 계약에 의존한다. 향후 `RenderToolProvider.buildTools` 가 workspaceId 기반 조회/로깅을 추가하면 config-time 평가 경로가 빈 문자열 workspaceId 로 조용히 잘못 동작(오탐/누락)할 수 있다.
  - 제안: 타입 수준 가드는 어렵지만, `RenderToolProvider.buildTools` 파일 상단에 "config-time 재사용 전제 — workspaceId 비의존 유지" 주석을 남기거나, 이 함수 자체에 계약 테스트(예: workspaceId 를 다르게 줘도 결과 동일)를 추가하면 회귀를 조기에 잡을 수 있음.

- **[INFO]** `RenderToolProvider.buildTools` 의 `logger.warn` 호출 빈도 증가 (부수적 로깅 side effect)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` (기존 로직, 신규 호출 경로만 추가) — 호출측: `tool-payload-save-warning.ts` L1433-1440
  - 상세: `presentationTools` 항목의 `type` 이 비정상이면 기존에는 노드 **실행 시점**에만 warn 로그가 찍혔는데, 이제 `getGraphWarnings` 조회/저장 시점마다도 동일 로그가 찍힌다. 기능상 문제는 없으나 malformed config 를 가진 워크플로를 조회할 때마다 로그 볼륨이 늘어난다.
  - 제안: 로그 레벨/샘플링 조정이 필요하면 별도 후속에서 고려. 현재는 허용 가능한 수준으로 판단.

- **[INFO]** `WorkflowsModule` 에 `Integration` 엔티티 등록 — 안전 확인됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.module.ts` L101
  - 상세: `TypeOrmModule.forFeature([..., Integration])` 를 `WorkflowsModule` 에 추가해 `Integration` 리포지토리 provider 가 새로 생긴다. `IntegrationsModule` 을 import 하지 않아 순환 참조는 없다는 주석 근거를 코드로 확인(엔티티 클래스만 import, 모듈 import 아님). `Integration.credentials` 컬럼은 `encryptedJsonTransformer` 를 사용해 조회 시 복호화되지만 이는 기존 동작이며, `loadIntegrationForBudget` 은 `integrationRepository.findOne` (순수 조회)만 사용해 토큰 refresh 등 외부 네트워크 호출을 유발하는 `IntegrationsService.getForExecution` 경로와는 분리돼 있음을 확인. 부작용 없음.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 무관한 타입 캐스트 제거 (behavior-neutral)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` L444 (`importWorkflow`) — `settings: { ...dto.settings } as Record<string, unknown>` → `settings: { ...dto.settings }`
  - 상세: 런타임 값은 동일(`{...dto.settings}`)하며 타입 단언만 제거됐다. 이번 PR 의 다른 타입 변경(`GraphWarningRuleResult[]` 명시화)과 무관해 보이는 diff 노이즈로 보이나 동작에는 영향 없음.
  - 제안: 없음.

- **[INFO]** cafe24/makeshop tool provider 의 private 메서드가 module-level export 함수로 승격
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (`buildCafe24ToolDefsForIntegration`, `buildCafe24JsonSchema` export), `makeshop-mcp-tool-provider.ts` (`buildMakeshopToolDefsForIntegration` export)
  - 상세: 기존 `private` 인스턴스 메서드(`applyAllowlist`/`buildJsonSchema`)를 제거하고 동일 로직의 module-level pure 함수를 새로 `export` 했다. 순수 추가(additive) 공개 표면이라 기존 호출자에 영향 없음. 테스트로 런타임 `buildTools` 출력과 동일함(drift 0)을 회귀 검증함을 확인. 새로 노출된 함수를 다른 모듈이 import 하기 시작하면 결합도가 늘어나는 점은 통상적 트레이드오프.
  - 제안: 없음 — 설계 의도대로 동작.

- **[INFO]** 신규 환경변수 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` `toolBudgetStrictSave()`
  - 상세: 기존 `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`/`_HARD_BYTES`/`AI_AGENT_TOOL_COUNT_MAX` 와 동일한 "매 호출 process.env 읽기" 패턴을 따르는 read-only 환경변수. 쓰기 없음, 기본값 `false`(기존 동작 불변). 부작용 없음.
  - 제안: 없음.

## 요약

핵심 부작용 우려는 하나로 수렴한다 — `saveCanvas` 트랜잭션이 열려 있는 동안 새로 추가된 `evaluateToolPayloadWarningsAndThrow` 가 트랜잭션 매니저가 아닌 별도 커넥션으로 `Integration` 을 조회해, 저장 경로의 커넥션 풀 점유·지연 프로파일을 (기능 플래그가 꺼져 있어도) 조용히 바꾼다. 이 외 시그니처 변경(`getGraphWarnings`)·모듈 배선(`Integration` 엔티티 등록)·pure 함수 승격은 모두 호출자 전수 확인 결과 안전하며, `Integration` 조회 경로도 토큰 refresh 등 외부 네트워크 부작용 없이 read-only 로 격리돼 있음을 코드로 확인했다. CRITICAL 급 부작용(전역 상태 오염, 예상치 못한 외부 호출, 공개 API 파손)은 발견되지 않았다.

## 위험도

LOW

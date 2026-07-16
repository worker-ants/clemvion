# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** `saveCanvas` 가 strict-save 가 꺼져 있어도(기본값) 트랜잭션 내부에서 매번 Integration N회 조회를 수행 — 레이어 결합/성능 이슈
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `saveCanvas()` 내 `await this.evaluateToolPayloadWarningsAndThrow(savedNodes, workspaceId);` (구 `evaluateGraphWarnings` 바로 다음, `createVersion` 이전)
  - 상세: `evaluateNodeToolPayload`(`tool-payload-save-warning.ts`)는 `severity = hardExceeded && toolBudgetStrictSave() ? 'error' : 'warning'` 로 계산한다. `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`(기본 `false`, 즉 운영 기본값)가 꺼져 있으면 severity 는 절대 `'error'` 가 될 수 없으므로 `evaluateToolPayloadWarningsAndThrow` 의 `errors.length > 0` 분기(throw)는 도달 불가능한 dead path 다. 그런데도 이 호출은 조건 없이 `saveCanvas` 의 write 트랜잭션 **내부**에서 매 저장마다 실행되어, ai_agent 노드가 참조하는 통합마다 `integrationRepository.findOne` 왕복을 수행한다(§아래 N+1 항목과 결합하면 더 커짐). 결과적으로 절대 rollback 을 유발하지 못하는 advisory 체크가 트랜잭션 지속시간을 늘리고 `createVersion` 의 pessimistic lock 획득 전 대기시간을 키운다. surfacing 은 이미 `getGraphWarnings` 조회 endpoint 가 전담한다고 스스로 문서화했으므로(주석 "표면화는 getGraphWarnings 조회 endpoint 가 전담"), `saveCanvas` 쪽 평가는 오직 error-block 용도인데 그 용도가 기본 설정에서 항상 no-op 이다.
  - 이는 같은 파일의 기존 컨벤션과도 배치된다 — `importWorkflow()` 는 정확히 이 문제를 이미 인지하고 `defaultLlm` 조회를 "트랜잭션 외부에서 1회만 조회한다 (loop 내 호출 방지 + write 트랜잭션에 read 미포함)" 라고 명시적으로 분리해 두었다. 이번 변경은 동일 파일에서 그 원칙과 반대로 cross-domain read(Integration)를 write 트랜잭션 안에 넣었다.
  - 제안: `evaluateToolPayloadWarningsAndThrow` 호출 전체를 `if (toolBudgetStrictSave()) { ... }` 로 감싸 strict-save 가 꺼진 기본 상태에서는 아예 평가를 건너뛴다(현재도 결과가 저장 응답에 노출되지 않으므로 동작 불변). strict-save 가 켜진 배포에서만 트랜잭션 내 read 비용을 지불하도록 한다.

- **[WARNING]** `WorkflowsService` 가 `IntegrationsService`(소유 모듈의 비즈니스 레이어)를 우회해 `Repository<Integration>` 를 직접 주입 — 데이터 접근 로직 중복/drift 위험
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `loadIntegrationForBudget()`, `codebase/backend/src/modules/workflows/workflows.module.ts` `TypeOrmModule.forFeature([..., Integration])`
  - 상세: `loadIntegrationForBudget` 은 `integrationRepository.findOne({ where: { id, workspaceId } })` + `isUnreadableCredentials(...)` 체크를 재구현한다. 이는 `IntegrationsService.getForExecution()`(`requireEntity` + `isUnreadableCredentials`)와 정확히 같은 판정 로직의 별도 사본이다. 실제로 확인해보니 `WorkflowsModule` 이 `IntegrationsModule` 을 직접 import 하면 `IntegrationsModule → NotificationsModule → WebsocketModule → WorkflowsModule` 순환이 닫히므로(`grep` 로 검증), repository 직접 주입으로 순환을 피한 판단 자체는 타당하다. 다만 이 트레이드오프의 결과로 "not-found/credentials-unreadable" 판정 로직이 두 곳(IntegrationsService, WorkflowsService)에 독립적으로 존재하게 됐고, 향후 `IntegrationsService.requireEntity`/`getForExecution` 에 정책이 추가(예: soft-delete 필터, 추가 tenant 불변식)돼도 이 사본은 자동으로 따라가지 않는다.
  - 제안: 순환을 만들지 않는 선에서 이 판정을 한 곳에 두는 방안을 검토 — 예를 들어 `isUnreadableCredentials` 처럼 이미 순수 유틸(별도 서비스 의존 없음)로 분리돼 있으니, `requireEntity` 상당의 조회 로직도 `IntegrationsModule` 밖의 얇은 유틸/포트로 뽑아 양쪽이 공유하게 하거나, 최소한 두 구현이 같은 동작을 내는지 확인하는 회귀 테스트(parity test)를 추가해 silent drift 를 방지한다.

- **[WARNING]** `evaluateAiAgentToolPayloadWarnings` 내 `loadIntegration` 호출에 캐싱/배치 없음 — N+1 조회
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` `reproduceConfigToolDefs()` (mcpServers 순회 루프), `evaluateAiAgentToolPayloadWarnings()` (노드 순회 루프)
  - 상세: 노드마다, 그리고 노드 내 `mcpServers` 참조마다 `deps.loadIntegration(id)` 를 순차 `await` 로 호출하며 결과를 캐시하지 않는다. 여러 ai_agent 노드가 동일 통합(예: 워크스페이스 공용 cafe24 계정)을 참조하는 흔한 시나리오에서 동일 Integration row 를 노드 수만큼 반복 조회한다. 이 함수는 `getGraphWarnings`(조회) 뿐 아니라 `saveCanvas`(쓰기 트랜잭션 내부, 위 항목 참고)에서도 호출되므로 그래프 크기에 비례해 저장 지연·잠금 지속시간이 늘어난다.
  - 제안: 평가 1회 호출 범위 내에서 `integrationId → Integration` 메모이제이션(Map 캐시)을 두거나, 사전에 참조된 integrationId 를 전부 모아 단일 `findByIds`/`In(...)` 쿼리로 배치 조회한 뒤 순수 평가 로직에 넘긴다.

- **[WARNING]** 런타임 예외 메시지(`buildBudgetExceededPrefix`)와 config-time 경고 메시지(`evaluateNodeToolPayload`)가 별도로 하드코딩되어 동일 문구를 두 곳에서 독립 유지 — 재도입된 템플릿 중복
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` `buildBudgetExceededPrefix()` vs `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` `evaluateNodeToolPayload()` 내 인라인 `message` 템플릿 리터럴
  - 상세: `tool-payload-budget.ts` 의 `buildBudgetExceededPrefix` 는 정확히 "hard(throw)·soft(warn) 두 메시지가 공유하는 본문... (INFO6, 03 리뷰 — 중복 템플릿 통합)" 이라는 과거 리뷰로 도입된, 문구 중복 제거용 공유 함수다. 그런데 이번에 추가된 config-time 메시지(`evaluateNodeToolPayload`)는 이 함수를 재사용하지 않고 거의 동일한 문구("... bytes across ... tools, exceeding the ... of ... bytes (largest contributor: ...)")를 또 한 번 손으로 작성했다. 주석은 "런타임 실패 메시지와 동일 어휘(§4.2)" 를 요구하지만 이를 강제하는 구조(공유 함수·테스트)가 없어, 향후 한쪽 문구만 수정되고 다른 쪽이 뒤처지는 drift 가 code review 로만 방지된다. `pickCulprit`(신규 파일) 도 `pickCulpritProvider`(`tool-payload-budget.ts`)와 알고리즘이 동일한 별도 구현이다.
  - 제안: `buildBudgetExceededPrefix`/`pickCulpritProvider` 를 `tool-payload-budget.ts` 에서 export 하고 `tool-payload-save-warning.ts` 가 이를 재사용(필요 시 node label prefix 만 파라미터로 추가)하도록 통합한다.

- **[INFO]** 3개 도구 provider 중 Cafe24/Makeshop 만 pure 함수로 추출·drift-0 회귀 테스트를 확보, Render 는 fabricated `workspaceId: ''` 로 런타임 클래스를 그대로 재사용 — 패턴 불일치
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` `reproduceConfigToolDefs()` 의 `new RenderToolProvider().buildTools({ config, workspaceId: '' })` 호출
  - 상세: cafe24/makeshop 은 `buildCafe24ToolDefsForIntegration`/`buildMakeshopToolDefsForIntegration` 로 module-level pure 함수를 추출했고, 각각 "runtime 과 정확히 동일한 tools 를 낸다"를 검증하는 회귀 테스트(`cafe24-mcp-tool-provider.spec.ts`, `makeshop-mcp-tool-provider.spec.ts`)가 있다. Render 경로는 `ProviderBuildCtx.workspaceId` 를 실제로 쓰지 않는다는 사실을 (코드를 읽어) 확인했으므로 현재는 안전하지만, 이는 구조적으로 보장되지 않는 암묵적 가정이다 — `RenderToolProvider.buildTools` 가 향후 workspaceId 를 사용하도록 바뀌면 config-time 재현이 조용히 틀린 값을 낼 수 있고, 이를 잡아줄 drift 회귀 테스트도 없다.
  - 제안: 최소한 다른 두 provider 와 동일하게 "config-time 재현 결과가 실제 `buildTools` 호출 결과와 동일하다"를 검증하는 회귀 테스트를 Render 경로에도 추가하거나, `ProviderBuildCtx` 대신 `{ config }` 만 받는 좁은 pure 함수로 승격한다(cafe24/makeshop 과 동일 패턴 — ISP 관점에서도 더 낫다).

- **[INFO]** 주석 내 잘못된 파일명 참조 — `config-time-tool-budget.ts` 는 실재하지 않는 파일명(실제: `tool-payload-save-warning.ts`)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (2곳), `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` (2곳)
  - 상세: plan 문서(`plan/in-progress/ai-agent-tool-payload-budget-followups.md`)는 "파일명 결정: config-time 평가 모듈은 `tool-payload-save-warning.ts` (런타임 `tool-payload-budget.ts` 와 명확히 구분 — naming-collision checker INFO 반영)" 라고 명시했지만, provider 두 파일의 주석 4곳은 개명 전 이름(`config-time-tool-budget.ts`)을 그대로 참조한다. 기능에는 영향 없으나 향후 독자가 주석을 따라가면 존재하지 않는 파일을 찾게 된다.
  - 제안: 4곳 주석의 파일명을 `tool-payload-save-warning.ts` 로 일치시킨다.

## 좋은 점 (참고)

- `evaluateAiAgentToolPayloadWarnings`/`AiAgentToolBudgetDeps`(`tool-payload-save-warning.ts`) 는 Integration 조회를 `loadIntegration` 함수 포트로 주입받는 순수-지향 구조로, `WorkflowsService.loadIntegrationForBudget` 가 어댑터 역할을 하는 깔끔한 DIP/포트-어댑터 분리다. `ToolBudgetGraphNode` 도 TypeORM `Node` 전체가 아닌 필요한 shape 만 요구해 ISP 를 잘 지킨다.
- `buildCafe24ToolDefsForIntegration`/`buildMakeshopToolDefsForIntegration`(+ JSON Schema 빌더) 를 인스턴스 메서드에서 module-level pure 함수로 승격해 런타임 `buildTools` 와 config-time 재현이 단일 매핑을 공유하도록 한 것은 DRY·drift-0 를 실제로 테스트로 검증한 좋은 리팩터링이다. Cafe24 테스트가 리플렉션 해킹(`as unknown as {...}`)으로 private 메서드를 찌르던 방식도 제거됐다.
- `WorkflowsModule` 이 `IntegrationsModule` 전체를 import 하지 않고 `Repository<Integration>` 만 주입하기로 한 판단은 실제로 순환 의존을 만드는 경로(`IntegrationsModule → NotificationsModule → WebsocketModule → WorkflowsModule`, forwardRef 로 이미 봉합된 기존 순환과 재충돌)를 정확히 피한 것으로 확인됨 — 주석의 근거가 사실과 일치한다.
- `getGraphWarnings`/`saveCanvas` 양쪽이 `evaluateToolPayloadWarnings` 사설 메서드를 공유해 조회·저장 두 표면이 동일 평가 로직을 재사용하는 구조는 기존 `cross-node-warning-rules.md` §5 의 "3중 가드" 프레임에 자연스럽게 편입됐다.

## 요약

이번 변경은 AI Agent 도구 payload 예산 경고를 저장 시점(config-time)까지 확장하며, 런타임/저장 시점이 동일 매핑을 공유하도록 provider 의 pure 함수 추출과 테스트로 drift-0 을 실제로 보장한 점, 그리고 IntegrationsModule 전체 import 대신 Repository 직접 주입으로 실재하는 순환 의존을 회피한 판단은 근거가 확인되는 좋은 설계다. 다만 `saveCanvas` 가 strict-save 기본값(꺼짐) 상태에서도 매번 write 트랜잭션 내부에서 절대 도달하지 않는 error-throw 경로를 위해 Integration N회 조회를 무조건 수행하는 점은 같은 파일의 기존 컨벤션(`importWorkflow` 의 트랜잭션 외부 read 원칙)과 배치되는 실질적 성능/결합 이슈이며, `WorkflowsService` 가 `IntegrationsService` 의 조회 판정 로직을 별도로 복제한 점·`loadIntegration` 호출에 캐싱이 없는 점·런타임/config-time 메시지 템플릿이 다시 중복된 점은 향후 drift 위험을 남긴다. 모두 머지를 막을 수준은 아니나 후속 정리가 권장된다.

## 위험도

MEDIUM

# Code Review 통합 보고서

대상: AI Agent 도구 정의 payload 예산의 **저장 시점(config-time) graph warning** 배선 —
`WorkflowsService`/`WorkflowsController`/`WorkflowsModule`, 신규 `tool-payload-save-warning.ts`,
cafe24/makeshop tool-provider pure 함수 추출, `toolBudgetStrictSave()`, frontend i18n, e2e/spec 갱신.
(branch `claude/ai-agent-tool-payload-followups-6472a9`, 19개 파일)

## 전체 위험도

**MEDIUM** — Critical 발견은 없음. 다만 `saveCanvas` 저장 트랜잭션 내부에서 미배칭·비-트랜잭셔널
커넥션으로 순차 Integration N+1 조회를 수행하는 패턴을 4개 reviewer(security/architecture/
side_effect/concurrency)가 독립적으로 지적했고, 그중 concurrency reviewer는 고부하 시 커넥션 풀
기아/사실상 데드락(`poolConnectionTimeoutMs=0`=무기한 대기) 가능성까지 짚어 실질 운영 리스크가
있다. 여기에 문서 정합성 갭(존재하지 않는 파일명 참조, 신규 env var `.env.example` 미등재,
CHANGELOG 누락) 3건과 유지보수성 중복 3건이 겹쳐 MEDIUM으로 판정한다. requirement/scope/
user_guide_sync reviewer는 spec-코드 정합성과 변경 범위를 NONE~LOW로 평가해 기능 정확성 자체는
견고함을 확인했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/성능 | `saveCanvas` 쓰기 트랜잭션 내부에서 `loadIntegrationForBudget`이 트랜잭션 `manager`가 아닌 별도 주입 repository로 Integration을 조회 — 트랜잭션 진행 중 두 번째 커넥션을 추가로 요청하며, `mcpServers` 참조마다 `for...of`+`await` 순차 실행(미배칭). `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`(기본 false)가 꺼져 있어도 무조건 실행돼 도달 불가능한 error-throw 분기를 위해 매 저장마다 비용을 지불하는 dead path. `poolConnectionTimeoutMs` 기본값 0(무기한 대기)이라 동시 부하가 poolMax(기본 10)에 근접하면 커넥션 풀 기아/사실상 데드락으로 조용히 hang할 수 있음 | `codebase/backend/src/modules/workflows/workflows.service.ts` `saveCanvas`(L426-464) → `evaluateToolPayloadWarningsAndThrow` → `loadIntegrationForBudget`(L546-557); `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` `reproduceConfigToolDefs`/`evaluateAiAgentToolPayloadWarnings`(L1401-1473) | (1) `manager.getRepository(Integration)` 등 트랜잭션 매니저 스코프로 조회 전환, (2) `toolBudgetStrictSave()`가 꺼져 있으면 평가 자체를 skip, (3) `mcpServers[].integrationId`를 그래프 전체에서 수집해 `In()` 단일 배치 조회 + 메모이제이션, (4) 순차 루프를 `Promise.all`로 병렬화(결과 배열 순서는 보존되므로 "per-node 최대 1건" 결정성 계약 유지 가능), (5) `SaveCanvasDto`에 `@ArrayMaxSize` 등 상한 추가 |
| 2 | 아키텍처 | `WorkflowsService`가 `IntegrationsService`(소유 모듈 비즈니스 레이어)를 우회해 `Repository<Integration>`을 직접 주입 — `IntegrationsService.getForExecution()`(`requireEntity`+`isUnreadableCredentials`)와 동일한 조회/판정 로직을 별도로 재구현. 순환 의존(`IntegrationsModule→NotificationsModule→WebsocketModule→WorkflowsModule`) 회피 목적은 타당하나, 향후 `IntegrationsService` 쪽 정책 변경 시 이 사본이 자동으로 따라가지 않음 | `codebase/backend/src/modules/workflows/workflows.service.ts` `loadIntegrationForBudget()`; `workflows.module.ts` `TypeOrmModule.forFeature([..., Integration])` | 판정 로직을 순환 없는 공용 유틸/포트로 추출해 양쪽이 공유하게 하거나, 최소한 두 구현의 동작 동치성을 검증하는 parity 회귀 테스트 추가 |
| 3 | 유지보수성 | "범인 provider 탐색"(`pickCulprit` vs `pickCulpritProvider`) 및 예산 초과 메시지 템플릿이 신규 파일에 다시 인라인 복제됨 — `buildBudgetExceededPrefix`는 과거 리뷰(INFO6, "03 리뷰")에서 이미 한 차례 통합했던 이력이 주석에 남아 있는데도 export되지 않아 재사용이 불가능해 동일 문구가 또 손으로 재작성됨 | `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts`(`pickCulprit`, `evaluateNodeToolPayload` message 조립부) vs `tool-payload-budget.ts`(`pickCulpritProvider`, `buildBudgetExceededPrefix`) | `pickCulpritProvider`/`buildBudgetExceededPrefix`를 `tool-payload-budget.ts`에서 export하고 `tool-payload-save-warning.ts`가 재사용(필요 시 node label만 파라미터 추가) |
| 4 | 유지보수성 | cafe24/makeshop 두 provider의 JSON Schema 빌더(`buildXxxJsonSchema`)·allowlist 함수(`applyXxxAllowlist`)가 라인 단위로 100% 동일한 로직인 채 이번에 module-level pure 함수로 승격됐지만 cafe24↔makeshop 축의 중복은 그대로 이식·유지됨(makeshop 쪽 주석조차 "same mapping as cafe24"라고 자인) | `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`(`buildCafe24JsonSchema`, `applyCafe24Allowlist`) vs `makeshop-mcp-tool-provider.ts`(`buildMakeshopJsonSchema`, `applyMakeshopAllowlist`) | 공유 `buildJsonSchemaFromFields<T>`/`applyAllowlist`를 공용 모듈(예: `tool-providers/shared/json-schema.ts`)로 추출 검토. 이번 PR 범위가 아니라면 최소 후속 plan 항목으로 명시 |
| 5 | 문서화 | 존재하지 않는 파일명(`config-time-tool-budget.ts`)을 가리키는 stale 주석 4곳 — 실제 config-time 평가 모듈 파일명은 `tool-payload-save-warning.ts`(plan 문서에 명시된 결정과 불일치) | `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts:199,707`, `makeshop-mcp-tool-provider.ts:205,718` | 4곳 모두 `tool-payload-save-warning.ts`로 정정 |
| 6 | 문서화 | 신규 env var `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`(저장 시점 hard 초과를 error로 승격해 저장 차단하는 운영 스위치)가 `.env.example`에 미등재 — 선행 3종(`SOFT_BYTES`/`HARD_BYTES`/`COUNT_MAX`)은 등재돼 있으나 4번째만 누락. 직전 런타임 가드레일 PR에서 동일 패턴이 지적돼 수정된 전례가 있음에도 반복됨 | `codebase/backend/.env.example:319-336` | `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=false` 한 줄과 짧은 설명 추가 |
| 7 | 문서화 | `CHANGELOG.md`의 "Unreleased" 섹션이 이번 후속 기능(config-time 저장 경고)을 명시적으로 "본 PR 범위 밖 후속"으로 예고해 뒀는데, 실제 구현 반영 시점(본 diff)에 CHANGELOG가 전혀 갱신되지 않음 | `CHANGELOG.md` 최상단 "Unreleased — AI Agent 도구 정의 payload 예산 가드레일" 섹션 | 신규 rule(`ai_agent:tool-payload-budget`)·응답 변경·`AI_AGENT_TOOL_BUDGET_STRICT_SAVE` env var 추가를 Unreleased 항목으로 기록 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `GET /workflows/:id/graph-warnings`(`viewer` 권한)가 이번 변경으로 워크스페이스 통합 자격증명(AES-256-GCM) 복호화를 트리거하는 새 경로가 됨 — 응답 자체엔 credentials/scope 미노출이라 직접 유출은 없으나, 노출 반경(2차 채널) 확인 권장 | `workflows.controller.ts` `graphWarnings()` → `getGraphWarnings` → `loadIntegrationForBudget` | 즉시 조치 불필요. 향후 evaluation 결과 필드 추가 시 credentials 미노출을 회귀 테스트에 명시적으로 추가 |
| 2 | 아키텍처/부작용 | config-time 재현이 `RenderToolProvider.buildTools`를 fabricated `workspaceId: ''`로 재사용 — 현재는 안전(workspaceId 미사용 확인)하나 암묵적 계약이며 drift 회귀 테스트 없음. 또한 malformed `presentationTools`에 대한 `logger.warn`이 이제 조회/저장 시점마다도 찍혀 로그 볼륨 증가 | `tool-payload-save-warning.ts` `reproduceConfigToolDefs()`; `render-tool-provider.ts` | cafe24/makeshop과 동일하게 `{ config }`만 받는 pure 함수로 승격하거나 drift 계약 테스트 추가 |
| 3 | 문서화/API계약 | `getGraphWarnings` JSDoc이 신규 `workspaceId` 파라미터·backend-only rule append를 설명하지 않고, `/workflows/:id/graph-warnings` Swagger `@ApiOperation.description`과 `saveCanvas`의 `@ApiBadRequestResponse`도 신규 400 사유(`GRAPH_VALIDATION_FAILED` via 도구 payload 예산)를 반영하지 않음(기존에도 있던 문서 공백의 연장) | `workflows.service.ts`(`getGraphWarnings` JSDoc), `workflows.controller.ts`(`@ApiOperation`/`@ApiBadRequestResponse`) | JSDoc·Swagger description에 한두 문장 보강 |
| 4 | 요구사항 | `restoreVersion`이 `skipLegacyDataGates=true`로 legacy 게이트는 건너뛰지만 신규 tool-payload budget 저장 게이트는 건너뛰지 않음 — strict-save 운영 시 과거 버전 복원이 새 게이트에 막힐 수 있음(기존 `evaluateGraphWarnings`도 동일 패턴이라 의도적 일관성으로 판단, spec 침묵 영역) | `workflows.service.ts:407-465`(`saveCanvas`, `restoreVersion`이 내부 호출) | 코드 수정 불필요 — strict-save 운영 시 인지 사항으로 기록 |
| 5 | 요구사항 | `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` 한국어 템플릿이 영문 SoT 메시지의 "largest contributor"(`culprit`)를 생략 | `codebase/frontend/src/lib/i18n/backend-labels.ts:638-643` | UX상 필요하면 KO 템플릿에 `({{culprit}} 이 가장 큼)` 류 문구 추가 검토(선택) |
| 6 | 동시성 | `evaluateAiAgentToolPayloadWarnings` docstring의 "결정적 — 동일 (nodes, 통합 상태) 스냅샷" 문구가 순차 루프 하에서 물리적으로 100% 보장되지 않음(노드별 조회 사이 시간차 동안 Integration row가 갱신될 수 있음). advisory 성격이라 실질 위험 낮음 | `tool-payload-save-warning.ts:1401-1402` | 문구를 "완전한 원자적 스냅샷은 아님(best-effort)"로 완화하거나 배치 조회로 스냅샷화 |
| 7 | 범위/부작용 | 리베이스 후속 커밋(`808017aaf`)에 기능과 무관한 `settings` 타입 캐스트 제거 1줄과 테스트 단정문 포맷 변경이 섞임 — 커밋 메시지에 "eslint --fix 포맷 정규화"로 투명하게 설명돼 있어 은닉 아님, 동작 영향 없음 | `workflows.service.ts:308-316`(`importWorkflow`), `workflows.controller.spec.ts`/`workflows.service.spec.ts` | 조치 불필요 — 향후 순수 포맷 변경은 별도 `chore(lint)` 커밋으로 완전 분리 권장 |
| 8 | API 계약 | 신규 warning의 `params.culprit`이 integration ID 앞 16자(`sanitizeSid`)를 노출하나, 기존 런타임 도구명(`mcp_<sid>__op`)에서도 이미 동일 수준으로 노출되던 값이라 신규 정보 누출 아님 | `tool-payload-save-warning.ts:1519-1524`(`pickCulprit`) | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | saveCanvas 트랜잭션 내 미배칭 Integration N+1 조회(WARNING); viewer 조회 endpoint가 자격증명 복호화 유발(INFO); 테넌트 격리(workspaceId)는 견고 |
| architecture | MEDIUM | strict-save 꺼진 기본값에서도 무조건 트랜잭션 내 Integration 조회(dead error path); IntegrationsService 우회 Repository 직접 주입; N+1 캐싱 없음; 메시지 템플릿 재중복; Render provider drift 테스트 부재 |
| requirement | NONE | spec(`1-ai-agent.md` §4.2/§10/§12.15, `cross-node-warning-rules.md` §5/§8)와 구현이 line-level로 정확히 일치, 207+20 unit tests 통과, spec-drift 없음. INFO 3건만 |
| scope | LOW | 19개 변경 파일이 plan 체크리스트와 1:1 대응, 범위 밖 변경 없음. 리베이스 후속 커밋에 무관 타입캐스트/포맷 변경 소량 혼입(투명하게 설명됨) |
| side_effect | LOW | 핵심 우려는 saveCanvas 트랜잭션 내 별도 커넥션 Integration 조회(WARNING, 위 #1과 동일)로 수렴. 시그니처 변경·모듈 배선·pure 함수 승격은 호출자 전수 확인 결과 안전 |
| maintainability | LOW | pickCulprit/메시지 템플릿 재중복(WARNING), cafe24/makeshop JSON schema 빌더 100% 동일 로직 미통합(WARNING); 그 외 함수 책임 분산 스타일 혼재는 INFO |
| testing | 미확인 (출력 파일 누락) | status=success로 보고됐으나 `testing.md` 파일이 세션 디렉터리에 생성되지 않음(known FS-write flakiness) — 재시도 필요 |
| documentation | MEDIUM | stale 파일명 주석 4곳, `.env.example` 신규 env var 미등재, CHANGELOG 미갱신(WARNING 3건); JSDoc/Swagger 설명 보완 필요(INFO). 핵심 로직 JSDoc 품질 자체는 높음 |
| concurrency | MEDIUM | saveCanvas 트랜잭션 내 비-트랜잭셔널 커넥션 사용으로 커넥션 풀 경합/잠재적 데드락(WARNING, poolConnectionTimeoutMs=0); 순차 for-await 루프로 트랜잭션 보유시간·조회 지연 증가(WARNING) |
| api_contract | LOW | REST 계약(URL/인증/응답 스키마/에러 형식) 전부 additive·불변 확인. Swagger 400 사유 미반영·비-트랜잭셔널 조회는 INFO 수준 |
| user_guide_sync | NONE | 매트릭스 19개 trigger 중 실질 매칭 2건(`new-warning-code`, `spec-major-change`) 모두 동일 changeset 내 이미 동반 갱신 완료(GRAPH_WARNING_KO, spec frontmatter). 누락 0건 |

## 발견 없는 에이전트

requirement, user_guide_sync — 모두 NONE 위험도, 실질 갭 없음(INFO만 기록).

## 권장 조치사항

1. `saveCanvas` 트랜잭션 내부의 Integration 조회를 트랜잭션 `manager` 스코프로 전환하고, `toolBudgetStrictSave()`가 꺼져 있으면 평가 자체를 skip하도록 조건부 처리 — 커넥션 풀 경합/데드락 위험과 불필요한 트랜잭션 보유시간 연장을 동시에 해소 (WARNING #1, security/architecture/side_effect/concurrency 공통 지적).
2. `mcpServers[].integrationId` 참조를 배치(`In()`) 조회 + 메모이제이션하고 순차 루프를 `Promise.all`로 병렬화 (WARNING #1과 결합).
3. 문서 정합성 3건 정리 — stale 파일명 주석 4곳 정정, `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`를 `.env.example`에 등재, CHANGELOG Unreleased 섹션 갱신 (WARNING #5-7, 낮은 비용·높은 발견성 효과).
4. `pickCulprit`/메시지 템플릿, cafe24-makeshop JSON schema 빌더 중복을 export 재사용으로 정리 (WARNING #3-4).
5. `WorkflowsService`의 Integration 조회 판정 로직과 `IntegrationsService`의 판정 로직 간 parity 회귀 테스트 추가 검토 (WARNING #2, 낮은 우선순위).
6. `testing` reviewer 출력 파일이 세션 디렉터리에 없어 결과 미확보 — 재시도 실행 필요.

## 라우터 결정

- `routing_status=done` (router가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync (11명)
  - **제외**: performance, dependency, database (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 상세 사유는 manifest에 포함되지 않음(라우팅 결정 파일 미보존) |
  | dependency | 라우터 판단 — 상세 사유는 manifest에 포함되지 않음(라우팅 결정 파일 미보존) |
  | database | 라우터 판단 — 상세 사유는 manifest에 포함되지 않음(라우팅 결정 파일 미보존) |
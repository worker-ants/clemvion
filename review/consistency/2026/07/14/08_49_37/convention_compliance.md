# 정식 규약 준수 검토 — `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md`

## 발견사항

- **[CRITICAL] 저장 시점 경고 검증을 `PATCH /workflows/:id` 에도 건다는 서술이 실제 API 스코프와 모순**
  - target 위치: 확정 정책 L39 "**노드 설정 변경 API**: `workflows.service` async 저장 검증(`PATCH :id`·`POST :id/save`)에서 ai_agent 노드의 `mcpServers`·`presentationTools` 로부터 payload 추정" / D3 절 L102 "워크플로우 저장 API(`PATCH /workflows/:id`·`POST /workflows/:id/save`)가 응답 `warnings[]` 에..."
  - 위반 규약: `spec/5-system/2-api-convention.md` 가 규정하는 endpoint별 payload 계약(간접, `swagger.md` §2 Controller 패턴이 참조) — 및 실제 코드 `UpdateWorkflowDto`(`codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`)/`data-flow/11-workflow.md` §1.1 이 문서화한 두 엔드포인트의 역할 분리
  - 상세: `PATCH /workflows/:id` (`WorkflowsService.update`) 는 `UpdateWorkflowDto` 만 받는다 — 필드는 `name`/`description`/`isActive`/`tags`/`folderId`/`settings.maxConcurrentExecutions` 뿐이며 **`nodes` 를 포함하지 않는다** (전역 pipe 가 whitelist 되지 않은 키를 400 으로 거부). `mcpServers`/`presentationTools` 는 `ai_agent` **노드의 `config`** 필드(ai-agent.md §1, L45/L65)이므로 이 endpoint 호출 시점엔 애초에 값 자체가 존재하지 않는다. 노드 config 를 담아 서버로 보내는 경로는 `POST /workflows/:id/save` (`SaveCanvasDto { nodes[], edges[] }`, `WorkflowsService.saveCanvas`) 뿐이다 (`data-flow/11-workflow.md` L44). 즉 D3 draft 를 그대로 구현하면 `PATCH :id` 쪽 검증 로직은 재료가 없어 항상 no-op 이 되거나, 구현자가 `update()` 에 억지로 node 조회를 끼워 넣어 §1.1 이 규정한 "PATCH = 워크플로우 메타 전용, 저장 = 캔버스 전용"이라는 기존 API 경계를 깨게 된다.
  - 제안: D3·확정 정책에서 `PATCH :id` 를 제거하고 `POST :id/save`(`saveCanvas`) 단일 지점으로 정정한다. "또는 워크스페이스 설정"(strict 플래그의 대안 저장 위치, L102)도 실체화하려면 `WorkflowSettingsDto` 확장이 Phase 1/2 에 명시돼야 한다 — 현재 `settings` 는 `maxConcurrentExecutions` 외 키를 거부하는 화이트리스트이므로 언급만 하고 스키마 변경을 빠뜨리면 동일한 종류의 갭이 재발한다.

- **[CRITICAL] 저장 시점 non-blocking 경고 메커니즘이 기존 `spec/conventions/cross-node-warning-rules.md` 를 우회하고 별도 체계를 신설 — Phase 1 이 해당 convention 확인을 명시적으로 생략**
  - target 위치: Phase 1 항목 3 (L54) "`spec/conventions/` 참조 불필요(단일 노드 스코프)" / 확정 정책 L39 / D3 (L102)
  - 위반 규약: `spec/conventions/cross-node-warning-rules.md` §3~§5 (`GraphWarningRule { severity: 'error'|'warning' }`, workflow save endpoint 3중 가드, `GET /workflows/:id/graph-warnings` 조회 API, `GRAPH_VALIDATION_FAILED` 차단 코드)
  - 상세: `cross-node-warning-rules.md` 는 정확히 이 상황 — "워크플로우 저장 시점에 노드 config 로부터 파생된 위험을 non-blocking 경고로 노출하고, 특정 조건에서만 저장을 차단"—을 위해 이미 존재하는 단일 메커니즘이다. severity `warning` 은 "저장 통과(로깅/response 포함)", severity `error` 는 `BadRequestException(GRAPH_VALIDATION_FAILED)` 로 저장을 막는다(§4·§5). 반면 target 은 이 메커니즘을 참조조차 하지 않고 ① 별도 응답 필드 `warnings[]`(형태 미정의 — `GraphWarningRuleResult{ ruleId, severity, nodeId, message, params? }` 와 무관), ② 별도 env 플래그 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` (기존 severity `error`/`warning` 이분법과 다른 3rd 축), ③ 차단 시 `AI_TOOL_BUDGET_EXCEEDED`(노드 런타임 에러 코드) 를 400 응답에 재사용 — 기존 관례는 이 위치에서 `GRAPH_VALIDATION_FAILED` 를 쓴다 — 을 새로 발명한다. Phase 1 항목 3 이 "단일 노드 스코프라 conventions 참조 불필요"라고 명시적으로 판단했으나, `cross-node-warning-rules.md` §2 자체가 "단일 노드 config 만으로 평가 가능하면 `warningRules`(mini-DSL) 우선"이라 명시하고, ai_agent 는 이미 `ai_agent:no-llm-provider`/`ai_agent:too-many-conditions` 로 이 mini-DSL/`warningRules` 체계를 쓰고 있다(§10 L1130, §5.1 L330) — 즉 "단일 노드 스코프"라는 이유가 오히려 기존 규약이 커버하는 사례임을 가리킨다. frontend canvas 배지·`getConfigSummary`·`GET /workflows/:id/graph-warnings`·i18n(`GRAPH_WARNING_KO`) 등 다른 시스템이 이미 이 severity/응답 모델을 전제하므로, 별도 `warnings[]` 체계 신설은 두 개의 평행한 "저장 시 경고" 계약을 만들어 향후 관측·프론트 처리 로직이 분기된다.
  - 제안: (a) payload 추정이 mini-DSL 로 표현 불가능할 만큼 복잡하면(도구 카탈로그 직렬화 필요) `graphWarningRules`(JS 함수 evaluate, 단일 노드 self-scope 로도 사용 가능)로 등록하고 기존 severity `error`/`warning` + `GRAPH_VALIDATION_FAILED` 를 그대로 재사용한다. (b) 표현 가능하면 `warningRules` mini-DSL(`blocking`/`advisory`)로 편입한다. 둘 중 하나로 흡수하고, Phase 1 항목 3 의 "참조 불필요" 판단을 재검토해 `cross-node-warning-rules.md`/`node-output.md` 를 정식 참조 규약으로 등재한다.

- **[WARNING] `AI_TOOL_BUDGET_EXCEEDED` 의 구조화 `details` 필드 부재 — 같은 문서 §7.9 선례와 불일치**
  - target 위치: 확정 정책 L38, D2 (L96) "메시지에 총 크기·예산·범인 provider·해결법"
  - 위반 규약: `spec/conventions/node-output.md` §3.2.2 (`details` 의 노드별 선택 스키마) + `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 선례
  - 상세: node-output.md §3.2.2 는 "§3.2.1 공통 필드 외 추가 메타는 각 노드 spec 의 `output.error.details` 표가 정의"라 규정하고, ai-agent.md §7.9 는 이미 `LLM_RATE_LIMIT` 등에 `details.provider`/`details.statusCode` 를 구조화 필드로 노출한다. 그런데 `AI_TOOL_BUDGET_EXCEEDED` 는 "총 크기·예산·범인 provider·해결법"을 **자유 텍스트 message 에만** 담겠다고 서술한다 — 클라이언트가 프로그래밍적으로 초과분/범인 provider 를 소비하려면(예: UI 가 "OO 서버 도구 축소" 버튼을 provider 별로 렌더링) 문자열 파싱이 필요해진다. 확정 정책이 이미 `estimateAgentToolPayload` 반환값에 `perProvider?: [{ key, bytes, toolCount }]` 를 정의해뒀으므로 구조화 노출이 자연스럽다.
  - 제안: D2/§7.9 대응 절에 `details: { totalBytes, budgetBytes, culpritProvider?, toolCount }` 등 구조화 필드를 §3.2.2 표 형식으로 명문화한다.

- **[INFO] 신규 에러 코드 접두어가 §10 표의 기존 접두어 계열과 정합성이 낮음**
  - target 위치: D2 (L96) `AI_TOOL_BUDGET_EXCEEDED`
  - 위반 규약: `spec/conventions/error-codes.md` §1 "도메인 prefix (권장)"
  - 상세: ai-agent.md §10 기존 표는 `LLM_CALL_FAILED`/`LLM_RATE_LIMIT`/`LLM_RESPONSE_INVALID`(LLM_ 계열), `TOOL_EXECUTION_FAILED`, `MAX_TOOL_CALLS_EXCEEDED`(같은 "도구 개수 초과" 계열) 로 구성된다. 신규 코드는 이 표에 없던 `AI_` 접두를 새로 도입하며, 의미상 가장 가까운 형제 코드는 `MAX_TOOL_CALLS_EXCEEDED`(도구 *개수* 초과)인데 명명 패턴이 이어지지 않는다(`TOOL_PAYLOAD_BUDGET_EXCEEDED` 등이 더 일관적). error-codes.md 는 이를 강제하지 않고 "권장"이므로 CRITICAL 은 아니다.
  - 제안: `TOOL_PAYLOAD_BUDGET_EXCEEDED` 또는 `MAX_TOOL_PAYLOAD_EXCEEDED` 등 형제 코드(`TOOL_EXECUTION_FAILED`/`MAX_TOOL_CALLS_EXCEEDED`) 접두 계열과 정합시키는 안을 검토. rename 비용이 낮은 지금(신설 단계) 반영이 가장 저렴하다(§2 "rename 은 breaking" 원칙상 신설 직후가 유일한 무비용 교정 시점).

- **[INFO] Phase 2 에 Swagger/DTO 갱신이 명시되지 않음**
  - target 위치: Phase 2 항목 4 (L61) "config 저장 경고(workflows.service) + strict 차단 + integration test"
  - 위반 규약: `spec/conventions/swagger.md` §5-4 "새 엔드포인트 체크리스트" (응답 DTO에 필드 추가 시 JSDoc/`@ApiProperty` 동반 의무)
  - 상세: 저장 응답에 신규 `warnings[]` 필드가 추가되면(위 CRITICAL 항목의 형태 문제와 별개로) 해당 응답 DTO 갱신 + swagger 문서화가 동반돼야 하는데 Phase 2 어느 항목에도 명시되지 않는다. "6. build/lint/test" 에 암묵 포함될 수 있으나 스펙 갱신 phase 에 넣지 않으면 누락 위험이 있다.
  - 제안: Phase 2 항목 4 에 "응답 DTO(`dto/responses/*.ts`) 갱신 + swagger 데코레이터" 를 명시적으로 추가.

## 요약

target plan 은 estimator 단일화·env 예산·런타임 fail-fast 설계는 기존 `node-output.md` §3.2.1(`retryable` 계약)·§10 표 포맷·`ConfigService` namespace 관례(M-6)를 잘 따르고 있으나, "노드 설정 변경 API" 저장 시점 경고 설계 부분에서 두 가지 구조적 문제가 있다. 첫째 `PATCH /workflows/:id` 가 실제로 노드 config 를 받지 않는다는 사실과 모순되는 서술(구현 불가능한 지점을 스펙에 박음)이고, 둘째 정확히 이 use case(저장 시 non-blocking 경고 + 조건부 차단)를 위해 이미 존재하는 `spec/conventions/cross-node-warning-rules.md` 의 `GraphWarningRule`/`GRAPH_VALIDATION_FAILED` 체계를 검토 없이("단일 노드 스코프" 라는, 실제로는 반대로 그 규약이 커버 대상임을 가리키는 근거로) 우회해 병렬 `warnings[]` 체계를 신설한다는 점이다. 두 항목 모두 Phase 1 (project-planner, 본 PR) 에서 최종 spec 문서에 반영되기 전에 정정이 필요한 수준이며, 나머지(에러 코드 접두, details 구조화, swagger 체크리스트)는 경미한 정합성 개선 여지다.

## 위험도
HIGH

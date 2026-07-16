# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `saveCanvas`(`POST /workflows/:id/save`)의 신규 400 사유가 Swagger 문서에 반영되지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:442-444` (`@ApiBadRequestResponse({ description: 'Manual Trigger 누락/중복 또는 입력값 검증 실패' })`)
  - 상세: 이번 변경으로 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 설정 시 도구 payload 예산 초과가 새로운 `GRAPH_VALIDATION_FAILED` 400 사유가 됐다(`workflows.service.ts` `evaluateToolPayloadWarningsAndThrow`). 다만 이는 기존에도 이미 있던 gap(예: `parallel:nested-depth-exceeded` 등 기존 graph-validation 400 사유도 이 description 에 없음)의 연장이라 이번 diff 가 새로 만든 회귀는 아니다.
  - 제안: `@ApiBadRequestResponse` description 에 "graph validation 실패(GRAPH_VALIDATION_FAILED, 예: 중첩 Parallel 깊이·AI Agent 도구 payload 예산 등)"를 포함하도록 갱신하면 API 소비자가 클라이언트에서 해당 코드를 미리 핸들링하기 쉬워진다.

- **[INFO]** `saveCanvas` 트랜잭션 내부에서 비-트랜잭셔널 repository 로 부가 조회 수행
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:462`, `:669-676` (`loadIntegrationForBudget` 이 `this.integrationRepository`(트랜잭션 매니저 아님)를 사용)
  - 상세: `evaluateToolPayloadWarningsAndThrow` 가 `saveCanvas` 의 DB 트랜잭션 내부(노드/엣지 save 이후, 버전 스냅샷 생성 이전)에서 호출되지만, 내부의 Integration 조회는 트랜잭션 매니저가 아닌 일반 repository 로 수행된다. 코드 주석대로 Integration 은 이 트랜잭션에서 쓰기 대상이 아니므로 read-only 정합성 문제는 없으나, mcpServers 참조가 많은 워크플로일수록 저장 요청(쓰기 API)의 지연시간이 늘어나(N+1 성 조회) 트랜잭션 보유 시간이 길어질 수 있다.
  - 제안: 계약 위반은 아니지만, mcpServers 참조 수가 큰 경우 저장 API 응답 지연에 대한 모니터링/상한을 고려할 만하다.

- **[INFO]** 신규 warning 의 `params.culprit` 이 통합 ID 앞 16자(`sanitizeSid`)를 노출
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts:1519-1524` (`pickCulprit` → `mcp:<sid>`), `sanitizeSid` (`cafe24-mcp-tool-provider.ts:909-911`)
  - 상세: `GET /workflows/:id/graph-warnings` 는 `@Roles('viewer')` 로 워크스페이스 viewer 이상이면 호출 가능하다. 응답의 `results[].params.culprit` 에 연동 ID 앞 16자가 노출되는데, 이는 기존 런타임 도구명(`mcp_<sid>__op`)에서도 이미 동일하게 노출되던 값이라 신규 정보 누출은 아니다.
  - 제안: 별도 조치 불필요(기존 노출 패턴과 동일 수준).

## 평가 관점별 요약

1. **하위 호환성**: `GET /workflows/:id/graph-warnings` 의 응답 스키마(`GraphWarningsResponseDto` — `results/hasError/hasWarning`, `params: Record<string,string|number>`)는 변경 없이 재사용됐고 새 rule(`ai_agent:tool-payload-budget`)은 기존 스키마 안에서 추가 항목으로만 나타나 additive. `WorkflowsService.getGraphWarnings(workflowId, workspaceId, opts?)` 시그니처에 `workspaceId` 가 추가돼 내부 계약이 바뀌었지만 호출부는 컨트롤러 단 하나뿐이며 함께 갱신됐다(`grep` 확인, 잔여 호출 없음) — 외부에 노출되는 REST 계약은 불변. `saveCanvas` 의 새 차단 경로는 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 환경변수 opt-in 이 꺼진 기본 상태에서는 기존 저장 가능한 워크플로가 그대로 통과해 breaking change 가 없다.
2. **버전 관리**: 별도 API 버전 스킴 사용 안 함(기존 컨벤션 유지). 버전 관리 이슈 없음.
3. **응답 형식**: 새 규칙 결과가 기존 `GraphWarningResultDto`(ruleId/severity/nodeId/message/params) 형태를 그대로 따르며 별도 응답 필드를 신설하지 않았다(spec 문서에도 "별도 응답 필드 신설 없음" 명시). `saveCanvas` 응답(`CanvasSaveResultDto`)에는 warning 을 싣지 않는 기존 계약을 유지한다는 점도 spec/코드 모두 일관됨.
4. **에러 응답**: 신규 저장 차단 경로가 기존 `BadRequestException({ code: 'GRAPH_VALIDATION_FAILED', message, details: { errors } })` 형태를 그대로 재사용(`evaluateGraphWarnings`/`getGraphWarnings` 의 기존 throw 와 완전히 동일한 shape) — 에러 코드/형식 drift 없음. HTTP 상태코드도 400 으로 기존 관례와 일치.
5. **요청 검증**: 이번 변경 자체는 요청 파라미터/바디를 추가하지 않음(`GET` 은 path param 만, `POST /save` 는 기존 DTO 그대로). Integration 조회는 `where: { id, workspaceId }` 로 테넌트 경계를 강제해 워크플로 config 에 다른 워크스페이스의 integrationId 가 섞여 있어도 조회되지 않고 best-effort skip 되므로 IDOR 위험이 없다(`workflows.service.spec.ts` 테스트로 고정: `expect(mockIntegrationRepository.findOne).toHaveBeenCalledWith({ where: { id: 'int-1', workspaceId: 'ws-uuid-1' } })`).
6. **URL/경로 설계**: 기존 `/workflows/:id/graph-warnings`, `/workflows/:id/save` 경로 그대로 — RESTful 설계 변경 없음.
7. **페이지네이션**: 해당 없음(목록 API 변경 없음, `results` 배열은 기존에도 페이지네이션 미적용 — 이번 변경으로 규모가 커질 가능성은 낮음: per-node 최대 1건).
8. **인증/인가**: `GET .../graph-warnings` 는 기존 `@Roles('viewer')` + `@WorkspaceId()` 그대로 유지. 서비스 계층에 새로 주입된 `Integration` repository 접근도 `workspaceId` 스코프를 강제해 테넌트 경계를 지킨다. `POST .../save` 도 `@Roles('editor')` 불변. 인가 레벨 변경 없음.

## 요약

이번 변경은 기존 `GET /workflows/:id/graph-warnings` 조회 API 와 `POST /workflows/:id/save` 저장 API 에 AI Agent 도구 payload 예산 경고라는 새 backend-only graph warning 규칙을 추가하는 것으로, 두 endpoint 의 URL·인증/인가·응답 스키마(`GraphWarningsResponseDto`)·에러 응답 형식(`GRAPH_VALIDATION_FAILED`)을 전혀 바꾸지 않고 기존 계약 안에서 additive 하게 확장했다. 내부 서비스 메서드 시그니처 변경(`getGraphWarnings(id, workspaceId, opts?)`)은 호출부가 하나뿐이라 안전하게 갱신됐고, 새로 주입된 Integration 조회는 `workspaceId` 로 테넌트 경계를 강제해 IDOR 위험이 없으며, 저장 차단 경로는 opt-in 환경변수(`AI_AGENT_TOOL_BUDGET_STRICT_SAVE`, 기본 off)로 게이팅돼 기존 클라이언트의 저장 동작을 깨지 않는다. Swagger `@ApiBadRequestResponse` 설명이 새 400 사유를 명시하지 않는 점은 기존에도 있던 문서화 공백의 연장으로 경미한 개선 여지다.

## 위험도

LOW

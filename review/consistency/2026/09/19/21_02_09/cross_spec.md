# Cross-Spec 일관성 검토 — `spec/4-nodes/4-integration/`

검토 모드: `--impl-prep` (scope=`spec/4-nodes/4-integration/`). 대상 번들: `0-common.md` · `1-http-request.md` ·
`2-database-query.md` · `3-send-email.md` · `4-cafe24.md` · `5-makeshop.md` (`_product-overview.md` 는 예산 절단으로 본문
미포함 — 아래 검토는 절단 전 파일들 기준). 부수 컨텍스트: `plan/in-progress/ssrf-guard-integration-unify.md` — **spec 변경
없이** `http-safety.ts`(HTTP/DB) 와 `ssrf.util.ts`(SMTP) 두 SSRF 구현을 하나로 합치는 코드 전용 작업.

## 발견사항

- **[WARNING]** `IntegrationsService.logUsage` 시그니처가 두 spec 영역에서 다르다 — `api` 필드 유무
  - target 위치: `spec/4-nodes/4-integration/0-common.md` §4.1 (6단계 표) — `IntegrationsService.logUsage({integrationId, nodeExecutionId, workflowId, status, durationMs, error?, api?})` 호출을 "**`api` 식별 정보 동반 의무**" 로 명시. `1-http-request.md` §4.3, `2-database-query.md` §4 step 8, `3-send-email.md` §4 step 9, `4-cafe24.md` §4 step 11, `5-makeshop.md` §4 step 11 이 모두 이 `api` 인자를 전제로 `_product-overview.md` INT-US-05 표를 인용
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §10.1 `IntegrationsService` TS 인터페이스
  - 상세: execution-engine.md §10.1 의 인라인 TS 선언은 `logUsage(params: { integrationId; nodeExecutionId; workflowId; status; durationMs; error? })` 로 **`api` 필드가 아예 없다**. 반면 target 번들과 `spec/1-data-model.md` §2.10.1 `IntegrationUsageLog`(`api_label`/`api_method`/`api_path` 컬럼) 는 `api` 를 INT-US-05 "필수" 요구사항의 핵심 인자로 취급하고, `spec/5-system/11-mcp-client.md` ("api 채우기는 호출부의 명시적 의무") 는 `Cafe24McpToolProvider` 가 `IntegrationHandlerBase` 를 거치지 않고 바로 `IntegrationsService.logUsage` 를 호출하며 `api` 를 직접 채워야 한다고 명시한다 — 즉 이 필드가 필요한 지점이 바로 execution-engine.md 가 선언한 그 서비스 메서드다. `IntegrationHandlerBase.logUsage` (§10.2) 는 opaque 타입(`IntegrationUsageParams`)이라 문제 없지만, `IntegrationsService.logUsage` 인라인 선언만 stale 하다 (INT-US-05 도입 커밋 `dbdf7de98`(#338) 이후 §10.1 이 갱신되지 않은 것으로 보임 — 최근 execution-engine.md 커밋 `8964a7114` 는 무관한 주제)
  - 제안: execution-engine.md §10.1 의 `logUsage` TS 시그니처에 `api?: { label?: string; method?: string; path?: string }` 를 추가해 0-common.md/data-model.md/mcp-client.md 와 정렬. spec 변경이 필요하므로 이 항목은 developer 단독(§자기-반증형 소정정 요건 미충족 — 예고 문장이 아니라 API 계약)이 아니라 project-planner 턴으로 처리

- **[WARNING]** chat-channel 실행 실패 분류표가 Integration 노드의 `INTEGRATION_*`/`CAFE24_*`/`MAKESHOP_*`/`EMAIL_HOST_BLOCKED` 코드를 명시 커버하지 않음 — rate-limit 오분류 가능
  - target 위치: `0-common.md` §4.2 (공통 에러 코드: `INTEGRATION_TYPE_MISMATCH`/`INTEGRATION_NOT_CONNECTED`/`INTEGRATION_INCOMPLETE`/`INTEGRATION_CALL_FAILED`/`INTEGRATION_SERVICE_UNAVAILABLE` — 5개 노드 전체 공용), `3-send-email.md` §6 (`EMAIL_HOST_BLOCKED`), `4-cafe24.md` §6 (`CAFE24_RATE_LIMITED` 등 `CAFE24_*`), `5-makeshop.md` §6 (`MAKESHOP_RATE_LIMITED` 등 `MAKESHOP_*`)
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md` §3.1 "카테고리 매핑" 표 (`classifyExecutionFailure`)
  - 상세: 이 표는 `HTTP_4XX`/`HTTP_5XX`/`HTTP_TRANSPORT_FAILED`/`HTTP_BLOCKED`/`EMAIL_SEND_FAILED`/`DB_*`(와일드카드) 만 명시 열거하고, 나머지는 "그 외 모든 code — unknown, fallback" 행(§3.1 표 마지막 행)으로 떨어져 `executionFailedInternal` + **backend `warn` 로그(CCH-ERR-04)** 를 발생시킨다. `DB_*` 는 와일드카드라 `DB_HOST_BLOCKED` 를 흡수하지만(2-database-query.md Rationale 이 이를 명시적으로 인용), `INTEGRATION_*`·`CAFE24_*`·`MAKESHOP_*`·`EMAIL_HOST_BLOCKED` 는 상응하는 와일드카드가 없어 같은 fallback 행으로 떨어진다. 결과는 두 가지다 — (a) 잘 정의된 공식 에러코드가 매번 "unknown code" 로 backend 경고 로그를 남긴다(운영 노이즈, CCH-ERR-04 의 취지와 어긋남 — 그 취지는 *진짜* 미지 코드 감지다), (b) 더 중요하게 `CAFE24_RATE_LIMITED`/`MAKESHOP_RATE_LIMITED` 는 `LLM_RATE_LIMIT` 과 의미상 동일(재시도 소진)한데 `executionFailedRateLimit` 가 아니라 fallback 의 `executionFailedInternal` 로 분류되어, 챗 채널 사용자에게 "일시적 rate limit, 나중에 재시도" 대신 "내부 오류" 메시지가 노출될 수 있다
  - 제안: chat-channel-adapter.md §3.1 표에 `INTEGRATION_*` 와일드카드 행(→ `executionFailedInternal`, DB_HOST_BLOCKED 와 동일 근거) 과 `EMAIL_HOST_BLOCKED`(→ `executionFailedInternal`, HTTP_BLOCKED 대칭) 를 추가하고, `CAFE24_RATE_LIMITED`/`MAKESHOP_RATE_LIMITED` 는 `LLM_RATE_LIMIT` 과 같은 `executionFailedRateLimit` 행에 합류시키는 것을 검토. spec 변경이므로 project-planner 턴 필요 — 단 cafe24/makeshop 노드가 chat-channel 트리거 워크플로에 실제로 배치되는 빈도가 낮다면 우선순위는 낮을 수 있음(제품 판단)

- **[INFO]** SSRF 가드가 실제로는 서로 다른 세 메커니즘인데, target 의 opt-out 콜아웃은 그중 둘(통합 노드 vs MCP)만 대조한다
  - target 위치: `1-http-request.md` §4 말미 `ALLOW_PRIVATE_HOST_TARGETS` 콜아웃 — "이 플래그는 통합 노드 전반의 SSRF 가드를 공통 제어한다 … AI Agent 의 MCP 서버는 별개 정책(`MCP_ALLOW_INSECURE_URL`)을 사용한다"
  - 충돌 대상: `spec/5-system/7-llm-client.md` §5.5 (ModelConfig `baseUrl` SSRF 가드 — loopback/RFC1918/link-local/IPv6 ULA/**IPv4-mapped IPv6**/`0.0.0.0/8` 차단, **CGNAT 미포함**, opt-out 플래그 없음)
  - 상세: 직접적인 모순은 아니다 — llm-client.md 는 자신의 목록을 독립적으로 정의하고 `ALLOW_PRIVATE_HOST_TARGETS` 공유를 주장하지 않는다. 다만 target 의 콜아웃이 "통합 노드 vs MCP" 두 갈래로만 세계를 나누는 인상을 주는데, 실제로는 (1) `http-safety.ts`(HTTP/DB, CGNAT 있음·IPv4-mapped 없음 — 현재), (2) `ssrf.util.ts`(SMTP/LLM/S3, IPv4-mapped 있음·CGNAT 없음), (3) MCP 자체 검증(§3.2) 세 갈래이며 밴드 목록도 서로 다르다(`plan/in-progress/ssrf-guard-integration-unify.md` 실측표 참고). 이번 plan 은 (1)(2) 를 http-safety 기준으로 합치되 LLM(2 의 일부)은 의도적으로 "비대상" 으로 남긴다 — 즉 합친 뒤에도 LLM Client 는 여전히 세 번째의 독자 밴드 목록을 유지한다
  - 제안: spec 변경 불필요(정보성). 이번 plan 완료 후 여유가 있다면 `1-http-request.md` 콜아웃 또는 `0-common.md` 에 "LLM Client(`5-system/7-llm-client.md §5.5`)는 별도의 독립 SSRF 목록(밴드 상이·opt-out 없음)을 쓰는 세 번째 메커니즘" 한 줄을 보태 향후 독자가 "SSRF 가드 = 단일 개념" 으로 오인하지 않게 한다

## 확인했으나 충돌 없음 (기록용)

- `Integration` 엔티티 필드(`credentials`/`status`/`status_reason`/`mall_id`(makeshop `shop_uid` 재투영)/`install_token`) — `1-data-model.md §2.10` 과 target 의 서술이 정확히 일치
- 에러 코드 3종 세트(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)와 `ALLOW_PRIVATE_HOST_TARGETS` 플래그 서술 — `2-navigation/4-integration.md §5.5·10.5`, `5-system/3-error-handling.md`, `5-system/11-mcp-client.md §8.4`(throw-vs-warn 분류) 전부 정합
- 요구사항 ID `INT-US-05`/`INT-AU-07` — `_product-overview.md` 정의와 target 전 파일의 인용이 의미·범위 모두 일치, 다른 영역에서 재사용/충돌 없음
- `D4` 결정(Integration 계열 SSRF·credential 실패를 `port:'error'` 로 라우팅) — `spec/conventions/node-output.md` §D4 와 target 5개 파일의 서술이 동일
- MCP Internal Bridge(Cafe24/MakeShop) 의 인증 격하·자가회복 정책 — `5-system/11-mcp-client.md §2.3·§8.4` 와 `4-cafe24.md §6.1·§8.6`, `5-makeshop.md §6.1` 상호 참조 일치

## 요약

target 번들(`spec/4-nodes/4-integration/*.md`)은 data-model·error-handling·mcp-client·config 등 다른 spec 영역과 대체로 정합하며, 요구사항 ID·SSRF 플래그·에러 코드 3종 세트(HTTP/DB/Email HOST_BLOCKED)는 정확히 교차 검증된다. 다만 두 가지 실질적 WARNING 을 찾았다 — (1) `execution-engine.md §10.1` 의 `IntegrationsService.logUsage` TS 시그니처가 INT-US-05 의 `api` 필드를 빠뜨린 stale 선언이고, (2) `chat-channel-adapter.md` 의 실행 실패 분류표가 `INTEGRATION_*`/`CAFE24_*`/`MAKESHOP_*`/`EMAIL_HOST_BLOCKED` 를 명시 커버하지 않아 최소 CAFE24/MAKESHOP 의 rate-limit 코드가 오분류될 수 있다. 둘 다 이번 SSRF-가드-통합 plan(`spec_impact: none`, 코드 전용)의 범위 밖이며 target 자체의 결함이 아니라 **다른** spec 파일의 drift 이므로, 현재 plan 의 착수를 막을 필요는 없다 — 단 별도 project-planner 턴에서 두 파일을 정정할 것을 권고한다. INFO 1건(LLM Client 가 세 번째 독립 SSRF 메커니즘이라는 사실이 target 콜아웃에 미반영)은 문서 완결성 문제일 뿐 충돌은 아니다.

## 위험도

LOW — CRITICAL 없음. WARNING 2건은 모두 target 문서 자체가 아니라 다른 spec 파일(execution-engine.md, chat-channel-adapter.md)의 drift 이며, 현재 착수하려는 코드 전용 SSRF 통합 작업의 진행을 차단하지 않는다.

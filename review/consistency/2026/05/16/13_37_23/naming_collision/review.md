# 신규 식별자 충돌 검토 — impl-prep (cafe24-test-connection)

검토 모드: 구현 착수 전 (`--impl-prep`)
대상 spec: `spec/2-navigation/4-integration.md`
참조 plan: `plan/in-progress/cafe24-test-connection.md`

---

## 발견사항

### [INFO] `testConnection` 메서드명 — 다른 모듈에도 동일 이름 존재

- **target 신규 식별자**: `Cafe24ApiClient.testConnection(integration)` (plan §"구현 범위" 1항)
- **기존 사용처**:
  - `LlmClientInterface.testConnection(): Promise<boolean>` — `backend/src/modules/llm/interfaces/llm-client.interface.ts:124`
  - `LlmService.testConnection(id, workspaceId)` — `backend/src/modules/llm/llm.service.ts:196`
  - `OpenAiClient.testConnection()`, `AnthropicClient.testConnection()`, `GoogleClient.testConnection()` — 각 LLM 클라이언트 구현체
  - `LlmConfigController.testConnection()` — `backend/src/modules/llm-config/llm-config.controller.ts:188`
- **상세**: `testConnection` 은 이미 LLM 도메인 전체에 걸쳐 사용 중인 메서드명이다. `Cafe24ApiClient` 는 `nodes/integration/cafe24/` 모듈에 위치하여 LLM 클라이언트와 클래스 계층이 완전히 분리되므로 런타임 충돌은 없다. 그러나 codebase 검색(`grep testConnection`) 시 LLM 계열과 Cafe24 계열이 섞여 노출된다. 반환 타입도 LLM 쪽은 `Promise<boolean>`, 제안 Cafe24 쪽은 `Promise<{ success: boolean; message?: string }>` 계열로 달라, 혼동 가능성이 있다.
- **제안**: `Cafe24ApiClient` 의 메서드를 `pingConnection()` 또는 `verifyToken()` 으로 명명해 LLM 계열 `testConnection` 과 시각적으로 구분한다. 또는 `IntegrationsService.dispatchTest` 내부에서만 cafe24 전용 분기를 익명 함수로 처리해 퍼블릭 메서드를 별도로 노출하지 않는 방법도 있다.

---

### [WARNING] `TransportTester` 타입 시그니처 확장 — 기존 계약 위반 위험

- **target 신규 식별자**: cafe24 분기를 위한 entity-aware `TransportTester` 확장 (plan: "testConnection 분기 자체를 entity-aware 로 확장")
- **기존 사용처**: `TransportTester` 타입 `(authType: string, credentials: Record<string, unknown>) => Promise<IntegrationTestResult>` — `backend/src/modules/integrations/integrations.service.ts:72-75`. 현재 유일한 등록 항목은 `['mcp', this.testMcpTransport.bind(this)]` (line 161)
- **상세**: 현행 `TransportTester` 는 `(authType, credentials)` 두 인자만 받으며, `dispatchTest` 가 이 시그니처를 강제한다. Plan 은 cafe24 분기가 `Integration` entity 전체를 필요로 한다고 명시하고 있어 현행 타입으로는 수용 불가하다. 타입을 변경하면 기존 `testMcpTransport` 바인딩도 함께 수정해야 한다. 변경 범위가 조용히 확대되는 문제 — `mcp` 분기와 cafe24 분기의 인자 집합이 달라 `Map<string, TransportTester>` 로 단일 타입으로 표현하기 어렵다.
- **제안**: `TransportTester` 를 확장하기보다, `testConnection` (public, entity 수신) 메서드에서 cafe24 경로를 직접 분기 처리하고 entity 없는 경로(`previewTest`)는 기존 `dispatchTest` 를 그대로 유지한다. 즉, entity-aware 경로와 credentials-only 경로를 분리하여 기존 타입 계약을 보존한다.

---

### [INFO] 테스트 핑 엔드포인트 — 스펙 본문과 구현 계획 불일치

- **target 신규 식별자**: `GET /api/v2/admin/apps` (plan §"구현 범위" 1항 및 §"Spec 갱신" 항)
- **기존 사용처**: `spec/2-navigation/4-integration.md §5.8` 의 현행 텍스트 — "저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/store` 핑. 응답 200 + JSON 본문 확인."
- **상세**: 구현 계획은 `/api/v2/admin/apps` 로 변경하지만 스펙 본문은 여전히 `/api/v2/admin/store` 를 기재하고 있다. impl-prep 착수 시점에서 스펙과 구현 의도가 엇갈린 상태다. plan 은 spec 갱신을 "project-planner 위임 대상"으로 표기하였으나, 구현 완료 전 스펙이 갱신되지 않으면 코드 리뷰어/신규 기여자가 스펙을 보고 잘못된 엔드포인트를 파악하게 된다.
- **제안**: 구현 착수 직전 또는 구현과 동시에 `spec/2-navigation/4-integration.md §5.8` 의 테스트 방법 텍스트를 plan 의 "Spec 갱신" 항 내용으로 갱신한다. plan 이 이미 위임 노트를 담고 있으므로 착수 전 project-planner 로 위임하여 스펙을 선(先)갱신한다.

---

### [INFO] `consecutiveNetworkFailures` 카운터 미적용 범위 — 스펙 묵시적 제외 명확화 필요

- **target 신규 식별자**: `testConnection` 호출 시 `consecutiveNetworkFailures` 카운터를 합산하지 않는다는 정책 (plan: "consecutiveNetworkFailures 카운터는 노드 호출 정의에 한정 — 테스트는 합산하지 않음")
- **기존 사용처**: `spec/1-data-model.md §2.10` — `consecutive_network_failures` 컬럼 설명: "노드 실행 / 토큰 갱신 중 transport 실패 카운터". `spec/2-navigation/4-integration.md §6` 전이 표: "`connected → error(network)` — 노드 실행 중 또는 토큰 갱신 중 transport 실패가 3회 연속"
- **상세**: 스펙은 카운터 증가 조건을 "노드 실행 / 토큰 갱신 중" 으로 명시하여 연결 테스트를 묵시적으로 제외하고 있다. Plan 의 "합산하지 않음" 정책은 스펙과 일치한다. 다만 스펙 텍스트가 "연결 테스트 제외"를 명시적으로 기재하지 않아, 구현자가 카운터를 합산해야 하는지 혼동할 여지가 있다.
- **제안**: `spec/2-navigation/4-integration.md §5.8` 또는 §6 의 `error(network)` 전이 조건에 "연결 테스트(`POST /api/integrations/:id/test`) 중 transport 실패는 카운터 합산 제외" 를 한 줄 추가한다. 스펙 갱신 위임(위 INFO 항목)에 합산한다.

---

## 요약

target 문서(`spec/2-navigation/4-integration.md`)는 이번 검토 diff 구간에서 신규 식별자를 도입하지 않는다(`(없음)`). 충돌 분석은 plan(`cafe24-test-connection.md`)이 기술한 구현 의도를 기준으로 수행하였다. 발견된 사항은 모두 INFO/WARNING 수준이다. `testConnection` 메서드명은 LLM 도메인 코드와 시각적으로 혼동될 수 있으나 런타임 충돌은 없으며, `TransportTester` 타입 시그니처 확장은 기존 `mcp` 분기와의 타입 정합성을 검토하여 설계할 필요가 있다. 가장 즉각적인 조치는 구현 착수 전 `spec/2-navigation/4-integration.md §5.8` 의 테스트 핑 엔드포인트(`/admin/store` → `/admin/apps`)를 project-planner 에 선(先) 위임하여 스펙·구현 간 불일치를 해소하는 것이다.

## 위험도

LOW

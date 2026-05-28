# 요구사항(Requirement) 리뷰 결과

## 분석 대상

- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (변경)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.spec.ts` (변경)
- `plan/in-progress/cafe24-mcp-usage-api.md` (신규)

---

## 발견사항

### [INFO] spec 참조 `§8.3` 의 DB 컬럼명과 코드 인터페이스 필드명 불일치 (의미적 일치, 명명 차이)
- 위치: `spec/5-system/11-mcp-client.md §8.3` 테이블 vs `integrationsService.logUsage` 파라미터
- 상세: spec §8.3 테이블은 DB 컬럼명 `api_label` / `api_method` / `api_path` 를 직접 노출하지만, `logUsage` 메서드의 TypeScript 파라미터는 `api.label` / `api.method` / `api.path` 로 camelCase nested 형태다. 코드 내부에서 `clampApiField(params.api?.label, ...)` → `apiLabel` 컬럼으로 매핑하므로 기능은 완전히 동작한다. 다만 spec 본문이 TS 파라미터가 아닌 DB 컬럼을 기술하고 있어, 독자가 spec 을 보고 코드를 처음 찾을 때 필드명이 다르다는 혼동이 생길 수 있다. spec 자체 결함(informative 수준)이며 구현 정확도에는 영향 없음.
- 제안: spec §8.3 테이블 하단에 "TypeScript 파라미터는 `api.label` / `api.method` / `api.path` (camelCase nested)" 주석 추가를 `project-planner` 에 위임 검토.

### [INFO] 테스트 커버리지 — `CAFE24_TRANSPORT_FAILED` 실패 경로의 `api` 필드 검증 누락
- 위치: `cafe24-mcp-tool-provider.spec.ts` `'translates Cafe24TransportFailedError into CAFE24_TRANSPORT_FAILED'` 테스트
- 상세: 성공 경로(`dispatches to Cafe24ApiClient`)와 `CAFE24_AUTH_FAILED` 실패 경로에는 `api` assertion 이 추가됐으나, `CAFE24_TRANSPORT_FAILED` 케이스(라인 873–900)는 `logUsage` 가 `status: 'failed'`, `error.code: 'CAFE24_TRANSPORT_FAILED'` 는 검증하지만 `api` 필드를 검증하지 않는다. 구현 코드에서 `api: apiInfo` 는 두 실패 경로(라인 524, 528) 에 모두 이미 포함돼 있어 실제 버그는 아니지만, INT-US-05 요구사항("실패 경로에서도 api 식별 정보 동반") 의 테스트 증거가 transport 실패 경로에서는 없다.
- 제안: `CAFE24_TRANSPORT_FAILED` 테스트의 `logUsage` 기댓값에 `api: { label: expect.any(String), method: expect.any(String), path: expect.any(String) }` assertion 추가.

### [INFO] `CAFE24_RATE_LIMITED` 실패 경로의 `api` 필드 검증 누락
- 위치: `cafe24-mcp-tool-provider.spec.ts` `'translates Cafe24RateLimitedError into CAFE24_RATE_LIMITED'` 테스트
- 상세: `nodeExecutionId` 와 `workflowId` 가 `ctx` 에 미주입(`config: {}, workspaceId, executionId` 만 지정)되어 있어 이 테스트에서는 `logUsage` 가 애초에 호출되지 않는다. 구현 코드(라인 1722–1733)는 `ctx.nodeExecutionId && ctx.workflowId` 조건이 있어야 `logUsage` 를 호출한다. 그러나 이 케이스도 성공적으로 흐름이 돌아가 `nodeExecutionId` + `workflowId` 가 있을 때 `api` 가 함께 기록되는지에 대한 coverage 가 없다. 실제 버그는 아니나 INT-US-05 의 rate-limit 실패 경로 증거 부족.
- 제안: `CAFE24_RATE_LIMITED` 테스트에 `nodeExecutionId: 'ne-1', workflowId: 'wf-1'` 를 추가하고 `logUsage` 에 `api` 포함 assertion 추가 검토.

---

## 기능 완전성 검토

구현의 핵심 변경 사항:

1. `opEntry` 에서 `resource` 추가 destructure (`{ resource, operation }`) — 완전히 구현됨.
2. `apiInfo = { label: cafe24.${resource}.${operation.id}, method: operation.method, path: operation.path }` 구성 — spec §7.5 요구 형식 `cafe24.<resource>.<operation>` 과 일치.
3. 성공 경로 `logUsage` 에 `api: apiInfo` 전달 — 구현됨 (라인 1706).
4. 실패(catch) 경로 `logUsage` 에 `api: apiInfo` 전달 — 구현됨 (라인 1731).
5. `logUsage` 호출 조건(`ctx.nodeExecutionId && ctx.workflowId`)이 양 경로에 모두 동일하게 적용됨 — 의도에 부합.

spec §8.3 "Internal Bridge 경로에서만 `api_label`/`api_method`/`api_path` 채움" 이라는 요구사항이 두 경로 모두에서 충족된다.

## Spec Fidelity 검토

### `spec/conventions/cafe24-api-metadata.md §7.5`
- 요구: `cafe24.<resource>.<operation>` 형식 — 코드: `cafe24.${resource}.${operation.id}` — 일치.
- 요구: `<resource>` 는 18 카테고리 enum 중 하나 — 코드는 `opEntry.resource` 를 직접 사용, opEntry 는 `listAllCafe24Operations()` 에서 나오므로 catalog 의 resource 그대로 사용 — 일치.

### `spec/5-system/11-mcp-client.md §8.3`
- 요구: `api_label` — `cafe24.<resource>.<operation>` 형식 catalog key — 구현의 `api.label` 이 이 값을 채움 — 일치.
- 요구: `api_method` — HTTP method (cafe24 operation) — 구현의 `api.method = operation.method` — 일치.
- 요구: `api_path` — operation.path template — 구현의 `api.path = operation.path` — 일치.
- 요구: 외부 MCP 서버 경로는 NULL — 본 변경은 Internal Bridge 경로만 수정, 외부 MCP (`McpToolProvider`) 는 무변경 — 일치.

### spec 코드 주석 참조 정확도
- 코드 주석에서 `spec/5-system/11-mcp-client.md §8.3` 를 인용하나 실제 해당 spec 절 헤딩은 "IntegrationUsageLog" 이다. 절 번호로 찾으면 일치하므로 기능적 문제는 없음.

---

## 요약

이번 변경은 `Cafe24McpToolProvider` 의 `logUsage` 호출 2곳에 `api: apiInfo` 를 누락하고 있던 버그를 수정한다. 구현 방식(resource destructure → apiInfo 구성 → 두 경로 전달)은 spec §7.5 (catalog key 형식)와 §8.3 (IntegrationUsageLog api_* 필드 정책)을 정확히 충족한다. 엣지 케이스(logUsage 가드 조건, 에러 분류 경로별 api 전달)도 올바르게 처리됐다. 발견된 3개 INFO 사항은 모두 테스트 coverage 보강 또는 spec 주석 개선 수준이며, 기능 정확성·spec 일치·비즈니스 로직 측면에서 CRITICAL·WARNING 사항은 없다.

---

## 위험도

LOW

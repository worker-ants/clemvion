# Testing Review — cafe24-mcp-usage-api

## 발견사항

### [INFO] success 케이스 api assertion 추가 — 적절
- 위치: `cafe24-mcp-tool-provider.spec.ts` diff hunk 1 (logUsage success assertion, 구 line 677)
- 상세: `dispatches to Cafe24ApiClient and returns success payload` 테스트의 `logUsage` 검증에 `api` 객체 assertion 이 추가됐다. `label`, `method`, `path: expect.any(String)` 구조가 구현 코드 `apiInfo` 형상과 정확히 대응한다. `expect.objectContaining` 으로 감싸 기존 `status: 'success'` 검증도 그대로 유지 — 회귀 보호 손실 없음.
- 제안: 없음. 적절히 작성됨.

### [INFO] auth-fail 케이스 api assertion 추가 — 적절
- 위치: `cafe24-mcp-tool-provider.spec.ts` diff hunk 2 (`translates Cafe24AuthFailedError into CAFE24_AUTH_FAILED`, 구 line 762)
- 상세: 실패 경로(`status: 'failed'`)에서도 `api` 식별 정보가 동반되는지 검증한다. 성공 케이스와 동일한 `label: 'cafe24.product.product_list'`, `method: 'GET'` 값을 사용해 두 경로가 같은 `apiInfo` 구성을 공유함을 확인한다.
- 제안: 없음.

### [WARNING] `CAFE24_TRANSPORT_FAILED` 테스트에 api assertion 없음 — 커버리지 불일치
- 위치: `cafe24-mcp-tool-provider.spec.ts` L872–899 (`translates Cafe24TransportFailedError into CAFE24_TRANSPORT_FAILED`)
- 상세: auth-fail 테스트에는 `api` assertion 이 추가됐지만, transport-fail 테스트의 `logUsage` 검증에는 `api` 없이 `status: 'failed'` + `error.code` 만 확인한다. 구현 코드(`cafe24-mcp-tool-provider.ts` L721–733 fail branch)는 `api: apiInfo` 를 동일하게 전달하므로 테스트 커버리지가 일관성 없이 누락됐다. 회귀 시 transport 실패 케이스에서 `api` 가 빠지더라도 이 테스트는 통과한다.
- 제안: `expect.objectContaining` 에 `api: { label: 'cafe24.product.product_list', method: 'GET', path: expect.any(String) }` 를 추가한다.

### [WARNING] rate-limit 케이스에 logUsage api 검증 부재
- 위치: `cafe24-mcp-tool-provider.spec.ts` L852–867 (`translates Cafe24RateLimitedError into CAFE24_RATE_LIMITED`)
- 상세: rate-limit 오류도 동일 fail branch 를 통해 `api: apiInfo` 포함 `logUsage` 를 호출한다. 현재 테스트는 응답 코드만 확인하고 `logUsage` 호출 자체를 검증하지 않는다 (fail 경로라서 `nodeExecutionId`/`workflowId` 가 없어 logUsage guard 를 통과 못 할 수 있음 — 아래 WARNING 참조). 적어도 logUsage 가 호출됐는지 여부는 명시적으로 테스트해야 한다.
- 제안: 테스트에 `workflowId`/`nodeExecutionId` 를 추가하고 `logUsage` 호출 + `api` 포함 여부를 검증한다.

### [WARNING] rate-limit / transport-fail 케이스에서 `nodeExecutionId`/`workflowId` 미주입 — logUsage guard 미통과
- 위치: spec.ts L852–899, 구현 코드 L1691 (`if (ctx.nodeExecutionId && ctx.workflowId)`) 및 L1721
- 상세: success/auth-fail 케이스는 `nodeExecutionId: 'ne-1'`, `workflowId: 'wf-1'` 을 주입하므로 `logUsage` guard 를 통과해 실제 logUsage 가 호출된다. 반면 rate-limit/transport-fail 케이스는 이 두 값이 없어 `logUsage` 가 아예 호출되지 않는다. 이 동작이 의도적이라면 주석으로 명시해야 하고, 실제로 두 케이스에서도 logUsage 를 찍어야 한다면 테스트 픽스처를 수정해야 한다.
- 제안: 의도 확인 후, logUsage 를 호출해야 하는 케이스라면 `nodeExecutionId`/`workflowId` 를 주입하고 assertion 을 추가한다. 의도적 누락이라면 테스트 주석에 "logUsage not called — no nodeExecutionId" 를 명시한다.

### [INFO] `CAFE24_CALL_FAILED` (catch-all) 경로에 api 검증 없음
- 위치: `cafe24-mcp-tool-provider.ts` `classifyError` 메서드 L1940–1944 catch-all, spec.ts 에 해당 케이스 미존재
- 상세: 분류되지 않은 일반 Error 를 `CAFE24_CALL_FAILED` 로 매핑하는 경로가 있지만 이 경로를 직접 테스트하는 케이스가 없다. `api` assertion 은 물론이고 에러 코드 검증 자체도 없다. 해당 경로도 동일 fail branch 를 타므로 `apiInfo` 가 전달되는지 확인할 수 없다.
- 제안: `apiClient.call.mockRejectedValue(new Error('unknown'))` 케이스를 추가해 `CAFE24_CALL_FAILED` + `api` assertion 을 검증한다.

### [INFO] 성공 경로 HTTP 4xx 응답 (status >= 400) 에서 api 검증 미존재
- 위치: `cafe24-mcp-tool-provider.ts` L1696–1706 success branch, `result.status >= 400` 분기
- 상세: `apiClient.call` 이 200 이 아닌 404/422/5xx 등 HTTP 오류 상태를 정상 반환(throw 없이)하는 경우 success branch 에서 `status: 'failed'` 로 `logUsage` 를 호출하고 `api: apiInfo` 를 포함한다. 현재 테스트에는 이 경로를 커버하는 케이스가 없다.
- 제안: `apiClient.call.mockResolvedValue({ status: 404, body: {...}, headers: {}, retries: 0 })` 케이스에 `logUsage` + `api` assertion 을 추가한다.

### [INFO] Mock 적절성 — `integrationsService` / `cafe24ApiClient` 구조 적절
- 위치: spec.ts L136–151 (mock 정의)
- 상세: `integrationsService`와 `apiClient`를 수동 jest.fn() 으로 mock 하는 방식은 NestJS DI 없이 클래스 단위 격리 테스트에 적합하다. 실제 DB/HTTP 호출 없이 빠르게 실행된다.
- 제안: 없음.

### [INFO] 테스트 격리 — `beforeEach` 에서 완전 재초기화
- 위치: spec.ts L139–152
- 상세: 각 테스트 전 `provider`, `integrationsService`, `apiClient` 가 새로 생성·초기화된다. 전 테스트 상태가 다음 테스트에 누출되지 않는다. `__resetForTesting()` 은 필요한 경우에만 명시 호출한다.
- 제안: 없음.

### [INFO] 테스트 가독성 — 주석과 네이밍 우수
- 위치: spec.ts 전반
- 상세: 각 `it` 블록 설명이 동작과 spec 참조를 함께 담아 의도가 명확하다. `// INT-US-05` 등 spec 링크 주석이 인라인 포함돼 어떤 요구사항을 검증하는지 추적 가능하다. diff 에 추가된 주석도 이 패턴을 일관되게 따른다.
- 제안: 없음.

### [INFO] 테스트 용이성 — 의존성 주입 구조 적절
- 위치: `cafe24-mcp-tool-provider.ts` L1278–1281 (constructor)
- 상세: `IntegrationsService`와 `Cafe24ApiClient`가 생성자 주입으로 분리돼 있어 테스트에서 jest mock 으로 쉽게 치환된다. `buildJsonSchema` 같은 pure 메서드는 `null as never` 로 provider 를 생성해 직접 호출할 수 있다. 코드 구조 자체가 testability 를 잘 지원한다.
- 제안: 없음.

## 요약

이번 변경의 핵심은 `logUsage` 호출 2곳에 `api: apiInfo` 를 추가하는 버그픽스이며, 이에 상응하는 테스트도 success/auth-fail 두 케이스에 `api` assertion 을 추가해 TDD 원칙에 충실하다. 기존 테스트 격리·가독성·mock 전략은 양호하다. 다만 transport-fail 케이스에는 auth-fail 과 동일하게 `api` assertion 이 누락돼 있고, rate-limit/transport-fail 케이스가 `nodeExecutionId`/`workflowId` 를 주입하지 않아 실제 logUsage guard 를 통과하지 않는 암묵적 동작이 주석 없이 방치되어 있다. 또한 HTTP 4xx 정상 반환 경로와 `CAFE24_CALL_FAILED` catch-all 경로에 대한 `api` 검증이 전혀 없어 커버리지 갭이 존재한다.

## 위험도

LOW

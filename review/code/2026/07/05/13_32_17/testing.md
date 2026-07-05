# 테스트(Testing) Review — SSRF 에러 메시지 일반화 (HTTP Request)

대상: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`,
`codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`

## 발견사항

- **[WARNING]** redirect-hop SSRF 차단 신규 경로(`err instanceof IntegrationError` 분기)의 `logUsage` 호출이 테스트로 검증되지 않음
  - 위치: `http-request.handler.ts` 535-544행 (신규 catch 분기) / `http-request.handler.spec.ts` 1071-1105행 (`blocks redirect to internal host ...` 신규 테스트)
  - 상세: 이번 diff 가 새로 추가한 로직은 두 갈래다. (1) redirect hop 검증 실패 시 `IntegrationError(HTTP_BLOCKED, ...)` 를 throw 하도록 바꾼 것, (2) 바깥 `catch` 에서 `err instanceof IntegrationError` 일 때 `logUsage`(`integrationId && authentication === 'integration'`)를 호출하고 `buildPreflightErrorOutput` 으로 라우팅하는 것. 신규 테스트 `blocks redirect to internal host with HTTP_BLOCKED + generalized message`는 `authentication: 'integration'` + `integrationId: 'int-1'` 조합으로 실행되어 정확히 이 `logUsage` 분기를 타지만, `makeService` 반환값에서 `logUsage` 를 구조분해하지 않고 `service` 만 취해 호출 여부·인자(`error.code`/`error.message` 일반화 여부)를 전혀 단언하지 않는다. 동일 파일의 preflight SSRF 테스트(909-941행)는 `logUsage` 호출·인자를 명시적으로 검증하는 대칭 패턴이 이미 존재하므로, redirect 경로에서만 이 검증이 누락된 것은 우연이 아니라 커버리지 갭이다. 이 분기가 잘못 구현돼 usage 로그에 원본 hostname 이 그대로 실리거나 아예 호출되지 않아도 현재 테스트는 통과한다.
  - 제안: 신규 테스트에서 `const { service, logUsage } = makeService(...)` 로 바꾸고 `expect(logUsage).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: expect.objectContaining({ code: 'HTTP_BLOCKED', message: 'Request blocked by SSRF policy.' }) }))` 단언을 추가한다.

- **[WARNING]** `logger.warn` 원본 상세 보존이 테스트로 검증되지 않음 (스펙 의도한 서버측 로그 보존이 회귀에 무방비)
  - 위치: `http-request.handler.ts` 25행 (`const logger = new Logger(...)`), 364-365행 / 454-455행 / 438-440행 (세 곳의 `logger.warn` 호출) — spec.ts 전체에 `Logger`/`jest.spyOn` 참조 없음
  - 상세: 이 변경의 핵심 보안 트레이드오프는 "클라이언트 메시지는 일반화하되 원본 hostname/IP 는 `logger.warn` 으로 서버에 보존한다"이다(주석·consistency SUMMARY 양쪽에서 명시적으로 이 설계를 서술). 그런데 `logger.warn` 이 실제로 호출되는지, 호출 시 원본 상세(`err.message` 등 hostname/IP 포함)를 담고 있는지 검증하는 테스트가 하나도 없다. 이 로직이 실수로 삭제되거나 인자가 바뀌어도(예: 일반화된 메시지를 로깅해버리는 회귀) 테스트 스위트는 여전히 녹색이다 — 이는 "관측 가능성 보장" 자체가 이번 변경의 목적인데 그 목적을 검증하는 테스트가 없는 상태다. consistency SUMMARY.md 확정 스코프에도 "logger 원본 보존 spy" 가 계획 항목으로 명시돼 있었으나 실제 diff 에는 반영되지 않았다.
  - 제안: `jest.spyOn(Logger.prototype, 'warn')` (또는 `nestjs Logger` mock) 로 preflight·redirect 각 1개 케이스에서 `logger.warn` 이 차단된 hostname/IP 원문을 포함한 문자열로 호출됐음을 최소 1건씩 검증.

- **[WARNING]** "redirect chain exceeded 5 hops" 경로(HTTP_BLOCKED 승격)에 대한 테스트 부재
  - 위치: `http-request.handler.ts` 436-445행 (`if (hops >= 5) { ... throw new IntegrationError(ErrorCode.HTTP_BLOCKED, SSRF_BLOCKED_CLIENT_MESSAGE); }`)
  - 상세: 이 diff 는 기존 `throw new Error('SSRF_BLOCKED: redirect chain exceeded 5 hops')` (일반 `Error`, 바깥 catch 에서 `HTTP_TRANSPORT_FAILED` 로 오분류되던 코드)를 `IntegrationError(HTTP_BLOCKED, ...)` 로 바꾸는 동작 변경을 포함한다. 이는 "정찰 면 축소"보다 "에러 분류 정정"에 가까운 별개의 동작 변화이며, 5-hop 초과 시나리오(예: `it.each` 로 5개 이상 연속 302 mock)를 재현하는 테스트가 spec.ts 어디에도 없다. `grep -n "hops >= 5\|exceeded 5 hops"` 결과 handler.ts 에만 존재하고 spec.ts 는 0건이다.
  - 제안: 5개 이상 연속 redirect 를 mock 하여 `port: 'error'`, `output.error.code === 'HTTP_BLOCKED'`, `output.error.message === SSRF_BLOCKED_CLIENT_MESSAGE` 를 단언하는 케이스 1개 추가. 이번 diff 가 이 경로의 에러 분류(`HTTP_TRANSPORT_FAILED` → `HTTP_BLOCKED`)를 바꿨으므로 회귀 방지 관점에서 우선순위가 높다.

- **[INFO]** `output.error.details.url` 이 SSRF 차단 경로에서 원본 host 를 그대로 노출하는지 여부가 명시적으로 테스트되지 않음
  - 위치: `http-request.handler.ts` 614-640행 (`buildPreflightErrorOutput`) — `details: { url: sanitizeUrlCredentials(url), method }`
  - 상세: `message` 는 일반화됐지만 같은 error envelope 의 `output.error.details.url` 필드는 여전히 (credential 만 strip 한) 실제 차단 대상 URL 을 그대로 담는다 (`sanitizeUrlCredentials` 는 userinfo/query-secret 만 마스킹하고 hostname/IP 는 보존). 즉 클라이언트가 `output.error.message` 는 일반화된 문구를 보지만 같은 응답의 `output.error.details.url` 에서 차단된 IP/호스트를 여전히 볼 수 있어, "정찰 면 축소"라는 이번 변경의 목적이 `details.url` 필드로 우회될 수 있다. 이 필드가 의도적으로 유지된 것인지(예: 워크플로우 작성자 디버깅용) 아니면 갭인지 테스트/주석 어디서도 명시되지 않는다.
  - 제안: 최소한 기존 SSRF 차단 테스트 중 하나에 `expect(output.error.details?.url).toBeDefined()` 같은 현재 동작을 고정하는 단언을 추가하거나, 의도적 유지라면 주석으로 명시. Critical 은 아니나 "정찰 면 축소"라는 보안 목적의 완전성 검증 관점에서 커버리지 갭.

- **[INFO]** 신규 redirect 테스트가 `authentication: 'integration'` 케이스만 커버 — `none`/`custom` 인증에서는 애초에 redirect-follow 루프가 실행되지 않음(코드 430행 `authentication === 'integration' && ...`)이 테스트로 명시되지 않음
  - 위치: `http-request.handler.ts` 430행 `while (authentication === 'integration' && ...)` / spec.ts 신규 테스트는 `integration` 만
  - 상세: redirect-follow(및 그에 따른 SSRF 재검증)는 `authentication === 'integration'` 일 때만 동작한다. `none`/`custom` 인증으로 302 redirect 를 받으면 루프를 타지 않고 그대로 `res.ok === false` → `HTTP_4XX`/`HTTP_5XX` 경로로 빠진다(실제로 SSRF 차단 자체가 발생하지 않음 — 3xx 는 5xx/4xx 미해당이라 non-2xx envelope 로 흐름). 이 비대칭 동작 자체는 이번 diff 범위가 아니지만(기존 코드), 신규 테스트가 이 경계를 명시하지 않아 향후 "redirect SSRF 는 인증 방식 무관하게 차단돼야 한다"는 오해로 회귀될 위험이 있다. Critical 은 아니며 기존 동작의 문서화 갭.
  - 제안: 우선순위 낮음. 필요 시 `none`/`custom` + redirect 조합에 대한 별도 케이스(또는 주석)로 이 경계를 명시.

## 요약

핵심 diff 는 4곳의 기존 메시지 단언(`toMatch(/SSRF_BLOCKED/)` → `toBe('Request blocked by SSRF policy.')`)을 정확히 갱신했고, `169.254` 미노출을 검증하는 negative assertion 도 적절히 추가했다. 신규 redirect SSRF 테스트(`blocks redirect to internal host...`)는 이번 변경의 핵심 신규 라우팅 로직(redirect hop 검증 실패 → `IntegrationError` throw → 바깥 catch 승격 → `HTTP_BLOCKED`)의 happy-path 는 커버하지만, 같은 분기의 `logUsage` 호출 검증을 빠뜨렸다(동일 파일의 대칭 preflight 테스트는 이를 검증함 — 일관성 없는 커버리지). 더 중요하게는, 이번 변경의 보안 목적 자체("클라이언트엔 일반화, 서버 로그엔 원본 보존")를 뒷받침하는 `logger.warn` 호출을 검증하는 테스트가 전무하다 — consistency-check SUMMARY 가 명시적으로 계획했던 "logger 원본 보존 spy"가 실제 diff 에 반영되지 않았다. 또한 이번 diff 가 동작을 바꾼 "5-hop 초과" 경로(`HTTP_TRANSPORT_FAILED` 오분류 → `HTTP_BLOCKED` 정분류)에 대한 테스트가 없어 회귀 방지가 안 된다. Mock 사용(전역 `global.fetch` 교체, `headers.get` 인라인 스텁)은 기존 패턴과 일관되고 적절하며, 각 테스트는 독립적으로 `global.fetch`/`makeService`를 재설정하므로 격리 문제는 없다. 테스트 가독성은 한국어 주석으로 의도(정찰 면 축소, spec 참조)를 명확히 밝혀 우수하다. 전체적으로 이번 diff 는 기존 회귀 테스트를 깨뜨리지 않고 정확히 갱신했으나(73/73 통과 확인), 신규로 추가된 보안 로직(로그 보존, redirect-hop usage 로그, 5-hop 초과 재분류)에 대한 커버리지가 스스로 세운 계획(SUMMARY.md) 대비 미달한다.

## 위험도

MEDIUM

# 테스트(Testing) Review — SSRF 에러 메시지 일반화 후속(logger.warn spy·redirect logUsage·5-hop 테스트 추가)

대상: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`,
`codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`
(review/ 하위 나머지 파일은 이전 ai-review 라운드(13_32_17)의 산출물 재수록으로, 신규 코드 아님 — 테스트 관점 리뷰 대상 아님)

## 배경

이번 diff 는 직전 ai-review 라운드(`review/code/2026/07/05/13_32_17/testing.md`)가 지적한 3건의 WARNING(redirect-hop `logUsage` 미검증, `logger.warn` 원본 보존 미검증, 5-hop 초과 경로 테스트 부재)에 대한 RESOLUTION 커밋이다. 세 WARNING 모두 새 테스트 케이스로 해소를 시도했다.

## 발견사항

- **[INFO]** 직전 WARNING#1(redirect-hop `logUsage` 미검증)은 정확히 해소됨
  - 위치: `http-request.handler.spec.ts:1090, 1114-1121` (`blocks redirect to internal host ...` 테스트)
  - 상세: `makeService` 반환값에서 `logUsage` 를 구조분해해 `expect(logUsage).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'HTTP_BLOCKED', message: 'Request blocked by SSRF policy.' }) }))` 단언을 추가했다. 실제 핸들러(`http-request.handler.ts:538-546`)의 `err instanceof IntegrationError` 분기가 정확히 이 경로를 타는 유일한 소스(같은 try 블록 내에서 `IntegrationError` 를 throw 하는 곳은 438-446행·458-461행 redirect SSRF 두 곳뿐)이므로, 이 신규 단언이 실질적으로 해당 로직을 커버한다. 조치 불필요.

- **[INFO]** 직전 WARNING#2(`logger.warn` 원본 보존 미검증)도 해소됨
  - 위치: `http-request.handler.spec.ts:1075-1077, 1110-1112, 1122`
  - 상세: `jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)` 로 스파이를 걸고 `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('169.254.169.254'))` 로 원본 IP 가 서버 로그에 실제로 남는지 검증한다. `warnSpy.mockRestore()` 로 테스트 종료 시 정리해 다른 테스트에 스파이가 누수되지 않도록 격리했다. `Logger.prototype.warn` 은 이 파일에서 `new Logger('HttpRequestHandler')` 인스턴스가 프로토타입 메서드를 그대로 사용하므로(인스턴스 자체 오버라이드 없음) 스파이가 정확히 대상 호출을 가로챈다 — 실제로 `npx jest http-request.handler.spec.ts` 실행 결과 74/74 통과로 확인.
  - 참고: 이 테스트는 preflight 경로(`logger.warn` L367)가 아니라 redirect 경로(`logger.warn` L457, prefix `SSRF block (http-request redirect):`)만 검증한다. preflight 경로의 `logger.warn` 호출 자체는 여전히 어떤 테스트로도 직접 스파이 검증되지 않는다(간접적으로는 fixture 실행 시 콘솔에 찍히는 것을 눈으로 확인 가능하나 assertion 은 없음) — 사소하지만 대칭성 관점에서 갭. Critical/Warning 사유는 아님(redirect 경로 커버로 로직 자체(`detail` 추출 → `logger.warn`)의 정확성은 사실상 검증됨).

- **[INFO]** 직전 WARNING#3(5-hop 초과 경로 테스트 부재)도 해소됨
  - 위치: `http-request.handler.spec.ts:1125-1155` (`blocks redirect chain exceeding 5 hops ...`)
  - 상세: `global.fetch` 를 `mockResolvedValue`(1회성 아닌 반복 응답)로 설정해 매 호출이 공인 IP(`93.184.216.34`)로 302 redirect 하도록 구성, `hops >= 5` 분기(`http-request.handler.ts:438`)가 실제로 `IntegrationError(HTTP_BLOCKED, ...)` 를 throw 하고 바깥 catch 에서 올바르게 승격되는지 `port: 'error'` / `error.code === 'HTTP_BLOCKED'` / 일반화된 message 로 검증한다. 이 케이스는 이전에는 `Error('SSRF_BLOCKED: ...')` 로 오분류되던(`HTTP_TRANSPORT_FAILED`) 회귀를 정확히 막는 회귀 테스트로 기능한다.
  - 다만 이 테스트는 `logUsage` 호출 여부를 검증하지 않는다(위 redirect-hop 테스트와 달리 `service` 만 구조분해). 5-hop 초과 경로도 동일하게 `authentication: 'integration'` + `integrationId` 조합이라 `logUsage` 가 호출되는 코드 경로(L538-546)를 타지만, 이 테스트 자체는 그 인자를 단언하지 않는다. 다만 바로 위 redirect-to-internal-host 테스트가 동일한 `err instanceof IntegrationError` 분기의 `logUsage` 인자 포맷을 이미 검증하고 있어 실질적 리스크는 낮다(같은 코드 경로, 다른 트리거).
  - 등급: INFO (이미 대칭 테스트가 동일 분기를 커버해 실질 커버리지 갭은 낮음). 완전성을 원한다면 이 테스트에도 `logUsage` 단언을 추가할 수 있으나 필수는 아니다.

- **[INFO]** `logger.warn` prefix 비일관성(`http-request.handler.ts:441` vs `457`)이 테스트로 고정(lock-in)되지 않음
  - 위치: `http-request.handler.ts:440-442` (`'SSRF block (http-request): redirect chain exceeded 5 hops'` — preflight 와 동일 접두어) vs `:457` (`` `SSRF block (http-request redirect): ${detail}` ``)
  - 상세: 직전 라운드 maintainability 리뷰가 이미 지적한 이슈(로그 태그 불일치)로, 이번 diff 로 신규 도입된 문제는 아니고 이번 diff 가 고치지도 않았다. 5-hop 테스트(1125행)는 `warnSpy` 를 사용하지 않아 이 접두어 불일치를 assertion 으로 노출하지 않는다 — 실행 로그 확인(`jest` 콘솔 출력)으로만 육안 확인 가능한 상태. 이 자체는 테스트 커버리지 갭이라기보다 "테스트가 검증하기로 선택하지 않은 사소한 로그 문자열"이라 등급은 낮다.
  - 제안(선택): 필요 시 5-hop 테스트에도 `warnSpy` 를 추가해 접두어를 `redirect-limit` 등으로 구분하는 리팩터링과 함께 lock-in 하면 향후 디버깅 편의를 보장할 수 있다. 현재 스코프에서는 조치 불요.

- **[INFO]** Mock 적절성 — `global.fetch` mock 이 `Response` 형태를 최소한만 흉내내지만 실사용 필드(`headers.get`, `text`, `json`)와 실제 코드 소비 패턴이 일치
  - 위치: `http-request.handler.spec.ts:1078-1089, 1127-1136`
  - 상세: 두 신규 테스트 모두 `headers: { get: (h) => ... }` 인라인 스텁으로 `res.headers.get('location')` 소비 패턴과 정확히 일치하고, `res.ok`/`res.status` 로 redirect 분기(`432-436행` while 조건)를 정확히 트리거한다. `text`/`json` 을 `jest.fn()`(호출되지 않을 것으로 예상되는 필드)으로 남겨둔 것도 redirect 루프에서 실제로는 소비되지 않는 필드이므로 적절하다. 실제 fetch 동작과의 괴리는 없다.

- **[INFO]** 테스트 격리 — 신규 두 테스트 모두 독립적으로 `global.fetch`/`makeService`/`warnSpy` 를 재설정하며, `warnSpy.mockRestore()` 로 스파이를 명시적으로 해제해 이후 테스트에 영향이 전파되지 않는다. `beforeEach` 에서 `global.fetch` 를 기본 mock 으로 리셋하는 기존 패턴과도 충돌하지 않는다. 격리 문제 없음.

- **[INFO]** 테스트 가독성 — 두 신규 테스트 모두 한국어 주석으로 "무엇을·왜" 를 명확히 설명("공인 IP → 302 → internal IMDS, manual redirect follow 가 각 hop 재검증", "매 응답이 공인 IP 로 302 → 5홉 초과 시 HTTP_BLOCKED")하고 있어 의도가 분명하다. `expect(...).not.toContain('169.254')` negative assertion 도 "정찰 면 축소"라는 보안 목적을 직접적으로 검증해 테스트 자체가 보안 요구사항의 실행 가능한 명세 역할을 한다.

- **[INFO]** 회귀 테스트 — 기존 4곳의 `toMatch(/SSRF_BLOCKED/)` → `toBe('Request blocked by SSRF policy.')` 치환은 유효하며, 실행 결과(`npx jest http-request.handler.spec.ts`) 74/74 통과로 재확인했다. 기존 테스트가 이번 변경 후에도 깨지지 않는다.

## 요약

직전 ai-review 라운드의 testing WARNING 3건(redirect-hop `logUsage` 미검증, `logger.warn` 원본 보존 미검증, 5-hop 초과 경로 테스트 부재)은 이번 diff 로 실질적으로 해소되었다. `Logger.prototype.warn` 스파이·`logUsage` 인자 단언·5-hop 재현 테스트 모두 실제 핸들러 코드 경로(`http-request.handler.ts:438-462, 532-556`)와 정확히 대응하며, 직접 실행(`npx jest`, 74/74 통과)으로 정상 동작을 확인했다. Mock 은 실제 `fetch`/`Response` 소비 패턴과 괴리 없이 적절하고, 신규 테스트는 독립적으로 격리되어 있으며(`warnSpy.mockRestore()` 포함), 주석을 통한 의도 표현도 우수하다. 남은 갭은 경미한 수준이다 — (1) preflight 경로의 `logger.warn` 자체를 직접 스파이 검증하는 테스트는 없다(redirect 경로만 검증, 로직은 대칭이라 실질 리스크 낮음), (2) 5-hop 테스트는 `logUsage` 인자를 별도로 단언하지 않는다(동일 분기를 검증하는 인접 테스트가 이미 커버), (3) 직전 라운드 maintainability 리뷰가 지적한 로그 prefix 불일치(`redirect chain exceeded 5 hops` 케이스가 `(http-request)` prefix 를 그대로 씀)는 이번 diff 로 고쳐지지도, 테스트로 lock-in 되지도 않았다 — 하지만 이는 이번 diff 의 스코프(테스트 보강)를 벗어나는 별개의 사소한 이슈다. 전체적으로 테스트 용이성 측면에서도 `makeService` 헬퍼의 재사용성, `HttpRequestHandler` 생성자에 서비스 mock 을 주입하는 구조(DI) 덕분에 이번 신규 케이스들을 최소한의 보일러플레이트로 추가할 수 있었다.

## 위험도

NONE

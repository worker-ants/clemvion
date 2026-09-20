# 테스트(Testing) 리뷰 — SSRF 가드 소비자 넷의 catch (`instanceof SsrfBlockedError`)

## 검증 방법

- 대상 5개 spec 파일(`database-connection-tester.spec.ts` · `http-connection-tester.spec.ts` ·
  `database-query.handler.spec.ts` · `http-redirect.spec.ts`(신설) · `http-request.handler.spec.ts`)을
  실행 — `Test Suites: 5 passed, 5 total / Tests: 209 passed, 209 total` (GREEN 확인).
- 판별력 재확인: `http-request.handler.ts`의 `if (!(err instanceof SsrfBlockedError))` 조건을
  `if (false)`로 뮤테이션 → 새로 추가된 해당 테스트 1건만 정확히 RED(`Expected: "INTEGRATION_CALL_FAILED"`,
  `Received: "HTTP_BLOCKED"`), 나머지 74건은 그대로 PASS. 원복 후 `git status --short` 로 저장소 clean 확인.
  (원복 1차 시도가 `cp` 명령을 `git -C ...`와 한 셸 호출에 묶어 보냈다가 샌드박스가 호출 전체를 차단해 무반영으로
  남았던 것을 재확인 후 별도 호출로 정상 원복 — 최종 상태는 clean.)

## 발견사항

- **[INFO]** `http-request.handler.ts`의 새 비판정 분기(`INTEGRATION_CALL_FAILED`)는 `authentication === 'integration'` 경로만 테스트됨 — `none`/`custom` 인증에서 `logUsage`를 호출하지 않는 분기(`if (authentication === 'integration' && integrationId)`)는 이 새 브랜치에 대해 직접 검증되지 않는다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:364` (조건문), 대응 테스트는 `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts:960`(`it('가드가 판정 아닌 오류를 던지면 HTTP_BLOCKED 가 아니라 INTEGRATION_CALL_FAILED', ...)`)
  - 상세: 기존 SSRF-차단(판정) 경로는 `authentication: 'none'`/`'custom'` 조합까지 `it.each`로 커버하는데(`http-request.handler.spec.ts:1096` 부근 `it.each(['none', ...])`), 새로 추가된 비판정 경로는 `bearer_token`(= `integration` 인증) 한 케이스만 검증한다. 코드 구조상 두 분기가 같은 `if` 조건을 공유하므로 회귀 위험은 낮지만, "판정 경로는 인증 방식별로 다 봤는데 비판정 경로는 하나만 본다"는 비대칭이 남는다.
  - 제안: `it.each(['none', 'custom'])`로 비판정 분기에서도 `logUsage`가 호출되지 않음을 확인하는 케이스를 1건 추가하면 대칭이 맞는다. 블로킹 사유는 아님.

- **[INFO]** `followRedirectsSafely`(리다이렉트 루프 내부)에서 `outboundBlockReason`이 비판정 오류를 던지는 경로는 새 `http-redirect.spec.ts`에서 직접 커버되지 않는다 — 테스트는 `outboundBlockReason` 자체(첫 호출)만 대상으로 하고, 루프 안에서 매 홉마다 재호출될 때 던져진 예외가 `followRedirectsSafely`를 거쳐 상위 호출자(`http-request.handler.ts`/`http-connection-tester.ts`)까지 그대로 전파되는지는 별도로 검증하지 않는다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` 함수 `followRedirectsSafely`(약 55~79행), 신규 테스트는 `codebase/backend/src/nodes/integration/http-request/http-redirect.spec.ts:38`(`it('판정 아닌 오류는 사유로 삼키지 않고 그대로 던진다', ...)`) — 이 테스트는 `outboundBlockReason`만 직접 호출.
  - 상세: `followRedirectsSafely`는 `outboundBlockReason`을 try/catch 없이 그대로 `await`하므로 예외가 자연 전파된다는 점에서 구조적으로는 첫-홉 경로와 동일하지만, "리다이렉트 대상에서 가드가 고장났을 때"라는 시나리오 자체는 plan의 테스트 목록(5개 항목)에도 명시적으로 들어있지 않다 — 의도적으로 범위를 좁힌 것으로 보이나, 코드 리뷰 관점에서는 커버리지 갭으로 기록해 둔다.
  - 제안: 필수는 아님. 추가한다면 `followRedirectsSafely`에 302 응답 뒤 `assertSafeOutboundUrl`이 비판정 오류를 던지는 케이스 1건.

## 확인된 양호 사항 (참고)

- 4개 소비자(HTTP 노드 preflight · `http-redirect.ts` · DB 노드 preflight · DB 연결 테스터) + 신규 `outboundBlockReason` 단위 테스트까지, 판정(`SsrfBlockedError`) vs 비판정(`TypeError`) 두 갈래를 모두 주입해 각 호출부의 기존 "분류되지 않은 실패" 경로(`INTEGRATION_CALL_FAILED`/던짐/`*_CONNECT_FAILED`)로 가는지 정확히 검증한다. 판정 경로 기존 테스트가 전부 `SsrfBlockedError`로 교체된 것도 일관적 — mock이 클래스를 가리지 않도록 `jest.requireActual`로 실물 클래스를 보존한 설계가 정확하다(주석에 그 이유까지 명시).
- Mock 격리 양호: `mockRejectedValueOnce`/`mockImplementationOnce`를 쓴 곳은 자동 자기 소거되고, `mockRejectedValue`(비-Once)를 쓴 `database-connection-tester.spec.ts`는 `beforeEach`에서 매번 `mockedGuard.mockResolvedValue(undefined)`로 명시적으로 재설정하므로 테스트 간 오염이 없다(직접 확인).
- `database-query.handler.spec.ts` 신규 테스트는 `INTEGRATION_CALL_FAILED`로의 승격이 outer `catch`의 `mapDbError` fallback을 우회해 `IntegrationError.code`를 그대로 보존하는 것까지 확인(`connectMock`이 호출되지 않음도 함께 단언) — 가드 실패가 실제로 드라이버 연결 이전 단계에서 끊기는지까지 커버.
- `http-connection-tester.ts`의 preflight `outboundBlockReason` 호출을 `try` 안으로 옮긴 변경("no-throw 계약" 복원)에 대해, 새 테스트가 옮기기 전이라면 이 테스터가 예외를 던져 계약을 깼을 것임을 뮤테이션으로 검증 가능한 형태로 작성돼 있다(코드 구조상 `outboundBlockReason`이 `try` 밖에 있었다면 이 테스트는 unhandled rejection으로 실패했을 것).
- 각 신규 테스트의 assertion이 "차단 아님을 확인"만 하지 않고 `code`·`message` 내용·부수효과(`connectMock`/`fetchMock` 미호출, `logUsage` 인자)까지 구체적으로 검증해 vacuous 위험이 낮다.
- plan 체크리스트에 기록된 "뮤턴트 넷 전부 RED" 주장은 이번 세션에서 `http-request.handler.ts` 1건을 재현 검증했고 그 결과가 일치했다(RED, 해당 테스트만 실패).

## 요약

SSRF 가드의 "판정(`SsrfBlockedError`) vs 그 외 오류" 분기를 도입하며, 4개 소비자 + 신규 유틸(`outboundBlockReason`) 각각에 대해 판정 경로는 유지하고 비판정 경로가 각자의 기존 실패 코드(`INTEGRATION_CALL_FAILED`/던짐/`*_CONNECT_FAILED`)로 가는지 정밀하게 검증하는 테스트가 신설됐다. 209개 전체 GREEN을 재현 확인했고, 대표 분기 하나를 직접 되돌려 RED가 정확히 그 테스트에서만 나는 것도 재현했다 — mock 격리·mock 실물 보존(`jest.requireActual`)·assertion 구체성 모두 양호하다. 남은 갭은 두 가지 INFO 수준 비대칭뿐이다: (1) 새 `INTEGRATION_CALL_FAILED` 분기가 `authentication: 'integration'` 한 가지만 커버(기존 차단 경로는 `none`/`custom`까지 `it.each`로 커버), (2) 리다이렉트 홉 도중에 가드가 비판정 오류를 던지는 경로(`followRedirectsSafely` 루프 내부)는 직접 테스트되지 않음(구조상 첫 홉과 동일 코드 경로이므로 위험은 낮음). 둘 다 블로킹 사유가 아니다.

## 위험도

LOW

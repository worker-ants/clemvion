# 테스트(Testing) 리뷰 — SSRF 가드 소비자 넷의 catch (2라운드, `instanceof SsrfBlockedError`)

## 검증 방법

- 실제 소스 파일을 `Read`/`grep` 으로 직접 열어 diff 게이트 줄 번호와 대조 확인(`database-connection-tester.ts` · `database-connection-tester.spec.ts` · `http-connection-tester.ts` · `http-connection-tester.spec.ts` · `database-query.handler.ts` · `database-query.handler.spec.ts` · `http-redirect.ts` · `http-redirect.spec.ts` · `http-request.handler.ts` · `http-request.handler.spec.ts`).
- 각 spec 파일의 `beforeEach`/mock 팩토리 전문을 열어 `jest.clearAllMocks()`/`mockReset()`/`mockRejectedValueOnce` 적용 범위와 격리 여부를 직접 추적.
- `IntegrationError`(`integration-handler-base.ts`) 생성자 시그니처(`code, message` 2-arg, `cause` 미노출)를 확인해 "cause 를 붙이지 않는다" 주석이 설계로 이미 강제되는지 검증(반증 시도 — 실패, 근거 유효).
- `SsrfBlockedError` 클래스(`http-safety.ts`)의 메시지 포맷(`SSRF_BLOCKED: ${detail}`)을 직접 확인해 신규 테스트의 문자열 단언이 실물과 일치하는지 대조.
- 이 라운드는 1라운드(`review/code/2026/09/20/09_35_16`) RESOLUTION 이 W2(타임아웃 예산 잠식)를 고치며 추가한 회귀 테스트(`http-connection-tester.spec.ts` 신규 1건)가 diff 에 새로 포함돼 있어, 그 테스트를 집중 점검.

## 발견사항

- **[WARNING]** 신규 타임아웃-신호 회귀 테스트가 `afterEach` 복구 관례를 깨고 테스트 본문 마지막 줄에서만 `mockRestore()` 를 호출 — 그 앞의 `expect` 가 실패하면 스파이가 복구되지 않은 채 이후 테스트로 새어나간다.
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.spec.ts:246-255` (`it('가드에 막히면 전송 타임아웃 신호를 만들지 않는다 — 신호는 가드 통과 뒤에 만든다', ...)`, 특히 247행 `const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');` 과 254행 `timeoutSpy.mockRestore();`)
  - 상세: 같은 파일의 기존 `fetchMock`(48행 `jest.spyOn(globalThis, 'fetch')`)은 51-53행 `afterEach(() => { fetchMock.mockRestore(); })` 로 테스트 성패와 무관하게 항상 복구된다. 반면 새로 추가된 `timeoutSpy` 는 그 관례를 따르지 않고 `it` 블록 마지막 줄에서 수동으로 `mockRestore()` 를 부른다. 252행 `expect(result).toMatchObject(...)` 또는 253행 `expect(timeoutSpy).not.toHaveBeenCalled()` 가 실패하면 예외가 던져져 254행에 도달하지 못하고, `AbortSignal.timeout` 은 스파이가 걸린 채로 남아 이 파일의 나머지 테스트에 전파된다(jest 설정에 `restoreMocks: true` 없음 — `codebase/backend/jest.config.ts` 확인, 전역 자동 복구 없음). 실제 피해는 `jest.spyOn` 이 기본적으로 원본을 그대로 호출-통과(call-through)하므로 기능적으로는 대체로 무해하지만, 실패 시 원인 파악을 더 어렵게 만들고(스파이 잔존이 다음 실패의 노이즈가 됨) 이 파일 스스로 세운 정리 관례와도 어긋난다.
  - 제안: `timeoutSpy` 도 `fetchMock` 과 같은 지역 변수로 끌어올려 `afterEach` 에서 `timeoutSpy?.mockRestore()` 하거나, 이 테스트 안에서 `try/finally` 로 감싸 `finally` 절에서 복구한다.

- **[INFO]** (1라운드에서 이미 지적·비차단으로 처분된 항목, 이번 diff 에서도 그대로 유지 — 재확인 목적으로만 기록) `http-request.handler.ts`·`database-query.handler.ts` 의 새 "판정 아닌 오류 → `INTEGRATION_CALL_FAILED`" 분기는 각각 `authentication: 'integration'` 한 케이스만 테스트한다. 기존 차단(판정) 경로는 `none`/`custom` 까지 `it.each` 로 커버하는 반면 새 비판정 분기는 비대칭이다. 코드가 같은 `if` 조건을 인증 방식과 무관하게 공유하므로 회귀 위험은 낮다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (363행 부근 `if (authentication === 'integration' && integrationId)`), 대응 테스트 `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts:960`(`it('가드가 판정 아닌 오류를 던지면 HTTP_BLOCKED 가 아니라 INTEGRATION_CALL_FAILED', ...)`)
  - 제안: 필수는 아님(RESOLUTION.md 에 이미 조치 없음으로 명시적 처분됨).

- **[INFO]** `outboundBlockReason` 이 리다이렉트 **홉 도중**(`followRedirectsSafely` 루프 내부)에서 판정 아닌 오류를 던지는 경로는 신설 `http-redirect.spec.ts` 에서 첫 호출 경로로만 간접 검증되고 홉 내부 재호출 경로는 직접 테스트되지 않는다. 구조상 같은 함수·같은 catch 이므로 위험은 낮다(1라운드 리뷰에서 이미 INFO 로 처분, 이번 라운드 diff 는 이 갭을 좁히지 않았다 — 신규 악화 아님, 유지 기록만).
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` 의 `followRedirectsSafely`, 대응 테스트 `codebase/backend/src/nodes/integration/http-request/http-redirect.spec.ts:47`(`it('판정 아닌 오류는 사유로 삼키지 않고 그대로 던진다', ...)`)

## 확인된 양호 사항 (참고)

- `IntegrationError` 생성자가 `(code, message)` 2-인자만 받고 `cause` 를 노출하지 않아(`integration-handler-base.ts:118-127`), `database-query.handler.ts` 주석의 "원본 객체를 `cause` 로 붙이지 않는다" 설계 근거는 **주석의 의도 표명이 아니라 타입 시그니처로 실제 강제**된다 — 뮤턴트로 반증 시도했으나(3-인자 호출 자체가 타입 에러) 근거가 유효함을 확인.
- 5개 spec 전부 `jest.requireActual` 로 `SsrfBlockedError` 실물 클래스를 보존한 뒤 가드 함수만 `jest.fn`(전체 대체 또는 `jest.fn(actual.fn)` 부분 래핑)으로 갈아끼우는 일관된 패턴 — mock 이 판정 클래스 자체를 가려 `instanceof` 분기가 항상 거짓이 되는 실패 모드를 원천 차단한다(주석에도 그 이유가 명시돼 있고 실측과 일치).
- `database-query.handler.spec.ts`·`http-request.handler.spec.ts` 는 `jest.fn(actual.X)` 부분 래핑 + `mockRejectedValueOnce`/`mockImplementationOnce` 조합으로, 주입한 한 테스트 이후 다음 테스트에 실물 가드 동작이 그대로 복원된다 — `beforeEach` 에 별도 리셋이 없어도 격리가 성립함을 코드로 직접 확인(1회성 오버라이드가 자기소거).
- `database-connection-tester.spec.ts`·`http-connection-tester.spec.ts`·`http-redirect.spec.ts` 는 `mockRejectedValue`(비-Once)를 쓰지만 세 파일 모두 `beforeEach` 에서 가드 기본값(`mockResolvedValue(undefined)`)을 매번 명시적으로 재설정해 테스트 간 오염이 없다.
- 신규 단언들이 "차단 아님" 만 보는 게 아니라 `code`·`message` 내용(부분 문자열 포함/미포함)·부수효과(`connectMock`/`fetchMock`/`MockedClient` 미호출, `logUsage` 호출 인자)까지 구체적으로 검증해 vacuous 위험이 낮다. 특히 `database-query.handler.spec.ts` 신규 테스트는 `INTEGRATION_CALL_FAILED` 승격이 바깥 catch 의 `mapDbError` fallback 을 우회해 코드가 보존되는 것까지 확인한다.
- `http-connection-tester.ts` 의 "동반 1건"(preflight 를 `try` 안으로 이동)에 대한 회귀 테스트(`http-connection-tester.spec.ts` "가드가 판정 아닌 오류를 던지면 ... 던지지 않는다")는 실제로 `await testHttpConnection(...)` 을 테스트가 직접 `try` 없이 호출하므로, preflight 가 여전히 `try` 밖에 있었다면 이 테스트 자체가 unhandled rejection 으로 실패했을 구조 — 판별력이 있다.
- plan(`ssrf-catch-instanceof.md`) 이 주장하는 "뮤턴트 넷(각 판정 분기 삭제) 전부 RED" 는 1라운드 세션에서 대표 분기 1건이 재현 검증됐고(정확히 해당 테스트만 RED), 이번 라운드에서 새로 추가된 W2 회귀 테스트(AbortSignal 순서) 역시 코드 구조상 되돌리면(신호 생성을 preflight 앞으로) 해당 테스트만 RED 가 되는 형태로 작성돼 있다.

## 요약

SSRF 가드의 "판정(`SsrfBlockedError`) vs 그 외 오류" 분기 도입에 대한 테스트는 4개 소비자 + `outboundBlockReason` 각각에서 판정/비판정 두 경로를 모두 주입해 검증하고, mock 이 실물 클래스를 보존하는 설계와 `code`/`message`/부수효과까지 보는 단언 구체성이 전반적으로 양호하다. 이번 2라운드에서 새로 추가된 것은 1라운드 W2(타임아웃 예산 잠식) 수정에 대한 회귀 테스트 1건인데, 그 테스트가 파일 자체의 기존 관례(`afterEach` 로 스파이 복구)를 따르지 않고 테스트 본문 마지막 줄에서만 수동 `mockRestore()` 를 호출해 — 그 앞 단언이 실패하면 스파이가 새어나가는 테스트 격리 갭이 하나 남아 있다(WARNING, 기능적 영향은 낮으나 디버깅 노이즈 유발). 그 외 두 건은 1라운드에서 이미 INFO·비차단으로 처분된 항목이 이번 diff 에서도 그대로 유지되는 것을 재확인한 것뿐이며 새로 악화되지 않았다. 블로킹 사유 없음.

## 위험도

LOW

# 부작용(Side Effect) 리뷰 — SSRF 가드 소비자 넷의 catch (`instanceof SsrfBlockedError`)

## 발견사항

- **[WARNING]** `outboundBlockReason` 의 throw 계약 변경이 열어 둔 새 코드 경로 — 리다이렉트 **홉**에서의 «가드 고장» 이 HTTP 노드에서 마스킹 없이 나간다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — 함수 `HttpRequestHandler.execute` 의 `catch (err: unknown)` 블록(약 533번째 줄대, `err instanceof IntegrationError` 분기 다음의 `HTTP_TRANSPORT_FAILED` fallback). 관련: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` 의 `outboundBlockReason`(30번째 줄대) · `followRedirectsSafely`(74번째 줄대, `const reason = await outboundBlockReason(next);`).
  - 상세: 이번 변경으로 `outboundBlockReason` 은 «판정 아닌 오류» 를 삼키지 않고 그대로 던지도록 바뀌었다(`http-redirect.ts`). `http-request.handler.ts` 의 **첫 preflight** 호출부는 이 경우를 `instanceof SsrfBlockedError` 로 갈라 `sanitizeMessage`(`toLogError(err).message`)로 마스킹한 뒤 `INTEGRATION_CALL_FAILED` 로 내보내도록 새로 고쳐졌다. 그런데 같은 `outboundBlockReason` 은 리다이렉트 **홉**마다도 불린다(`followRedirectsSafely` 내부, `http-request.handler.ts` 455번째 줄대에서 호출). 이 변경 전에는 `outboundBlockReason` 이 홉 검사에서 **절대 던지지 않았으므로**(모든 오류를 "차단 사유" 문자열로 삼켰다) 이 경로로는 도달할 수 없었다. 변경 후에는 홉 검사 중 판정 아닌 오류가 던져지면 `followRedirectsSafely` → 바깥의 일반 `try`(fetch 루프, 452번째 줄대)를 거쳐 533번째 줄대의 catch-all 로 떨어지는데, 거기서는 `instanceof IntegrationError` 가 아니므로(raw `TypeError` 등) `HTTP_TRANSPORT_FAILED` 분기(558번째 줄대)로 가고, **가공되지 않은 `err.message` 를 그대로** `logUsage`(Activity API로 workspace 사용자에게 노출)와 `output.error.message`(클라이언트 출력)에 싣는다 — preflight 분기가 새로 도입한 `sanitizeMessage`/`toLogError` 마스킹을 거치지 않는다. 즉 같은 «가드 고장» 이라는 사건이 검사 시점(첫 preflight vs 리다이렉트 홉)에 따라 마스킹 여부가 갈리는 비일관을 이번 diff 가 새로 만들었다. RESOLUTION.md(`review/code/2026/09/20/09_35_16/RESOLUTION.md`)의 INFO 4 는 "같은 함수를 같은 방식으로 부르고 그 함수의 throw 계약은 `http-redirect.spec.ts` 가 본다" 고만 적어, 이 **다운스트림 마스킹 격차**는 다루지 않았다.
    실측 기준 오늘 이 경로가 실제로 트리거되려면 `outboundBlockReason` 이 리다이렉트 대상 URL에 대해 `SsrfBlockedError` 가 아닌 오류를 던져야 하는데, 홉의 URL 은 항상 `new URL(location, url).toString()` 로 만들어진 유효한 문자열이라 plan 이 이미 지적한 "hostname 이 문자열이 아닌 경우"의 `TypeError` 트리거가 이 경로엔 없다 — 그래서 오늘은 사실상 도달 불가능이다(plan 이 다른 3곳에 대해 쓴 것과 같은 논리).
  - 제안: 도달 불가능이 실측으로 확정되면 트래커에 "리다이렉트 홉의 판정 아닌 오류도 언젠가 트리거되면 미마스킹 message 가 나간다"를 한 줄 등재하거나, `followRedirectsSafely`/그 호출부에서 홉 오류도 `instanceof SsrfBlockedError` 로 가르는 대칭 처리를 추가해 raw message 가 새지 않게 한다.

- **[INFO]** `http-connection-tester.ts` 의 동일 catch-all(`describeFailure` → `clampMessage`, `sanitizeMessage` 미적용)도 리다이렉트 홉의 판정 아닌 오류에 대해 같은 성격의 미마스킹 경로다 — 다만 이 파일은 RESOLUTION.md W1 에서 "이 PR 이 만든 경로가 아니라 전송 실패 전부가 쓰는 기존 경로라 손대지 않았다"로 이미 명시적으로 검토·유예된 결정이라 재지적하지 않는다. 위 WARNING 과 같은 근본 원인(신규로 열린 throw 경로 vs 기존 catch-all 의 마스킹 정책 불일치)이라는 점만 교차 참조로 남긴다.

- **[INFO]** `codebase/backend/src/modules/integrations/database-connection-tester.spec.ts` 의 `jest.mock('../../nodes/integration/http-request/http-safety', () => ({ ...jest.requireActual(...), assertSafeOutboundHostResolved: jest.fn() }))` 로의 변경은 실질적으로 버그 수정이다 — 이전 형태(`{ assertSafeOutboundHostResolved: jest.fn() }`, spread 없음)는 이 mock 이 적용되는 모듈 그래프 안에서 `SsrfBlockedError` 를 포함한 나머지 export 를 전부 `undefined` 로 가렸을 것이고, 프로덕션 코드(`database-connection-tester.ts`)가 바로 그 경로로 `SsrfBlockedError` 를 import 해 `instanceof` 검사를 하므로 스프레드 없이는 `err instanceof undefined` 로 런타임 TypeError 가 났을 것이다. 이번 diff 안에서 함께 고쳐져 있어 잔존 결함은 아니지만, "가드 함수만 mock 하고 클래스는 실물을 남긴다"는 패턴이 나머지 세 소비자(`http-connection-tester.spec.ts`·`http-request.handler.spec.ts`·`database-query.handler.spec.ts`)에도 일관되게 적용돼 있음을 확인했다(모두 `jest.requireActual` 스프레드 사용) — 새로 추가된 네 스펙 파일 모두 이 함정을 피해 갔다.

## 확인했으나 이상 없음(부작용 관점)

- `database-query.handler.ts` · `database-connection-tester.ts` · `http-request.handler.ts` 의 신규 `if (!(err instanceof SsrfBlockedError))` 분기는 모두 **이미 있던 단일 `logUsage`/응답 반환 지점**으로 흡수되어 있어 이중 로깅·이중 응답 부작용은 없다.
- `http-connection-tester.ts` 에서 preflight 호출을 `try` 안으로 옮기고 `AbortSignal.timeout` 생성을 그 뒤로 미룬 것은 순서가 서로 종속적이지 않게(신호가 여전히 fetch 직전에만 생성) 정리돼 있어, 타이머 누수나 이중 타임아웃 같은 부작용은 없다.
- `INTEGRATION_CALL_FAILED` · `DB_CONNECT_FAILED` · `HTTP_CONNECT_FAILED` 는 전부 기존에 이미 정의돼 있던 코드 값이며, 이번 변경이 새 enum 멤버·새 공개 인터페이스를 도입하지 않는다 — 프런트엔드·다른 소비자에 시그니처/계약 변경 영향 없음.
- `database-query.handler.spec.ts`/`http-request.handler.spec.ts` 가 신규로 추가한 `jest.mock(..., () => ({ ...actual, fn: jest.fn(actual.fn) }))` 패턴은 실제 가드 함수를 그대로 감싸는 형태라, 해당 파일의 다른 기존 테스트가 이미 실제 DNS 조회(`db.example.com` 기본 fixture)에 의존해 왔던 것과 동일한 동작을 유지한다 — 이번 diff 가 새로 네트워크 호출을 만들어 넣은 것이 아니라 기존에 있던(그리고 developer 가 의도적으로 "실물 그대로 쓴다"고 밝힌) 상태를 그대로 감쌌을 뿐이다.
- 전역 변수·환경 변수 읽기/쓰기는 변경 없음(`ALLOW_PRIVATE_HOST_TARGETS` 등 기존 참조 그대로).
- `plan/`·`review/` 하위 markdown 파일들은 문서 산출물이며 런타임 부작용과 무관.

## 뮤테이션/재현 관련

이번 리뷰는 저장소를 뮤테이션하지 않고 `Read`/`Bash`(읽기 전용 `sed -n`, `grep`)만으로 진행했다. `git status --short` 로 저장소 트리에 쓰기가 없었음을 확인.

```
$ git status --short
?? review/code/2026/09/20/10_09_56/
```
(위 항목은 이 리뷰 세션 자체의 출력 디렉터리이며, 다른 어떤 소스 파일도 건드리지 않았다.)

## 요약

핵심 변경(가드 catch 를 `instanceof SsrfBlockedError` 로 가르는 것) 자체는 side-effect 관점에서 안전하게 배선돼 있다 — 로깅·usage 기록·응답 반환이 모두 단일 지점으로 모이고, 코드 값도 기존 값을 재사용해 인터페이스 파급이 없다. 다만 `outboundBlockReason` 의 throw 계약을 바꾼 부작용으로, 리다이렉트 **홉** 단계에서 판정 아닌 오류가 발생하면 `http-request.handler.ts` 의 일반 `HTTP_TRANSPORT_FAILED` catch-all 로 떨어져 이번 PR 이 다른 세 곳에 새로 도입한 메시지 마스킹(`sanitizeMessage`/`toLogError`)을 거치지 않는다는 비일관이 새로 생겼다 — 오늘은 실질적으로 트리거 불가능하지만(홉 URL 이 항상 유효한 문자열 hostname 을 만들어서), PR 이 스스로 세운 "판정 아닌 오류는 마스킹해서 낸다"는 원칙과 어긋나는 조용한 예외다. 그 외에는 이중 로깅·타이머 누수·전역 상태·공개 인터페이스 변경 등 전형적인 부작용 패턴은 발견되지 않았다.

## 위험도

LOW

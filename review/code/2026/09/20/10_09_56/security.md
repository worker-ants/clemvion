# 보안(Security) 리뷰 — SSRF 가드 소비자 넷의 catch 를 `instanceof SsrfBlockedError` 로

## 발견사항

- **[WARNING]** SSRF 판정("차단")과 가드 고장("판정 아님")을 가르는 이번 변경 자체는 견고하지만(모든 분기가 여전히
  block/fail 하고 실제 네트워크 호출로 새지 않음 — SSRF 우회는 없음), "판정 아닌 오류"를 클라이언트/Activity 로그로
  승격할 때 쓰는 `sanitizeMessage`/`toLogError` 는 **자격증명 형태 문자열만 마스킹**하고 host/IP 는 마스킹하지 않는다.
  같은 파일들이 "판정"(`SsrfBlockedError`) 분기에서는 원문 대신 완전히 일반화된 문구(`SSRF_BLOCKED_CLIENT_MESSAGE`/
  `DB_HOST_BLOCKED_MESSAGE`)로 치환해 "정찰 면 축소(CWE-209)"를 명시적으로 지키는데, "고장" 분기는 그 원칙을
  적용하지 않는다.
  - 위치:
    - `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — `!(err instanceof SsrfBlockedError)` 분기, `new IntegrationError('INTEGRATION_CALL_FAILED', toLogError(err).message)` (게이트 362~381 부근, "판정은 `SsrfBlockedError` 하나뿐이다" 주석 시작)
    - `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` — `if (!(err instanceof SsrfBlockedError))` 분기, `sanitizeMessage(err instanceof Error ? err.message : String(err))` (게이트 270~280)
    - `codebase/backend/src/modules/integrations/database-connection-tester.ts` — `message: clampMessage(sanitizeMessage(detail))` (게이트 145~154)
  - 상세: `sanitizeMessage` (codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:156-171) 의 `SECRET_PATTERNS` 는 `password=`/`Bearer …`/32자+ base64·hex 블롭만 치환하고 hostname·IP 문자열은 건드리지 않는다. 지금은 `http-safety.ts` 가 던지는 비-`SsrfBlockedError` 가 사실상 `isBlockedHostname` 의 `hostname.toLowerCase is not a function` (TypeError) 하나뿐이라 이 메시지엔 host/IP 가 안 들어가 실질 유출은 없다(개발자 본인의 실측·plan 서술과 일치). 다만 세 파일의 주석이 스스로 "가드가 앞으로 어떤 오류를 던질지 모른다"고 명시하면서도, 그 미지의 미래 오류에 대한 방어는 "cause 를 붙이지 않는다"에 그치고 **message 자체는 secret-pattern 마스킹만 거쳐 그대로 client output.error / Activity API(`GET /integrations/:id/activity`) 로 나간다.** 가드에 (fail-open 정책 변경·라이브러리 교체 등으로) host/IP 를 담은 plain `Error` 를 던지는 회귀가 생기면, 바로 이 세 경로가 그 host/IP 를 사용자에게 그대로 노출한다 — "판정" 분기가 막으려던 정확히 그 유출을, "고장" 분기는 막지 않는다.
  - 제안: 세 곳 모두 client-facing message 를 원문 대신 (a) 고정 일반화 문구를 쓰거나 (b) 최소한 `sanitizeMessage` 에 host/IP-형 패턴(도트 구분 4옥텟, IPv6 콜론 표기, `hostname "..."`류 접두어)을 추가해 대칭을 맞춘다. 지금은 낮은 위험(현재 코드로는 도달 불가)이므로 즉시 차단 사유는 아니지만, 이 PR 이 명시적으로 남긴 "미지의 미래 오류" 라는 전제와 정면으로 부딪히므로 plan 후속 항목으로 등재하거나 최소 한 줄 정정을 권한다.

- **[INFO]** 리다이렉트 홉에서의 "판정 아닌" 가드 실패는 이번 변경으로 새로 열린 경로인데, 그 실패가 흘러가는
  두 착지점은 이번 라운드의 마스킹 정비(WARNING 위 항목이 다루는 세 곳) 밖에 있다.
  - 위치:
    - `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` — `followRedirectsSafely` (게이트 74: `const reason = await outboundBlockReason(next);`) 는 `outboundBlockReason` 이 던지는 것을 잡지 않고 그대로 전파한다.
    - `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — 그 전파가 도달하는 `catch (err: unknown)` (게이트 533 부근) 의 `HTTP_TRANSPORT_FAILED` 분기: `const message = err instanceof Error ? err.message : String(err);` 를 `sanitizeMessage` 조차 거치지 않고 `output.error.message` 와 usage 로그(`error: { code: 'HTTP_TRANSPORT_FAILED', message }`) 에 그대로 싣는다.
    - `codebase/backend/src/modules/integrations/http-connection-tester.ts` — 같은 전파가 도달하는 `catch (err)` (게이트 139~153) 의 `describeFailure`/`clampMessage` 는 **길이만 자르고 내용은 전혀 마스킹하지 않는다**.
  - 상세: `RESOLUTION.md` (W1 항목)는 "HTTP 연결 테스트(`describeFailure`→`clampMessage`)는 손대지 않았다 — 그 경로는 이 PR 이 만든 것이 아니라 전송 실패 전부가 쓰는 기존 경로"라고 명시적으로 defer 했다. 그 판단 자체(기존 전송 실패 전부가 이미 이 경로를 씀)는 맞지만, "가드의 리다이렉트-홉 고장"이 그 경로로 흘러들게 된 것 자체는 **이번 PR 이 새로 만든 트리거**다 — `outboundBlockReason` 이 전에는 모든 오류를 삼켜 문자열로 돌려줬지만(그래서 리다이렉트 홉 고장이 이 경로에 닿을 일이 없었다) 이번 diff 로 rethrow 하게 됐다. 현재는 도달 불가능한 트리거(위 WARNING 과 같은 이유)라 실질 위험은 낮다.
  - 제안: 조치 불요(현재 도달 불가) — 다만 위 WARNING 항목을 고칠 때 이 두 착지점도 같은 회귀에 노출된다는 점을 함께 적어 두면 다음 사람이 "세 곳만 고치면 끝"이라고 오판하지 않는다.

- **[INFO]** SSRF 방어 로직(`http-safety.ts` 의 대역·fail-open 정책)과 인젝션·인증·암호화·시크릿 관리는 이번 diff 로
  변경되지 않았다. 새 테스트(`http-redirect.spec.ts` 신설 포함)는 `jest.requireActual` 로 `SsrfBlockedError` 실물을
  남기고 가드 함수만 mock 해 판정 분기가 실제로 그 클래스로 갈리는지 검증하며, 뮤턴트(각 `instanceof` 분기 제거)로
  판별력을 확인했다는 plan 서술(`plan/in-progress/ssrf-catch-instanceof.md` 체크리스트)과 실제 코드 구조가 일치한다.
  하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화는 발견되지 않았다.

## 요약

핵심 변경 — SSRF 가드의 "차단 판정"(`SsrfBlockedError`)과 "가드 자체의 고장"(그 밖의 오류)을 네 소비자(HTTP 노드,
HTTP 연결 테스트, DB 노드, DB 연결 테스트)가 갈라 처리하도록 한 것 — 은 모든 분기에서 여전히 요청/쿼리를 막고
네트워크 호출로 새지 않아 **SSRF 우회를 만들지 않는다**. 다만 "가드 고장" 분기가 원문 메시지를 client/Activity 로그로
승격할 때 쓰는 마스킹(`sanitizeMessage`)이 자격증명 패턴만 가리고 host/IP 는 가리지 않아, "판정" 분기가 명시적으로
지키는 정찰 면 축소(CWE-209) 원칙과 비대칭이다. 현재 가드 구현으로는 이 경로에 host/IP 가 실릴 수 없어 즉시 악용
가능성은 낮지만, 이 PR 자신의 주석이 "가드가 앞으로 어떤 오류를 던질지 모른다"고 인정한 만큼 잠재적 회귀 지점으로
남는다.

## 위험도

LOW

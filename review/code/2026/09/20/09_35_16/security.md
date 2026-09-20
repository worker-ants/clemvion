# 보안(Security) 코드 리뷰

## 검토 범위

SSRF 가드(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`, `http-safety.ts`)의 4개 소비자
(`http-request.handler.ts`, `http-redirect.ts`(`outboundBlockReason`), `database-query.handler.ts`,
`database-connection-tester.ts`, 동반 `http-connection-tester.ts`)의 `catch` 를
`instanceof SsrfBlockedError` 로 판정(=SSRF 차단)과 판정 아닌 오류(=가드 자신의 고장)로 가르는
변경. 가드 자체(`http-safety.ts`)의 판정 로직·대역·fail-open 정책은 이번 diff 의 대상이 아니다(불변).

## 발견사항

- **[WARNING]** 판정 아닌 가드 오류의 원문 메시지가 4곳 중 3곳에서 시크릿 마스킹(`sanitizeMessage`) 을
  거치지 않고 그대로 클라이언트/결과 메시지로 나간다
  - 위치:
    - `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:362`~`382`
      (신규 분기, `buildPreflightErrorOutput(err, …)` 호출) 및 그 sink 함수
      `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:611`~`637`
      (`const message = err instanceof Error ? err.message : String(err);` — `sanitizeMessage` 미적용)
    - `codebase/backend/src/modules/integrations/database-connection-tester.ts:146`~`153`
      (신규 분기, `message: clampMessage(detail)` — `clampMessage` 는 길이만 자르고 시크릿 패턴은
      마스킹하지 않음)
    - `codebase/backend/src/modules/integrations/http-connection-tester.ts:124`~`129`
      (신규 코드는 `try` 재배치뿐이지만, 그 결과 이 경로로 떨어지는 기존 catch —
      `describeFailure(err)` → `clampMessage(...)` — 도 동일하게 미마스킹)
  - 상세: 같은 코드베이스는 이미 "임의로 catch 한 오류의 message 를 사용자/Activity 로그로 내보낼 때는
    `sanitizeMessage`(password/token/secret/api_key=…, Bearer/Basic 헤더, 32자+ base64/hex 블롭을
    `***` 로 치환)를 거쳐야 한다"는 관례를 갖고 있다(`toLogError`, `mapDbError` — 후자는 같은 파일
    `database-query.handler.ts` 안에 있다). 이번 diff 가 통일하는 4개 호출부 중
    `database-query.handler.ts` 만 예외적으로 안전하다 — 신규 분기에서 만든
    `IntegrationError('INTEGRATION_CALL_FAILED', err.message)` 가 바깥 `catch` 의 기존 로직
    (`err instanceof IntegrationError` → `message: sanitizeMessage(err.message)`, line 347)을
    통과하기 때문에 우연히 안전하다. 나머지 3곳은 그런 downstream 재검사가 없어 `err.message` 가
    그대로 나간다. 오늘은 가드(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`)가 호스트
    문자열만 받는 순수 함수라 실제로 시크릿을 담은 예외를 던질 경로가 보이지 않아 즉시 악용 가능성은
    낮다. 다만 이 diff 자체가 "가드가 판정 아닌 오류를 던지면 그 message 를 사용자에게 노출한다"를
    **네 곳 동시에 공식 계약(테스트로 고정)으로 승격**시키는 지점이다 — 가드 내부 구현이 앞으로
    바뀌어(예: 더 하위 라이브러리 오류를 감싸며 그 message 안에 요청 관련 세부정보를 포함) 판정 아닌
    예외를 던지게 되면, `sanitizeMessage` 가 없는 3곳은 그 내용을 검증 없이 그대로 클라이언트/연결
    테스트 결과로 흘려보낸다. 흥미롭게도 같은 diff 의 `database-query.handler.ts` 신규 분기 주석은
    "원본 객체를 `cause` 로 붙이지 않는다 — 가드가 앞으로 어떤 오류를 던질지 모르고 …" 라며 정확히 이
    미래 위험을 이유로 `cause` 부착을 스스로 차단해 놓고도, `message` 문자열 자체는 그대로 실어
    보낸다 — 같은 우려가 나머지 3곳에는 전혀 반영되지 않았다.
  - 제안: 4개 호출부 모두에서 판정 아닌 가드 오류의 message 를 클라이언트/결과에 싣기 전에
    `sanitizeMessage`(또는 `toLogError(err).message`)를 거치도록 통일한다. 특히
    `http-request.handler.ts` 의 `buildPreflightErrorOutput` 과
    `database-connection-tester.ts`/`http-connection-tester.ts` 의 `clampMessage` 경로에 적용.

## 검증 — SSRF fail-closed 유지 확인 (결함 아님, 긍정적 확인)

네 호출부 전부 가드가 판정 아닌 오류를 던져도 실제 네트워크 호출/DB 연결 시도 이전에 즉시
반환/재throw 하며, 우회(가드 실패 시 그냥 통과)는 발생하지 않는다 — 각 파일의 신규 테스트가
`connectMock`/`fetchMock` 이 호출되지 않았음을 단언하고, 코드 흐름상으로도 모든 분기가 preflight
단계에서 리턴/throw 한 뒤에야 실제 연결 로직에 도달하도록 되어 있음을 직접 확인했다. `http-connection-tester.ts` 는 오히려 기존 결함(preflight 호출이 `try` 밖에 있어 판정 아닌 오류가
`testHttpConnection` 의 "던지지 않는다" 계약을 깨고 그대로 전파되던 것)을 이번 diff 로 고쳤다 — 이는
디폴트 예외 핸들러를 통해 스택 트레이스가 노출될 잠재 경로를 줄이는 방향의 개선이다.

`SsrfBlockedError` 판정 시 클라이언트에는 항상 `SSRF_BLOCKED_CLIENT_MESSAGE`/`DB_HOST_BLOCKED_MESSAGE`
같은 일반화 문구만 나가고 차단된 host/IP 원문은 `logger.warn` 서버 로그에만 남는 기존 정찰 면 축소
(CWE-209) 설계는 이번 diff 로 그대로 보존된다.

## 관측된 이상 상태 (이번 리뷰의 결함 아님 — 병렬 작업 흔적)

작업 디렉터리에 커밋되지 않은 변경 하나가 남아 있다: `git status --short` 기준
`codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` 가 수정됨으로 표시되고,
`git diff` 확인 결과 362번째 줄이 `if (!(err instanceof SsrfBlockedError)) {` 가 아니라 `if (false) {`
로 되어 있다. 이는 이 리뷰가 분석한 diff/파일 컨텍스트(프롬프트에 실린 내용)와 다르며, 동시에 같은
워크트리를 사용하는 다른 리뷰어의 뮤테이션 테스트 잔여물로 보인다. 본 리뷰는 이 파일을 직접 고치거나
`git checkout`/`restore` 하지 않았다 — 원복 여부는 확인하지 않았으니 다음 단계에서 실제 커밋 상태와
대조해 확인 바란다.

## 요약

이번 diff 는 SSRF 가드 소비자 4곳(+동반 1곳)의 "가드의 판정"과 "가드 자신의 고장"을 구분하도록
고치는 순수 리팩토링으로, 모든 경로에서 SSRF 차단의 fail-closed 특성을 그대로 보존하며 오히려
`http-connection-tester.ts` 의 no-throw 계약 위반 버그 하나를 부수적으로 고친다. 새 인젝션·인증
우회·하드코딩 시크릿·암호화 약화는 발견되지 않았다. 유일한 실질적 우려는 판정 아닌 가드 오류의
원문 메시지가 4곳 중 3곳에서 기존 `sanitizeMessage` 마스킹 관례를 거치지 않고 그대로 노출된다는
점(WARNING) — 오늘의 가드 구현으로는 즉시 악용 경로가 보이지 않지만, 이 diff 가 그 노출을 네 곳
동시에 테스트로 고정하는 지점이라 일관되게 마스킹을 적용해 두는 편이 안전하다.

## 위험도

LOW

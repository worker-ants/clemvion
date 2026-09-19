# 보안(Security) 리뷰 — SSRF 가드 통합 2라운드 (SMTP · HTTP · DB, `SsrfBlockedError` 도입 후)

## 개요

1라운드 리뷰(Critical 0 · Warning 7)의 조치 커밋(`a1e1a591b`)까지 포함한 전체 diff를 다시 처음부터 검토했다.
핵심 변경은 여전히: (1) `http-safety.ts`가 IPv4-mapped IPv6(`::ffff:a.b.c.d`, 정규화 hex형·점형·전체형·대문자)를
품은 IPv4 대역으로 판정하도록 보강, (2) SMTP 가드(`smtp-host-guard.ts`)를 `common/utils/ssrf.util` 대신
`http-safety.ts`(`assertSafeOutboundHostResolved`)로 교체해 CGNAT(`100.64.0.0/10`)·`::`를 막음, (3) 판정 실패를
문자열 접두어(`'SSRF_BLOCKED'`) 매칭 대신 신설 `SsrfBlockedError` 클래스의 `instanceof`로 가르도록 변경.

`Read`로 `http-safety.ts`(전체), `smtp-host-guard.ts`(신/구 양쪽), `integrations.service.ts`
`testEmailTransport` 주변, `send-email.handler.ts`, `http-request.handler.ts`, `http-redirect.ts`,
`database-connection-tester.ts`, `database-query.handler.ts`, 각 `.spec.ts`, e2e
`integration-connection-test.e2e-spec.ts`를 직접 확인했다. 가설 검증을 위해 저장소 **밖**
(`node -e '...'`, 파일 쓰기 없음)에서 `new URL()`/`dns.lookup`/`net.isIP`의 IPv4-mapped 리터럴 정규화 동작을
별도로 프로브했다(아래 INFO 참고) — 저장소 트리에는 아무것도 쓰지 않았다. 리뷰 종료 시점 `git status --short`
확인 결과 세션 시작 시 존재하던 `review/code/2026/09/19/22_00_32/` 산출물 외 변경 없음.

## 발견사항

- **[INFO]** 판정기-소비자 계약을 문자열 접두어에서 전용 에러 클래스로 교체 — 1라운드 WARNING(아키텍처/유지보수성)의
  올바른 해소, 신규 결함 없음
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` (`SsrfBlockedError` 클래스, 47~52행) ·
    `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` (`err instanceof SsrfBlockedError`, 28행)
  - 상세: `SsrfBlockedError`는 여전히 `message`에 `SSRF_BLOCKED: <detail>`(차단 host/IP 포함, 서버 로그 전용)을
    담지만, `isSmtpHostBlocked`의 boolean 판정은 이제 메시지 문자열이 아니라 클래스로 가른다. `http-request.handler.ts`·
    `http-redirect.ts`·`database-connection-tester.ts`의 catch 블록은 여전히 `catch (err)` 전체를 SSRF 차단으로
    취급하는 catch-all 패턴이지만, 그 try 블록 안에서 호출하는 함수(`assertSafeOutboundUrl`/
    `assertSafeOutboundHostResolved`)가 던지는 예외는 `SsrfBlockedError` 하나뿐이라(DNS 실패는 내부에서
    fail-open으로 흡수) 동작상 회귀는 없다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** 클라이언트/usage-log 노출 경로는 전부 일반화 문구(`SSRF_BLOCKED_CLIENT_MESSAGE` ·
  `EMAIL_HOST_BLOCKED`/`DB_HOST_BLOCKED` 고정 문자열)만 쓰고, 차단된 host/IP가 포함된 상세 메시지
  (`SsrfBlockedError.message`)는 `logger.warn`(서버 로그)에만 간다 — CWE-209 방지가 3개 소비자(HTTP 본요청·
  리다이렉트, DB, SMTP) 전부에서 일관됨
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (369~370, 428~431행) ·
    `codebase/backend/src/modules/integrations/database-connection-tester.ts` (`DB_HOST_BLOCKED_MESSAGE`) ·
    `codebase/backend/src/modules/integrations/integrations.service.ts` (`testEmailTransport`, 1598~1602행) ·
    `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts` (`EMAIL_HOST_BLOCKED`, 180~183행)
  - 상세: 이 소비자들은 diff 대상 파일(`http-safety.ts`/`smtp-host-guard.ts`)이 아니라 컨텍스트로 확인한
    기존 코드지만, 새 `SsrfBlockedError`를 그대로 받아 같은 일반화 규약을 유지하는지 재확인할 필요가 있어
    점검했다 — 회귀 없음. e2e `integration-connection-test.e2e-spec.ts`의 신규 B2 케이스도
    `expect(data.message).not.toMatch(/ffff|100\.64|127\.0\.0\.1/)`로 3개 서비스 타입 전부를 회귀 테스트한다.
  - 제안: 없음.

- **[INFO]** `testEmailTransport`의 가드 호출이 여전히 `try` 진입 전(비-try-catch 컨텍스트)에 있음 — 1라운드
  RESOLUTION(`INFO 10`)에서 "새 경로 없음"으로 조치 없이 종결된 항목의 재확인, 상태 불변
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `testEmailTransport` 내
    `if (await isSmtpHostBlocked(credentials.host as string))` (1596행)
  - 상세: `isSmtpHostBlocked`는 `SsrfBlockedError`만 boolean으로 흡수하고 그 외 오류는 `throw err`로 재던진다
    (`smtp-host-guard.ts` 28~29행). 현재 `assertSafeOutboundHostResolved`가 던질 수 있는 예외는
    `SsrfBlockedError` 하나뿐이라(DNS 조회 실패는 내부에서 fail-open) 실제로 도달 가능한 경로는 아니다.
    다만 향후 `assertSafeOutboundHostResolved` 구현이 다른 예외를 던지도록 바뀌면, `send-email.handler.ts`
    (넓은 `try` 안)와 달리 `testEmailTransport`는 이를 흡수하지 못해 `{success,false,code,message}` 응답 봉투
    대신 처리되지 않은 예외(500)로 전파될 수 있다. 정보 노출 여부는 NestJS 전역 예외 필터의 프로덕션 설정에
    달려 있으며 이 diff 범위 밖이다.
  - 제안: 1라운드와 동일하게 별도 조치 불요 — 재발 방지를 위해 후속에서 손댈 때만 넓은 try로 옮기는 정도.

- **[INFO]** IPv4-mapped 리터럴의 비정형 표기(0-padding 등)에 대한 두 계층 방어 상호작용을 별도 프로브로 확인 —
  우회 없음
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` `canonicalIPv6`(94~100행) ·
    `mappedIPv4`(108~114행) · `assertSafeOutboundHostResolved`(203~209행의 재검사 루프)
  - 상세: `::ffff:127.000.000.001`처럼 WHATWG `URL` 파서가 거부하는 0-padded 리터럴을 SMTP/DB 경로처럼
    `new URL()`을 거치지 않고 `assertSafeOutboundHostResolved`에 직접 넘기면, 1차 리터럴 체크
    (`canonicalIPv6`가 파싱 실패 → 원문 그대로 반환 → `mappedIPv4` 정규식 불일치)는 통과한다. 그러나 그 뒤
    `lookup(hostname, { all: true })`(Node의 `dns.lookup`, OS `getaddrinfo` 경유)가 이를 정규화된
    `::ffff:127.0.0.1`로 돌려주고, 이어지는 `for (const { address } of addresses) if (isBlockedHostname(address))`
    재검사가 그 정규화된 주소를 다시 `canonicalIPv6`/`mappedIPv4`에 태워 정상적으로 차단한다(실측:
    `node -e`로 `dns.lookup('::ffff:127.000.000.001', {all:true})` → `[{address:'::ffff:127.0.0.1', family:6}]`
    확인, 저장소 파일은 건드리지 않음). HTTP 경로는 애초에 `new URL(url)`이 이런 리터럴 자체를 파싱 실패로
    거부해 더 이르게 막는다. 즉 "DNS 해석 뒤 재검사" 설계가 실제로 이런 비정형 리터럴에도 방어망 역할을 한다 —
    새로운 우회는 발견하지 못했다.
  - 제안: 없음 — 검증 기록.

- **[INFO]** 사전 실측·의도적 비대상(`ssrf.util` 기반 LLM/S3 경로) — 1라운드와 동일, 재확인만
  - 위치: `codebase/backend/src/common/config/s3.config.ts`, `src/modules/llm/llm-preview.service.ts`,
    `src/modules/model-config/model-config.service.ts` (모두 `ssrf.util` 사용, 이번 diff 미포함)
  - 상세: `plan/in-progress/ssrf-guard-integration-unify.md` §비대상에 명시된 제품 판단(Tailscale 등 CGNAT
    정상 사용 사례 보호, opt-out 플래그 부재)에 따른 의도적 제외. LLM 프로바이더 URL/S3 엔드포인트에 CGNAT·
    `::`를 가리키는 값을 넣으면 여전히 통과한다는 잔여 위험은 이번 PR 이전부터 있었고 신규 결함이 아니다.
  - 제안: 범위 밖 — plan 체크리스트의 트래커 등재 항목이 실제로 완료되는지만 후속 확인.

인젝션(SQL/XSS/커맨드/경로탐색)·하드코딩 시크릿·인증/인가 우회·안전하지 않은 해시/암호화·평문 전송·의존성 취약점
관점에서는 이번 diff에 해당 사항이 없다. e2e 테스트의 `'e2e-password'`/`'e2e-token'`은 테스트 전용 리터럴로
실제 시크릿이 아니다.

## 요약

이번 diff는 실측(다른 OS 두 곳에서 소켓 레벨 도달 여부 확인)에 기반해 HTTP/DB의 IPv4-mapped IPv6 우회와 SMTP의
CGNAT/`::` 우회라는 두 개의 실재했던 SSRF 구멍을 닫는 순net 보안 개선이다. 1라운드에서 지적된 "메시지 문자열
접두어로 판정을 가른다"는 아키텍처 WARNING은 `SsrfBlockedError` 전용 클래스 도입으로 정확히 해소됐고, 그 변경이
기존 catch-all 소비자(HTTP 리다이렉트·DB 커넥션 테스터)의 동작을 깨지 않음을 확인했다. 클라이언트/usage-log
노출 경로는 3개 서비스 타입(HTTP/DB/Email) 모두 일관되게 일반화 문구만 전달해 CWE-209(정보 노출을 통한 정찰)를
방지하며, 이를 e2e로 회귀 테스트한다. 별도 프로브로 확인한 비정형 IPv4-mapped 리터럴(0-padding 등)도 "리터럴
체크 + DNS 해석 후 재검사"의 2단 방어 설계 덕에 우회되지 않았다. 남아 있는 잔여 항목(`testEmailTransport` 가드
호출이 try 밖에 있는 점, DNS rebinding TOCTOU, `ssrf.util` 기반 LLM/S3 경로의 CGNAT 미차단)은 전부 1라운드에서
이미 식별·평가되어 조치 불요로 종결되었거나 트래커에 등재된 기존 한계이며, 이번 리뷰에서 새로 발견된 Critical/
Warning급 보안 결함은 없다.

## 위험도

NONE

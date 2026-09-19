# 보안(Security) 코드 리뷰 — 통합 노드 SSRF 가드 하나로 (3라운드/수렴 확인)

## 검토 방법

`git diff origin/main` 기준 전체 변경분(커밋 `103906807`·`a1e1a591b`·`77cf6aa7a`·`fce34b77b`·`bb4c5381b`)을 프롬프트 스니펫과
대조하고, 잘려 나온 파일(`http-safety.ts`)은 `Read`/`git diff`로 전문을 직접 열어 확인했다. 핵심 판정 로직(`canonicalIPv6`·
`mappedIPv4`·`isBlockedIPv6`·`isBlockedIPv4`)은 scratch 에서 Node 런타임으로 직접 재현했다(저장소 파일은 건드리지 않음 —
`node -e` 로 `URL`·`dns/promises.lookup` 동작만 프로브). 저장소 뮤테이션 없음, 원복 불필요(`git status --short` 로 변경 없음
확인 완료).

이전 두 라운드(`review/code/2026/09/19/21_38_32`, `22_00_32`)가 이미 Critical 0으로 수렴시켰고, 이번 라운드는 그 결과가
실제 코드에 반영됐는지·새 회귀가 없는지를 확인하는 성격이다.

## 발견사항

- **[INFO]** SMTP 발송/연결테스트 실패 시 usage 로그(`api.path`)에 실제 SMTP host(차단된 사설/CGNAT 주소 포함)가 그대로 남는다 — 이번 diff 는 건드리지 않은 기존 동작
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts:167` (`apiInfo.path = credentials.host ?? null;`), 소비처는 `:215`·`:240`(`logUsage(..., { api: apiInfo })`)
  - 상세: `http-safety.ts` 의 `SSRF_BLOCKED_CLIENT_MESSAGE` JSDoc 은 "차단된 host/IP 를 클라이언트 문구에 싣지 않는다(정찰 면 축소, CWE-209)"고 명시하고, `testEmailTransport`/`SendEmailHandler` 양쪽 모두 `EMAIL_HOST_BLOCKED` 메시지에 host 를 넣지 않는다 — 이 부분은 정확하다. 그런데 `apiInfo.path`(INT-US-05 usage 로그 필드)는 가드 판정과 무관하게 `credentials.host` 를 그대로 담고, 성공/실패 양쪽 `logUsage` 호출에 실려 `IntegrationUsageLog` 에 저장된다. 이 로그는 `GET /integrations/:id/activity` 로 workspace 사용자에게 그대로 반환된다(같은 파일 JSDoc 이 이미 이 채널을 인지하고 있음: "usage 로그는 Activity API 로 그대로 돌려주므로 거기에도 이 문구를 기록한다" — 단 그 문구는 에러 메시지 얘기고 `api.path` 는 별도 필드). 다만 `credentials.host` 는 그 통합을 설정한 사용자 자신이 입력한 값이라 그 사용자 본인에게는 새로운 정보가 아니다 — 워크플로 협업자 등 통합 설정을 직접 보지 못하는 workspace 구성원이 실행 로그만으로 그 값을 알게 되는 경우에 한해 의미 있는 노출이다. `git diff origin/main` 확인 결과 이 줄은 이번 PR 이 만든 것이 아니라 그대로 이월된 기존 동작(HTTP/DB 노드에도 동일 패턴 존재 추정)이라 이번 diff 의 회귀는 아니다.
  - 제안: 이번 PR 스코프 밖. 후속으로 "가드가 차단한 요청"에 한해 `apiInfo.path` 도 마스킹할지(HTTP 의 `SSRF_BLOCKED_CLIENT_MESSAGE` 설계 의도와의 일관성) 별도 판단 필요 — 코드 결함이 아니라 제품/트래커 판단 사안으로 남긴다.

- **[INFO]** NAT64/SIIT/6to4 등 IPv4-embedded IPv6 표기는 의도적으로 미차단 — 실제 NAT64 게이트웨이가 있는 네트워크에서는 여전히 우회 가능
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 함수 `mappedIPv4`(게이트 108~114), 대조 테스트는 `http-safety.spec.ts` "mapped 가 아닌 IPv4 내장 표기는 통과(현 정책)" 블록(게이트 178~185)
  - 상세: `mappedIPv4` 는 `::ffff:a.b.c.d` (IPv4-mapped) 형태만 IPv4 로 되돌려 판정하고, IPv4-compatible(`::a.b.c.d`)·SIIT(`::ffff:0:a.b.c.d`)·NAT64(`64:ff9b::a.b.c.d`)·6to4(`2002:a.b.c.d::`)는 의도적으로 통과시킨다. 근거는 macOS·`node:24-alpine` 실측에서 이 표기들이 `EHOSTUNREACH`/`ENETUNREACH`로 실제로 안 닿았다는 것인데, 이는 **그 두 환경에 NAT64/6to4 변환 인프라가 없다는 사실의 반영**이지 그 표기가 원천적으로 무해하다는 뜻은 아니다. 실제 NAT64 게이트웨이·6to4 릴레이가 존재하는 배포 환경(자가호스팅 인프라 등)에서는 `64:ff9b::7f00:1` 이 실제로 `127.0.0.1` 에 도달할 수 있어 같은 클래스의 SSRF 가 재현될 여지가 있다. plan(`plan/in-progress/ssrf-guard-integration-unify.md` "비대상")과 1라운드 RESOLUTION(W3)이 이미 이 경계를 의식하고 회귀 고정 테스트까지 넣어 **의도된 범위**로 문서화했으므로 신규 Critical/Warning 으로 격상하지 않는다 — 다만 "이 환경에서 안 닿았다"가 "모든 배포에서 안전하다"로 읽히지 않도록 재확인 차 기록한다.
  - 제안: 조치 불필요(이미 트래커 인지·의도적 범위). 다만 self-host 배포 가이드에 "egress 방화벽이 SSRF 방어의 최종 방어선" 이라는 기존 문구(모듈 JSDoc `assertSafeOutboundHostResolved` "Race window" 섹션)가 이 케이스도 포함한다는 점을 재확인만 해두면 충분.

## 확인했으나 문제 없음

- **IPv4-mapped IPv6 정규화 정확성**: `canonicalIPv6`/`mappedIPv4` 로직을 Node 런타임으로 직접 재현 — `::ffff:127.0.0.1`(점 형) · `[::ffff:7f00:1]`(hex 형, URL 정규화 결과) · 대문자 · 전체 형이 모두 동일한 IPv4(`127.0.0.1`)로 수렴하고, `isBlockedIPv4` 의 CGNAT(`100.64.0.0/10`) 대역 판정과 결합해 정확히 차단됨을 확인. `hi>>8`/`hi&0xff` 비트 연산은 오버플로/음수 없이 항상 0~255 범위.
- **대안 IPv4 표기(정수·8진수·16진수) 우회 가능성**: `parseIPv4`(점-십진수 정규식)는 `2130706433`(정수)·`0177.0.0.1`(8진수)·`0x7f.0.0.1`(16진수) 형태를 직접 인식하지 못하지만, `assertSafeOutboundHostResolved` 는 리터럴 체크 실패 시에도 `dns.lookup(hostname, {all:true})` 로 실제 해석 결과를 다시 `isBlockedHostname` 으로 검사한다. 실측 결과 `dns.lookup('2130706433')` → `127.0.0.1`(family 4)로 해석되어 2차 검사에서 차단됨을 확인 — 이 경로는 이번 diff 가 만든 게 아니고(기존 함수, 이번엔 SMTP 가 이 함수를 새로 쓰게 됐을 뿐) 결함도 아니다. `assertSafeOutboundUrl`(HTTP Request) 쪽은 WHATWG `URL` 파서 자체가 이런 대안 표기를 표준 점-십진수로 정규화해 리터럴 단계에서 바로 걸린다(`new URL('http://2130706433/').hostname === '127.0.0.1'` 실측 확인).
- **클라이언트 응답의 host/IP 미노출**: `testEmailTransport`·`SendEmailHandler`·HTTP Request 핸들러 전부 `SsrfBlockedError`/`isSmtpHostBlocked` 의 상세 메시지(실제 host/IP 포함, 서버 로그 전용)를 클라이언트에 그대로 전달하지 않고 각각 고정 문구(`EMAIL_HOST_BLOCKED` 메시지, `SSRF_BLOCKED_CLIENT_MESSAGE`)로 치환함을 확인 — CWE-209 방어가 실제로 지켜짐.
- **판정 계약의 타입 안전성**: 1라운드에서 지적됐던 "메시지 문자열 접두어로 판정" 문제는 전용 `SsrfBlockedError` 클래스 도입으로 해소됨(`smtp-host-guard.ts:28` `err instanceof SsrfBlockedError`). SSRF 판정이 아닌 오류(mock `boom`)는 그대로 재던짐이 테스트로 고정됨.
- **fail-open 정책의 일관성**: DNS 해석 실패 시 통과(`assertSafeOutboundHostResolved` catch 블록)는 HTTP/DB/SMTP 세 경로 모두 동일한 단일 구현을 공유하므로 비대칭 없음. 빈/공백/undefined host 도 `false`(통과) 지만, 호출부(`dispatchTest`/핸들러) 가 이미 필수 필드 검증을 먼저 수행함을 코드로 확인(`missingSmtpFields` 등).
- **하드코딩된 시크릿**: 신규/변경 파일 전체에서 실제 자격 증명·키 없음 — `integration-connection-test.e2e-spec.ts` 의 `password: 'e2e-password'` 등은 테스트 전용 더미 값.
- **파일 이동 잔여 참조**: `common/utils/smtp-host-guard` 옛 경로를 가리키는 import 가 코드베이스 어디에도 없음(grep 0건) — 4개 소비 파일 모두 새 경로(`nodes/integration/send-email/smtp-host-guard`)로 갱신됨.
- **인증/인가**: 이번 diff 는 컨트롤러·가드 데코레이터·인증 로직을 건드리지 않음. `ALLOW_PRIVATE_HOST_TARGETS` opt-out 은 환경변수 기반 배포 설정이지 요청 파라미터가 아니므로 사용자 우회 경로 아님.
- **뮤테이션 검증(원복 확인)**: 이번 리뷰는 저장소 파일을 전혀 고치지 않았다(모든 검증은 scratch `node -e` 프로브 + `Read`/`grep`로만 수행). `git status --short` 로 review 산출물 디렉터리 외 변경 없음 확인.

## 요약

핵심 판정 로직(IPv4-mapped IPv6 정규화, CGNAT 포함 여부, `SsrfBlockedError` 타입 계약)을 Node 런타임으로 직접 재현·검증한 결과
diff 가 주장하는 대로 정확히 동작한다. 클라이언트 응답에서 차단된 host/IP 를 감추는 CWE-209 방어도 SMTP·HTTP 경로 모두에서 실제로
지켜지고 있다. 새로 발견한 두 항목은 모두 INFO 수준이다 — (1) SMTP usage 로그의 `api.path` 필드는 가드와 무관하게 실제 host 를
그대로 남기는 기존(이번 diff 미변경) 동작이라 CWE-209 방어의 "메시지" 계층과는 다른 채널이고, (2) NAT64/SIIT/6to4 미차단은 이미
plan 에 실측·의도된 범위로 문서화된 잔여 표면이다. 둘 다 이번 PR 이 새로 만든 결함이 아니며, 이전 두 라운드가 이미 Critical 0 ·
Warning 수렴을 확인했고 이번 재검토에서도 새로운 Critical/Warning 을 찾지 못했다.

## 위험도

NONE

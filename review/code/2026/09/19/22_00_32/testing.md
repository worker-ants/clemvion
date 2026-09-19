# 테스트(Testing) 리뷰 — SSRF 가드 통합 (SMTP/HTTP/DB, IPv4-mapped IPv6 · CGNAT) 2라운드

이전 라운드(`review/code/2026/09/19/21_38_32/testing.md`)에서 지적한 WARNING 2건 — (1) IPv4-in-IPv6 대안 표기(IPv4-compatible ·
SIIT · NAT64 · 6to4) "여전히 통과해야 한다" 회귀 잠금 부재, (2) `isSmtpHostBlocked` 의 `host?.trim()` 방어 분기가 `undefined`
입력으로 테스트되지 않음 — 는 이번 커밋(`a1e1a591b`)에서 각각 `http-safety.spec.ts` 의 `it.each`(178~185행 부근, SIIT/NAT64/
6to4/IPv4-compatible 4행) 와 `smtp-host-guard.spec.ts` 의 `'returns false for a missing host'` 테스트로 실제 반영됐다.
뮤테이션으로 재검증했다(아래 "뮤테이션 검증" 참고) — 둘 다 의도한 회귀를 RED 로 잡는다. 이번 라운드는 이 상태를 기준으로
새로 도입된 코드(`canonicalIPv6`)의 커버리지 갭을 하나 추가로 발견했다.

## 발견사항

- **[WARNING]** `canonicalIPv6` 의 "파서가 거부하는 입력은 원문 그대로 둔다" 폴백 분기가 어떤 테스트로도 검증되지 않는다 — 뮤테이션으로 확인(실제로 깨져도 GREEN).
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 함수 `canonicalIPv6`(94~99행, catch 블록에서 `stripped` 그대로 반환)
  - 상세: 이 함수의 JSDoc(90~92행)은 "파서가 거부하는 입력(zone id `fe80::1%eth0` 등)은 원문 그대로 둔다 — 아래 접두 검사는 원문에도 맞는다" 는 구체적·반증 가능한 설계 주장을 남긴다. `isBlockedIPv6` 는 `fe80::1%eth0` 같은 zone-id 부착 link-local 주소를 이 폴백 경로로 여전히 차단해야 한다(WHATWG URL 파서가 미인코딩 `%` 를 가진 IPv6 브라켓 호스트를 거부함을 직접 확인 — `new URL('http://[fe80::1%eth0]/')` → `Invalid URL`). 그런데 이 catch 폴백이 반환하는 값을 검증하는 테스트가 없다. 실제로 `catch { return stripped; }` 를 `catch { return ''; }` 로 바꿔 뮤테이션 테스트한 결과 `http-safety.spec.ts` + `smtp-host-guard.spec.ts` 52개 테스트가 **전부 그대로 GREEN** 이었다 — 이 폴백이 조용히 깨져도(예: 향후 리팩터가 catch 블록에서 다른 정규화를 시도하다 실패) 잡아낼 테스트가 없다는 뜻이다. `isBlockedHostname` 이 지금 받는 모든 IPv6 테스트 입력(`fe80::1`, `fc00::1` 등)은 브라켓 없는 유효한 리터럴이라 `canonicalIPv6` 의 try 블록이 성공하고 catch 는 한 번도 실행되지 않는다 — 즉 이 catch 분기 자체가 스위트 전체에서 미실행(dead in tests) 상태다.
  - 제안: `it.each`(또는 별도 케이스)에 `isBlockedHostname('fe80::1%eth0')`(혹은 URL 파서가 거부하는 다른 IPv6 리터럴, 예 잘못된 zone-id 인코딩)를 `true` 로 단언하는 행을 추가한다. 이러면 catch 폴백이 실제로 실행되고, 그 반환값이 잘못되면 RED 가 된다.

- **[INFO]** (검증) 이전 라운드 WARNING 두 건의 수정이 실제로 판별력을 갖는다 — 뮤테이션으로 재확인.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 함수 `mappedIPv4`(108~114행) / `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` `isSmtpHostBlocked`(20~24행 부근, `host?.trim()`)
  - 상세: (1) `mappedIPv4` 정규식을 `^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$` 로 넓혀 SIIT 표기(`::ffff:0:127.0.0.1`)까지 매핑되게 뮤테이션했더니 `http-safety.spec.ts` 의 "mapped 가 아닌 IPv4 내장 표기는 통과(현 정책)" 테이블 중 SIIT 행이 정확히 RED 로 잡았다(`Expected: false, Received: true`). (2) `host?.trim()` 을 `host.trim()` 으로 뮤테이션했더니 `smtp-host-guard.spec.ts` 의 `'returns false for a missing host'` 테스트가 `TypeError: Cannot read properties of undefined (reading 'trim')` 로 RED 가 됐다. 두 뮤턴트 모두 원복 후 재확인(`git status --short` 클린, 관련 spec 4개 파일 224 테스트 GREEN)했다.
  - 제안: 조치 불필요 — 이전 WARNING 이 vacuous 하지 않음을 확인하는 기록.

- **[INFO]** `send_email` 노드의 **실제 발송** 경로가 CGNAT/IPv4-mapped 입력으로 차단되는 것을 검증하는 e2e 는 없다 — connection-test(`preview-test`)만 e2e 로 덮는다.
  - 위치: `codebase/backend/test/integration-connection-test.e2e-spec.ts` 신규 `it.each` 'B2'(120~169행) — `preview-test` 엔드포인트만 대상
  - 상세: `send-email.handler.spec.ts` 는 가드를 모킹해 "가드가 true 를 돌려주면 `EMAIL_HOST_BLOCKED` 로 라우팅한다"는 배선만 unit 레벨로 검증하고, `smtp-host-guard.spec.ts` 는 가드 함수 자체가 CGNAT 를 판정하는지를 unit 레벨로 검증한다 — 두 계층을 실제 네트워크 스택까지 이어 붙여 "발송 실행이 CGNAT host 에서 실제로 막히는지"를 보는 것은 이번 e2e 커버리지 밖이다(연결 테스트만 e2e). 다만 코드 경로상 `isSmtpHostBlocked` 는 두 호출부(`testEmailTransport`, `SendEmailHandler.execute`)에서 동일 함수이므로 unit 조합으로 사실상 동치가 성립하며, 이 격차를 메우려면 워크플로 실행 e2e(더 무거움)가 필요해 비용 대비 효과가 낮다.
  - 제안: 조치 불필요(정보성) — 현재의 unit(가드 자체) + unit(배선) + e2e(연결 테스트) 3중 구성으로 실질 위험은 낮다. 향후 워크플로 실행 e2e 스위트가 생기면 한 케이스만 추가해도 충분.

## 회귀 테스트 검토

- 기존 `send-email.handler.spec.ts` · `integrations.service.spec.ts` 는 import 경로(`common/utils/smtp-host-guard` → `nodes/integration/send-email/smtp-host-guard`) 갱신만 있고 단언 내용은 불변 — 실제 실행(`npx jest` 4개 파일, 224 테스트)으로 GREEN 확인했다. 삭제된 `common/utils/smtp-host-guard.{ts,spec.ts}` 를 가리키는 잔존 참조는 저장소 전체에서 0건(`grep` 확인).
- `http-safety.spec.ts` 의 `mockedLookup` 타입을 `{ all: true }` 오버로드로 좁힌 변경(1~17행)은 런타임 동작을 바꾸지 않는 타입 전용 수정이고, 나머지 기존 테스트(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 관련)는 그대로 유효하다.

## Mock 적절성 · 테스트 격리

- `smtp-host-guard.spec.ts` 는 DNS 를 모킹하지 않고 실제 `dns.lookup` 을 태우지만, 입력이 전부 IP 리터럴이라 네트워크 질의 없이 결정적으로 반환된다 — 파일 상단에 그 근거를 주석으로 명시했다(이전 INFO 반영 확인).
- `SsrfBlockedError` rethrow 분기(`smtp-host-guard.ts` 25~29행)를 검증하는 테스트가 `jest.isolateModules` + `jest.doMock` + `require` 조합을 쓰는데, 이 패턴은 같은 코드베이스의 `instrumentation.spec.ts`·`code.handler.spec.ts` 에도 이미 있어 특이하지 않다. 모킹된 `SsrfBlockedError` 클래스와 실제로 던져지는 `boom`(plain `Error`)이 `instanceof` 로 구분되는지를 정확히 노리는 설계로, 격리도 각 테스트 사이에 누수 없이 닫혀 있다(`ALLOW_PRIVATE_HOST_TARGETS` 는 `afterEach` 로 원상복구, `mockedLookup.mockReset()` 은 `beforeEach` 에서).

## 뮤테이션 검증

`http-safety.ts`·`smtp-host-guard.ts` 를 저장소 밖 스크래치(`mktemp -d`)에 원본 백업 후 3회 인플레이스 뮤테이션 → 테스트 실행 → `cp` 로 복원(각 회차 직후 `git status --short` 로 클린 확인, `git checkout`/`restore` 미사용):

1. `mappedIPv4` 정규식을 SIIT 표기까지 넓힘 → `http-safety.spec.ts` RED(SIIT 행, "Expected: false, Received: true"). 복원 확인.
2. `isSmtpHostBlocked` 의 `host?.trim()` → `host.trim()` → `smtp-host-guard.spec.ts` RED(`TypeError`). 복원 확인.
3. `canonicalIPv6` catch 폴백을 `stripped` 대신 `''` 반환 → **52개 테스트 전부 GREEN**(위 WARNING 의 근거). 복원 확인.

최종 `git status --short` : `review/code/2026/09/19/22_00_32/`(본 리뷰 산출물 디렉터리) 외 변경 없음 — 저장소 파일은 전부 원상 복구됐다.

## 요약

핵심 변경(`http-safety.ts` 의 IPv4-mapped IPv6 판정·`smtp-host-guard.ts` 의 `http-safety` 전환)에 대한 테스트는 전반적으로
탄탄하고, 지난 라운드에서 지적한 두 WARNING(대안 표기 회귀 잠금·undefined host 방어)은 뮤테이션으로 재검증한 결과 실제
판별력을 갖는 것으로 확인됐다(vacuous 하지 않음). 다만 이번 변경이 새로 도입한 `canonicalIPv6` 의 파서-거부 폴백 분기는
스위트 전체에서 한 번도 실행되지 않는 dead-in-tests 코드로 남아 있고, 그 폴백이 깨지는 뮤턴트가 GREEN 으로 통과해 새 WARNING
으로 남긴다. 나머지는 정보성 관찰(e2e 가 연결 테스트만 덮고 실제 발송 경로까지는 안 감 — 비용 대비 낮은 우선순위)이다.
Critical 은 없다.

## 위험도

LOW

# 요구사항(Requirement) 충족 리뷰 — 통합 노드 SSRF 가드 단일화 (SMTP CGNAT · IPv4-mapped IPv6), 3라운드

## 검증 방법

`plan/in-progress/ssrf-guard-integration-unify.md` 가 정의한 범위와 커밋(`103906807`·`a1e1a591b`·`fce34b77b`·`bb4c5381b`)을 대상으로, 이미 2라운드(`review/code/2026/09/19/21_38_32`, `22_00_32`)가 검토·조치한 항목이 실제로 코드에 반영됐는지 재확인하고, 그 위에 spec 본문(line-level)과 대조했다.

- `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 전체를 Read.
- `spec/2-navigation/4-integration.md` §5.5(508~523행), `spec/4-nodes/4-integration/1-http-request.md` §4 step8·§8.2·§8.3, `2-database-query.md` §4 SSRF 콜아웃(106행), `3-send-email.md` §4 step7(97행)을 직접 열어 코드와 대조.
- `canonicalIPv6`/`mappedIPv4` 정규화 로직을 scratch 디렉터리 밖에서 **저장소 파일 수정 없이** Node REPL(`node -e`)로 실측 재현 — `::ffff:127.0.0.1` · `::ffff:7f00:1` · `::FFFF:7F00:1` · `0:0:0:0:0:ffff:7f00:1` · `::ffff:10.0.0.5` · `::ffff:0.0.0.0` 가 모두 코드 주석이 주장하는 정규화 형으로 수렴함을 확인했고, IPv4-compatible/SIIT/NAT64/6to4 4개 대안 표기가 정규식에 매칭되지 않음(=차단 안 됨, 의도된 정책)도 확인했다. zone-id(`fe80::1%eth0`, `[fe80::1%25en0]`)는 `new URL()` 이 `Invalid URL` 을 던져 원문 fallback 경로를 타는 것도 재현했다.
- `npx jest http-safety.spec.ts smtp-host-guard.spec.ts integrations.service.spec.ts send-email.handler.spec.ts` 실행 — 4 suites / **226 tests 전부 GREEN**.
- `grep -rn "common/utils/smtp-host-guard\|common/utils/ssrf.util"` 로 잔여 참조·비대상 범위(LLM/S3)를 재확인.
- 저장소 트리는 Read/Bash(node REPL, jest, grep)만 사용했고 어떤 파일도 쓰지 않았다 — `git status --short` 결과 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/19/22_24_32/`) 외 변경 없음.

## 발견사항

- **[INFO]** 2라운드에서 지적된 항목 전부가 실제로 코드에 반영됨을 직접 확인 — 재발 아님, 확인용 기록
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` `isBlockedIPv6`(101~114행 부근) · `codebase/backend/src/nodes/integration/http-request/http-safety.spec.ts` (`it.each` "mapped 가 아닌 IPv4 내장 표기는 통과", "정규화할 수 없는 입력도 원문으로 판정") · `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.spec.ts` ("returns false for a missing host") · `CHANGELOG.md` · `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management*.mdx`
  - 상세: 1라운드 testing.md WARNING(대안 IPv4-in-IPv6 표기 회귀 테스트 부재, `undefined` host 미검증)과 2라운드 documentation/W1·W3·W4·W5(가이드 문서 Email·CGNAT 누락, JSDoc 문단 끼어듦, 트래커 등재 거짓 주장, 정규화 폴백 미실행 테스트)가 각각 대응 파일에 실제로 반영돼 있음을 Read/실측으로 확인했다. `SsrfBlockedError` 클래스화(architecture/maintainability WARNING — 문자열 접두어 매칭 계약)도 `http-safety.ts:47-52`·`smtp-host-guard.ts:27-29`에서 `instanceof SsrfBlockedError` 로 교체 완료.
  - 제안: 조치 불필요.

- **[INFO]** W2(소비자 넷의 catch 가 `instanceof` 아닌 것)의 수렴 예외 처리가 developer SKILL 정책에 부합
  - 위치: `review/code/2026/09/19/22_00_32/RESOLUTION.md` W2, `plan/in-progress/spec-draft-nullable-notation-followups.md` (게이트 4903~4907)
  - 상세: `http-request.handler.ts`·`http-redirect.ts`·`database-query.handler.ts`·`database-connection-tester.ts` 는 여전히 가드가 던진 것을 "무엇이든" 차단으로 옮긴다. 지금은 가드가 `SsrfBlockedError` 만 던지므로 동작 차이가 없고(직접 grep·Read로 재확인), 후속 트래커 항목("SSRF 가드 소비자 넷의 catch 를 `instanceof SsrfBlockedError` 로")이 실제로 등재돼 있다. 요구사항 관점에서 현재 동작에 결함은 없다.
  - 제안: 조치 불필요 — 트래커로 이월된 결정을 그대로 존중.

- **[INFO]** spec fidelity — line-level 대조 결과 어긋남 없음
  - 위치: `spec/2-navigation/4-integration.md:508-523` · `spec/4-nodes/4-integration/1-http-request.md:96-105` · `2-database-query.md:106` · `3-send-email.md:97` ↔ `codebase/backend/src/nodes/integration/http-request/http-safety.ts` · `.../send-email/smtp-host-guard.ts` · `integrations.service.ts:1594-1602` · `send-email.handler.ts:176-183`
  - 상세: 에러 코드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`), opt-out 플래그명(`ALLOW_PRIVATE_HOST_TARGETS=true`), 차단 대역(RFC1918·loopback·link-local·CGNAT·IPv6 사설 대역), 클라이언트 메시지의 host/IP 미노출 원칙이 spec 문언과 정확히 일치한다. spec 이 "세 노드가 동일 메커니즘" 이라 적은 문장은 이번 diff 이전부터 있었고, 종전 코드(SMTP 가 `ssrf.util` 사용)가 그 문장에 미달했던 것을 이번 변경이 바로잡았다 — **spec 이 옳고 코드가 틀렸던 사례**(SPEC-DRIFT 아님, 방향 판별 완료). `plan_impact: none` 이 타당하다.
  - 제안: 없음.

## 상세 검증 (문제 없음으로 확인된 항목)

- **엣지 케이스**: CGNAT 경계(`100.64.0.0`/`100.127.255.255` 안·`100.63.255.255`/`100.128.0.0` 바깥), 빈/공백/`undefined` host, DNS 조회 실패(fail-open, 기존 동작과 대칭), DNS 가 mapped 주소(AAAA)를 반환하는 경우 — 전부 테스트로 커버되고 GREEN.
- **반환값**: `isSmtpHostBlocked`/`isBlockedHostname`/`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 네 함수 모두 모든 분기에서 boolean 반환 또는 명시적 throw(`SsrfBlockedError`) — 미정의 경로 없음.
- **에러 시나리오**: SSRF 판정이 아닌 오류(`SsrfBlockedError` 가 아닌 것)는 `smtp-host-guard.ts` 가 삼키지 않고 재던진다 — 전용 테스트("SSRF 판정이 아닌 오류는 «막힘» 으로 바꾸지 않고 그대로 던진다")로 고정.
- **TODO/FIXME**: 변경분 전체에서 미완성을 시사하는 TODO/FIXME/HACK/XXX 없음.
- **의도-구현 일치**: `integrations.service.ts`/`send-email.handler.ts` 의 주석이 옛 phantom 식별자(`SMTP_BLOCK_PRIVATE_HOSTS`)에서 실제 동작(`ALLOW_PRIVATE_HOST_TARGETS=true` opt-out, 기본 ON)으로 정확히 정정됨.
- **비즈니스 로직**: `PRIVATE_V4_RANGES` 의 CGNAT 대역(`100.64.0.0`~`100.127.255.255`)이 RFC 6598 과 정확히 일치. IPv4-mapped IPv6 는 "품은 IPv4 대역으로 판정" 이라는 CHANGELOG/JSDoc 서술과 실제 정규식·비트 연산이 정확히 대응.
- **테스트 실행**: 4 suites 226 tests GREEN(재실행, 리포지토리 미변경).

## 요약

`plan/in-progress/ssrf-guard-integration-unify.md` 가 정의한 작업(SMTP SSRF 가드를 `http-safety.ts` 로 통합, IPv4-mapped IPv6 정규화 도입, phantom 주석 정정)은 완전히 구현됐고, 이미 2라운드 리뷰가 지적한 WARNING(가이드 문서 Email/CGNAT 누락·JSDoc 문단 끼어듦·트래커 등재 거짓 주장·정규화 폴백 미검증·문자열 접두어 계약)이 모두 대응 커밋에 반영돼 있음을 코드 Read·Node 실측·jest 재실행으로 직접 재확인했다. spec(`2-navigation/4-integration.md` §5.5, `1-http-request.md`/`2-database-query.md`/`3-send-email.md` §4)과 line-level 로 대조한 결과 에러 코드·opt-out 플래그·차단 대역·클라이언트 메시지 정책 모두 일치하며, spec 문언이 원래 옳았고 코드가 그에 미달했던 방향(코드 버그, SPEC-DRIFT 아님)임을 실측으로 확인했다. 유일하게 남은 미해결 사안(W2 — 가드 소비자 넷의 catch 가 `instanceof` 가 아님)은 developer SKILL §ISSUE FIX 정책의 수렴 예외로 처리돼 트래커에 정식 등재됐고, 현재 동작에 결함이 없어 요구사항 충족을 저해하지 않는다. 새로운 CRITICAL/WARNING 은 발견하지 못했다.

## 위험도

NONE

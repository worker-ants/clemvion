# 요구사항(Requirement) 충족 리뷰 — 통합 노드 SSRF 가드 단일화 (2라운드, SMTP CGNAT / IPv4-mapped IPv6)

이 라운드는 1라운드 리뷰(`review/code/2026/09/19/21_38_32/`)의 WARNING 7건 조치 결과(`a1e1a591b`)를 포함한 diff다.
실제 소스(`http-safety.ts`, `smtp-host-guard.ts`, 각 `.spec.ts`, `integrations.service.ts`,
`send-email.handler.ts`, `database-connection-tester.ts`, `database-query.handler.ts`)를 `Read`/`Grep`으로
직접 열어 대조하고, `node` REPL로 `canonicalIPv6`/`mappedIPv4` 정규화 결과를 재현했으며, 관련 4개 spec 파일을 열어
line-level로 대조했다. 관련 unit 테스트 4개 스위트(224 tests)를 저장소 변경 없이 재실행해 전부 GREEN을 확인했다
(`git status --short` 로 뮤테이션 없음 확인 — 세션 시작 시점 존재하던 `review/code/2026/09/19/22_00_32/` 외 변경 없음).

## 발견사항

없음 — CRITICAL/WARNING 없음.

## 상세 검증 (문제 없음으로 확인된 항목)

- **1라운드 WARNING 7건 전부 실제로 조치됨을 코드로 직접 확인**:
  - W1(메시지 접두어 매칭) → `http-safety.ts`에 `SsrfBlockedError` 클래스 신설, `smtp-host-guard.ts`가
    `err instanceof SsrfBlockedError`로 판별(문자열 매칭 제거). `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`의
    4개 throw 지점 전부 `new SsrfBlockedError(...)`로 교체됨을 확인 — 누락된 지점 없음.
  - W3(대안 IPv4-in-IPv6 표기 회귀 고정) → `http-safety.spec.ts`에 IPv4-compatible/SIIT/NAT64/6to4 4행 `it.each`
    추가, `mappedIPv4` 정규식(`^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$`)이 이 네 형태를 매치하지 않음을 `node` REPL로
    재현 확인(`::ffff:0:7f00:1`처럼 세 그룹인 SIIT 형은 정확히 그룹 수 불일치로 걸러짐).
  - W4(host 누락) → `smtp-host-guard.spec.ts`에 `undefined`/공백 케이스 추가, 구현(`host?.trim()`)과 일치.
  - W5·W7(CHANGELOG) → 루트 `CHANGELOG.md`에 Unreleased 항목 추가, 무엇이 뚫려 있었는지·고친 것·배포 영향·opt-out
    안내가 선례(`0a040b96c`) 형식과 일치.
  - W6(.env.example) → 헤더가 "HTTP Request, DB Query and Send Email (SMTP) nodes"로 확장되고
    `smtp-host-guard.ts` 경로 병기 — 본문(Send Email 포함)과 이제 정합.
  - W2(폴더 위치) → 헤더 docstring에 이유(spec `1-http-request.md` frontmatter `code:` 경로 의존) + 트래커 참조
    한 줄 추가, 이전과 달리 최소 조치이나 근거 명시로 충분.
- **spec fidelity — line-level 대조, 정확히 일치**:
  - `spec/4-nodes/4-integration/3-send-email.md` §4 step 7: "credentials.host 가 사설(RFC1918)·loopback·
    link-local·CGNAT·IPv6 사설 대역을 가리키면 EMAIL_HOST_BLOCKED" — `PRIVATE_V4_RANGES`(10/8, 172.16/12,
    192.168/16, 127/8, 169.254/16, 100.64.0.0~100.127.255.255, 0.0.0.0/8)와 `isBlockedIPv6`(::1, ::,
    fe80::/10, fc00::/7)가 정확히 이 대역을 구현.
  - `spec/2-navigation/4-integration.md` §5.5(523행): "SMTP host 는 HTTP Request 노드의 SSRF 가드와 동일한
    메커니즘·플래그를 공유" — `smtp-host-guard.ts`가 `http-safety.ts`의 `assertSafeOutboundHostResolved`를
    직접 재사용(어댑터 패턴)해 이제 실제로 동일 메커니즘.
  - `spec/2-navigation/4-integration.md` §Rationale "SMTP SSRF 가드를 http/db 와 동일 ALLOW_PRIVATE_HOST_TARGETS 로
    통일"(1226~1228행) — "별도 opt-in 플래그(SMTP_BLOCK_PRIVATE_HOSTS 안)를 신설하는 대신 기존
    ALLOW_PRIVATE_HOST_TARGETS 재사용" — 코드 주석 정정(`integrations.service.ts`/`send-email.handler.ts`의
    "SSRF 가드 (기본 ON) … ALLOW_PRIVATE_HOST_TARGETS=true 로만 끈다")이 이 문언과 정확히 일치.
  - 에러 코드 3종(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`) — 변경 없이 재사용, spec 표(§1110/1114/1119)와
    코드(각 catch 블록) 그대로 일치.
  - `spec/4-nodes/4-integration/1-http-request.md`에는 "IPv4-mapped IPv6"라는 표현이 문언으로 존재하지 않으나,
    spec이 이미 열거한 대역(loopback/RFC1918/link-local/CGNAT/IPv6 ULA)에 표기만 바꿔 실제로 도달하던 우회를
    닫는 것이므로 새 요구사항 추가가 아니라 spec이 이미 명시한 차단 의도를 코드가 미달했던 것을 고친 것 —
    **코드가 틀려 있던 사례**, SPEC-DRIFT 아님(1라운드 requirement.md의 동일 결론과 일치, 이번에도 재확인).
- **IPv4-mapped IPv6 정규화 재실측**: `node -e` 로 `::ffff:127.0.0.1`/`::FFFF:7F00:1`/`0:0:0:0:0:ffff:7f00:1`/
  `::ffff:10.0.0.5`/`::ffff:6440:1`/`::ffff:0.0.0.0`/`::ffff:a9fe:a9fe`/`::ffff:8.8.8.8` 모두 문서가 주장하는
  정규화 형(`::ffff:7f00:1` 등)으로 수렴함을 직접 확인했고, `mappedIPv4`가 각 케이스에서 계산하는 IPv4가
  `PRIVATE_V4_RANGES`와 정확히 일치함을 옥텟 단위로 검산했다. `zone id`(`fe80::1%eth0`)처럼 URL 파서가 거부하는
  입력은 `canonicalIPv6`가 원문 그대로 반환하고, 뒤이은 `fe[89ab]` 접두 검사가 원문에도 그대로 맞아 여전히 차단됨을
  확인 — fallback 경로도 우회 없음.
- **회귀 없음 확인**: `grep -rn "common/utils/smtp-host-guard"` 결과 0건(파일 삭제·이동 완결). `ssrf.util`은
  LLM(`llm-preview.service.ts`, `model-config.service.ts`)에만 남아 있고 SMTP/HTTP/DB 경로에서 참조 0건.
  `database-connection-tester.ts`/`database-query.handler.ts`는 diff 밖 파일이지만 둘 다 이미
  `assertSafeOutboundHostResolved`(동일 함수)를 호출하고 있어, `http-safety.ts`의 이번 보강이 코드 변경 없이
  DB 경로에도 자동 적용됨을 직접 열어 확인했다 — "세 노드 공유"라는 주석 주장이 실측과 일치.
- **테스트 재실행(리포지토리 미변경)**: `npx jest http-safety.spec.ts smtp-host-guard.spec.ts
  send-email.handler.spec.ts integrations.service.spec.ts` — 4 suites / 224 tests 전부 GREEN
  (plan 문서가 기록한 뮤테이션·ratchet 결과와 모순 없음).
- **에러 시나리오 / 반환값**: `isSmtpHostBlocked`는 `SsrfBlockedError`만 `true`로 흡수하고 그 외는 재던진다.
  다만 현재 구현상 `assertSafeOutboundHostResolved`가 던질 수 있는 예외는 `SsrfBlockedError`뿐이다(DNS 조회
  실패는 내부에서 fail-open으로 흡수되어 `return`) — 이 재던짐 분기는 현재 도달 불가능한 방어적 코드이며,
  1라운드 리뷰 INFO 10에서 이미 같은 사실이 확인·기록됨. 새로운 문제는 아니다.
- **엣지 케이스**: CGNAT 경계(`100.64.0.0`/`100.127.255.255`)와 바로 바깥(`100.63.255.255`/`100.128.0.0`)이
  구현의 반개구간(`ipToInt(100,64,0,0)`~`ipToInt(100,127,255,255)`)과 정확히 일치. 빈 host(`''`, 공백,
  `undefined`)는 두 호출 경로(`send-email.handler.ts`의 `missingSmtpFields`, `integrations.service.ts`의
  `dispatchTest`→`validateCredentials`) 모두 SSRF 가드 호출 전에 필수 필드 검증이 걸러냄을 직접 확인 —
  JSDoc의 "빈 host 는 앞선 필수 필드 검증이 걸러낸다"는 주장과 실제 호출 순서가 일치.
- **TODO/FIXME/HACK/XXX**: 변경/신규 파일 전체에서 검색 0건.
- **의도-구현 일치**: `testEmailTransport`/`SendEmailHandler`의 주석 정정("SMTP_BLOCK_PRIVATE_HOSTS opt-in" →
  "ALLOW_PRIVATE_HOST_TARGETS=true 아니면 차단하는 opt-out, 기본 ON")이 `isPrivateHostsAllowed()` 구현(기본 차단,
  플래그가 `'true'`일 때만 허용)과 정확히 일치.
- **e2e**: `integration-connection-test.e2e-spec.ts`의 신규 B2 `it.each`가 HTTP(`[::ffff:127.0.0.1]:3011`)·
  DB(`::ffff:127.0.0.1`)·Email(`100.64.0.1`) 세 경로 각각의 전용 차단 코드와 host/IP 미노출 메시지
  (`not.toMatch(/ffff|100\.64|127\.0\.0\.1/)`)를 단언 — spec의 코드 표(§5.5/§1110/§1114/§1119)·§8.3(메시지 일반화
  Rationale)과 필드까지 일치.

## 요약

1라운드에서 지적된 WARNING 7건(매직스트링 판정, 폴더 위치, 회귀 테스트 공백 2건, CHANGELOG, .env.example)이
모두 실제 코드/테스트/문서 변경으로 조치됐음을 소스 직접 대조로 확인했다. `SsrfBlockedError` 도입으로 판정
경계가 타입 안전해졌고, 대안 IPv4-in-IPv6 표기(IPv4-compatible/SIIT/NAT64/6to4)의 "의도적 미차단" 설계 근거가
이제 회귀 테스트로 고정됐다. spec(`4-integration.md §5.5`, `3-send-email.md §4`, `1-http-request.md §4`,
`2-database-query.md §4`)이 이미 서술한 "세 노드 동일 메커니즘·플래그" 요구사항에 코드가 실제로 도달했음을
정규화 로직 재현·테스트 재실행·caller 경로(DB 커넥션 테스터·핸들러 포함) 전수 확인으로 검증했다. CRITICAL/WARNING
없음 — 방향이 명확한 정상적 버그 수정이며 SPEC-DRIFT도 아니다.

## 위험도

NONE

---
id: "CLE-EIA-NOTIFY-SSRF"
title: "EIA 알림 웹훅 — SSRF 방지"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EIA-NOTIFY"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-EIA-NOTIFY"]
area: "CLE-IX"
content_hash: "6b8ca1230b800610158519e5710506c4e56b4a541f8cbb09dc2beeb47e4b2f18"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "4164a2a269a3322c399ef7d69cd340d0b0078564c40cbd7cbe2f2a64bc533226"
etag: "sha256-00d215287b8875d8282ef834bd1efd74b3be4d6260df1261cc1efad944ff2723"
---
## 개요

이 문서는 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md) 의 하위 문서로 `notification.url` 의 SSRF 방지(등록 · 발송 직전 URL 검사, 막는 대역, DNS 결과 검사, 거부 처리)를 정한다.

## SSRF 방지

`notification.url` 을 등록할 때(`TriggersService.assertNotificationUrlSafe`)와 보내기 직전(`checkSsrfSafeUrl`)에 두 번 검증한다.

등록할 때 걸리면 트리거 생성 · 수정 요청이 `400 INVALID_NOTIFICATION_URL` 로 실패한다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#64-유효성-검증) §6.4). 보내기 직전 검사는 발송 작업 안에서 돌아서 응답할 HTTP 요청이 없다. 걸리면 그 알림 웹훅을 보내지 않고 재시도하지도 않는다. 발송 건강도를 `degraded` 로 바꾸고 `notification_last_error` 에 거부 사유를 남긴다. 아래 DNS 결과 검사에 걸려도 같다.

- 호스트가 사설 · 특수 대역(10/8, 172.16/12, 192.168/16, 100.64/10, 0/8, 192.0.0/24, 198.18/15, 멀티캐스트 224/4, 예약 · 브로드캐스트 240/4, fc00::/7, 옛 site-local fec0::/10, 멀티캐스트 ff00::/8, NAT64 local-use prefix 64:ff9b:1::/48, 미지정 주소 ::), loopback(127/8, ::1), link-local · 메타데이터 서비스 IP(169.254/16, fe80::/10, 169.254.169.254 등)의 IP 리터럴이면 거부한다. `localhost` 와 `0.0.0.0` 도 거부한다. 이 두 검사는 DNS 를 풀지 않고 URL 의 호스트 문자열만 본다. 그래서 사설 IP 로 풀리는 호스트 이름은 아래 DNS 결과 검사가 켜져 있을 때만 막힌다. 이 검사는 운영 환경에서 기본으로 켜져 있다.
- IPv4 를 품은 IPv6 리터럴은 품은 IPv4 로 판정한다. 마지막 32비트에 IPv4 를 품은 IPv4-mapped(`::ffff:0:0/96`), IPv4-compatible(`::/96`), SIIT(`::ffff:0:0:0/96`), NAT64 well-known prefix(`64:ff9b::/96`)와 둘째 · 셋째 16비트에 IPv4 를 품은 6to4(`2002::/16`)가 대상이다. 점 표기(`::ffff:127.0.0.1`)와 16진 표기(`::ffff:7f00:1`)를 같게 본다. 공인 IPv4 를 품었으면 통과한다. NAT64 local-use prefix(`64:ff9b:1::/48`)는 IPv4 자리가 망마다 달라서 품은 IPv4 를 꺼내지 않고 첫째 불릿대로 대역 전체를 막는다. [외부 MCP 서버 URL 검사](../CLE-INT/CLE-INT-MCP.md#자격-증명과-url-검증)는 6to4 · NAT64 local-use prefix 와 192.0.0/24 · 198.18/15 · 224/4 · 240/4 · fec0::/10 · ff00::/8 을 아직 막지 않는다. 두 가드를 맞추는 일은 NERV Task `CLE-T-753725` 가 맡는다. 범위를 정한 이유는 [Rationale](#ipv4-를-품은-ipv6-리터럴을-품은-ipv4-로-판정한다-2026-11-01) 과 [특수 용도 대역 · 6to4 · NAT64 local-use prefix 를 막는다](#특수-용도-대역--6to4--nat64-local-use-prefix-를-막는다-2026-11-12) 에 있다.
- DNS 결과 검사(DNS rebinding 방어): 보내기 직전에 호스트 이름을 OS 해석기로 풀어(`dns.lookup`, 나온 주소 전부) 하나라도 위 대역에 들면 발송을 거부하고 발송 건강도를 `degraded` 로 둔다(`checkResolvedHostIp`). 발송(`fetch`)이 연결할 때 쓰는 해석기와 같아서 `/etc/hosts` 와 검색 도메인도 같게 본다. 켜짐 여부는 환경과 `NOTIFICATION_ENFORCE_DNS_REBIND_GUARD` 로 정한다.
  - 운영 환경(`NODE_ENV=production`): 기본으로 켠다. 값이 정확히 `0` 일 때만 끈다. 끈 채로 기동하면 `main.ts` 가 `[SECURITY]` 경고 로그를 한 번 남긴다(`shouldWarnNotificationDnsGuardOff`). 기동을 막지는 않는다.
  - 운영 밖: 기본으로 끈다. 값이 정확히 `1` 일 때만 켠다.
  - 등록 때는 DNS 를 풀지 않는다. 등록 때 IP 를 저장해 발송 때 IP 와 비교하지도 않는다.
  - DNS 조회가 실패하면 검사를 통과시킨다(fail-open). 발송도 같은 해석기로 연결하므로 대개 발송이 연결 전에 실패하고 재시도된다.
  - 조회는 3초(`DNS_LOOKUP_TIMEOUT_MS`)까지 기다린다. 이 값은 코드 상수라 설정으로 바꿀 수 없다. 3초를 넘기면 조회가 실패한 것과 같이 통과시킨다. 이때 발송 작업이 그 트리거의 id 와 함께 경고 로그를 남긴다. 발송 건강도는 바꾸지 않는다.
  - 검사한 IP 로 연결을 고정하지 않는다. 그래서 검사와 연결 사이에 DNS 응답이 바뀌면 막지 못한다.
  - 근거와 측정은 [Rationale](#운영-환경에서-dns-결과-검사를-기본으로-켠다-2026-11-06) 에 있다.
- 발송은 리다이렉트를 따라가지 않는다. 등록 때와 발송 직전의 검사는 등록 URL 의 호스트만 본다. 리다이렉트가 가리키는 주소는 어느 검사도 보지 않는다. 따라가면 공개 호스트가 3xx 로 사설 · loopback · 메타데이터 주소를 가리켜 이 검사들을 통과한다. 307 · 308 이면 서명한 본문도 그 주소로 간다. 3xx 응답의 처리는 [재시도와 실패 처리](CLE-EIA-NOTIFY-DELIVERY.md#재시도와-실패-처리) 가 정한다.
- 워크스페이스 단위 허용·차단 목록(원문 표기 `workspace_settings.notification_url_allow_pattern`)을 설정할 수 있어야 한다. [미결 사항](CLE-EIA-NOTIFY.md#미결-사항) 참조.
- URL 은 `https://` 만 받는다. 개발 환경에서 `ALLOW_HTTP_HOOKS=1` 일 때만 `http://` 를 허용한다. 운영 환경(`NODE_ENV=production`)에서 이 플래그가 `1` 이나 `true` 이면 서버가 기동하지 않는다([운영 환경 가드](../CLE-ACCT/CLE-ACCT-SESSION.md#운영-환경-가드)). 이 플래그는 스킴만 연다. 호스트 검사를 끄는 플래그는 없다. [통합 노드](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#사설망-차단)의 사설망 허용 플래그(`ALLOW_PRIVATE_HOST_TARGETS`)도 이 검사에는 적용되지 않는다.

## 구현 위치

- `codebase/backend/src/common/utils/ssrf-safe-url.util.ts` (등록 · 발송 직전 URL 검사 `checkSsrfSafeUrl`, DNS 결과 검사 `checkResolvedHostIp` 와 켜짐 판정 `isNotificationDnsGuardEnabled`, 운영에서 끈 경우의 기동 경고 판정 `shouldWarnNotificationDnsGuardOff`(`main.ts` 가 부른다), IPv6 리터럴 정규화 `normalizeIpv6Literal` 과 IPv4 를 품은 IPv6 판정 `embeddedIpv4FromIpv6`. 두 헬퍼는 MCP 가드 `McpClientService.isBlockedIPv6` 도 쓴다)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (등록 거부 `assertNotificationUrlSafe`(`400 INVALID_NOTIFICATION_URL`))
- `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts` (보내기 직전 검사와 거부 시 발송 건강도 기록)

## Rationale

### IPv4 를 품은 IPv6 리터럴을 품은 IPv4 로 판정한다 (2026-11-01)

마지막 32비트에 IPv4 를 품은 IPv6 리터럴은 품은 IPv4 를 IPv4 대역표로 다시 판정한다. IPv4-mapped 리터럴(`[::ffff:7f00:1]`)이 loopback · 메타데이터 주소를 두 검사에 통과시킨다는 코드 리뷰 발견이 계기다. 작업은 NERV Task `CLE-T-DCQWEB` 다.

- Node.js 의 `URL` 은 `https://[::ffff:127.0.0.1]/` 의 hostname 을 `[::ffff:7f00:1]` 로, `https://[::ffff:169.254.169.254]/` 를 `[::ffff:a9fe:a9fe]` 로 바꾼다. 그때까지 검사는 IPv6 에서 `::1` · `::` · fe80::/10 · fc00::/7 만 막았다. 그래서 두 주소가 등록 검사와 발송 직전 검사를 모두 지났다.
- IPv4-mapped 주소는 IPv4 대상에 그대로 닿는다. 통합 노드 가드 코드(`http-safety.ts` 의 `mappedIPv4`)도 같은 이유로 IPv4-mapped 를 품은 IPv4 로 판정한다. 그 판정 범위와 실측은 아직 스펙에 없고 코드 주석에만 있다. 알림 웹훅에서는 서명한 POST 가 loopback · 메타데이터 주소로 가고 그 응답 코드가 `notification_last_error` 에 보인다.
- DNS 결과 검사도 같은 판정을 쓴다. 해석기는 mapped 주소를 점 표기(`::ffff:127.0.0.1`)로 돌려줄 수 있지만, 판정 함수가 점 표기와 16진 표기를 같은 정규화로 읽으므로 판정 결과는 같다. 이 결정 때 검사는 `dns.resolve4` · `dns.resolve6` 를 썼고 2026-11-06 에 `dns.lookup` 으로 바뀌었다.
- IPv4-compatible · SIIT · NAT64 표기도 같은 방식으로 본다. 통합 노드 가드는 이 셋을 막지 않는다. 그 코드 주석은 macOS · `node:24-alpine` 실측에서 이 표기로 IPv4 대상에 닿지 않았다고 적는다. 그러나 NAT64 는 `64:ff9b::a.b.c.d` 를 IPv4 `a.b.c.d` 로 바꿔 보내는 변환이다(RFC 6052 · RFC 6146). NAT64 게이트웨이가 있는 IPv6 전용 망에 배포하면 닿을 수 있다. 품은 IPv4 가 사설 · 특수 대역일 때만 막으므로 공인 주소로 가는 수신 서버는 영향이 없다.
- 이 결정 때는 6to4(`2002::/16`)와 NAT64 local-use prefix(`64:ff9b:1::/48`)를 판정하지 않았다. 6to4 주소로 보낸 패킷은 그 IPv4 의 6to4 라우터가 받아 뒤쪽 IPv6 망으로 넘긴다. 품은 IPv4 의 TCP 서비스로는 가지 않는다. local-use prefix 는 운영자가 접두 길이를 정한다(RFC 8215). 그래서 IPv4 가 놓이는 자리가 망마다 다르다. 마지막 32비트를 읽으면 엉뚱한 IPv4 로 판정하게 된다. 2026-11-12 에 두 대역을 막기로 바꿨다([특수 용도 대역 · 6to4 · NAT64 local-use prefix 를 막는다](#특수-용도-대역--6to4--nat64-local-use-prefix-를-막는다-2026-11-12)).
- [외부 MCP 서버 URL 검사](../CLE-INT/CLE-INT-MCP.md#자격-증명과-url-검증)도 같은 정규화 · 추출 헬퍼를 쓰고 판정 범위가 같다. 꺼낸 IPv4 를 판정하는 대역표는 가드마다 따로 있다. 2026-11-12 부터는 알림 웹훅 가드가 더 넓게 막는다. 두 가드를 맞추는 일은 NERV Task `CLE-T-753725` 가 맡는다.
- 알림 웹훅 · MCP 가드와 통합 노드 · LLM 가드의 판정 범위를 맞출지, 공용 가드를 어디에 둘지는 NERV Task `CLE-T-63RSH6` 가 정한다. 정하면 그 결정과 실측을 [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) Rationale 과 [통합 노드 공통 「사설망 차단」](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#사설망-차단)에 남긴다. 판정 코드를 한 모듈로 모으는 일은 NERV Task `CLE-T-753725` 가 맡는다. 공용 판정을 쓰더라도 통합 노드의 `ALLOW_PRIVATE_HOST_TARGETS` 는 알림 웹훅 가드에 닿지 않는다. 알림 웹훅의 호스트 검사에는 우회 플래그가 없다. `ALLOW_HTTP_HOOKS` 는 `http://` 스킴만 연다.

기각한 대안:

- **IPv4-mapped 만 판정한다(통합 노드 가드 코드와 같은 범위)**: 구현 착수 전 일관성 검토가 이 범위를 제안했다. 두 가드가 같은 범위를 쓰면 보안 범위가 한 가지로 남는다. 그러나 NAT64 망에서는 IPv4-mapped 가 아닌 표기로도 사설 IPv4 에 닿을 수 있다. 사설 IPv4 를 품은 경우만 막아서 정상 수신 서버가 잃는 것이 없다. 외부 MCP 서버 URL 검사도 같은 범위를 쓴다.

### SSRF 방지 본문을 구현에 맞춘다 (2026-11-05)

[SSRF 방지](#ssrf-방지) 와 해당 요구사항을 지금 구현에 맞췄다. NERV Task `CLE-T-YR4EK5` 에서 사람이 정했다. 그 전 문장과 구현은 두 군데가 달랐다.

- 첫 불릿과 요구사항은 호스트 이름이 사설 IP 로 풀리면 등록 때와 보내기 직전에 거부한다고 읽혔다. 구현(`checkSsrfSafeUrl`)은 DNS 를 풀지 않고 URL 의 호스트 문자열(IP 리터럴 · `localhost` · `0.0.0.0`)만 본다.
- DNS rebinding 불릿은 등록 때 IP 와 발송 때 IP 가 다르면 거부한다고 적었다. 구현(`checkResolvedHostIp`)은 발송 직전에 푼 IP 가 사설 대역인지만 본다. 등록 때 IP 를 저장하지 않는다.

이 결정 때 DNS 결과 검사의 기본값은 꺼짐이었다. 그래서 사설 IP 로 풀리는 호스트 이름은 두 검사를 모두 지났다. [통합 노드](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#사설망-차단)와 [LLM 연결](../CLE-AI/CLE-AI-LLM.md)은 호스트 이름을 DNS 로 푼 뒤 다시 검사한다.

기각한 대안:

- **스펙대로 구현을 고친다(등록 · 발송 직전 모두 DNS 를 풀어 판정)**: 이 Task 는 스펙을 정리하는 일이라 코드를 바꾸지 않았다. 운영에서 DNS 결과 검사를 기본으로 켜는 안은 후속 NERV Task `CLE-T-M1P83C` 로 넘겼다.
- **등록 때 IP 를 저장해 발송 때와 비교한다**: 원래 문장이 약속한 방식이다. 등록 때 IP 를 보관해야 해서 비용이 크다. 발송 때 IP 가 사설 대역인지만 봐도 등록 뒤 사설 대역으로 바뀐 DNS 응답은 막힌다.

### 거부가 어떻게 보이는지 본문에 적는다 (2026-11-05)

NERV Task `CLE-T-5BZ3M2` 가 발행 중인 `INVALID_NOTIFICATION_URL` 을 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#64-유효성-검증) §6.4 에 올렸다. 이 문서는 등록할 때와 보내기 직전에 거부한다고만 적고 그 거부가 호출자와 운영자에게 어떻게 보이는지는 적지 않았다. 그래서 요구사항과 [SSRF 방지](#ssrf-방지) 에 등록 거부의 HTTP 상태 · 코드와 보내기 직전 거부의 결과를 적었다. 동작은 바꾸지 않았다.

보내기 직전 거부를 재시도하지 않는 것도 지금 구현 그대로다. 발송 처리기(`NotificationWebhookProcessor`)는 검사에 걸리면 발송 건강도를 `degraded` 로 바꾸고 작업을 정상으로 끝낸다. 작업이 실패로 끝나지 않으므로 큐가 다시 시도하지 않는다. URL 검사는 등록 URL 만 보고 판정하므로 같은 URL 로 다시 시도해도 결과가 같다. 3xx 를 다른 실패처럼 재시도하는 결정([리다이렉트를 따라가지 않는다](CLE-EIA-NOTIFY-DELIVERY.md#알림-웹훅-발송은-리다이렉트를-따라가지-않는다-2026-10-18))과 다른 것도 이 때문이다. 3xx 는 받는 서버의 응답이라 다음 시도에서 달라질 수 있다. DNS 결과 검사도 같은 처리를 따른다. 사설 대역으로 풀린 호스트에는 보내지 않는 것이 그 검사의 목적이다. 다음 이벤트의 알림 웹훅은 처음부터 다시 검사하므로 사용자가 URL 을 고치면 그 뒤 알림 웹훅부터 나간다.

기각한 대안:

- **보내기 직전 거부에도 에러 코드를 남긴다**: `notification_last_error` 는 사유 문장 하나만 담고 마지막 시도 실패와 폭주도 같은 필드를 쓴다. 코드를 따로 담으려면 저장 형식과 트리거 REST 응답이 바뀐다. 카탈로그에 올리는 일만 하는 그 Task 의 범위를 넘는다.

### 운영 환경에서 DNS 결과 검사를 기본으로 켠다 (2026-11-06)

NERV Task `CLE-T-M1P83C` 의 변경이다. [SSRF 방지](#ssrf-방지) 의 DNS 결과 검사와 해당 요구사항을 바꿨다. 2026-11-05 결정은 기본값을 꺼짐으로 둔 채 본문을 구현에 맞췄다. 이번 변경은 그 기본값을 운영 환경에서 켜짐으로 바꾸고, 검사 함수도 `dns.resolve4` · `dns.resolve6` 에서 `dns.lookup` 으로 바꿨다.

- **켜는 이유**: 기본이 꺼짐이면 사설 IP 로 풀리는 호스트 이름이 등록 검사와 발송 직전 검사를 모두 지난다. 내부 DNS 이름이나 공개 DNS 에 사설 IP 를 올린 이름이 그렇다. 그러면 서명한 알림 웹훅 본문이 내부망 주소로 나간다. [통합 노드](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#사설망-차단) 와 [LLM 연결](../CLE-AI/CLE-AI-LLM.md) 은 이미 호스트 이름을 풀어 다시 검사한다.
- **비용 측정**(2026-11-06, Node 26, 호스트 이름 넷 × 20회): 공개 호스트 셋(`example.com` · `hooks.slack.com` · `api.github.com`)과 없는 이름 하나를 풀었다.
  - macOS 개발 장비: 예전 방식(`resolve4` 뒤 `resolve6`)은 이름별 중앙값 8.4~76.2ms, 최댓값 620.5ms(없는 이름)였다. `lookup` 은 중앙값 1.7~2.6ms, 최댓값 38.0ms 였다.
  - Linux 컨테이너(`node:26-alpine`, Docker Desktop): 예전 방식은 중앙값 0.9~2.3ms, 최댓값 41.5ms 였다. `lookup` 은 중앙값 0.7~1.5ms, 최댓값 2.8ms 였다.
  - 발송 제한 시간 10초에 견주면 작다. 측정은 개발 장비의 해석기 기준이다. 운영 클러스터는 `ndots` 와 검색 도메인 때문에 질의가 더 늘 수 있다.
- **`lookup` 으로 바꾼 이유**: `resolve4` · `resolve6` 는 네트워크 DNS 에만 묻고 `/etc/hosts` 와 OS 검색 도메인을 보지 않는다. `fetch` 는 `lookup`(getaddrinfo)으로 연결한다. 그래서 검사와 연결이 다른 답을 볼 수 있었다. Linux 컨테이너에서 자기 호스트 이름(`/etc/hosts` 의 172.17.0.2)을 풀자 `resolve4` · `resolve6` 는 `ENOTFOUND` · `ENODATA` 로 실패해 검사를 통과시켰고, `lookup` 은 사설 IP 를 돌려줘 막았다. 질의도 둘에서 하나로 준다. 통합 노드 가드(`assertSafeOutboundHostResolved`)도 `lookup` 을 쓴다.
- **조회 실패는 통과시킨다**: 검사와 발송이 같은 해석기를 쓰므로 조회가 실패하면 발송도 대개 연결 전에 실패하고 재시도된다. 실패를 거부로 보면 일시적인 DNS 장애가 바로 `degraded` 와 알림 웹훅 유실이 된다. [거부가 어떻게 보이는지 본문에 적는다](#거부가-어떻게-보이는지-본문에-적는다-2026-11-05) 에서 정한 대로 검사 거부는 재시도하지 않기 때문이다. 통합 노드 가드도 조회 실패를 통과시킨다.
- **조회는 3초까지만 기다린다**: 해석기가 느리면 발송 작업이 HTTP 제한 시간(10초) 밖에서 조회에 묶인다. 위 측정의 최댓값(38.0ms)보다 훨씬 긴 3초를 넘기면 조회 실패와 같이 통과시킨다. 다만 실패와 달리 시간 초과는 연결 때 답이 와서 발송이 나갈 수 있다. 검사 없이 나간 발송을 운영자가 볼 수 있게 경고 로그를 남긴다. 시간을 넘긴 `getaddrinfo` 는 끝날 때까지 libuv 스레드풀 자리를 잡는다. 이 점은 검사와 연결의 조회를 하나로 합치는 주소 고정 후속(`CLE-T-GAQCF9`)에서 다룬다.
- **끄는 값은 `0` 하나다**: 운영에서 `1` 이 아닌 값을 모두 꺼짐으로 보면 오타나 빈 값이 방어를 끈다. 켜짐을 기본으로 두고 정확히 `0` 일 때만 끄면 잘못 쓴 값은 켜짐으로 남는다.
- **운영에서 끄는 길을 남긴다**: 사설 IP 로 풀리는 내부 수신기에 알림 웹훅을 보내야 하는 자체 설치 배포가 있다. 정당한 용도가 있어 기동을 막지 않는다. 대신 `main.ts` 가 기동할 때 `[SECURITY]` 경고 로그를 남긴다. 통합 노드의 `ALLOW_PRIVATE_HOST_TARGETS` 와 같은 방식이다. 그래서 [운영 환경 가드](../CLE-ACCT/CLE-ACCT-SESSION.md#운영-환경-가드) 에 넣지 않았다.
- **운영 밖은 꺼 둔다**: e2e 는 Docker 내장 DNS 가 사설 IP 로 푸는 컨테이너 이름으로 알림 웹훅 수신기에 보낸다(`notification-webhook-redirect.e2e-spec.ts`). 개발 환경도 비슷하다. 운영 밖에서 켜려면 `1` 을 준다.
- **남은 위험**: 검사한 IP 로 연결을 고정하지 않으므로 검사와 연결 사이에 DNS 응답이 바뀌면(TTL 0 rebinding) 막지 못한다. 권한 DNS 를 쥔 공격자가 검사 때는 조회 실패를, 연결 때는 내부 주소를 돌려주는 변형도 남는다. 검사 때 답을 3초 넘게 늦추는 변형도 같다. 고정하려면 `fetch` 의 연결 계층을 바꿔야 해서 후속 NERV Task `CLE-T-GAQCF9` 로 넘겼다. 외부 MCP · HTTP Request 노드의 같은 작업은 `CLE-T-BS1WD1` 이다.

기각한 대안:

- **등록 때도 DNS 를 풀어 거부한다**: 등록 때 받은 답은 발송 때 다시 바뀔 수 있어 발송 직전 검사를 대신하지 못한다. 트리거 생성 · 수정 API 가 외부 DNS 의 가용성과 지연에 묶이고, 같은 URL 의 등록 결과가 시점마다 달라진다. 발송 직전 검사가 시도마다 보므로 등록 검사는 문자열 검사로 둔다.
- **예전 방식(`resolve4` · `resolve6`)을 그대로 켠다**: 위 측정처럼 질의가 둘이라 느리고, `/etc/hosts` 를 보지 않아 `fetch` 와 다른 답을 본다.
- **운영에서 끄는 길을 없앤다**: 자체 설치 배포가 내부 수신기에 알림 웹훅을 보낼 수 없게 된다.
- **조회 실패를 거부로 본다(fail-closed)**: 위 「조회 실패는 통과시킨다」 를 보라. 연결을 고정하는 후속 작업에서 함께 다시 정한다.
- **시간 초과를 거부로 본다**: 느린 해석기가 일시적으로 늦어도 바로 `degraded` 와 알림 웹훅 유실이 된다. 조회 실패를 통과시키는 것과 같은 이유로 통과시키고 경고 로그로 남긴다.
- **제한 시간 없이 기다린다**: 해석기가 멈추면 발송 작업이 HTTP 제한 시간과 상관없이 끝나지 않는다.

### 특수 용도 대역 · 6to4 · NAT64 local-use prefix 를 막는다 (2026-11-12)

NERV Task `CLE-T-W95HND` 에서 알림 웹훅 가드(`ssrf-safe-url.util.ts`)의 차단 대역을 넓혔다. 6to4 와 NAT64 local-use prefix 를 어떻게 막을지는 NERV 질문 `01a1d020-ca83-7514-99d7-493572d58129` 에서 사람이 정했다.

- IPv4 192.0.0.0/24(IETF 프로토콜 할당), 198.18.0.0/15(벤치마크), 224.0.0.0/4(멀티캐스트), 240.0.0.0/4(예약 · 브로드캐스트)와 IPv6 fec0::/10(옛 site-local), ff00::/8(멀티캐스트)는 공인 수신 서버가 쓰지 않는 특수 용도 대역이다. 막아도 정상 수신 서버가 잃는 것이 없다. 192.0.0.0/24 와 fec0::/10 은 내부망 장비가 쓸 수 있다.
- 6to4 는 [2026-11-01 결정](#ipv4-를-품은-ipv6-리터럴을-품은-ipv4-로-판정한다-2026-11-01)에서 판정하지 않았다. 6to4 주소로 보낸 패킷이 품은 IPv4 의 TCP 서비스가 아니라 그 IPv4 의 6to4 라우터로 가기 때문이다. 이번에 판정하기로 바꾼 이유는 그 라우터가 내부망에 있을 수 있어서다. 품은 IPv4 가 사설 대역이면 서버가 보낸 IPv6 패킷이 IPv4 에 담겨(프로토콜 41) 내부 주소로 가고, 그 라우터 뒤의 IPv6 망에 닿을 수 있다. IPv4 자리는 둘째 · 셋째 16비트로 고정이라 잘못 읽을 일이 없다. 6to4 는 RFC 7526 이 폐기했다. 공인 IPv4 를 품은 주소는 통과시키므로 잃는 수신 서버가 거의 없다.
- NAT64 local-use prefix(`64:ff9b:1::/48`, RFC 8215)는 운영자가 접두 길이(/48 ~ /96)를 고르고 그에 따라 IPv4 자리가 달라진다(RFC 6052 §2.2). 2026-11-01 결정은 자리를 알 수 없어서 판정하지 않았다. 그러면 NAT64 local-use 를 쓰는 망에서 사설 IPv4 로 가는 경로가 열린다. 자리를 추측해 꺼내면 사설 IPv4 를 품은 주소를 공인으로 볼 수 있다. 그래서 꺼내지 않고 대역 전체를 막는다. 이 대역은 사설 NAT64 배포용이라 공인 수신 서버가 쓰지 않는다.
- MCP 가드(`mcp-client.service.ts`)는 바꾸지 않았다. MCP 는 IPv6 정규화와 마지막 32비트 추출 헬퍼만 알림 웹훅 가드와 같이 쓰고 IPv4 대역표는 따로 둔다. 이번 작업은 묶음 경계 때문에 알림 웹훅 가드만 고쳤다. 두 가드를 맞추는 일은 NERV Task `CLE-T-753725` 가 맡는다.

기각한 대안(NERV 질문 `01a1d020…` 의 다른 선택지):

- **6to4 도 대역 전체를 막는다**: 판정 코드가 단순해진다. 그러나 IPv4 자리가 고정이라 꺼내 판정할 수 있고, 공인 IPv4 를 품은 6to4 주소는 막을 이유가 없다.
- **NAT64 local-use prefix 도 마지막 32비트를 꺼내 판정한다(/96 으로 가정)**: well-known prefix 와 같은 코드로 처리된다. 그러나 /48 · /56 · /64 배포에서는 엉뚱한 IPv4 를 읽어 사설 IPv4 를 품은 주소를 통과시킬 수 있다.

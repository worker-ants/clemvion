# 테스트(Testing) 리뷰 — SSRF 가드 통합 (SMTP/HTTP/DB, IPv4-mapped IPv6 · CGNAT) 3라운드

이 diff 는 `review/code/2026/09/19/21_38_32`(1라운드) · `22_00_32`(2라운드) 두 차례 테스트 리뷰를 이미 거쳤다. 두 라운드가 지적한
WARNING 4건 — (1) IPv4-in-IPv6 대안 표기(IPv4-compatible·SIIT·NAT64·6to4) 회귀 잠금 부재, (2) `isSmtpHostBlocked` 의
`host?.trim()` 이 `undefined` 로 테스트되지 않음, (3) `canonicalIPv6` 파서-거부 폴백이 스위트 전체에서 미실행(dead-in-tests),
(4) 정규화 폴백 회귀 테스트 — 는 이번 diff 의 `http-safety.spec.ts`(173~195행)와 `smtp-host-guard.spec.ts`(79~82행)에 모두
반영되어 있음을 코드로 직접 확인했다. 본 라운드는 이 상태를 기준으로 실제 `npx jest` 실행 + 뮤테이션으로 재검증하고, 새로
발견된 갭 1건(INFO)을 추가한다.

## 발견사항

- **[INFO]** CGNAT 상한 경계(`100.127.255.255`)의 "그 바로 위는 통과해야 한다" 회귀 테스트가, 그 대역표를 소유한
  `http-safety.spec.ts` 가 아니라 소비자 쪽 `smtp-host-guard.spec.ts` 에만 있다 — 기능적 위험은 없지만 테스트 소유권이
  어긋나 있다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` — `PRIVATE_V4_RANGES` 의 CGNAT 항목
    (`// 100.64.0.0/10 (CGNAT)` 다음 줄, `[ipToInt(100, 64, 0, 0), ipToInt(100, 127, 255, 255)]`). 대응 테스트는
    `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.spec.ts` 의 `'allows the edges just outside CGNAT (대조군)'`
    (`100.63.255.255`·`100.128.0.0` 통과 단언). `http-safety.spec.ts` 의 `'public IP 는 통과'` 테스트(122~146행 부근)는
    `172.32.0.1`(172.16/12 바로 위)·`169.255.0.1`(169.254/16 바로 위) 두 대역의 상한 경계는 대조군으로 잡아 두면서 CGNAT
    (`100.64.0.0/10`) 상한 경계만 빠져 있다.
  - 상세: 뮤테이션으로 직접 확인했다 — `PRIVATE_V4_RANGES` 의 CGNAT 상한을 `ipToInt(100, 127, 255, 255)` →
    `ipToInt(100, 126, 255, 255)`(오프바이원, `100.127.255.255` 가 더 이상 안 막힘)로 바꾸고 `http-safety.spec.ts` +
    `smtp-host-guard.spec.ts` 를 함께 돌리자 `http-safety.spec.ts` 는 54개 전부 GREEN, `smtp-host-guard.spec.ts` 만
    `'blocks 100.127.255.255 (CGNAT 끝)'` 로 RED 였다(`Expected: true, Received: false`). 즉 이 경계 회귀는 지금도 실제로
    잡히긴 하지만(smtp-host-guard 가 http-safety 를 호출하는 간접 경로로), 대역표를 직접 소유한 파일의 스위트만 놓고 보면
    CGNAT 상한 경계에는 판별력이 없다 — `http-safety.spec.ts` 만 실행하는 워크플로(예: HTTP Request 노드만 건드리는 향후
    PR 의 타겟 테스트)에서는 이 경계 회귀가 조용히 통과할 수 있다. 뮤테이션 원복 확인: `cp` 로 원본 복구 후 `diff` 로
    바이트 동일 확인, 두 spec 재실행 54/54 GREEN, `git status --short` 는 본 리뷰 산출물 디렉터리(`review/code/2026/09/19/22_24_32/`)
    외 변경 없음.
  - 제안: `http-safety.spec.ts` 의 `'public IP 는 통과'`(또는 `'각 private CIDR 대표 IP 블록'`과 짝을 이루는 대조군) 목록에
    `100.127.255.255`(블록) / `100.128.0.0`(통과) 한 쌍만 추가하면, 대역표를 소유한 파일 자체가 이 경계에 대해 자기완결적
    판별력을 갖는다. 차단 사유는 아니다 — 지금도 smtp-host-guard 경유로 전수 검증되고 있다.

## 회귀 테스트 검토

- `send-email.handler.spec.ts`(`isSmtpHostBlocked` mock 경로만 `./smtp-host-guard.js` 로 교체) · `integrations.service.spec.ts`(동일 패턴)
  는 단언 내용이 그대로이고, 실제 실행(`npx jest` 4개 spec, 226 테스트)으로 GREEN 을 직접 확인했다. `EMAIL_HOST_BLOCKED` 라우팅을
  검증하는 `'routes to error port (EMAIL_HOST_BLOCKED) when the SSRF guard blocks the host'` 케이스도 그대로 통과한다.
- 삭제된 `common/utils/smtp-host-guard.{ts,spec.ts}` 를 가리키는 잔존 참조는 `codebase/` 전체에서 0건(`grep` 재확인), 옛
  `SMTP_BLOCK_PRIVATE_HOSTS` 문자열도 0건 — 두 라운드 전의 정정이 유지되고 있다.
- `http-safety.spec.ts` 의 `mockedLookup` 타입 오버로드 좁힘(1~17행)은 런타임 동작에 영향 없는 타입 전용 변경이고, 기존
  `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 관련 케이스는 그대로 유효하다.

## Mock 적절성 · 테스트 격리

- `smtp-host-guard.spec.ts` 의 `SsrfBlockedError` rethrow 테스트(`jest.isolateModules` + `jest.doMock` + `require`)는 모킹된
  `SsrfBlockedError` 클래스와 실제 `boom`(plain `Error`)이 `instanceof` 로 정확히 구분되는지를 노린다 — 실제 판정 클래스를
  그대로 가져다 쓰지 않고 격리된 모듈에서 새로 정의하므로, `instanceof` 분기가 우연히 항상 참/거짓이 되는 vacuous 위험이
  없다. `afterEach` 로 `ALLOW_PRIVATE_HOST_TARGETS` 를 원복하고 `beforeEach` 에서 `mockedLookup.mockReset()` 하는 등 테스트 간
  전역 상태 누수도 닫혀 있다.
- `smtp-host-guard.spec.ts` 는 DNS 를 모킹하지 않고 실제 `dns.lookup` 을 태우지만, 입력이 전부 IP 리터럴이라 네트워크
  질의 없이 결정적으로 반환된다는 근거를 파일 상단 주석에 명시했다(2라운드 INFO 반영 확인).

## 요약

핵심 변경(`http-safety.ts` 의 IPv4-mapped IPv6/CGNAT 판정 통합, `smtp-host-guard.ts` 의 `ssrf.util` → `http-safety` 전환)에
대한 테스트는 두 차례 리뷰 라운드를 거치며 이미 탄탄해졌다 — 이번 라운드에서 `npx jest`(226 테스트, 4개 spec)로 GREEN 을
재확인했고, 과거 라운드가 지적한 대안 표기 회귀·`undefined` host 방어·`canonicalIPv6` 폴백 dead-in-tests 는 diff 상에서
모두 반영을 확인했다. 새로 발견한 것은 CGNAT 상한 경계 회귀 테스트가 대역표 소유 파일(`http-safety.spec.ts`)이 아니라
소비자 파일(`smtp-host-guard.spec.ts`)에만 있다는 테스트-소유권 갭(INFO) 하나뿐이며, 뮤테이션으로 확인한 바 기능적으로는
지금도 간접 경로로 잡힌다. Critical·Warning 은 없다. 저장소 파일에 대한 뮤테이션은 스크래치(`mktemp -d`) 백업 →
in-place 수정 → `cp` 복원 → `diff` 바이트 동일 확인 → `git status --short` 클린 확인의 순서로 진행했고, `git checkout`/
`restore`/`stash` 는 사용하지 않았다. 최종 `git status --short` 에는 본 리뷰 산출물 디렉터리(`review/code/2026/09/19/22_24_32/`)
외 변경이 없다.

## 위험도

NONE

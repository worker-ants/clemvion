# 테스트(Testing) 리뷰 — SSRF 가드 통합 (SMTP/HTTP/DB, IPv4-mapped IPv6 · CGNAT)

## 발견사항

- **[WARNING]** `mappedIPv4` 가 의도적으로 배제한 4개 IPv4-in-IPv6 표기(IPv4-compatible `::a.b.c.d` · SIIT `::ffff:0:a.b.c.d` · NAT64 `64:ff9b::/96` · 6to4 `2002::/16`)에 대한 "여전히 통과해야 한다" 회귀 테스트가 없다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:87-92` (docblock — "IPv4 를 품는 다른 표기 … 는 같은 실측에서 닿지 않았다") / `codebase/backend/src/nodes/integration/http-request/http-safety.spec.ts:158-179` (`it.each` IPv4-mapped 블록·공인 대상 테이블 — 이 4개 표기가 목록에 없음)
  - 상세: 이 문서는 4개 표기가 "이 환경에서 실측(`EHOSTUNREACH`/`ENETUNREACH`)상 도달하지 않으므로 의도적으로 미차단" 이라는, 반증 가능한 설계 근거를 코드 주석에 못박아 뒀다(`mappedIPv4` 정규식 `^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$` 가 정확히 2그룹만 매치하도록 만든 게 그 반영). 그런데 이 네 형태가 "여전히 차단되지 않는다"(=과차단 회귀가 없다) 는 것을 잠그는 자동 테스트가 하나도 없다. 나중에 정규식을 "IPv4-mapped 계열 전체" 로 넓히는 리팩터가 들어와도(예: `::ffff:0:` prefix 도 허용하도록 완화) 지금 스위트는 그 변경을 잡아내지 못한다 — 반대로 이 네 형태가 실제로는 닿는 환경(다른 OS/커널)이 있었다는 사실이 나중에 밝혀져도 "이미 테스트가 지키고 있다" 는 착각을 줄 안전장치가 없다.
  - 제안: `it.each`에 대조군으로 `['::7f00:1', 'IPv4-compatible (deprecated)'], ['::ffff:0:7f00:1', 'SIIT'], ['64:ff9b::7f00:1', 'NAT64'], ['2002:7f00:1::', '6to4']` 4행을 추가해 `isBlockedHostname(...) === false` 를 단언한다. 설계 근거를 코드에 적었다면 그 근거를 반증할 수 있는 형태로 테스트에도 남겨야 다음 리팩터가 안전하다.

- **[WARNING]** `isSmtpHostBlocked` 의 방어적 optional-chaining 분기(`host?.trim()`)가 `undefined` 입력으로 테스트되지 않는다.
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:17-18` (`export async function isSmtpHostBlocked(host: string)` / `const trimmed = host?.trim();`) — 대응 스펙 `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.spec.ts` 는 `''`(빈 문자열)만 테스트하고 `undefined`/`null` 은 다루지 않는다.
  - 상세: 시그니처는 `host: string` 으로 옵셔널이 아니라고 선언하지만 구현은 `?.` 로 런타임 undefined 를 방어한다 — 이는 호출부(`integrations.service.ts`·`send-email.handler.ts`)가 `credentials.host as string` 처럼 타입 단언으로 넘기는, 실제로는 `Record<string, unknown>` 에서 온 미검증 값이기 때문으로 보인다. 이 방어 분기가 실제로 동작하는지(즉 TypeError 없이 `false` 를 반환하는지) 잠그는 테스트가 없으면, 누군가 리팩터 중 `?.` 를 지워도(예: "타입이 string 이니 필요 없다" 는 판단) 아무 테스트도 깨지지 않는다.
  - 제안: `it('returns false for undefined host (untyped credentials 방어)', async () => { expect(await isSmtpHostBlocked(undefined as unknown as string)).toBe(false); });` 한 줄 추가.

- **[INFO]** `http-safety.spec.ts` 의 IPv4-mapped `it.each` 테이블 일부 행은 hi==lo 대칭 주소(`a9fe:a9fe`→169.254.169.254, `808:808`→8.8.8.8)라 옥텟/그룹 순서를 뒤바꾸는 변이에 대해 판별력이 없다(뒤바꿔도 같은 값이 나옴). 단, 같은 테이블의 비대칭 행(`10.0.0.5`, `6440:1`→100.64.0.1)은 이 변이를 잡아낸다 — 표 전체로는 커버되지만 개별 행 단위로 보면 일부는 "매핑 인식 여부" 이상의 추가 신뢰도를 주지 못한다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.spec.ts:158-165` (`it.each` IPv4-mapped 블록 테이블)
  - 상세: plan(`plan/in-progress/ssrf-guard-integration-unify.md`)이 "옥텟 뒤바꿈" 뮤턴트가 RED 였다고 기록하는데, 그 판별력은 asymmetric 행(CGNAT `6440:1`)에서 나온 것으로 보인다. 대칭 행은 "매핑 검출 자체"를 테스트할 뿐이라 문제는 아니지만, 새 대조 행을 추가할 때는 비대칭 옥텟(서로 다른 hi/lo)을 우선하는 편이 판별력이 더 크다는 점을 참고할 만하다.
  - 제안: 조치 불필요(정보성). 향후 유사 표를 늘릴 때 대칭 입력만으로 채우지 않도록 유의.

- **[INFO]** `smtp-host-guard.spec.ts` 가 `node:dns/promises` 를 모킹하지 않고 실제 `lookup()` 을 호출하는 경로(비차단 리터럴 IP `8.8.8.8`, `100.63.255.255`, `100.128.0.0`)를 갖고 있다. Node 의 `dns.lookup` 은 인자가 이미 유효한 IP 리터럴이면 실제 네트워크 질의 없이 즉시 반환하므로 실질적으로 결정적이지만, 그 전제가 테스트 코드나 주석에 명시돼 있지 않다.
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.spec.ts` — `'allows the edges just outside CGNAT (대조군)'`, `'allows public IP literals (guard on, but not private)'` 테스트 (`node:dns/promises` 에 대한 `jest.mock` 이 파일 어디에도 없음)
  - 상세: `http-safety.spec.ts` 는 동일한 문제를 `jest.mock('node:dns/promises', …)` 로 명시적으로 통제하는데, 이 파일은 실제 구현(`assertSafeOutboundHostResolved` → `http-safety.ts`)을 그대로 태워 "가드 조합이 실제로 동작하는지" 를 검증하는 통합형 유닛테스트로 설계된 것으로 보인다 — 그 자체는 합리적 선택이지만, "왜 모킹하지 않아도 안전한가" 를 적어두지 않으면 다음 사람이 CI 환경에서 드물게 실패하는 것으로 오인하거나, 반대로 실제 네트워크 콜이 필요한 hostname(도메인) 케이스를 무심코 추가해 flaky 테스트를 만들 위험이 있다.
  - 제안: 파일 상단에 "리터럴 IP 입력은 `dns.lookup` 이 네트워크 질의 없이 즉시 반환하므로 모킹 없이도 결정적" 이라는 한 줄 주석 추가 권장.

## 요약

핵심 변경(`http-safety.ts` 의 IPv4-mapped IPv6 정규화·판정, `smtp-host-guard.ts` 의 `ssrf.util` → `http-safety` 전환, import 경로 재배치)에 대한 테스트는 충실하다 — 리터럴 체크(`isBlockedHostname`)와 DNS 해석 후 재검사(`assertSafeOutboundHostResolved`) 두 계층을 모두 유닛 레벨에서, 그리고 HTTP·DB·Email 세 서비스 전체를 e2e(`integration-connection-test.e2e-spec.ts` B2)로 교차 검증하며, 기존 `send-email.handler.spec.ts`/`integrations.service.spec.ts` 는 import 경로만 갱신되고 회귀 없이 그대로 유효하다. mock 은 각 계층 경계(DNS, `smtp-host-guard`, nodemailer)에서 적절히 끊었고, plan 문서에 기록된 뮤테이션 테스트(5개 전부 RED)와 타입체크 ratchet 실측 개선(197→194)도 확인된다. 다만 코드 주석이 명시한 "이 4개 IPv4-in-IPv6 대안 표기는 의도적으로 미차단" 설계 결정과 `host?.trim()` 방어 분기 두 가지는 그 주장을 잠그는 테스트가 없어 다음 리팩터에서 조용히 깨질 수 있는 지점으로, WARNING 두 건으로 남긴다. 저장소 파일은 Read/Grep 만 사용했고 어떤 뮤테이션·수정도 가하지 않았다(`git status --short` 변경 없음).

## 위험도
LOW

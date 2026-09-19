# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `SSRF_BLOCKED` 접두어 문자열로 예외 종류를 구분하는 암묵적 계약 — 매직 스트링 커플링
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:25`
    (`if (err instanceof Error && err.message.startsWith('SSRF_BLOCKED')) { return true; } throw err;`)
  - 상세: `assertSafeOutboundHostResolved`(`http-safety.ts`)가 던지는 `Error` 의 message 접두어(`'SSRF_BLOCKED: ...'`)를 문자열 비교로 판정해 "차단됨(true)"과 "그 외 오류(rethrow)"를 가른다. 두 파일 사이에 타입이나 전용 에러 클래스/코드가 아니라 **메시지 문자열의 정확한 접두어**가 유일한 계약이다. 향후 `http-safety.ts` 쪽에서 이 메시지 문구를 다듬거나(i18n, 로그 포맷 변경 등) 접두어 대소문자/구두점을 바꾸면, `smtp-host-guard.ts` 는 컴파일 타임에 아무 신호 없이 조용히 오분류(정상 차단이 "알 수 없는 오류"로 rethrow 되거나, 반대로 진짜 오류가 "차단됨"으로 삼켜짐)한다. 다행히 이 분기를 직접 검증하는 단위 테스트(`smtp-host-guard.spec.ts` "SSRF 판정이 아닌 오류는 «막힘» 으로 바꾸지 않고 그대로 던진다")가 있어 회귀 시 즉시 RED 로 드러나긴 하지만, 계약 자체가 문자열 매칭에 의존하는 설계라 근본적인 결합도는 남는다.
  - 제안: `http-safety.ts` 에 전용 에러 클래스(예: `class SsrfBlockedError extends Error`)나 판별 가능한 필드(`code: 'SSRF_BLOCKED'`)를 두고, `smtp-host-guard.ts` 는 `err instanceof SsrfBlockedError` 로 판정하도록 바꾸면 문자열 포맷 변경에 안전해진다. 지금 당장 급한 리스크는 아니므로(테스트가 가드 역할) 다음 관련 작업 시 리팩터링 후보로 남겨도 무방.

- **[INFO]** `http-safety.ts` 의 IPv4-mapped IPv6 판정 로직이 `common/utils/ssrf.util.ts` 의 기존 로직과 사실상 동일한 정규식/비트 연산을 반복
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:93-99` (`mappedIPv4`) — 비교 대상: `codebase/backend/src/common/utils/ssrf.util.ts` 의 `isPrivateHost` 내부 `mappedHex` 처리 블록 (리뷰 대상 diff 밖의 파일이라 gate 없음, 함수명으로 특정)
  - 상세: 두 파일 모두 `^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$` 형태의 정규식으로 IPv4-mapped IPv6 를 파싱해 `(hi>>8, hi&0xff, lo>>8, lo&0xff)` 로 IPv4 옥텟을 재구성하는 동일한 코드를 담고 있다. 다만 이는 이번 diff 가 새로 만든 중복이 아니라, `plan/in-progress/ssrf-guard-integration-unify.md` "비대상" 절에서 "LLM(`ssrf.util`) 쪽은 CGNAT 를 추가하면 Tailscale 등이 막힐 수 있어 제품 판단이 필요하다"며 **의도적으로 통합을 보류**한 사안이다.
  - 제안: 별도 조치 불필요 — plan 이 이미 후속 트래커 항목으로 등재했다고 명시하므로 그 결정을 그대로 따르면 된다(재작업 요청 시 오탐이 되지 않도록 기록만 남김).

## 요약

이번 변경은 SMTP·HTTP·DB 세 SSRF 가드를 `http-safety.ts` 하나로 합치면서, 이미 존재하던 IPv6 정규화(`canonicalIPv6`)·IPv4-mapped 판정(`mappedIPv4`) 로직을 짧고 단일 책임을 갖는 헬퍼 함수로 깔끔하게 분리했다. 각 함수는 왜 이렇게 판정하는지(실측 결과·닿는 표기와 안 닿는 표기 구분)를 JSDoc 에 구체적으로 남겨 다음 작업자가 재현·검증하기 쉽고, 테스트(`http-safety.spec.ts`, `smtp-host-guard.spec.ts`, e2e)도 표 형태(`it.each`)로 대역·표기 형태별 케이스를 빠짐없이 커버해 가독성과 중복 최소화 양쪽을 잘 잡았다. `smtp-host-guard.ts` 를 `common/utils` 에서 `nodes/integration/send-email` 로 옮긴 것도 역방향 의존(`common` → `nodes`)을 피하는 합리적 구조 개선이며, 실제 존재하지 않는 환경변수(`SMTP_BLOCK_PRIVATE_HOSTS`)를 가리키던 stale 주석도 이번 기회에 정정됐다. 유일하게 남는 구조적 우려는 `http-safety.ts` → `smtp-host-guard.ts` 사이의 예외 판정이 전용 타입이 아니라 에러 메시지 문자열 접두어 매칭에 의존한다는 점인데, 이를 직접 검증하는 테스트가 이미 존재해 당장의 회귀 위험은 낮다. 나머지 파일(import 경로 변경, 주석 정정, 리뷰/plan 산출물)은 기계적이거나 문서성 변경으로 유지보수성에 미치는 영향이 없다.

## 위험도
LOW

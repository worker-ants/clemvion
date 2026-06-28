# 보안(Security) 리뷰

## 발견사항

### [INFO] IP 미식별 시 rate-limit fail-open 동작 (기존 설계, 인지된 위험)
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (이번 diff 범위 외 기존 코드, `canActivate` 내 `if (!ip) return true` 분기)
- 상세: `extractClientIpFromHeaders` 가 null 을 반환하면(`X-Forwarded-For` 및 `CF-Connecting-IP` 헤더 모두 부재) Guard 는 rate-limit 없이 통과시킨다. 공격자가 두 헤더를 모두 제거하면 IP-based throttling 이 무력화된다. 이번 변경(A-1: 로컬 래퍼 제거)은 이 동작을 변경하지 않는다. 후속 plan(`webhook-public-ip-failopen-hardening.md`)에 설계 결정이 위임돼 있으며 OWASP A05:2021(보안 구성 오류)/A07:2021(인증 실패) 경계에 해당한다.
- 제안: `webhook-public-ip-failopen-hardening.md` 에 문서화된 세 가지 결정(인프라 레벨 차단, `req.socket.remoteAddress` 폴백, fail-closed 전환) 중 하나를 조기 확정할 것을 권고. 단기 완화로 `ip` 미식별 시 별도 제한적 버킷(`unknown-ip` 등) 적용 또는 글로벌 throttler 의존 명시.

### [INFO] CWE-209 마스킹 상수화 — 보안 개선 확인
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` — `UNKNOWN_ERROR_MESSAGE` / `UNHANDLED_ERROR_MESSAGE` 추가
- 상세: 비-Error throw 및 미처리 Error 케이스 모두 클라이언트에게 일반 문구만 반환하고 원문은 logger 로만 기록하는 CWE-209 방어가 이번 변경으로 더 명확히 보존된다. 매직 문자열 상수화는 실수로 원문이 노출되는 회귀를 방지하는 긍정적 변경이다. 보안 취약점 없음.

### [INFO] CF-Connecting-IP 신뢰 게이트 — 설계 적절
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` / `hooks.service.ts`
- 상세: `TRUST_CF_CONNECTING_IP` 환경변수가 설정된 경우에만 `CF-Connecting-IP` 헤더를 신뢰하는 구조가 유지된다. 기본값 off 이므로 임의 클라이언트가 `cf-connecting-ip` 헤더를 조작해도 rate-limit 우회가 불가능하다. 이번 변경(env 스냅샷/복원 패턴 통일)은 테스트 격리만 개선할 뿐 보안 동작에 영향 없음.

### [INFO] `extractClientIpFromHeaders` 직접 노출 — XFF 파싱 신뢰 경계
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L152, L260 (이번 변경으로 로컬 래퍼 제거 후 직접 호출)
- 상세: `X-Forwarded-For` 헤더의 "첫 번째 IP"를 신뢰하는 방식은 중간 프록시가 신뢰할 수 없는 경우 IP 스푸핑 여지가 있다. 그러나 이는 이번 변경이 도입한 문제가 아니며, Cloudflare CDN 앞단 배치 전제에서 설계된 구조이다(spec/5-system/1-auth.md §2.3 Rationale 2.3.B). 동작 동일, 보안 위험 변화 없음.

### [INFO] 테스트 환경변수 교체 방식(`process.env = envSnapshot`) — 프로덕션 영향 없음
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` / `public-webhook-throttle.guard.spec.ts`
- 상세: `process.env` 참조 자체를 교체하는 방식은 테스트 환경에서만 동작하며 프로덕션 코드에 영향이 없다. 대상 함수(`shouldTrustCfConnectingIp`, `extractClientIpFromHeaders`)가 매 호출 시 `process.env` 를 동적으로 읽으므로 실질 격리 실패 위험이 없음을 확인했다. 보안 위험 없음.

## 요약

이번 변경셋은 코드 정리(로컬 래퍼 제거, 오류 메시지 상수화, 인터페이스 추출)와 테스트 격리 강화가 주된 내용으로, 신규 보안 취약점을 도입하지 않는다. CWE-209 마스킹 상수화는 오히려 민감 정보 노출 회귀를 예방하는 긍정적 변경이다. 주목할 유일한 보안 관련 사항은 IP 미식별 시 rate-limit fail-open 동작이나, 이는 이번 변경이 새로 도입한 것이 아니라 기존 설계이며 `webhook-public-ip-failopen-hardening.md` 에 후속 결정이 위임돼 있다. 하드코딩된 시크릿, 인젝션 취약점, 인증/인가 우회, 안전하지 않은 암호화 알고리즘, 신규 외부 의존성 등의 보안 이슈는 발견되지 않았다.

## 위험도

NONE

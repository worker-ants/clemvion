### 발견사항

- **[INFO]** IP 미식별 시 rate-limit fail-open 정책의 보안 함의
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 라인 108 (`if (!ip) return true;`)
  - 상세: IP를 추출할 수 없는 경우 rate-limit 없이 요청을 통과시키는 fail-open 정책이 적용된다. 코드 주석에 "spec graceful degradation" 으로 설계 의도가 명시되어 있으며, 이는 인프라 레이어(trust proxy / Cloudflare 고정 IP 검증)에 XFF 신뢰를 위임하는 best-effort defense-in-depth 모델이다. 공격자가 XFF 헤더를 완전히 제거하거나 조작하여 IP 추출을 의도적으로 실패시킬 수 있다면 rate-limit을 우회하는 경로가 열린다. 단, body 크기 제한(step 3)은 IP 추출 전에 적용되므로 대용량 페이로드 DoS는 차단된다.
  - 제안: IP 추출 실패 시 fail-open 허용이 spec에 의해 명시된 의도적 동작임을 확인. 단, 인프라 수준에서 XFF 헤더 없는 요청을 차단하거나 `req.socket.remoteAddress` 폴백을 `extractClientIp`(전체 Request 객체 버전)로 확장하여 IP 미식별 케이스를 줄이는 것을 중장기적으로 고려할 수 있다.

- **[INFO]** DB 조회 실패 시 fail-open으로 인한 보안 보호 일시 해제
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 라인 73–80 (catch 블록)
  - 상세: trigger 조회 실패 시 rate-limit 및 body 크기 보호가 전량 우회된다. 이번 변경에서 로그 레벨이 `warn`에서 `error`로 상향되어 모니터링 가시성이 개선됐다(W2 주석 참고). DB 장애가 장기화되면 보호 없이 공개 webhook이 계속 수신될 수 있다. 이는 인프라 안정성 문제이며 보안 설계상 의도된 트레이드오프이다.
  - 제안: `error` 레벨 로깅으로 조기 탐지 가능성이 확보됐다. 추가적으로 연속 조회 실패가 일정 횟수 이상이면 서킷브레이커 패턴으로 요청 자체를 거부하는 옵션을 고려할 수 있으나, 이는 spec 정책 결정 사안이다.

- **[INFO]** 에러 메시지 정보 노출 차단(CWE-209) 개선 확인
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` 라인 302–309 (`mapHttpErrorLike` 메서드)
  - 상세: 이번 변경에서 http-errors(body-parser 등 미들웨어)가 설정한 내부 메시지(`exception.message`, 예: "request entity too large")를 클라이언트에 그대로 반환하던 코드가 삭제되고, 상태 코드 기반 일반 문구(`'Request payload too large.'` 또는 `'The request could not be processed.'`)만 반환하도록 수정됐다. 원본 메시지는 `logger.warn`을 통해 서버 측 로그에만 남기도록 설계되어 CWE-209(에러를 통한 민감 정보 노출)를 명시적으로 차단한다. 테스트 파일(파일 1)에서 이를 검증하는 어서션이 추가된 것도 긍정적이다.
  - 제안: 현재 구현이 올바르다. 추가 조치 불필요.

- **[INFO]** extractClientIp 공유 코어 통합으로 구현 사본 드리프트 제거
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 라인 105–107 및 기존 `extractClientIp` 로컬 함수 제거
  - 상세: `PublicWebhookThrottleGuard` 에 있던 로컬 `extractClientIp` 래퍼 함수가 삭제되고 `auth/utils/client-ip` 의 `extractClientIpFromHeaders` 공유 코어를 직접 호출하도록 변경됐다. 이로써 IP 추출 로직 사본이 하나로 통합되어 향후 보안 픽스(예: IPv6 정규화, 새로운 헤더 지원)가 단일 위치에만 적용하면 되는 구조가 됐다. 코드 중복에 의한 보안 드리프트 위험이 제거된 긍정적 변경이다.
  - 제안: 현재 구현이 올바르다.

- **[INFO]** TRUST_CF_CONNECTING_IP 기본값 fail-safe(off) 검증
  - 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` 신규 테스트 케이스
  - 상세: CF-Connecting-IP 헤더는 신뢰할 수 있는 Cloudflare 환경에서만 의미가 있으며, 그렇지 않으면 공격자가 이 헤더를 조작해 IP 위장이 가능하다. `TRUST_CF_CONNECTING_IP`가 기본 off인 fail-safe 설계가 spec 주석과 테스트 모두에서 검증된다. 이번에 추가된 테스트(빈 문자열/공백 cf-connecting-ip → XFF 폴백, 공백만 있는 XFF → null)가 엣지 케이스 커버리지를 보강한다.
  - 제안: 현재 구현이 올바르다.

- **[INFO]** 공개 webhook trigger 조회 시 full entity 로드 (partial select 버그 회귀 가드)
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` 라인 723–733 ("trigger 조회는 partial `select` 없이 full entity 로 한다" 테스트)
  - 상세: 과거 `select: { authConfigId: true }` partial projection이 TypeORM에서 `authConfigId: null`을 비-null로 오반환해 모든 공개 webhook을 인증 webhook으로 오판, 체크 전량 우회 버그가 있었다. 현재 full entity 로드로 수정됐으며 이 보안 회귀 가드 테스트가 추가되어 향후 select 재도입을 명시적으로 차단한다. 이는 OWASP A01(접근 제어 실패) 카테고리 버그의 정확한 탐지 및 수정이다.
  - 제안: 현재 구현이 올바르다. 테스트 커버리지가 적절하다.

- **[INFO]** measureBodyBytes 직렬화 불가 시 보수적 차단(W6) 검증
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` 라인 889–896
  - 상세: 순환 참조 등으로 JSON.stringify가 실패하는 body에 대해 `maxBodyBytes + 1`을 반환해 차단하는 보수적 정책이 테스트로 검증된다. 크기 미상 payload가 통과되는 상황을 방지하는 올바른 보안 설계다.
  - 제안: 현재 구현이 올바르다.

---

### 요약

이번 변경 세트는 전반적으로 보안 수준을 향상시키는 방향의 코드이다. 핵심 개선 사항은 세 가지다. 첫째, http-errors 미들웨어(body-parser 등)의 내부 메시지를 클라이언트에 에코하던 CWE-209 취약점이 상태 코드 기반 일반 문구 반환으로 수정됐으며 테스트로 검증된다. 둘째, IP 추출 로직이 `auth/utils/client-ip` 단일 구현으로 통합돼 사본 드리프트 위험이 제거됐다. 셋째, trigger 조회 실패 시 fail-open 로그 레벨이 `warn`에서 `error`로 상향되어 DB 장애에 의한 보호 우회 지속을 모니터링으로 조기 탐지할 수 있게 됐다. 발견된 모든 항목은 설계 의도가 명확히 문서화되어 있고 테스트로 검증된 INFO 수준이며, 즉각적인 코드 변경이 필요한 취약점은 없다. 일관성 검토 파일(파일 6–13)은 spec 문서이며 직접적인 런타임 보안 취약점을 내포하지 않는다.

### 위험도

NONE

STATUS: PASS

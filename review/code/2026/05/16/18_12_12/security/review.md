# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** 감사 로그 실패가 사용자에게 노출되지 않도록 best-effort 처리 — 보안 감사 로그 누락 가능성
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `create()` 메서드 내 두 번째 try/catch 블록 (L545–L143 diff 기준)
  - 상세: `auditLogsService.record` 호출 실패 시 `logger.warn` 으로만 기록하고 예외를 삼킨다. 이는 integration row 가 DB에 commit 된 상태에서 사용자에게 500을 반환하지 않도록 하는 의도된 설계이나, 감사 로그가 보안 규정 준수(compliance) 목적으로 의무적으로 기록되어야 하는 경우 무음 실패(silent failure)가 감사 추적의 공백을 만든다. 현재 코드는 warn 로그만 남기므로 모니터링 알럿이 없으면 audit 누락이 장기간 감지되지 않을 수 있다.
  - 제안: best-effort 정책이 명시적으로 spec에 기록되어 있으므로 현 구현은 의도에 부합한다. 다만, 감사 로그 실패를 전용 메트릭/알럿(예: Prometheus counter, Sentry 이벤트)으로 계측해 운영 가시성을 확보하는 것을 권장한다. 향후 audit log가 compliance-critical 요건으로 격상되면 트랜잭션 묶음 또는 outbox 패턴 재검토 필요.

- **[INFO]** warn 로그에 integration ID가 포함됨 — 내부 식별자 노출 범위 검토
  - 위치: `backend/src/modules/integrations/integrations.service.ts` L139 diff (warn 메시지: `id=${saved.id}`)
  - 상세: `logger.warn` 메시지에 `saved.id` 가 포함된다. NestJS Logger는 기본적으로 서버 콘솔/로그 집계 시스템으로만 출력되며 HTTP 응답 본문에는 포함되지 않으므로, 외부 사용자에게 직접 노출되는 경로는 없다. 단, 로그 집계 도구(ELK, Datadog 등)의 접근 제어가 미흡할 경우 내부 리소스 ID가 불필요하게 노출될 수 있다.
  - 제안: 현 수준에서 즉각적인 위험은 없다. 로그 집계 시스템의 접근 제어(RBAC)를 정기적으로 검토하고, 민감 정보(credential 값 등)가 로그에 포함되지 않는지 확인한다.

- **[INFO]** 프론트엔드 postMessage 핸들러의 origin 검증
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` L1489 (`if (event.origin !== window.location.origin) return;`)
  - 상세: OAuth 콜백 팝업으로부터 수신하는 `postMessage` 이벤트에 대해 `event.origin !== window.location.origin` 검사가 이미 적용되어 있다. 이 패턴은 Same-Origin Policy 검증의 올바른 방법이며 Cross-Origin 메시지 인젝션을 방지한다.
  - 제안: 현재 구현이 적절하다. 추가로 `event.source` 가 본인이 직접 열었던 팝업(`popupRef.current`)과 일치하는지 검증하면 동일 origin의 다른 탭/창에서 보낸 메시지도 거를 수 있어 방어 심도가 높아진다.

- **[INFO]** 프라이빗 앱 client_secret 입력 필드 — 평문 전송 방지 구성 확인
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` L2172 (`<Input type="password" autoComplete="new-password" ... />`)
  - 상세: `client_secret` 입력에 `type="password"` 와 `autoComplete="new-password"` 가 적용되어 있어 브라우저가 값을 마스킹하고 자동완성 저장을 억제한다. 전송 계층(HTTPS)에서의 암호화는 인프라 설정 의존이므로 코드 자체에서는 확인 불가하나, 입력 필드 수준의 처리는 적절하다.
  - 제안: 배포 인프라에서 HTTPS(TLS 1.2+)가 강제 적용되는지 확인한다. HSTS 헤더 설정도 권장한다.

- **[INFO]** mall_id 입력값 클라이언트 측 패턴 검증
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` L1590 (`/^[a-z0-9-]{3,50}$/.test(mallId)`) 및 `page.tsx` L2069 (`pattern="^[a-z0-9\-]{3,50}$"`)
  - 상세: 클라이언트에서 정규식으로 mall_id 형식을 사전 검증하고, HTML `pattern` 속성도 병행 적용하여 프론트엔드 방어선을 이중화했다. precheck 호출 전에도 동일 패턴 검사로 불필요한 API 호출을 차단한다(`useCafe24MallIdPrecheck` 훅에서 동일 정규식 적용 추정). 백엔드에도 동일한 검증이 있어 우회해도 안전하다.
  - 제안: 클라이언트·백엔드의 패턴 정규식이 일치하는지 단일 상수로 관리하거나, 스펙 문서에 canonical 패턴을 명시하여 추후 변경 시 양쪽 동기화가 누락되지 않도록 관리한다.

## 요약

이번 변경은 크게 두 가지 보안 관련 개선을 포함한다. 첫째, 백엔드의 `create()` 메서드에서 `save()`와 `auditLogsService.record()` 호출을 분리된 try/catch 블록으로 재구성하여 audit 실패가 사용자에게 500으로 노출되지 않도록 했다. 이는 의도된 best-effort 정책이지만, 감사 로그 실패가 무음으로 삼켜질 수 있으므로 운영 모니터링 계측이 권장된다. 둘째, 프론트엔드는 Cafe24 mall_id 중복 사전 감지 로직을 커스텀 훅으로 분리하고, AbortController 기반의 요청 취소와 함께 postMessage origin 검증을 적절히 유지한다. 하드코딩된 시크릿, SQL 인젝션, XSS, LDAP 인젝션, 경로 탐색, 알려진 취약 라이브러리 사용, 인증 우회 등 OWASP Top 10의 주요 항목에 해당하는 CRITICAL/WARNING 수준의 취약점은 발견되지 않았다. 권한 검증(`ForbiddenException`, `isAdmin` 체크), 입력 유효성 검사(`validateCredentials`), 에러 메시지 노출 범위 모두 적절하게 처리되고 있다.

## 위험도

LOW

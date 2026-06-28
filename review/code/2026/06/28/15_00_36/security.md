# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `GlobalExceptionFilter` — 4xx http-errors 의 `exception.message` 가 응답에 직접 노출됨
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts`, 신규 4xx 분기 (`errStatus >= 400 && errStatus < 500`) — `message = exception.message;`
  - 상세: body-parser 가 발행하는 `PayloadTooLargeError` 의 경우 메시지가 `"request entity too large"` 수준이라 현재 실질적 민감 정보 누출은 없다. 그러나 이 경로는 "http-errors 규격을 따르는 임의 4xx 에러"를 동일하게 처리한다 — 향후 프레임워크/미들웨어 업그레이드 또는 신규 미들웨어 추가 시 내부 구현 정보가 담긴 메시지가 클라이언트에 그대로 노출될 수 있다. 5xx 경로는 기존대로 `'An unexpected error occurred. Please try again later.'` 로 마스킹되나 4xx 는 마스킹 없이 원본 메시지를 사용한다.
  - 제안: 4xx http-errors 경로에서도 `getCodeFromStatus` 결과를 기반으로 고정된 범용 메시지를 사용하거나, 허용 목록에 등재된 알려진 http-error 타입(`PayloadTooLargeError` 등)에 한해서만 `exception.message` 를 채택하는 방식을 검토하라.

- **[INFO]** `hooks-body-parser.ts` — `HOOKS_MAX_BODY_BYTES` env override 상한 없음
  - 위치: `codebase/backend/src/bootstrap/hooks-body-parser.ts`, `resolveHooksMaxBodyBytes` 함수
  - 상세: 양의 유한 정수면 상한 없이 채택된다. 운영자가 실수로 극단적 값을 설정하면 서버 메모리 OOM 위험이 존재한다. 하한 검증(`> 0`)은 있으나 상한 검증이 없다. 공개 webhook 의 32KB 게이트는 `PublicWebhookThrottleGuard` 가 별도로 지키므로 인증 webhook 에만 영향을 주지만, 탈취된 인증 자격 증명으로 대형 본문 DoS 가 가능해질 수 있다.
  - 제안: 합리적인 상한(예: 16MB)을 설정하고, 초과 시 상한값으로 clamping 하거나 기본값으로 fallback 하며 경고 로그를 출력하라.

- **[INFO]** `PublicWebhookThrottleGuard` — DB 조회 실패 시 fail-open 정책으로 순간 보호 무력화
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`, catch 블록 (`return true;`)
  - 상세: `triggerRepository.findOne` 가 예외를 던질 경우 Guard 가 즉시 `return true` 로 통과시킨다. DB 장애 시 공개 webhook 의 32KB body limit 과 IP rate-limit 보호가 일시 무효화된다. 코드 주석이 의도적 결정("fail-open, 후속 HooksService 가 처리")으로 명시하고 있어 설계 의도는 명확하다. 단, 이 시나리오에서는 파서 레이어가 이미 1MB 한도로 본문을 메모리에 올린 상태에서 Guard 가 제 역할을 못하므로, 장애 지속 시 부하가 집중될 수 있다.
  - 제안: 허용 가능한 설계 결정이나, DB 오류 빈도를 알람 메트릭으로 연동하여 Guard 가 장기간 fail-open 상태로 운영되는 상황을 조기에 탐지하도록 모니터링을 보강하라.

- **[INFO]** `main.ts` — `app.use('/api/hooks', ...)` 가 prefix 하위 모든 경로에 1MB 파서 적용
  - 위치: `codebase/backend/src/main.ts`, `app.use('/api/hooks', ...createHooksBodyParsers())`
  - 상세: Express `use` 시맨틱상 `/api/hooks` 로 시작하는 모든 경로에 1MB 파서가 적용된다. `/api/hooks/:endpointPath/embed-config`(GET, 공개 위젯 allowlist 조회)도 동일 파서를 거친다. embed-config 는 GET 이므로 body 파싱 실효성이 없어 현재 위험은 없다. 그러나 향후 `/api/hooks` prefix 하위에 webhook 수신 이외의 POST 엔드포인트를 추가할 경우, 의도치 않게 1MB 한도가 적용될 수 있다.
  - 제안: 현재는 실질 위험이 없으나, 향후 해당 prefix 하위에 새 POST 엔드포인트를 추가할 때 파서 스코핑을 별도로 검토하라.

- **[INFO]** 보안 버그 수정 확인 — `PublicWebhookThrottleGuard` partial projection 교정
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
  - 상세: `findOne({ select: { authConfigId: true } })` partial projection 이 `authConfigId` 를 `null` 대신 비-null 로 잘못 반환하여 모든 공개 webhook 을 인증 webhook 으로 오판, 32KB body limit 과 IP rate-limit 보호가 전량 우회되던 pre-existing 보안 버그가 full entity load 로 교정됐다. 수정 방향은 올바르며 e2e 회귀 테스트(테스트 L: 공개 64KB → 413 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`)가 추가되어 있다.
  - 제안: 추가 조치 불필요.

## 요약

이번 변경의 핵심은 (1) 공개 webhook 보호가 전량 우회되던 partial projection 버그를 full entity load 로 교정한 보안 버그 수정, (2) 인증 webhook 에 1MB 라우트 스코프 body-parser 를 도입하면서 non-webhook 라우트의 100KB 방어선을 유지하는 설계이다. 두 변경 모두 보안 방향성이 올바르고 e2e 테스트로 회귀가 보호된다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘 등 OWASP Top 10 주요 항목에 해당하는 신규 취약점은 발견되지 않았다. 낮은 수준의 개선 가능 지점으로 `GlobalExceptionFilter` 의 4xx http-error 메시지 필터링 부재, `HOOKS_MAX_BODY_BYTES` 상한 미검증, DB fail-open 시 모니터링 보강 필요성이 식별되었다.

## 위험도

LOW

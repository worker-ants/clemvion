# 보안(Security) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[INFO]** 공개 webhook 보호 우회 버그 수정 확인 — 핵심 보안 개선
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `findOne` 쿼리 변경
- 상세: 이번 변경의 가장 중요한 보안 수정이다. 기존 `findOne({ select: { authConfigId: true } })` partial projection 이 TypeORM 버그로 `authConfigId` NULL 컬럼을 비-NULL 값으로 반환해, 모든 공개 webhook(`auth_config_id IS NULL`)이 인증 webhook 으로 오판되었다. 결과적으로 공개 webhook 에 적용돼야 할 32KB body 크기 제한과 IP 단위 rate-limit 이 전혀 적용되지 않는 심각한 보안 우회가 존재했다. full entity 로드로 교정된 것은 올바른 수정이다. 회귀 방지를 위한 단위 테스트(`select` 없이 호출됨을 단언)와 e2e L(공개 64KB → 413)이 추가돼 재발 방지가 확보됐다.
- 제안: 추가 조치 불필요. 수정이 올바르게 이루어졌으며 회귀 가드도 충분하다.

### **[INFO]** `resolveHooksMaxBodyBytes` env override 상한 클램프 — 보안 강화
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `HOOKS_MAX_BODY_BYTES_CEILING = 16 * 1024 * 1024`, `resolveHooksMaxBodyBytes`
- 상세: `HOOKS_MAX_BODY_BYTES` 환경변수가 극단적으로 큰 값으로 설정되는 운영 실수를 방지하기 위해 16MB 상한 클램프가 적용됐다. `Number.isFinite(n) && n > 0` 검사로 `0`, `-1`, `abc`, `NaN`, `Infinity` 등 유효하지 않은 값에 대한 폴백 처리가 구현돼 있고 단위 테스트가 이를 검증한다. 단, env override 가 상한에 도달했을 때 경고 로그가 출력되지 않아 운영자가 설정이 무시됐음을 인지하기 어렵다.
- 제안: `HOOKS_MAX_BODY_BYTES_CEILING` 초과 시 `this.logger.warn` 또는 `console.warn`으로 클램프 발생을 로깅 — 운영 환경에서 잘못된 env 설정이 조용히 무시되는 것을 방지. 단, 이는 심각도가 낮은 개선사항이다.

### **[INFO]** `GlobalExceptionFilter` — 4xx http-error `exception.message` 직접 응답 노출
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` — `mapHttpErrorLike` 메서드 내 `message: exception.message`
- 상세: `mapHttpErrorLike` 가 4xx http-error 의 `exception.message` 를 응답 바디에 그대로 포함한다. 현재 이 경로를 타는 http-error 발행처는 body-parser 의 `PayloadTooLargeError` 뿐이며, 그 메시지("request entity too large")는 무해하다. 그러나 향후 추가되는 http-errors 기반 미들웨어가 내부 파일 경로, 스택 트레이스, 또는 민감 정보를 메시지에 포함할 경우 클라이언트에 그대로 노출된다. 5xx 는 `'An unexpected error occurred.'` 로 마스킹되는 것과 대비된다. 이전 리뷰(RESOLUTION W5)에서 `logger.warn` 로깅이 이미 추가됐으나, 클라이언트 응답의 메시지 sanitize 는 별도 문제다.
- 제안: 현재 발행처가 body-parser 뿐인 한 실질적 위험은 낮다. 향후 http-errors 의존 미들웨어 추가 시 허용 목록(allowlist) 기반 메시지 반환을 고려. 최소한 코드 주석에 "현재 4xx 메시지를 그대로 노출함 — 발행처는 body-parser 뿐" 을 명시해 미래 기여자가 새 미들웨어 추가 시 인지하도록 할 것.

### **[INFO]** `PublicWebhookThrottleGuard` DB 조회 실패 시 fail-open 정책
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `try/catch` 블록 (Guard 내 `trigger = await this.triggerRepository.findOne(...)`)
- 상세: DB 조회 실패 시 Guard 가 `true`(통과)를 반환하는 fail-open 정책이다. 이는 가용성을 보안보다 우선하는 의도적 설계로, 코드 주석에도 명시돼 있다. 그러나 DB 가 장기간 불안정할 경우 공개 webhook 보호(32KB 제한, IP rate-limit)가 전혀 적용되지 않는 상태가 지속될 수 있다.
- 제안: 현행 유지. fail-open 은 명시적 설계 결정이고 HooksService 가 후속 처리를 담당한다. 다만 DB 오류 빈도에 대한 모니터링 알람이 없다면 장기 fail-open 상태를 탐지하기 어려우므로, 향후 모니터링 연동을 고려.

### **[INFO]** `main.ts` `/api/hooks` prefix 하드코딩 범위 — 하위 라우트 전체 1MB 적용
- 위치: `/codebase/backend/src/main.ts` — `app.use(HOOKS_ROUTE_PREFIX, ...createHooksBodyParsers())`
- 상세: `HOOKS_ROUTE_PREFIX = '/api/hooks'` prefix 스코프 body-parser 가 이 prefix 아래의 **모든** 하위 경로에 1MB 한도를 적용한다. 현재 이 prefix 하위에는 webhook 엔드포인트만 존재하나, 향후 `/api/hooks/<something>` 에 새로운 POST 엔드포인트(예: 관리 API)가 추가될 경우 의도치 않게 1MB 한도를 상속받는다. `HOOKS_ROUTE_PREFIX` 상수 export(`hooks-body-parser.ts`)로 이전 리뷰(RESOLUTION INFO17)에서 단일 진실이 확보된 점은 긍정적이다.
- 제안: 현행 유지. 현재 구조에서 실질적 위험이 없다. 다만 향후 같은 prefix 하위에 새 엔드포인트를 추가하는 개발자는 body-parser 스코핑을 별도 검토해야 함을 팀 내에 인식시킬 것.

### **[INFO]** `captureRawBody` — 전역 파서에도 rawBody 보존 적용
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `buildBodyParsers` 내 `verify: captureRawBody` (전역 파서에도 동일 적용)
- 상세: `createGlobalBodyParsers` 도 `captureRawBody` 를 `verify` 콜백으로 사용해 non-webhook 라우트의 모든 요청에서도 rawBody Buffer 가 `req.rawBody` 에 복사된다. 현재 전역 라우트에서 rawBody 를 소비하는 코드가 없다면 불필요한 메모리 복사이지만, 직접적인 보안 문제는 없다. 100KB 한도 이하이므로 Buffer 크기도 제한적이다.
- 제안: 현행 허용. non-webhook 라우트에서 rawBody 가 불필요하다면 `createGlobalBodyParsers` 에서 `verify` 를 제거해 메모리 복사를 줄일 수 있으나, 보안 영향은 없으므로 필수 수정 아님.

### **[INFO]** `HooksService.handleWebhook` — `preloadedTrigger` 신뢰 모델
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `preloadedTrigger !== undefined ? preloadedTrigger : await ...findOne(...)`
- 상세: Guard 가 `req.__publicWebhookTrigger` 에 첨부한 trigger 를 Service 가 `preloadedTrigger` 로 받아 DB 조회를 생략한다. Guard 와 Controller 가 같은 요청 컨텍스트 내에서 동작하므로 trigger 객체 신뢰는 안전하다. Guard 가 full entity 를 로드하고 Service 가 동일 쿼리(`where: { endpointPath, type: 'webhook' }`)를 사용하므로 데이터 정합성도 보장된다. `null` 전달(트리거 미존재) 시 Service 가 `NotFoundException` 을 던지는 흐름도 올바르다.
- 제안: 추가 조치 불필요.

---

## 요약

이번 변경의 핵심 보안 가치는 `PublicWebhookThrottleGuard` 의 TypeORM partial projection 버그 수정이다 — 이 버그로 인해 공개 webhook 의 32KB body 크기 제한과 IP 기반 rate-limit 보호가 전량 우회되고 있었으며, full entity 로드로 교정하고 단위 테스트 및 e2e 회귀 가드를 추가한 것은 올바른 대응이다. 나머지 변경들(1MB hooks 파서 분리, GlobalExceptionFilter 413 매핑, env override 상한 클램프)은 보안 측면에서 긍정적이거나 중립적이다. `GlobalExceptionFilter` 의 4xx `exception.message` 직접 노출은 현재 발행처가 body-parser 뿐이어서 실질적 위험이 낮지만, 미래 확장 시 sanitize 레이어 부재가 정보 노출(OWASP A05:2021 Security Misconfiguration) 경로가 될 수 있어 주의가 필요하다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘 등의 취약점은 발견되지 않았다.

---

## 위험도

LOW

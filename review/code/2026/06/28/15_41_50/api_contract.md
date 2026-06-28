# API 계약(API Contract) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### [INFO] 413 에러 코드 `PAYLOAD_TOO_LARGE` 신규 추가 — 하위 호환성 안전
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L128, `/codebase/backend/src/main.ts` setDescription
- 상세: 기존 클라이언트가 413 응답을 받던 시나리오는 없었다 — 종전에는 body-parser 413이 `GlobalExceptionFilter` 에서 500 `INTERNAL_ERROR` 로 오매핑됐다. 이번 변경은 오매핑을 교정해 `413 PAYLOAD_TOO_LARGE` 를 돌려주는 것이므로, 기존 클라이언트가 500을 기대하는 경우 동작이 달라진다. 그러나 500은 재시도 대상이고 413은 요청 수정 없이 재시도 불가이므로, 교정이 클라이언트에 더 정확한 정보를 제공한다. 기존 클라이언트가 500을 명시적으로 처리하던 코드는 오히려 개선되는 방향이다.
- 제안: 하위 호환성 파괴로 볼 수 있으나 실제로는 버그 수정이고 클라이언트 처우가 개선된다. 릴리즈 노트에 "500 → 413 변경" 을 명시해 클라이언트 팀이 인식하도록 한다.

### [INFO] `PUBLIC_WEBHOOK_BODY_TOO_LARGE` vs `PAYLOAD_TOO_LARGE` — 두 에러 코드의 의미 분리 적절
- 위치: `PublicWebhookThrottleGuard` 에서 반환하는 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` vs `GlobalExceptionFilter` 의 `PAYLOAD_TOO_LARGE`
- 상세: 공개 webhook 32KB 한도 초과는 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` (Guard 레이어), 인증 webhook 1MB 한도 초과는 `PAYLOAD_TOO_LARGE` (파서 레이어)로 코드가 다르다. 두 코드 모두 HTTP 413을 반환한다. 에러 코드가 다른 이유가 명시되지 않으면 클라이언트가 두 413을 다르게 처리해야 하는지 알기 어렵다.
- 제안: 현행 유지. 두 코드는 오류 원인이 명확히 다르므로 구분이 적절하다. `spec/5-system/12-webhook.md` 또는 `spec/5-system/2-api-convention.md` 에 두 코드의 의미와 발생 상황을 한 줄로 명시하면 클라이언트 API 문서로서 완결성이 높아진다.

### [INFO] `mapHttpErrorLike` — 4xx http-error 메시지를 응답에 직접 노출
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` `mapHttpErrorLike` 메서드 L438
- 상세: `message: exception.message` 를 응답 봉투에 그대로 포함한다. 현재 4xx http-error 발행처가 body-parser 뿐이고 메시지가 무해("request entity too large")하지만, 향후 다른 http-errors 미들웨어가 추가될 경우 내부 정보가 담긴 메시지가 API 응답에 노출될 수 있다. API 계약 관점에서 에러 `message` 필드의 내용이 일관된 형식이어야 한다.
- 제안: INFO 수준. 현재 범위에서는 허용 가능하다. 장기적으로 `getCodeFromStatus` 기반의 고정 메시지나 허용 목록 방식으로 전환 검토.

### [INFO] `HOOKS_ROUTE_PREFIX = '/api/hooks'` 상수 export — URL 경로 설계 일관성 개선
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L156
- 상세: `HOOKS_ROUTE_PREFIX` 를 export 상수로 추출하고 `main.ts` 가 이를 사용하는 것은 URL 경로의 단일 진실 원칙을 준수한다. HooksController 가 `@Controller('hooks')` + global prefix `api` 로 동일 경로를 독립적으로 정의하는 이중 정의가 존재하나, 이는 Express 미들웨어와 NestJS 라우터의 계층 분리로 인한 구조적 필요다.
- 제안: 현행 유지. 다만 hooks prefix 변경 시 두 곳(`hooks-body-parser.ts` 상수, HooksController `@Controller()` 데코레이터)을 동시에 수정해야 하므로 이 의존성을 코멘트로 명시하면 좋다.

### [INFO] `GlobalExceptionFilter` 4xx 처리 범위 — 413 외 4xx 전체 커버
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` `mapHttpErrorLike` L441 (`errStatus >= 400 && errStatus < 500`)
- 상세: 413만이 아닌 400-499 전체를 처리하도록 구현됐다. API 클라이언트가 예상치 못한 4xx http-error(예: 401, 403)를 NestJS HttpException 이 아닌 경로로 받게 될 경우, 이 경로를 통해 표준 봉투로 매핑된다. 이는 향후 확장 시 일관된 에러 응답을 보장한다는 점에서 API 계약 관점으로 긍정적이다.
- 제안: 현행 유지.

### [INFO] 응답 봉투 구조 일관성 — `error.requestId` 필드 포함 확인
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L85–96 (`errorResponse` 구성), e2e 테스트 K (L757–758)
- 상세: `413 PAYLOAD_TOO_LARGE` 응답이 `{ error: { code, message, requestId } }` 표준 봉투를 준수하는지 e2e 테스트 K 가 `res.body.error.code` 와 `res.body.error.requestId` 를 모두 단언한다. API 계약의 응답 형식 일관성이 테스트로 보장된다.
- 제안: 추가 조치 불필요.

### [INFO] 요청 검증 — body-parser 레이어 + Guard 레이어 이중 크기 검증
- 위치: `hooks-body-parser.ts` (파서 레이어) + `public-webhook-throttle.guard.ts` (Guard 레이어)
- 상세: 인증 webhook은 파서 레이어에서 1MB 초과 시 413으로 거부되고, 공개 webhook은 파서를 통과한 후 Guard에서 32KB 초과 시 413으로 거부된다. 두 레이어의 검증 순서와 임계값이 spec (WH-NF-02 옵션 C)에 명시된 설계와 일치한다. 요청 검증 충분성 측면에서 적절하다.
- 제안: 현행 유지.

### [INFO] Swagger 에러 코드 목록 갱신 확인 — `PAYLOAD_TOO_LARGE` 추가
- 위치: `/codebase/backend/src/main.ts` L495 setDescription
- 상세: Swagger 설명의 에러 코드 목록에 `PAYLOAD_TOO_LARGE` 가 정상 추가됐다. API 문서와 실제 응답 코드가 일치한다.
- 제안: 추가 조치 불필요.

---

## 요약

이번 변경은 API 계약 관점에서 긍정적인 방향의 수정이다. 핵심은 두 가지다: (1) body-parser 의 413 응답이 기존 500 `INTERNAL_ERROR` 로 오매핑되던 것을 교정해 `413 PAYLOAD_TOO_LARGE` 표준 봉투로 올바르게 반환하게 됐고, (2) 공개 webhook 32KB 보호가 실제로 동작하도록 Guard 버그를 수정했다. 두 변경 모두 API 계약의 에러 응답 형식 일관성과 HTTP 상태 코드 적절성을 개선한다. `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 `PAYLOAD_TOO_LARGE` 두 에러 코드의 의미 분리는 적절하며 spec 에 등재됐다. 하위 호환성 측면에서 413 응답이 신규로 추가되고 기존 500 오매핑이 교정됐는데, 이는 기술적으로 변경이지만 버그 수정이므로 API 계약 위반이 아니다. URL 경로 설계(`/api/hooks/*`), 응답 봉투 구조, 요청 검증 레이어 구성 모두 RESTful 원칙과 프로젝트 api-convention 규약을 준수한다. 인증/인가 엔드포인트의 보호는 기존 구조를 유지하며 Guard 버그 수정으로 오히려 강화됐다. 중요 발견사항은 모두 INFO 수준으로, blocking 이슈는 없다.

---

## 위험도

LOW

STATUS=success ISSUES=0

# Code Review 통합 보고서

## 전체 위험도
**LOW** — 구현 정확성·spec 일치도가 높고 Critical 발견 없음. WARNING 6건(보안 2·부작용 1·유지보수 1·문서화 2)은 현재 즉각 장애를 유발하지 않으나 향후 확장 시 주의가 필요한 잠재 위험이다.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `GlobalExceptionFilter.mapHttpErrorLike` — 4xx http-error 메시지 클라이언트 직접 노출 가능성. 현재 도달하는 오류는 body-parser의 `PayloadTooLargeError`(413) 하나뿐으로 무해하나, 향후 multer·passport 등 http-errors 기반 미들웨어 추가 시 내부 경로·스택 힌트가 포함된 message 가 외부 노출될 수 있다. CWE-209 해당. | `codebase/backend/src/common/filters/http-exception.filter.ts` L113 | 허용 목록 기반 클래스 검사(예: `exception.constructor.name === 'PayloadTooLargeError'`)로 신뢰된 오류 클래스만 `exception.message` 를 채택하도록 제한하거나, 미들웨어 추가 시 이 분기를 반드시 재검토할 것 |
| 2 | 보안 | `PublicWebhookThrottleGuard` — DB 장애 시 장기 fail-open 상태 탐지 수단 부재. `findOne` 예외 시 `return true`(fail-open)로 공개 webhook 의 32KB body 제한·IP rate-limit 보호가 무효화되며, 이 상태가 장시간 지속돼도 운영팀이 인지할 별도 수단이 없다. | `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L75–81 | `logger.error` 레벨 격상 또는 별도 메트릭 카운터 증가로 모니터링 알람 연동 가능하게 할 것. 연속 실패 시 fail-close 로 전환하는 circuit breaker 패턴 도입 고려 |
| 3 | 부작용 | `req.__publicWebhookTrigger` — 공유 req 객체 변이, 소비처 가정 고착화. Guard 가 미래에 다른 라우트에도 적용될 경우, 해당 Controller 가 이 필드를 읽지 않음에도 req 에 데이터가 첨부된 채 통과된다. | `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L84 | 이 Guard 를 새 라우트에 붙일 때마다 `PublicWebhookReqExtension` 소비 여부 확인 관행 수립. req 확장 패턴이 확대되면 `request-extensions.d.ts` 집계 모듈 도입 권장 |
| 4 | 유지보수성 | `extractClientIp` 함수가 Guard 파일에 export 되어 외부에서 Guard 파일을 의존 경로로 사용할 경우 모듈 경계가 오염된다. 이동 계획은 JSDoc 에 명시 추적 중이나 실행 전까지 리스크 존재. | `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L166–174 | `auth/utils/client-ip` 로 이동 리팩토링 시 Guard 파일의 공개 API 를 클래스·인터페이스로만 제한할 것. 이전까지 이 함수를 새 소비처에 추가하지 말 것 |
| 5 | 문서화 | `spec/5-system/12-webhook.md ## Rationale` 에 WH-NF-02 옵션 C 결정 근거 미기재. `bodyParser: false` 순서 의존성, `HOOKS_MAX_BODY_BYTES_CEILING` 16MiB OOM 방지 클램프 근거, 기각된 옵션 A·B 요약이 plan 에만 존재해 plan 이 `complete/` 로 이동되면 결정 추적이 소실된다. | `spec/5-system/12-webhook.md ## Rationale` | Rationale 에 "WH-NF-02 옵션 C — 분리 임계 구현" 항을 추가하고 기각 옵션 A·B 요약, `bodyParser: false` 순서 의존성, `HOOKS_MAX_BODY_BYTES_CEILING` 근거를 기록 |
| 6 | 문서화 | `spec/5-system/2-api-convention.md` 및 `3-error-handling.md ## Rationale` 에 `PAYLOAD_TOO_LARGE` 전역 표준 코드 등재 근거 미기재. `PAYLOAD_TOO_LARGE`(전역)와 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(도메인 전용)가 공존하는 이유와 구분 기준이 없어 유지보수자가 잘못된 패턴을 선택할 위험. | `spec/5-system/2-api-convention.md ## Rationale`; `spec/5-system/3-error-handling.md ## Rationale` | 각 Rationale 에 "413 `PAYLOAD_TOO_LARGE` 전역 표준 코드와 도메인 전용 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 공존 이유" 를 1~2행으로 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (핵심 수정 확인) | `PublicWebhookThrottleGuard` TypeORM partial projection 버그 수정 확인. `select: { authConfigId: true }` 제거 후 full entity 로드 전환으로, 공개 webhook의 32KB body 제한·IP rate-limit 우회 취약점이 교정됐다. e2e L 케이스가 회귀 가드로 추가됨. | `public-webhook-throttle.guard.ts` L72–74 | 추가 조치 불필요. 향후 partial select 재도입 시 TypeORM NULL 반환 동작 단위 테스트 선행 |
| 2 | 보안 | `resolveHooksMaxBodyBytes` env override 상한 클램프로 OOM 벡터 방어. 0·음수·NaN·Infinity·비숫자 등 폴백, 16MiB 상한 클램프 + 경고 로그 적절. | `hooks-body-parser.ts` L41–57 | 현행 유지 |
| 3 | 보안 | SQL 인젝션·XSS·하드코딩 시크릿 없음. TypeORM 파라미터 바인딩 사용, raw SQL 없음, 에러 응답은 `res.json()` 직렬화. | 전체 변경 대상 파일 | 없음 |
| 4 | 보안 | `captureRawBody` 가 전역 파서에도 적용되어 non-webhook 라우트 req 에도 `rawBody` 첨부. 현재 소비처 없어 즉각 위험 없으나 향후 설계 오염 가능. | `hooks-body-parser.ts` L81–83 | 중기적으로 전역 파서에서 `verify: captureRawBody` 제거, hooks 경로 전용으로 분리 |
| 5 | 보안 | `rawBody: true` 제거로 NestJS `RawBodyRequest<T>` 타입 계약이 암묵적 verify 콜백으로 대체. 런타임 동작은 동일하나 타입 계약이 암묵적. | `main.ts` L160 | 소비 코드에서 타입을 `Request & { rawBody?: Buffer }` 로 명시하면 타입 안전성 강화 |
| 6 | 보안 | X-Forwarded-For IP 추출 — rate-limit 식별에 XFF 첫 번째 IP 사용, 스푸핑 한계를 코드 주석에 명시하고 설계 결정으로 인정. | `auth/utils/client-ip.ts` L62–76 | 현행 유지 |
| 7 | 요구사항 | WH-NF-02 옵션 C 3-레이어 경계 전체 구현 확인. 1MB 라우트 스코프, 100KB 전역 방어선, 32KB Guard 계층 모두 spec 과 line-level 일치. | `hooks-body-parser.ts`, `main.ts`, `public-webhook-throttle.guard.ts` | 없음 |
| 8 | 요구사항 | 이전 리뷰(15_41_50)의 "e2e L 테스트 requestId 검증 누락" WARNING 은 오탐. L333·L351·L366 에 `requestId` 단언이 이미 존재함. | `test/webhook-trigger.e2e-spec.ts` L333 | 없음 (오탐 정정) |
| 9 | 요구사항 | `preloadedTrigger !== undefined ? preloadedTrigger : await findOne(...)` 패턴으로 null(미존재)과 undefined(미전달) 를 정확히 구분. | `hooks.service.ts` L104–109 | 없음 |
| 10 | 부작용 | `HooksService.handleWebhook` 시그니처에 `preloadedTrigger?` 선택적 파라미터 추가 — 마지막 파라미터 추가라 기존 호출부 하위 호환 유지. | `hooks.service.ts` L86 | 현행 유지 |
| 11 | 부작용 | `resolveHooksMaxBodyBytes` 내 `logger.warn` 사이드 이펙트. 단위 테스트에서 불필요한 로그 출력 발생 가능. | `hooks-body-parser.ts` L50–53 | 선택적: 단위 테스트에서 `logger.warn` spy/mock 처리 고려 |
| 12 | 유지보수성 | `hooks-body-parser.ts` 상수·순수 함수·팩토리 계층 분리 우수. JSDoc 이 spec 참조·env override 범위·순서 의존성까지 명시. | `hooks-body-parser.ts` 전체 | 현행 유지 |
| 13 | 유지보수성 | `mapHttpErrorLike` private 헬퍼 추출로 중첩 깊이 감소. `getCodeFromStatus` switch 숫자 정렬 순서 유지. | `http-exception.filter.ts` L104–117, L131–132 | 현행 유지 |
| 14 | 문서화 | `.env.example` `HOOKS_MAX_BODY_BYTES` 등재 및 `triggers.mdx` 인증 webhook 1MB 반영 이미 완료 — consistency 리뷰의 지적은 오탐. | `.env.example` L99–107; `triggers.mdx` L97 | 없음 (오탐 정정) |
| 15 | 문서화 | `spec/5-system/12-webhook.md` frontmatter `code:` 의 `hooks-body-parser.ts` 등재 여부가 두 reviewer 간 상충 — requirement(L10 등재 확인)와 documentation(미등재 지적). 직접 확인 필요. | `spec/5-system/12-webhook.md` frontmatter | 파일 직접 확인 후 미등재 시 추가 |
| 16 | 문서화 | `spec/data-flow/10-triggers.md` L98 "인증 webhook 무제한 통과" 표현에 1MB body-parser 게이트 qualifier 부재. | `spec/data-flow/10-triggers.md` L98 | "인증 webhook 은 이 Guard(IP rate-limit + 32KB 본문)를 통과하나, 본문 크기는 `/api/hooks/*` 라우트 스코프 1MB body-parser 가 별도 게이트" qualifier 추가 |
| 17 | 문서화 | `spec/7-channel-web-chat/4-security.md` §4 L143 "무제한 통과" 표현에 body size qualifier 부재. | `spec/7-channel-web-chat/4-security.md` L143 | rate-limit 맥락임을 명시하고 body 제한 별도 게이트 단서 추가 |
| 18 | 문서화 | e2e 파일 상단 JSDoc 에 본문 크기 경계 케이스(J/K/L/M/N) 미반영. | `test/webhook-trigger.e2e-spec.ts` 상단 JSDoc | 선택적: "WH-NF-02 옵션 C" 경계 케이스 목록 추가 |
| 19 | 범위 | 이번 changeset 은 규약상 경로(`review/code/**`, `review/consistency/**`)에 정확히 배치된 2차 리뷰 산출물이며 범위 일탈 없음. | `review/code/2026/06/28/15_41_50/`, `review/consistency/2026/06/28/15_41_51/` | 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | DB 장애 fail-open 탐지 수단 부재(W), 4xx 메시지 노출 가능성(W). TypeORM partial projection 버그 수정·OOM 방어 클램프·SQL 인젝션 없음 확인(I). |
| requirement | NONE | WH-NF-02 옵션 C 전체 구현 확인. 이전 리뷰 requestId 오탐 정정. 모든 spec 경계값·반환값 일치. |
| scope | NONE | 변경 파일 전체가 규약 경로에 배치. 범위 일탈 없음. |
| side_effect | LOW | req 객체 변이(`__publicWebhookTrigger`) 소비처 가정 고착화(W), GlobalExceptionFilter 4xx 범위 노출 잠재(W — security 와 중복, 통합 후 단일 계산). |
| maintainability | LOW | `extractClientIp` Guard 파일 export 모듈 경계 오염 가능(W). 나머지 설계 품질 우수. |
| documentation | LOW | Rationale 두 곳(12-webhook.md, api-convention.md/error-handling.md) 결정 근거 미기재(W×2). spec 표현 qualifier 부재(I×2). |

---

## 발견 없는 에이전트

- **requirement** — 모든 발견사항이 "이상 없음" 또는 "이전 오탐 정정"
- **scope** — 모든 발견사항이 INFO(범위 적합 확인)

---

## 권장 조치사항

1. **[문서화 W5] `spec/5-system/12-webhook.md ## Rationale`** 에 WH-NF-02 옵션 C 결정 근거 추가 — plan 이 `complete/` 로 이동되기 전에 수행. `bodyParser: false` 순서 의존성, `HOOKS_MAX_BODY_BYTES_CEILING` OOM 방지 근거, 기각된 옵션 A·B 요약 포함.
2. **[문서화 W6] `spec/5-system/2-api-convention.md` 및 `3-error-handling.md ## Rationale`** 에 `PAYLOAD_TOO_LARGE` 전역 코드와 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 도메인 코드 공존 근거 1~2행 추가.
3. **[보안 W2] `PublicWebhookThrottleGuard` DB 장애 fail-open 알람** — `logger.warn` 을 `logger.error` 로 격상하거나 별도 메트릭 카운터를 추가해 모니터링 연동 경로 확보.
4. **[보안 W1] `GlobalExceptionFilter.mapHttpErrorLike` 메시지 노출 방어** — 단기 허용 가능하나, 신규 미들웨어 추가 시 이 분기 재검토 팀 관행 수립.
5. **[유지보수 W4] `extractClientIp` 를 `auth/utils/client-ip` 로 이동** — 중기 리팩토링으로 Guard 파일 공개 API를 클래스·인터페이스로 제한.
6. **[부작용 W3] `req.__publicWebhookTrigger` 패턴 확대 방지** — 이 Guard 를 새 라우트에 적용 시 소비처 확인 팀 관행 수립. 패턴 확대 시 `request-extensions.d.ts` 도입.
7. **[문서화 INFO] `spec/data-flow/10-triggers.md` L98 및 `spec/7-channel-web-chat/4-security.md` L143** 의 "인증 webhook 무제한 통과" 표현에 1MB body-parser 게이트 qualifier 추가.
8. **[문서화 INFO] `spec/5-system/12-webhook.md` frontmatter `code:`** 에 `hooks-body-parser.ts` 등재 여부 재확인 후 미등재 시 추가 (두 reviewer 간 상충).

---

## 라우터 결정

라우터가 선별하여 실행함 (`routing=done`).

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `documentation` (6명)
- **강제 포함 (router_safety)**: `documentation`, `requirement`
- **제외** (8명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 선별 제외 |
  | architecture | 라우터 선별 제외 |
  | testing | 라우터 선별 제외 |
  | dependency | 라우터 선별 제외 |
  | database | 라우터 선별 제외 |
  | concurrency | 라우터 선별 제외 |
  | api_contract | 라우터 선별 제외 |
  | user_guide_sync | 라우터 선별 제외 |
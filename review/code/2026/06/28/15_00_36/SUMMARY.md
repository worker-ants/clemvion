# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — W14 캐시 의도 미구현(Guard → Service DB 재조회 미제거)과 `NestFactory.create rawBody: true` 제거로 인한 NestJS 타입 계약 파괴가 핵심 경고. 나머지는 LOW/INFO 수준.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견사항 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | **W14 캐시 의도 미구현 — Guard → Service DB 재조회 미제거**: Guard(`PublicWebhookThrottleGuard`)가 `req.__publicWebhookTrigger`에 full entity를 첨부하고 주석에 "HooksService가 DB 재조회 불필요(W14)"라고 명시하지만, `HooksService.handleWebhook`은 해당 필드를 읽지 않고 `triggerRepository.findOne`을 독립적으로 재수행한다. 모든 webhook 요청에서 동일 trigger row에 대한 DB 왕복이 2회 발생. WH-NF-01(200ms 이내 응답) 경로에서 불필요한 비용. | `hooks.service.ts:99` / `public-webhook-throttle.guard.ts:84` / `hooks.controller.ts` | `HooksController.receiveWebhook`에서 `req.__publicWebhookTrigger`를 꺼내 `HooksService.handleWebhook`에 선택적 파라미터(`preloadedTrigger?: Trigger | null`)로 전달하고, 서비스 내에서 `preloadedTrigger ?? await this.triggerRepository.findOne(...)` 패턴으로 단락. |
| 2 | Side Effect | **`NestFactory.create` 옵션 `rawBody: true` 제거 — NestJS `RawBodyRequest` 타입 계약 파괴**: `rawBody: true`가 `bodyParser: false`로 교체되어 NestJS 공식 `RawBodyRequest` 타입 계약이 파괴됨. 런타임 동작은 `captureRawBody`로 유지되지만, `AuthConfigsService.verifyWebhookRequest` 등 `RawBodyRequest` 타입을 소비하는 코드가 컴파일 타입 계약이 깨진 채로 동작함. 향후 개발자가 `RawBodyRequest` 타입을 신뢰해 코드를 작성할 경우 조용한 실패 위험. | `codebase/backend/src/main.ts` — `NestFactory.create(AppModule, { bodyParser: false })` | `AuthConfigsService.verifyWebhookRequest` 및 `RawBodyRequest`를 import하는 모든 코드에서 타입을 로컬 확장(`req: Request & { rawBody?: Buffer }`)으로 대체하고, `rawBody`는 `captureRawBody`가 채운다는 점을 주석으로 명시. |
| 3 | Side Effect | **`captureRawBody` — 빈 바디(`buf.length === 0`) 케이스에서 `rawBody` 미세팅**: `if (buf && buf.length)` 조건으로 빈 바디 요청 시 `rawBody`가 세팅되지 않는다. 빈 바디 HMAC 서명 요청에 대해 HMAC 검증 분기가 실패(401)할 수 있음. 기존 `rawBody: true` 방식과의 암묵적 동작 변경. | `codebase/backend/src/bootstrap/hooks-body-parser.ts` — `captureRawBody` 함수 | `if (buf) { (req as ...).rawBody = buf; }` 로 수정해 빈 바디도 `rawBody = Buffer.alloc(0)` 으로 세팅. HMAC 검증 로직이 빈 Buffer를 올바르게 처리하는지 확인 필요. |
| 4 | Performance | **Full entity 로드로 인한 불필요 컬럼 전송 증가**: Guard가 실제로 필요한 필드는 `authConfigId`뿐이지만 full entity 로드로 `notificationSecretV2`, `chatChannelTokenV2`, `config(JSONB)` 등 불필요한 컬럼까지 매 webhook 요청마다 전송됨. | `public-webhook-throttle.guard.ts:72-74` | `select`에 Guard 로직과 HooksService가 실제로 사용하는 최소 컬럼 집합 명시. 단, partial projection 재도입 전 TypeORM null 반환 버그 재현 조건을 검증한 후 적용 필요. |
| 5 | Architecture / Security | **`GlobalExceptionFilter` — http-errors 4xx 메시지 직접 노출 시 내부 정보 노출 가능성**: `exception.message`를 응답에 그대로 포함. body-parser `PayloadTooLargeError`의 메시지는 무해하나, 향후 다른 http-errors 라이브러리가 이 경로를 타면 내부 경로·스택 정보가 클라이언트에 노출될 위험. 4xx 분기에서 `this.logger.error`도 호출되지 않아 서버 로그 미생성. | `codebase/backend/src/common/filters/http-exception.filter.ts` L797–803 (4xx 분기) | 4xx http-errors 경로에서도 고정 범용 메시지 사용 또는 허용 목록에 등재된 알려진 타입만 `exception.message` 채택. 최소한 `this.logger.warn`으로 원본 메시지를 기록해 운영 가시성 확보. |
| 6 | Maintainability | **`GlobalExceptionFilter.catch` 메서드 — 중첩 깊이 3단 도달**: 신규 `errStatus >= 400 && errStatus < 500` 분기가 기존 `else if` 블록 안에 중첩되어 `HttpException` → `isUniqueViolation` → `Error` → `errStatus` 체크 → 내부 분기를 모두 추적해야 함. 향후 추가 에러 타입 처리 시 가독성 추가 저하 위험. | `codebase/backend/src/common/filters/http-exception.filter.ts` L887–912 | `errStatus` 처리를 private 헬퍼 `handleHttpErrorLike(exception: Error)`로 추출해 `catch`의 최상위 흐름을 평탄화. |
| 7 | Maintainability | **e2e 테스트 케이스 알파벳 레이블과 파일 내 배치 순서 불일치**: J, K, L이 F 앞에 삽입되어 파일 내 케이스 순서가 A→B→B2→B3→C→D→E→J→K→L→F→G→H→I가 됨. 이후 M, N 등 케이스 추가 시 혼란 가중. | `codebase/backend/test/webhook-trigger.e2e-spec.ts` — J(L1464), K(L1492), L(L1505) | 새 케이스를 알파벳 순 위치(I 이후)에 배치하거나, 레이블 체계 대신 케이스 이름 설명에만 의존하는 방식으로 전환. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `GlobalExceptionFilter` 4xx http-errors 메시지 노출 — 현재 PayloadTooLargeError는 무해 | `http-exception.filter.ts` 4xx 분기 | 향후 http-errors 의존 라이브러리 추가 시 메시지 sanitize 레이어 검토 |
| 2 | Security | `HOOKS_MAX_BODY_BYTES` env override 상한 없음 — 극단적 값 설정 시 OOM 위험 가능 | `hooks-body-parser.ts` `resolveHooksMaxBodyBytes` | 합리적인 상한(예: 16MB) 설정 및 초과 시 clamping + 경고 로그 |
| 3 | Security | `PublicWebhookThrottleGuard` DB 조회 실패 시 fail-open — 코드 주석으로 의도 명시됨 | `public-webhook-throttle.guard.ts` catch 블록 | DB 오류 빈도를 알람 메트릭으로 연동하여 장기 fail-open 상태 조기 탐지 모니터링 보강 |
| 4 | Security | `main.ts` `/api/hooks` 경로 하드코딩 — 1MB 파서가 모든 하위 경로에 적용(현재 실질 위험 없음) | `main.ts` `app.use('/api/hooks', ...)` | 향후 해당 prefix 하위 새 POST 엔드포인트 추가 시 파서 스코핑 별도 검토 |
| 5 | Security | `PublicWebhookThrottleGuard` partial projection 교정 확인 — 보안 버그 수정, e2e 회귀 테스트 추가 완료 | `public-webhook-throttle.guard.ts` | 추가 조치 불필요 |
| 6 | Performance | `createHooksBodyParsers` 기본 인자 평가 시점 — 기동 시 1회만 호출되므로 운영 영향 없음 | `hooks-body-parser.ts:62` | 필요 시 모듈 로드 시 1회 상수화 검토 |
| 7 | Performance | `captureRawBody` — non-webhook API 요청 전체에 rawBody Buffer 복사 발생 | `hooks-body-parser.ts:42-50` (전역 파서 포함) | 요청 볼륨 높을 경우 `createGlobalBodyParsers`에서 `verify: captureRawBody` 제거 검토 |
| 8 | Performance | `measureBodyBytes` — rawBody 없는 경우 `JSON.stringify` 직렬화 비용(정상 경로에서는 미발생) | `public-webhook-throttle.guard.ts:131-143` | 현재 설계에서 fallback 경로이므로 추가 조치 불필요 |
| 9 | Performance | e2e 테스트 — 512KB / 1.1MB 인라인 문자열 생성(메모리 압박 가능) | `webhook-trigger.e2e-spec.ts:1811, 1829` | 메모리 민감 CI 환경이라면 별도 파일로 분리 격리 실행 고려 |
| 10 | Performance | `spec-link-integrity` 테스트 timeout 30초 — 동기 파일시스템 스캔, 스캔 대상 증가 시 재연장 패턴 | `spec-link-integrity.test.ts:1046-1049` | 장기적으로 `findBrokenLinks` 비동기 I/O 전환 또는 incremental 스캔 검토 |
| 11 | Architecture | `hooks-body-parser.ts` bootstrap 레이어 책임 분리 적절, factory 패턴으로 테스트 가능성 확보 | `codebase/backend/src/bootstrap/hooks-body-parser.ts` | 현행 유지 |
| 12 | Architecture | `main.ts` body-parser 등록 순서 명시적 문서화 — `req._body` idempotency 가드 의존을 주석에 명시 | `main.ts` L991–996 | 라이브러리 버전 변경 시 재검증 필요하나 현행 유지 |
| 13 | Architecture | `extractClientIp` 래퍼 함수 Guard 파일 내 혼재 — 주석에 리팩토링 의도 명시됨(기술 부채 추적 중) | `public-webhook-throttle.guard.ts` | 향후 `auth/utils/client-ip` 단일 구현으로 통합 |
| 14 | Architecture | 두 레이어 413 경계(파서 레벨 + Guard 레벨) e2e J/K/L 로 충분히 검증됨 | `hooks-body-parser.ts` + `public-webhook-throttle.guard.ts` | 현행 유지 |
| 15 | Scope | `spec-link-integrity.test.ts` timeout 상향 — 목적과 무관하지만 무해, 변경 규모 1줄 | `spec-link-integrity.test.ts` | 별도 커밋 분리가 이상적이나 허용 범위 |
| 16 | Scope | `GlobalExceptionFilter` 4xx 전체 매핑 — 목표(413)보다 조금 넓지만 의도적이고 안전한 선택 | `http-exception.filter.ts` `errStatus >= 400 && errStatus < 500` | 추후 다른 http-errors 미들웨어 추가 시 팀 인식 필요 |
| 17 | Side Effect | `/api/hooks` 경로 하드코딩 — 향후 prefix 변경 시 불일치 위험 | `main.ts` | `HOOKS_ROUTE_PREFIX = '/api/hooks'` 상수를 `hooks-body-parser.ts`에 export해 단일 진실 유지 |
| 18 | Side Effect | `resolveHooksMaxBodyBytes` — ConfigService와 일관성 없는 `process.env` 직접 참조(의도된 설계) | `hooks-body-parser.ts` | 주석에 "부트스트랩 시 1회 읽힌다" 명시로 충분 |
| 19 | Maintainability | `createHooksBodyParsers`와 `createGlobalBodyParsers` 함수 본체 구조 거의 동일 — limit만 다름 | `hooks-body-parser.ts` L78–85, L95–102 | 공통 팩토리 `buildBodyParsers(maxBytes: number)` 추출 검토(현재 파일 85줄 수준이라 즉각 필수 아님) |
| 20 | Maintainability | `captureRawBody` 함수 `if (buf && buf.length)` — TypeScript 타입 기준 `buf &&` 불필요 | `hooks-body-parser.ts` L464 | `if (buf.length > 0)` 으로 단순화 |
| 21 | Maintainability | `main.ts`와 `hooks-body-parser.ts` JSDoc 설명 중복 | `main.ts` L982–996 | `main.ts` 주석을 `hooks-body-parser.ts` JSDoc 참조로 축약 |
| 22 | Maintainability | `(exception as { status?: number }).status ?? (exception as { statusCode?: number }).statusCode` 이중 캐스팅 | `http-exception.filter.ts` L894–896 | `type HttpErrorLike = { status?: number; statusCode?: number }` 타입 추출 |
| 23 | Maintainability | e2e 테스트 J 케이스 내 `100 * 1024` 매직 넘버 | `webhook-trigger.e2e-spec.ts:1479` | `GLOBAL_MAX_BODY_BYTES` import 후 상수 참조로 교체 |
| 24 | Testing | `PublicWebhookThrottleGuard` 단위 테스트 — `findOne` 호출 시 `select` 옵션 부재 assertion 미추가(e2e L로 커버됨) | `public-webhook-throttle.guard.spec.ts` | `expect(triggerRepository.findOne).toHaveBeenCalledWith(expect.not.objectContaining({ select: expect.anything() }))` 케이스 추가 검토 |
| 25 | Testing | `captureRawBody` 직접 단위 테스트 없음 — unexported 함수, e2e J로 간접 커버됨 | `hooks-body-parser.spec.ts` | export 또는 테스트 전용 named export 제공해 빈 바디 케이스 단위 테스트 추가 고려 |
| 26 | Testing | `GlobalExceptionFilter` 단위 테스트 — plain-Error-with-status(non-HttpException) 경로 직접 커버 없음 | `http-exception.filter.spec.ts` | `class FakePayloadTooLargeError extends Error { status = 413; }` mock으로 `PAYLOAD_TOO_LARGE` 매핑 검증 케이스 추가 |
| 27 | Testing | 인증 webhook 1MB 초과 시 `PAYLOAD_TOO_LARGE` 직접 검증 테스트 없음(테스트 K는 공개 webhook) | `webhook-trigger.e2e-spec.ts` | 인증 webhook 1.1MB 송신 → `413 PAYLOAD_TOO_LARGE` 검증 테스트 추가 |
| 28 | Documentation | `main.ts` Swagger `setDescription` 에러 코드 목록에 `PAYLOAD_TOO_LARGE` 미포함(spec은 이미 추가됨) | `main.ts` Swagger `setDescription` 블록 | 에러 코드 목록에 `PAYLOAD_TOO_LARGE` 추가 |
| 29 | Documentation | e2e 테스트 파일 상단 JSDoc 범위 설명이 새 케이스(J/K/L) 미반영 | `webhook-trigger.e2e-spec.ts` 파일 상단 JSDoc | 파일 상단 JSDoc에 본문 크기 경계 검증 케이스 한 줄 추가 |
| 30 | Documentation | `captureRawBody` JSDoc에 `buf && buf.length` 방어 조건의 이유 미명시 | `hooks-body-parser.ts` `captureRawBody` 함수 | 이유 한 줄 주석 추가 |
| 31 | Database | full entity 로드로 인한 쿼리 비용 증가 — W14 request-scoped 캐싱으로 완화, 인덱스 존재 시 영향 미미 | `public-webhook-throttle.guard.ts` `findOne` 호출 | 마이그레이션 파일에서 `endpoint_path` 인덱스 존재 여부 확인 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | partial projection 보안 버그 수정 확인, 4xx 메시지 노출·fail-open·상한 미검증은 INFO |
| performance | MEDIUM | W14 캐시 미연결(Guard→Service DB 2회), full entity 불필요 컬럼 로드 |
| architecture | LOW | full entity 로드 WARNING, 4xx 메시지 노출 WARNING — 현재 허용 가능 수준 |
| requirement | 파일 없음 (output_file 미생성) | — |
| scope | NONE | 13개 변경 파일 모두 의도 범위 내, 벗어난 변경 없음 |
| side_effect | LOW | rawBody: true 제거로 NestJS 타입 계약 파괴, 빈 바디 rawBody 미세팅 |
| maintainability | LOW | 중첩 깊이 3단, e2e 레이블 순서 불일치 (WARNING) |
| testing | LOW | 핵심 버그 회귀 가드는 충분, non-HttpException 경로 직접 단위 테스트 미비 |
| documentation | LOW | Swagger 에러 코드 목록 `PAYLOAD_TOO_LARGE` 누락, e2e JSDoc 미반영 |
| dependency | 파일 없음 (output_file 미생성) | — |
| database | LOW | partial projection 제거 — 올바른 수정, W14 캐싱으로 완화됨 |
| concurrency | NONE | 공유 가변 상태 없음, 경쟁 조건 없음 |
| api_contract | 파일 없음 (output_file 미생성) | — |
| user_guide_sync | 파일 없음 (output_file 미생성) | — |

## 발견 없는 에이전트

- **concurrency**: 동시성 관련 코드 없음, 위험도 NONE
- **scope**: 전체 변경 파일이 의도 범위 내, 위험도 NONE

## 권장 조치사항

1. **[W1 — Performance] W14 캐시 의도 미구현 수정**: `HooksController.receiveWebhook`에서 `req.__publicWebhookTrigger`를 꺼내 `HooksService.handleWebhook`에 `preloadedTrigger?: Trigger | null` 파라미터로 전달하고, 서비스 내부에서 `preloadedTrigger ?? await this.triggerRepository.findOne(...)` 단락 패턴 적용. WH-NF-01(200ms) 성능 요건에 직결.
2. **[W2 — Side Effect] `NestFactory.create rawBody: true` 제거 후 타입 계약 수복**: `RawBodyRequest`를 import하는 모든 코드에서 로컬 타입 확장(`req: Request & { rawBody?: Buffer }`)으로 교체하고 주석으로 `captureRawBody`가 채운다는 점 명시.
3. **[W3 — Side Effect] 빈 바디 rawBody 미세팅 수정**: `captureRawBody`의 `if (buf && buf.length)` 조건을 `if (buf)` 로 변경해 빈 바디도 `rawBody = Buffer.alloc(0)` 세팅. HMAC 검증 로직의 빈 Buffer 처리 여부 확인.
4. **[W4 — Architecture/Security] `GlobalExceptionFilter` 4xx 메시지 노출 완화**: 최소한 `this.logger.warn`으로 원본 메시지 서버 로그 기록. 향후 고정 메시지 사용 또는 허용 목록 방식 검토.
5. **[W5 — Performance] Full entity 로드 최소 컬럼 정제**: TypeORM partial projection null 반환 버그 재현 조건을 검증한 후 Guard 실제 필요 컬럼만 select. 버그 재발 방지 단위 테스트 선행 필요.
6. **[W6 — Maintainability] `GlobalExceptionFilter.catch` 중첩 깊이 개선**: `handleHttpErrorLike(exception: Error)` private 헬퍼 추출.
7. **[W7 — Maintainability] e2e 테스트 케이스 레이블 순서 정렬**: J/K/L을 I 이후로 이동하거나 레이블 체계 대신 케이스 이름 설명 의존으로 전환.
8. **[INFO — Documentation] Swagger 에러 코드 목록 `PAYLOAD_TOO_LARGE` 추가**: `main.ts` Swagger `setDescription`의 에러 코드 예시 목록 갱신.
9. **[INFO — Testing] `GlobalExceptionFilter` 단위 테스트 — plain-Error-with-status 경로 추가**: `FakePayloadTooLargeError extends Error { status = 413 }` mock 케이스 추가.
10. **[INFO — Security] `HOOKS_MAX_BODY_BYTES` 상한 검증 추가**: `resolveHooksMaxBodyBytes`에 합리적 상한(예: 16MB) clamping과 경고 로그 추가.

## 라우터 결정

라우터 미사용 — 사유: `routing=skipped`. 전체 reviewer 실행.

- **실행(ran)**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing
- **제외**: 없음
- **output_file 미생성(재시도 필요)**: requirement, dependency, api_contract, user_guide_sync (4건) — status는 `success`로 전달되었으나 실제 파일이 존재하지 않아 내용 통합 불가.
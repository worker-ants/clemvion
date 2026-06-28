# Code Review 통합 보고서

## 전체 위험도
**LOW** — 인증 webhook 1MB body 게이트(WH-NF-02 옵션 C) 및 공개 webhook 보호 우회 버그 수정이 전반적으로 올바르게 구현됨. Critical 없음. Warning 3건(테스트 requestId 누락·README 환경변수 미등재·rawBody 타입 계약 명시성)은 모두 기능 정확성에 영향 없는 개선 사항.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Testing / API Contract | e2e 테스트 케이스 L(`PUBLIC_WEBHOOK_BODY_TOO_LARGE` 413)에서 `requestId` 단언 누락. api-convention §5.3 은 "모든 에러 응답에 requestId 항상 포함"을 명시하며 케이스 K 에는 단언이 있으나 L·M·N 에는 없음. 기능 동작은 정확하지만 회귀 가드 완전성 부족. | `codebase/backend/test/webhook-trigger.e2e-spec.ts` L·M·N 케이스 | L·M·N 테스트에 `expect(res.body.error.requestId).toBeDefined()` 추가 |
| W2 | Documentation / Operations | 신규 환경 변수 `HOOKS_MAX_BODY_BYTES` 가 `README.md` 환경 변수 섹션에 미등재. 운영자가 webhook 본문 크기 상한 조정 방법을 알 수 없음. | `README.md` `## 환경 변수` Backend 섹션 | `HOOKS_MAX_BODY_BYTES=1048576` 항목 및 설명(기본 1MiB, 16MiB 상한 클램프, 공개 32KB Guard 별도 관리) 추가 |
| W3 | Side Effect / Architecture | `rawBody: true` NestJS 공식 옵션 제거로 `RawBodyRequest<T>` 타입 계약이 비공식 verify 콜백(`captureRawBody`)으로 대체됨. 런타임 동작은 동일하나 컴파일 타임 타입 보장 소멸. 향후 `RawBodyRequest` 소비처 추가 시 미설정 환경에서 회귀 위험. | `codebase/backend/src/main.ts` `NestFactory.create` 옵션, `codebase/backend/src/bootstrap/hooks-body-parser.ts` `captureRawBody` | `captureRawBody` JSDoc 에 NestJS `RawBodyRequest` 계약 대체임을 명시. 소비처(`AuthConfigsService.verifyWebhookRequest` 등)에서 `Request & { rawBody?: Buffer }` 로컬 타입 교차 명시 검토 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | Security | `GlobalExceptionFilter` — 4xx http-error 메시지(`exception.message`) 응답 직접 노출. 현재는 body-parser `PayloadTooLargeError`("request entity too large")만 해당하여 무해하나, 향후 다른 http-errors 미들웨어 추가 시 잠재 정보 노출 위험(OWASP A05). | `http-exception.filter.ts` `mapHttpErrorLike` | 향후 http-errors 의존 미들웨어 추가 시 메시지 sanitize 레이어(허용 목록 또는 상태코드별 고정 문자열) 도입 검토 |
| I2 | Security | `PublicWebhookThrottleGuard` — DB 조회 실패 시 fail-open(`return true`). 장기 DB 장애 시 공개 webhook 32KB·IP rate-limit 보호 무효화. 코드 주석에 의도적 결정으로 명시됨. | `public-webhook-throttle.guard.ts` catch 블록 | DB 오류 빈도 모니터링 알람 연동으로 fail-open 장기 지속 상태 조기 탐지 권장 |
| I3 | Security | `/api/hooks` prefix 하위 모든 경로에 1MB 파서 일괄 적용. GET 경로 등 non-webhook POST 추가 시 의도치 않은 1MB 한도 적용 가능성(현재 실질 위험 없음). | `main.ts` `app.use(HOOKS_ROUTE_PREFIX, ...)` | 향후 `/api/hooks` 하위 새 POST 엔드포인트 추가 시 파서 스코핑 별도 검토 |
| I4 | Performance | `PublicWebhookThrottleGuard` full entity 로드 전환으로 보안 버그 수정됨. Guard 목적은 `authConfigId IS NULL` 판별뿐이나 JSONB 컬럼 포함 전체 Trigger 엔티티를 로드. W14 패턴으로 동일 요청 내 중복 DB 왕복은 제거됨. | `public-webhook-throttle.guard.ts` `findOne` 호출부 | TypeORM partial projection null 버그 재현 조건 확인 후 최소 컬럼 projection 검토(실측 성능 이슈 발생 시) |
| I5 | Performance | `captureRawBody` verify 콜백이 `createGlobalBodyParsers()`에도 적용되어 non-webhook 라우트 전체 요청에 `req.rawBody` 할당. 100KB 상한·GC로 즉각 위험 없으나 불필요한 단기 메모리 압박. | `hooks-body-parser.ts` `createGlobalBodyParsers` | hooks 경로(`/api/hooks/*`)에만 `captureRawBody` 적용하고 전역 파서에는 `verify` 제거 방안 중기 검토 |
| I6 | Architecture | `PublicWebhookThrottleGuard` — trigger 조회·32KB body 제한·IP rate-limit 세 책임 혼재. `extractClientIp` 유틸이 Guard 파일에 export 돼 모듈 경계 다소 모호. plan 에 기술 부채로 명시 추적 중. | `public-webhook-throttle.guard.ts` | `extractClientIp` → `auth/utils/client-ip` 이동 리팩토링 완료 시 Guard 경계 명확해짐 |
| I7 | Database | `Trigger` 테이블 `endpoint_path` 단독 또는 `(endpoint_path, type)` 복합 인덱스 유무 미확인. full entity 로드 전환 후 webhook 트래픽 증가 시 풀 테이블 스캔 위험. | 기존 마이그레이션 파일 | 기존 마이그레이션에서 인덱스 존재 여부 검토. 부재 시 별도 마이그레이션 추가 권장 |
| I8 | Testing | `createHooksBodyParsers` / `createGlobalBodyParsers` 팩토리 함수의 `maxBytes` 실제 파서 전달 여부 단위 검증 부재. shape(배열 길이·function 타입)만 단정. | `hooks-body-parser.spec.ts` | `jest.spyOn(express, 'json')`으로 limit 인자 전달 단정 추가 또는 소형 통합 테스트(비차단) |
| I9 | Testing | `captureRawBody` unexported private 함수 — 빈 Buffer(`Buffer.alloc(0)`) 세팅 동작 단위 테스트 부재. e2e J가 정상 경로 간접 검증. | `hooks-body-parser.ts` L73, `hooks-body-parser.spec.ts` | `captureRawBody` export(또는 `@internal`) 후 단위 테스트 추가. 빈 Buffer HMAC 검증 보존 케이스 포함 |
| I10 | Testing | `resolveHooksMaxBodyBytes` — ceiling 과 정확히 같은 값 경계 케이스(`=`) 미테스트. `floored > ceiling` 조건이므로 equal 은 통과해야 하나 검증 없음. | `hooks-body-parser.spec.ts` ceiling 클램프 테스트 | `resolveHooksMaxBodyBytes({ HOOKS_MAX_BODY_BYTES: String(HOOKS_MAX_BODY_BYTES_CEILING) })`가 ceiling 그대로 반환함을 단정하는 케이스 추가 |
| I11 | Testing | `GlobalExceptionFilter` 단위 테스트 — `statusCode`-only(status 없음) 4xx http-error 케이스 미테스트. 실제 body-parser는 `status`·`statusCode` 모두 세팅하여 현실 위험 낮음. | `http-exception.filter.spec.ts` | `{ statusCode: 413 }` (status 필드 없음) 케이스 단위 테스트 추가 |
| I12 | Documentation | `captureRawBody` `if (buf)` 조건 — 빈 Buffer 허용 의도가 인라인 주석에 미명시. 후속 유지보수자가 `if (buf && buf.length)`로 "개선" 시도 가능. | `hooks-body-parser.ts` L73 | `// 빈 Buffer(length===0)도 포함 — 빈 본문 HMAC 검증 보존, buf.length 체크 재도입 금지` 인라인 주석 추가 |
| I13 | Documentation | e2e 파일 상단 JSDoc — 본문 크기 경계 케이스(J/K/L/M/N) 미반영. 파일 커버 범위 개요가 불완전. | `webhook-trigger.e2e-spec.ts` L10-20 JSDoc | 파일 상단 JSDoc에 "본문 크기 경계(WH-NF-02 옵션 C)" 카테고리 및 케이스 개요 추가 |
| I14 | Documentation | spec frontmatter `code:` 목록에 `hooks-body-parser.ts` 미등재. `http-exception.filter.ts`는 등재됨. spec-coverage 도구 오탐 가능성. | `spec/5-system/3-error-handling.md`, `spec/5-system/2-api-convention.md` frontmatter | 두 spec 파일 frontmatter `code:` 목록에 `codebase/backend/src/bootstrap/hooks-body-parser.ts` 추가(선택적) |
| I15 | API Contract | `PUBLIC_WEBHOOK_BODY_TOO_LARGE` vs `PAYLOAD_TOO_LARGE` — 두 413 에러 코드의 발생 맥락(공개 webhook Guard vs 파서 레이어) 구분이 spec 에 등재됐으나 클라이언트 대면 문서에 추가 명시 가능. | `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md` | 두 코드의 의미·발생 상황을 api-convention 또는 webhook spec 에 한 줄로 명시 권장 |
| I16 | Scope | `spec-link-integrity.test.ts` 타임아웃 5000ms → 30000ms 변경 — 이번 작업 목적과 직접 무관한 프런트엔드 테스트 수정. CI 안정성 목적으로 4줄 변경이며 기능 위험 없음. | `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` | 별도 커밋 분리가 이상적이나 규모 경미하여 현 PR 포함 허용 범위 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 공개 webhook 보호 우회 보안 버그(TypeORM partial projection) 수정 확인. 잔여 INFO: 4xx 메시지 노출 가능성·fail-open·prefix 스코핑 |
| performance | LOW | full entity 로드 전환 후 W14 패턴으로 DB 왕복 1회 유지. 전역 파서 rawBody 캡처 미미한 메모리 압박 |
| architecture | LOW | 레이어 책임 분리·W14 타입 계약 명시·두 레이어 413 설계 적절. SRP 복합 책임·4xx 메시지 노출 INFO |
| requirement | LOW | WH-NF-02 옵션 C 완전 구현·spec line-level 일치 확인. e2e L requestId 단언 누락 WARNING(W1) |
| scope | NONE | 범위 일탈 없음. spec 동기화·plan 갱신·리뷰 산출물 포함 모두 규약 필수. 타임아웃 수정 1건 INFO |
| side_effect | LOW | rawBody 타입 계약 명시성 약화(W3)·4xx 메시지 노출(I1)·전역 파서 rawBody 캡처(I5) 지적 |
| maintainability | NONE | 상수·함수 네이밍 일관·buildBodyParsers 헬퍼 추출·mapHttpErrorLike 책임 분리 우수. captureRawBody 인라인 주석 보완 INFO |
| testing | LOW | resolveHooksMaxBodyBytes 경계값·mapHttpErrorLike 4xx·e2e J/K/L/M/N 충실. 팩토리 limit 전달·빈 Buffer·ceiling equal·statusCode-only 케이스 미테스트(모두 INFO) |
| documentation | LOW | 전반 문서화 우수. e2e JSDoc 카테고리 누락·spec frontmatter hooks-body-parser.ts 미등재 INFO |
| database | LOW | partial projection 제거로 보안 수정 확인. preloadedTrigger 폴백 정확. endpoint_path 인덱스 유무 미확인 INFO |
| api_contract | LOW | 413 오매핑(500→413) 교정 긍정적. 두 에러 코드 의미 분리 적절. 모두 INFO |
| user_guide_sync | LOW | HOOKS_MAX_BODY_BYTES README 미등재 WARNING(W2). 나머지 매트릭스 trigger 해당 없음 |

---

## 발견 없는 에이전트

- **scope**: 범위 일탈 발견 없음 (NONE)
- **maintainability**: 차단·경고 수준 발견 없음 (NONE)

---

## 권장 조치사항

1. **(W1 — 필수)** e2e 테스트 L·M·N 케이스에 `expect(res.body.error.requestId).toBeDefined()` 추가 — api-convention §5.3 requestId 의무 규약 회귀 가드 완성.
2. **(W2 — 필수)** `README.md` `## 환경 변수` Backend 섹션에 `HOOKS_MAX_BODY_BYTES` 환경 변수 항목 추가 (기본 1MiB, 16MiB 상한 클램프, 공개 32KB Guard 별도 관리).
3. **(W3 — 권장)** `captureRawBody` JSDoc 및 소비처(`AuthConfigsService.verifyWebhookRequest`)에 rawBody 주입 경로(`captureRawBody` verify 콜백)를 명시하고, 소비처에서 `Request & { rawBody?: Buffer }` 타입 교차 명시 검토.
4. **(I7 — 권장)** 기존 마이그레이션 파일에서 `triggers.endpoint_path` 인덱스 유무 확인. 부재 시 `(endpoint_path, type)` 복합 인덱스 마이그레이션 추가.
5. **(I12 — 권장)** `captureRawBody` `if (buf)` 라인에 빈 Buffer 허용 의도 인라인 주석 추가 (`buf.length` 체크 재도입 금지 명시).
6. **(I5 — 중기)** `createGlobalBodyParsers()`에서 `verify: captureRawBody` 제거 — non-webhook 라우트의 불필요한 rawBody 캡처 해소.
7. **(I8/I9/I10/I11 — 비차단)** 단위 테스트 보강: 팩토리 limit 전달 검증, `captureRawBody` 빈 Buffer 케이스, ceiling equal 경계값, `statusCode`-only 4xx 케이스.
8. **(I13/I14 — 선택)** e2e 파일 JSDoc 에 본문 크기 케이스 카테고리 추가, spec frontmatter `code:` 에 `hooks-body-parser.ts` 등재.

---

## 라우터 결정

라우터가 reviewer 를 선별 실행했습니다 (`routing_status=done`).

- **실행** (12명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync
- **강제 포함 (router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
- **제외** (2명):

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | dependency | 라우터 제외 (변경 범위 내 의존성 변경 해당 없음으로 판단) |
  | concurrency | 라우터 제외 (동시성 관련 변경 해당 없음으로 판단) |
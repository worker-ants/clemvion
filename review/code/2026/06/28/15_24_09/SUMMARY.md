# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 구현 및 보안 버그 수정은 전체적으로 정확하며, Critical 발견 없음. 3건의 WARNING(아키텍처 SRP 경계, 테스트 커버리지 갭, NestJS 타입 계약 파괴)이 존재하나 즉각 차단 수준은 아님. SPEC-DRIFT 2건은 코드 변경 없이 spec 갱신만 필요.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Architecture / Side Effect | `PublicWebhookThrottleGuard` 복합 책임(SRP 경계) — trigger 조회·body 크기 검사·IP rate-limit 소비 세 책임이 한 클래스에 혼재. 도메인 응집도는 동일하나 독립 변경 이유가 존재하며, `extractClientIp` 유틸이 Guard 파일 내 export되어 모듈 경계 흐림의 징후가 있음 | `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` | 단기 허용. 중기 리팩토링 시 (1) `extractClientIp` → `auth/utils/client-ip` 이동, (2) body 크기 검사를 별도 Guard/메서드로 분리. 기술 부채 plan 등재 권장 |
| W2 | Testing | non-webhook 라우트 전역 100KB 방어선 e2e 검증 누락 — `main.ts` 전역 파서(`createGlobalBodyParsers`) 등록의 핵심 부수 효과(100KB 초과 시 413)를 검증하는 e2e 케이스가 없음. 파서 미등록 오류 시 운영 장애로 직결 가능 | `codebase/backend/test/webhook-trigger.e2e-spec.ts` (신규 케이스 없음) | non-webhook API 엔드포인트에 150KB 이상 본문 전송 시 413 반환을 검증하는 e2e 케이스 1개 추가 |
| W3 | Side Effect | `NestFactory.create`에서 `rawBody: true` 제거로 NestJS 공식 `RawBodyRequest<T>` 타입 계약 파괴 — 런타임 동작은 `captureRawBody`가 `req.rawBody`를 채우므로 정상이나, `RawBodyRequest`를 import하는 소비처(`AuthConfigsService.verifyWebhookRequest` 등)가 컴파일 타입 계약과 런타임 동작 간 불일치 상태로 동작함 | `codebase/backend/src/main.ts`, `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` | `RawBodyRequest` import 소비처에서 로컬 타입 확장(`req: Request & { rawBody?: Buffer }`)으로 대체하거나, `captureRawBody` 기반 직접 채움을 명문화한 별도 타입 선언 파일로 관리 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | SPEC-DRIFT | [SPEC-DRIFT] `HOOKS_MAX_BODY_BYTES_CEILING`(16MB) 상한 클램프가 코드에만 존재하고 spec WH-NF-02에 미기재 — 의도적 OOM 방지 보호이므로 코드 버그 아님 | `spec/5-system/12-webhook.md` WH-NF-02 | 코드 유지 + spec WH-NF-02 본문에 "`HOOKS_MAX_BODY_BYTES` env override 상한 `HOOKS_MAX_BODY_BYTES_CEILING`(기본 16MiB — OOM 방지 클램프)" 항목 추가 |
| I2 | SPEC-DRIFT | [SPEC-DRIFT] `HOOKS_ROUTE_PREFIX = '/api/hooks'` 상수 export가 코드 품질 향상으로 추가됐으나 spec에 언급 없음 | `spec/5-system/12-webhook.md` §6 구현 파일 구조 | 코드 유지 + spec §6 구현 파일 구조에 `hooks-body-parser.ts`의 `HOOKS_ROUTE_PREFIX` export 언급 추가 또는 WH-NF-02 구현 설명에 통합 |
| I3 | Security | `GlobalExceptionFilter` 4xx http-error `exception.message` 직접 응답 노출 — 현재 발행처는 body-parser 뿐이어서 실질 위험 낮음. 향후 http-errors 의존 미들웨어 추가 시 내부 정보 노출 가능성 | `codebase/backend/src/common/filters/http-exception.filter.ts` `mapHttpErrorLike` | 현행 유지. 향후 http-errors 의존 미들웨어 추가 시 허용 목록 기반 메시지 반환 또는 고정 메시지 sanitize 도입 검토. 코드 주석에 "현재 발행처는 body-parser뿐" 명시 권장 |
| I4 | Security | `PublicWebhookThrottleGuard` DB 조회 실패 시 fail-open 정책 — 의도적 설계이나 DB 장기 불안정 시 공개 webhook 보호 미적용 상태 지속 가능 | `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` try/catch | 현행 유지. 모니터링 알람 연동 검토 |
| I5 | Security | `resolveHooksMaxBodyBytes` env override 상한 도달 시 경고 로그 미출력 — 운영자가 설정 무시를 인지하기 어려움 | `codebase/backend/src/bootstrap/hooks-body-parser.ts` | `HOOKS_MAX_BODY_BYTES_CEILING` 초과 시 `console.warn`으로 클램프 발생 로깅 추가 권장 |
| I6 | Performance | Full entity 로드 전환으로 불필요 컬럼 전송 비용 증가 — TypeORM partial projection 버그 수정의 불가피한 트레이드오프. W14 캐시로 1회 제한됨 | `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` findOne | 실측 성능 문제 확인 후, 최소 컬럼만 select하는 방향 검토 (TypeORM null 처리 실측 검증 선행 필요) |
| I7 | Performance | `captureRawBody` verify 콜백이 `createGlobalBodyParsers`에도 적용 — non-webhook API 요청 전체에 rawBody Buffer 복사 발생. 100KB 한도 내에서 영향 제한적 | `codebase/backend/src/bootstrap/hooks-body-parser.ts` | 현행 허용. 요청 볼륨 증가 시 `createGlobalBodyParsers`에서 `verify` 제거 검토 |
| I8 | Testing | `resolveHooksMaxBodyBytes` 상한 클램프 경로 단위 테스트 미포함 — `HOOKS_MAX_BODY_BYTES_CEILING` 초과 입력 시 상한 반환 검증 케이스 누락 | `codebase/backend/src/bootstrap/hooks-body-parser.spec.ts` | `it('clamps oversized override to HOOKS_MAX_BODY_BYTES_CEILING')` 케이스 추가 (비차단) |
| I9 | Testing | `captureRawBody` unexported 구조로 빈 본문 케이스 직접 단위 테스트 불가 | `codebase/backend/src/bootstrap/hooks-body-parser.ts` | `captureRawBody`를 테스트 전용 named export로 노출하거나 빈 본문 e2e 케이스 추가 (비차단) |
| I10 | Testing | `http-exception.filter.spec.ts` — `statusCode`만 있는 경우 및 `status`/`statusCode` 충돌 케이스 미검증 | `codebase/backend/src/common/filters/http-exception.filter.spec.ts` | `{ statusCode: 413 }`만 가진 Error 케이스 추가 (비차단) |
| I11 | Maintainability | e2e 테스트 J 케이스 `100 * 1024` 매직 넘버 잔존 — `GLOBAL_MAX_BODY_BYTES` 상수 변경 시 테스트 드리프트 위험 | `codebase/backend/test/webhook-trigger.e2e-spec.ts` J 케이스 | `GLOBAL_MAX_BODY_BYTES`를 `hooks-body-parser.ts`에서 import해 교체 (비차단) |
| I12 | Documentation | `captureRawBody` JSDoc에 빈 Buffer 방어 조건 근거 미명시 — body-parser가 빈 본문에도 verify 콜백을 호출하는 동작 설명 부재 | `codebase/backend/src/bootstrap/hooks-body-parser.ts` captureRawBody JSDoc | JSDoc 또는 인라인에 한 줄 추가: "body-parser는 빈 본문에도 verify를 호출하므로 buf가 있으면(length === 0 포함) 항상 세팅한다" |
| I13 | Documentation | e2e 파일 상단 JSDoc에 새 케이스 J/K/L/M 미반영 — 파일 레벨 개요와 실제 커버 범위 불일치 누적 | `codebase/backend/test/webhook-trigger.e2e-spec.ts` 상단 JSDoc | 한 줄 추가: "본문 크기 경계(WH-NF-02 옵션 C): 인증 512KB 통과(J) / 1MB 초과 413(K/M) / 공개 32KB 초과 413(L)" |
| I14 | Documentation | `hooks.service.ts` `handleWebhook` 신규 파라미터 `preloadedTrigger`에 `@param` JSDoc 없음 — IDE hover/생성 문서에서 undefined vs null 구분 의미 불명확 | `codebase/backend/src/modules/hooks/hooks.service.ts` handleWebhook | `@param preloadedTrigger Guard가 이미 조회해 req에 첨부한 trigger(W14). undefined이면 직접 조회로 폴백, null이면 "존재하지 않음"으로 처리.` 추가 (비차단) |
| I15 | Documentation | `spec/5-system/3-error-handling.md` 및 `2-api-convention.md` frontmatter `code:` 목록에 `hooks-body-parser.ts` 미등재 — spec-coverage 추적 도구 갭 발생 | `spec/5-system/3-error-handling.md`, `spec/5-system/2-api-convention.md` | 선택적. frontmatter `code:`에 `codebase/backend/src/bootstrap/hooks-body-parser.ts` 추가 |
| I16 | Scope | `spec-link-integrity.test.ts` 타임아웃 1줄 수정이 이번 PR 핵심 변경과 무관 — 변경 규모 최소이고 기능 영향 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` L950-954 | 이상적으로는 별도 커밋 분리. 단 차단 사유 아님 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | TypeORM partial projection 보안 버그 수정 확인. fail-open 정책·4xx 메시지 노출 등 INFO 수준 잠재 위험 잔존 |
| performance | LOW | W14 DB 중복 왕복 제거 완료. full entity 로드 전환·전역 rawBody 복사 INFO 수준 트레이드오프 잔존 |
| architecture | LOW | Factory/SRP/OCP 전반 준수. Guard SRP 경계(복합 책임) WARNING 1건 |
| requirement | NONE | WH-NF-02 옵션 C 전체 구현 확인. SPEC-DRIFT 2건(코드 정확, spec 갱신 필요) |
| scope | LOW | 16개 파일 중 15개 의도된 범위 내. `spec-link-integrity.test.ts` 1줄 타임아웃 경계 사례 |
| side_effect | LOW | `RawBodyRequest<T>` 타입 계약 파괴 WARNING. `captureRawBody` 빈 Buffer 문제는 RESOLUTION W3으로 수정 완료 |
| maintainability | NONE | WARNING 2건(W6 중첩·W7 알파벳) 및 주요 INFO 항목 전부 해소. 매직 넘버 잔존 등 경미한 INFO만 잔존 |
| testing | LOW | e2e J/K/L/M 4종 + 단위 테스트 충실. non-webhook 100KB 방어선 e2e 미검증 WARNING 1건 |
| documentation | LOW | 전반 양호. Swagger PAYLOAD_TOO_LARGE 추가 확인. captureRawBody JSDoc·e2e 상단 JSDoc 등 INFO 수준 미비 잔존 |
| database | LOW | partial SELECT 제거(TypeORM 버그 교정) 및 W14 최적화 적절. 마이그레이션·인덱스 변경 없음 |
| api_contract | NONE | 413 PAYLOAD_TOO_LARGE 교정은 버그 수정(breaking change 아님). 에러 봉투 일관성 유지. |

---

## 발견 없는 에이전트

없음 — 전 에이전트 발견사항 기록됨. (requirement, maintainability, api_contract 는 NONE 위험도이나 INFO 발견 존재)

---

## 권장 조치사항

1. **(WARNING W2 — Testing)** non-webhook 라우트 전역 100KB 방어선 e2e 케이스 추가 — `main.ts` 전역 파서 등록의 핵심 부수 효과가 미검증 상태이므로 운영 안정성 보강을 위해 우선 처리.
2. **(WARNING W3 — Side Effect)** `RawBodyRequest<T>` 타입 소비처 수정 — `AuthConfigsService.verifyWebhookRequest` 등에서 `RawBodyRequest` import를 로컬 타입 확장(`req: Request & { rawBody?: Buffer }`)으로 대체해 컴파일 타입 계약과 런타임 동작 불일치 해소.
3. **(WARNING W1 — Architecture)** `PublicWebhookThrottleGuard` SRP 부채 plan 등재 — `extractClientIp` 유틸 이동 및 body 크기 검사 분리를 기술 부채 plan에 추적 항목으로 등재.
4. **(SPEC-DRIFT I1)** `spec/5-system/12-webhook.md` WH-NF-02에 `HOOKS_MAX_BODY_BYTES_CEILING` 16MiB 상한 클램프 설명 추가.
5. **(SPEC-DRIFT I2)** `spec/5-system/12-webhook.md` §6 구현 파일 구조에 `HOOKS_ROUTE_PREFIX` export 언급 추가.
6. **(INFO I5 — Security)** `HOOKS_MAX_BODY_BYTES_CEILING` 초과 시 경고 로그 추가.
7. **(INFO I8 — Testing)** `resolveHooksMaxBodyBytes` 상한 클램프 단위 테스트 케이스 추가.
8. **(INFO I11 — Maintainability)** e2e 테스트 J 케이스 `100 * 1024` → `GLOBAL_MAX_BODY_BYTES` 상수 import 교체.
9. **(INFO I12/I13/I14 — Documentation)** `captureRawBody` JSDoc 근거 추가 · e2e 상단 JSDoc J/K/L/M 반영 · `handleWebhook` `@param preloadedTrigger` 추가.
10. **(INFO I15 — Documentation)** spec frontmatter `code:` 목록에 `hooks-body-parser.ts` 추가 (선택적, spec-coverage 정확도 향상 목적).

---

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `api_contract` (11명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
  - **제외**: 3명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 선별에 의해 생략 |
  | concurrency | 라우터 선별에 의해 생략 |
  | user_guide_sync | 라우터 선별에 의해 생략 |
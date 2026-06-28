# 테스트(Testing) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[INFO]** `hooks-body-parser.spec.ts` — `resolveHooksMaxBodyBytes` 단위 테스트 충실
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts`
- 상세: `resolveHooksMaxBodyBytes`의 핵심 경로(미설정 기본값, 양의 정수 오버라이드, 소수점 floor, 유효하지 않은 값 fallback)를 `it.each`로 망라했다. `HOOKS_MAX_BODY_BYTES` 상수값 고정 단언도 포함돼 있어 오퍼레이터 실수로 상수를 변경했을 때 즉시 감지된다.
- 제안: 현행 유지.

### **[INFO]** `hooks-body-parser.spec.ts` — `HOOKS_MAX_BODY_BYTES_CEILING` 클램프 경로 테스트 미포함
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts`
- 상세: `resolveHooksMaxBodyBytes`는 env 값이 `HOOKS_MAX_BODY_BYTES_CEILING`(16MB)을 초과하면 상한으로 클램프한다. 이 경로에 대한 단위 테스트가 없다. 예컨대 `{ HOOKS_MAX_BODY_BYTES: String(32 * 1024 * 1024) }` 입력 시 `HOOKS_MAX_BODY_BYTES_CEILING`이 반환되는지를 검증하는 케이스 1개가 누락돼 있다.
- 제안: `it('clamps oversized override to HOOKS_MAX_BODY_BYTES_CEILING')` 케이스를 추가한다. 비차단 INFO.

### **[INFO]** `hooks-body-parser.spec.ts` — `createHooksBodyParsers`·`createGlobalBodyParsers` 테스트가 함수 시그니처(length·type)만 검증
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts` L102–120
- 상세: 두 함수 모두 "returns json + urlencoded middlewares" 라는 이름으로 반환 배열 길이와 타입만 단언한다. 실제로 반환된 미들웨어가 올바른 `limit`으로 생성됐는지(예: hooks 파서가 1MB limit, global 파서가 100KB limit을 적용하는지), 또는 `rawBody` 보존 여부는 이 레벨에서 전혀 검증되지 않는다. 이 동작은 e2e J(512KB HMAC)로 간접 커버되므로 위험도는 낮으나, body-parser 설정 오류를 빠르게 잡기 위한 미들웨어 통합 단위 테스트가 없다.
- 제안: 비차단 INFO. 필요 시 supertest를 이용한 최소 인메모리 Express 앱을 구성해 limit 동작을 검증하는 통합 단위 테스트를 추가할 수 있다.

### **[INFO]** `captureRawBody` — unexported 내부 함수로 빈 본문 케이스 직접 단위 테스트 불가
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `captureRawBody` 함수
- 상세: `captureRawBody`는 `hooks-body-parser.ts` 에 unexported private 함수로 존재한다. 빈 Buffer(`length === 0`) 케이스(`if (buf)` 조건)의 동작을 직접 단위 테스트하려면 export가 필요하거나 인메모리 Express 앱을 통한 간접 검증이 필요하다. 현재 이 케이스는 e2e로 커버되지 않는다(e2e J는 512KB 유효 페이로드를 다룬다). 빈 본문 HMAC 서명 검증 경로(바디가 없는 DELETE-style 요청 등)는 단위 레벨에서 사각지대.
- 제안: `captureRawBody`를 테스트 전용 named export로 노출하거나(`export { captureRawBody as _captureRawBodyForTest }`), 빈 본문 e2e 케이스를 추가한다. 비차단 INFO.

### **[INFO]** `http-exception.filter.spec.ts` — plain `Error` + `status` 경로 및 5xx 마스킹 케이스 신규 추가, 충분히 커버
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.spec.ts`
- 상세: RESOLUTION INFO 14 대응으로 plain `Error`(status=413) → 413, status≥500 → 500 마스킹, 메시지 미노출 케이스가 모두 추가됐다. `mockHost` 헬퍼가 각 테스트에서 독립 생성되어 테스트 간 Mock 상태 공유 없음. `bodyOf` 헬퍼가 반환 타입을 명시해 가독성 양호.
- 제안: 현행 유지.

### **[INFO]** `http-exception.filter.spec.ts` — `status`만 있고 `statusCode`는 없는 경우·두 값 충돌 케이스 미검증
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.spec.ts`
- 상세: `mapHttpErrorLike`는 `err.status ?? err.statusCode` 우선순위를 사용한다. 현재 테스트의 plain-Error 케이스는 `{ status: 413, statusCode: 413 }` 두 필드를 모두 설정하므로 `statusCode`만 존재하는 경우(예: express 일부 에러 형태)나 `status`가 `undefined`이고 `statusCode`만 4xx인 케이스가 단위 레벨에서 커버되지 않는다. 위험도는 낮으나 타입 정의(`HttpErrorLike`)의 두 필드 모두를 검증하지 않는 갭이다.
- 제안: `{ statusCode: 413 }` 만 가진 Error를 사용하는 케이스를 추가한다. 비차단 INFO.

### **[INFO]** `public-webhook-throttle.guard.spec.ts` — 보안 회귀 가드 단위 테스트 추가 (RESOLUTION INFO 13 대응)
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts`
- 상세: `findOne`이 `select` 옵션 없이 호출됨을 `expect.not.objectContaining({ select: expect.anything() })`으로 단언하는 케이스가 추가됐다. 이 테스트는 partial projection 재도입을 차단하는 회귀 가드로 적절히 동작한다. 테스트 의도가 주석으로 명시돼 가독성도 양호.
- 제안: 현행 유지.

### **[INFO]** e2e 테스트 J/K/L/M — 본문 크기 경계 4종 커버리지 충분
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts`
- 상세:
  - J: 인증(HMAC) 512KB → 202(1MB 파서 + rawBody 보존 통합 검증)
  - K: 공개 1.1MB → 413 PAYLOAD_TOO_LARGE(라우트 파서 한도 + 표준 봉투)
  - L: 공개 64KB → 413 PUBLIC_WEBHOOK_BODY_TOO_LARGE(Guard 32KB 한도 유지 검증)
  - M: 인증 1.1MB → 413 PAYLOAD_TOO_LARGE(인증 경로도 파서 한도 적용)
  이 네 케이스가 합쳐져 "라우트 파서 스코프 분리, 공개/인증 이중 게이트, 표준 봉투 형식"을 모두 검증한다. 각 `it` 블록이 독립 UUID 경로와 독립 트리거를 생성해 테스트 격리 확보.
- 제안: 현행 유지.

### **[WARNING]** e2e 테스트 — non-webhook 라우트 100KB 방어선 e2e 검증 없음
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` (신규 케이스 없음)
- 상세: `main.ts`의 핵심 설계 의도 중 하나는 "전역 100KB 기본 방어선은 non-webhook 라우트에 보존"이다. 그러나 non-webhook API 엔드포인트(예: `/api/triggers` 등)에 101KB 이상 본문을 전송했을 때 413이 반환되는지를 검증하는 e2e 케이스가 없다. `req._body` idempotency 가드를 통한 hooks 파서 우선 적용, 전역 파서 fallback 동작이 올바르게 연결됐는지를 검증하지 않는 사각지대다. 이 경로가 잘못 동작할 경우(예: 전역 파서가 등록되지 않아 non-webhook 본문이 미파싱)는 운영 장애로 직결된다.
- 제안: non-webhook API 엔드포인트에 150KB 이상 본문을 전송해 413이 반환되는지 검증하는 e2e 케이스 1개를 추가한다. 인증이 필요한 엔드포인트라면 테스트 토큰 필요. 중요도: WARNING — `main.ts` 변경의 핵심 부수 효과인 전역 파서 등록이 e2e로 검증되지 않음.

### **[INFO]** `spec-link-integrity.test.ts` — 타임아웃 30초 상향, 격리에 영향 없음
- 위치: `/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
- 상세: Jest `it` 세 번째 인자로 타임아웃을 30초로 설정했다. 다른 테스트 격리나 커버리지에 영향 없음. 동기 파일시스템 스캔으로 인한 flaky timeout 대응으로 적절.
- 제안: 현행 유지. 장기적으로 `findBrokenLinks` 비동기 I/O 전환 시 타임아웃 축소 검토.

### **[INFO]** 테스트 격리 전체 — 각 `it` 블록 독립 Mock 생성, 상태 공유 없음
- 위치: `hooks-body-parser.spec.ts`, `http-exception.filter.spec.ts`, `public-webhook-throttle.guard.spec.ts`
- 상세: 세 단위 테스트 파일 모두 각 `it` 블록에서 독립적으로 Mock/인스턴스를 생성하고, 모듈 레벨 `beforeEach`/`afterEach` 없이도 격리를 유지한다. 단위 테스트 간 의존성 없음.
- 제안: 현행 유지.

---

## 요약

이번 변경의 테스트 커버리지는 전반적으로 양호하다. 신규 기능(`hooks-body-parser.ts`)에 대한 단위 테스트가 함께 추가됐고, 보안 버그(`PublicWebhookThrottleGuard` partial select 우회)에 대한 회귀 가드 단위 테스트, `GlobalExceptionFilter` plain Error 경로 단위 테스트, e2e J/K/L/M 4종 본문 크기 경계 케이스가 적절히 갖춰졌다. 주요 갭은 두 가지다: (1) non-webhook 라우트에 대한 전역 100KB 방어선 e2e 검증 누락(WARNING — `main.ts` 전역 파서 등록의 핵심 부수 효과가 미검증), (2) `resolveHooksMaxBodyBytes` 상한 클램프 경로와 `captureRawBody` 빈 본문 케이스의 단위 테스트 미포함(INFO). `captureRawBody`가 unexported로 직접 단위 테스트가 불가한 구조는 테스트 용이성 측면에서 소폭 개선 여지가 있다.

---

## 위험도

LOW

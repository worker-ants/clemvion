# 테스트(Testing) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### [INFO] `createHooksBodyParsers` / `createGlobalBodyParsers` 단위 테스트 — shape 검증만 수행, 실제 limit 전달 미검증
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts` L45–64
- 상세: 두 팩토리 함수에 대한 테스트는 반환 배열 길이(2)와 각 항목이 function 인지만 단정한다. `createHooksBodyParsers(512)` 처럼 커스텀 `maxBytes` 를 주입했을 때 express.json 에 해당 limit 이 실제로 전달되는지 검증하지 않는다. 즉, `buildBodyParsers` 가 `maxBytes` 인자를 무시하는 구현 버그가 이 단위 테스트를 통과한다. `resolveHooksMaxBodyBytes` 는 꼼꼼히 커버됐으나 팩토리 함수가 그 결과를 파서에 실제로 반영하는지는 e2e J/K 에서만 간접 검증된다.
- 제안: `jest.spyOn(express, 'json')` 으로 spy 를 주입하고 `createHooksBodyParsers(512)` 호출 후 `limit: 512` 로 호출됐는지 단정하거나, 소형 fake 요청 스트림을 흘려 한도 초과 시 에러가 발생하는지 통합 수준 테스트 추가. 비차단이나 단위 테스트 보호망 강화 권장.

### [INFO] `captureRawBody` 함수 단위 테스트 없음
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L68–76, `/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts`
- 상세: `captureRawBody` 는 HMAC 서명 검증 전체의 정확성 기반 함수지만 private(unexported)이라 spec 에서 직접 접근할 수 없다. 현재 spec 은 `captureRawBody` 의 어떤 동작도 단언하지 않는다. 특히 `if (buf)` 조건이 빈 Buffer(길이 0)와 정상 Buffer 를 구별해 처리하는 로직은 e2e 에서만 간접 검증된다. 빈 본문 HMAC 요청 시 `req.rawBody` 가 `Buffer.alloc(0)` 으로 세팅되는지(또는 세팅되지 않는지)를 단위 수준에서 보호하는 가드가 없다.
- 제안: `captureRawBody` 를 `export` 하거나 `@internal` 주석과 함께 named export 로 노출해 단위 테스트 가능하게 하는 것을 고려. 또는 `createHooksBodyParsers` 에 소형 통합 테스트(fake IncomingMessage 스트리밍 후 req.rawBody 확인)를 추가. 현재 e2e J 가 512KB HMAC 통과로 정상 경로를 간접 검증하므로 비차단.

### [INFO] `GlobalExceptionFilter` 단위 테스트 — plain http-error (non-HttpException) 경로는 커버하나 `statusCode`-only 케이스 누락
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.spec.ts` L46–58
- 상세: `maps a plain http-error (status, non-HttpException) 4xx to its envelope` 테스트는 `{ status: 413, statusCode: 413 }` 을 동시에 가진 객체로 테스트한다. `mapHttpErrorLike` 구현(`err.status ?? err.statusCode`)상 `status` 가 undefined 이고 `statusCode` 만 있는 경우(일부 http-errors 라이브러리 방출 형태)도 커버해야 하는데, 이 케이스가 단위 테스트에 없다. body-parser 는 `status`와 `statusCode`를 모두 설정하므로 현실 위험은 낮다.
- 제안: `{ statusCode: 413 }` 만 가진(status 없는) plain Error 로 테스트 케이스를 하나 더 추가. 비차단 INFO.

### [INFO] e2e 테스트 케이스 파일 내 순서와 레이블 알파벳 순서 불일치
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` — J/K/L/M/N 삽입 위치
- 상세: 신규 J/K/L/M/N 케이스(본문 크기 경계)가 기존 F 케이스 앞에 삽입돼 파일 내 실행 순서가 `...E→J→K→L→M→N→F→G→H→I` 가 됐다. 레이블 알파벳이 실행 순서와 일치하지 않아, 이후 케이스를 추가하거나 디버깅 시 "어느 순서인지" 추적이 혼란스럽다. 주석에 "주제 그룹으로 의도적 배치"라고 명시했으나 레이블이 순서 지표 역할을 한다고 가정하는 독자에게 혼동을 준다.
- 제안: J/K/L/M/N 을 기존 I 이후(파일 끝 근처)로 이동하거나, 파일 상단 주석에 "레이블은 주제 그룹 단위 — 파일 내 배치 순서와 알파벳이 반드시 일치하지 않는다"는 명시적 선언 추가. 비차단.

### [INFO] `public-webhook-throttle.guard.spec.ts` — select 없는 findOne 호출 회귀 가드 추가 확인
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` L639–649 (신규 추가)
- 상세: `findOne` 이 `select` 옵션 없이 호출됨을 `expect.not.objectContaining({ select: expect.anything() })` 로 단언하는 테스트가 이번 diff 에서 추가됐다. 이는 partial projection 재도입 회귀를 조기에 포착하는 적절한 가드다. mock repository 가 DB 의 TypeORM null 반환 버그를 재현하지는 못하지만, 쿼리 형태가 바뀌면 즉시 실패하므로 실용적인 보호망이다. 긍정 평가.
- 제안: 없음. 현행 유지.

### [INFO] e2e 테스트 N — non-webhook 전역 100KB 방어선 검증
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` N 케이스 (15_24_09 RESOLUTION W2 반영)
- 상세: `POST /api/workflows` 에 `GLOBAL_MAX_BODY_BYTES + 50KB` 크기 요청을 보내 413 PAYLOAD_TOO_LARGE 를 검증한다. 이는 `bodyParser: false` + 명시 전역 파서 등록 경로의 핵심 부수효과(non-hooks 라우트 미파싱 방지)를 확인하는 좋은 회귀 가드다. `GLOBAL_MAX_BODY_BYTES` 상수를 import 해 매직 넘버를 제거한 것도 적절하다.
- 제안: 없음.

### [INFO] `spec-link-integrity.test.ts` 타임아웃 30초 — 상한 근거는 명시됐으나 vitest 전역 설정과의 정합 미확인
- 위치: `/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` L831
- 상세: 5s → 30s 확장은 CI 병렬 CPU 경합 시 flaky 방지를 위한 타당한 결정이며 주석으로 근거가 설명된다. 단, vitest/jest 설정의 전역 `testTimeout` 이 30s 미만인 경우 이 케이스별 설정이 무력화될 수 있다. 기능적 이슈는 아니지만 설정 검증 없이는 타임아웃 확장이 실제로 적용됐는지 보장되지 않는다.
- 제안: 프로젝트 vitest 또는 jest 설정 파일에서 `testTimeout` 이 30000ms 이상인지 확인. 필요시 케이스 주석에 설정 파일 경로 참조 추가.

### [INFO] `resolveHooksMaxBodyBytes` — ceiling 정확히 같은 값(equal to ceiling) 케이스 미테스트
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts` L37–42
- 상세: `clamps an oversized override to the ceiling` 테스트는 `ceiling * 2` 를 입력해 클램프를 검증한다. 그러나 `floored > HOOKS_MAX_BODY_BYTES_CEILING` 조건에서 `=` 은 포함되지 않으므로, 정확히 ceiling 과 같은 값(예: `String(HOOKS_MAX_BODY_BYTES_CEILING)`)은 클램프 없이 통과해야 한다. 이 경계값이 테스트되지 않아 `>=` 로 구현이 바뀌었을 때 회귀를 포착하지 못한다.
- 제안: `resolveHooksMaxBodyBytes({ HOOKS_MAX_BODY_BYTES: String(HOOKS_MAX_BODY_BYTES_CEILING) })` 가 `HOOKS_MAX_BODY_BYTES_CEILING` 을 그대로 반환함을 단언하는 케이스 추가.

### [INFO] 빈 Buffer(`buf.length === 0`) `captureRawBody` 동작 — W3 수정 후 `if (buf)` 로 변경됐으나 단위 테스트 없음
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L73
- 상세: 이전 `if (buf && buf.length)` 에서 `if (buf)` 로 교정돼 빈 Buffer(길이 0)도 `req.rawBody` 에 세팅된다. 이 수정은 빈 본문 HMAC 요청의 서명 검증이 rawBody 부재로 깨지는 것을 막는 중요한 엣지 케이스다. 그러나 이 동작을 검증하는 테스트가 단위 수준에는 없고, e2e 에서도 빈 본문 HMAC 케이스가 명시적으로 커버되지 않는다. 실용 위험은 낮으나(정상 HMAC 요청은 비어있지 않음) 방어 가드가 아예 없다.
- 제안: `captureRawBody` 또는 통합 수준에서 `Buffer.alloc(0)` 을 `buf` 로 전달 시 `req.rawBody` 가 `Buffer.alloc(0)` 으로 세팅됨을 단언하는 테스트 추가. `captureRawBody` export 이후 추가 가능.

---

## 요약

이번 변경의 테스트 커버리지는 전반적으로 충실하다. `resolveHooksMaxBodyBytes` 의 경계값(0, 음수, NaN, Infinity, 빈 문자열, 분수, ceiling 초과)이 꼼꼼히 테스트됐고, `GlobalExceptionFilter` 의 4xx plain-Error 경로(mapHttpErrorLike)·5xx 마스킹·details 전달이 신규 단위 테스트로 커버됐으며, e2e J/K/L/M/N 다섯 케이스가 1MB 파서 순서, HMAC rawBody 보존, 표준 413 봉투, 공개 32KB Guard, 전역 100KB 방어선을 통합 수준에서 모두 검증한다. `PublicWebhookThrottleGuard` 의 select-없는 findOne 회귀 가드도 단위 테스트로 추가됐다. 미흡 사항은 모두 INFO 수준이다: 팩토리 함수의 limit 전달 단위 검증 부재, `captureRawBody` 의 빈 Buffer 경계 케이스 단위 테스트 부재, ceiling 경계값 등가(equal) 케이스 미테스트, `statusCode`-only 4xx 케이스 미테스트, e2e 레이블 배치 순서 불일치. 이 모든 경로는 e2e 또는 실제 동작 테스트로 간접 커버되므로 전체 위험도는 낮다.

## 위험도

LOW

STATUS: SUCCESS

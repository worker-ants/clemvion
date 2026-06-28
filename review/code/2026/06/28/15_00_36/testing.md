# Testing Review

## 발견사항

### [INFO] PublicWebhookThrottleGuard 단위 테스트에 full entity 로드 회귀 가드 명시 미흡
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` — 기존 파일 (이번 diff 외)
- 상세: 이번 변경의 핵심 버그 수정은 `findOne({ select: { authConfigId: true } })` partial projection 을 full entity 로드로 교정한 것이다. 기존 `public-webhook-throttle.guard.spec.ts` 는 mock repository 에 `{ authConfigId: null }` 을 직접 세팅해 사용하므로, partial projection 오동작 자체를 단위 테스트 레벨에서 검증할 수는 없다(mock 이 DB 동작을 추상화하므로 구조적 한계). 하지만 findOne 호출 시 `select` 옵션 부재를 assertions 으로 검증하는 단위 테스트도 추가되어 있지 않다 — findOne 인자에 select 가 없음을 단정하면 향후 select 재도입 회귀를 조기 포착할 수 있다.
- 제안: `triggerRepository.findOne` 호출 인자에 `select` 가 포함되지 않음을 단정하는 단위 테스트 케이스 추가. 예: `expect(triggerRepository.findOne).toHaveBeenCalledWith(expect.not.objectContaining({ select: expect.anything() }))`. e2e L 이 실질 회귀 가드이므로 blocking 이슈는 아님.

### [INFO] `captureRawBody` 함수에 대한 직접 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` (L459-467), `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts`
- 상세: `captureRawBody` 는 HMAC 검증 정확성의 핵심 함수지만 unexported private 함수라 `hooks-body-parser.spec.ts` 에서 직접 테스트하지 못한다. 현재 spec 은 파서 팩토리 함수가 올바른 개수의 함수를 반환하는지(shape 검증)만 확인한다. rawBody 가 실제로 `req.rawBody` 에 세팅되는지는 e2e J(512KB HMAC 202)에서만 간접 검증된다. 빈 buf(`buf.length === 0`) 케이스에서 rawBody 를 덮어쓰지 않는 로직도 테스트되지 않는다.
- 제안: `captureRawBody` 를 export 하거나 테스트 전용 named export 를 제공해 `buf.length > 0` vs `buf.length === 0` 케이스를 단위 테스트로 커버하는 것을 고려. 혹은 `createHooksBodyParsers` 에 소형 통합 테스트(fake request 스트리밍)를 추가. e2e 로 커버되므로 낮은 우선순위.

### [INFO] `createHooksBodyParsers` / `createGlobalBodyParsers` 테스트가 미들웨어 동작이 아닌 반환값 shape 만 검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts` (L320-338)
- 상세: 두 팩토리 함수의 unit 테스트는 반환된 배열 길이와 각 항목이 `function` 임을 검증한다. 실제 byte limit 이 올바르게 미들웨어에 전달되는지, `verify: captureRawBody` 가 연결되는지는 검증하지 않는다. `createHooksBodyParsers(512)` 처럼 커스텀 limit 을 주입한 경우 그 값이 실제로 사용되는지 단위 테스트로 확인하기 어렵다.
- 제안: body-parser 의 option parsing 을 공개 함수로 추출하거나, `jest.spyOn` 으로 `express.json` 을 spy 해 호출 인자를 단정하는 테스트 추가. INFO 수준 — e2e K/J 가 실질 동작을 커버.

### [INFO] `GlobalExceptionFilter` 단위 테스트에 http-errors plain Error(status 포함) 경로 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts`
- 상세: 이번 변경의 핵심 추가는 `exception instanceof Error` 분기에서 `status`/`statusCode` 프로퍼티를 가진 http-errors 객체(예: body-parser 의 `PayloadTooLargeError`)를 4xx 로 매핑하는 것이다. 현재 spec 은 NestJS `PayloadTooLargeException`(HttpException 인스턴스)으로 413 매핑을 검증하는데, 이는 `instanceof HttpException` 분기를 타는 것으로 변경된 `instanceof Error` 분기(non-HttpException http-error)를 직접 검증하지 않는다. body-parser 가 실제 throw 하는 것은 `http-errors` 패키지의 `PayloadTooLargeError`(NestJS HttpException 아님)이므로, 실제 오류 경로가 단위 테스트에서 커버되지 않는다.
- 제안: `class FakePayloadTooLargeError extends Error { status = 413; }` 같은 plain-Error-with-status mock 으로 `PAYLOAD_TOO_LARGE` 코드·413 status 매핑을 추가 검증. 예: `new GlobalExceptionFilter().catch(Object.assign(new Error('too large'), { status: 413 }), host)` 케이스 추가.

### [INFO] e2e 테스트 레이블 비연속 (F, G, H, I 와 J, K, L 사이 skip)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/test/webhook-trigger.e2e-spec.ts` (L1518 "it('F.".)
- 상세: 기존 테스트가 A-I 이고 신규 테스트가 J-L 이다. 그런데 파일 내 순서는 J, K, L 이 F, G, H, I 보다 앞에 삽입되어 있어 실행 순서와 레이블 알파벳 순서가 불일치한다. 기능적 영향은 없으나 이후 M, N 테스트 추가 시 혼란을 줄 수 있다.
- 제안: J, K, L 을 기존 I 이후로 이동하거나, describe 블록 시작 부분 주석에 레이블-순서 정책을 명시. 비차단.

### [INFO] e2e K 테스트가 공개(인증 없는) webhook 으로 1MB 초과 테스트 — 인증 webhook 1MB 상한 직접 검증 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/test/webhook-trigger.e2e-spec.ts` (L1492-1503)
- 상세: 테스트 K 는 `auth_config_id IS NULL` 공개 webhook 으로 1MB 초과(`1100KB`) 시 `413 PAYLOAD_TOO_LARGE` 를 검증한다. 주석에 "파서가 auth 전에 거부"라고 명시되어 있고 기능상 올바르다. 그러나 인증 webhook(authConfigId 있음)이 1MB 초과 시 동일 에러코드(`PAYLOAD_TOO_LARGE`)를 받는지 — 즉 라우트 스코프 파서가 HMAC 인증 전에 거부하는지 — 를 직접 검증하는 테스트는 없다. 테스트 J 는 512KB(1MB 미만) HMAC 통과만 검증한다.
- 제안: 인증 webhook 1.1MB 송신 → `413 PAYLOAD_TOO_LARGE` 검증하는 테스트 추가(HMAC 서명 포함). 이는 "인증 webhook 1MB 게이트" 의 상한 경계를 직접 검증한다. 현재 K 가 파서 레이어를 통과해 Guard 이전에 413 이 발생함을 간접 확인하므로 CRITICAL 은 아님.

### [INFO] `spec-link-integrity` 테스트 timeout 30초 설정 — 상한 값 근거 문서 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` (L1980)
- 상세: 5초 기본값에서 30초로 올린 것은 CPU 경합 플레이키 방지를 위한 타당한 결정이며 주석으로 이유가 설명된다. 단, 30초는 테스트 스위트 전체 timeout 에 영향을 줄 수 있으므로, vitest config 의 전체 테스트 timeout 이 30초 이상인지 확인 필요. 기능적 이슈는 아님.
- 제안: 프로젝트 vitest 설정에서 `testTimeout` 이 30000 이상임을 확인. 필요시 주석에 config 참조 추가.

## 요약

변경의 핵심 세 축(hooks body-parser 분리, GlobalExceptionFilter 413 매핑, PublicWebhookThrottleGuard full entity 버그 수정)에 대한 테스트 커버리지는 전반적으로 충실하다. `hooks-body-parser.spec.ts` 가 `resolveHooksMaxBodyBytes` 의 경계값(유효 정수, 분수, 0, 음수, NaN, Infinity, 빈 문자열)을 빠짐없이 커버하며, `http-exception.filter.spec.ts` 가 413 매핑과 details 전달을 검증하고, e2e J/K/L 세 시나리오가 1MB 파서 순서, 표준 413 봉투, 공개 32KB Guard 를 통합 레벨에서 검증한다. 핵심 보안 버그(partial projection authConfigId 오판)의 회귀 가드는 e2e L 로 충분히 보호된다. 주요 미흡은 `GlobalExceptionFilter` 단위 테스트가 실제 body-parser 가 throw 하는 plain-Error-with-status(non-HttpException) 경로를 직접 커버하지 않는 점과, `captureRawBody` 함수의 단위 테스트 부재이나, 이 두 경로는 e2e 로 간접 커버되므로 전체 위험도는 낮다.

## 위험도

LOW

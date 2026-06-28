# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `process.env` 참조 교체 방식의 잠재적 격리 실패 위험
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` afterEach (두 describe 블록 공통), `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` afterEach
- **상세**: `process.env = envSnapshot` 패턴은 `process.env` 참조 자체를 새 객체로 교체한다. 대상 함수(`shouldTrustCfConnectingIp`, `extractClientIpFromHeaders`)가 매 호출 시 `process.env.XXX`를 동적으로 읽으므로 현재는 실질 문제가 없다. 그러나 향후 모듈 로드 시 env 값을 캐싱하거나 클로저로 캡처하는 코드가 추가되면 이 패턴이 격리를 보장하지 못한다. 기존 `delete process.env.KEY` / 재할당 방식은 동일 객체를 변이해 더 안전했다.
- **제안**: 동일 객체 변이 방식(`Object.assign(process.env, envSnapshot); Object.keys(process.env).forEach(k => { if (!(k in envSnapshot)) delete process.env[k]; })`) 또는 Jest 29+의 `jest.replaceProperty(process, 'env', envSnapshot)` 검토. 현 변경은 기능상 문제없으나 향후 안전성을 위해 후속 개선 권장.

### [INFO] `UNKNOWN_ERROR_MESSAGE` 경로 테스트 — 이번 변경으로 FIXED, 단 단언 범위 최소화 가능
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts` L63-73 (추가된 테스트)
- **상세**: 비-`Error` 값(`'a raw string thrown'`) throw 시 500·INTERNAL_ERROR·`'An unexpected error occurred'` 응답을 검증한다. 이번 변경에서 신규 추가된 상수 `UNKNOWN_ERROR_MESSAGE` 경로를 정확히 커버한다. 단, 이 테스트 이름이 주석(`// Error 인스턴스가 아닌 값…`)에 의존하고 있어 실패 시 식별에 약간의 컨텍스트가 필요하다.
- **제안**: it 설명 문자열이 `'비-Error 값 throw(문자열 등)은 UNKNOWN_ERROR_MESSAGE 로 500 처리'`로 충분히 명확하다. 추가로 `throw { custom: 'object' }` 케이스도 같은 경로를 검증하는 변형 테스트를 추가하면 fallthrough 경로의 완전성을 높일 수 있다(현 단일 케이스로도 커버리지 기준은 충족).

### [INFO] `requestId` 단언 대칭성(B-6) — 다른 4xx 케이스 미적용
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts` L47 (추가된 단언)
- **상세**: 비-413 4xx 테스트에 `expect(body.error.requestId).toBeDefined()` 단언을 추가해 413 케이스와 대칭을 맞춘 것(B-6)은 긍정적이다. 그러나 5xx 케이스 테스트들(`masks a plain 5xx-ish error`, `로그인 필요한 401 → UNAUTHORIZED`, `unknown HttpException → INTERNAL_ERROR` 등)에는 동일한 `requestId` 단언이 없다. 모든 에러 경로에서 `requestId`가 응답에 포함되는지 일관되게 검증되어 있지 않다.
- **제안**: 5xx 및 나머지 4xx 케이스에도 `requestId` 단언 추가를 검토해 에러 응답 봉투 구조 전반의 일관성을 테스트로 보장. 현 단계에서는 비차단.

### [INFO] `QueryFailedError`(unique violation) 경로 테스트 미커버 — 기존 갭
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` `isUniqueViolation` 분기
- **상세**: `isUniqueViolation(err)` → 409/RESOURCE_CONFLICT 분기는 이번 변경 범위 외 기존 코드이나, 테스트가 없다. `driverError.code = '23505'`인 `QueryFailedError` 케이스와, 다른 code에서 500 fallthrough 되는 케이스가 테스트되지 않는다.
- **제안**: 별도 테스트 보강 계획 수립(plan/in-progress에 등록 권장). 본 PR 차단 불필요.

### [INFO] nested error shape 경로 테스트 미커버 — 기존 갭
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` nested `{ error: { code, message, details } }` 분기
- **상세**: interaction 모듈 패턴으로 주석에 명시된 중첩 에러 형태(`new BadRequestException({ error: { code: 'NESTED_CODE', message: 'Nested message' } })`)에 대한 테스트가 없다. 이번 변경과 직접 무관하나 필터의 중요 분기 미커버.
- **제안**: 기존 갭으로 별도 보강 계획. 본 PR 차단 불필요.

### [INFO] `__publicWebhookTrigger` 첨부 동작 단언 부재
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts`
- **상세**: `canActivate` 호출 후 `req.__publicWebhookTrigger`에 Trigger가 올바르게 첨부되는지 검증하는 단언이 없다. `PublicWebhookReqShape`가 이제 `PublicWebhookReqExtension`을 extends해 `__publicWebhookTrigger` 필드를 포함하므로, 이 필드의 첨부 동작을 검증할 구조적 기반이 생겼음에도 테스트가 없다.
- **제안**: trigger 존재/null 케이스에서 `(req as PublicWebhookReqShape).__publicWebhookTrigger` 값을 단언하는 테스트 추가. 현재는 비차단.

### [INFO] `client-ip.spec.ts` — env 스냅샷 패턴이 두 describe 블록에 중복 선언
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` 두 describe 블록 각각의 `beforeEach`/`afterEach`
- **상세**: `envSnapshot`, `beforeEach(() => { envSnapshot = { ...process.env }; })`, `afterEach(() => { process.env = envSnapshot; })` 패턴이 동일 파일 내 두 `describe` 블록에 동일하게 중복 선언된다. 이전의 `const orig` 패턴보다 명확하게 개선되었으나, 파일 레벨로 이동하거나 헬퍼로 추출하면 향후 블록 추가 시 중복을 방지할 수 있다.
- **제안**: 파일 레벨 `beforeEach`/`afterEach`로 이동하거나, `withEnvSnapshot()` 형태의 헬퍼 함수로 추출. 현행도 허용 범위.

### [INFO] `makeGuard`의 `configService` 반환 누락으로 단언 확장성 제한
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` `makeGuard` 헬퍼
- **상세**: `makeGuard`가 `guard`, `quota`만 반환하고 `configService` mock은 반환하지 않는다. 현재 테스트에서는 `configService.get` 호출 여부를 단언하지 않아 문제없으나, 설정 의존 분기 테스트 추가 시 헬퍼를 수정해야 한다.
- **제안**: `makeGuard` 반환에 `configService` 포함 검토. 현 범위에서는 비차단.

## 요약

이번 변경셋은 테스트 격리(env 스냅샷 통일, `afterEach(jest.restoreAllMocks)` 도입)와 커버리지 보강(`UNKNOWN_ERROR_MESSAGE` 신규 케이스, `requestId` 대칭 단언)에 집중한 변경으로, 기존 대비 테스트 견고성이 실질적으로 향상됐다. `PublicWebhookReqShape` export로 테스트-구현 간 타입 동기화 단일화(A-3)도 테스트 용이성 측면에서 긍정적이다. 주요 미비점은 `process.env` 참조 교체 방식의 잠재적 취약성(대상 함수가 동적 read라 현재는 무해하나 향후 위험), `QueryFailedError`/nested error shape/`__publicWebhookTrigger` 첨부 등 기존 커버리지 갭이며 이는 본 PR 이전부터 존재한 것들이다. 신규 추가된 비-Error throw 테스트는 상수화와 짝을 이뤄 의미 있는 회귀 방지 역할을 한다.

## 위험도

LOW

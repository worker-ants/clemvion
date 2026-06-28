# 테스트(Testing) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `process.env` 객체 교체 방식의 환경 격리 패턴 — 이동 방향은 올바르나 런타임 제약 주의
  - 위치: `client-ip.spec.ts` L482, `public-webhook-throttle.guard.spec.ts` L1969 (`afterEach(() => { process.env = envSnapshot; })`)
  - 상세: `process.env = envSnapshot`으로 참조를 교체하는 패턴은 Node.js 에서 `process.env` 가 getter/setter 로 묶인 native object 이기 때문에 일부 환경(Jest isolatedModules, ts-jest 등)에서 교체 후에도 원본 참조를 캐싱한 모듈이 이전 env 를 계속 읽을 수 있다. `Object.assign(process.env, envSnapshot)` + 불필요 키 `delete` 방식이 더 안전하다.
  - 제안: `afterEach`를 `Object.keys(process.env).forEach(k => { if (!(k in envSnapshot)) delete process.env[k]; }); Object.assign(process.env, envSnapshot);` 패턴으로 교체하거나, 기존 `delete` + 조건 복원 방식보다 `jest.replaceProperty` (Jest 29+) 사용을 검토.

### 발견사항 2
- **[INFO]** `http-exception.filter.spec.ts` — `UNKNOWN_ERROR_MESSAGE`·`UNHANDLED_ERROR_MESSAGE` 상수화 커버리지 갭
  - 위치: `http-exception.filter.spec.ts` 전체 / `http-exception.filter.ts` L282–L289
  - 상세: `GlobalExceptionFilter.UNKNOWN_ERROR_MESSAGE`('An unexpected error occurred')는 비-`Error` 값(문자열, plain object)이 throw 될 때 쓰이는 기본 메시지다. 현재 테스트에는 이 경로(`catch` 의 최종 fallthrough — `else if (exception instanceof Error)` 에도 안 걸리는 케이스)를 검증하는 케이스가 없다. `defaults unknown errors to 500 INTERNAL_ERROR` 테스트는 `new Error('boom')`을 사용해 `UNHANDLED_ERROR_MESSAGE`('An unexpected error occurred. Please try again later.') 경로를 테스트하지, `UNKNOWN_ERROR_MESSAGE` 경로가 아니다.
  - 제안: `throw 'string literal'` 또는 `throw { custom: 'object' }` 케이스를 추가해 fallthrough 메시지가 `UNKNOWN_ERROR_MESSAGE`임을 검증하는 테스트 1개 추가.

### 발견사항 3
- **[INFO]** `http-exception.filter.spec.ts` — UniqueViolation(QueryFailedError) 경로 미커버
  - 위치: `http-exception.filter.ts` L327–L332 (`isUniqueViolation` 분기)
  - 상세: `isUniqueViolation` 분기는 `status=409 / code=RESOURCE_CONFLICT`를 반환하는 중요 경로이나, 스펙 파일(`http-exception.filter.spec.ts`)에 해당 케이스가 없다. `QueryFailedError`를 mock 하거나 실제 생성해 409 응답을 확인하는 테스트가 필요하다.
  - 제안: `QueryFailedError` 인스턴스를 `driverError.code = '23505'`로 설정한 뒤 catch 해 `status=409`, `code='RESOURCE_CONFLICT'` 반환을 검증하는 테스트 추가. driverError 가 다른 code 일 때 500 으로 fallthrough 하는 케이스도 추가.

### 발견사항 4
- **[INFO]** `http-exception.filter.spec.ts` — Nested error shape(resp.error.code/message) 커버리지 부재
  - 위치: `http-exception.filter.ts` L310–L322 (nested `{ error: { code, message, details } }` 분기)
  - 상세: `BadRequestException` 에 `{ error: { code: 'X', message: 'Y' } }` 형태로 throw 하는 nested 경로(interaction 모듈 패턴)는 주석에서 명시적으로 언급되나 현재 테스트에는 커버되지 않는다. `passes through an explicit code + details` 테스트는 flat shape(`{ code, message, details }`) 만 검증한다.
  - 제안: `new BadRequestException({ error: { code: 'NESTED_CODE', message: 'Nested message' } })` 케이스 추가해 nested shape 도 올바르게 추출됨을 검증.

### 발견사항 5
- **[INFO]** `public-webhook-throttle.guard.spec.ts` — `makeGuard` 의 `configService` 반환값이 `guard` 객체에 미포함
  - 위치: `public-webhook-throttle.guard.spec.ts` L1952 (`return { guard, triggerRepository, quota }`)
  - 상세: `configService` 옵션이 있을 때 mock configService 를 생성하지만 반환하지 않는다. 현재 테스트는 동작 결과(413/통과 여부)만 검증하므로 문제없으나, `configService.get` 이 올바른 키로 호출되었는지 검증하는 단언을 추가할 경우 반환 부재가 장벽이 된다.
  - 제안: `makeGuard` 의 반환 타입에 `configService` 추가 또는 `configService.get` 호출 검증 테스트를 별도 추가.

### 발견사항 6
- **[INFO]** `hooks.service.ts` 의 `extractClientIpFromHeaders` 직접 호출 경로 — 서비스 레벨 유닛 테스트에 IP 관련 단언 부재 확인 권장
  - 위치: `hooks.service.ts` L873, L981 (변경된 두 호출부)
  - 상세: 로컬 래퍼 `extractClientIp` 가 제거되고 `extractClientIpFromHeaders(...) ?? undefined` 로 직접 호출됨. 이 경로 자체의 unit 커버리지는 `hooks.service.spec.ts`(미변경 파일)에 위임된다. 변경사항이 동작 보존이므로 기존 테스트가 회귀를 잡아주어야 하는데, hooks.service.spec.ts 가 clientIp 경로를 어느 수준으로 커버하는지 명시적으로 확인되지 않았다.
  - 제안: `hooks.service.spec.ts` 에서 `sourceIp` 가 올바르게 `executionEngineService.execute` 에 전달되는지 검증하는 테스트가 존재하는지 확인. 없으면 추가 고려.

### 발견사항 7
- **[INFO]** `public-webhook-throttle.guard.spec.ts` — `__publicWebhookTrigger` 첨부 여부 미검증
  - 위치: `public-webhook-throttle.guard.ts` L327 (`req.__publicWebhookTrigger = trigger`)
  - 상세: W14 기능(Guard 조회 trigger 를 req 에 첨부해 HooksService 재사용)에 대한 테스트가 현재 spec 파일에 없다. `canActivate` 호출 후 `req.__publicWebhookTrigger` 가 조회된 trigger 와 동일한지 검증하는 단언이 없다.
  - 제안: trigger 존재 케이스에서 `req.__publicWebhookTrigger === trigger_mock` 을 확인하는 단언 추가. null trigger 케이스(`trigger: null`)에서는 `__publicWebhookTrigger === null` 검증.

### 발견사항 8
- **[INFO]** `client-ip.spec.ts` — `shouldTrustCfConnectingIp` describe 블록에 env 격리 없음
  - 위치: `client-ip.spec.ts` L528–L541 (`describe('shouldTrustCfConnectingIp')` 블록)
  - 상세: `shouldTrustCfConnectingIp` 테스트는 env 주입 방식(`shouldTrustCfConnectingIp({ TRUST_CF_CONNECTING_IP: v })`)을 사용하므로 process.env 격리가 불필요하다. 현재 구조가 올바름. 단, 테스트 의도가 문서화되어 있지 않아 미래 기여자가 불필요하게 env 격리를 추가할 수 있다.
  - 제안: 주석으로 "env 주입을 직접 인수로 전달하므로 process.env 격리 불필요" 명시.

## 요약

이번 변경의 핵심은 테스트 격리 강화(B-4~B-7)와 코드 정리(A-1~A-3)다. `afterEach(jest.restoreAllMocks)` 통일, env 스냅샷/복원 패턴 도입, `requestId` 대칭 단언 추가 등 테스트 견고성을 높이는 방향은 모두 올바르다. `PublicWebhookReqShape` 를 named interface 로 export 해 테스트와 구현 간 타입 이중 선언을 제거한 것도 정석적인 개선이다. 다만 `process.env` 객체 교체(`= envSnapshot`) 패턴은 Node.js 환경 특성상 캐싱된 모듈이 이전 참조를 유지할 수 있어 잠재적 불안정 요소가 있으며, `GlobalExceptionFilter` 에서 비-`Error` fallthrough 경로, `QueryFailedError`(unique violation) 경로, nested error shape 경로가 테스트 미커버 상태다. 이는 신규 변경에 의한 갭이 아닌 기존 커버리지 갭이므로 차단 이슈는 아니나, 해당 경로들이 production 에서 중요한 분기인 만큼 후속 테스트 추가를 권장한다.

## 위험도

LOW

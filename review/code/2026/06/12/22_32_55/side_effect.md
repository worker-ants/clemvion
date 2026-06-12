# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 파일 1 — audit-action.const.ts: 주석 전용 변경, 부작용 없음
- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 전체
- 상세: JSDoc 주석의 액션 명칭 표기만 수정 (`llm_config.*` → `model_config.*` 등). `AUDIT_ACTIONS` 상수 값·`AuditAction` 타입 모두 변경 없음.
- 제안: 없음.

---

### [INFO] 파일 2 — auth.controller.spec.ts: 테스트에서 `process.env` 변경·복원 패턴
- 위치: `auth.controller.spec.ts` 신규 테스트 (null origin CSRF)
- 상세: `CORS_ORIGINS` / `FRONTEND_URL` 를 `delete` 한 뒤 `finally` 에서 원복한다. 복원 로직(`prev === undefined` 시 delete, 아니면 재설정)은 기존 테스트와 동일 패턴이라 일관성을 유지한다. 단, Jest 의 병렬 워커 환경에서 동일 env 키를 조작하는 테스트가 동시에 실행되면 경합이 발생할 수 있으나, 같은 describe 블록 내 순차 실행이면 안전하다.
- 제안: 없음 (기존 패턴과 일관).

---

### [WARNING] 파일 3 — client-ip.spec.ts: describe 선언 시점 `process.env` 스냅샷
- 위치: `client-ip.spec.ts` `describe('extractClientIpFromHeaders (shared core)')` 블록 상단 `const orig = process.env.TRUST_CF_CONNECTING_IP;`
- 상세: `const orig` 가 `describe` 콜백 **선언 시점**(모듈 로드 시 동기 실행)에 평가된다. 다른 테스트 파일이 `TRUST_CF_CONNECTING_IP` 를 설정한 채로 복원하지 않고 이 파일이 실행되면, `orig` 가 오염된 값을 캡처해 `afterEach` 의 복원 기준이 틀려진다. 기존 `describe('extractClientIp')` 블록의 `const origTrustCf` 도 동일한 패턴을 공유한다.
- 제안: `beforeEach` 또는 `beforeAll` 내에서 스냅샷을 찍거나, Jest `--runInBand` 혹은 `jest.isolateModules` 로 격리를 보장한다. 현재 파일 단독 실행 환경에서는 초기값이 `undefined` 이므로 실질적 위험은 낮다.

---

### [INFO] 파일 4 — client-ip.ts: 새 공개 함수 `extractClientIpFromHeaders` 추출
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts`
- 상세: `extractClientIp` 의 헤더 처리 로직을 `extractClientIpFromHeaders(headers: Record<string, string | string[] | undefined>): string | null` 로 분리·공개 export. 기존 `extractClientIp(req: Request): string | null` 시그니처는 동일하게 유지된다.
- **전역 상태**: `shouldTrustCfConnectingIp()` 가 인자 없이 호출되어 `process.env.TRUST_CF_CONNECTING_IP` 를 암묵 참조하는 것은 기존과 동일 — JSDoc 에 명시됨.
- **기존 호출자 영향**: 없음. 새 export 는 추가이므로 기존 호환성 파괴 없음.
- 제안: 없음.

---

### [INFO] 파일 5 — refresh-cookie.spec.ts: 신규 테스트, 부작용 없음
- 위치: `clearRefreshTokenCookie` describe 블록 신규 테스트 (domain parity)
- 상세: 순수 mock `res.clearCookie` 단위 테스트. `process.env` 조작 없음, 파일시스템 접근 없음.
- 제안: 없음.

---

### [INFO] 파일 6 — refresh-cookie.ts: JSDoc 추가만, 부작용 없음
- 위치: `setRefreshTokenCookie` 함수 위 JSDoc 블록
- 상세: 함수 본문·시그니처·`clearRefreshTokenCookie` 모두 변경 없음. 공개 API 동일.
- 제안: 없음.

---

### [INFO] 파일 7 — hooks.service.ts: 내부 IP 추출 헬퍼 위임 교체
- 위치: `hooks.service.ts` 파일 스코프 함수 `extractClientIp(headers: Record<string, string>)`
- 상세: 기존 로컬 구현에서 `extractClientIpFromHeaders` 위임으로 교체. 이 함수는 파일 내부에서만 사용되므로 공개 인터페이스 영향 없음.
- **동작 변화**: 기존 구현은 `cf-connecting-ip` 헤더가 배열 타입일 경우 문자열로 잘못 취급할 수 있었으나, 새 구현은 `pickFirst()` 로 배열도 올바르게 처리한다. IPv6-mapped IPv4 정규화(`::ffff:`)도 새로 적용된다. 이는 의도된 개선이다.
- 제안: 없음.

---

### [INFO] 파일 8 — public-webhook-throttle.guard.ts: 공개 헬퍼 위임 교체
- 위치: `export function extractClientIp(headers: Record<string, unknown>): string | undefined`
- 상세: 시그니처 자체는 변경 없음. 내부 구현만 `extractClientIpFromHeaders` 위임으로 교체. `headers as Record<string, string | string[] | undefined>` 캐스트를 사용하며, 이는 `Record<string, unknown>` 의 서브타입 강제이므로 런타임에 배열 값 등이 올 수 있다. 새 구현(`pickFirst()`)은 이를 올바르게 처리한다.
- **기존 호출자 영향**: 없음 — 외부 시그니처 동일.
- 제안: 없음.

---

### [INFO] 파일 9 — websocket.gateway.spec.ts: 신규 테스트, 부작용 없음
- 위치: `handleSubscribe` describe 블록 신규 테스트 (userId 미설정 소켓 거부)
- 상세: `getSubscriptions()` Map 에 쓰기를 수행하나, `beforeEach` 의 `module` 재생성으로 테스트 간 격리된다. 전역 상태 오염 없음.
- 제안: 없음.

---

### [WARNING] 파일 10 — websocket.module.ts: JWT fallback secret 변경 (`'fallback'` → `'dev-jwt-secret'`)
- 위치: `websocket.module.ts` `JwtModule.registerAsync` useFactory
- 상세: `configService.get('jwt.secret')` 이 `undefined` 일 때의 fallback 값이 `'fallback'` 에서 `'dev-jwt-secret'` 으로 변경됐다. 코드 설명에 따르면 `assertProductionConfig` 의 `INSECURE_JWT_SECRETS` 목록에 포함되어 운영 환경 기동을 차단한다.
- **잠재 부작용**: 단위 테스트는 `JwtService` 를 mock 처리하므로 직접 영향 없다. 그러나 E2E·통합 테스트에서 JWT 토큰을 실제 발급·검증한다면, 기존에 `'fallback'` secret 으로 서명된 fixture/seed 토큰이 있을 경우 검증 실패가 발생한다. 이 변경이 먼저 반영된 환경에서 기존 `'fallback'`-signed 토큰을 재사용하면 `JsonWebTokenError: invalid signature` 가 발생한다.
- 제안: E2E/통합 테스트의 JWT fixture/seed 를 `'dev-jwt-secret'` 기준으로 검토·갱신한다.

---

### [INFO] 파일 11 — condition-evaluator.util.ts: JSDoc 주석 확장만, 부작용 없음
- 위치: `MAX_REGEX_LENGTH` 상수 JSDoc
- 상세: 주석 내용 확장만. 상수값(200), 타입, 함수 시그니처 모두 변경 없음.
- 제안: 없음.

---

### [INFO] 파일 12 — safe-html.test.ts: 신규 테스트, 부작용 없음
- 위치: `describe("renderTemplateHtml — html 포맷")` 블록 신규 테스트 2개 (relative href 허용, blob: 제거)
- 상세: `afterEach(() => { _resetHookForTest(); vi.unstubAllGlobals(); })` 가 파일 레벨에 선언되어 전역 DOMPurify hook 상태를 정리한다. 신규 테스트는 `vi.stubGlobal` 을 사용하지 않으므로 추가 정리가 불필요하다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심은 IP 추출 로직 중복 제거(`extractClientIpFromHeaders` 공유 코어 추출 후 `hooks.service.ts` / `public-webhook-throttle.guard.ts` 위임), 보안 관련 테스트 추가(null origin CSRF, userId 미설정 소켓, relative/blob URL 경계), WebSocket 모듈 JWT fallback sentinel 통일이다. 공개 함수 시그니처 파괴는 없으며, 내부 구현은 더 견고한 공유 코어로 교체됐다. 주목할 사항은 두 가지다. 첫째, `client-ip.spec.ts` 의 describe 선언 시점 env 스냅샷 패턴은 테스트 실행 순서에 따라 잘못된 기준값을 캡처할 수 있는 잠재적 취약점이 있으나, 현재 파일 단독 실행 환경에서 실질 위험은 낮다. 둘째, JWT fallback 이 `'fallback'` → `'dev-jwt-secret'` 으로 변경되어 해당 값으로 서명된 기존 E2E fixture 가 있다면 검증 오류가 발생할 수 있으므로 확인이 필요하다. 의도하지 않은 전역 변수 도입, 파일시스템 부작용, 네트워크 호출, 이벤트·콜백 계약 변경은 발견되지 않았다.

## 위험도

LOW

# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] 테스트 존재 여부 — 이전 MEDIUM 위험도가 이번 커밋으로 완전 해소됨
- 위치: `codebase/backend/src/modules/integrations/oauth-providers/oauth-provider-strategy.spec.ts` (신설, 502줄 / 31 케이스)
- 상세: 직전 리뷰(17_32_11 SUMMARY)에서 strategy 전용 단위 테스트 전무(WARNING 1-6)로 MEDIUM 판정을 받았다. 이번 커밋은 해당 spec 파일 1개를 신설하여 resolveOAuthStrategy registry, 5개 provider 전략의 buildAuthorizeUrl / buildTokenRequest / parseTokenExpiresAt / extractProviderMeta / buildStubResult / describeExchange 전 메서드를 직접 검증한다. 기존 446 + 신규 31 = 477 테스트 PASS 검증됨.
- 제안: 없음.

### [INFO] 커버리지 갭 — GitHub buildTokenRequest 정상 경로 테스트 없음
- 위치: `oauth-provider-strategy.spec.ts` — `Standard OAuth strategies (google / github)` describe 블록
- 상세: Google의 buildTokenRequest(정상·예외 모두)는 직접 검증하나, GitHub buildTokenRequest 정상 경로 테스트가 없다. GitHub는 StandardOAuthStrategy를 상속하므로 동작이 동일하지만 tokenUrl(`https://github.com/login/oauth/access_token`)과 Accept 헤더 차이 여부 등 GitHub 특이 프로토콜이 존재할 경우 회귀를 잡지 못한다. INFO 수준이며 현재 동작에는 문제 없다.
- 제안: `githubOAuthStrategy.buildTokenRequest({ ... })` 정상 케이스 1건 추가 시 tokenUrl 차이를 명시 문서화할 수 있다.

### [INFO] 커버리지 갭 — Cafe24 private buildAuthorizeUrl 테스트 없음
- 위치: `oauth-provider-strategy.spec.ts` — `Cafe24 OAuth strategies (public / private)` describe 블록
- 상세: `cafe24PrivateOAuthStrategy.buildAuthorizeUrl`을 직접 호출하는 케이스가 없다. public과 private이 동일 `Cafe24OAuthStrategyBase.buildAuthorizeUrl`을 공유하므로 실질적 갭은 없으나, 만약 private 전략이 base를 오버라이드하게 되면 그 경로가 무방비가 된다.
- 제안: `cafe24PrivateOAuthStrategy.buildAuthorizeUrl` 정상 케이스 1건 추가(또는 test 주석으로 "base 공유로 중복 테스트 생략" 명시).

### [INFO] 커버리지 갭 — Cafe24 private extractProviderMeta / buildStubResult 미검증
- 위치: `oauth-provider-strategy.spec.ts` — `Cafe24 OAuth strategies` 블록
- 상세: public/private가 base 공유이므로 동일 동작이 예상되나, `cafe24PrivateOAuthStrategy.extractProviderMeta`와 `buildStubResult`를 직접 호출하는 케이스가 없다. private buildStubResult는 `cafe24_operator_id`가 실제 app과 다른 더미 ID를 반환할 수 있어, 명시적 검증이 더 안전하다.
- 제안: INFO — 동작 상 문제없으나 private 전략 분기가 추가될 경우 누락 포인트가 된다.

### [INFO] 엣지 케이스 — thrownCode 헬퍼가 예외를 throw하지 않는 경우('DID_NOT_THROW')를 단언하지 않음
- 위치: `oauth-provider-strategy.spec.ts` lines 27-35, `thrownCode` 함수
- 상세: `thrownCode(fn)` 헬퍼는 예외가 발생하지 않으면 `'DID_NOT_THROW'`를 반환한다. 현재 모든 호출부는 `toBe('SOME_CODE')` 단언을 하므로 `'DID_NOT_THROW'` 반환 시 자동으로 실패한다. 설계는 올바르나, `thrownCode`의 반환 타입이 테스트 실패 시 오해하기 쉬운 문자열이다. Jest의 `expect(fn).toThrow()` 또는 별도 `toThrowWithCode` matcher 사용이 더 관용적이다. 현재 동작에는 문제없으며 가독성 지적이다.
- 제안: INFO — 현행 유지 가능. `thrownCode` 헬퍼에 짧은 주석("returns 'DID_NOT_THROW' if no exception — test assertions will catch mismatch") 추가로 의도 명확화.

### [INFO] 엣지 케이스 — parseTokenExpiresAt 시간 의존 테스트의 미래 날짜 하드코딩
- 위치: `oauth-provider-strategy.spec.ts` lines 400-406 (cafe24 parseTokenExpiresAt KST 테스트), lines 460-467 (makeshop expires_at 테스트)
- 상세: `'2026-06-21T18:00:00'`(cafe24)과 `'2026-06-21T10:00:00Z'`(makeshop) 등 고정 미래 날짜가 쓰였다. 현재 날짜(2026-06-21) 기준으로는 미래이지만, 이 날짜들이 실제 현재 시각보다 과거가 되면 테스트는 여전히 PASS하나 만료 시간이 과거 값이 된다. 기능 오류는 없지만 "만료 시간이 미래인지" 단언이 없어 시각 계산 오류 회귀를 잡지 못한다.
- 제안: KST 테스트를 `Date.now()`에서 상대적인 미래 시각으로 생성하거나(`new Date(Date.now() + ...)`), 최소한 `(byIso as Date).getTime() > Date.now()` 단언을 추가한다.

### [INFO] Mock 적절성 — makeFakeJwt 헬퍼 의존, 단순 base64 스터빙으로 충분
- 위치: `oauth-provider-strategy.spec.ts` lines 17, 384, 469
- 상세: `makeFakeJwt` 유틸리티를 `__test-utils__/make-fake-jwt`에서 import하여 JWT payload를 생성한다. 전략이 서명 미검증(설계 의도)을 고려하면 단순 base64 인코딩 유틸로 충분하며, 현재 접근도 올바르다. 다만 `makeFakeJwt`의 존재와 용도(signature-less fake JWT)를 spec 파일 상단 주석에 언급하면 다른 테스트 작성자가 의도를 빠르게 이해할 수 있다.
- 제안: 현행 유지. spec 파일 상단에 "makeFakeJwt produces unsigned JWTs — strategies intentionally skip signature validation" 주석 한 줄 추가 권고.

### [INFO] 테스트 격리 — 모듈 레벨 singleton 인스턴스 직접 참조
- 위치: `oauth-provider-strategy.spec.ts` lines 37-39, 각 describe 블록
- 상세: `googleOAuthStrategy`, `githubOAuthStrategy`, `cafe24PublicOAuthStrategy` 등 모듈 레벨 singleton 인스턴스를 직접 import해서 사용한다. 전략 클래스가 stateless하게 설계되어 있어(아키텍처 리뷰에서 확인) 테스트 간 상태 오염 위험은 없다. 현재 설계는 올바르다.
- 제안: 없음. stateless singleton임을 spec 파일 주석에 명시하면 향후 상태 추가 시 주의를 환기할 수 있다.

### [INFO] 테스트 가독성 — buildTokenRequest 예외 테스트 패턴 혼용
- 위치: `oauth-provider-strategy.spec.ts` lines 107-127 vs lines 213-231
- 상세: google buildTokenRequest 예외 케이스에서 일부는 `thrownCode` 헬퍼를, 일부(OAUTH_CONFIG_MISSING 메시지 내용 검증)는 `try/catch` 직접 패턴을 사용한다. `thrownCode`로 에러 코드만 확인하는 케이스와 직접 catch로 메시지 내용까지 검증하는 케이스가 혼용되어 있다. 두 패턴 모두 기능적으로 올바르나 일관성이 다소 떨어진다.
- 제안: INFO — `thrownCode`와 직접 catch의 사용 기준을 주석으로 명시("use thrownCode for code-only checks; direct catch when message content matters")하거나, `thrownCode`를 확장해 message도 반환하도록 개선.

### [INFO] 회귀 테스트 — 기존 facade 통합 테스트와의 중복 커버리지
- 위치: 기존 integration-oauth.service 통합 테스트 vs 신규 oauth-provider-strategy.spec.ts
- 상세: 기존 446개 테스트 중 일부는 facade를 통해 strategy 예외 경로를 간접 커버했을 것이다. 신규 spec은 strategy를 직접 단위 테스트한다. 중복 커버리지는 회귀 감지 측면에서 이득이며, 신규 테스트가 기존을 대체하는 것이 아닌 추가이므로 문제없다. 기존 테스트 477개 모두 PASS 확인됨.
- 제안: 없음.

### [INFO] 테스트 용이성 — 전략 클래스의 의존성 주입 구조가 테스트 친화적
- 위치: 전략 클래스 전체 (stateless, no DI container dependency)
- 상세: 전략 클래스가 NestJS DI 컨테이너 없이 직접 instantiate 가능한 순수 클래스로 설계되어 있어, `new GoogleOAuthStrategy()` 또는 singleton export로 즉시 테스트 가능하다. TestingModule 없이도 단위 테스트 가능한 구조로 테스트 용이성이 높다.
- 제안: 없음.

---

## 요약

이번 커밋은 직전 ai-review(17_32_11)에서 MEDIUM 위험도의 근원이었던 strategy 전용 단위 테스트 부재(WARNING 6건)를 31개 케이스로 전면 해소했다. resolveOAuthStrategy registry 매핑, 5개 provider 전략의 예외 경로(CAFE24_INVALID_MALL_ID, MAKESHOP_PKCE_REQUIRED, CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED, MAKESHOP_CREDENTIALS_REQUIRED, OAUTH_CONFIG_MISSING), parseTokenExpiresAt 4분기, extractProviderMeta, buildStubResult, describeExchange 진단 분기가 모두 직접 단위 검증된다. 테스트는 외부 의존성(DB, NestJS DI 컨테이너) 없이 격리 실행 가능하고, thrownCode 헬퍼·makeFakeJwt 유틸 활용이 적절하다. 잔여 INFO 항목은 GitHub buildTokenRequest 정상 경로 누락, cafe24 private 일부 메서드 미검증, 하드코딩 날짜 기반 테스트의 미래 안전성 등이며 모두 비차단 수준이다. 전체적으로 이번 변경은 테스트 커버리지를 실질적으로 개선한 올바른 방향의 결과물이다.

---

## 위험도

LOW

---

STATUS=success ISSUES=0

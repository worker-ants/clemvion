# 요구사항(Requirement) 리뷰 결과

## 발견사항

### **[INFO]** README 배포 주의사항에 JWT_SECRET 최소 길이(32자 미만) 조건 누락
- 위치: `codebase/backend/README.md` line 36
- 상세: 추가된 배포 주의사항은 `JWT_SECRET·ENCRYPTION_KEY 가 미설정이거나 .env.example 기본값이면` 이라고만 기재하고 `JWT_SECRET 가 32자 미만이면` 조건이 빠져 있다. 실제 `assertProductionConfig` 는 블랙리스트 외에 `jwtSecret.length < MIN_JWT_SECRET_LENGTH(32)` 로도 throw 하며, spec(`spec/5-system/1-auth.md` §Rationale line 560)도 "32자 미만(CWE-521)" 를 명시한다. 운영자가 32자 미만의 커스텀 secret 을 설정했을 때 부팅 거부 이유를 README 에서 유추할 수 없다.
- 제안: README 주의 문구에 "또는 32자 미만" 조건을 추가. 예: `JWT_SECRET·ENCRYPTION_KEY 가 미설정이거나 .env.example 기본값이면, JWT_SECRET 가 32자 미만이면, 또는 MCP_ALLOW_INSECURE_URL=true 이면`

### **[INFO]** README 배포 주의사항에 OAUTH_STUB_MODE / LLM_STUB_MODE 조건 미언급
- 위치: `codebase/backend/README.md` line 36
- 상세: `assertProductionConfig` 는 `OAUTH_STUB_MODE=true` / `LLM_STUB_MODE=true` 도 production 부팅 거부 조건에 포함하지만(가드 내 첫 검사) README 에는 언급이 없다. 개발 환경 변수가 실수로 운영 배포에 포함된 경우를 인지하지 못한 운영자는 부팅 실패 원인을 README 에서 찾을 수 없다. stub 플래그는 운영자보다 개발자 관련성이 높아 우선순위가 낮으나 문서 불완전성은 존재한다.
- 제안: `OAUTH_STUB_MODE=true 또는 LLM_STUB_MODE=true 이면` 조건을 README 주의 문구에 추가 (INFO 수준이므로 현행 유지도 무방).

### **[INFO]** `jwtConfig()` 직접 호출 관련 테스트 주석 부정확
- 위치: `production-guards.spec.ts` lines 221-222 (추가된 `INSECURE_JWT_SECRETS contains the jwt.config.ts dev fallback` 테스트 주석)
- 상세: 주석이 "jwtConfig() 를 직접 호출하면 registerAs 래퍼가 개입하므로" 라고 하나 NestJS `registerAs` 는 `configFactory` 를 그대로 반환한다(`register-as.util.js` line 28: `return configFactory`). 즉 `jwtConfig()` 는 래퍼 개입 없이 팩토리 함수를 직접 호출하는 것과 동일하다. 기능적으로는 정상 동작하지만 주석이 독자를 오해하게 한다.
- 제안: 주석을 "jwtConfig 는 registerAs 가 반환한 팩토리 함수 자체이므로 직접 호출 가능" 으로 수정.

---

## 요약

이번 변경은 `production-guards.ts`에 `@throws`/`@param`/`@returns` JSDoc 보강, 테스트 파일에 `isFlagOn` 독립 단위 테스트 블록·`ENCRYPTION_KEY` 긍정 케이스·`.env.example` + `jwt.config.ts` 블랙리스트 동기화 회귀 테스트 추가, `README.md`에 배포 주의사항 1줄 추가로 구성된다. 핵심 비즈니스 로직(`assertProductionConfig`, `isFlagOn`, 블랙리스트 Set)은 변경 없고 기존에 이미 검증돼 있다. 신규 테스트는 의도한 기능(블랙리스트 동기화·`isFlagOn` 계약·`ENCRYPTION_KEY` 긍정 케이스)을 정확히 커버하며, spec(`spec/5-system/1-auth.md §Rationale`, `spec/5-system/11-mcp-client.md`, `spec/conventions/secret-store.md`) 요구사항과 line-level 로 일치한다. CRITICAL/WARNING 수준의 요구사항 위반은 없으며, README 주의 문구가 JWT_SECRET 최소 길이 조건을 누락한 점과 테스트 주석 오류가 INFO 수준으로 잔존한다.

## 위험도

LOW

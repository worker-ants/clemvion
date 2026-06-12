# 문서화(Documentation) 리뷰 — refactor-04-security (2차 라운드)

이전 라운드(19:49:22)에서 문서화 관련 발견사항들이 이미 식별됐고, RESOLUTION.md 를 통해 일부가 처리됐다.
이번 라운드(20:32:29)는 새로 추가된 파일(`.env.example`, `cors-origins.*`, `auth.controller.*`,
`refresh-cookie.*`, `client-ip.*`, `hooks.*`, `public-webhook-throttle.*`)에 대한 문서화 관점 추가 검토다.

## 발견사항

### **[INFO]** `.env.example` — ENABLE_SWAGGER_IN_PROD 추가 확인 (이전 라운드 I2 처리 완료)
- 위치: `codebase/backend/.env.example` L35-37
- 상세: 이전 documentation.md(19:49:22)의 INFO 발견사항("ENABLE_SWAGGER_IN_PROD 가 .env.example 누락")이
  RESOLUTION.md 에 따라 처리됐다. `.env.example` diff 에 `ENABLE_SWAGGER_IN_PROD` 주석 플레이스홀더가 정상
  추가되어 있으며, 보안 컨텍스트(무인증 노출 위험 복귀)까지 설명한다. 처리 완료.
- 제안: 없음.

### **[INFO]** `.env.example` — `COOKIE_SAMESITE`, `TRUST_CF_CONNECTING_IP` 설명 적절
- 위치: `codebase/backend/.env.example` L43-51
- 상세: `COOKIE_SAMESITE`(04 M-5)와 `TRUST_CF_CONNECTING_IP`(04 m-3) 두 신규 환경변수 모두 주석
  플레이스홀더로 추가됐다. 각 주석에 기본값, 동작, 보안 상충관계, 활성화 전제조건이 기술되어 있다.
  문서화 품질 우수.
- 제안: 없음.

### **[INFO]** `refresh-cookie.ts` — `getRefreshCookieSameSite` JSDoc 충실, `setRefreshTokenCookie` JSDoc 누락
- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts`
- 상세: `getRefreshCookieSameSite` 는 JSDoc 이 충실하게 작성됐다(반환 타입, 기본값 근거, CSRF 보완 언급).
  그러나 `setRefreshTokenCookie` 와 `clearRefreshTokenCookie` 는 변경 전부터 JSDoc 이 없었으며,
  이번 변경에서도 추가되지 않았다. 두 함수는 `export` 공개 함수로, 파라미터 `options.rememberMe`,
  `options.cookieDomain` 의 의미와 side effect(쿠키 경로 `/api/auth` 한정)가 코드만으로는 바로
  파악되지 않는다.
- 제안: `setRefreshTokenCookie` 에 최소한 `@param`, `@remarks` 수준 JSDoc 을 추가한다.

### **[WARNING]** `refresh-cookie.ts` — `clearRefreshTokenCookie` 에 "경로 일치" 제약 경고 주석 부재
- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` `clearRefreshTokenCookie` 함수
- 상세: `COOKIE_PATH = '/api/auth'` 변경은 04 M-5 보안 강화(쿠키 경로 축소)의 핵심이다. 상수 바로
  위 주석에는 설명이 있지만, `clearRefreshTokenCookie` 함수 자체에는 "set 과 동일한 path 를 써야
  쿠키 삭제가 동작한다"는 제약이 함수 수준 주석으로 명시되지 않는다. 만약 미래 기여자가
  `clearRefreshTokenCookie` 의 path 를 실수로 `/` 로 변경하면 refreshToken 삭제가 실패한다
  (보안/UX 버그 — logout 후 쿠키가 잔존). 상수 선언부 주석(`// set/clear 가 동일 path 를 써야
  clear 가 동작한다`)만으로는 함수 호출부 가독성이 낮다.
- 제안: `clearRefreshTokenCookie` 상단에
  `// IMPORTANT: path must match setRefreshTokenCookie's COOKIE_PATH ('/api/auth') —`
  `// mismatched path silently fails to clear the cookie (browser ignores mismatched-path clear).`
  수준의 경고 주석을 추가한다.

### **[INFO]** `client-ip.ts` — `shouldTrustCfConnectingIp` JSDoc 우수, `extractClientIp` 주석 업데이트 확인
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts`
- 상세: 신규 `shouldTrustCfConnectingIp` 함수에 JSDoc 이 충실하다(기본 off 이유, 위변조 가능성,
  활성화 전제). `extractClientIp` 의 SECURITY 주석도 04 m-3 를 반영해 갱신됐다. 기존 "운영 환경은
  Cloudflare 무료 플랜 뒤에 있다" 문장이 삭제되고 더 정확한 설명으로 교체됐다.
- 제안: 없음.

### **[INFO]** `auth.controller.ts` — CSRF 방어 인라인 주석 적절
- 위치: `codebase/backend/src/modules/auth/auth.controller.ts` refresh 메서드 추가 블록
- 상세: `// 04 M-5 — CSRF 차단: ...` 주석이 쿠키 자동 첨부 위협 모델, defense-in-depth 성격,
  Origin 부재 시 same-origin 판정 등을 상세히 설명한다. 보안 의도 문서화 우수.
- 제안: 없음.

### **[INFO]** `cors-origins.ts` — `isOriginAllowed` JSDoc 갱신 적절
- 위치: `codebase/backend/src/common/utils/cors-origins.ts` `isOriginAllowed` JSDoc
- 상세: null-origin 거부 동작이 JSDoc bullet point 로 추가됐다(`'null'` 불투명 origin 거부,
  04 M-5 참조). 인라인 주석도 이유(sandbox iframe/data:/file:, null-origin CSRF)를 명확히 설명한다.
- 제안: 없음.

### **[INFO]** `hooks.service.ts` / `public-webhook-throttle.guard.ts` — `extractClientIp` JSDoc 업데이트 적절
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts`, `public-webhook-throttle.guard.ts`
- 상세: 양 파일의 `extractClientIp` JSDoc 이 모두 "(신뢰 시)" 조건 및 04 m-3 보안 노트로 업데이트됐다.
  `public-webhook-throttle.guard.ts` 는 중복 구현 언급("추후 공용 util 추출 후보")도 유지된다.
- 제안: 없음.

### **[INFO]** spec 갱신 후행 항목 — M-5, m-3 항목 추가 필요
- 위치: `plan/in-progress/refactor/04-security.md`
- 상세: 이전 라운드에서 이미 식별된 spec 갱신 `⏳` 4건(M-1/M-3/M-6/m-1) 외에, 이번 라운드에서 추가된
  04 M-5(COOKIE_SAMESITE, refresh 쿠키 경로 축소, CSRF Origin 검증), 04 m-3(TRUST_CF_CONNECTING_IP),
  cors null-origin 거부에 대한 spec 갱신 여부도 확인이 필요하다. spec/5-system/1-auth.md 및
  spec/conventions/ 에 새 환경변수와 보안 정책이 반영됐는지 planner 에게 확인을 위임한다.
- 제안: planner 위임 확인.

---

## 요약

이번 2차 라운드(20:32:29)에서 추가된 파일들의 문서화 품질은 전반적으로 양호하다. `.env.example` 의
신규 환경변수(`ENABLE_SWAGGER_IN_PROD`, `COOKIE_SAMESITE`, `TRUST_CF_CONNECTING_IP`) 모두 보안
상충관계와 기본값을 설명하는 주석 플레이스홀더로 문서화됐다. `client-ip.ts` 의 `shouldTrustCfConnectingIp`,
`cors-origins.ts` 의 `isOriginAllowed`, `refresh-cookie.ts` 의 `getRefreshCookieSameSite` 는 JSDoc 이
충실하다. 인라인 주석도 보안 의도(04 M-5 CSRF, 04 m-3 CF 헤더 신뢰, null-origin CSRF)를 spec 참조와 함께
명시한다. 주요 미비사항은 두 가지다: (1) `clearRefreshTokenCookie` 에 "set/clear 경로 일치" 제약에 대한
경고 주석이 없어 미래 기여자가 실수로 path 를 변경해 logout 쿠키 삭제 실패를 유발할 위험이 있다(WARNING).
(2) `setRefreshTokenCookie` / `clearRefreshTokenCookie` 공개 함수에 JSDoc 이 없다(INFO). spec 갱신 후행
항목(M-5, m-3 포함)은 planner 위임 확인이 필요하다.

## 위험도

LOW

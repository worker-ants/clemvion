# Security Review

## 발견사항

### 인젝션 취약점

- **[INFO]** 신규 코드에서 SQL 인젝션·커맨드 인젝션·경로 탐색 등의 인젝션 취약점은 발견되지 않았다. `totp.service.ts` 의 입력(`code`, `userId`)은 ORM 계층과 정규식(`/^\d{6}$/`)을 통해 처리되며 직접 SQL 조합이 없다.

### 하드코딩된 시크릿

- **[INFO]** `totp.service.ts` 의 `ISSUER = 'Clemvion'` 은 TOTP 앱 표시명이며 시크릿이 아니다. TOTP secret 자체는 `generateSecret()` 으로 런타임에 생성되고 DB에 저장된다. 하드코딩된 비밀번호·API 키·토큰은 발견되지 않았다.

### 인증/인가

- **[WARNING]** TOTP verify 경로에 레이트 리밋(brute-force 방지) 여부가 이 diff 범위에서 확인되지 않는다.
  - 위치: `codebase/backend/src/modules/auth/totp.service.ts` — `verifyAndEnable`, `verifyForLogin`
  - 상세: 6자리 TOTP 코드는 현재 time-step 기준 최대 10^6 조합이다. 컨트롤러 레벨에서 NestJS Throttler 또는 passport rate-limit 이 적용되어 있다면 문제없으나, 이 diff 만으로는 그 존재가 확인되지 않는다.
  - 제안: `verifyAndEnable`·`verifyForLogin` 을 호출하는 컨트롤러 엔드포인트에 `@Throttle()` 데코레이터(NestJS throttler)가 적용되어 있는지 확인한다. 적용되지 않았다면 추가한다.

- **[INFO]** `verifyForLogin` 은 `user.twoFactorEnabled` 가 false 이면 즉시 `false` 를 반환하고 throw 하지 않는다. 2FA 비활성 사용자의 로그인 흐름(패스워드 단독)이 상위 auth 서비스에서 올바르게 처리되는지 이 diff 범위를 벗어나므로, 현재 변경 자체는 정상이다.

- **[INFO]** 복구 코드 소비는 단일 `indexOf` + DB 업데이트로 처리된다. 동시 요청 race condition(두 요청이 동시에 같은 복구 코드를 제출)이 발생할 수 있으나, 실제 위협 가능성이 매우 낮고(복구 코드 자체가 일회성 비상 수단) 이 diff 범위의 변경은 아니다. 필요 시 DB 트랜잭션 또는 낙관적 잠금으로 강화할 수 있다.

### 입력 검증

- **[INFO]** `verifyForLogin` 에서 6자리 숫자 TOTP 코드인지 `code.trim()` 후 `/^\d{6}$/` 정규식으로 선검증한다. 이 조건을 통과하지 못한 입력은 복구 코드 경로로 분기된다. 입력 길이 제한이 명시적으로 없으나, 복구 코드도 `createHash` 입력이므로 임의로 긴 문자열이 들어와도 DoS 위험은 낮다. 다만 컨트롤러에서 DTO 레벨 길이 검증을 추가하는 것이 권장된다.

- **[INFO]** `totp.service.ts`의 `setup` 메서드는 사용자 이메일(`user.email`)을 `generateURI` 의 `label` 필드에 직접 전달한다. `otpauth://` URI 는 URL-encoded 이므로 XSS 위험은 없으나, 이메일이 공격자 제어값이 될 경우 QR 코드 표시명이 오염될 수 있다. 실제 위험도는 낮으나(인증된 사용자 자신의 이메일) 현황 인지용으로 기록한다.

### OWASP Top 10

- **[WARNING]** TOTP 검증 실패 시 `logger.warn` 에 `(err as Error).message` 가 포함된다.
  - 위치: `codebase/backend/src/modules/auth/totp.service.ts`, `verifyCode` 메서드 (라인 54–56)
  - 상세: 현재 로그는 서버 사이드 `Logger`(NestJS 기본 로거)로만 출력되며 클라이언트에는 노출되지 않는다. 그러나 에러 메시지(`SecretTooShortError` 등 otplib 내부 에러)가 로그 집계 시스템에 유입될 수 있다. 이는 정보 노출(OWASP A09 Security Logging and Monitoring)의 경계에 있다.
  - 제안: 에러 메시지를 직접 로깅하는 대신 `err.constructor.name` 또는 사전 정의된 에러 코드만 로깅하거나, log level 을 `debug` 로 낮춰 프로덕션에서 억제하는 것을 고려한다.

- **[INFO]** `spec/7-channel-web-chat/4-security.md` 의 §1.1 sanitize 정책 매트릭스 추가는 XSS 방어 정책(OWASP A03)을 문서화한다. DOMPurify deny-by-default + `ALLOWED_URI_REGEXP` 구성과 react-markdown의 `rehype-raw` 미사용 방침은 모두 안전한 설계 원칙에 부합한다.

### 암호화

- **[INFO]** otplib v13 으로의 업그레이드는 내부적으로 `@otplib/plugin-crypto-noble`(`@noble/hashes` v2) 과 `@otplib/plugin-base32-scure`(`@scure/base`) 를 사용한다. 기존 v12 는 Node.js 내장 `crypto` 모듈을 사용했으나, v13 은 순수 JS 구현의 noble/scure 라이브러리로 전환됐다. noble/hashes 는 상수 시간 구현으로 타이밍 공격 저항성이 있으며, 감사된 라이브러리다. 보안상 퇴보 없음.

- **[INFO]** `thirty-two` 라이브러리(구 base32 구현, 마지막 업데이트 2014년)가 제거됐다. 오래되고 유지보수가 중단된 패키지를 `@scure/base` 로 대체한 것은 공급망 보안 관점에서 개선이다.

- **[INFO]** 복구 코드는 `createHash('sha256')` 으로 해시되어 저장된다. 복구 코드 자체가 `randomBytes(9)` 기반 72비트 엔트로피를 가지므로 rainbow table 공격이 현실적이지 않다. 다만 SHA-256 은 bcrypt/argon2 같은 KDF 가 아니므로, DB 덤프 시 GPU 기반 전수 조사가 이론적으로 가능하다. 복구 코드의 짧은 수명과 일회성 특성을 고려하면 현재 설계는 수용 가능하나, 장기적으로는 KDF 전환을 검토할 수 있다.

### 에러 처리

- **[INFO]** `verifyCode` 에서 otplib 의 `SecretTooShortError` 등 예외를 catch 해 500 대신 `false` 를 반환한다. 이는 에러 전파로 인한 정보 노출을 차단하는 올바른 패턴이다. `BadRequestException`·`UnauthorizedException` 의 에러 바디(`code` + `message`)는 클라이언트에 필요한 최소 정보만 포함하며, 스택 트레이스가 포함되지 않는다.

### 의존성 보안

- **[INFO]** otplib `^12.0.1` → `^13.4.1` 업그레이드: v12 의 `@otplib/plugin-crypto`·`@otplib/plugin-thirty-two`·`@otplib/preset-default`·`@otplib/preset-v11` 은 모두 deprecated 마크가 붙어 있었다. v13으로 업그레이드해 이 deprecation 을 해소했다. 알려진 CVE 는 없으나 유지보수 단절 리스크가 제거됐다.

- **[INFO]** `@types/node` `^22` → `^24` 업그레이드는 타입 정의 패키지로 런타임에 포함되지 않는다. 보안 영향 없음.

- **[INFO]** `jsdom` `^25` → `^29.0.1` 업그레이드(channel-web-chat, dev 전용): jsdom 은 테스트 환경에만 사용된다. v25 에서 v29 로의 업그레이드는 최신 보안 패치를 포함할 가능성이 높으며, 프로덕션 런타임에는 포함되지 않는다.

- **[INFO]** `@vitejs/plugin-react` `^4` → `^6.0.1` 업그레이드(dev 전용): 빌드 도구이며 프로덕션 번들에 직접 포함되지 않는다. Babel 의존성이 제거되고 oxc/rolldown 기반으로 전환됐다. 보안 영향 없음.

- **[INFO]** `dayjs` `^1.11.13` → `^1.11.20` 업그레이드(expression-engine): 날짜 처리 라이브러리로 알려진 보안 취약점 없음. 패치 버전 범위 업그레이드.

- **[INFO]** `uglify-js` 의 `"dev": true` 플래그가 제거됐다. 이 패키지는 `optional: true` 이므로 필수 의존성이 아니며, 실제로는 빌드 최적화 용도로 사용된다. 프로덕션 번들 포함 여부를 확인해야 한다. 단, uglify-js 자체는 알려진 고위험 CVE 없음.

## 요약

이번 변경의 보안 관련 핵심은 otplib v12 → v13 메이저 업그레이드다. v13은 deprecated 된 내부 플러그인을 제거하고 noble/scure 라이브러리(상수 시간 구현, 독립 감사)로 교체했으며, 기존 secret 포맷과의 하위 호환성도 RFC 6238 표준 벡터로 검증됐다. `verifyCode` 메서드는 otplib 내부 예외를 안전하게 catch 해 500 에러 노출을 방지하는 올바른 방어적 코딩을 채택했다. 복구 코드는 SHA-256 해시로만 저장되고 평문은 일회성 반환된다. spec §1.1 의 sanitize 정책 매트릭스 추가는 XSS 방어 설계를 문서화해 향후 렌더러 추가 시 참조 기준을 명확히 한다. 주요 잔여 우려는 TOTP 검증 엔드포인트에 대한 레이트 리밋 적용 여부(컨트롤러 레벨 확인 필요)이며, 에러 메시지 로깅에서 내부 에러 타입이 로그에 유출될 수 있는 정보 노출 위험이 낮은 수준으로 존재한다.

## 위험도

LOW

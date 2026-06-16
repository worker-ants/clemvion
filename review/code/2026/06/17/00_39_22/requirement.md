# 요구사항(Requirement) Review

## 발견사항

### [INFO] otplib v13 API 마이그레이션 — spec 에 라이브러리 레벨 상세 없음
- 위치: `codebase/backend/src/modules/auth/totp.service.ts`, `codebase/backend/package.json`
- 상세: `spec/5-system/1-auth.md §1.4` 는 otplib 특정 버전·API 이름(`authenticator`, `generateSecret`, `verifySync`)을 기술하지 않는다. 라이브러리 버전 선택은 구현 세부로 spec 밖이다. v13 의 `generateSecret`, `generateURI`, `verifySync` 로 교체한 것은 spec 의 요구사항(RFC 6238, 6자리, 30초 step, Google Authenticator 호환)을 모두 충족한다.
- 제안: 이상 없음.

### [INFO] `EPOCH_TOLERANCE_SECONDS = 30` 의 의미 — v12 `window:1` 동등성
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` line 19
- 상세: otplib v13 README 및 `OTPVerifyOptions` 타입 정의에서 `epochTolerance` 는 **초 단위** 대칭 허용 오차이고, 30초는 period 한 step(±1 step)에 해당한다. 코드 주석에 "v12 `window:1` 와 동등"이라고 명시되어 있어 의도와 구현이 일치한다. spec §1.4 에는 "Google Authenticator 호환" 만 요구하므로 ±1 step 은 업계 표준과 일치한다.
- 제안: 이상 없음.

### [WARNING] `verifySync` 반환값 `VerifyResult` — `.valid` 접근이 TOTP/HOTP 공용 유니온 타입
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` line 48–52
- 상세: `verifySync(options: OTPVerifyOptions): VerifyResult` 의 `VerifyResult` 는 `VerifyResult$1 (TOTP) | VerifyResult$2 (HOTP)` 유니온이다. `strategy` 를 생략하면 기본값 `'totp'` 이므로 TOTP 경로가 선택되고 `.valid` 필드가 존재한다. 하지만 TypeScript 에서 유니온의 `.valid` 가 양쪽 모두에 정의돼 있는지 컴파일 타임 보장을 확인할 필요가 있다. 런타임에는 기본값으로 인해 실제 문제가 없지만 타입 안전성 관점에서 `strategy: 'totp'` 를 명시하면 의도가 더 명확해진다.
- 제안: `verifySync({ secret, token, epochTolerance: EPOCH_TOLERANCE_SECONDS, strategy: 'totp' as const }).valid` 로 strategy 를 명시.

### [INFO] `verifyForLogin` — 복구 코드 포맷 검증 없음(설계 의도 확인 필요)
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` line 133–151
- 상세: `verifyForLogin` 은 6자리 숫자인 경우만 TOTP 경로를, 나머지는 무조건 복구 코드 경로로 분기한다(`/^\d{6}$/` 조건). `xxxx-xxxx-xxxx` 포맷이 아닌 임의 문자열이 들어와도 SHA-256 해시 비교를 수행한다. spec §1.4.1 은 복구 코드 포맷을 `xxxx-xxxx-xxxx` (소문자 영숫자 12자리 + 하이픈)으로 정의하지만, 포맷 불일치 시 해시 비교가 false 를 반환하므로 기능 정합성 문제는 없다. 다만 조기 반환으로 불필요한 해시 계산을 방지하는 방어 코드가 없다. INFO 수준.
- 제안: 설계 의도(모든 비-TOTP 입력을 복구 코드로 시도)가 명확하다면 현 상태 유지. 성능상 이슈가 없으므로 허용 가능.

### [INFO] `setup` — 이미 활성화된 사용자의 재설정 플로우
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` line 65–84
- 상세: `twoFactorEnabled = true` 인 사용자도 `setup` 을 호출하면 새 secret 이 덮어씌워진다. spec §1.4 는 비활성화 흐름(비밀번호 재확인 + 코드 입력)만 정의하고, 활성화 중 재발급 가드를 코드 레이어에 두어야 하는지는 spec 이 침묵한다. 컨트롤러(auth.controller)에서 이 가드를 처리한다면 서비스 레이어는 현재 구현이 적절하다. spec 은 이 세부 flow 를 정의하지 않으므로 INFO.
- 제안: 컨트롤러 레이어에서 `twoFactorEnabled` 체크 여부를 확인. 서비스 단독 테스트에서는 이 케이스 커버리지 미비이나 기능 오동작은 없다.

### [INFO] `@noble/hashes` v2.x — `node >= 20.19.0` 엔진 요구사항
- 위치: `codebase/backend/package-lock.json` `node_modules/@otplib/plugin-crypto-noble/node_modules/@noble/hashes`
- 상세: otplib v13 의 `@noble/hashes` v2.2.0 는 `node >= 20.19.0` 을 요구한다. `codebase/backend/package.json` 은 `engines: { "node": ">=24" }` 로 선언하므로 이 제약이 충족된다. 단, PROJECT.md 의 버전 정책("내부 앱 `>=24`")과도 정합성이 있다.
- 제안: 이상 없음.

### [INFO] RFC 6238 테스트 벡터 `RFC6238_SECRET_B32` — 16바이트 미만 예외 처리 검증
- 위치: `codebase/backend/src/modules/auth/totp.service.spec.ts` line 764–772
- 상세: "손상·과소 secret 은 검증 throw 없이 false" 테스트(`secret: 'AA'`)는 v13 의 `SecretTooShortError` 를 `verifyCode` 의 catch 블록이 삼켜 false 반환함을 검증한다. 이는 500 오류 방지라는 spec 의 안전 요구사항(§1.4 — 인증 서비스는 다운되지 않아야 함)을 올바르게 구현하고 있다. RFC 6238 표준 벡터(`GEZDGNBVGY3TQOJQ`)는 20바이트이므로 정상 경로 테스트 벡터로도 적합하다.
- 제안: 이상 없음.

### [INFO] [SPEC-DRIFT] `spec/7-channel-web-chat/4-security.md` 보안 표 업데이트 — 코드 변경 없는 spec 단독 수정
- 위치: `spec/7-channel-web-chat/4-security.md` line 36
- 상세: 이번 변경에는 `codebase/channel-web-chat` 의 XSS sanitize 코드 변경이 없다. spec 의 "입력 sanitize" 행이 `deny-by-default 화이트리스트(DOMPurify ALLOWED_TAGS/ALLOWED_ATTR + ALLOWED_URI_REGEXP) + javascript:/data: 차단` 으로 구체화됐는데, 실제 구현이 이를 이미 따르고 있는지, 아니면 요구사항을 확장한 것인지 확인이 필요하다. 코드 없는 spec 강화는 spec-drift 가 아니라 신규 요구사항 추가일 수 있으며 구현을 강제한다.
- 제안: `codebase/channel-web-chat` 의 DOMPurify 설정 코드(`ALLOWED_TAGS`/`ALLOWED_URI_REGEXP` 명시)가 이 spec 기술과 일치하는지 별도 검증 필요. 구현이 미달이면 별도 task 생성.

### [INFO] [SPEC-DRIFT] NODE.js 버전 정책 명시 — PROJECT.md 신규 섹션
- 위치: `PROJECT.md` 버전·도구 정책 섹션
- 상세: "내부 앱 `>=24` / 외부 SDK `>=20`" 이원화 정책이 PROJECT.md 에 추가됐다. 이 정책을 정의하는 공식 spec 문서가 없어 PROJECT.md 가 단독 SoT 역할을 하고 있다. `spec/0-overview.md` 나 `spec/conventions/` 에 이 정책의 공식 위치가 없으므로 현재는 INFO. 향후 일관성 검토(consistency-check)에서 spec vs PROJECT.md 정합 이슈로 부상할 수 있다.
- 제안: 운영·빌드 정책은 PROJECT.md 에 두는 것이 프로젝트 관행과 일치하므로 현 위치 적절. `spec/0-overview.md` 에 cross-ref 추가를 고려.

### [INFO] `auth.service.spec.ts` — `eslint-disable` 주석 제거 및 `(jest.Mock)` cast 완화
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` line 577, 585–588
- 상세: `// eslint-disable-next-line @typescript-eslint/no-unused-vars` 제거는 해당 변수(`jwtService`)가 이제 실제로 사용됨을 의미하거나 lint 경고가 사라진 것으로, 기능 요구사항과 무관한 코드 품질 정리다. `sessionsService.revokeAllFamilies.mock.invocationCallOrder[0]` 로의 단순화도 `jest.Mocked<T>` 타입에서 `.mock` 이 이미 노출되므로 올바른 방향이다.
- 제안: 이상 없음.

### [INFO] `production-guards.ts` / `production-guards.spec.ts` — 포매팅 전용 변경
- 위치: 두 파일 모두
- 상세: Prettier/ESLint 의 라인 길이 한도에 따른 파라미터 줄바꿈만 수행. 동작 변경 없음.
- 제안: 이상 없음.

---

## 요약

이번 변경의 핵심은 두 가지다: (1) `otplib` v12 → v13 메이저 업그레이드 및 관련 jest `transformIgnorePatterns` 확장, (2) 내부 앱 Node.js 엔진 플로어를 `>=24` 로 일원화하고 정책을 PROJECT.md 에 문서화. 요구사항 충족 관점에서 `TotpService` 구현은 spec §1.4 의 핵심 요구사항(RFC 6238 호환, 6자리, 30초 step, 복구 코드 10개 SHA-256 해시 저장, 사용 시 제거)을 모두 충족한다. v13 API 변경(`authenticator` 객체 → flat 함수 export)은 올바르게 처리됐으며, `epochTolerance: 30` 은 v12 `window: 1` 과 정확히 동등하다. 손상 secret 에 대한 방어 코드(try-catch)도 새로 추가됐다. `@noble/hashes` v2 의 `node >= 20.19.0` 엔진 요구사항은 선언된 `engines.node >=24` 로 충족된다. 채널 웹챗 보안 spec 업데이트(`deny-by-default XSS 화이트리스트`)에 대응하는 실제 코드 변경이 이번 diff 에 없으므로 구현 충족 여부는 별도 확인이 필요하다.

## 위험도

LOW

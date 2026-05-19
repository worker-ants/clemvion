# 보안(Security) 코드 리뷰

## 발견사항

### 1. 의존성 보안

- **[WARNING]** `otplib@12.0.1` (직접 의존성) — v13 미만은 공식적으로 더 이상 지원되지 않음
  - 위치: `codebase/backend/package.json` line 65
  - 상세: 빌드 로그(`e2e-20260519-212743.log` line 189)에 `@otplib/preset-default@12.0.1`, `@otplib/plugin-thirty-two@12.0.1`, `@otplib/plugin-crypto@12.0.1` 에 대해 "Please upgrade to v13" deprecation 경고가 출력됨. otplib v12는 TOTP/HOTP 2FA 처리에 사용되는 라이브러리로, 지원 중단 이후 보안 패치가 적용되지 않을 수 있다.
  - 제안: `otplib`을 v13 이상으로 업그레이드하고 관련 마이그레이션 가이드(`https://github.com/yeojz/otplib`) 적용.

- **[WARNING]** `glob` 다중 구버전 포함 (transitive 의존성)
  - 위치: `_test_logs/e2e-20260519-212743.log` line 181-188 (npm audit 로그)
  - 상세: `glob@7.2.3` 및 `glob@10.5.0`(5건)에 대해 "widely publicized security vulnerabilities" 경고. glob은 직접 의존성이 아닌 transitive 의존성이나, `npm audit`에서 15 moderate severity vulnerabilities가 보고됨.
  - 제안: `npm audit fix`를 실행하여 자동 해결 가능한 취약점을 처리하고, 이후 `npm audit`으로 잔여 이슈를 검토.

- **[WARNING]** `inflight@1.0.6` — 메모리 리크 및 더 이상 지원되지 않음
  - 위치: `_test_logs/e2e-20260519-212743.log` line 180
  - 상세: 보안 취약점보다는 메모리 리크 이슈이나, 지원이 중단된 라이브러리가 프로덕션 빌드에 포함됨. 잔류 의존성 그래프 정리 필요.
  - 제안: 최상위 의존성 중 `inflight`를 직접 참조하는 패키지를 식별하여 업그레이드.

### 2. 자격증명 암호화 — 키 부재 시 평문 저장

- **[WARNING]** `INTEGRATION_ENCRYPTION_KEY` 미설정 시 자격증명이 평문으로 DB에 저장됨
  - 위치: `/codebase/backend/src/modules/integrations/services/credentials-transformer.ts` line 44-57
  - 상세: `getKey()`가 `INTEGRATION_ENCRYPTION_KEY` 환경변수를 읽지 못하면 `null`을 반환하고, `encryptJson()`은 키 없이 평문 JSON을 그대로 저장한다(`if (!key) return json;` line 99). 코드 자체가 경고 메시지를 출력하나 저장 자체는 차단하지 않아 개발 환경에서 프로덕션 DB를 잘못 연결한 경우 자격증명이 노출될 수 있다. 단위 테스트 로그에서도 이 경고가 실제로 발화되는 것이 확인됨(`unit-20260519-212701.log` line 670).
  - 제안: 프로덕션 환경(`NODE_ENV === 'production'`)에서는 키 미설정 시 애플리케이션 시작을 차단하도록 `onApplicationBootstrap` 훅에서 검증 추가. 개발 환경에서는 현재처럼 경고로 유지 가능.

### 3. JWT 서명 검증 없음 — 설계적 수용이나 문서화 권고

- **[INFO]** `parseJwtExp()` 는 서명 없이 JWT payload를 디코드함
  - 위치: `/codebase/backend/src/modules/integrations/jwt-exp.ts` (전체 파일)
  - 상세: 코드 자체에 상세한 설명 주석이 있고("Cafe24 API 가 호출 시점에 자체 검증한다"), 설계적 결정으로 문서화되어 있음. 이 함수의 역할은 만료 시각 메타데이터 추출이지 인증이 아니므로 보안 취약점이 아님. 다만 추후 유지보수자가 이 함수를 인증 목적으로 오용할 위험이 있다.
  - 제안: 현재 주석 수준은 충분함. 함수 이름이나 주석에 "NO_SIG_VERIFY — for expiry metadata only, not authentication" 같은 한 줄 요약 태그를 추가하면 오용 방지에 도움이 됨.

### 4. HTTP 폴백 URL

- **[INFO]** 환경변수 미설정 시 `http://localhost:3000`(HTTP) 폴백 사용
  - 위치: `/codebase/backend/src/modules/integrations/integration-oauth.service.ts` line 1337
  - 상세: `FRONTEND_URL` 또는 `APP_URL` 환경변수가 없으면 `http://localhost:3000`으로 리다이렉트 URL을 구성한다. 프로덕션에서는 반드시 환경변수가 설정되어야 하며, 누락 시 OAuth 콜백이 비암호화 로컬 주소로 향하게 된다. 단, 이 폴백은 명백히 개발용 로컬 주소이므로 실수로 프로덕션에서 사용되더라도 실제 트래픽이 외부 HTTP로 전송되지는 않는다.
  - 제안: 프로덕션 배포 체크리스트에 `FRONTEND_URL` 필수 검증 항목 추가. 또는 `NODE_ENV === 'production'`에서 폴백 값 사용 시 ERROR 로그 발화.

### 5. 에러 메시지 새니타이징

- **[INFO]** `sanitizeLastErrorMessage()` 구현 — 양호
  - 위치: `/codebase/backend/src/shared/utils/sanitize-error-message.ts`
  - 상세: `Bearer` 토큰, `client_secret`, `access_token`, `refresh_token`, `api_key`, `password`, `Authorization` 헤더 값 등을 정규식으로 마스킹하고 200자로 잘라냄. `SECRET_LEAK_PATTERNS` 배열이 잘 구성되어 있음. 단위 테스트 로그에서도 실제 preview 토큰 처리 시 `[security] preview row credentials is plaintext (no 'enc:' prefix) — refusing to consume` 경고가 올바르게 발화됨을 확인.
  - 제안: 없음. 현재 구현 양호.

### 6. MCP 통합 — HTTP URL 차단 확인

- **[INFO]** MCP 통합에서 `http://` URL 사용 시 차단됨 — 양호
  - 위치: 단위 테스트 로그 line 798 (`unit-20260519-212701.log`)
  - 상세: `MCP integration URL must use https: (got http://insecure.example.com)` 경고가 테스트에서 정상적으로 발화됨을 확인. HTTPS 강제 정책이 구현되어 있음.
  - 제안: 없음.

### 7. WebAuthn 카운터 회귀 탐지 — 양호

- **[INFO]** WebAuthn credential counter regression 시 자격증명 삭제 및 세션 전체 폐기
  - 위치: 단위 테스트 로그 line 878 (`unit-20260519-212701.log`)
  - 상세: `WebAuthn counter regression detected for user user-uuid-1, credential cred-uuid-1 — credential deleted, all sessions revoked` 로그가 발화됨. FIDO2 스펙에서 요구하는 클론 탐지(counter regression = 자격증명 복제 의심)에 대한 올바른 대응.
  - 제안: 없음.

### 8. Cafe24 HMAC 검증 실패 로그 — 주의

- **[WARNING]** HMAC 검증 실패 시 로그에 `dbMallId`, `dbAppType`, `status` 등 내부 정보가 포함됨
  - 위치: 단위 테스트 로그 lines 656-658 (`unit-20260519-212701.log`)
  - 상세: `[cafe24-install-hmac-fail] reason=hmac_verify_failed urlMallId="priv-shop" dbMallId="priv-shop" dbAppType=private status=pending_install statusReason=null token=(present)` 형태로 DB에서 읽어온 `mall_id`, `app_type`, `status` 등이 로그에 노출됨. 이 로그가 외부에 노출되지 않는 서버 사이드 로그라면 큰 문제가 없으나, 향후 로그 집계/외부 전송 시 내부 데이터 모델이 노출될 수 있다.
  - 제안: 로그 접근 권한을 내부 운영팀으로 제한하고, 외부 전송(APM, SIEM 등) 시 민감 필드(`dbMallId`, `dbAppType`, `status`)를 마스킹하는 파이프라인 적용 고려.

### 9. 테스트 스크립트 — lint 도구 누락

- **[INFO]** `eslint: command not found` — 린트 미실행
  - 위치: `_test_logs/lint-20260519-211359.log`
  - 상세: lint 단계가 `command not found`로 실패. 린트는 직접적인 보안 취약점은 아니나, ESLint 보안 규칙(예: `eslint-plugin-security`)이 실행되지 않아 정적 보안 분석이 누락됨.
  - 제안: `codebase/backend/` 에서 `npm ci`를 로컬 또는 CI 환경에서 먼저 실행한 후 lint를 수행하도록 `.claude/test-stages.sh`의 `cmd_lint()`를 수정하거나, `eslint`를 전역이 아닌 로컬 `npx eslint`로 실행.

---

## 요약

이번 리뷰 대상은 Cafe24 OAuth 토큰 갱신 흐름(JWT `exp` claim 기반 만료 시각 파싱), 자격증명 AES-256-GCM 암호화 트랜스포머, 에러 메시지 새니타이징 유틸리티, MCP 통합 보안 검사, 그리고 관련 빌드/e2e 로그다. 전반적으로 핵심 보안 설계는 견고하다: AES-256-GCM 인증 암호화 사용, GCM authTag 검증, 민감 필드 마스킹, HTTPS 강제, WebAuthn 클론 탐지, 평문 자격증명 소비 거부 등. 주요 우려사항은 (1) `INTEGRATION_ENCRYPTION_KEY` 미설정 시 프로덕션에서 자격증명이 평문으로 저장될 수 있는 소프트 폴백, (2) 직접 의존성 `otplib@12` 가 지원 중단되어 보안 패치를 받지 못하는 상태, (3) `npm audit`이 15건의 중간 수준 취약점을 보고하고 있는 transitive 의존성 문제다. 이 세 가지 중 `otplib` 업그레이드와 `npm audit fix` 적용이 최우선 조치 대상이다.

---

## 위험도

MEDIUM

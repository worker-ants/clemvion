# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 의존성 보안 업그레이드 — 취약 버전 제거 확인
  - 위치: `codebase/backend/package.json` + `package-lock.json`
  - 상세: `ws ^8.21.0`, `@grpc/grpc-js ^1.14.4`, `multer ^2.2.0`, `form-data ^4.0.6`, `protobufjs ^7.6.3`, `nodemailer ^9.0.1` — 이전 버전에 알려진 취약점(ReDoS, DoS, 프로토타입 오염 등)이 있던 패키지들이 안전 버전으로 상향 핀됐다. `overrides` 블록과 주석(`//security-overrides`)으로 의도를 명시한 점은 양호하다.
  - 제안: 특이사항 없음. 현 상태가 적절하다.

- **[INFO]** 프론트엔드 의존성 보안 업그레이드 — XSS 방어 라이브러리 포함
  - 위치: `codebase/frontend/package.json` + `package-lock.json`
  - 상세: `dompurify ^3.4.2 → ^3.4.11` 업그레이드는 XSS 필터 우회 취약점 패치를 포함한 버전으로의 이행이다. `ws`, `form-data`, `undici`, `vite`, `@babel/core` 도 동일하게 보안 버전으로 상향됐다.
  - 제안: 특이사항 없음.

- **[INFO]** `nodemailer` 중첩 사본 강제(override)의 의도성 확인
  - 위치: `codebase/backend/package.json` overrides 블록 (nodemailer 항목)
  - 상세: `preview-email`/`mailparser`가 내부적으로 `nodemailer@8`(취약)을 설치하는 문제를 `overrides`로 9로 강제한다고 주석에 명시됐다. 이 방식은 npm overrides의 올바른 사용이며, 해당 preview 기능이 실제로 사용되지 않으므로 breaking change 위험은 낮다.
  - 제안: 향후 `preview-email`이 `nodemailer@9`를 직접 지원하면 override를 제거하여 관리 복잡도를 낮출 것을 권장한다.

- **[INFO]** `@opentelemetry/propagator-aws-xray ^2.1.4` — peer dependency 범위 주의
  - 위치: `codebase/backend/package-lock.json` (`@opentelemetry/instrumentation-aws-lambda` 신규 의존성)
  - 상세: `peerDependencies`가 `@opentelemetry/api >= 1.0.0 < 1.10.0`으로 제한된다. 현재 `@opentelemetry/api ^1.9.0`을 사용 중이므로 경계값에 해당한다. 보안 취약점은 없으나 버전 충돌 시 OTel 계측이 무음으로 비활성화될 수 있다.
  - 제안: `npm ls @opentelemetry/api`로 실제 해결 버전을 확인하고, `>=1.10.0` 지원 버전이 출시되면 업그레이드를 추적할 것.

- **[INFO]** 하드코딩된 시크릿 없음
  - 상세: 변경된 파일은 전부 `package.json` / `package-lock.json`이며, 토큰·키·비밀번호류 문자열은 포함되지 않는다.

- **[INFO]** `jsonwebtoken 9.0.3` 고정 버전 — 기존 유지
  - 위치: `codebase/backend/package.json` (변경 없음)
  - 상세: 이번 PR에서 변경하지 않았지만, `jsonwebtoken`은 patch 버전이 아닌 exact pin(`9.0.3`)으로 고정되어 있다. CVE 추적이 필요하다. 현재 `9.0.x`에 알려진 critical CVE는 없으나 semver range(`^9.0.3`)로 느슨하게 관리하거나 Dependabot/Renovate를 통해 모니터링하는 것이 권장된다.
  - 제안: 이번 PR 범위 외이지만 다음 보안 점검 시 확인 권장.

## 요약

이번 변경은 `npm audit` 결과에 따른 전이적 의존성 취약점 해소가 목적인 순수 의존성 버전 업그레이드 PR이다. 백엔드에서는 `ws`, `@grpc/grpc-js`, `multer`, `form-data`, `protobufjs`, `nodemailer`, `@nestjs-modules/mailer`, OpenTelemetry 전체 스택이, 프론트엔드에서는 `dompurify`(XSS 방어 강화), `ws`, `undici`, `vite`, `@babel/core`가 보안 버전으로 상향됐다. 코드 로직 변경 없이 선언적 의존성만 수정되어 인젝션·인증·입력검증·암호화·에러처리 관련 신규 위험 요소는 도입되지 않았다. `overrides` 블록의 의도가 주석으로 충분히 설명됐으며, 접근 방식도 npm 권장 방식에 부합한다.

## 위험도

NONE

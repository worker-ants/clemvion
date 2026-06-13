# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 요구사항 충족, Critical 결함 없음. 테스트 커버리지 일부 누락(WARNING 3건)과 문서/코드 정리 사항(INFO 다수)이 존재하나 운영 차단 수준은 아님.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `UsersController.changePassword`에 비밀번호 해시·검증·감사 기록이 모두 위치해 단일 책임 원칙(SRP) 부분 위반 — 이번 PR 이전부터 존재하던 기술 부채이며, 감사 로그 추가로 더 두드러짐 | `users.controller.ts` | 중기적으로 `UsersService.changePassword(userId, currentPassword, newPassword)` 서비스 메서드를 도입해 해시·검증 로직을 Service로 이전 권장. 즉각 수정 필요는 아님 |
| 2 | 테스트 | `WebAuthnController.webauthnDelete` 및 `webauthnRegisterVerify`에서 서비스가 예외를 throw할 때 audit log가 기록되지 않음을 보장하는 테스트 케이스 부재 | `webauthn.controller.spec.ts` | `deleteCredential`이 `NotFoundException`을 throw하는 케이스, `verifyRegistration`이 `BadRequestException`을 throw하는 케이스 각각 추가 |
| 3 | 테스트 | `AuthController.verify2fa`에서 `totpService.verifyAndEnable`이 throw하는 경우 audit 미기록 케이스 부재 (`disable2fa` 실패 케이스는 있으나 `verify2fa`는 누락) | `auth.controller.spec.ts` | `totpService.verifyAndEnable.mockRejectedValue(new UnauthorizedException())` 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서/코드 | `deleteCredential` 메서드 위 구 단행 JSDoc과 신 JSDoc 중복 의심 — 여러 reviewer 공통 지적 | `webauthn.service.ts` | 구 단행 주석 삭제, 신 JSDoc 하나만 남김 |
| 2 | 문서 | `spec/data-flow/1-audit.md` Rationale 끝 단락 call site 카운트 stale 의심 | `spec/data-flow/1-audit.md` Rationale | §1.1 갱신 내용과 일치하도록 수정 |
| 3 | 보안 | 비밀번호 변경 후 기존 세션(refresh token) 일괄 revoke 미수행 | `users.controller.ts` `changePassword` | 비밀번호 변경 시 활성 refresh token revoke 검토 (향후) |
| 4 | 보안 | `user.*` 이벤트에 `ipAddress` 미포함 — `auth_config.*` 계열과 달리 포렌식 가치 저하 | `users/auth/webauthn controller` | `extractClientIp(req)` 포함 검토 (향후) |
| 5 | 보안 | WebAuthn optionsToken이 access JWT와 동일 `JWT_SECRET` 공유 (기존 설계, kind 필드로 구분) | `webauthn.service.ts` | 전용 secret 분리 권장 (defense-in-depth, 향후) |
| 6 | 보안 | 복구 코드 해시 솔트 없는 SHA-256 (엔트로피 충분, 기존 설계) | `webauthn.service.ts` | TOTP 해시 방식과 일관성 확인 |
| 7 | 보안 | `user.2fa_disabled`를 `remaining` 무관 항상 기록 — `details.remainingCredentials`로 맥락 전달 중 | `webauthn.controller.ts` | 소비자/UI 해석 문서화 |
| 8 | 보안 | 감사 기록 실패 시 로그만, 별도 알림 없음 (의도된 설계) | `AuditLogsService.record` | 실패 메트릭 노출 검토 (향후) |
| 9 | 부작용 | `AuditLogsService.record` swallow 계약 diff 직접 확인 불가 (기존 구현으로 보장) | `auth.controller.ts` | 구현 try/catch swallow 검증 |
| 10 | 유지보수성 | TOTP 감사 호출 블록이 `verify2fa`·`disable2fa` 중복 | `auth.controller.ts` | `recordUserAudit` 헬퍼 검토 (강제 아님) |
| 11 | 유지보수성 | `authContextFromRequest` auth/webauthn 컨트롤러 중복 (기존 부채) | `auth.controller.ts`, `webauthn.controller.ts` | 공유 유틸 이동 (별도 티켓) |
| 12 | 유지보수성 | `users.controller.spec.ts` 비밀번호 불일치 테스트 setup 중복 | `users.controller.spec.ts` | 중복 setup 정리 |
| 13 | 유지보수성 | 2FA `details` 스키마 call site inline 정의 | `auth/webauthn controller` | 공통 interface 검토 |
| 14 | 문서 | `users.module.ts` `AuditLogsModule` import 이유 주석 부재 (auth.module엔 있음) | `users.module.ts` | 단행 주석 추가 |
| 15 | 문서 | §1.1 call site 카운트 하드코딩 stale 위험 | `spec/data-flow/1-audit.md` | "표가 SoT" 명시로 숫자 주장 완화 |
| 16 | 테스트 | `auth.controller.spec.ts` `it` 내부 `bcrypt.hash` 직접 호출 (round=4 영향 최소) | `auth.controller.spec.ts` | `beforeAll` 분리 가능 (필수 아님) |
| 17 | 테스트 | e2e WebAuthn 감사 로그 실제 DB INSERT 검증 부재 (현 PR 범위 외) | e2e | 별도 작업 |
| 18 | 아키텍처 | 감사 `details` 스키마 method별 상이 — 조회측 분기 필요 | `auth/webauthn controller` | 공통 base 타입 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 비밀번호 변경 후 세션 revoke 미수행(INFO), IP 미포함(INFO), SHA-256 복구 코드 해시(INFO). Critical/WARNING 없음 |
| architecture | LOW | SRP 부분 위반(`changePassword` 비즈니스 로직 Controller 잔존) — WARNING 1건. 나머지 INFO |
| requirement | NONE | 기능 요구사항 완전 충족. spec fidelity 준수. INFO 2건 |
| scope | LOW | 범위 내 변경. INFO 3건 |
| side_effect | LOW | `AuditLogsService.record` swallow 계약 미확인 — WARNING 1건 |
| maintainability | LOW | JSDoc 중복, 함수 중복, 테스트 중복 등 INFO 수준 |
| testing | LOW | WebAuthn 실패 경로 audit 미기록 테스트 2건, `verify2fa` 실패 경로 1건 누락 — WARNING 3건 |
| documentation | LOW | JSDoc 중복, Rationale call site 카운트 stale, `users.module.ts` 주석 부재 등 INFO 수준 |

## 발견 없는 에이전트

없음 (실행된 모든 에이전트에서 발견사항 존재)

## 권장 조치사항

1. **(WARNING — 테스트)** `webauthn.controller.spec.ts`에 `webauthnDelete`·`webauthnRegisterVerify` 서비스 throw 시 audit 미기록 테스트 추가
2. **(WARNING — 테스트)** `auth.controller.spec.ts`에 `verify2fa` 실패 경로 audit 미기록 테스트 추가
3. **(WARNING — 아키텍처)** `UsersController.changePassword` SRP 위반은 별도 티켓으로 `UsersService.changePassword` 서비스 메서드 도입 계획 수립
4. **(INFO)** `webauthn.service.ts` `deleteCredential` 구 단행 JSDoc 중복 정리
5. **(INFO)** `spec/data-flow/1-audit.md` Rationale call site 카운트 정정
6. **(INFO — 향후)** 비밀번호 변경 시 세션 revoke / `user.*` ipAddress 포함 검토
7. **(INFO)** `users.module.ts` `AuditLogsModule` import 주석 추가

## 라우터 결정

라우터가 reviewer를 선별해 실행했습니다.

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명)
- **제외** (6명): performance / dependency / database / concurrency / api_contract / user_guide_sync — 해당 변경에 비관련 (감사 로그 기록 추가, 스키마·의존성·API contract·동시성 변경 없음)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

# Code Review 통합 보고서

> 대상: `audit-user-actions` — `user.password_changed` / `user.2fa_enabled` / `user.2fa_disabled` 감사 액션 구현
> 일시: 2026-06-13 09:43:18

---

## 전체 위험도

**LOW** — 기능 요구사항은 완전히 충족됐으며 Critical 결함 없음. 아키텍처 SRP 위반(기존 기술 부채), 보안 후속 과제(세션 revoke·IP 미포함), 테스트 갭(swallow-resilience·e2e) 등 복수의 WARNING/INFO 가 존재하나 즉각 운영 위험 수준은 아님.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `UsersController.changePassword` SRP 위반 — bcrypt 검증·해시·강도 검증·update·감사 기록 5가지 책임이 Controller 에 혼재. 감사 로그 추가로 더 부각됨(기존 기술 부채). | `users.controller.ts` `changePassword` | 중기적으로 `UsersService.changePassword(userId, currentPassword, newPassword)` 도입해 ①~④를 Service 로 이전. 별도 티켓 추적. |
| 2 | Side Effect | `AuditLogsService.record` swallow 계약 미확인 — 신규 5개 call site 에 `await record(...)` 일괄 삽입. 구현의 try/catch swallow 가 깨진 경우 2FA 성공/비밀번호 변경 응답 전체 차단 가능. (기존 call site 운영 검증으로 실질 위험은 LOW 수준이나, 계약 명시적 확인 권장.) | `auth.controller.ts:verify2fa/disable2fa`, `users.controller.ts:changePassword`, `webauthn.controller.ts:webauthnRegisterVerify/webauthnDelete` | `audit-logs.service.ts` 에서 try/catch swallow 여부를 명시적으로 확인. 기존 call site 정상 운영 중이면 위험 LOW 로 감소. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 비밀번호 변경 후 기존 refresh token 일괄 revoke 미수행 — 탈취된 토큰으로 새 access token 발급 가능. 감사 기록만 추가됐으나 세션 무효화 없음. | `users.controller.ts:changePassword` | `changePassword` 성공 시 `SessionsService.revokeAll(userId)` 호출 추가. spec 에 미정의라면 보안 요구사항으로 등록. |
| 2 | Security | `user.*` 감사 이벤트에 클라이언트 IP 미포함 — 고위험 계정 이벤트에서 의심스러운 지리적 접근 탐지 불가. `@Request() req` 파라미터 없어 구조적으로 IP 추출 불가. | `users.controller.ts:changePassword`, `auth.controller.ts:verify2fa/disable2fa`, `webauthn.controller.ts` 전체 | 각 controller 메서드에 `@Req() req: Request` 추가 후 `extractClientIp(req)` 로 `details.ipAddress` 포함. 후속 작업으로 분리 가능, 보안 요구사항 등록 권장. |
| 3 | Security | WebAuthn optionsToken 이 access JWT 와 동일 `JWT_SECRET` 공유 — `kind` 클레임 버그 시 토큰 타입 혼용 공격 가능성(기존 설계). | `webauthn.service.ts` | `WEBAUTHN_OPTIONS_SECRET` 전용 env 도입을 후속 작업으로 검토. 이번 PR 범위 밖. |
| 4 | Security | WebAuthn 복구 코드 해시가 솔트 없는 SHA-256 — OWASP 권고 및 TOTP 복구 코드(bcrypt) 와 일관성 불일치(기존 설계). | `webauthn.service.ts` | argon2id 또는 bcrypt 전환을 후속 설계로 검토. 이번 PR 범위 밖. |
| 5 | Security | `AuditLogsService.record` 실패 swallow — 감사 공백 감지 불가. 의도된 설계이나 악의적 감사 서비스 장애 시 탐지 미흡. | `audit-logs.service.ts` | `record` 실패 시 메트릭 카운터/알림 추가. 컴플라이언스 요구사항이면 우선순위 상향. |
| 6 | Architecture | Controller 경계 감사 기록은 레이어 책임 예외이나 `workspaceId` 가 JWT 페이로드에서만 추출 가능하므로 spec §Rationale 4.1.B 에 명시적으로 정당화됨. | 3개 controller 전반 | 현재 설계 유지. 향후 call site 증가 시 `buildUserAuditPayload(user, action, details?)` 공통 헬퍼 추출 고려. |
| 7 | Architecture | 감사 `details` 스키마가 call site 별 inline 정의 — TypeScript 타입 강제 없음. 향후 2FA 방식 추가 시 읽기측 파서와 write 측 동시 변경 암묵적 의존. | `auth.controller.ts`, `webauthn.controller.ts` | 즉각 필수 아님. 향후 `interface UserAuditDetails { method: string }` base 타입 + narrowed 타입 도입 고려. |
| 8 | Architecture | `authContextFromRequest` 함수가 `auth.controller.ts` 와 `webauthn.controller.ts` 에 완전 동일하게 중복 선언(기존 기술 부채). | 두 controller 파일 | `auth/utils/auth-context.ts` 공통 유틸로 추출. 별도 티켓 처리. |
| 9 | Performance | `AuditLogsService.record` 단건 TypeORM `save()` — 고빈도 감사 이벤트 환경에서 `insert()` 또는 BullMQ 배치 큐 전환 고려. 현재 규모에서는 문제 없음. | `audit-logs.service.ts` L82-91 | 즉각 조치 불필요. 고빈도 감사 이벤트 추가 시 `auditLogRepository.insert(...)` 또는 비동기 큐 방식 검토. |
| 10 | Testing | `AuditLogsService.record` swallow-resilience 테스트 미존재 — `record` 가 reject 해도 controller 가 정상 반환함을 검증하는 케이스 없음. | controller spec 3종 전반 | 각 controller spec 에 `auditLogsService.record.mockRejectedValue(new Error('db error'))` 케이스 추가. 또는 `AuditLogsService.spec.ts` 에서 swallow 계약 직접 검증. |
| 11 | Testing | `webauthn.controller.spec.ts` — 신규 파일이 audit 전용으로 한정, 기존 WebAuthn 엔드포인트(등록 옵션, 로그인, 복구 코드 재발급) 동작 테스트 미포함. | `webauthn.controller.spec.ts` | 기존 엔드포인트가 다른 spec 에서 커버되는지 확인. 없다면 별도 spec 파일 추가 또는 파일명에 audit 전용임을 명기. |
| 12 | Testing | `auth.controller.spec.ts` · `users.controller.spec.ts` — 동일 시나리오 테스트 setup 중복(`bcrypt.hash('OldP@ssw0rd1', 4)` + fixture). | 두 spec 파일 | `beforeAll`/`beforeEach` 에서 공통 fixture 공유. 필수 아님(round=4 에서 영향 미미). |
| 13 | Testing | e2e 레이어 — 실제 DB INSERT 검증 부재(기존 deferred). `workspaceId` non-nullable 제약·action 값 저장 포맷 등 mock 기반으로 검증 불가. | e2e/integration 레이어 | 향후 `auditLogRepository.findOne({ action: 'user.password_changed' })` 등으로 실제 INSERT 검증. 별도 티켓 등록 권장. |
| 14 | Maintainability | `webauthn.service.ts` `deleteCredential` 메서드 직전에 구 단행 JSDoc 잔존 — 새 블록 JSDoc 과 공존하여 고아 주석 상태. | `webauthn.service.ts` `deleteCredential` 상단 | 구 단행 주석(`/** 개별 삭제. ... */`) 한 줄 삭제. |
| 15 | Maintainability | `spec/data-flow/1-audit.md` §1.1 본문에 "7개 위치 18개 call site" 숫자 하드코딩 — 향후 call site 추가 시 stale 위험. (Rationale 쪽 숫자는 이미 표로 위임 완료.) | `spec/data-flow/1-audit.md` §1.1 도입 문장 | §1.1 표 자체를 SoT 로 지정하고 도입 문장 숫자를 링크로 대체. 강제 사항 아님. |
| 16 | Scope | `auth.controller.spec.ts` 포맷팅 변경 2건이 기능 변경과 혼재. | `auth.controller.spec.ts` diff lines +179~183, +192~196 | 변경 규모 소범위라 허용 가능. 향후 포맷팅 변경은 별도 커밋 분리 권장. |
| 17 | Scope | `plan/complete/spec-draft-refactor-04-security-drift.md` 신규 생성 — 다른 worktree(`refactor-04-security-286de9`) 소속 plan 정리가 이 PR 에 동봉됨. | `plan/complete/spec-draft-refactor-04-security-drift.md` | 기능 영향 없는 행정 처리이며 plan-lifecycle 규약 준수. 범위상 별도 PR 이 더 명확하나 허용 가능. |
| 18 | Documentation | `spec/5-system/1-auth.md` §4.1 구현 표 신규 행 — 귀속 정책·controller 경로·링크를 단일 셀에 담아 기존 행보다 현저히 장황. 기능 오류 없음. | `spec/5-system/1-auth.md` line 362 부근 | 셀 내 설명을 `§Rationale 4.1.B` 링크로만 위임하고 간결화 (선택 사항). |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 비밀번호 변경 후 세션 revoke 부재, 고위험 이벤트 IP 미포함, WebAuthn 기존 설계 defense-in-depth 갭 (모두 INFO) |
| performance | NONE | 단건 INSERT 현재 규모 적절. 고빈도 확장 시 insert()/큐 전환 권장 (INFO) |
| architecture | LOW | `UsersController.changePassword` SRP 위반(WARNING), Controller 경계 감사 기록은 spec 정당화됨 |
| requirement | NONE | 3가지 user.* 감사 액션 spec 완전 충족. 필드명·엣지케이스·모듈 배선 모두 일치 |
| scope | LOW | 포맷팅 혼재·구 JSDoc 잔존·타 worktree plan 동봉 (모두 INFO) |
| side_effect | LOW | `AuditLogsService.record` swallow 계약 미확인(WARNING), 생성자 시그니처·반환 타입 변경은 정상 처리됨 |
| maintainability | LOW | 구 단행 JSDoc 잔존, spec 숫자 하드코딩, 테스트 setup 중복, `authContextFromRequest` 이중 선언(기존 부채) (모두 INFO) |
| testing | LOW | swallow-resilience 테스트 미존재, WebAuthn 기존 엔드포인트 커버리지 부재, e2e DB 검증 deferred (모두 INFO) |
| documentation | LOW | 구 JSDoc 중복 잔존 여부 재확인 필요, spec 표 셀 장황, §1.1 숫자 하드코딩 (모두 INFO) |
| concurrency | NONE | 공유 가변 상태 없음. 분석 대상 없음 |
| user_guide_sync | NONE | 사용자 가시 흐름 변경 없음. 동반 갱신 필요 문서 0건 |

---

## 발견 없는 에이전트

- **concurrency**: 신규 공유 가변 변수·락·병렬 실행 분기 없음. 분석 대상 없음.
- **user_guide_sync**: 기존 2FA·비밀번호 변경 UX/API 응답 변경 없음. 19개 trigger 중 형식 매칭 1건이나 실질 동반 갱신 필요 0건.
- **requirement**: Critical/Warning 수준 요구사항 결함 없음. 3가지 user.* 액션 완전 구현 확인.
- **performance**: 실질적 성능 위험 없음.

---

## 권장 조치사항

1. **(WARNING — 즉시 확인)** `audit-logs.service.ts` 의 `AuditLogsService.record` 구현에서 try/catch swallow 가 실제로 작동하는지 명시적으로 확인한다. 기존 call site 가 정상 운영 중이므로 사실상 확인 수준이나, 5개 신규 call site 추가 전 계약 검증은 필수.
2. **(WARNING — 중기)** `UsersService.changePassword(userId, currentPassword, newPassword): Promise<void>` 메서드를 도입해 Controller 에서 비밀번호 검증·해시 로직을 Service 로 이전. SRP 위반 해소.
3. **(INFO — 후속 보안 티켓)** 비밀번호 변경 성공 시 기존 refresh token 일괄 revoke(`SessionsService.revokeAll(userId)`) 추가. spec 에 세션 revoke 정책 명시적 등록.
4. **(INFO — 후속 보안 티켓)** `user.*` 감사 이벤트에 `details.ipAddress` 추가 — 각 controller 메서드에 `@Req() req: Request` 파라미터 삽입 후 `extractClientIp(req)` 호출.
5. **(INFO — 즉시 적용 가능)** `webauthn.service.ts` `deleteCredential` 메서드 직전 구 단행 JSDoc(`/** 개별 삭제. ... */`) 삭제.
6. **(INFO — 테스트 보강)** 각 controller spec 에 `auditLogsService.record.mockRejectedValue(new Error('db error'))` 케이스 추가 — swallow-resilience 검증.
7. **(INFO — 후속 티켓)** `authContextFromRequest` 함수를 `auth/utils/auth-context.ts` 공통 유틸로 추출(DRY, 기존 기술 부채).
8. **(INFO — 후속 티켓)** `webauthn.controller.spec.ts` 에 기존 WebAuthn 엔드포인트 동작 테스트 추가 또는 별도 spec 파일 생성.
9. **(INFO — 향후)** `spec/data-flow/1-audit.md` §1.1 도입 문장의 숫자 하드코딩("18개 call site")을 "§1.1 표가 SoT" 링크 참조로 대체.

---

## 라우터 결정

라우터가 reviewer 를 선별 실행했습니다 (`routing=done`).

- **실행** (11명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `user_guide_sync`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (3명):

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | dependency | 라우터 제외 |
  | database | 라우터 제외 |
  | api_contract | 라우터 제외 |
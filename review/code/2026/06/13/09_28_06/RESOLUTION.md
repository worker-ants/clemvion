# Resolution — audit-user-actions ai-review (2026-06-13 09:28:06)

전체 위험도 **LOW**, Critical 0 / Warning 3. Warning 3건 + 저비용 INFO 3건을 본 PR 같은 턴에 처리했다.

## Warning 처리

| # | 카테고리 | 처리 | 위치 |
|---|----------|------|------|
| 1 | 아키텍처 — `changePassword` SRP 부분 위반 | **Deferred (별도 티켓)** — 이번 PR 이전부터 존재한 기술 부채로, reviewer 도 "즉각 수정 필요 없음" 판정. 감사 기록 추가는 controller 경계가 적절한 자리(세션 workspaceId 귀속)라 본 PR 에서 로직 이전은 범위 밖. `UsersService.changePassword` 도입은 후속 리팩토링으로 분리. | `users.controller.ts` |
| 2 | 테스트 — WebAuthn 실패 경로 audit 미기록 검증 부재 | **Fixed** — `webauthn.controller.spec.ts` 에 `verifyRegistration` throw(BadRequestException)·`deleteCredential` throw(NotFoundException) 시 `auditLogsService.record` 미호출 케이스 2건 추가. | `webauthn.controller.spec.ts` |
| 3 | 테스트 — `verify2fa` 실패 경로 audit 미기록 검증 부재 | **Fixed** — `auth.controller.spec.ts` 에 `verifyAndEnable` throw(UnauthorizedException) 시 record 미호출 케이스 추가 (`disable2fa` 실패 케이스는 기존 존재). | `auth.controller.spec.ts` |

처리 후 영향 테스트 5 suites / 87 tests PASS (warning-fix 회귀 3건 포함), `nest build` PASS.

## INFO 처리 (저비용·정합성)

| # | 처리 | 위치 |
|---|------|------|
| 1 | **Fixed** — `deleteCredential` 구 단행 JSDoc + 신 블록 JSDoc 중복을 단일 블록으로 통합. | `webauthn.service.ts` |
| 2 / 15 | **Fixed** — `spec/data-flow/1-audit.md` Rationale 끝 단락의 stale "4개 모듈 13개 call site" 를 "§1.1 표가 SoT" 로 정정(하드코딩 숫자 주장 제거). | `spec/data-flow/1-audit.md` |
| 14 | **Fixed** — `users.module.ts` `AuditLogsModule` import 옆에 사유 주석 추가 (auth.module 과 일관성). | `users.module.ts` |

## Deferred (향후 개선 — 본 PR 범위 밖, 후속 결정 필요)

- **INFO 3** 비밀번호 변경 후 기존 refresh token 일괄 revoke: 계정 탈취 복구 시나리오에서 가치 있으나, 세션 revoke 정책은 별도 보안 설계 결정 (현 spec 미정의). 후속.
- **INFO 4** `user.*` 감사 이벤트 `ipAddress` 포함: `auth_config.*` 와 동형으로 포렌식 가치 있으나, change-password/2fa controller 메서드가 현재 `req` 를 받지 않아 시그니처 확장 필요 — 별도 작업으로 분리.
- **INFO 5/6** WebAuthn optionsToken 전용 secret 분리, 복구 코드 해시 argon2id 전환: 기존 설계의 defense-in-depth 개선으로 본 PR 무관.
- **INFO 11** `authContextFromRequest` auth/webauthn 컨트롤러 중복: 기존 기술 부채, 별도 티켓.
- **INFO 17** e2e 감사 로그 DB INSERT 검증: 통합 테스트 갭, 별도 작업.

위 deferred 항목은 보안/아키텍처 개선 후보로 유효하나 본 audit-action 구현 PR 의 범위(spec §4.1 + Rationale 4.1.B 가 약속한 3개 액션 기록)를 벗어나며, 각각 별도 결정/설계를 동반하므로 분리한다.

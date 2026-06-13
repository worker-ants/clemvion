# Resolution — audit-user-actions 재리뷰 (2026-06-13 09:43:18)

본 세션은 **resolution 수정 커밋(ccdf89fa) 이후 freshness 재확인**을 위한 재리뷰다 (직전 09:28:06 세션의 Warning fix 가 커밋되며 리뷰 대상보다 코드가 newer 가 됨 → review-before-stop 가드 재확인 요청). 커밋된 `origin/main..HEAD` 전수를 재리뷰했다.

결과 **LOW**, Critical 0 / Warning 2. 두 Warning 모두 **코드 변경 없이** 해소 — 근거 아래.

## Warning 처리

| # | 카테고리 | 처리 | 근거 |
|---|----------|------|------|
| 1 | Architecture — `UsersController.changePassword` SRP 위반 | **Deferred (별도 티켓)** | 이번 PR 이전부터 존재한 기술 부채로 reviewer 도 "기존 기술 부채" 명시. 감사 기록은 세션 workspaceId 가 controller 경계에만 있어(spec §Rationale 4.1.B 정당화) 본 PR 범위는 controller 기록이 맞다. `UsersService.changePassword` 도입은 후속 리팩토링으로 분리. |
| 2 | Side Effect — `AuditLogsService.record` swallow 계약 미확인 | **이미 충족 + 테스트됨 (코드 변경 불요)** | `audit-logs.service.ts` `record()` 는 `try { save } catch { logger.warn }` 로 예외를 삼키고 resolve 한다(주 동작 비실패). 이 계약은 **`audit-logs.spec.ts` 의 `describe('AuditLogsService.record — best-effort (swallow)')` → it('save 가 reject 해도 예외를 삼키고 resolve 한다')** 로 이미 테스트로 잠겨 있다. 모든 audit producer 가 참조하는 **단일 SoT 계약**이며, 본 PR 의 신규 5개 call site 도 동일 계약에 의존한다(기존 13개 call site 와 동형). 따라서 신규 call site 별 swallow 테스트 중복은 불필요. |

## INFO 확인

- **INFO 14 / 권장 5 (구 단행 JSDoc 잔존)**: 직전 09:28 세션 resolution 에서 **이미 제거 완료**. 커밋된 `webauthn.service.ts` `deleteCredential` 상단은 단일 블록 JSDoc 만 존재(구 단행 주석 없음). reviewer 가 diff 의 remove+add 를 잔존으로 오인. 추가 조치 불요.
- **INFO 16 (포맷팅 혼재)**: prettier 정합 결과로, 기능 변경과 분리 불가한 소범위. 허용.
- **INFO 17 (타 worktree plan 동봉)**: plan-lifecycle 규약상 "plan 이동만 담은 별 PR 금지 — 구현 PR 에 동봉" 지침을 따른 의도된 동봉.

## Deferred (향후 — 본 PR 범위 밖, 후속 결정/작업 분리)

직전 RESOLUTION(09_28_06) 과 동일 — 비밀번호 변경 시 세션 revoke(INFO 1), `user.*` ipAddress 포함(INFO 2), WebAuthn optionsToken 전용 secret(INFO 3)·복구 코드 argon2id(INFO 4), record 실패 메트릭(INFO 5), `authContextFromRequest` DRY(INFO 8), e2e 감사 DB INSERT 검증(INFO 13). 각각 별도 보안 설계 결정 또는 기존 기술 부채로, audit-action 구현 PR 범위(§4.1 + Rationale 4.1.B 의 3개 액션 기록)를 벗어나 분리한다.

## 검증

- 백엔드 단위: 영향 5 suites / 87 tests PASS, 전체 337 suites / 6777 tests PASS, `nest build` PASS.
- **e2e: backend e2e 188 tests PASS** (docker 스택 기동 — AuditLogsModule DI 배선 런타임 검증 + auth/users/webauthn/audit-logs 플로우).

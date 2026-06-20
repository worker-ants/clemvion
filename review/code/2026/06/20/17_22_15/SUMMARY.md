# Code Review 통합 보고서 — C-3 auth bcrypt→service

## 전체 위험도
**LOW** — 레이어 정렬 리팩터, 기능 동작 완전 보존(Critical 0). 테스트 패턴/커버리지 WARNING 2 + pre-existing 보안 개선 여지 WARNING 1.

## Critical
_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견 | 조치 |
|---|---------|------|------|
| 1 | Testing | `verifyPasswordForUser` 테스트에 `findById→null`(user 미존재) 분기 누락 | **수정**: null 케이스 별도 it 추가 |
| 2 | Testing/Maint. | `try/catch + expect.assertions` 패턴이 파일의 `.rejects.toThrow` 관례와 불일치 | **수정**: `.rejects.toMatchObject({status:401, response:{code}})` 로 교체 |
| 3 | Security | `POST /auth/2fa/disable` 비밀번호 실패 시 `incrementLoginAttempts`/`loginHistory` 미호출 — 유효 JWT 공격자 brute-force 무제한 | **후속**(비차단): **옛 controller 도 동일 동작 — C-3 가 도입 아님**. 카운터 추가/`@Throttle` 은 behavior-change 라 behavior-preserving C-3 범위 밖. 별도 보안 작업으로 등재 |

## 참고 (INFO) — 주요
- **SPEC-DRIFT**: `data-flow/2-auth.md §1.2` 에 TOTP disable 비밀번호 재확인(`verifyPasswordForUser`) 흐름 미반영 — 코드 정확, spec 갱신 필요(planner 후속). impl-done 도 동일 지적.
- INFO #4: describe 제목 `(refactor 02 C-3)` 태그 → 단순화 (**수정**).
- INFO #5: `!user || !user.passwordHash` 인라인 주석 추가 (**수정**).
- INFO: AuthService God Object 모니터링(2건+ 재인증 패턴 시 분리), JSDoc 에러코드 중복(선택), bcrypt mock(별도), Swagger 에러코드 열거(범위 밖).

## 에이전트별 위험도
security LOW(brute-force, JWT 필요·옛 동작) · testing LOW(null 분기·패턴) · maintainability LOW(패턴·태그) · architecture/scope/side_effect/requirement/dependency/database/concurrency/api_contract/user_guide_sync/documentation/performance NONE

## 권장 조치
1. **[W1·W2, 본 PR]** verifyPasswordForUser 테스트 — null 케이스 추가 + `.rejects.toMatchObject` 패턴.
2. **[INFO #4·#5, 본 PR]** describe 태그 단순화 + 인라인 주석.
3. **[W3, 후속·보안]** 2FA disable brute-force 보호(`@Throttle`/카운터) — behavior-change, 별도.
4. **[SPEC-DRIFT, 후속·planner]** data-flow/2-auth.md §1.2 verifyPasswordForUser 흐름 신설.
5. **[후속]** webauthn.controller·sessions.service raw bcrypt → verifyPasswordForUser 통합(impl-done INFO #4).

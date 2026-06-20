# RESOLUTION — C-3 ai-review (2026-06-20 17_22_15)

위험도 **LOW**, Critical 0, WARNING 3. behavior-preserving 레이어 정렬.

## 조치 항목

| SUMMARY # | 카테고리 | 발견 | 조치 | 위치 |
|---|---|---|---|---|
| W1 | Testing | `verifyPasswordForUser` 테스트에 `findById→null`(user 미존재) 분기 누락 | **fix** — null 케이스 별도 it 추가(→ PASSWORD_REQUIRED 401) | `auth.service.spec.ts` |
| W2 | Testing/Maint. | `try/catch + expect.assertions` 패턴이 파일 관례(`.rejects`)와 불일치 | **fix** — `.rejects.toMatchObject({status:401, response:{code}})` 로 4케이스 전부 교체 | `auth.service.spec.ts` |
| INFO #4 | Maint. | describe 제목 `(refactor 02 C-3)` 태그 잡음 | **fix** — `describe('verifyPasswordForUser')` 단순화, 맥락은 주석 | `auth.service.spec.ts` |
| INFO #5 | Maint. | `!user || !user.passwordHash` 의미 인라인 주석 없음 | **fix** — `// !user: 미존재 / !passwordHash: OAuth-only` 주석 추가 | `auth.service.ts` |
| W3 | Security | 2FA disable 비밀번호 실패 시 brute-force 카운터 미작동 | **후속**(비차단) — **옛 controller 도 동일**(C-3 도입 아님), 카운터/`@Throttle` 추가는 behavior-change 라 behavior-preserving C-3 범위 밖. 별도 보안 작업 |
| SPEC-DRIFT(INFO) | Requirement | `data-flow/2-auth.md §1.2` 에 `verifyPasswordForUser` 흐름 미반영 | **후속**(planner) — 코드 정확, spec 갱신 선택. C-3 는 spec 무변(D 판정) |

INFO(God Object 모니터링·JSDoc·bcrypt mock·Swagger 에러코드)는 범위 밖/선택 — 미조치.

## TEST 결과

- **lint**: PASS (52s, #651 report-only 전환 후 --fix 노이즈 없음).
- **unit**: PASS. auth.service.spec 45 tests(verifyPasswordForUser 4케이스 포함)·auth.controller.spec 통과. resolution fix 후 재검증 통과.
- **build**: PASS (tsc, 76s).
- **e2e**: 통과 (205 tests, 67s — 2FA disable 동작 보존 포함).

## 보류·후속 항목

- **W3**: 2FA disable brute-force 보호 — 별도 보안 작업(behavior-change).
- **C-3 §3 단일진실 완성**: `webauthn.controller`·`sessions.service` raw bcrypt → `verifyPasswordForUser` 통합 (impl-done INFO #4).
- **spec 문서(planner)**: `data-flow/2-auth.md §1.2` 흐름 + `error-codes.md` 등재.

> resolution fix(코드 2파일)로 17_22_15 review·17_23_25 impl-done 이 stale → fresh ai-review + impl-done 재실행으로 커버.

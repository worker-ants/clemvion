# Code Review Resolution

PR #203 (button-cap-spec-validator) ai-review 후속.

> **Diff range artifact 안내**: ai-review prepare 시점에 `origin/main` ref 가 stale 했음. 본 PR commit 단 1개 (`a645933e`) 의 실제 변경은 button-cap 관련만. base diff 가 그 사이 머지된 다른 PR 들 (#198, #200, #201, Swagger oneOf 등) 의 변경도 포함하면서 reviewer 들이 그 변경 (auth.ts, login-form.tsx, 2fa-webauthn-followups.md, spec/5-system/1-auth.md) 에 대해서도 발견을 보고. 본 PR 책임 범위 외 발견은 NOT APPLICABLE.

## Critical 처리

| # | 항목 | 본 PR? | 처리 |
|---|---|---|---|
| C-1 | login-form.tsx / auth.ts 인증 로직 변경 (scope creep 보고) | NO | NOT APPLICABLE — diff range artifact (PR #201) |
| C-2 | 2fa-webauthn-followups §9 역행 | NO | NOT APPLICABLE |
| C-3 | 2fa-webauthn-followups §10 역행 | NO | NOT APPLICABLE |
| C-4 | shadow-workflow.spec.ts:1234 cap 10 하드코딩 | **YES** | **FIXED** — cap 10 → 5 + 메시지 "Maximum 5 buttons allowed per node" + 테스트 fixture 11→6 갱신 |

## WARNING 처리 (본 PR 책임 범위만)

| # | 항목 | 처리 |
|---|---|---|
| W-5 | shadow-workflow.spec.ts 갱신이 plan 체크리스트 누락 | **FIXED** — plan tests 체크리스트 항목 추가 |
| W-12 | button.types.spec.ts 경계 케이스 명확성 | **CONFIRMED FIXED** — 본 PR 의 1차 commit 에 이미 "passes with exactly 5" + "should fail when more than 5" 2 케이스 작성. SUMMARY 의 우려는 sub-agent 가 케이스 이름만 보고 추정한 것 |
| W-13 | carousel.schema.spec.ts 경계 케이스 | **CONFIRMED FIXED** — 동일하게 "allows exactly 5" + "caps per-item buttons at 5" 2 케이스 |
| W-1~W-4, W-6~W-11, W-14~W-16 | 본 PR 외 변경 (auth.ts / login-form / 2fa-webauthn-followups) | NOT APPLICABLE |

## INFO 처리 (본 PR 책임 범위만)

| # | 항목 | 처리 |
|---|---|---|
| I-3 / I-7 | consumer 가 `maxButtons={10}` 명시 전달 | **CONFIRMED OK** — `grep -rn "maxButtons=" codebase/frontend/src/components/editor/settings-panel/node-configs/` 결과 명시 전달 없음. 모두 default (5) 사용 |
| I-9 / I-11 | presentation-button-render-investigation B/D/E 미체크 | **CONFIRMED FIXED** — 본 PR 의 plan 갱신에 이미 "본 PR 범위 외, 사용자 재현 시점에 재조사" 명시 |
| I-13 / I-17 | maxButtons (frontend) ↔ MAX_BUTTONS_PER_NODE (backend) SSOT 부재 | **TRACKED** — packages/ 공유 상수 추출 별 follow-up. JSDoc 임시 link |
| I-15 / I-21 | buttonDefSchema 4벌 중복 | **TRACKED** — `_shared/button.schema.ts` 통합 별 follow-up |
| I-20 | button-list-editor "5개 후 비활성화" 컴포넌트 테스트 | **OUT OF SCOPE** — frontend 컴포넌트 테스트 별 작업 |

## 본 PR 외 변경 발견 (참고만 — 다른 PR/follow-up 책임)

- **C-1 / W-2 / W-3 / W-7 / W-16**: `auth.ts` 의 `isTwoFactorChallenge` / `isAccessTokenResponse` named interface 삭제 + discriminated union 해체 — PR #201 (login challenge union refactor) 의 의도된 변경 가능성. 사용자가 별도 검토.
- **C-2 / C-3 / W-4**: `2fa-webauthn-followups.md` §9/§10 역행 — 별 worktree 진행 사항. 사용자가 별도 검토.
- **W-1**: `login-form.tsx` `accessToken` 없을 때 silent failure — PR #201 의 검토 대상. 별 follow-up 또는 PR comment.
- **W-8 / W-9 / W-10 / W-11**: `auth.ts` JSDoc deprecation 마커 / discriminated union 설명 / CHANGELOG — PR #201 책임.
- **W-14**: login-form.tsx 인라인 타입 가드 단위 테스트 부재 — PR #201 책임.
- **I-1 / I-12**: discriminated union exhaustiveness — PR #201.
- **I-16**: `AuthModule` ↔ `WebAuthnModule` 양방향 의존성 — `2fa-webauthn-followups §8`.
- **I-18**: Swagger oneOf — `2fa-webauthn-followups §9` (이미 ec9a3bd7 에서 처리).
- **I-22**: spec/5-system/1-auth.md §1.4.G Rationale 삭제 — PR #200 (V058 rationale).

## 테스트 결과

- backend `presentation + shadow-workflow` **318 tests pass** (이전 237 + shadow-workflow 81)
- presentation cap 5 회귀 4 케이스 (button.types 2 + carousel.schema 2)
- shadow-workflow cap fixture 동기화 2 케이스

## e2e

PROJECT.md e2e 면제 화이트리스트 적용 가능성 — 본 변경은 schema cap 값 변경 + 테스트 fixture 동기화. 실제 SMTP 호출이나 외부 시스템 영향 없음.

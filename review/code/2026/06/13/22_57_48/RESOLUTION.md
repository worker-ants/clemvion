# RESOLUTION — refactor 04 후속 (A-1 세션회전 · B-1 ipAddress · B-2 SRP · C DRY/e2e)

리뷰: `review/code/2026/06/13/22_57_48/SUMMARY.md` — 전체 위험도 **LOW**, Critical 0, Warning 4.
대상 구현 커밋: `0503bf55` (spec `dcd225b8`). Warning fix 는 본 REVIEW WORKFLOW 커밋.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 파일 |
|---|---|---|---|
| WARNING 1 | Testing | `rotateSessionAfterPasswordChange` revoke→issue **순서 불변식** 단언 추가 (`revokeAllFamilies` invocationCallOrder < `jwtService.sign`) — 옵션 B 보안 핵심 회귀 방지 | `auth.service.spec.ts` |
| WARNING 2 | Testing | 3개 컨트롤러 spec `beforeEach` 에 `delete process.env.TRUST_CF_CONNECTING_IP` 격리 가드 추가 — CF-신뢰 env leak 시 IP 단언 깨짐 방지 | `auth.controller.spec.ts`, `webauthn/webauthn.controller.spec.ts`, `users.controller.spec.ts` |
| WARNING 3 | Testing | e2e 2번째 테스트를 **독립 사용자**로 분리 + `res.body.error.code === 'INVALID_PASSWORD'` 단언 + 실패 시 audit 0건 단언 — 첫 테스트 부수효과 종속 제거, 인증실패 401 과 구분 | `test/users-change-password.e2e-spec.ts` |
| WARNING 4 | API Contract | 확인 only — `POST /users/me/change-password` 응답 `{success}`→`{accessToken}` breaking change 의 소비자는 frontend `change-password/page.tsx` **단독**(grep 전수 확인). 이미 동반 갱신됨 → 코드 변경 불요 | — |

INFO 1~10: 차단 아님. 후속 고려 항목(BCRYPT_ROUNDS 공용화·forwardRef 디커플링·비밀번호변경 user-guide 안내·revoke+reissue 트랜잭션)은 범위 밖으로 기록만. user-guide(INFO 10)는 비밀번호 변경/세션 흐름 전용 기존 가이드 페이지 부재 — 신규 페이지 생성은 별도 판단(plan 에 기록).

## TEST 결과

- **lint**: 통과 — backend eslint(변경 파일) 0 error, frontend lint 0 error (web-chat-sdk/packages/sdk lint 는 worktree npm ci env 이슈로 미실행 — 본 변경 무관 독립 패키지).
- **unit**: 통과 — backend 6785 pass (fix 후 영향 spec 4종 81 재통과), frontend 4318 pass (200 files; packages/*/dist 준비 후).
- **build**: 통과 — backend `nest build` exit 0.
- **e2e**: 통과 — `make e2e-test` 190 passed (188→190, 신규 `users-change-password.e2e-spec.ts` 2건 포함). W3 fix 후 재실행 190 재통과. docker daemon 가용.

## 보류·후속 항목

- A-2 typed-error 체계: 별도 작업 `plan/in-progress/execution-engine-typed-errors.md` 로 등록 (사용자 결정 — 이번 범위 제외).
- INFO 후속(BCRYPT_ROUNDS 공용화·forwardRef→domain event·revoke+reissue 트랜잭션·비밀번호변경 user-guide): 범위 밖, 본 PR 미포함.

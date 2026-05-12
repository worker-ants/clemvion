# RESOLUTION — 2026-05-12_14-05-07

리뷰 대상: commit `48863b94` (NAV-UP-05·NAV-WF-07 frontend).
조치 commit: 이 RESOLUTION 과 함께 커밋되는 후속 변경.

## 요약

Critical 0건. Warning 17건 중 14건 해결 + 3건은 별도 plan 으로 위임. INFO 15건 중 7건 해결, 8건은 보류 사유 명시.

검증: lint 0 errors, 105 vitest suites / 1247 tests passing, build OK.

## Warning (17건)

해결 (14):

| # | 항목 | 조치 |
|---|------|------|
| 2 | `"invitation_email_mismatch"` 하드코딩 | `lib/api/invitations.ts` 의 `INVITATION_ERROR.EMAIL_MISMATCH` 로 추출. spec §1.5.4 의 다른 에러 코드도 함께 enum 화 |
| 3 | resend/invite/revoke `onError` 가 `parseApiError` 미사용 | 세 mutation 모두 `parseApiError(err)?.message ?? fallback` 패턴으로 통일 |
| 6 | `invitationBanner` IIFE 안티패턴 | `InvitationBanner` 서브컴포넌트로 추출 (role="alert" + status 별 i18n 변환을 렌더 시점에서 처리) |
| 7 | resend mutation 전체 잠금 | `itemBusy = (resend.isPending && variables === inv.id) \|\| (revoke.isPending && variables === inv.id)` 로 per-item 격리 |
| 8 | resend·revoke 교차 잠금 누락 | 같은 `itemBusy` 가 두 버튼 모두 비활성화 |
| 9 | useEffect deps 의 `t` 함수 | deps 에서 `t` 제거. status 만 state 에 저장하고 텍스트 변환은 banner 렌더 시점에서 — locale 토글이 fetch 재실행을 유발하지 않도록 |
| 10 | loading 중 submit 가능 | `submitDisabled = isLoading \|\| state.kind === "loading" \|\| state.kind === "error"` 로 결합 |
| 11 | InvitationState 4단계 상태 머신 테스트 부재 | `register-form.test.tsx` 신규 (6 케이스: 토큰 없음 / 410 / 404 / ready prefill / accessToken→/dashboard / 일반 가입→/verify-email) |
| 12 | accessToken 분기 테스트 누락 | 같은 spec 의 마지막 2 케이스가 두 분기를 검증 |
| 14 | `?invitationToken=` (빈 값) 미정규화 | `register/page.tsx` 에서 `.trim() \|\| undefined` 로 폴딩. `getByToken("")` 호출 차단 |
| 15 | `candidatePickerEmpty` 무관 수정 | 의도적 (pre-existing 테스트가 i18n 띄어쓰기와 mismatch 였음 — `candidate-picker.test.tsx` 와 함께 운영 가능 상태로 회복). 커밋 메시지에 이미 명시했음 |
| 16 | "react-hooks/purity" 잘못된 주석 | "Date.now()는 매 렌더마다 달라지므로 dataUpdatedAt 기준으로 비교" 식으로 교체 |
| 17 | `lucide-react` 중복 import | 두 import 문 병합. `Users` 를 기존 블록에 추가 |
| R13 (INFO) | 오류 상태에서도 submit 가능 | W10 과 함께 해결 — `submitDisabled` 가 error 상태도 포괄 |

별도 plan 으로 위임 (3):

| # | 항목 | 위임 사유 |
|---|------|----------|
| 1 | register 응답 봉투 e2e 검증 | e2e 인프라(Postgres·Redis·SMTP-console) 정비 후. plan 의 e2e 항목으로 통합 |
| 4 | GET `/invitations/:token` URL 노출 | 백엔드 API 라우트 변경(`POST /invitations/meta`) 필요. spec §1.5 변경 + 백엔드 라우트 + 프론트 동시 변경이 동반되어 별도 plan 으로 분리. 현재는 `verify-email`·`reset-password` 와 같은 URL-token 패턴을 유지 |
| 5 | `setAccessToken` 레이어 경계 | `auth-store.setAuthenticated` 는 user 객체가 필요하고 invitation 흐름은 access token 만 받으므로 `setAccessToken` 직접 호출이 verify-email 흐름과 일치. 추후 `useAuth().completeLogin(token)` 같은 hook 추가 시 함께 정리 |

## INFO (15건)

해결 (7):

| # | 항목 | 조치 |
|---|------|------|
| 1 | `invitationsApi` 와 `workspacesApi` 도메인 혼재 | `lib/api/invitations.ts` 신규 파일로 분리. `InvitationMeta` 타입도 함께 이동. `INVITATION_ERROR` 상수도 같은 파일 |
| 5 | `resendInvitation` JSDoc 부수 효과 | `workspaces.ts` 에 "기존 토큰 무효화 + 만료 시계 재시작" 명시 |
| 6 | `InvitationMeta.invitedByName` null 조건 미문서화 | `lib/api/invitations.ts` 에 "초대자 계정이 조회 불가(탈퇴 등)일 때 null" 인라인 주석 |
| 7 | `invitationBanner` 직전 주석이 WHAT | InvitationBanner 컴포넌트 추출과 함께 주석을 WHY 로 재작성 |
| 9 | `InvitationMeta` 선언 위치 | invitations.ts 로 이동하면서 `invitationsApi` 위에 선언 |
| 12 | `teamBadge: "Team"` 영문 의도 | ko.ts 에 의도 명시 주석 추가 |
| 14 | `encodeURIComponent(token)` 불필요 (base64url) | 방어적으로 유지 — 미래에 토큰 인코딩 바뀌어도 안전. invitations.ts 주석에 의도 명시 |

미해결 (8):

| # | 항목 | 사유 |
|---|------|------|
| 2 | RegisterForm SRP — useInvitationToken hook 분리 | 추후 리팩토링. 현재 useEffect 1개 + state 1개 수준이라 hook 추출 이득이 크지 않음 |
| 3 | settings page god component | 별도 리팩토링 plan. 본 PR 범위 외 |
| 4 | invitation meta 를 React Query 로 전환 | 작은 일회성 fetch + 캐싱 가치 낮음. cancelled 플래그 + useEffect 로 충분 |
| 8 | spec 섹션 번호 `§1.5.2` vs `§1.5` | 두 표기 모두 spec 에 존재하므로 의미 동일 |
| 10 | `isTeamWorkspace` hydrate flash 테스트 | persist hydration 전 false → 배지 안 보임 → hydrate 후 true 시 배지 표시. 사용자 체감 영향 미미하고 테스트 패턴이 store hydration 비동기를 정확히 재현하기 까다로움. 추후 |
| 11 | i18n 키 동기화 schema 테스트 | 별도 인프라(키 schema 빌드) 필요. 큰 작업 |
| 13 | (W10 으로 함께 해결) — 위 표 참고 | — |
| 15 | `authApi.register` 다른 호출부 영향 | grep 결과 단일 호출 (register-form.tsx). OK |

## 검증

- `npm run lint` → 0 errors
- `npm test` → 105 suites / 1247 tests (+6 신규 register-form invitation cases)
- `npm run build` → OK (Next.js 16 webpack build)

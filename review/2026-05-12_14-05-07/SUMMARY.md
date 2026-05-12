# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 프론트엔드 레이어 전반의 품질은 양호하나, API 계약 검증 부재와 프런트엔드 테스트 커버리지 미흡이 회귀 위험을 높임

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract | `POST /auth/register` 응답 타입을 `{ data: RegisterResultData }` 봉투로 변경했으나, 백엔드가 해당 봉투를 실제로 반환하지 않으면 `accessToken`이 항상 `undefined`가 되어 초대 자동 로그인 분기가 무음 실패함 | `auth.ts` | e2e 또는 통합 테스트로 응답 봉투 형식 명시적 검증 |
| 2 | API Contract | 에러 코드 `"invitation_email_mismatch"` 가 문자열 리터럴로 하드코딩되어, 백엔드 코드 변경 시 분기가 무음으로 무시됨 | `register-form.tsx` | 공유 상수(`const INVITATION_EMAIL_MISMATCH = "..."`) 또는 enum으로 추출 |
| 3 | API Contract / Security | `resendMutation.onError`가 파일 내 정의된 `parseApiError` 헬퍼를 사용하지 않고 `err.message` 직접 노출 — HTTP 상태 텍스트가 토스트에 표시됨 (`inviteMutation`, `revokeMutation` 동일) | `workspace/settings/page.tsx` | 기존 `parseApiError(err)` 패턴으로 통일 |
| 4 | Security | 초대 토큰이 `GET /invitations/:token` URL 경로에 포함되어 서버 접근 로그·브라우저 히스토리·Referer 헤더에 노출 | `workspaces.ts` `invitationsApi.getByToken` | `POST /invitations/meta` 로 변경해 토큰을 바디에 담거나, 최소한 응답에 `Cache-Control: no-store` 포함 |
| 5 | Architecture | `register-form.tsx`가 `setAccessToken`을 직접 호출해 인증 인프라 로직을 프레젠테이션 레이어에서 제어 — 레이어 경계 위반 | `register-form.tsx` `onSubmit` | `useAuth` 훅 또는 `authApi` 래퍼로 토큰 처리 캡슐화 |
| 6 | Architecture / Maintainability | `invitationBanner`가 IIFE 패턴으로 구현되어 매 렌더마다 클로저 재생성, 가독성 저하 | `register-form.tsx` | `<InvitationBanner state={invitationState} />` 서브컴포넌트로 추출하거나 `useMemo`로 교체 |
| 7 | Architecture / Concurrency | `resendMutation` 단일 인스턴스가 목록 전체 버튼을 일괄 비활성화 — 다른 항목의 재발송도 불필요하게 차단, 어느 항목이 처리 중인지 시각 피드백 없음 | `workspace/settings/page.tsx` | `pendingResendId` 상태 또는 `disabled={resendMutation.isPending && resendMutation.variables === inv.id}` 패턴으로 per-item 격리 |
| 8 | Concurrency | Resend 진행 중 동일 행의 Revoke 버튼이 활성화 상태 유지 — 두 요청이 거의 동시에 서버에 도달 가능 | `workspace/settings/page.tsx` | `disabled={resendMutation.isPending \|\| revokeMutation.isPending}` 교차 결합 |
| 9 | Performance / Side Effect | `useEffect` 의존 배열에 `t` 함수가 포함 — `useT()`가 렌더마다 새 참조를 반환하면 `getByToken` API 중복 호출 발생 | `register-form.tsx:79` | `t` 를 deps에서 제거하거나 `useT` 구현의 stable reference 여부 확인 |
| 10 | Requirement / Testing | `invitationState.kind === "loading"` 상태에서 제출 버튼이 활성화 — prefill 전 임의 이메일로 제출 가능, 백엔드가 막지만 UX 혼란 유발 | `register-form.tsx` submit 버튼 | `disabled={isLoading \|\| invitationState.kind === "loading"}` 추가 |
| 11 | Testing | `InvitationState` 4단계 상태 머신(none/loading/ready/error) 분기에 대한 단위 테스트 부재 — 410/404 처리, setValue 호출, cancelled cleanup 등이 테스트 사각 | `register-form.tsx` | `invitationsApi.getByToken` mock 후 RTL 단위 테스트로 각 상태 전이 커버 |
| 12 | Testing | `onSubmit`의 `accessToken` 유무 분기(자동 로그인 vs `/verify-email`) 테스트 누락 | `register-form.tsx` | `authApi.register` mock으로 (a) accessToken 있음 (b) 없음 (c) email mismatch 에러 3케이스 테스트 추가 |
| 13 | Testing | `expired` 경계값(`expiresAt === dataUpdatedAt` 정각, NaN 등) 테스트 없음 | `workspace/settings/page.tsx:479` | 경계값 및 잘못된 날짜 형식 케이스 단위 테스트 추가 |
| 14 | Testing | 빈 문자열 `invitationToken`(`?invitationToken=`) 미처리 — `useEffect` 가드(`!invitationToken`)를 통과하지 않아 `getByToken("")` 호출 가능 | `register/page.tsx:13` | `invitationToken={params.invitationToken \|\| undefined}` 정규화 + 테스트 |
| 15 | Scope | `ko.ts`의 `candidatePickerEmpty` 문자열 변경이 현재 작업(초대 토큰·팀 배지)과 무관한 기존 워크플로 편집기 문자열을 수정 | `ko.ts:2113` | 현재 PR에서 되돌리거나 커밋 메시지에 의도 명시 |
| 16 | Documentation | `// react-hooks/purity 가 본문에서 Date.now() 호출을 금지하므로` — 존재하지 않는 ESLint 규칙명 참조, 독자 혼란 유발 | `workspace/settings/page.tsx` | `// Date.now()는 매 렌더마다 달라지므로 dataUpdatedAt(fetch 시점)을 기준으로 만료 판정` 으로 교체 |
| 17 | Dependency | `lucide-react` 중복 import — `Users`가 기존 블록과 별도 `import` 문으로 분리 (8개 에이전트 공통 지적) | `workflows/page.tsx` | 기존 `lucide-react` import 블록에 `Users` 병합 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Dependency | `invitationsApi`(Public, 인증 불요)와 `workspacesApi`(인증 필요)가 같은 파일에 혼재 — auth 컴포넌트가 workspace 모듈을 import하는 크로스 도메인 의존도 발생 | `workspaces.ts`, `register-form.tsx:13` | `lib/api/invitations.ts`로 분리, `InvitationMeta` 타입도 함께 이동 |
| 2 | Architecture | `RegisterFormInner`가 초대 fetch·OAuth 제어·이메일 prefill·배너 렌더링·이중 제출 흐름·라우팅을 모두 담당 — SRP 초과 | `register-form.tsx` | `useInvitationToken(token)` 커스텀 훅으로 fetch/state 분리 |
| 3 | Architecture | `MembersTab`에 invite/revoke/resend/updateRole/removeMember 5개 mutation 집중 — god component 임계점 근접 | `workspace/settings/page.tsx` | `useWorkspaceInvitations(workspaceId)` 훅으로 초대 관련 3개 mutation 추출 고려 |
| 4 | Maintainability | `useEffect` 내 초대 메타 fetch가 React Query를 우회 — 파일 내 다른 비동기 처리와 패턴 불일치 | `register-form.tsx` | `useQuery({ queryKey: ['invitation', invitationToken], enabled: !!invitationToken })` 로 교체 고려 |
| 5 | Documentation | `resendInvitation`에 "기존 토큰 무효화 + 만료 재시작"이라는 비자명한 부수 효과가 JSDoc에 미기재 | `workspaces.ts` | `/** 기존 토큰을 무효화하고 새 토큰으로 초대 메일을 재발송한다. 만료 시계가 재시작된다. */` 추가 |
| 6 | Documentation | `InvitationMeta.invitedByName: string \| null` — null인 조건(초대자 탈퇴 등) 미문서화 | `workspaces.ts` | `/** 초대자 계정이 조회 불가(탈퇴 등)일 때 null */` 인라인 주석 추가 |
| 7 | Documentation | `invitationBanner` 변수 직전 주석이 WHAT을 설명 (CLAUDE.md 규약 위반) | `register-form.tsx` | 주석 제거 또는 IIFE 사용 이유(early-return 패턴) WHY로 교체 |
| 8 | Documentation | `invitationToken` JSDoc의 spec 섹션 번호가 `§1.5.2` vs plan 문서 `§1.5` 불일치 가능성 | `auth.ts` | spec 파일 실제 섹션 번호 확인 후 수정 |
| 9 | Dependency | `InvitationMeta` 인터페이스가 사용처(`invitationsApi`)보다 아래에 선언됨 | `workspaces.ts` | 타입 선언을 `invitationsApi` 위로 이동 |
| 10 | Testing | `isTeamWorkspace` 스토어 hydrate 전 `false` → `true` flash — 배지가 뒤늦게 나타날 수 있음 | `workflows/page.tsx` | 초기 상태 및 hydrate 후 배지 표시 여부 테스트 추가 |
| 11 | Testing | i18n 키 동기화 자동 검증 없음 — 한쪽 locale만 키 추가 시 런타임 `undefined` 렌더링 | `en.ts`, `ko.ts` | `Object.keys(ko).deepEquals(Object.keys(en))` 형태의 정적 스키마 테스트 추가 |
| 12 | Requirement | `ko.ts`의 `teamBadge: "Team"` — `teamBadgeAria`는 한국어인데 배지 텍스트는 영문, 의도 불명확 | `ko.ts` | 의도적 제품 용어라면 `// product term, intentionally English` 주석 추가; 아니면 `"팀"` 으로 변경 |
| 13 | Requirement | 초대 토큰 오류 상태(`kind === "error"`)에서도 폼 제출 가능 — 사용자가 오류 배너 무시하고 제출 시도 가능 | `register-form.tsx` | `invitationToken` 있고 `invitationState.kind === "error"` 이면 submit 비활성화 또는 안내 메시지 교체 |
| 14 | Side Effect | `encodeURIComponent(token)` 적용 대상이 base64url이면 이미 URL-safe — 불필요한 연산 | `workspaces.ts` | 토큰 생성 방식 확인 후 인코딩 제거 가능 |
| 15 | Side Effect | `authApi.register` 반환 타입 변경의 다른 호출부 영향 — 단일 호출부로 보이나 확인 필요 | `auth.ts` | `grep authApi.register` 로 다른 호출부 없음 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| API Contract | **MEDIUM** | register 응답 타입 봉투 변경의 무음 실패 위험, 에러 코드 하드코딩 |
| Testing | **MEDIUM** | InvitationState 상태 머신·accessToken 분기·만료 경계값 테스트 전무 |
| Security | LOW | 초대 토큰 GET URL 노출, resendMutation 에러 패턴 불일치 |
| Architecture | LOW | setAccessToken 레이어 경계 위반, invitationsApi 도메인 혼재, IIFE 안티패턴 |
| Maintainability | LOW | lucide-react 중복 import, invitationBanner IIFE, React Query 우회 |
| Concurrency | LOW | Resend/Revoke 교차 비활성화 누락, 단일 mutation 전체 잠금 |
| Performance | LOW | useEffect deps에 t 함수 포함, lucide-react 중복 import |
| Side Effect | LOW | resendMutation 전체 잠금, lucide-react 중복, t 의존성 |
| Scope | LOW | ko.ts의 무관 문자열 수정, lucide-react 중복 import |
| Requirement | LOW | loading 중 submit 가능, 오류 상태 submit 가능, teamBadge 영문 표기 |
| Dependency | LOW | lucide-react 중복, invitationsApi/workspacesApi 혼재 |
| Documentation | LOW | 존재하지 않는 ESLint 규칙명 주석, resendInvitation 부수 효과 미기재 |
| Database | **NONE** | 프론트엔드 레이어만 변경, DB 접근 코드 없음 |

---

## 발견 없는 에이전트

- **Database** — 변경 파일 전체가 프론트엔드 레이어이며 DB 접근 코드 없음

---

## 권장 조치사항

1. **`lucide-react` 중복 import 제거** (`workflows/page.tsx`) — 8개 에이전트 공통 지적, 1분 이내 수정 가능한 명백한 오류
2. **`resendMutation.onError`를 `parseApiError` 패턴으로 통일** (`settings/page.tsx`) — `inviteMutation`, `revokeMutation`도 함께 정리
3. **에러 코드 `"invitation_email_mismatch"` 상수 추출** (`register-form.tsx`) — API 계약 취약점, 백엔드 명세에도 반환 코드 목록 명시
4. **`POST /auth/register` 응답 봉투 형식 통합 테스트 추가** — `accessToken` 자동 로그인 분기의 무음 실패를 방지할 유일한 안전망
5. **`InvitationState` 상태 머신 및 `onSubmit` 분기 프런트엔드 단위 테스트 추가** (`register-form.tsx`) — 현재 복잡도 대비 커버리지가 가장 취약한 지점
6. **초대 로딩 중 submit 버튼 비활성화** (`register-form.tsx`) — `disabled={isLoading || invitationState.kind === "loading"}`
7. **`react-hooks/purity` 잘못된 주석 수정** (`settings/page.tsx`) — 독자 혼란 방지
8. **`ko.ts` `candidatePickerEmpty` 변경 되돌리기** — 현재 PR 범위 외 수정
9. **`invitationsApi`를 `lib/api/invitations.ts`로 분리** (중기) — 도메인 경계 정리, auth ↔ workspace 교차 의존 해소
10. **i18n 키 동기화 정적 테스트 추가** — locale 불일치로 인한 런타임 `undefined` 렌더링 예방
### 발견사항

- **[WARNING]** `POST /auth/register` 응답 타입 변경 — 하위 호환성 리스크
  - 위치: `frontend/src/lib/api/auth.ts` — `register()` 반환 타입
  - 상세: 기존 `apiClient.post<{ message: string }>` → `apiClient.post<{ data: RegisterResultData }>` 로 변경. `register-form.tsx` 에서 `response.data.data` 로 접근하므로, 백엔드가 실제로 `{ data: { message, accessToken? } }` 봉투를 이미 반환하고 있어야 정상 동작. 만약 백엔드가 여전히 `{ message }` flat 구조를 반환한다면, `result?.accessToken` 은 항상 `undefined` 가 되고 초대 토큰 자동 로그인 분기가 무음으로 실패하여 사용자가 `/verify-email` 로 리다이렉트됨.
  - 제안: 백엔드 `POST /auth/register` 응답이 `{ data: { message, accessToken? } }` 봉투임을 e2e 또는 통합 테스트로 명시적으로 검증. 다른 엔드포인트(예: `verifyEmail`, `login`)가 동일 봉투를 사용하므로 일관성은 맞지만, 타입 변경 전 실제 응답 형식 확인이 필수.

- **[WARNING]** 에러 코드 문자열 하드코딩 — 계약 취약점
  - 위치: `register-form.tsx` `onSubmit` 함수 내 `code === "invitation_email_mismatch"`
  - 상세: 백엔드가 반환하는 에러 코드 `"invitation_email_mismatch"` 가 프론트엔드에 문자열 리터럴로 박혀 있음. 백엔드가 코드를 `INVITATION_EMAIL_MISMATCH` (대문자) 또는 `email_mismatch` 로 변경하면 프론트엔드 특수 처리 분기가 무음으로 무시되고 `genericFailed` 메시지가 표시됨. 같은 파일 상단의 `parseApiError` 가 `code` 를 이미 추출하고 있으나 사용하지 않음.
  - 제안: 공유 상수 또는 enum 으로 에러 코드를 관리. 단기적으로는 백엔드 명세(`spec/5-system/1-auth.md §1.5`)에 반환 코드 목록을 명시하고, 프론트엔드 타입에 `const INVITATION_EMAIL_MISMATCH = "invitation_email_mismatch"` 상수 추출.

- **[WARNING]** `resendMutation` 에러 핸들링이 `parseApiError` 패턴 미사용
  - 위치: `workspace/settings/page.tsx` `resendMutation.onError`
  - 상세: 동일 컴포넌트 상단에 `parseApiError()` 유틸이 정의되어 있고 `renameMutation`, `leaveMutation`, `deleteMutation`, `transferMutation` 등이 모두 이를 사용하는데, `resendMutation` (및 `inviteMutation`, `revokeMutation`) 만 `err instanceof Error ? err.message : fallback` 패턴을 사용. Axios 에러는 `instanceof Error` 이지만 `.message` 에는 백엔드의 구체적 메시지 대신 HTTP 상태 텍스트가 들어가므로, 백엔드가 보낸 `data.message` 가 사용자에게 노출되지 않음.
  - 제안: `resendMutation.onError` 를 `parseApiError` 패턴으로 통일.

- **[INFO]** `GET /invitations/:token` 경로에 토큰 포함 — 로그 노출 가능성
  - 위치: `workspaces.ts` `invitationsApi.getByToken`
  - 상세: 토큰이 URL 경로에 포함되어 서버 액세스 로그, 브라우저 히스토리, Referer 헤더에 남을 수 있음. 다만 이 엔드포인트는 `prefill` 전용(메타 조회)이고 초대 수락 자체는 별도 `POST /workspaces/invitations/accept` 이므로, 토큰 노출로 인한 실질적 권한 상승 위험은 낮음. 이메일 링크의 토큰이 이미 동일한 URL 경로로 공유되므로 수용 가능한 설계.
  - 제안: 추가 보안이 필요하면 `POST /invitations/meta` + 바디에 토큰 전달 방식 검토(선택).

- **[INFO]** `invitationsApi` 의 `InvitationMeta` 와 `WorkspaceInvitationSummary` 의 `invitedBy` 필드명 불일치
  - 위치: `workspaces.ts` 두 인터페이스
  - 상세: 공개 메타 응답은 `invitedByName: string | null`, 관리자 목록 응답은 `invitedBy: string | null` 으로 동일한 개념의 필드명이 다름. 백엔드 응답이 실제로 다른 키를 반환한다면 정합하지만, 일관성 차원에서 혼동 소지가 있음.
  - 제안: 백엔드 응답 스키마 확인 후 필요시 통일.

---

### 요약

이번 변경의 핵심 API 계약 리스크는 두 가지다. 첫째, `POST /auth/register` 응답 타입이 `{ message }` flat 에서 `{ data: { message, accessToken? } }` 봉투로 변경되었는데, 백엔드가 이미 해당 봉투를 반환하지 않으면 초대 토큰 자동 로그인 분기가 무음으로 실패한다. 둘째, 에러 코드 `"invitation_email_mismatch"` 가 하드코딩 문자열로만 존재해 백엔드 코드 변경 시 API 계약 불일치가 무음으로 발생할 수 있다. 신규 엔드포인트(`GET /invitations/:token`, `POST .../resend`)의 경로 설계와 인증 처리는 기존 컨벤션과 일관되고, 선택적 필드 `invitationToken?` 추가는 하위 호환성을 유지한다.

### 위험도
**MEDIUM**
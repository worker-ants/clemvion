## 발견사항

### [WARNING] 초대 토큰이 GET 요청 URL 경로에 노출
- **위치**: `workspaces.ts:invitationsApi.getByToken` — `/invitations/${encodeURIComponent(token)}`
- **상세**: prefetch 호출이 `GET /invitations/:token` 형태로 이루어지므로 토큰이 서버 접근 로그, 브라우저 히스토리, 프록시 캐시, Referer 헤더에 기록될 수 있다. 초대 링크 자체(`?invitationToken=...`)도 이미 URL에 노출되어 있어 추가 위험 표면이 한 단계 더 생긴다.
- **제안**: 메타 prefetch를 `POST /invitations/meta` 형태로 변경해 토큰을 요청 바디에 담거나, 적어도 응답에 `Cache-Control: no-store` 를 포함해 프록시 캐싱을 차단한다. 서버 로그에서 토큰 경로 마스킹도 권장.

---

### [WARNING] `inviteResend` onError에서 `err.message` 직접 노출
- **위치**: `workspace/settings/page.tsx` — `resendMutation.onError`
- **상세**: `err instanceof Error ? err.message : fallback` 패턴에서 AxiosError는 Error를 상속하므로 `err.message`(`"Request failed with status code 500"` 등)가 토스트로 노출된다. 기존 `inviteMutation`·`revokeMutation`도 같은 패턴이지만 신규 추가된 `resendMutation`에도 동일하게 적용됐다. 현재 AxiosError의 `.message`는 HTTP 상태 요약 수준이라 심각하지 않으나, `parseApiError` 헬퍼(파일 상단에 이미 정의됨)와 일관성이 없다.
- **제안**: 파일 내 이미 존재하는 `parseApiError(err)` 헬퍼로 통일한다. `resendMutation.onError`를 `const parsed = parseApiError(err); toast.error(parsed.message ?? t("workspace.resendInviteFailed"));` 형태로 변경.

---

### [INFO] 이메일 `readOnly`는 UI 제한만 제공
- **위치**: `register-form.tsx` — `<Input readOnly={emailReadOnly} />`
- **상세**: HTML `readOnly` 속성은 브라우저 개발자 도구로 제거하면 우회 가능하다. 백엔드가 토큰 이메일과 제출 이메일 불일치 시 400 `invitation_email_mismatch`를 반환하도록 강제하고 있으므로 실질적인 보안 통제는 서버 측에 있다. 프론트엔드 제한은 UX 마찰 감소 목적으로만 이해해야 한다.
- **제안**: 현재 구조(서버 측 강제 + 프론트 UX 힌트)는 올바르다. 추가 조치 불필요.

---

### [INFO] 워크스페이스 타입 판정이 클라이언트 스토어 기반
- **위치**: `workflows/page.tsx` — `useWorkspaceStore`로 `isTeamWorkspace` 판정
- **상세**: Zustand 스토어는 서버 응답으로 초기화되지만, 클라이언트 메모리 상태이므로 조작 가능하다. 그러나 Team 배지는 순수 UI 표시 요소이며 실제 접근 제어는 백엔드 `X-Workspace-Id` 헤더 기반으로 이루어지므로 보안 취약점이 아닌 의도된 설계다.
- **제안**: 현재 구조 적절. 변경 불필요.

---

### [INFO] 서버 반환 문자열이 UI에 직접 렌더링
- **위치**: `register-form.tsx` — `invitationState.message` (error 상태), `workspaceName`, `invitedByName`
- **상세**: 서버에서 받은 `workspaceName`·`invitedByName`·에러 메시지가 JSX에서 직접 렌더링된다. React는 JSX 텍스트 노드를 자동 이스케이프하므로 XSS 위험은 없다. i18n `t()` 의 `{{workspace}}` 템플릿 치환도 문자열 반환 후 JSX로 렌더링되는 구조라면 안전하다.
- **제안**: `t()` 구현이 `dangerouslySetInnerHTML`을 사용하지 않는지 확인 필요. 현재 코드 패턴상 안전한 것으로 판단.

---

## 요약

초대 토큰 흐름의 핵심 보안 통제(만료 7일, 1회 사용, 이메일 일치 강제, rate limit, RBAC 가드)는 백엔드에 적절히 구현되어 있으며 프론트엔드는 UX 레이어 역할을 명확히 하고 있다. `encodeURIComponent` 사용, OAuth 버튼 숨김, React JSX 자동 이스케이프 등 표준 보안 관행도 준수됐다. 주요 개선점은 **토큰을 GET URL 경로에 담는 설계**로, 서버 로그 및 Referer 헤더를 통한 토큰 유출 표면이 존재한다. 에러 핸들러 패턴 불일치는 `parseApiError` 헬퍼로 통일하면 해결된다.

## 위험도

**LOW**
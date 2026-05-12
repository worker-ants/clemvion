### 발견사항

---

**[WARNING] 초대 토큰 유효성 검증 로직 3중 중복**
- 위치: `workspace-invitations.service.ts` — `getMetaByToken`, `accept`, `consumeForRegistration`
- 상세: `findOne → null → NotFoundException`, `acceptedAt → GoneException`, `expiresAt < now → GoneException` 의 동일한 3단계 체크가 세 메서드에 각각 복사되어 있습니다. 만료 정책(예: 소프트 만료 허용 기간 추가)이 변경되면 세 곳을 동시에 수정해야 하고, 하나가 누락될 경우 동작이 갈라집니다.
- 제안: `private assertTokenUsable(invitation: WorkspaceInvitation | null): asserts invitation is WorkspaceInvitation` 형태의 가드 메서드로 추출하고, 세 메서드에서 호출.

---

**[WARNING] 에러 코드 케이스 불일치 — 같은 파일 내에서 혼용**
- 위치: `workspace-invitations.service.ts` 전체
- 상세: `invite()` · `revoke()` 에서는 `WORKSPACE_NOT_FOUND`, `ALREADY_A_MEMBER`, `INVITATION_NOT_FOUND`, `INVITATION_ALREADY_ACCEPTED` (UPPER_SNAKE_CASE), `getMetaByToken()` · `accept()` · `consumeForRegistration()` 에서는 `invitation_not_found`, `invitation_already_used`, `invitation_expired` (lower_snake_case). 클라이언트가 동일 서비스의 에러 코드를 처리할 때 케이스를 이중으로 분기해야 합니다.
- 제안: 파일 상단에 에러 코드 상수를 모아 두거나, 컨벤션을 하나로 통일. 신규 추가된 코드는 `lower_snake_case`를 채택했으므로 기존 `UPPER_SNAKE_CASE` 코드도 함께 정리 권장.

---

**[WARNING] Throttle 설정 값 인라인 중복**
- 위치: `workspaces.controller.ts` — `createInvitation`, `resendInvitation` 데코레이터
- 상세: `@Throttle({ default: { ttl: 60_000, limit: 10 } })` 가 두 엔드포인트에 그대로 복사. 이메일 폭격 정책이 바뀌면 두 곳을 모두 찾아서 수정해야 합니다.
- 제안:
  ```ts
  const INVITATION_THROTTLE = { default: { ttl: 60_000, limit: 10 } } as const;
  // @Throttle(INVITATION_THROTTLE)
  ```

---

**[WARNING] `resend()` 에서 이미 알고 있는 workspaceId로 workspace 재조회**
- 위치: `workspace-invitations.service.ts` — `resend()` 약 240번대 라인
- 상세: 메서드 인자로 `workspaceId`를 받아 `invitation.workspaceId`를 이미 보유하고 있음에도, 이메일 발송용 `workspace.name` 을 얻기 위해 `workspaceRepository.findOne({ where: { id: workspaceId } })` 를 추가 실행합니다. `invite()` 에서는 앞선 검증 단계에서 workspace 를 이미 들고 있으므로 패턴이 비대칭입니다.
- 제안: `dispatchEmail` 에 `workspaceName: string` 을 받도록 시그니처 변경하거나, `resend` 에서 workspace 조회 결과를 null 가드 없이 사용하는 현 코드(`workspace?.name ?? ''`)의 방어 코드를 제거.

---

**[INFO] `register` 컨트롤러의 분기 응답이 타입 좁히기에 의존**
- 위치: `auth.controller.ts` — `register()` 메서드
- 상세: `if ('accessToken' in result)` 는 덕 타이핑 기반 분기로, `RegisterResultDto` 가 선택적 필드를 가진 단일 클래스이기 때문에 타입 시스템이 두 케이스를 명시적으로 구분하지 못합니다. 서비스 반환 타입(`{ message } | { message, accessToken, refreshToken }`)은 discriminated union 이지만 컨트롤러의 분기 근거가 런타임 구조 검사에 머뭅니다.
- 제안: 서비스 반환 타입에 `readonly kind: 'pending' | 'auto-login'` 태그를 추가하면 `switch(result.kind)` 로 컴파일러가 완전성을 보장합니다. 규모가 크지 않으니 `in` 검사를 유지해도 큰 문제는 아니지만, 분기 케이스가 늘어날 경우 취약해집니다.

---

**[INFO] `registerWithInvitation` 에서 로그인 히스토리 이벤트 타입 불일치**
- 위치: `auth.service.ts` — `registerWithInvitation()` 하단
- 상세: `event: 'login_success'` 로 기록되지만 이 경로는 최초 회원가입입니다. 감사 로그에서 가입 경로를 추적할 때 일반 로그인과 구분이 어렵습니다.
- 제안: `event: 'registration_via_invitation'` 같은 별도 이벤트 타입을 사용하거나, 기존 이벤트 enum 에 추가.

---

**[INFO] `invitations.controller.ts` 의 클래스 레벨 JSDoc이 영문, 나머지는 한국어**
- 위치: `invitations.controller.ts` 상단 블록 주석
- 상세: 이 파일만 영문 클래스 주석을 사용하고, 나머지 컨트롤러(auth, workspaces)는 한국어 또는 혼용입니다. 컨벤션 불일치 자체는 경미하지만, 온보딩 시 기준이 불분명해집니다.

---

### 요약

이번 변경은 초대 토큰 기반 회원가입이라는 복잡한 플로우를 `registerWithInvitation`, `resolveTokenWorkspaceContext`, `applyAccept`, `dispatchEmail` 같은 의미 있는 단위로 잘 분리했고, 트랜잭션 경계와 동시성 처리(`affected=0 → 410`)도 명확히 표현되어 있습니다. 전반적인 가독성과 의도 전달은 양호합니다. 단, `workspace-invitations.service.ts` 내 초대 유효성 3단계 검증이 세 메서드에 중복 복사된 점이 가장 큰 유지보수 위험으로, 정책 변경 시 누락 수정 가능성이 있습니다. 에러 코드 케이스 혼용은 클라이언트 일관성에 영향을 주므로 조기 정리가 권장됩니다.

### 위험도

**MEDIUM**
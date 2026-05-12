### 발견사항

---

**[WARNING] `register` 컨트롤러 시그니처 변경 — 호출자 없음, 그러나 응답 구조 이중화**
- 위치: `auth.controller.ts` `register()` 메서드
- 상세: 이전에는 `authService.register(dto)` 결과를 그대로 리턴했으나, 이제 컨트롤러 계층에서 `{ data: ... }` 래핑을 직접 수행합니다. 다른 경로(`verifyEmail`, `login`)도 같은 패턴을 사용하므로 일관성은 있습니다. 단, `@ApiCreatedWrappedResponse` 래퍼 데코레이터가 추가 `data` 레이어를 Swagger 스펙에 표현한다고 가정할 때, 컨트롤러가 직접 `{ data: ... }` 를 리턴하면 인터셉터/래퍼가 이중으로 감싸지 않는지 확인이 필요합니다.
- 제안: 다른 엔드포인트(`login`, `verifyEmail`)와 `{ data: ... }` 직접 반환 패턴이 동일한지 교차 검증. 인터셉터가 자동 래핑하는 방식이라면 이중 래핑 버그 발생.

---

**[WARNING] `authService.register` 시그니처 변경 — 기존 호출자 파악 필요**
- 위치: `auth.service.ts` `register()` 메서드
- 상세: `register(dto)` → `register(dto, ctx = {})` 로 시그니처 변경. `ctx` 에 기본값이 있어 하위 호환성은 유지됩니다. 하지만 반환 타입이 `{ message: string }` 단수에서 유니온 `{ message } | { message, accessToken, refreshToken }` 으로 확대되었습니다. 테스트 파일 외에 이 메서드를 직접 호출하는 위치가 있다면 반환값 처리 누락 가능성이 있습니다.
- 제안: `grep -r "authService.register\|\.register(" backend/src` 로 호출 지점 전수 확인.

---

**[WARNING] `sendWorkspaceInvitationEmail` 시그니처 파괴적 변경**
- 위치: `mail.service.ts` `sendWorkspaceInvitationEmail(email, workspaceName, invitedByName, token)`
- 상세: 파라미터 `invitedByName: string | null` 이 `workspaceName` 과 `token` 사이에 삽입되었습니다. 이 메서드를 호출하는 모든 위치가 업데이트되지 않으면 타입 에러 또는 런타임 오동작이 발생합니다. 변경된 파일에서는 `workspace-invitations.service.ts`의 `dispatchEmail()` 만 업데이트되었습니다.
- 제안: 코드베이스 전체에서 `sendWorkspaceInvitationEmail` 호출 위치를 검색하여 모두 새 시그니처로 맞춰졌는지 확인. TypeScript 컴파일러가 잡겠지만, 런타임 전에 빌드 검증 필수.

---

**[WARNING] `consumeForRegistration` 내 이중 검증 — TOCTOU 잠재 위험**
- 위치: `workspace-invitations.service.ts` `consumeForRegistration()` → `applyAccept()`
- 상세: `consumeForRegistration`은 외부 트랜잭션(AuthService의 `dataSource.transaction`) 내에서 호출됩니다. 내부에서 `findOne`으로 초대 행을 조회하고 유효성 검사 후 `applyAccept`를 호출합니다. `applyAccept`는 `accepted_at IS NULL` 조건부 UPDATE로 원자적 소비를 구현합니다. **그러나** `registerWithInvitation`의 외부 트랜잭션 시작 전에 `getMetaByToken`(읽기 전용, 트랜잭션 외부)으로 이메일 검증을 먼저 수행합니다. 두 DB 읽기 사이에 초대가 만료/소비될 수 있으나, `applyAccept`의 원자적 UPDATE가 최종 방어선이므로 실질적 위험은 낮습니다.
- 제안: 현재 설계는 허용 가능. 단, 에러 메시지가 `getMetaByToken` 단계(`invitation_expired`)와 `applyAccept` 단계(`invitation_already_used`)에서 다르게 나올 수 있음을 문서화.

---

**[WARNING] `resolveTokenWorkspaceContext` — `listForUser` 결과의 결정론적 순서 미보장**
- 위치: `auth.service.ts` `resolveTokenWorkspaceContext()`
- 상세: `memberships[0]`을 첫 번째 워크스페이스로 선택합니다. `listForUser`의 정렬 순서가 명시되지 않았다면, 사용자가 여러 팀 워크스페이스에 속할 경우 토큰의 `workspaceId` 클레임이 비결정론적으로 바뀔 수 있습니다. 초대 토큰 가입 직후에는 멤버십이 하나뿐이므로 즉시 문제가 되지는 않지만, 이후 추가 초대 수락 시 기존 토큰 갱신(`/refresh`) 경로에서 다른 워크스페이스가 선택될 수 있습니다.
- 제안: `listForUser`에 명시적 정렬(예: `joinedAt ASC` 또는 `createdAt ASC`)을 추가하거나, `resolveTokenWorkspaceContext`의 fallback 선택 로직을 결정론적으로 고정.

---

**[INFO] `getMetaByToken` 공개 엔드포인트 — 토큰 존재 여부 노출**
- 위치: `invitations.controller.ts` `GET /invitations/:token`
- 상세: `@Public()` 으로 인증 없이 접근 가능하며, 404(없음)·410(만료/사용됨)을 구분하여 반환합니다. 토큰이 추측 가능한 형태라면 존재 여부를 오라클로 사용할 수 있으나, 48바이트 랜덤(base64url 64자)이므로 실질적 열거 위험은 없습니다. Throttle이 없다는 점은 주목할 만합니다.
- 제안: 남용 방지를 위해 `@Throttle` 적용 검토 (IP당 분당 N회). 현재는 INFO 수준.

---

**[INFO] `registerWithInvitation` — loginHistory 기록을 `void`로 fire-and-forget**
- 위치: `auth.service.ts` `registerWithInvitation()`
- 상세: `void this.loginHistory.record(...)` 패턴이 다른 경로(login, verifyEmail)와 일관됩니다. 로그인 이력 기록 실패가 가입 응답에 영향을 주지 않는 의도적 설계입니다. 다만, 에러가 무음으로 삭제됩니다.
- 제안: 해당 패턴이 코드베이스 표준이라면 OK. 아니라면 `loginHistory.record` 내부에 자체 에러 핸들링이 있는지 확인.

---

**[INFO] `InvitationsController` 등록 — 라우트 충돌 가능성**
- 위치: `workspaces.module.ts`, `invitations.controller.ts`
- 상세: `WorkspacesController`는 `POST /workspaces/invitations/accept` 를, `InvitationsController`는 `GET /invitations/:token` 을 등록합니다. 두 컨트롤러의 베이스 경로(`/workspaces` vs `/invitations`)가 다르므로 충돌은 없습니다. 단, `GET /invitations/:token` 에서 `:token` 파라미터가 UUID 형식이 아닌 base64url이기 때문에 `ParseUUIDPipe` 미적용은 올바른 판단입니다.
- 제안: 이상 없음.

---

### 요약

이번 변경의 핵심 부작용 위험은 두 가지입니다. 첫째, `sendWorkspaceInvitationEmail` 시그니처에 `invitedByName` 파라미터가 중간 삽입되었으므로 해당 메서드를 호출하는 모든 위치가 빠짐없이 업데이트되었는지 빌드 단계에서 반드시 검증해야 합니다 — TypeScript가 컴파일 오류로 잡겠지만 빌드를 통과했는지 확인이 필요합니다. 둘째, `resolveTokenWorkspaceContext`의 `listForUser` 결과에서 첫 번째 워크스페이스를 선택하는 로직이 정렬 순서에 의존하므로, 다중 멤버십 사용자의 토큰 클레임이 비결정론적이 될 수 있습니다. 나머지 변경(트랜잭션 내 원자적 초대 소비, 공개 메타 조회, 재발송 토큰 재발급)은 설계 의도에 부합하며 의도치 않은 상태 변경은 발견되지 않았습니다.

### 위험도

**MEDIUM** — `sendWorkspaceInvitationEmail` 시그니처 변경이 빌드 검증 전까지 잠재적 파괴적 변경이며, `resolveTokenWorkspaceContext`의 비결정론적 워크스페이스 선택은 운영 중 재현 어려운 버그로 발전할 수 있습니다.
### 발견사항

---

**[WARNING] `consumeForRegistration`의 `applyAccept` 호출 — 트랜잭션 내 QueryBuilder mock 불일치**
- 위치: `workspace-invitations.service.spec.ts` — `consumeForRegistration` describe 블록
- 상세: `consumeForRegistration`은 내부적으로 `applyAccept`를 호출하고, `applyAccept`는 `manager.getRepository(WorkspaceInvitation).createQueryBuilder()`를 사용합니다. 그런데 테스트의 `captureManager()`가 `dataSource.transaction`을 직접 실행해서 stub manager를 얻는 구조라, 실제 테스트 시 `invitationRepo.createQueryBuilder`가 QueryBuilder를 반환하도록 `buildDataSource`에서 셋업됩니다. 하지만 `consumeForRegistration` 테스트에서 `invitationRepo.findOne`을 stub한 뒤 `applyAccept`가 다시 같은 `invitationRepo`를 통해 `createQueryBuilder`를 호출하므로, `updateMock`이 `affected: 1`을 반환하는지가 보장되어야 하는데 이를 **명시적으로 검증하지 않습니다**. 현재 통과하는 이유는 default `updateAffected: 1`이지만, 이 연결 구조가 주석이나 테스트 이름으로 드러나지 않아 다음 편집자가 mock을 바꾸면 묵묵히 깨질 수 있습니다.
- 제안: `expect(updateMock).toHaveBeenCalled()`를 `consumeForRegistration` 성공 케이스에 추가하거나, mock 의존 경로를 인라인 주석으로 표시

---

**[WARNING] `auth.service.spec.ts` — `invitationToken` 플로우에서 `authContext` 미전달**
- 위치: `auth.service.spec.ts:261` 일대 — 모든 `service.register(...)` 호출
- 상세: 실제 서비스 시그니처는 `register(dto, ctx: AuthContext = {})` 이며, `auth.controller.ts`에서 항상 `authContextFromRequest(req)`를 전달합니다. 그러나 spec 파일의 모든 `register` 호출은 ctx를 생략하여 `{}` 기본값을 사용합니다. 이는 `loginHistory.record`에서 `ip`·`userAgent`가 null로 기록되는 경로만 테스트하는 것이므로, 실제 IP 포함 경로(refresh token 패밀리 생성 시 ctx 전달 여부)는 미검증 상태입니다. critical하진 않지만 회귀 위험 있음.
- 제안: ctx가 포함된 케이스 1개 추가 또는 loginHistory.record 호출 시 `ip`·`userAgent` 인자 검증

---

**[WARNING] `invitations.controller.ts` (`GET /invitations/:token`) — 전용 컨트롤러 테스트 없음**
- 위치: `invitations.controller.ts` (신규 파일)
- 상세: `InvitationsController`는 새로 추가된 파일이지만 `.spec.ts`가 없습니다. 컨트롤러 레이어는 `@Public()` 데코레이터와 `getMetaByToken` 위임만 하므로 로직은 단순하나, `@Public()` guard bypass가 실제로 동작하는지, 404·410 예외가 HTTP 상태코드로 올바르게 매핑되는지는 통합 테스트 또는 컨트롤러 단위 테스트 없이는 보장할 수 없습니다.
- 제안: `InvitationsController` spec 파일 추가 — `getMetaByToken` 성공/NotFoundException/GoneException 케이스 각 1개

---

**[INFO] `auth.controller.ts` — register 분기 로직 컨트롤러 단위 테스트 없음**
- 위치: `auth.controller.ts:125–138`
- 상세: `'accessToken' in result` 분기로 쿠키 설정 여부가 달라지는 새 로직이 있으나, `auth.controller.spec.ts`(파일 자체가 diff에 없음)에 이를 커버하는 테스트가 없을 가능성이 높습니다. 서비스 레이어 테스트만으로는 `setRefreshTokenCookie` 호출 여부와 응답 형태를 보장하지 못합니다.
- 제안: 컨트롤러 테스트에 (1) 초대 토큰 있는 가입 → accessToken 반환 + 쿠키 설정, (2) 일반 가입 → message만 반환 + 쿠키 미설정 케이스 추가

---

**[INFO] `workspace-invitations.service.spec.ts` — `resend` 시 mail 실패해도 저장은 성공하는 경로 미검증**
- 위치: `resend` describe 블록
- 상세: `invite` 블록에는 "mail 실패해도 invitation row는 저장된다" 케이스가 있지만, 동일 로직을 공유하는 `resend`에는 해당 케이스가 없습니다. `dispatchEmail`이 catch로 삼키는 구조가 `resend`에도 적용되므로 동일한 테스트가 있어야 일관성이 확보됩니다.
- 제안: `resend` describe에 "mail 실패 시에도 저장 결과 반환" 케이스 추가

---

**[INFO] `resolveTokenWorkspaceContext` — `getMemberRole` 반환값 null 경로 미검증**
- 위치: `auth.service.ts:600` — `const role = (await ... getMemberRole(...)) ?? 'owner'`
- 상세: `findPersonalWorkspace`가 존재할 때 `getMemberRole`이 null을 반환하면 `'owner'`로 폴백합니다. 이 경로를 커버하는 테스트가 없습니다. spec 상 개인 워크스페이스는 항상 owner이므로 실제 발생 가능성은 낮지만, null 폴백이 의도적 설계임을 테스트로 문서화할 가치가 있습니다.
- 제안: `getMemberRole`이 null을 반환할 때 role이 `'owner'`가 되는 케이스 1개 추가

---

**[INFO] `getMetaByToken` — `workspace`가 null인 엣지 케이스 미검증**
- 위치: `workspace-invitations.service.ts:208` — `workspace?.name ?? ''`
- 상세: invitation이 유효하더라도 workspace가 삭제된 경우 `workspaceName`이 빈 문자열로 반환됩니다. 현재 테스트는 workspace가 항상 존재하는 경우만 커버합니다. 이 경로가 실제로 발생 가능하다면(cascade delete 미설정 등) 테스트로 명시해야 합니다.
- 제안: workspace 조회 결과 null 시 `workspaceName: ''` 반환 케이스 추가 또는 서비스에서 NotFoundException 처리 후 테스트 추가

---

### 요약

전체적으로 테스트 커버리지 수준은 양호합니다. 핵심 경로(이메일 불일치 거부, 트랜잭션 롤백, 동시 accept 경합, consumeForRegistration 410 전파)가 모두 spec으로 커버되어 있고, mock 구조도 `buildDataSource` 팩토리로 잘 추상화되어 재사용성이 높습니다. 주요 위험은 두 가지입니다: (1) 신규 `InvitationsController`에 단위 테스트가 전혀 없어 `@Public()` 바이패스와 HTTP 상태 매핑이 미검증 상태이고, (2) `auth.controller.ts`의 register 분기 로직(쿠키 설정 vs 미설정)을 커버하는 컨트롤러 테스트가 없습니다. 서비스 레이어 테스트는 충실하나 컨트롤러 레이어 테스트가 diff에서 완전히 누락된 점이 회귀 위험의 주 원인입니다.

### 위험도

**LOW**
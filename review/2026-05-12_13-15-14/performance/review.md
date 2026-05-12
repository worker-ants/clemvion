### 발견사항

---

**[HIGH]** `registerWithInvitation`에서 동일 초대 토큰을 DB에서 두 번 조회

- **위치**: `auth.service.ts` — `registerWithInvitation` → `getMetaByToken` + 트랜잭션 내 `consumeForRegistration`
- **상세**: `getMetaByToken`이 `invitationRepository.findOne({ where: { token } })`를 수행하고, 이후 `consumeForRegistration` 내부의 `invitationRepo.findOne({ where: { token } })`이 동일 행을 다시 읽는다. 회원가입 1건당 초대 토큰 조회 쿼리가 불필요하게 2회 발생한다.
- **제안**: `registerWithInvitation`에서 meta 조회를 분리하지 말고, 트랜잭션 시작 전에 토큰을 조회해서 이메일 검증에 쓴 후, 그 행 객체(entity)를 `consumeForRegistration`에 직접 전달하는 오버로드를 추가하거나, 두 단계를 단일 메서드로 합쳐 1회만 읽도록 변경한다.

---

**[MEDIUM]** `resolveTokenWorkspaceContext`가 모든 토큰 발급 경로(login, verify-email, registerWithInvitation)에서 직렬로 2회 DB 쿼리 실행

- **위치**: `auth.service.ts:resolveTokenWorkspaceContext`
- **상세**: 개인 워크스페이스가 있는 일반 사용자(= 가장 빈번한 케이스)는 `findPersonalWorkspace` → `getMemberRole` 순으로 2개의 순차 쿼리가 실행된다. `getMemberRole`은 워크스페이스 id와 user id로 멤버 행을 읽을 뿐이므로, `findPersonalWorkspace`가 멤버 행(role 포함)을 JOIN해 반환하면 단일 쿼리로 줄일 수 있다.
- **제안**: `findPersonalWorkspace`를 `WorkspaceMember` JOIN으로 변경해 `{ workspace, role }` 형태로 반환하거나, 별도의 `findPersonalWorkspaceWithRole(userId)` 메서드를 추가해 2-hop을 1-hop으로 줄인다.

---

**[MEDIUM]** `resolveTokenWorkspaceContext`의 fallback 경로에서 `listForUser`가 전체 멤버십을 로드하고 첫 번째 항목만 사용

- **위치**: `auth.service.ts:resolveTokenWorkspaceContext` — `memberships[0]` 참조
- **상세**: `listForUser`는 사용자의 모든 워크스페이스를 ORDER BY 포함해 반환하는 쿼리인데, 초대 토큰 가입 직후에는 항상 멤버십이 1건이지만 시간이 지나 사용자가 다수 워크스페이스에 소속될 경우 불필요한 데이터를 전부 읽게 된다.
- **제안**: `listForUser` 대신 `LIMIT 1`이 붙은 단일 멤버십 조회 메서드를 추가하거나, `listForUser`에 `limit` 파라미터를 추가해 이 경로에서는 `limit: 1`로 호출한다.

---

**[WARNING]** `resend`에서 workspace + inviter 조회가 직렬로 실행

- **위치**: `workspace-invitations.service.ts:resend` — `workspaceRepository.findOne` 이후 `userRepository.findOne`
- **상세**: 두 쿼리는 서로 의존하지 않음에도 순차적으로 실행된다. 빈도가 낮은 API이나 구조적으로 낭비다.
- **제안**: `Promise.all([workspaceRepo.findOne(...), userRepo.findOne(...)])`으로 병렬화한다. `getMetaByToken`에서는 이미 이 패턴이 적용되어 있어 일관성도 맞춰진다.

---

**[WARNING]** `invite`에서 inviter 조회가 invitation 저장 이후 직렬로 실행

- **위치**: `workspace-invitations.service.ts:invite` — `save` 이후 `userRepository.findOne({ where: { id: requesterId } })`
- **상세**: inviter 이름은 이메일 발송에만 필요하고, invitation row 저장 결과와 무관하다. 저장과 inviter 조회를 병렬화할 수 있다.
- **제안**: `save` 호출 결과를 기다리는 동안 inviter 조회도 함께 진행하도록 `Promise.all([invitationRepository.save(...), userRepository.findOne(...)])`으로 구성한다.

---

**[INFO]** `getMetaByToken` — 만료/사용 여부를 DB 레벨에서 걸러낼 수 있는 기회

- **위치**: `workspace-invitations.service.ts:getMetaByToken`
- **상세**: 현재는 행을 먼저 읽은 후 애플리케이션 레벨에서 `acceptedAt`, `expiresAt` 을 검사한다. DB 인덱스와 `WHERE accepted_at IS NULL AND expires_at > NOW()` 조건을 쿼리에 포함하면 애플리케이션으로 전달되는 데이터가 줄고 DB 실행 계획이 더 좁아진다. 다만 이는 `accept`의 선점 경쟁 감지(`affected=0`)와 별개이므로 조건을 WHERE에 추가해도 GoneException 분기는 유지해야 한다.

---

### 요약

이번 변경의 핵심 성능 우려는 두 가지다. 첫째, `registerWithInvitation`에서 동일 초대 토큰 행을 두 번 읽는 불필요한 DB 왕복(`getMetaByToken` + `consumeForRegistration`). 둘째, 모든 토큰 발급 경로(`login`, `verifyEmail`, `registerWithInvitation`)에 걸쳐 있는 `resolveTokenWorkspaceContext`의 직렬 2-hop 쿼리(`findPersonalWorkspace` → `getMemberRole`)로, 이는 가장 빈번한 코드 경로에 상시 존재하는 오버헤드다. `resend`와 `invite`의 병렬화 누락은 빈도가 낮아 실 운영 영향은 작지만, 이미 `getMetaByToken`에서 `Promise.all` 패턴을 사용한 것과 일관성이 없다. 전반적으로 기능 로직은 견고하게 구현되었으나, 위의 두 고빈도 경로 쿼리 최적화는 출시 전 반영을 권장한다.

### 위험도

**MEDIUM**
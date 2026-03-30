## 부작용 코드 리뷰 결과

### 발견사항

---

**[WARNING] `verifyEmail`에서 워크스페이스 중복 생성 가능성**
- 위치: `auth.service.ts` - `verifyEmail` 메서드 내 transaction 블록
- 상세: 이메일 인증 시 `dataSource.transaction`으로 워크스페이스를 직접 생성하고, 이후 `generateTokens`에서 `findOrCreatePersonalWorkspace`를 다시 호출한다. 두 경로가 모두 워크스페이스를 생성할 수 있는 경로를 열어둔 상태이며, 트랜잭션 내 생성 후 `generateTokens`가 또 `findPersonalWorkspace`를 조회하면 정상이지만, 레이스 컨디션 또는 예외 발생 후 재시도 시 중복 워크스페이스가 생성될 수 있다. (UNIQUE 제약이 `(ownerId, type)` 조합에 없다면 실제 중복 삽입 발생)
- 제안: `verifyEmail` 트랜잭션과 `generateTokens`의 `findOrCreatePersonalWorkspace` 사이의 중복을 제거하거나, `Workspace` 테이블에 `(ownerId, type)` 유니크 제약 조건이 있는지 확인할 것

---

**[WARNING] 트랜잭션 범위 불일치 — 토큰 발급이 트랜잭션 밖에서 수행됨**
- 위치: `auth.service.ts` - `verifyEmail` 메서드
- 상세: `dataSource.transaction`으로 유저 이메일 인증 상태 업데이트와 워크스페이스 생성을 묶었으나, `generateTokens` (refresh token 저장 포함)는 트랜잭션 외부에서 실행된다. 트랜잭션이 성공했지만 `generateTokens` 중 DB 오류 발생 시, 이메일은 인증 완료 상태이나 토큰이 없는 애매한 상태가 된다. 반대로 트랜잭션이 롤백되면 워크스페이스 없이 사용자가 남겨진다.
- 제안: `generateTokens`의 refresh token 저장도 동일한 트랜잭션에 포함시키거나, 실패 시 재시도 가능한 멱등성 보장 로직 추가

---

**[WARNING] `generateTokens`에서 항상 워크스페이스를 생성하는 부작용 추가**
- 위치: `auth.service.ts` - `generateTokens` (기존 `findPersonalWorkspace` → `findOrCreatePersonalWorkspace` 변경)
- 상세: 기존에는 토큰 생성 시 워크스페이스를 조회만 했으나, 변경 후에는 없으면 새로 생성한다. `refresh`, `login` 등 `generateTokens`를 호출하는 모든 경로에서 의도치 않은 워크스페이스 생성이 발생할 수 있다. 특히 `refresh` 플로우에서 워크스페이스가 삭제된 유저의 토큰을 갱신할 경우 자동으로 워크스페이스가 재생성되는 부작용이 생긴다.
- 제안: `findOrCreatePersonalWorkspace`를 `login` 경로에만 명시적으로 호출하고, `generateTokens`는 다시 `findPersonalWorkspace`만 수행하도록 분리

---

**[INFO] `eslint-disable` 주석 제거 — `workspacesService` 미사용 변수 억제 제거**
- 위치: `auth.service.spec.ts` - 21번째 라인 (`workspacesService` 선언부)
- 상세: 기존 `// eslint-disable-next-line @typescript-eslint/no-unused-vars` 주석이 제거되었는데, `workspacesService`가 이제 테스트 내에서 실제로 사용되고 있으므로 올바른 변경이다. 부작용 없음.

---

**[INFO] 테스트에서 `private` 메서드 직접 spy — 내부 구현 의존**
- 위치: `auth.service.spec.ts` - `verifyEmail` 테스트 블록
- 상세: `jest.spyOn(service as never, 'findUserByVerifyToken' as never)`로 private 메서드를 직접 mocking한다. 내부 구현 변경 시 테스트가 깨지는 취약한 구조이지만, TypeScript 컴파일 후 런타임에서는 private 보호가 없으므로 동작은 한다. 부작용이라기보다 유지보수 위험.
- 제안: `findUserByVerifyToken`을 `protected`로 변경하거나, 토큰 DB 조회를 repository mock 레벨에서 제어하도록 테스트 재작성

---

### 요약

이번 변경의 핵심 부작용 위험은 **워크스페이스 생성 로직의 이중화**에 있다. `verifyEmail`에서 트랜잭션 내 직접 생성 + `generateTokens`의 `findOrCreatePersonalWorkspace` 호출이 겹쳐 있어, 정상 경로에서는 `findPersonalWorkspace`가 방어하지만 레이스 컨디션이나 DB 유니크 제약 부재 시 중복 워크스페이스가 생성될 수 있다. 또한 `generateTokens`가 이제 상태를 변경하는 함수가 되어 `refresh` 플로우에서 예상치 못한 워크스페이스 자동 재생성 부작용을 가진다. 트랜잭션 경계도 이메일 인증 + 워크스페이스 생성만 커버하고 refresh token 발급은 제외되어 있어, 실패 시 불일치 상태가 발생할 수 있다.

### 위험도

**MEDIUM**
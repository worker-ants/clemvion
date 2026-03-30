# 코드 리뷰 이슈 조치 내용

## Critical 이슈

### 1. AuthService 레이어 경계 위반 (Workspace/WorkspaceMember 직접 조작)
- **조치**: `WorkspacesService.createPersonalWorkspace()`에 `manager?: EntityManager` 파라미터 추가
- `AuthService.verifyEmail()`에서 엔티티 직접 import/조작 제거, `WorkspacesService`에 위임
- `Workspace`, `WorkspaceMember` import 제거, `DataSource`는 트랜잭션 관리만 담당

### 2. TOCTOU 경쟁 조건 (findOrCreatePersonalWorkspace)
- **조치**: `Workspace` 엔티티에 `@Unique(['ownerId', 'type'])` + `@Index(['ownerId', 'type'])` 추가
- `findOrCreatePersonalWorkspace()`에 try-catch 패턴 적용: create 실패 시 재조회로 fallback
- 동시 요청 시에도 중복 워크스페이스 생성 방지

## Warning 이슈

### 3. generateTokens 부수 효과
- **판단**: Phase 1에서는 `findOrCreatePersonalWorkspace`를 `generateTokens`에서 호출하는 것이 안전망 역할. 기존에 워크스페이스 없는 사용자가 이미 존재할 수 있으므로, login/refresh 시 자동 복구가 필요. Phase 2에서 워크스페이스 선택 UI 도입 시 리팩토링 예정.

### 4. createPersonalWorkspace 트랜잭션 래핑
- **조치**: `verifyEmail`에서 이미 트랜잭션 컨텍스트로 호출됨 (manager 전달). `findOrCreatePersonalWorkspace`에서의 호출은 DB 유니크 제약으로 보호.

### 5~6. console.log 토큰, slug 엔트로피
- **판단**: 기존부터 존재하던 이슈로 이번 변경 범위 외. 별도 이슈로 추적 필요.

### 7~8. 테스트 개선
- **조치**:
  - `workspaces.service.spec.ts`: EntityManager 위임 테스트, race condition fallback 테스트, slug 형식 검증 추가
  - `auth.service.spec.ts`: `findOrCreatePersonalWorkspace` mock 추가, verifyEmail 트랜잭션 테스트 추가

## 검증 결과
- lint: 0 errors (warnings only: unsafe-return in test mocks)
- unit test: 208 passed
- build: 성공

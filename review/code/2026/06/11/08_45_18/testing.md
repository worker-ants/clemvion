# Testing Review — auth-refresh-rotation-atomic

## 발견사항

### [INFO] 트랜잭션 mock 라우팅 로직이 `beforeEach` 스코프 외부 변수를 참조
- 위치: `auth.service.spec.ts` lines 244–262 (DataSource 프로바이더 내 `getRepository` mock)
- 상세: `mockImplementation` 콜백 안에서 `mockRefreshTokenRepo` 를 참조하는데, 이 변수는 같은 `beforeEach` 블록 내 `const mockRefreshTokenRepo = {...}` 로 선언된다. 클로저 캡처이므로 각 테스트마다 재생성된 인스턴스가 올바르게 참조되고 실제로 동작한다. 다만 `refreshTokenRepo = module.get(...)` 으로 가져온 외부 변수와 내부 `mockRefreshTokenRepo` 가 동일 인스턴스임에 대한 주석이 없어 가독성이 다소 낮다.
- 제안: `// mockRefreshTokenRepo === module.get(getRepositoryToken(RefreshToken)) — same instance` 한 줄 주석 추가로 의도 명시 권장. 기능 문제는 없음.

### [INFO] 롤백 시나리오 테스트가 "구 토큰 is_revoked=false 유지" 를 직접 단언하지 않음
- 위치: `auth.service.spec.ts` 79–96행 "propagates failure (transaction rolls back)..."
- 상세: 테스트 명칭과 주석은 "트랜잭션 롤백 시 구 토큰 is_revoked=false 유지" 를 언급하지만, 단언은 에러 전파 확인(`rejects.toThrow`)과 `transaction` 호출 횟수만 검증한다. unit mock 수준에서는 실제 DB 트랜잭션이 없으므로 `update(is_revoked=true)` 가 이미 호출된 후 롤백이 된 것인지 아닌지를 `refreshTokenRepo.update` 호출 여부로 추가 검증할 수 있다. 현재 mock 구조(`transaction` → cb 즉시 실행)에서는 `save` 실패 시 `update` 가 이미 호출된 상태이므로 "is_revoked=false 유지" 주장은 단위 테스트에서 검증 불가임을 주석으로 명시하거나, 또는 `refreshTokenRepo.update` 가 호출되었는지/미호출인지 단언하는 구조를 추가하면 의도가 더 명확해진다.
- 제안: 테스트 주석에 "단위 mock 에서는 실제 DB 롤백 불가 — 에러 전파만 검증, 실제 롤백은 integration 테스트 필요" 문구 추가 또는 `expect(refreshTokenRepo.update).toHaveBeenCalledWith('rt-1', expect.objectContaining({ isRevoked: true }))` 를 추가해 revoke 호출 자체는 발생했음(그리고 에러로 중단됨)을 명시.

### [INFO] `register (with invitationToken)` describe 의 `stubInvitationFriendlyDataSource` 가 새 테스트 추가 후 `mockDataSource.transaction` 을 전면 override
- 위치: `auth.service.spec.ts` 380–413행
- 상세: `stubInvitationFriendlyDataSource()` 가 `mockDataSource.transaction` 을 완전히 재정의하므로 해당 describe 블록 내 모든 테스트는 refresh rotation 트랜잭션 mock 을 사용하지 않는다. 기존 invitation 흐름 테스트에는 문제 없으나, 향후 이 describe 안에 refresh rotation 관련 케이스를 추가할 경우 mock 충돌 위험이 있다. 현재는 범위가 명확히 분리되어 문제 없음.
- 제안: 주석으로 "이 describe 는 invitation transaction mock 을 우선 적용하므로 refresh rotation 관련 케이스는 별도 describe 에 추가" 명시 권장.

### [INFO] `should refresh tokens with valid refresh token` 기존 테스트와 신규 원자성 테스트 간 중복 setup
- 위치: `auth.service.spec.ts` 633–645행, 648–677행
- 상세: 기존 테스트는 `refreshTokenRepo.update` 호출 여부만 단언하고, 신규 원자성 테스트는 `mockDataSource.transaction` 호출 + `update` 파라미터 + `save` 호출을 함께 검증한다. 기존 테스트의 `expect(refreshTokenRepo.update).toHaveBeenCalled()` 는 신규 테스트가 더 정밀하게 커버하므로 중복 수준이 있다. 단, 기존 테스트는 `result.accessToken` 응답값을 검증하는 유일한 케이스이므로 제거보다는 유지가 적절하다.
- 제안: 기존 테스트의 `expect(refreshTokenRepo.update).toHaveBeenCalled()` 는 신규 원자성 테스트로 포괄되므로 제거해도 되지만, 반응형 응답 검증 역할은 유지.

### [WARNING] 만료된 refresh token 경로에 대한 트랜잭션 비호출 검증 없음
- 위치: `auth.service.ts` 1670–1675행 (`if (new Date() > stored.expiresAt)` 분기), 스펙 기술 범위 내 미커버
- 상세: 만료 토큰 케이스는 트랜잭션 없이 즉시 `UnauthorizedException(TOKEN_EXPIRED)` 를 던져야 한다. 기존 테스트 suite 에 만료 토큰 케이스(`expiresAt < now`)가 없고, 따라서 `mockDataSource.transaction` 이 호출되지 않음을 검증하는 케이스도 없다. 향후 만료 분기에 실수로 트랜잭션이 삽입되더라도 잡을 방법이 없다.
- 제안: 아래 케이스 추가 권장:
  ```typescript
  it('rejects with TOKEN_EXPIRED and does not start a transaction for expired tokens', async () => {
    refreshTokenRepo.findOne.mockResolvedValue({
      id: 'rt-1', userId: mockUser.id, familyId: 'family-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() - 1000),
      user: mockUser,
    });
    await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    expect(mockDataSource.transaction).not.toHaveBeenCalled();
  });
  ```

### [WARNING] `generateTokens` 에 `manager` 전달 시 `resolveTokenWorkspaceContext` 가 트랜잭션 밖에서 실행되는 경로 미테스트
- 위치: `auth.service.ts` `generateTokens` 1828행 (`resolveTokenWorkspaceContext` 호출)
- 상세: `generateTokens` 는 `manager` 를 받아도 `resolveTokenWorkspaceContext` (workspacesService 조회)는 항상 트랜잭션 밖에서 실행한다. 이는 의도된 설계(JWT sign 과 마찬가지로 DB 무관 선계산)이지만, 만약 workspace 조회 실패 시 트랜잭션이 어떻게 처리되는지 테스트 커버가 없다. 현재 테스트는 workspace 조회를 항상 성공하는 mock 으로만 실행된다.
- 제안: refresh rotation 중 `resolveTokenWorkspaceContext` 실패 시 동작 테스트 추가 고려 (트랜잭션이 열리기 전 실패하므로 DB 롤백 필요 없음 — 이 의미를 테스트로 문서화).

### [INFO] `invitation` 경로 `registerWithInvitation` 의 트랜잭션 내 `generateTokens` 호출이 `manager` 없이 실행됨
- 위치: `auth.service.ts` 1251행 (`this.generateTokens(savedUser, false, undefined, ctx)`)
- 상세: `registerWithInvitation` 는 user row 생성과 invitation 소비를 트랜잭션으로 묶지만, `generateTokens` 는 트랜잭션 밖에서(manager 없이) 호출된다. refresh rotation 과 달리 invitation 흐름에서는 새 refresh token INSERT 가 트랜잭션에 합류하지 않아 user 생성 성공 + refresh token INSERT 실패 시 user 만 남는 부분 성공 가능성이 있다. 현재 스펙과 plan 에서는 이 케이스가 명시되지 않으나, 05 C-1 도입의 철학과 일관성이 맞지 않는다.
- 제안: 이 케이스는 현 변경 범위(refresh rotation 원자화)를 벗어나므로 즉시 차단은 아니나, 후속 plan 아이템으로 등록 권장.

## 요약

이번 변경은 refresh token 회전의 원자성 확보를 목적으로 하며, 핵심 케이스 두 개(정상 회전 원자성 확인, INSERT 실패 시 에러 전파)를 신규 테스트로 직접 커버한다. mock 구조 변경(getRepository 분기 라우팅)도 기존 invite/reuse 테스트를 깨지 않도록 설계되었고, 기존 테스트 격리도 유지된다. 주요 미비점은 만료 토큰 경로에서 트랜잭션이 열리지 않음을 검증하는 케이스 부재(WARNING)와, 롤백 시나리오 단언이 mock 한계 때문에 "is_revoked=false 유지"를 직접 증명하지 못하면서도 주석에서 그렇게 주장하는 서술 불일치(INFO)다. 전체적으로 변경의 의도에 맞는 테스트가 추가되었으나 만료 경로 커버리지 갭이 경미한 위험 요소로 남는다.

## 위험도

LOW

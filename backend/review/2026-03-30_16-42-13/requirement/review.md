## 요구사항 관점 코드 리뷰

### 파일 1: `workspace.decorator.spec.ts`

### 발견사항

- **[INFO]** 헤더 우선순위 정책 검증 완료
  - 위치: `should return workspace ID from X-Workspace-Id header`
  - 상세: X-Workspace-Id 헤더가 JWT보다 우선함을 명시적으로 테스트
  - 제안: 없음

- **[WARNING]** `null` user 케이스 미검증
  - 위치: `should throw BadRequestException when user is undefined` (line 55)
  - 상세: `user: undefined` 케이스는 있으나 `user: null` 케이스가 없음. 데코레이터 구현에 따라 `null`과 `undefined` 처리가 다를 수 있음
  - 제안:
    ```ts
    it('should throw BadRequestException when user is null', () => {
      const ctx = createMockContext({}, null);
      expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
    });
    ```

- **[INFO]** 헤더 값이 빈 문자열인 경우 미검증
  - 위치: 전체 describe 블록
  - 상세: `'x-workspace-id': ''` 일 때 JWT fallback으로 가는지, 예외를 던지는지 정의되지 않음
  - 제안: 빈 문자열 헤더 케이스 추가하여 동작 명확화 필요

---

### 파일 2: `uuid-transform.spec.ts`

### 발견사항

- **[WARNING]** `UpdateWorkflowDto`의 검증 테스트 누락
  - 위치: `should transform empty string folderId to null in UpdateWorkflowDto` (line 43)
  - 상세: transform만 테스트하고 `validate()` 호출을 통한 검증 통과 여부를 테스트하지 않음. `CreateWorkflowDto`는 3개의 validate 케이스가 있으나 `UpdateWorkflowDto`는 0개
  - 제안: `UpdateWorkflowDto`에도 `validate()` 기반 테스트 추가

- **[WARNING]** `CreateNodeDto`, `CreateTriggerDto` 검증 테스트 누락
  - 위치: line 51~74
  - 상세: `containerId`, `toolOwnerId`, `authConfigId`의 transform 테스트만 존재하고 validate 테스트 없음
  - 제안: 각 DTO에 대해 빈 문자열 → null 후 validation pass 케이스 추가

- **[INFO]** `null` 직접 입력 케이스 미검증
  - 위치: 전체
  - 상세: `folderId: null`을 직접 전달하는 경우 동작이 정의되지 않음 (transform 통과 여부)
  - 제안: 비즈니스 정책상 `null` 직접 입력 허용 여부에 따라 케이스 추가

- **[INFO]** `whitespace-only` 문자열 케이스 미검증
  - 위치: 전체
  - 상세: `' '` (공백) 입력 시 null 변환 또는 validation fail 여부 미정의
  - 제안: 정책 결정 후 케이스 추가

---

### 파일 3: `jwt.strategy.spec.ts`

### 발견사항

- **[WARNING]** `getMemberRole` 예외 발생 시 동작 미검증
  - 위치: 전체
  - 상세: `getMemberRole`이 예외를 throw하는 경우의 동작이 테스트되지 않음. 서비스 장애 시 인증 실패 여부 불명확
  - 제안:
    ```ts
    it('should propagate error when getMemberRole throws', async () => {
      usersService.findById.mockResolvedValue(mockUser as never);
      workspacesService.findPersonalWorkspace.mockResolvedValue(mockWorkspace as never);
      workspacesService.getMemberRole.mockRejectedValue(new Error('DB error'));
      await expect(strategy.validate({ sub: 'user-uuid-1', email: 'test@example.com' }))
        .rejects.toThrow();
    });
    ```

- **[INFO]** 반환 payload 구조의 완전성 검증
  - 위치: `should return valid JwtPayload when user and workspace exist`
  - 상세: `toEqual`로 전체 구조를 검증하여 충분함. 양호

- **[INFO]** `emailVerified` 필드 부재(없는 경우) 미검증
  - 위치: 전체
  - 상세: `emailVerified` 필드 자체가 없는 user 객체(구버전 데이터 등)의 처리가 미정의
  - 제안: 정책상 필드 누락 시 false로 간주하는지 테스트 추가 고려

---

### 요약

세 파일 모두 핵심 happy path와 주요 에러 케이스를 커버하고 있어 기본적인 요구사항 충족 수준은 양호합니다. 다만 `uuid-transform.spec.ts`에서 `UpdateWorkflowDto`, `CreateNodeDto`, `CreateTriggerDto`의 validation 테스트가 누락되어 transform 동작 후 실제 유효성 통과 여부를 보장할 수 없고, `workspace.decorator.spec.ts`에서 `null` user 및 빈 문자열 헤더 케이스가 미검증 상태입니다. `jwt.strategy.spec.ts`는 전반적으로 충실하나 의존 서비스 예외 전파 케이스가 빠져 있습니다.

### 위험도

**LOW**
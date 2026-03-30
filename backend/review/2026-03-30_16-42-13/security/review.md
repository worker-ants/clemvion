## 보안 코드 리뷰 결과

### 발견사항

---

#### 파일 1: `workspace.decorator.spec.ts`

- **[INFO]** 헤더 기반 Workspace ID 우선순위 테스트만 존재
  - 위치: `it('should return workspace ID from X-Workspace-Id header', ...)`
  - 상세: 실제 데코레이터가 헤더 값을 그대로 신뢰하는지 검증하는 테스트만 있고, **헤더 값 위변조(spoofing) 시나리오**에 대한 테스트가 없음. 예: JWT의 workspaceId와 헤더의 x-workspace-id가 불일치할 때 어떻게 동작하는지 검증하지 않음.
  - 제안: 헤더의 workspace ID가 인증된 사용자의 접근 가능한 워크스페이스인지 검증하는 로직이 실제 데코레이터 또는 Guard에 있어야 하며, 이를 테스트해야 함.

- **[INFO]** UUID 형식 검증 테스트 부재
  - 위치: 전체 테스트
  - 상세: 헤더로부터 받은 workspace ID가 유효한 UUID인지 검증하는 테스트 없음. `../../` 경로 탐색, SQL 페이로드 등 악의적인 문자열 주입에 대한 방어 테스트 미존재.
  - 제안: `x-workspace-id: '; DROP TABLE workspaces;--'` 같은 케이스에 대해 적절히 거부되는지 테스트 추가 권장.

---

#### 파일 2: `uuid-transform.spec.ts`

- **[INFO]** 악의적인 UUID 패턴에 대한 경계 테스트 부재
  - 위치: 전체 테스트
  - 상세: `not-a-uuid` 케이스는 테스트하지만, null byte(`\x00`), 매우 긴 문자열, 특수문자 포함 문자열 등 경계값 테스트가 없음.
  - 제안: `class-validator`의 `@IsUUID()` 데코레이터가 이미 처리하므로 Critical 이슈는 아니나, 경계값 테스트로 보완 가능.

- **[INFO]** 테스트에 하드코딩된 UUID 사용 (무해)
  - 위치: `'550e8400-e29b-41d4-a716-446655440000'`
  - 상세: 테스트 목적이므로 문제없음. 실제 프로덕션 데이터 UUID가 아님을 확인.

---

#### 파일 3: `jwt.strategy.spec.ts`

- **[WARNING]** `getMemberRole`이 null 반환 시 `owner`로 기본값 처리
  - 위치: `it('should default role to owner when getMemberRole returns null', ...)`
  - 상세: 워크스페이스 멤버 역할을 조회할 수 없을 때 최고 권한(`owner`)으로 폴백되는 동작을 테스트가 **정상 동작으로 검증**하고 있음. 이는 보안적으로 **최소 권한 원칙(Principle of Least Privilege) 위반**. DB 오류, 레이스 컨디션 등으로 role이 null이 되면 최고 권한을 얻을 수 있음.
  - 제안: null 반환 시 `UnauthorizedException` 또는 최소 권한(`viewer`)으로 폴백해야 하며, 테스트도 이에 맞게 수정 필요.

  ```typescript
  // 현재 (위험)
  expect(result.role).toBe('owner');
  
  // 권장: 예외를 던지거나
  await expect(strategy.validate(...)).rejects.toThrow(UnauthorizedException);
  // 또는 최소 권한으로 폴백
  expect(result.role).toBe('viewer');
  ```

- **[INFO]** JWT 페이로드 조작 시나리오 테스트 부재
  - 위치: 전체 테스트
  - 상세: `sub`와 실제 DB의 사용자 email 불일치 케이스, 만료된 토큰 처리 등의 테스트 없음. 단, `PassportStrategy`가 서명 검증을 처리하므로 Critical은 아님.

- **[INFO]** 테스트 시크릿 `'test-secret'` 하드코딩
  - 위치: `ConfigService` mock, `get: jest.fn().mockReturnValue('test-secret')`
  - 상세: 테스트 전용 값이므로 무해하나, 실제 전략 생성 시 `secretOrKey`로 전달됨을 확인. 프로덕션 시크릿이 절대 아님.

---

### 요약

테스트 코드 자체의 보안 취약점은 없으나, **테스트가 검증하는 실제 로직에서 보안 결함이 발견됨**: `JwtStrategy`에서 `getMemberRole`이 null을 반환할 때 `owner`로 기본값 처리하는 것은 최소 권한 원칙을 위반하며, 권한 상승(Privilege Escalation) 위험이 있음. 또한 `WorkspaceId` 데코레이터가 JWT 검증 없이 헤더의 workspace ID를 신뢰하는 구조는, 해당 ID에 대한 접근 권한 검증이 다른 레이어(Guard 등)에서 반드시 수행되어야 함을 의미하나 테스트에서 이를 보장하지 않음.

### 위험도

**MEDIUM**

> 주요 근거: `getMemberRole` null 시 `owner` 폴백은 단독으로도 권한 상승으로 이어질 수 있는 실질적 위험. 헤더 기반 workspace ID 신뢰 구조는 상위 레이어의 검증에 의존하므로 아키텍처 전반 확인 필요.
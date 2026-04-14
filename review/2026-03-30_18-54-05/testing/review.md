### 발견사항

**[WARNING] SQL 마이그레이션에 대한 테스트 없음**
- 위치: `V003__add_trigger_category.sql`
- 상세: `node_category` enum에 `trigger` 값 추가는 DB 스키마 변경이며, 이를 검증하는 통합 테스트가 없음. enum 값 추가 후 해당 값을 사용하는 노드 생성/조회 흐름이 정상 동작하는지 확인 불가.
- 제안: `execution-engine` 또는 워크플로우 관련 테스트에서 `trigger` 카테고리 노드를 포함한 테스트 케이스 추가.

---

**[WARNING] `getMe` - 인증/인가 Guard 테스트 누락**
- 위치: `users.controller.spec.ts`
- 상세: `@Get('me')`에는 JWT Guard(`@UseGuards(JwtAuthGuard)` 등)가 적용되어 있을 것으로 예상되나, 테스트에서 인증 없이 직접 컨트롤러 메서드를 호출하고 있음. 미인증 요청(`401 Unauthorized`) 시나리오가 누락됨.
- 제안:
  ```ts
  it('should return 401 when no auth token', async () => {
    // Guard가 적용된 경우 e2e 테스트 또는 Guard mock 추가
  });
  ```

---

**[WARNING] `UsersService.findById` 예외 발생 시나리오 미테스트**
- 위치: `users.controller.spec.ts`
- 상세: `findById`가 DB 오류 등으로 예외를 던질 경우 컨트롤러가 어떻게 동작하는지 테스트 없음. 현재 구현(`users.controller.ts`)에도 예외 처리 로직이 없어 500 에러가 그대로 노출될 수 있음.
- 제안:
  ```ts
  it('should propagate error when service throws', async () => {
    jest.spyOn(service, 'findById').mockRejectedValue(new Error('DB error'));
    await expect(controller.getMe(payload)).rejects.toThrow('DB error');
  });
  ```

---

**[INFO] `mockUser`의 `as never` 타입 캐스팅 사용**
- 위치: `users.controller.spec.ts`, line 56
- 상세: `mockResolvedValue(mockUser as never)`는 타입 안전성을 우회함. `User` 타입을 명시적으로 임포트하여 사용하는 것이 더 견고함.
- 제안:
  ```ts
  import type { User } from '../entities/user.entity'; // 또는 Prisma User 타입
  jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);
  ```

---

**[INFO] `getMe` 응답 필드 선택 로직에 대한 테스트 충분성**
- 위치: `users.controller.spec.ts`, line 60-70
- 상세: 응답에서 민감 필드(`passwordHash`, `twoFactorSecret` 등)가 제외되는지 검증하는 테스트가 있어 긍정적. 다만 명시적으로 "민감 필드가 포함되지 않아야 한다"는 assertion을 추가하면 의도가 더 명확해짐.
- 제안:
  ```ts
  expect(result.data).not.toHaveProperty('passwordHash');
  expect(result.data).not.toHaveProperty('twoFactorSecret');
  ```

---

### 요약

`UsersController`와 `getMe` 엔드포인트에 대한 기본 테스트(정상 케이스, 유저 미존재)는 갖추어져 있으나, JWT Guard 미적용 시나리오, `findById` 예외 처리, SQL 마이그레이션 검증이 누락되어 있습니다. 특히 인증 Guard 테스트 부재와 서비스 예외 전파 미처리는 프로덕션에서 예측 불가능한 동작으로 이어질 수 있어 보완이 필요합니다.

### 위험도

**MEDIUM**
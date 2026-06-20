# Testing Review — refactor-c3-auth-bcrypt-service

## 발견사항

### [WARNING] `verifyPasswordForUser` — `user === null` 분기 누락
- 위치: `/codebase/backend/src/modules/auth/auth.service.spec.ts` — `verifyPasswordForUser` describe 블록 (line 543–584)
- 상세: `auth.service.ts`의 `verifyPasswordForUser`는 `!user || !user.passwordHash` 조건으로 두 케이스를 하나의 `throw`로 묶는다. 테스트는 `passwordHash: null`(user 존재, hash 없음) 케이스만 커버하고 `findById`가 `null`을 반환하는(user 자체 없음) 케이스를 명시적으로 테스트하지 않는다. 프로덕션 코드에서 두 경로가 동일한 `PASSWORD_REQUIRED` 에러를 반환하므로 기능 버그는 없지만, 미래에 두 분기가 분리될 경우 회귀 탐지 누락이 발생할 수 있다.
- 제안: `usersService.findById.mockResolvedValue(null)` 케이스를 별도 it 블록으로 추가해 user-not-found → `PASSWORD_REQUIRED(401)` 경로도 명시적으로 커버한다.

### [WARNING] `try/catch` 패턴으로 인한 테스트 불확실성
- 위치: `/codebase/backend/src/modules/auth/auth.service.spec.ts` lines 550–559, 567–577
- 상세: `PASSWORD_REQUIRED`와 `PASSWORD_INVALID` 두 에러 케이스 모두 `try/catch + expect.assertions(2)` 패턴을 쓴다. `expect.assertions`를 통해 catch 블록 실행 보장은 하나 이 패턴은 테스트 의도 가독성이 낮고 `.rejects.toThrow()` + `.rejects.toMatchObject()` 체인 패턴에 비해 오류 메시지가 덜 명확하다. 특히 에러가 실제로 던져지지 않아도 `try` 블록이 정상 완료되면 catch는 실행되지 않지만 `expect.assertions(2)` 덕분에 실패는 잡힌다 — 그러나 실패 메시지가 "Expected 2 assertions, received 0"로 나와 디버그 시간이 늘어난다.
- 제안:
  ```typescript
  await expect(
    service.verifyPasswordForUser('user-uuid', 'anything')
  ).rejects.toMatchObject({
    response: { code: 'PASSWORD_REQUIRED' },
    status: 401,
  });
  ```
  패턴으로 교체하면 가독성·디버그 메시지 모두 개선된다. 기능 정확성은 현재도 충분하므로 필수 변경은 아니나, 팀 표준 일관성 차원에서 권장한다.

### [INFO] Controller 테스트에서 `verifyPasswordForUser` mock 반환값 불일치 가능성 없음 — 확인됨
- 위치: `/codebase/backend/src/modules/auth/auth.controller.spec.ts` lines 546, 572
- 상세: controller 테스트가 `authService.verifyPasswordForUser.mockResolvedValue(undefined)`와 `.mockRejectedValue(new UnauthorizedException(...))`를 올바르게 분리해 성공/실패 경로를 독립적으로 검증하고 있다. controller가 더 이상 bcrypt 또는 UsersService를 직접 참조하지 않으므로 mock 범위가 적절히 축소되었다.

### [INFO] `expect(authService.verifyPasswordForUser).toHaveBeenCalledWith` 단언 — 올바르게 추가됨
- 위치: `/codebase/backend/src/modules/auth/auth.controller.spec.ts` lines 555–558
- 상세: 성공 케이스에서 `verifyPasswordForUser`가 올바른 인수(`'user-uuid'`, `'OldP@ssw0rd1'`)로 호출됐는지 단언한다. 위임 경로가 명시적으로 검증된다.

### [INFO] 실패 케이스에서 `totpService.disable` 미호출 단언 유지
- 위치: `/codebase/backend/src/modules/auth/auth.controller.spec.ts` line 582
- 상세: 비밀번호 틀린 경우 `totpService.disable`이 호출되지 않아야 함을 명시적으로 검증한다. 변경 전후 동작 불변을 보장하는 올바른 회귀 가드다.

### [INFO] Service 단위 테스트가 실제 `bcrypt` 해시를 사용 — mock 대체 없음
- 위치: `/codebase/backend/src/modules/auth/auth.service.spec.ts` lines 561–562, 576–577
- 상세: `verifyPasswordForUser` 테스트가 `BCRYPT_ROUNDS` 상수로 실제 bcrypt 해시를 생성한다. 이 상수가 프로덕션과 동일한 값이라면 테스트 속도에 영향이 있지만 실제 동작을 검증한다는 점에서 의도적인 선택이다. 기존 `login` 테스트도 동일 패턴을 사용하므로 일관성은 유지된다. `BCRYPT_ROUNDS`가 테스트 환경에서 낮게 설정되어 있다면(e.g., 4) 허용 가능하다.

### [INFO] E2E 커버리지 — 2FA disable 응답 불변 검증은 plan에서 미완료
- 위치: `plan/in-progress/refactor-c3-auth-bcrypt-service.md` 체크리스트 `TEST WORKFLOW` 항목
- 상세: 2FA disable e2e 응답 불변 검증이 plan 체크리스트에 미완료로 표시되어 있다. 단위 테스트로는 에러 코드·shape 보존을 충분히 검증하나, 실제 DB + bcrypt round-trip이 포함된 e2e 검증이 아직 미수행 상태다. 이 자체는 테스트 코드 결함이 아니라 프로세스 미완료 사항이다.

---

## 요약

이번 변경(C-3)은 레이어 정렬 리팩터링으로 테스트 전략이 전반적으로 적절하다. `AuthService.verifyPasswordForUser` 신규 메서드에 3케이스(hash 부재, 불일치, 일치) 단위 테스트가 추가되었고, controller 테스트는 `UsersService`/`bcrypt` 직접 의존을 제거하고 `verifyPasswordForUser` mock으로 올바르게 대체했다. 주요 주의점은 하나: `verifyPasswordForUser`의 `user === null`(findById null 반환) 분기가 별도 케이스로 명시적 테스트되지 않아 향후 두 분기 분리 시 회귀 탐지 공백이 발생할 수 있다. `try/catch` 기반 에러 단언 패턴은 기능적으로 정확하나 가독성 개선 여지가 있다. 나머지는 기존 회귀 가드와 mock 격리가 잘 유지된 수준이다.

## 위험도

LOW

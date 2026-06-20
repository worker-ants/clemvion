# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: auth.controller.spec.ts

- **[INFO]** `try/catch` 패턴 대신 Jest 네이티브 방식 사용 권장
  - 위치: `auth.service.spec.ts` 내 `verifyPasswordForUser` describe 블록 (lines 1271–1302 of prompt)
  - 상세: `expect.assertions(2)` + `try { ... } catch(e) { ... }` 조합은 `catch` 블록에 도달하지 않아도 assertions 수만 맞으면 통과하는 함정이 있다. 실제로는 `await expect(...).rejects.toMatchObject(...)` 또는 `await expect(...).rejects.toHaveProperty('response.code', ...)` 체인이 의도를 더 명확하게 드러내고, 파일 내 다른 테스트(`refresh`, `login` 등)에서 이미 `rejects.toThrow()` 패턴을 일관되게 사용 중이라 일관성도 깨진다.
  - 제안: `rejects.toMatchObject` 또는 `rejects.toThrow`로 교체하고 `expect.assertions` 제거. 동일 파일 `refresh` 블록의 스타일을 참고.

- **[INFO]** 컨트롤러 테스트에서 서비스 mock 에 실제 동작(verifyPasswordForUser 성공 시 undefined resolve)이 암묵적
  - 위치: `auth.controller.spec.ts` 줄 547, `authService.verifyPasswordForUser.mockResolvedValue(undefined)`
  - 상세: 현재 코드는 명확하고 읽기 좋다. 주석이 없어도 의도가 충분히 드러난다. 개선 여지는 없음.

### 파일 2: auth.controller.ts

- **[INFO]** `disable2fa` 내 인라인 주석 참조 포맷 일관성
  - 위치: `auth.controller.ts` 줄 987, `// [refactor 02 C-3] ...`
  - 상세: 파일 내 다른 주석은 `// [Spec Auth §4.1 / Rationale 4.1.B]` 형식을 쓰는 반면, 신규 주석은 `[refactor 02 C-3]` 태그를 사용한다. 리팩터 추적용 태그와 spec 참조 태그가 섞이는 것은 미묘한 일관성 위반이나, 리팩터 히스토리를 추적하는 실용적 목적이 있으므로 INFO 수준.
  - 제안: `// [refactor 02 C-3] 비밀번호 재확인은 AuthService 로 이관 ...` 형식은 유지하되, 가능하면 spec 참조(`data-flow/2-auth.md §1.2`)를 함께 포함하는 현재 형식은 이미 충분하다.

- **[INFO]** `disable2fa` 메서드 가독성 향상 — 변경 후 코드가 의도를 명확하게 표현
  - 위치: `auth.controller.ts` `disable2fa` 메서드 전체
  - 상세: 리팩터 후 `disable2fa`는 3개의 명확한 단계(비밀번호 확인 → TOTP 비활성화 → 감사 로그)로만 구성되어 읽기 쉽다. 이전 11줄 인라인 검증 블록 제거로 함수 길이와 책임이 모두 개선되었다. 긍정적 변경.

### 파일 3: auth.service.spec.ts

- **[WARNING]** `verifyPasswordForUser` 테스트에서 `try/catch` + `expect.assertions` 패턴이 취약
  - 위치: `auth.service.spec.ts` `verifyPasswordForUser` describe 블록, 첫 두 `it` 케이스
  - 상세: `expect.assertions(2)` 와 `try/catch` 의 조합은 서비스가 throw 하지 않으면 `catch` 블록이 실행되지 않아 assertions 가 0개가 되지만, Jest 는 `expect.assertions(2)` 때문에 "Expected 2 assertions to be called but received 0" 로 실패한다. 의도는 올바르지만 메시지가 불명확하고, 동일 파일의 다른 케이스(`refresh`, `login`, `rotateSessionAfterPasswordChange`)는 모두 `.rejects.toThrow()` 패턴을 사용한다. 불일관된 패턴은 향후 유지보수자가 어느 스타일을 따라야 할지 혼란을 준다.
  - 제안:
    ```ts
    await expect(
      service.verifyPasswordForUser('user-uuid', 'anything'),
    ).rejects.toMatchObject({
      response: { code: 'PASSWORD_REQUIRED' },
      status: 401,
    });
    ```
    또는 두 단언을 분리:
    ```ts
    const err = await service.verifyPasswordForUser(...).catch((e) => e);
    expect(err.getStatus()).toBe(401);
    expect(err.getResponse()).toMatchObject({ code: 'PASSWORD_REQUIRED' });
    ```

- **[INFO]** `describe` 제목에 `(refactor 02 C-3)` 이 포함됨
  - 위치: `auth.service.spec.ts` 줄 1268, `describe('verifyPasswordForUser (refactor 02 C-3)', ...)`
  - 상세: 내부 리팩터 태그를 테스트 describe 제목에 포함하면, 리팩터 번호가 변경·완료된 후에도 테스트 출력에 잡음이 생긴다. 기능을 기술하는 제목만으로도 충분하다.
  - 제안: `describe('verifyPasswordForUser', ...)` 로 단순화. 이력 맥락은 블록 내 주석으로 충분하다.

### 파일 4: auth.service.ts

- **[INFO]** `verifyPasswordForUser` JSDoc 이 과도하게 상세 — 단순 이관 메서드로서 적절히 간결화 가능
  - 위치: `auth.service.ts` 줄 2485–2492 (JSDoc 블록)
  - 상세: 현재 JSDoc 은 이관 배경, 이전 위치, 헬퍼 참조, 에러 코드 목록을 모두 설명한다. 리팩터 직후 맥락 보존 측면에서 가치가 있으나, 장기적으로 헬퍼 교체나 에러 코드 변경 시 JSDoc 과 구현이 불일치할 위험이 있다. 현재 길이는 허용 범위다.
  - 제안: 이관 맥락 및 `data-flow §1.2` 참조는 유지하되, 에러 코드 목록은 구현에서 직접 확인 가능하므로 JSDoc 에 중복 나열하지 않아도 된다.

- **[INFO]** `!user || !user.passwordHash` 조건이 두 가지 다른 의미를 하나의 에러 코드로 처리
  - 위치: `auth.service.ts` `verifyPasswordForUser` 메서드, `if (!user || !user.passwordHash)` 분기
  - 상세: 사용자 미존재(`!user`)와 OAuth-only 계정(`!user.passwordHash`) 모두 `PASSWORD_REQUIRED` 로 처리한다. 이는 이전 컨트롤러 코드의 동작을 정확히 보존한 것(spec 명시된 동작 불변 목표)으로, 의도된 설계다. 유지보수 관점에서 조건의 두 분기가 무엇을 의미하는지 짧은 주석으로 명시하면 향후 수정 시 도움이 된다.
  - 제안: `// !user: 사용자 미존재, !passwordHash: OAuth-only 계정` 형태의 인라인 주석 추가.

- **[INFO]** `BCRYPT_ROUNDS` 상수가 테스트에서 직접 참조됨 — 일관성 양호
  - 위치: `auth.service.spec.ts`, `import { BCRYPT_ROUNDS }` 사용
  - 상세: 테스트에서 `BCRYPT_ROUNDS`(=12)를 그대로 쓰면 테스트가 느려질 수 있으나, 본 변경에서 추가된 `verifyPasswordForUser` 테스트는 기존 `login` 테스트와 동일한 패턴을 따른다. 일관성 측면에서 적절하다. (기존 `BCRYPT_ROUNDS=4` 처럼 낮춘 값을 테스트 전용 상수로 쓸 수 있으나 이는 기존 패턴의 문제이며 본 변경 범위 밖.)

### 파일 5: plan/in-progress/refactor-c3-auth-bcrypt-service.md

- **[INFO]** plan 문서는 구조가 명확하고 체크리스트가 실제 상태를 반영하고 있음. 발견 사항 없음.

---

## 요약

이번 변경은 `AuthController`의 `disable2fa`에 있던 raw `bcrypt.compare` + `usersService.findById` 인라인 코드를 `AuthService.verifyPasswordForUser`로 이관하는 단순하고 명확한 레이어 정렬 리팩터다. 컨트롤러 의존성이 줄고 `disable2fa` 메서드 가독성이 눈에 띄게 향상되었으며, 새 서비스 메서드의 JSDoc도 이관 배경을 충분히 설명한다. 주요 유지보수성 우려 사항은 `auth.service.spec.ts`의 `verifyPasswordForUser` 테스트에서 `try/catch + expect.assertions` 패턴이 동일 파일의 다른 테스트와 불일치한다는 점이다. 이는 향후 유지보수자에게 혼란을 줄 수 있어 `.rejects` 체인으로 통일을 권장한다. 그 외 발견 사항들은 모두 INFO 수준으로 기능 정확성에는 영향이 없다.

## 위험도

LOW

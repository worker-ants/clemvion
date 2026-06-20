## 발견사항

변경된 5개 파일을 검토한 결과, 모든 변경이 명시된 C-3 작업 범위에 정확히 부합합니다.

**auth.controller.ts**
- `import * as bcrypt` 제거: disable2fa에서만 사용됐으며 제거 대상으로 명시된 의존성. 정확한 범위.
- `import { UsersService }` 제거: disable2fa에서만 사용됐으며 제거 대상으로 명시된 의존성. 정확한 범위.
- 생성자에서 `usersService` 제거: 위와 동일 이유. 정확한 범위.
- `disable2fa` 내 12줄 블록 → 1줄 위임으로 대체: 의도된 핵심 변경. 에러 코드·메시지·HTTP 401 shape 동일 보존.
- 추가된 주석(refactor 02 C-3): 이관 근거 명시. 범위 내 합리적 주석.

**auth.service.ts**
- `verifyPasswordForUser` 메서드 신설 (+30줄): 작업 정의의 변경 항목 1번에 해당하는 정확한 범위.
- `comparePassword` 헬퍼 재사용: 이미 파일 내 존재하는 유틸. 신규 import 없음.
- JSDoc 추가: 이관 배경·에러 코드 명세. 적절하고 과도하지 않음.
- auth.service.ts의 나머지 코드(register, login, refresh 등)는 건드리지 않음.

**auth.controller.spec.ts**
- `import * as bcrypt` 제거: 컨트롤러 테스트에서 더 이상 bcrypt 직접 사용 불필요. 올바른 정리.
- `import { UsersService }` 제거: 동일 이유.
- `usersService` mock 변수·설정 제거: 동일 이유.
- `authService.verifyPasswordForUser` mock 추가: 새 인터페이스 반영.
- 두 테스트 케이스 갱신(성공·실패): `usersService.findById + bcrypt.hash` mock → `authService.verifyPasswordForUser` mock으로 전환. 동작 불변 검증.
- `expect(authService.verifyPasswordForUser).toHaveBeenCalledWith(...)` 단언 추가: 델리게이션 검증. 적절한 추가.

**auth.service.spec.ts**
- `verifyPasswordForUser` 테스트 블록 54줄 추가: 변경 항목 체크리스트 "unit 3케이스" 그대로 구현.
- 기존 테스트(register, login, refresh 등) 무변경.

**plan/in-progress/refactor-c3-auth-bcrypt-service.md**
- 신규 plan 파일 생성: CLAUDE.md 규약 준수. 내용은 작업 범위와 완전히 일치.
- auth.module.ts 변경 없음: `UsersService`는 `AuthModule`이 기존부터 보유하고 있어 모듈 선언 변경 불필요. 범위 내 올바른 판단.

## 요약

5개 파일 모두 C-3 작업(AuthController bcrypt 비밀번호 검증 로직 → AuthService 이관)의 정의된 세 가지 변경 항목을 정확히 이행하고 있습니다. 불필요한 리팩토링, 기능 확장, 무관 파일 수정, 포맷팅 혼입, 의도하지 않은 설정 변경 등 범위 일탈 요소가 발견되지 않습니다. auth.service.ts의 다른 메서드들은 일절 수정되지 않았고, auth.module.ts는 변경이 필요하지 않아 올바르게 제외됐습니다.

## 위험도

NONE

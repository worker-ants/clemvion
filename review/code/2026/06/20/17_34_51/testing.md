# 테스트(Testing) 리뷰 결과

## 발견사항

- **[INFO]** 테스트 존재 여부 — 신규 메서드에 대한 단위 테스트 완비
  - 위치: `/codebase/backend/src/modules/auth/auth.service.spec.ts` lines 542–592
  - 상세: `verifyPasswordForUser`의 4개 분기(user null → PASSWORD_REQUIRED, passwordHash null → PASSWORD_REQUIRED, 비밀번호 불일치 → PASSWORD_INVALID, 비밀번호 일치 → resolve)가 모두 별도 `it` 블록으로 커버된다. 이전 ai-review(17_22_15) W1(null 케이스 누락)·W2(패턴 불일치) 지적이 모두 수정되어 파일 관례인 `.rejects.toMatchObject` 패턴으로 통일되어 있다.
  - 제안: 없음.

- **[INFO]** 커버리지 갭 — 현 변경 범위 내 미커버 분기 없음
  - 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser`
  - 상세: 구현 코드의 모든 분기(user 미존재, passwordHash 없음, 비교 실패, 비교 성공)가 테스트로 커버된다. `comparePassword` 내부(bcrypt 연산)는 실제 `bcrypt.hash`를 사용한 통합 스타일로 검증하여 mock 우회 없이 실제 비교 결과를 확인한다.
  - 제안: 없음.

- **[INFO]** 엣지 케이스 테스트 — passwordHash null(OAuth-only 계정) 분기 명시적 처리
  - 위치: `auth.service.spec.ts` line 555–566
  - 상세: `passwordHash: null`인 OAuth-only 계정 케이스가 별도 it으로 분리되어 있어 `!user || !user.passwordHash` 조건의 두 경로가 독립적으로 테스트된다. 빈 문자열(`''`)이나 undefined 등의 falsy 값은 테스트되지 않으나, 실제 DB 스키마상 nullable 컬럼이므로 null 케이스가 핵심 엣지 케이스다.
  - 제안: 필수 추가 아님. `passwordHash: ''`(빈 문자열) 케이스는 DB 레이어에서 사전 차단 가정 시 현재 커버리지로 충분하다.

- **[INFO]** Mock 적절성 — 컨트롤러 테스트의 mock 교체가 적절
  - 위치: `auth.controller.spec.ts` lines 424, 450–455
  - 상세: 컨트롤러 spec에서 기존 `usersService.findById` + raw bcrypt mock 조합이 `authService.verifyPasswordForUser` 단일 mock으로 교체되었다. 이는 컨트롤러 단위 테스트가 `AuthService`의 내부 구현(bcrypt, DB 조회)에 의존하지 않도록 올바르게 격리한다. 성공 경로는 `mockResolvedValue(undefined)`, 실패 경로는 `mockRejectedValue(new UnauthorizedException(...))` 으로 명확히 구분된다.
  - 제안: 없음.

- **[INFO]** 테스트 격리 — 각 it 블록이 독립적으로 실행 가능
  - 위치: `auth.service.spec.ts` lines 568–591
  - 상세: 비밀번호 불일치/일치 테스트가 `beforeEach`가 아닌 각 `it` 내부에서 `await bcrypt.hash(...)` 를 호출한다. Jest의 직렬 실행 모델에서는 문제없고, 테스트 간 hash 값 공유로 인한 오염이 없다. 다만 bcrypt hash 연산이 테스트마다 실행되어 전체 suite 속도에 미세한 영향을 줄 수 있으나, `BCRYPT_ROUNDS`가 테스트용 낮은 값(spec 파일 import 기준 4 또는 낮은 값으로 추정)으로 설정되어 있으면 허용 범위다.
  - 제안: 없음. `BCRYPT_ROUNDS` 값이 테스트에서 낮은 값(4 이하)으로 고정되는지 확인 권장(이미 `BCRYPT_ROUNDS` 상수를 직접 import해 사용하므로, 해당 상수가 프로덕션 값이면 각 it이 느려질 수 있음). 현재 코드 패턴상 기존 테스트도 동일 패턴을 사용하므로 기존 suite와 일관성은 있다.

- **[INFO]** 테스트 가독성 — describe/it 제목이 명확하고 의도를 잘 표현
  - 위치: `auth.service.spec.ts` lines 542–592
  - 상세: `describe('verifyPasswordForUser')` (이전 `(refactor 02 C-3)` 태그 제거)로 단순화되어 있고, 각 it 제목이 "사용자 미존재 → PASSWORD_REQUIRED (401)", "비밀번호 불일치 → PASSWORD_INVALID (401)" 등 인풋→아웃풋 형식으로 읽기 쉽다. `rejects.toMatchObject`로 status 코드와 response code를 함께 검증하여 401 shape 보존을 명확히 표현한다.
  - 제안: 없음.

- **[INFO]** 회귀 테스트 — 기존 disable2fa 컨트롤러 테스트가 변경 후 유효하게 갱신됨
  - 위치: `auth.controller.spec.ts` lines 423–462
  - 상세: 기존 두 disable2fa 테스트 케이스(성공 경로 audit log 검증, 실패 경로 audit log 미호출 검증)가 모두 새 mock 구조(`authService.verifyPasswordForUser`)로 업데이트되어 있다. 성공 케이스에 `expect(authService.verifyPasswordForUser).toHaveBeenCalledWith('user-uuid', 'OldP@ssw0rd1')` 호출 검증이 추가되어 컨트롤러가 실제로 위임을 수행하는지 확인한다.
  - 제안: 없음.

- **[INFO]** 테스트 용이성 — 의존성 주입으로 테스트하기 쉬운 구조 확인
  - 위치: `auth.service.ts` — `verifyPasswordForUser`, `auth.controller.ts` — `disable2fa`
  - 상세: `verifyPasswordForUser`는 `usersService`(DI로 주입)와 `comparePassword`(util 함수)만 사용하므로 `usersService.findById` mock 하나로 전체 분기 제어가 가능하다. 컨트롤러는 `AuthService`를 DI로 주입받아 mock 교체가 용이하다. 레이어 분리가 테스트 구조를 단순화했다.
  - 제안: 없음.

## 요약

C-3 리팩터(비밀번호 재확인 로직의 Controller → AuthService 이관)에 대한 테스트 커버리지는 전 분기(user null, passwordHash null, 비밀번호 불일치, 일치)를 망라하며, 이전 ai-review(17_22_15)에서 지적된 W1(null 케이스 누락)·W2(패턴 불일치)·INFO#4(describe 태그)가 모두 수정 완료되어 있다. 컨트롤러 테스트는 `verifyPasswordForUser` mock으로 올바르게 격리되어 있고, 서비스 테스트는 실제 bcrypt hash를 활용한 통합 스타일로 에러 코드·401 shape 보존을 검증한다. 테스트 가독성, 격리, 회귀 가드 모두 양호하며 추가 수정이 필요한 항목은 없다.

## 위험도

NONE

---

STATUS=success ISSUES=0

# 부작용(Side Effect) 리뷰 — C-3 auth bcrypt→service

## 발견사항

### [INFO] AuthController 생성자 의존성 제거
- 위치: `codebase/backend/src/modules/auth/auth.controller.ts` — 생성자 (93-103)
- 상세: `UsersService` 와 `bcrypt` 가 컨트롤러 생성자에서 제거되었다. 두 의존성 모두 `disable2fa` 에서만 사용되었음이 변경 설명에서 전수 grep 으로 확인(컨트롤러 내 타 사용처 0)되어 있다. NestJS DI 컨테이너 관점에서 `AuthModule` 이 여전히 `UsersService` 를 제공하는 한 모듈 레벨 등록은 다른 소비자(`AuthService` 등)가 유지하므로 DI 그래프에는 부작용 없다.
- 제안: 확인 완료. 별도 조치 불필요.

### [INFO] verifyPasswordForUser — 새 공개 메서드 도입
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L59-78
- 상세: `AuthService` 에 `verifyPasswordForUser(userId, plainPassword): Promise<void>` 가 공개 메서드로 추가된다. 이 메서드는 DB 조회(`usersService.findById`) 와 CPU 집약적 `comparePassword`(bcrypt) 를 내부에서 수행한다. 현재 호출자는 `disable2fa` 단 하나이며 메서드 자체는 상태를 변경하지 않고 예외만 throw 한다. 공개(public) 노출이므로 이후 다른 컨트롤러/서비스가 임의로 재사용할 수 있는 진입점이 생긴다. 이는 의도된 설계(단일진실 §3 통합 후속 계획 포함)이므로 의도치 않은 부작용은 아니다.
- 제안: 메서드 가시성은 현재 설계 의도와 일치. `webauthn.controller` 및 `sessions.service` 후속 통합 시 동일 메서드를 재사용하도록 plan에 이미 명시되어 있어 별도 조치 불필요.

### [INFO] bcrypt.compare → comparePassword 헬퍼 전환
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L71
- 상세: 옛 컨트롤러는 `bcrypt.compare` 를 직접 호출했고 새 서비스 메서드는 `comparePassword` 유틸 헬퍼를 사용한다. `comparePassword` 는 기존 `login` 경로에서도 동일하게 사용 중이다. 내부 동작이 동일한 `bcrypt.compare` 래퍼라면 행위는 보존된다. 테스트 파일(`auth.service.spec.ts`)에서 `bcrypt.hash` + `BCRYPT_ROUNDS` 로 해시를 생성하고 `verifyPasswordForUser` 로 검증하는 케이스가 4개 추가되어 동작 동일성이 검증된다.
- 제안: 이상 없음.

### [INFO] 테스트 파일에서 usersService mock 경계 변경
- 위치: `codebase/backend/src/modules/auth/auth.controller.spec.ts` L82-116
- 상세: 컨트롤러 테스트에서 `usersService.findById` mock 과 `bcrypt.hash` 호출이 `authService.verifyPasswordForUser` mock 으로 교체된다. 이는 유닛 테스트 경계를 올바르게 수정한 것이다(컨트롤러 테스트는 서비스 내부를 알 필요가 없음). 테스트 격리 수준이 높아지는 방향이므로 의도치 않은 부작용 없음.
- 제안: 이상 없음.

---

## 요약

이번 변경은 `AuthController.disable2fa` 내 bcrypt 비밀번호 검증 블록을 `AuthService.verifyPasswordForUser` 로 이관하는 순수한 레이어 정렬 리팩터다. 전역 변수 도입·파일시스템 부작용·환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백 변경은 전혀 없다. 공개 API 변경은 `AuthController` 생성자에서 `UsersService` 의존이 제거되고 `AuthService` 에 새 공개 메서드가 추가되는 것뿐이며, 두 변경 모두 의도된 것이고 현재 호출자에게 영향을 주지 않는다(`disable2fa` 는 기존 동작 그대로, 타 호출자 없음). 에러 코드·메시지·HTTP 401 shape 이 그대로 보존되어 외부 계약(API contract) 측면의 부작용도 없다.

## 위험도

NONE

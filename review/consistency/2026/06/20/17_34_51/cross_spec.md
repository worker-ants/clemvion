### 발견사항

- **[INFO]** `AuthService.verifyPasswordForUser` 가 spec 에 명시되지 않음
  - target 위치: `codebase/backend/src/modules/auth/auth.service.ts` — 새로 추가된 `verifyPasswordForUser` 메서드
  - 충돌 대상: `spec/data-flow/2-auth.md §1` (Source → Sink 다이어그램 목록), `spec/5-system/1-auth.md §5` (API 엔드포인트)
  - 상세: `data-flow/2-auth.md` 의 코드 진입점 목록에 `auth.service.ts` 의 `register / login / refresh / logout` 이 열거되어 있으나, 이번 변경으로 추가된 `verifyPasswordForUser` 메서드는 해당 열거에 언급되지 않는다. spec 이 이 메서드의 존재를 기술하거나 레이어 정렬 결정을 명문화하지 않은 상태다. auth spec §1.4 는 TOTP 비활성화(`POST /api/auth/2fa/disable`) 흐름에서 "비밀번호 재확인" 을 요건으로 언급하지만, 그 재확인 로직이 어느 레이어(Controller vs Service)에서 수행되어야 하는지를 명시하지 않는다. 이 변경은 data-flow/2-auth.md §1.2 의 `bcrypt.compare` 위치를 Service 로 재정렬하는 내부 리팩터링이므로 외부 API 계약 변경 없음 — spec 이 레이어 배치 원칙만 동기화하면 충분하다.
  - 제안: `spec/data-flow/2-auth.md §1` 의 코드 진입점 목록에 `verifyPasswordForUser` (bcrypt 재확인 유틸) 를 TOTP disable 흐름 설명의 일부로 한 줄 추가하거나, `spec/5-system/1-auth.md §1.4 TOTP` 절에 "비밀번호 재확인은 `AuthService.verifyPasswordForUser` 로 위임한다 (레이어 정렬)" 를 인라인 노트로 추가. target 변경은 불필요.

- **[INFO]** 에러 코드 `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 가 spec 에러 코드 카탈로그에 미등재
  - target 위치: `auth.service.ts` `verifyPasswordForUser` — `PASSWORD_REQUIRED`, `PASSWORD_INVALID` throw
  - 충돌 대상: `spec/conventions/error-codes.md` (에러 코드 명명 규약 / 레지스트리)
  - 상세: 두 코드는 이미 구 `AuthController.disable2fa` 에서 사용 중이었으므로 신규 코드가 아니며 API 계약 변경도 없다. 이번 diff 는 에러 코드의 생산 위치를 Controller → Service 로 옮긴 것뿐이다. `spec/conventions/error-codes.md` 나 `spec/5-system/1-auth.md §5` 에 이 두 코드의 공식 등재가 확인되지 않으나, 기존 코드베이스에 이미 사용 중이었으므로 변경에 의해 새로 발생한 불일치가 아니다. pre-existing gap 의 인지 수준.
  - 제안: spec 이 auth 에러 코드 카탈로그를 보강할 때 `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 를 `spec/5-system/1-auth.md §1.4 TOTP` 의 "비활성화 시 에러 코드" 표로 추가. 이번 변경 자체를 차단할 필요는 없음.

### 요약

이번 변경(`refactor 02 C-3`)은 `AuthController.disable2fa` 에서 raw `bcrypt.compare` 를 직접 수행하던 로직을 `AuthService.verifyPasswordForUser` 로 추출·이관한 순수 레이어 정렬 리팩터링이다. 외부 API 계약(엔드포인트·HTTP 메서드·request/response shape)은 동일하게 보존되며, 에러 코드·401 shape 도 변경 없다. 데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, RBAC 충돌은 발견되지 않는다. 발견된 두 항목은 모두 INFO 수준으로, spec 이 레이어 배치 결정을 동기화하지 않은 점과 기존 에러 코드의 미등재 상태가 pre-existing gap 으로 남아 있다는 내용이다. 어느 쪽도 이번 변경이 spec 과 직접 모순을 일으키지 않으며 차단 근거가 없다.

### 위험도

NONE

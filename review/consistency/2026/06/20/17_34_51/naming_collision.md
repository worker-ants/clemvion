# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done  
Scope: `spec/5-system/1-auth.md` (구현 변경 중심 검토)  
Diff base: origin/main

---

## 발견사항

이번 diff 가 새로 도입하는 식별자는 다음 세 가지다.

1. `verifyPasswordForUser` — `AuthService` 의 신규 public 메서드
2. `PASSWORD_REQUIRED` / `PASSWORD_INVALID` — 401 에러 코드 문자열 (기존 위치에서 이동)
3. `comparePassword` / `BCRYPT_ROUNDS` 의 `auth.service.ts` 내 신규 import (기존 export, 소비처 추가)

---

### [INFO] `verifyPasswordForUser` 는 완전히 신규 이름 — 충돌 없음

- target 신규 식별자: `AuthService.verifyPasswordForUser(userId, plainPassword): Promise<void>`
- 기존 사용처: `spec/`, `codebase/backend/src/` 전체에서 동일 이름의 메서드·함수·변수 미존재 (main 브랜치 전수 grep 확인)
- 상세: 비밀번호 재확인 로직을 `AuthController.disable2fa` 의 인라인 bcrypt 비교에서 `AuthService` 메서드로 이관한 것이며, 유사 패턴(`comparePassword`, `hashPassword`)과 명명 일관성이 있다. `verifyPassword` 가 아닌 `verifyPasswordForUser` 로 userId 스코프를 명시한 점도 의미 충돌을 줄인다.
- 제안: 없음.

---

### [INFO] `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 는 기존 에러 코드 — 의미 보존, 충돌 없음

- target 신규 사용처: `AuthService.verifyPasswordForUser` 내 두 에러 코드
- 기존 사용처:
  - `codebase/backend/src/modules/auth/auth.controller.ts` (main 브랜치 기준 라인 345, 352) — disable2fa 인라인 블록 (이번 diff 로 제거됨)
  - `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` 라인 376, 383 — WebAuthn 복구 코드 재발급 흐름에서 독자적으로 사용 중
  - `codebase/backend/src/modules/auth/sessions.service.ts` 라인 249 — `PASSWORD_INVALID` 단독 사용
- 상세: 세 위치 모두 "현재 로그인 사용자의 비밀번호 재확인 실패" 를 나타내는 같은 의미로 사용된다. 이번 diff 는 controller 인라인에서 service 로 이관하면서 **에러 코드·메시지·HTTP 401 shape 을 그대로 보존**한다고 주석에 명기돼 있다. 의미 충돌이 아니라 의미 일치 재사용이다.
- 제안: `webauthn.controller.ts` 와 `sessions.service.ts` 도 장기적으로는 같은 `verifyPasswordForUser` 를 사용해 에러 코드 생성 책임을 단일화하면 일관성이 높아지나, 이는 이번 변경 범위 밖이며 현 상태에서 식별자 충돌은 없다.

---

### [INFO] `comparePassword` / `BCRYPT_ROUNDS` — 기존 export, 신규 소비처 추가, 충돌 없음

- target 신규 사용처: `auth.service.ts` 에서 `comparePassword` import 추가
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/common/utils/password.util.ts` 에 export 정의 (라인 8, 22). `auth.service.ts` (login 흐름 라인 300), `users.service.ts` (라인 81) 이미 소비 중
- 상세: 동일 유틸의 추가 소비다. 새 식별자 도입이 아니다.
- 제안: 없음.

---

## 요약

이번 diff(refactor C-3)가 도입하는 신규 식별자는 `AuthService.verifyPasswordForUser` 메서드 하나뿐이며, 코드베이스 전체와 spec 에서 동일 이름의 충돌이 없다. 재사용되는 에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)는 기존 사용처와 동일한 의미(비밀번호 재확인 실패)로 일관되게 사용되어 의미 충돌이 없다. 파일 경로·API 엔드포인트·환경변수·이벤트명 차원의 신규 도입은 없다.

## 위험도

NONE

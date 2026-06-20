# 요구사항(Requirement) 리뷰 결과

## 발견사항

### **[INFO]** 기능 완전성: 리팩터 목표 완전히 달성
- 위치: `auth.service.ts` `verifyPasswordForUser`, `auth.controller.ts` `disable2fa`
- 상세: `disable2fa` 내 raw `bcrypt.compare` + `usersService.findById` 직접 호출을 `AuthService.verifyPasswordForUser` 1줄 위임으로 교체. `bcrypt` import, `UsersService` import 및 생성자 의존성 전부 제거. AuthModule에서 `UsersService`는 `UsersModule`(forwardRef) 경유로 유지되어 `AuthService` 자체 사용에 영향 없음.
- 제안: 없음 (완전 구현).

---

### **[INFO]** 에러 코드·메시지·HTTP 401 shape 동일 보존
- 위치: `auth.service.ts` L2499–2511
- 상세: 이전 컨트롤러가 던지던 `UnauthorizedException({ code: 'PASSWORD_REQUIRED', message: '비밀번호 확인이 필요합니다.' })` 및 `UnauthorizedException({ code: 'PASSWORD_INVALID', message: '비밀번호가 일치하지 않습니다.' })` 가 서비스 내 동일하게 재현되어 있다. 컨트롤러 동작 불변 보장.
- 제안: 없음.

---

### **[INFO]** `comparePassword` 헬퍼 사용 일관성
- 위치: `auth.service.ts` L2505
- 상세: 이전 컨트롤러는 raw `bcrypt.compare`를 사용했고, 새 서비스 메서드는 `password.util` 의 `comparePassword` 래퍼를 사용한다. `comparePassword`는 내부적으로 동일한 bcrypt 비교를 수행하므로 동작은 동일하며, 이제 login 경로와 완전히 동일한 코드 경로를 공유한다. 이는 미래에 KDF 교체 시 단일 수정 지점 확보 측면에서 유리하다.
- 제안: 없음.

---

### **[INFO]** 엣지 케이스: `user` 자체가 `null`인 경우
- 위치: `auth.service.ts` L2499: `if (!user || !user.passwordHash)`
- 상세: 존재하지 않는 userId가 전달되면(`usersService.findById` 가 `null` 반환) `PASSWORD_REQUIRED`(401)를 던진다. 이는 이전 컨트롤러의 `!userEntity || !userEntity.passwordHash` 분기와 동일 동작. 테스트(`auth.service.spec.ts` L2870–2882)에서 `passwordHash: null` 케이스는 커버하나 `user` 자체 `null` 케이스(userId 미존재)는 별도 테스트가 없다. 그러나 로직 경로는 동일 조건(`!user || !user.passwordHash`)이므로 묵시적으로 커버된다.
- 제안: 엄밀한 커버리지를 위해 `findById.mockResolvedValue(null)` 케이스 테스트를 추가하는 것이 이상적이나 기능상 결함은 아님.

---

### **[INFO]** [SPEC-DRIFT] `data-flow/2-auth.md` §1.2 시퀀스 다이어그램에 `verifyPasswordForUser` 미반영
- 위치: `/Volumes/project/private/clemvion/spec/data-flow/2-auth.md` §1.2 (L57–102)
- 상세: `data-flow/2-auth.md` §1.2 시퀀스 다이어그램은 Login 흐름을 보여주며 `bcrypt.compare`가 `Svc->>Svc`로 표기되어 있다(L73). TOTP disable 흐름(비밀번호 재확인)에 대한 별도 시퀀스가 spec에 없다. 또한 `plan/in-progress/refactor-c3-auth-bcrypt-service.md`에서 "data-flow/2-auth.md §1.2 가 bcrypt 비교를 AuthService에 배치"를 근거로 들고 있으나, 실제 §1.2는 로그인 시퀀스이며 `verifyPasswordForUser`라는 새 메서드나 TOTP disable 비밀번호 재확인 흐름이 spec 본문에 명시되어 있지 않다. 이는 spec이 낡은 케이스(SPEC-DRIFT)다 — 코드의 구현이 합리적이고 레이어 정렬이 올바르므로 코드를 되돌리는 것이 오답이며, spec에 TOTP disable 흐름 시퀀스(또는 `verifyPasswordForUser` 메서드 서술)가 추가되어야 한다.
- 제안: 코드 유지. `spec/data-flow/2-auth.md`에 TOTP 2FA 비활성화 시퀀스(또는 "비밀번호 재확인" 흐름) 항목을 신설하여 `Ctl->>Svc: verifyPasswordForUser(userId, password)` 단계를 명시. `project-planner` 위임 권장.

---

### **[INFO]** 테스트 커버리지: 컨트롤러 테스트 의존성 제거 정확
- 위치: `auth.controller.spec.ts` diff
- 상세: `bcrypt` import, `usersService` mock, 생성자 주입이 모두 정확히 제거되었고, `authService.verifyPasswordForUser` mock으로 대체되었다. 비밀번호 일치 케이스는 `mockResolvedValue(undefined)`, 불일치 케이스는 `mockRejectedValue(new UnauthorizedException({ code: 'PASSWORD_INVALID', ... }))` 로 정확히 테스트한다. 서비스 테스트(`auth.service.spec.ts`)는 3케이스(hash 없음 → PASSWORD_REQUIRED, 불일치 → PASSWORD_INVALID, 일치 → resolve) 전부 커버.
- 제안: 없음.

---

### **[INFO]** TODO/FIXME 없음
- 상세: 변경된 모든 파일에 TODO, FIXME, HACK, XXX 주석 없음.

---

### **[INFO]** `spec/5-system/1-auth.md §1.4` TOTP 비활성 비밀번호 재확인 규칙 준수
- 위치: `spec/5-system/1-auth.md` L95: "비활성화 시 비밀번호 재확인 + 코드 입력" / L434: "TOTP 비활성 (인증 + 비밀번호 재확인)"
- 상세: spec §1.4는 `POST /api/auth/2fa/disable`이 비밀번호 재확인을 요구함을 명시한다. 구현은 이를 `verifyPasswordForUser` 호출로 충족한다. spec의 "비밀번호 재확인"이 AuthService 또는 AuthController 중 어느 레이어에서 수행되어야 한다고 지정하지 않으므로 이전 자체는 spec 위반이 아니다.

---

## 요약

이번 변경(C-3)은 `AuthController.disable2fa`의 raw bcrypt 비밀번호 검증 로직을 `AuthService.verifyPasswordForUser`로 이관하는 behavior-preserving 레이어 정렬 리팩터다. 기능 완전성, 에러 코드·메시지 보존, 엣지 케이스 처리, 테스트 커버리지 모두 의도한 동작을 완전히 충족한다. spec 요구사항(`1-auth.md §1.4` TOTP 비활성 비밀번호 재확인)에 부합하며, 코드 구현이 spec을 위반하는 지점은 없다. 단, `data-flow/2-auth.md`에 TOTP disable 비밀번호 재확인 흐름 시퀀스가 명시되어 있지 않아 spec이 낡은 상태(SPEC-DRIFT)이며, 이는 코드 버그가 아니라 spec 갱신 누락이다.

## 위험도

NONE

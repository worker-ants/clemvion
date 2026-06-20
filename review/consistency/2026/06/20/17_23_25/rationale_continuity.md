# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (scope: `spec/5-system/1-auth.md`, diff-base: `origin/main`)
검토 대상: `codebase/backend/src/modules/auth/` 변경 (auth.controller.ts, auth.service.ts, 및 대응 spec 파일)

---

## 발견사항

이번 변경(refactor 02 C-3)은 `AuthController.disable2fa` 내 raw `bcrypt` 직접 검증을 `AuthService.verifyPasswordForUser` 로 이관한 레이어 정렬 리팩터다. Rationale 연속성 관점에서 기각된 대안 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회에 해당하는 항목은 발견되지 않았다.

세부 검토 내역:

1. **기각된 대안 재도입 여부**: `plan/in-progress/refactor/02-architecture.md` C-3 항은 옵션 A(AuthService 이관)와 옵션 B(controller 잔존) 두 가지를 비교하고 A 를 권장안으로 확정했다. 본 구현은 정확히 옵션 A 를 채택했으며, 기각된 옵션 B(controller 잔존)는 재도입되지 않았다.

2. **합의된 원칙 준수 여부**: `spec/data-flow/2-auth.md §1.2` 시퀀스 다이어그램은 `bcrypt.compare` 를 일관되게 `AuthService` (Svc) 레이어에 배치한다. 본 변경은 이 원칙과 정확히 일치한다. 에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`), 메시지, 401 shape 도 controller 동작과 동일하게 보존됐다 — spec `1-auth.md §1.4` 의 "비활성화 시 비밀번호 재확인" 행위 명세도 변경 없이 충족한다.

3. **결정의 무근거 번복 여부**: 어떤 이전 결정도 번복되지 않았다. `disable2fa` 의 비밀번호 재확인 행위 자체는 spec 에 그대로 유지되며, 계층 배치만 data-flow 모델과 정합하도록 이동됐다. 계층 정렬이 "spec 갱신 불요" 로 확정된 내용(`plan/in-progress/refactor/02-architecture.md` C-3 "spec 갱신: 불요")과도 정합한다.

4. **암묵적 가정(invariant) 충돌 여부**: `comparePassword` 헬퍼(login 흐름과 동일 경로)를 재사용하므로 bcrypt cost factor ≥ 12 등 `spec/5-system/1-auth.md §1.1` 의 비밀번호 저장 invariant 가 그대로 준수된다. `UsersService.findById` 경유로 사용자 조회 후 `passwordHash` nullable 처리도 spec 의 OAuth-only null 케이스를 정확히 반영한다.

---

## 요약

이번 변경은 `plan/in-progress/refactor/02-architecture.md` C-3 에서 명시적으로 권장·계획된 레이어 정렬이다. `spec/data-flow/2-auth.md §1.2` 의 bcrypt 비교를 Service 레이어에 배치하는 합의 원칙과 완전히 부합하며, 기각된 대안(controller 잔존)을 재도입하거나 기존 invariant 를 우회하는 요소는 없다. spec 갱신도 C-3 계획대로 불요하며, Rationale 연속성 위반이 없는 안전한 리팩터로 판단한다.

---

## 위험도

NONE

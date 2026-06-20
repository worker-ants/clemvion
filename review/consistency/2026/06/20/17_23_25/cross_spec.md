# Cross-Spec 일관성 검토 결과

**대상**: `spec/5-system/1-auth.md` (구현 완료 후 검토, diff-base=origin/main)
**검토 범위**: 구현 변경사항 — `auth.controller.ts`, `auth.service.ts`, 각 `.spec.ts` 파일

---

## 발견사항

### [INFO] `verifyPasswordForUser` 메서드가 spec에 명시되지 않음
- **target 위치**: `codebase/backend/src/modules/auth/auth.service.ts` 신규 메서드 `verifyPasswordForUser`
- **충돌 대상**: `spec/5-system/1-auth.md §1.4` (TOTP 2FA 비활성화 흐름), `spec/data-flow/2-auth.md §1.2`
- **상세**: 구현 주석은 `data-flow/2-auth.md §1.2` 를 근거로 bcrypt 비교를 `AuthService` 로 이관한다고 명시한다. 그러나 `spec/data-flow/2-auth.md §1.2` 는 로그인 흐름의 `bcrypt.compare(password, password_hash)` 배치를 기술할 뿐, "비밀번호 재확인(2FA 비활성화 등 민감 작업)" 을 `AuthService.verifyPasswordForUser` 로 일원화한다는 명시적 규칙은 없다. 해당 메서드의 공개 계약(시그니처, 에러 코드 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`, 반환 타입 `Promise<void>`)이 spec 어디에도 기술되지 않아 향후 동일 패턴을 재사용하거나 spec을 참조해야 할 때 단일 진실 위치가 불명확하다.
- **제안**: `spec/5-system/1-auth.md §1.4` 또는 `spec/data-flow/2-auth.md §1.2` 에 "비밀번호 재확인이 필요한 민감 작업(TOTP 비활성화 등)은 `AuthService.verifyPasswordForUser`를 통해 처리하며 컨트롤러가 직접 bcrypt 비교를 수행하지 않는다" 는 한 줄 정책을 추가하면 계층 책임 규칙이 spec에 고정된다. 단, 이번 구현이 레이어 정렬 개선임을 고려할 때 INFO 수준이며 차단 사항은 아니다.

---

### [INFO] 에러 코드 `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 가 spec 에 등재되지 않음
- **target 위치**: `auth.service.ts` 신규 메서드 내부 에러 응답 (`code: 'PASSWORD_REQUIRED'`, `code: 'PASSWORD_INVALID'`)
- **충돌 대상**: `spec/conventions/error-codes.md` (에러 코드 레지스트리 / 명명 규약)
- **상세**: 구현이 보존하는 두 에러 코드 `PASSWORD_REQUIRED`, `PASSWORD_INVALID` 는 `UPPER_SNAKE_CASE` 규약을 준수하고 있으나, 이 코드들이 `spec/conventions/error-codes.md` 에 등재되어 있는지 이번 diff에서 확인되지 않는다. 기존 컨트롤러가 이미 내보내던 코드이고 구현 주석도 "에러 코드·메시지·401 shape 동일 보존" 을 명시하므로 신규 도입이 아닌 기존 코드의 이관이다. 실질 충돌 위험은 낮다.
- **제안**: `spec/conventions/error-codes.md` 레지스트리에 `PASSWORD_REQUIRED`, `PASSWORD_INVALID` 가 미등재 상태라면 이번 기회에 auth 도메인 에러 코드로 추가 등록 권장.

---

## 요약

이번 변경은 `AuthController.disable2fa` 가 직접 수행하던 `bcrypt.compare` 로직을 `AuthService.verifyPasswordForUser` 로 이관한 순수 레이어 정렬 리팩토링이다. 데이터 모델(`User.password_hash` 등), API 계약(엔드포인트·HTTP method·request/response shape), 상태 전이(`user.two_factor_enabled`), RBAC 모델 어느 쪽에도 직접 모순이 없다. `spec/data-flow/2-auth.md §1.2` 가 bcrypt 비교를 서비스 계층에 두어야 한다는 설계 방향과도 부합한다. 발견된 항목 2건 모두 spec 문서화 누락(INFO 수준)이며, 기존 spec 의 다른 영역과 충돌하는 CRITICAL 또는 WARNING 사항은 없다.

---

## 위험도

NONE

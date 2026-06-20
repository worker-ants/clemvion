## 발견사항

발견된 정합성 문제가 없습니다. 아래에 검토 근거를 기술합니다.

### 검토 결과: 이상 없음

**검토 범위**
- Target: `spec/5-system/1-auth.md` (변경 없음, diff 없음)
- 구현 변경: `auth.controller.ts`, `auth.service.ts`, 테스트 파일 3개
- 관련 plan: `plan/in-progress/refactor/02-architecture.md` § C-3

---

#### 점검 1 — 미해결 결정과의 충돌

`refactor/02-architecture.md §C-3` 의 처방은 다음과 같이 완전히 명시되어 있었습니다.

> 1. `AuthService.verifyPasswordForUser(userId, plainPassword)` 신설 — `passwordHash` 부재/불일치 시 현 controller 와 동일한 에러 코드·메시지·401 을 서비스에서 throw.
> 2. `disable2fa` 의 bcrypt 블록 제거, controller 의 `import * as bcrypt`·`UsersService` 직접 의존 제거.
> 3. 다른 비밀번호 재확인 경로가 controller 에 있으면 같은 메서드로 통일.

이 항목은 **TBD 결정이 없는 확정된 처방**이었으며, 구현이 처방을 정확히 따랐습니다. 미해결 결정을 일방적으로 우회한 사례 없음.

#### 점검 2 — 선행 plan 미해소

- `spec-sync-auth-gaps.md`의 미구현 항목(LDAP·SAML)은 본 변경과 무관한 영역이며 선행 조건이 아닙니다.
- `auth-config-webhook-followups.md §1`(AuthConfig CRUD audit)도 본 변경 범위 밖이며 충돌 없음.
- `refactor/02-architecture.md §C-3`의 권장 옵션 A는 **spec 갱신 불요**로 명시되어 있었고, 실제로 `spec/5-system/1-auth.md`에 변경이 없습니다.

#### 점검 3 — 후속 항목 누락

- `refactor/02-architecture.md §m-1`은 C-3과 "같은 레이어 침범 패턴"으로 병행 처리를 권장(`IntegrationsController.previewTest`의 registry 검증을 service로 이전)하고 있으나, 이는 별도 항목으로 본 구현이 무효화하거나 새로 만들어야 하는 의무가 아닙니다. §m-1은 여전히 미착수 상태로 남아 있고, 이는 정합한 상태입니다.
- `data-flow/2-auth.md §1.2`가 bcrypt.compare를 Service에 배치하는 시퀀스 모델을 가지고 있고, 구현이 이를 따랐으므로 spec과의 데이터흐름 정합이 개선되었습니다.
- 본 변경이 다른 plan의 후속 항목을 무효화하거나 새로 만들어야 하는 사항 없음.

---

## 요약

`refactor/02-architecture.md §C-3`은 `AuthController.disable2fa`의 bcrypt 검증을 `AuthService.verifyPasswordForUser`로 이관하도록 TBD 없는 확정 처방을 내렸고, 구현은 에러 코드·메시지·401 shape를 동일하게 보존하면서 처방을 정확히 이행했습니다. 선행 plan 미해소, 미해결 결정 우회, 후속 항목 누락 어느 것도 발견되지 않았습니다. Plan 정합성 관점에서 이상 없는 변경입니다.

## 위험도

NONE

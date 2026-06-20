# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: sessions.service.ts

- **[INFO]** `verifyReauth` JSDoc 주석이 `bcrypt 검증`이라고 명시하고 있으나, 실제 구현은 `comparePassword` 헬퍼로 변경됨
  - 위치: `/codebase/backend/src/modules/auth/sessions.service.ts` L272 (`1) passwordHash 보유 + password 입력 → bcrypt 검증`)
  - 상세: JSDoc 의 우선순위 설명 1번 항목이 `bcrypt 검증`이라는 구현 세부 사항을 직접 언급한다. 변경 후 실제 구현은 `comparePassword` 헬퍼를 경유하는데, 헬퍼 추상화의 이점(알고리즘 교체 시 변경 범위 한정)을 JSDoc 이 파괴하고 있다. 향후 bcrypt → argon2 등으로 교체할 때 JSDoc 도 함께 갱신해야 하는 불필요한 결합이 생긴다.
  - 제안: `→ bcrypt 검증` 부분을 `→ 비밀번호 해시 검증` 또는 `→ comparePassword 검증` 으로 중립화.

- **[INFO]** `verifyReauth` 내부에서 TOTP 검증 시 `this.usersService.findById(user.id)` 를 한 번 더 호출함
  - 위치: L309–311
  - 상세: `revokeFamily`, `revokeOtherFamilies`, `revokeAllFamilies` 세 caller 모두 `verifyReauth` 호출 전 이미 `this.usersService.findById(userId)` 를 수행한 `user` 객체를 가지고 있다. `verifyReauth` 는 그 user 의 partial shape(`{ id, passwordHash, twoFactorEnabled }`)을 파라미터로 받지만, TOTP 경로에서 `userFull`(전체 사용자)이 필요하다는 이유로 다시 DB 를 조회한다. 이는 같은 사용자에 대해 최대 2회 DB 호출이 발생하는 패턴으로, caller 가 이미 full user 를 갖고 있는 경우 낭비다. 단, 현재 `verifyReauth` 시그니처가 partial type 을 받도록 설계된 것은 의도된 결합도 최소화이므로 INFO 수준에서 인지하는 것이 적절하다.
  - 제안: 이 이중 조회가 불편하다면 `verifyReauth` 가 full User 타입을 받도록 시그니처를 확장하거나, caller 에서 full user 를 내려보내는 방식을 검토. 현재 범위(behavior-preserving) 내에서는 필수 변경 아님.

- **[INFO]** `resolveCurrentFamilyId` 에 `if (!refreshToken) return null` 가드가 있으나, 파라미터 타입이 `string` (nullable 아님)
  - 위치: L329–332
  - 상세: 파라미터 타입 `string` 이지만 런타임 방어 가드(`if (!refreshToken)`)가 남아 있다. 타입으로 보장되는 조건에 방어 코드를 중복 작성하는 패턴은 유지보수 시 혼선(타입 바꿔도 가드가 남거나, 가드를 제거하면 타입 실수에 노출)을 줄 수 있다. 이 변경에서 새로 추가된 코드는 아니므로 INFO.
  - 제안: 타입을 `string | null` 로 바꾸거나, 가드를 제거하고 모든 caller 에서 null 체크 후 호출하도록 정리.

---

### 파일 2: webauthn.controller.spec.ts

- **[INFO]** 테스트 `it` 블록 설명이 한국어·영어 혼용
  - 위치: 파일 전체 (기존 영문 테스트 L530, L562, L586, L607, L631, L644 vs 신규 한국어 L659, L674)
  - 상세: 기존 테스트는 영문, 신규 추가된 `webauthnRegenerateRecovery` 블록은 한국어로 작성됐다. 동일 파일 내 일관성 없는 언어 혼용은 향후 기여자에게 기준을 불분명하게 한다. 프로젝트 전반의 테스트 언어 정책을 확인하고 통일하는 것이 바람직하다.
  - 제안: 파일 내 기존 패턴(영문)을 따르거나, 프로젝트 테스트 작성 언어 컨벤션을 명시하고 일관 적용. 어느 방향이든 혼용 자체가 문제.

- **[INFO]** `as never` 타입 캐스팅이 여러 위치에 반복 사용됨
  - 위치: L435, L450, L537–540, L569–573, L591–597, L644–651, L663–665, L679–681
  - 상세: `as never` 는 DTO 완전 구성 없이 partial 객체를 넘기는 테스트 편의 패턴이다. 기존 코드에서도 동일하게 사용하고 있으므로 일관성은 있다. 다만 이 패턴이 파일 전체에 걸쳐 반복되면 공통 헬퍼(예: 각 DTO 별 stub factory)로 추출하면 타입 안전성과 테스트 가독성이 높아진다. 이 변경에서 새로 패턴을 도입한 것이 아니므로 INFO.
  - 제안: (현재 범위 외) DTO mock factory 함수 도입 검토.

---

### 파일 3: webauthn.controller.ts

- **[INFO]** `UnauthorizedException` import 가 파일에 남아 있으나, 이번 변경으로 직접 `throw` 하는 곳이 `webauthnRecovery` 한 곳만 남음
  - 위치: L7 (`UnauthorizedException`)
  - 상세: 기존에 `webauthnRegenerateRecovery` 가 `UnauthorizedException` 을 직접 throw 했으나 이번 변경으로 `authService.verifyPasswordForUser` 에 위임됐다. `webauthnRecovery` 에 `RECOVERY_CODE_INVALID` throw 가 남아있어 import 자체는 여전히 유효하다. 문제없음, 단 이 import 가 필요한 유일 위치를 파악하기 어려우면 주석으로 표시하거나 IDE linting 에 의존하면 된다. INFO 수준.

- **[INFO]** `webauthnRegenerateRecovery` 메서드 내 인라인 주석이 리팩터링 배경 설명에 집중되어 있으나 코드 의도보다 변경 이력처럼 읽힘
  - 위치: L1123–1124
  - 상세: `// [refactor 02 C-3 §3] ...` 형태의 주석은 리팩터링 근거를 담고 있어 일회성 히스토리 정보에 가깝다. 장기적으로는 `verifyPasswordForUser` 자체의 JSDoc(auth.service.ts 에 이미 상세히 기술됨)으로 충분하며, 인라인 주석은 "왜 여기서 직접 bcrypt 하지 않는지" 한 줄 요약으로 압축하면 가독성이 높아진다. 이 패턴은 프로젝트 전반에 걸쳐 동일하게 사용되고 있어 일관성은 있으므로 INFO.
  - 제안: 인라인 주석을 `// 비밀번호 재확인은 AuthService 에 위임(레이어 정렬, password.util.ts comparePassword 단일 진실)` 수준으로 압축.

---

### 파일 4: plan/in-progress/refactor-auth-reverify-unify.md

발견사항 없음. 플랜 문서로서 정보 구조·가독성 모두 양호.

---

## 요약

이번 변경은 `sessions.service.ts` 의 raw `bcrypt.compare` 를 `comparePassword` 헬퍼로 단순 교체하고, `webauthn.controller.ts` 의 13줄 inline 검증 블록을 `authService.verifyPasswordForUser` 단일 호출로 대체하는 behavior-preserving 리팩터링이다. 유지보수성 관점에서 코드 복잡도·중첩 깊이·함수 길이는 모두 개선 방향이며, 중복 제거와 레이어 정렬 목적이 명확히 달성됐다. 주요 유의점은 `verifyReauth` JSDoc 의 `bcrypt 검증` 문구가 헬퍼 추상화 이점을 역행한다는 점과, 테스트 파일 내 한국어·영어 혼용으로 인한 일관성 저하다. 두 항목 모두 INFO 등급이며 기능·구조적 위험은 없다.

## 위험도

NONE

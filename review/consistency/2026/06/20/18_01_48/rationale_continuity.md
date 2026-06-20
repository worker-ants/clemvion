# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/1-auth.md`
검토 모드: --impl-done (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-20

---

## 발견사항

### [INFO] `verifyPasswordForUser` 신설 — spec/data-flow 에 대응 Rationale 미등재

- **target 위치**: `codebase/backend/src/modules/auth/auth.service.ts` L52–78 (신설 메서드 `verifyPasswordForUser`), `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` L367–188 (raw bcrypt → `authService.verifyPasswordForUser` 위임), `codebase/backend/src/modules/auth/sessions.service.ts` (raw bcrypt → `comparePassword` 유틸로 교체)
- **과거 결정 출처**: `spec/5-system/1-auth.md ## Rationale` 에는 "비밀번호 재확인의 레이어 귀속 원칙(AuthService vs Controller)"을 명문화한 항목이 없다. `spec/data-flow/2-auth.md §1.2 (로그인 흐름)`의 bcrypt.compare 위치 기술은 로그인 경로에 한정되어 있으며, 비밀번호 재확인(재인증) 경로에 대한 레이어 설계 결정은 Rationale에 별도로 등재되지 않았다.
- **상세**: 구현은 올바른 방향으로 진행됐다. `WebAuthnController`에 있던 raw `bcrypt.compare`를 `AuthService.verifyPasswordForUser`로 위임하고, `sessions.service.ts`의 raw `bcrypt.compare`를 공유 `comparePassword` 유틸로 일원화한 것은 레이어 정렬 관점에서 합리적이다. 코드 주석(`// [refactor 02 C-3 §3] 비밀번호 재확인은 AuthService 로 통일(레이어 정렬, data-flow/2-auth.md §1.2)`)이 근거를 제시하고 있으나, `spec/5-system/1-auth.md ## Rationale`에 "비밀번호 재확인을 AuthService 단일 경로로 귀속"이라는 설계 결정과 "Controller 직접 bcrypt 사용 기각"의 취지가 등재되어 있지 않다. `data-flow/2-auth.md §1.2`는 bcrypt를 사용하는 로그인 메인 흐름의 다이어그램이지, "비밀번호 재확인 레이어 귀속 규칙"을 Rationale로 선언한 절이 아니다.
- **제안**: `spec/5-system/1-auth.md ## Rationale`에 신설 항목을 추가한다. 예: `### 2.3.D — 비밀번호 재확인의 레이어 귀속: AuthService 단일 경로` 항목으로 (a) Controller에서 raw bcrypt.compare를 직접 호출하는 패턴 기각 이유(보안 로직 분산, 에러 코드/메시지 일관성 깨짐, `comparePassword` 유틸 단일 SoT 원칙과 충돌), (b) `AuthService.verifyPasswordForUser`를 공통 재확인 게이트로 귀속한 결정, (c) `data-flow/2-auth.md §1.2`의 bcrypt 위치와의 연관성을 기록한다. 현재 코드 주석이 이 역할을 부분적으로 하고 있으나 spec Rationale이 단일 SoT여야 한다.

---

### [INFO] `sessions.service.ts` bcrypt → comparePassword 교체 — spec 본문 표현과의 경미한 불일치 가능성

- **target 위치**: `codebase/backend/src/modules/auth/sessions.service.ts` diff (raw `bcrypt.compare` → `comparePassword` 유틸 교체)
- **과거 결정 출처**: `spec/5-system/1-auth.md §1.1` 비밀번호 저장 행: "bcrypt (cost factor ≥ 12)". `spec/5-system/1-auth.md ## Rationale 2.3.C`에서 "변경 직전 `currentPassword` bcrypt 검증"이라고 구현 기술 레벨에서 bcrypt를 명시.
- **상세**: 기능적으로 동등(comparePassword 유틸이 bcrypt.compare 래퍼)하므로 실질 위반은 없다. 다만 Rationale 2.3.C 본문이 "currentPassword bcrypt 검증"처럼 구현 상세(라이브러리 직접 참조)를 노출하는 표현을 쓰고 있어, 향후 유틸 레이어로의 추상화 취지가 spec에 반영되지 않은 채로 남는다.
- **제안**: 별도 수정 의무 없음. 위 INFO 1번의 Rationale 신설 시 "comparePassword 유틸을 단일 SoT로" 언급하면서 Rationale 2.3.C의 "bcrypt 검증" 표현도 "비밀번호 검증(comparePassword 유틸)" 수준의 추상 표현으로 선택적으로 갱신하면 좋다.

---

## 요약

이번 diff는 `WebAuthnController`의 raw bcrypt.compare를 `AuthService.verifyPasswordForUser`로 위임하고, `sessions.service.ts`의 bcrypt.compare를 공유 `comparePassword` 유틸로 교체하는 레이어 정렬 리팩터링이다. `spec/5-system/1-auth.md ## Rationale`에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant를 위반하는 변경은 발견되지 않았다. 유일한 gap은 "비밀번호 재확인의 AuthService 단일 귀속" 설계 결정이 spec Rationale에 공식 등재되지 않은 채 코드 주석으로만 남아 있다는 점이다. 이는 Rationale 정합 보완 수준의 INFO이며, 기능·보안·아키텍처 원칙 위반은 없다.

## 위험도

NONE

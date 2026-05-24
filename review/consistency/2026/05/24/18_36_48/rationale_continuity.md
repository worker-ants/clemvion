# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전, scope=`spec/5-system`)
검토 대상 plan: `plan/in-progress/password-hash-format-guard.md`
관련 spec: `spec/5-system/1-auth.md`, `spec/1-data-model.md`

---

## 발견사항

### [INFO] `@BeforeInsert`/`@BeforeUpdate` entity hook 방식은 기존 Rationale 와 충돌하지 않으나 관련 결정 근거가 spec 에 부재

- **target 위치**: `plan/in-progress/password-hash-format-guard.md` §채택안 및 §변경 범위 — TypeORM `@BeforeInsert` / `@BeforeUpdate` 훅을 통한 bcrypt 포맷 검증
- **과거 결정 출처**: `spec/5-system/1-auth.md` §"비밀번호 저장" invariant (`password_hash` 는 `nullable`, bcrypt cost ≥ 12)
- **상세**: 기존 Rationale 는 저장 형태(bcrypt, nullable)를 명시하지만, application-level entity hook vs DB-level CHECK 제약 vs service-layer assertion 중 어느 계층에서 invariant 를 강제할지에 대한 결정은 기록되지 않은 상태다. plan 의 §제외 항목이 "DB 레벨 CHECK 제약 추가 — migration 동반. 본 PR scope 외" 라고 명시해 alternative 를 의식적으로 배제하고 있지만, 이 결정의 근거가 spec Rationale 에 기록되지 않는다. 현재 plan 은 `spec/5-system/1-auth.md § Rationale` 에 새 항목(예: `1.1.A — password_hash 포맷 검증 계층 선택`)을 추가하지 않겠다고 암시한다. 이는 후속 개발자가 "왜 DB CHECK 가 아닌 entity hook 인가"를 spec 에서 파악할 수 없는 상태로 남긴다.
- **제안**: plan §변경 범위에 "Spec — 변경 없음"이라고 되어 있으나, invariant enforcement 계층 선택(application entity hook을 1차, DB CHECK 를 추후 scope 로 분리한 이유)을 `spec/5-system/1-auth.md ## Rationale` 에 신규 항목으로 추가하는 것을 권장한다. 내용이 짧더라도 "DB CHECK 는 마이그레이션 동반으로 본 PR 범위에서 제외, entity hook 을 1차 방어선으로 채택" 정도면 충분하다.

---

### [INFO] plan 의 `passwordHash === null || === undefined` 통과 정책은 spec invariant 와 일치

- **target 위치**: `plan/in-progress/password-hash-format-guard.md` §채택안 — "null/undefined 는 통과 (OAuth-only 사용자, spec §'비밀번호 저장' 의 nullable invariant 와 일관)"
- **과거 결정 출처**: `spec/5-system/1-auth.md §1.1` 비밀번호 저장 행, `spec/1-data-model.md §2.1 User` (`password_hash: String?`)
- **상세**: spec 의 `password_hash` nullable invariant ("OAuth 단독 가입 사용자는 NULL") 와 plan 의 null/undefined 통과 정책이 일치한다. 기각된 대안을 재도입하거나 합의 원칙을 위반하는 요소 없음. 단, plan 이 `=== undefined` 도 통과로 처리하는데, spec 의 nullable 정의는 DB NULL 을 의미하므로 TypeORM entity 에서 `undefined` 와 `null` 의 구분이 필요한지를 구현 시 명확히 해야 한다(이 점은 spec 충돌이 아닌 구현 주의 사항).

---

### [INFO] bcrypt regex `/^\$2[aby]\$/` 의 variant 범위가 spec 과 정합한지 확인 권장

- **target 위치**: `plan/in-progress/password-hash-format-guard.md` §채택안 — `$2[aby]` prefix
- **과거 결정 출처**: `spec/5-system/1-auth.md §1.1` — "bcrypt (cost factor ≥ 12)" 명시. variant 제한 없음
- **상세**: spec 은 bcrypt 라고만 명시하고 `$2a`, `$2b`, `$2y` variant 를 명시적으로 열거하지 않는다. plan 이 `$2[aby]` 를 검증 정규식에 포함한 것은 현재 bcrypt 표준 variant 를 모두 허용하는 방향으로 spec 의 의도에 부합한다. 단, plan 의 정규식이 cost factor(rounds) 를 `\d{2}` (두 자리) 로만 허용하고 있어 cost ≥ 12 인지를 추가로 검사하지 않는다. spec 은 cost factor ≥ 12 를 요구사항으로 명시하므로, entity hook 이 포맷만 검증하고 rounds 범위를 검증하지 않으면 spec invariant (`cost factor ≥ 12`) 가 entity 레벨에서 완전히 강제되지 않는다. 이는 기각된 대안 재도입은 아니나, spec 요구를 부분만 충족하는 상황이다.
- **제안**: entity hook 또는 helper 에서 rounds 숫자를 파싱해 `rounds >= 12` 도 함께 검증하거나, plan Rationale 에 "rounds 범위 검증은 서비스 레이어(bcrypt.hash 호출 시 BCRYPT_ROUNDS 상수)가 보장하므로 entity hook 은 포맷만 확인" 이라고 명시해 의식적 분리를 기록할 것을 권장한다.

---

## 요약

`password-hash-format-guard` plan 은 `spec/5-system/1-auth.md` 의 기존 Rationale 에서 명시적으로 기각한 대안을 재도입하거나 합의된 invariant 를 직접 위반하지 않는다. `password_hash` nullable invariant 는 plan 의 null/undefined 통과 정책과 일치하며, bcrypt variant 범위도 spec 의 의도에 부합한다. 다만 세 가지 INFO 사항이 있다: (1) application entity hook 계층 선택 근거가 spec Rationale 에 부재한 점, (2) `undefined` 처리가 DB NULL 과 동일하게 취급되는지 구현 시 명확화 필요, (3) plan 의 정규식이 포맷은 검증하나 spec 의 `cost factor ≥ 12` 요건을 entity 레벨에서 완전히 커버하지 않는 점. 이 세 사항 모두 구현 차단 수준이 아니며, spec Rationale 보강 또는 구현 시 주석으로 처리할 수 있다.

---

## 위험도

LOW

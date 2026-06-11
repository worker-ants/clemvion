# Rationale 연속성 검토 결과

## 검토 대상

- **target 문서**: `spec/data-flow/2-auth.md` (§1.4 Refresh token 회전 + §Rationale "Refresh token 회전 원자성")
- **검토 모드**: 구현 완료 후 (`--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`)
- **변경 요약**: refresh 토큰 회전(§1.4 정상 분기)의 revoke+INSERT 를 단일 트랜잭션으로 원자화하고,
  revoke 를 조건부 UPDATE(`is_revoked=false AND expires_at>now`)로 TOCTOU 이중회전을 차단한 구현 반영.
  target spec 에 시퀀스 다이어그램 `rect` 박스 + Rationale 섹션 추가.

---

## 발견사항

### INFO — Rationale 참조 문서 명칭 일관성
- **target 위치**: `spec/data-flow/2-auth.md §Rationale "Refresh token 회전 원자성"` — `refactor/05-database.md C-1` 을 인라인으로 언급
- **과거 결정 출처**: `spec/5-system/1-auth.md §1.4.H` 및 `§1.4 C 동시성 보호` 섹션은 "단일 트랜잭션 + LoginHistory 트랜잭션 밖" 패턴을 WebAuthn 에 이미 명시
- **상세**: target 의 Rationale 가 `refactor/05-database.md C-1` 이라는 plan 내부 참조를 포함한다. plan 문서는 완료 후 `plan/complete/` 로 이동해 영속하지만, spec Rationale 은 plan 경로보다 "어떤 원칙·설계를 채택했는가" 의 독립적 서술이 권장된다. plan 경로 언급 자체는 오류가 아니며 추적성에 기여한다.
- **제안**: 기존 서술(`refactor/05-database.md C-1` 참조)을 제거하거나 선택적으로 `plan/complete/auth-refresh-rotation-atomic.md` 로 갱신하면 Rationale 가 plan 생애와 독립적으로 읽힌다. 강제 수정 사항은 아님.

---

### INFO — `loginHistory` 트랜잭션 외 배치 원칙의 명시적 연결
- **target 위치**: `spec/data-flow/2-auth.md §Rationale "Refresh token 회전 원자성"` 마지막 단락 ("refresh 정상 회전은 보안 이벤트가 아니므로 reuse 분기와 달리 기록하지 않는다")
- **과거 결정 출처**: `spec/5-system/1-auth.md §1.4` 동시성 보호 섹션 — "LoginHistory 기록은 트랜잭션 *밖*에서 호출해 audit 자체가 보안 핵심 경로를 막지 않도록 한다" (WebAuthn 맥락)
- **상세**: target 의 "기록하지 않는다" 서술과 `spec/5-system/1-auth.md §1.4` 의 "트랜잭션 밖 기록" 원칙 모두 LoginHistory 를 트랜잭션 밖에 두는 같은 설계 원칙에서 유래하지만, refresh 정상 회전에서 "기록 자체를 하지 않는 이유" (보안 이벤트 아님) 와 "기록하되 트랜잭션 밖" (audit 성능 분리) 이 약간 다른 논거다. 충돌은 아니며 각각의 맥락이 명확하다.
- **제안**: 현재 서술로 충분. 필요 시 "정상 회전은 기록 자체를 생략하는 반면, reuse 분기와 WebAuthn 이벤트는 기록하되 트랜잭션 밖에 둔다" 라는 한 문장 보완으로 두 원칙의 차이를 명시할 수 있다.

---

## 충돌·번복 분석 (CRITICAL/WARNING 해당 없음)

### 기각된 대안 재도입 여부

`plan/in-progress/refactor/05-database.md C-1` 은 세 가지 옵션을 검토했다:

- **옵션 A**: `dataSource.transaction` 원자화 (채택) — target 이 이 경로를 정확히 반영함.
- **옵션 B**: INSERT 먼저 / revoke 나중 (기각 — 동시 유효 토큰 창 발생) — target 에 재도입 없음.
- **현상유지** (기각 — 세션 소실 가능) — target 에 재도입 없음.

target 은 기각된 어떤 대안도 채택하지 않았다.

### 합의된 원칙 위반 여부

`spec/5-system/1-auth.md` 의 기존 Rationale 이 확립한 원칙들:

1. **단일 트랜잭션 원자성** (§1.4 동시성 보호, §1.5.2 가입 트랜잭션) — target 이 동일 패턴을 채택·명시함. 위반 없음.
2. **LoginHistory 는 트랜잭션 밖** (§1.4 WebAuthn) — target 이 동일 원칙을 유지함. 위반 없음.
3. **reuse-detection 분기는 family 전체 revoke** (기존 정의, §3.1 상태 전이 유지) — target 이 reuse 분기를 건드리지 않고 정상 회전 분기만 원자화함. 위반 없음.
4. **refreshToken httpOnly 쿠키 + accessToken body** (§2.3) — 회전 원자화가 토큰 전달 방식을 변경하지 않음. 위반 없음.

### 결정 무근거 번복 여부

`spec/5-system/1-auth.md §2.4` 의 회전 플로우 기술은 트랜잭션 경계를 명시하지 않았으나, "미결정" 영역이었으며 번복이 아님 — `plan/in-progress/refactor/05-database.md` 의 "spec 대조: D — 미결정 영역이고 원자화가 spec 비저촉" 이 이를 문서화한다. 새 Rationale 이 동반되어 무근거 번복이 아님.

### 암묵적 가정 충돌 여부

`spec/5-system/1-auth.md §1.4.1` 의 invariant "회전(구 토큰 무효화) 의미"를 target 이 강화(동시 유효 토큰 창 차단)하므로 충돌 없음. 조건부 UPDATE(`is_revoked=false AND expires_at>now`)가 이미 검증 후 UPDATE 를 수행했던 기존 접근의 TOCTOU 창을 제거하며, 기존 row-select 후 검증 패턴이 조건부 UPDATE + affected-check 패턴으로 강화되는 것은 이전 Rationale 이 침묵했던 영역이다.

---

## 요약

`spec/data-flow/2-auth.md` 의 이번 변경(§1.4 트랜잭션 박스 추가 + §Rationale "Refresh token 회전 원자성" 신설)은 기존 Rationale 와의 연속성을 온전히 유지한다. `spec/5-system/1-auth.md §1.4` 의 "단일 트랜잭션 + LoginHistory 트랜잭션 밖" 원칙을 WebAuthn 선례와 동형으로 적용했고, 기각된 대안(옵션 B: INSERT 선행, 현상유지)을 재도입하거나 기존 invariant(family 전체 revoke, httpOnly 쿠키 방식)를 우회하는 내용이 없다. `plan/in-progress/refactor/05-database.md C-1` 의 옵션 A 채택 서술이 spec 에 명문화되어 "결정 무근거 번복" 기준도 충족한다. 발견된 항목은 모두 INFO 수준의 Rationale 표현 보완 제안으로, CRITICAL/WARNING 에 해당하는 위반은 없다.

## 위험도

NONE

# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/data-flow/, diff-base=origin/main)  
Target: `spec/data-flow/2-auth.md` (§1.4 refresh token 회전 원자화 변경)

---

## 발견사항

### 발견사항 없음 (정상)

이번 diff 에서 도입된 변경은 `spec/data-flow/2-auth.md §1.4` 의 Refresh token 회전 시퀀스에 아래 두 가지를 추가한 것이다:

1. `rect rgb(235, 245, 235)` 박스로 revoke(UPDATE) + INSERT 를 단일 트랜잭션으로 시각화.
2. 인라인 노트("회전 원자성 (05 C-1)")로 원자성 보장, TOCTOU 방어, loginHistory 트랜잭션 외 유지 근거를 명시.

이 변경에 대해 4개 점검 관점을 모두 검토했다.

**1. 기각된 대안의 재도입 — 없음**

기존 `spec/data-flow/2-auth.md` Rationale 와 `spec/5-system/1-auth.md` Rationale 어디에도 "refresh token 회전을 비원자(2-step SELECT + UPDATE + INSERT)로 유지한다"는 명시적 결정 또는 "단일 트랜잭션 방식을 기각한다"는 기록이 없다. 따라서 기각된 대안을 재도입하는 상황이 아니다.

**2. 합의된 원칙 위반 — 없음**

`spec/5-system/1-auth.md §1.4` (WebAuthn 동시성 보호) 의 기존 Rationale 은 "LoginHistory 기록은 트랜잭션 *밖* 에서 호출해 audit 자체가 보안 핵심 경로(credential 삭제 + token revoke commit) 를 막지 않도록 한다"는 원칙을 명시한다. target 변경도 동일하게 `loginHistory` 기록은 트랜잭션 밖에 유지한다고 명시(`"loginHistory 기록은 회전 원자성과 무관해 트랜잭션 밖에 유지한다"`) — 기존 합의 원칙과 정합한다.

WebAuthn 등록 경로에 대해 이미 "단일 트랜잭션" 원자성이 spec 에 명시된 선례가 있으므로(`spec/5-system/1-auth.md §1.4` 동시성 보호), refresh 회전에 동일 원자성 원칙을 적용하는 것은 합의된 아키텍처 패턴의 **일관된 확장**이다.

**3. 결정의 무근거 번복 — 없음**

이 변경은 기존 결정을 번복하는 것이 아니라 기존에 누락된 보장(원자성)을 추가하는 것이다. 새 Rationale 가 이미 인라인 노트 형태로 target 본문에 포함되어 있으며(`"회전 원자성 (05 C-1)"` 노트), plan 파일(`plan/in-progress/auth-refresh-rotation-atomic.md §Rationale`)에도 결정 배경이 문서화되어 있다.

**4. 암묵적 가정 충돌 — 없음**

기존 `spec/data-flow/2-auth.md §2.1` 의 Schema 매핑 표(`refresh 회전: UPDATE is_revoked=true ... + INSERT new row`)는 여전히 두 조작이 존재함을 기술하고 있고, target 변경은 그 순서 자체를 바꾸지 않으며 단지 두 조작을 트랜잭션으로 묶는다. `refresh_token` 테이블 스키마(마이그레이션)는 무변경이므로 invariant 충돌이 없다.

---

## 요약

`spec/data-flow/2-auth.md §1.4` 에 추가된 refresh token 회전 원자화 spec 변경은 기존 Rationale 에서 기각·폐기된 대안을 재도입하거나 합의된 원칙을 위반하지 않는다. WebAuthn 경로에 이미 존재하는 "단일 트랜잭션 + loginHistory 트랜잭션 외" 패턴을 refresh 회전에도 일관되게 적용한 것이며, 번복 근거(plan Rationale + 인라인 노트)도 함께 작성되어 있다. Rationale 연속성 관점에서 이슈 없음.

## 위험도

NONE

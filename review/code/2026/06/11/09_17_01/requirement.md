# Requirement Review — auth-refresh-rotation-atomic (2차 리뷰)

## 발견사항

---

### [INFO] refresh 정상 회전 경로에서 loginHistory.record 미호출 (기존 1차 리뷰 동일)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.ts` `refresh()` 정상 회전 분기
- **상세**: 정상 회전 완료 후 `loginHistory.record()` 호출이 없다. 이는 spec `spec/data-flow/2-auth.md §1.4` 시퀀스 다이어그램에도 `loginHistory` 호출이 묘사되어 있지 않고, `spec/5-system/1-auth.md §4.3` 이벤트 enum 에도 `token_refreshed` 류 이벤트가 없으므로 의도된 설계다. 신규 `spec/data-flow/2-auth.md` 원자성 노트에도 "loginHistory 기록은 회전 원자성과 무관해 트랜잭션 밖에 유지한다"고 명시.
- **제안**: 현재 spec 수준에서 변경 불필요. 코드에 `// refresh 회전 성공은 login_history 에 기록하지 않는다 (spec §1.4 의도)` 주석이 이미 존재(구현 완전).

---

### [INFO] `stored.user` null 가드 — 정상 회전 분기에 추가됨 (1차 리뷰 INFO5 반영 완료)
- **위치**: `auth.service.ts` 라인 580–587 (`const user = stored.user; if (!user) { ... }`)
- **상세**: 1차 리뷰(INFO 5)에서 지적된 reuse 분기와 정상 분기 간 null 가드 불일관이 이번 변경에서 `if (!user)` 가드로 해소됐다. `TOKEN_INVALID` 로 거부하는 동일 패턴 적용 완료.
- **제안**: 없음.

---

### [INFO] spec fidelity — spec/data-flow/2-auth.md §1.4 업데이트 완전 반영
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/spec/data-flow/2-auth.md` §1.4 (라인 168–191)
- **상세**: 코드 구현과 spec 시퀀스의 line-level 일치를 검증:
  - spec line 170: `UPDATE refresh_token SET is_revoked=true, last_used_at=now WHERE id = row.id AND is_revoked = false AND expires_at > now` → 코드: `manager.getRepository(RefreshToken).update({ id: stored.id, isRevoked: false, expiresAt: MoreThan(now) }, { isRevoked: true, lastUsedAt: now, lastUsedIp: ctx.ip ?? null })` — 일치 (TypeORM 필드명 camelCase 정상 매핑).
  - spec line 172: `INSERT refresh_token (family_id=row.family_id, new token_hash, expires_at)` → 코드: `generateTokens(user, false, stored.familyId, ctx, manager)` 내 `refreshRepo.save(refreshTokenEntity)` — 일치.
  - spec line 169: `단일 트랜잭션 (revoke + INSERT 원자성)` → 코드: `this.dataSource.transaction(async (manager) => { ... })` — 일치.
  - spec note line 184: `매칭 0건이면 ... TOKEN_INVALID 로 거부한다` → 코드: `if (!result.affected) { throw new UnauthorizedException({ code: 'TOKEN_INVALID', ... }) }` — 일치.
  - **주의**: spec 원자성 노트(line 637) 에서 "JWT sign 은 DB 무관이라 트랜잭션 **밖**에서 선계산한다"고 명시했으나, 코드에서는 `jwtService.sign()` 이 `generateTokens()` 내부에서 트랜잭션 콜백 안에서 호출된다. JWT sign 은 DB I/O 가 없는 순수 CPU 연산이라 원자성에 실질 영향 없고, 기능 동작은 올바르다. spec 표현이 구현 의도를 완전히 반영하지 못한 표현 문제이지 코드 버그가 아니다.
- **제안**: 코드가 올바름. spec 표현 "트랜잭션 밖에서 선계산" 은 현재 구현과 미세하게 다르나 기능 동작에 영향 없는 표현 차이임을 인지.

---

### [INFO] [SPEC-DRIFT] spec/5-system/3-error-handling.md TOKEN_INVALID 행 — 신규 발생 케이스 병기 완료
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/spec/5-system/3-error-handling.md` 라인 36
- **상세**: `TOKEN_INVALID` 에러 코드 SoT 에 "refresh 회전 시 조건부 revoke 매칭 0건(동시 회전 경합)" 케이스가 추가 병기됐다. 이는 코드 구현에서 `affected=0` 시 `TOKEN_INVALID` 를 반환하는 동작과 일치하며, 1차 consistency-check(`review/consistency/2026/06/11/08_57_01/`) I6 권고사항을 반영한 것. spec SoT 가 구현 현실을 정확히 반영하도록 갱신 완료.
- **제안**: 현재 구현과 spec 일치. 완료.

---

### [INFO] [SPEC-DRIFT] spec/data-flow/2-auth.md §1.4 자기참조 수식어 교체 완료
- **위치**: `spec/data-flow/2-auth.md` 라인 638–639
- **상세**: 1차 consistency-check W3 이슈(§1.4 내에서 §1.4 자기참조)가 `§1.1 의 verifyEmail 가입 트랜잭션` 선례로 교체됐다. `"§1.4 본문에서 단일 트랜잭션을 이미 명시"` 자기참조 오류가 제거되고 실제 선례(§1.1 verifyEmail/register 트랜잭션)로 대체됨. 독자 혼란 제거.
- **제안**: 반영 완료.

---

### [INFO] 테스트: "rotates revoke + issue inside a single transaction" — lastUsedIp null 단언의 역할 혼재
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.spec.ts` 라인 93–100 (신규 원자성 테스트)
- **상세**: 테스트명이 "원자성(atomicity)"을 검증함을 명시하지만, `lastUsedIp: null` 단언은 부수적 필드 값 검증이다. `ctx` 미전달 시 `ctx.ip ?? null = null` 이 되어 현재 통과하지만, 핵심 단언(트랜잭션 내 revoke+INSERT)과 부수 단언(IP 필드값)이 동일 `it` 블록에 혼재한다. 기능 문제는 없다.
- **제안**: `lastUsedIp` 단언을 `expect.anything()` 으로 완화하거나 별도 `it` 블록으로 분리 고려. 현재 테스트가 실패하지 않으므로 INFO.

---

### [INFO] plan/complete/auth-refresh-rotation-atomic.md — spec_impact frontmatter 포함 확인
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/plan/complete/auth-refresh-rotation-atomic.md` frontmatter
- **상세**: plan 이 `plan/complete/` 로 이동했으며 frontmatter 에 `spec_impact: [spec/data-flow/2-auth.md, spec/5-system/3-error-handling.md]` 가 선언되어 있다. Gate C 요건(started ≥ 2026-06-04, spec_impact 필수) 충족.
- **제안**: 없음.

---

### [INFO] TODO/FIXME 주석 검색 — 없음
- **상세**: 변경된 코드(`auth.service.ts`, `auth.service.spec.ts`)에 TODO, FIXME, HACK, XXX 주석 없음. 모든 주석은 설명적(05 C-1 회귀 가드, 설계 의도 설명) 이고 미완성 작업을 시사하지 않는다.

---

### [INFO] 에러 시나리오 커버리지 — 완전
- **상세**: 세 분기 모두 에러 처리가 명확:
  1. reuse 탐지 (`stored.isRevoked = true`) → `TOKEN_INVALID` (family 전체 revoke + loginHistory)
  2. 만료 (`expiresAt < now`) → `TOKEN_EXPIRED` (트랜잭션 미진입)
  3. 정상 회전 내 `affected=0` (TOCTOU 동시 회전) → `TOKEN_INVALID` (신규 토큰 미발급)
  4. `stored.user` null → `TOKEN_INVALID` (데이터 손상 방어)
  5. INSERT 실패 (DB 에러) → 에러 전파, 트랜잭션 롤백 (단위 테스트: 에러 전파 검증, 실 롤백: e2e 보장)
- **제안**: 없음.

---

### [INFO] 입력 데이터 유효성 검증 — 완전
- **상세**: `refreshToken` 파라미터는 `findOne({ where: { tokenHash } })` 로 DB 조회. `null` 반환 시 `TOKEN_INVALID`. `isRevoked`, `expiresAt`, `user` 관계 모두 명시적 검증. 조건부 UPDATE 로 race condition 방어까지 추가됨.

---

## 요약

이번 변경(auth-refresh-rotation-atomic, 05 C-1)은 `refresh()` 메서드의 구 토큰 revoke(UPDATE)와 신규 토큰 INSERT를 `dataSource.transaction`으로 원자화하는 C-1 Critical 요건을 완전하고 정확하게 구현하였다. 기능 완전성 관점에서 세 분기(reuse 탐지/만료/정상 회전) 모두 에러 시나리오가 명확히 정의됐고, `stored.user` null 가드가 정상 회전 분기에도 추가되어 reuse 분기와 방어 패턴이 통일됐다. spec fidelity 관점에서 `spec/data-flow/2-auth.md §1.4` 시퀀스 다이어그램과 코드 구현이 line-level 로 일치한다 — 조건부 UPDATE 필드(`is_revoked=false AND expires_at>now`), `affected=0` 시 `TOKEN_INVALID` 거부, 단일 트랜잭션 박스, `TOKEN_INVALID` 에러코드 SoT 갱신 모두 일치. spec 원자성 노트의 "JWT sign 트랜잭션 밖 선계산" 표현은 코드에서 JWT sign 이 트랜잭션 콜백 내부 `generateTokens`에서 수행돼 미세하게 다르나, JWT sign 은 DB I/O 없는 순수 CPU 연산으로 원자성과 무관하므로 기능 동작에 영향 없다. TODO/FIXME 없음, 반환값 모든 경로 완전, 비즈니스 로직(원자화 + TOCTOU 차단) 정확히 반영. 전반적으로 요구사항 충족 완전.

## 위험도

LOW

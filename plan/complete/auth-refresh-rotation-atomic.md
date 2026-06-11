---
worktree: auth-refresh-rotation-atomic
started: 2026-06-11
owner: developer
spec_impact:
  - spec/data-flow/2-auth.md
  - spec/5-system/3-error-handling.md
---

# P0 — refresh 토큰 rotation 원자화 (refactor 05 C-1)

> 출처: `plan/in-progress/refactor/05-database.md` C-1 (P0 #4, 바로 가능). 옵션 A.
> 구 토큰 revoke 와 신규 토큰 INSERT 가 비원자라 중간 실패 시 구 토큰만 무효화되고 신규 토큰이 없어
> **세션 통째 소실** 가능. `dataSource.transaction` 으로 원자화.

## 변경

### 코드 (`auth.service.ts`)
- `refresh()` 정상 회전 분기: `revoke(UPDATE) + generateTokens(INSERT)` 를 `dataSource.transaction`
  으로 묶음. 중간 실패 시 둘 다 롤백 → 구 토큰 `is_revoked=false` 유지(세션 소실 제거).
- `generateTokens()` 에 optional `EntityManager` 추가 — 전달 시 그 manager 의 RefreshToken repo 로
  INSERT(트랜잭션 합류), 미전달 시(login/OAuth 경로) 기존 repository — 호출처 무변경.
- JWT sign 은 DB 무관이라 트랜잭션 밖 선계산.
- reuse-detection 분기(family 전체 revoke)는 단일 UPDATE 라 자체 원자적 — 무변경. `loginHistory` 는
  §1.4 전례대로 트랜잭션 밖.
- 스키마 불변 — 마이그레이션 불요.

### Spec (`spec/data-flow/2-auth.md §1.4`)
- 회전 시퀀스의 revoke+INSERT 를 `rect`(단일 트랜잭션) 박스로 + 원자성 노트(WebAuthn §1.4 전례 동형).

## 체크리스트
- [x] `/consistency-check --spec` BLOCK: NO (`review/consistency/2026/06/11/08_38_12/`).
- [x] 단위: 회전 단일 트랜잭션 + 조건부 revoke(affected=0 거부) + 만료경로 트랜잭션 미진입 + 롤백 에러전파.
- [x] TEST WORKFLOW — lint ✅ · unit ✅ (backend 6509) · build ✅ · e2e ✅ (188).
- [x] `/ai-review` — LOW / Critical 0 / Warning 6 → W2(TOCTOU 조건부 revoke)·W1·W3·W6 등 반영 또는 근거 수용. RESOLUTION: `review/code/2026/06/11/08_45_18/RESOLUTION.md`.
- [x] `/consistency-check --impl-done spec/data-flow/` BLOCK: NO (`review/consistency/2026/06/11/08_57_01/`). W3(자기참조)·W4/I4(라벨)·I6(TOKEN_INVALID SoT) 반영; W1·W2(email_verify/세션정책)는 본 변경 무관 기존 spec 갭 → scope 밖.

## Rationale
옵션 A — 세션 소실(현상유지)과 동시 유효 토큰 창(순서 역전안 B)을 모두 제거하는 유일안. spec §1.4 가
WebAuthn 등록에 "단일 트랜잭션" 을 이미 명시(원자성이 의도일 때 명문화하는 문서)하므로 회전 원자화는
spec 비저촉. `generateTokens` 시그니처 변경은 manager default=기존 repo 로 호출처 무변경 흡수.

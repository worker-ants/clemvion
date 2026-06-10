---
worktree: auth-refresh-rotation-atomic
started: 2026-06-11
owner: developer
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

### Spec (`data-flow/2-auth.md §1.4`)
- 회전 시퀀스의 revoke+INSERT 를 `rect`(단일 트랜잭션) 박스로 + 원자성 노트(WebAuthn §1.4 전례 동형).

## 체크리스트
- [ ] `/consistency-check --spec` BLOCK: NO.
- [ ] 단위: 트랜잭션 중간 실패 주입 시 구 토큰 `is_revoked=false` 유지 + 기존 refresh/reuse green.
- [ ] TEST WORKFLOW (lint·unit·build·e2e).
- [ ] `/ai-review` + fix.
- [ ] `/consistency-check --impl-done spec/data-flow/` BLOCK: NO.

## Rationale
옵션 A — 세션 소실(현상유지)과 동시 유효 토큰 창(순서 역전안 B)을 모두 제거하는 유일안. spec §1.4 가
WebAuthn 등록에 "단일 트랜잭션" 을 이미 명시(원자성이 의도일 때 명문화하는 문서)하므로 회전 원자화는
spec 비저촉. `generateTokens` 시그니처 변경은 manager default=기존 repo 로 호출처 무변경 흡수.

---
worktree: invitation-token-plan-reconcile
started: 2026-06-10
completed: 2026-06-27
status: complete
owner: project-planner
spec_impact:
  - spec/5-system/1-auth.md
priority: low
---

# 백로그: 초대 토큰 해시 저장 전환 검토 — 종결 (raw 유지 결정)

출처: ai-review SUMMARY W-1 (security-fixes-audit-guard-secret-rotation, 2026-06-10)

## 결정 / 종결 (2026-06-27)

`spec/5-system/1-auth.md §1.5.D — 워크스페이스 초대 토큰을 raw 로 저장하는 이유` 가 본 백로그
질문(해시 전환 여부)에 **확정 답을 제공**한다: *"해시 전환의 보안 이득이 위협 모델 대비 작아
**raw 저장을 유지한다**"*. 근거 — ① 토큰 단독 권한 획득 불가(수락 시 이메일 일치 강제 §1.5.3),
② 단일 사용 + 7일 만료로 노출 창 한정, ③ pending 초대 lookup 필요. DB 유출 방어는 이메일 일치
강제(1차)·만료(2차)가 담당.

→ 따라서:
- **작업 #1**(§1.5.D 결정 여부 명시) = **완료** — §1.5.D 가 raw 유지 명문화.
- **작업 #2~4**(SHA-256 해시 저장·마이그레이션·테스트) = **N/A (취소)** — 해시 전환 미채택 결정이므로 구현 불요.
- 백로그 종결, `plan/complete/` 이동. spec 변경 없음(§1.5.D 는 이미 기존 spec).

## 배경

현재 `invitation` 테이블에 초대 토큰을 raw 문자열로 저장한다. DB 유출 시 공격자가 대상 이메일로
가입·변경 후 토큰을 사용하는 시나리오가 이론적으로 존재한다.

**현재 완화 수단 (운영 즉각 취약점 아님):**
- 1회 사용 후 무효 처리
- 7일 만료 TTL
- token 단독 lookup (email 없이 토큰만으로 조회)

## 작업 범위 (착수 시)

1. `spec/5-system/1-auth.md §1.5.D` Rationale 검토 — 해시 저장 전환 결정 여부 명시
2. invitation 발급 시 raw 대신 SHA-256 해시 저장 + lookup 도 해시로 비교 (`timingSafeEqual`)
3. 기존 미만료 토큰 마이그레이션 전략 (이전 raw → 재발급 or 만료 처리)
4. 단위·e2e 테스트 갱신

## 주의사항

- DB 마이그레이션 포함 — 착수 시 `developer` 가 `project-planner` 에게 spec 결정 위임 먼저
- 기존 미만료 토큰 처리 전략 확정 없이 자동 수정 금지 (사용자 결정 필요)

# Plan 정합성 검토 결과

target: `plan/in-progress/prod-fail-closed-guards.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] refactor/04-security.md C-1 권장안(옵션 A)과 `|| 'dev-jwt-secret'` fallback 유지 결정 충돌

- **target 위치**: `prod-fail-closed-guards.md` 라인 26 — `"jwt.config.ts 의 || 'dev-jwt-secret' fallback 은 유지 — dev/test 편의(prod 는 가드가 거부)"`
- **관련 plan**: `plan/in-progress/refactor/04-security.md` §C-1, 옵션 A 권장안 — `"|| 'dev-jwt-secret' 제거 + main.ts 부팅 가드에 production && !JWT_SECRET → throw"`, 그리고 `plan/in-progress/security-jwt-secret-fallback.md` — `"프로덕션 부팅 정책 결정(프로덕션 부팅 거부 여부)는 운영 영향이 있어 사용자/운영 합의 필요"`
- **상세**: refactor/04-security.md C-1 의 권장 옵션 A 는 `|| 'dev-jwt-secret'` 코드 라인을 **제거**하고 main.ts 가드를 추가하는 2-step 접근이다. target plan 은 가드 추가(production 에서 sentinel 값 throw)는 동일하게 수행하지만, fallback 코드 자체는 **유지**한다. 기능적으로는 가드가 sentinel 값을 거부하므로 production 보안 목표는 동일하게 달성된다. 그러나 security-jwt-secret-fallback.md 에는 "사용자/운영 합의 필요"가 명시되어 있으며, refactor README 의 2026-06-10 사용자 결정 기록에는 C-1 이 승인 목록에 **없다** (승인된 것은 m-4·M-6·m-2·M-5·M-1 5건). 즉 C-1 의 구체 구현 방식(fallback 제거 vs 유지)은 미결 상태인데 target plan 이 fallback 유지 방향으로 단독 결정하고 있다.
- **제안**: target plan 의 Rationale 에 "refactor/04-security.md C-1 옵션 A 의 fallback 제거 권장과의 차이" 를 명시하거나, security-jwt-secret-fallback.md 의 미결 결정 포인트를 목표 plan 착수 전 사용자 합의로 닫아야 한다. 또는 refactor/04-security.md C-1 체크박스에 "prod-fail-closed-guards PR 로 처리 (fallback 유지 방식으로 구현)" 주석을 추가하면 추적 일관성이 확보된다.

---

### [WARNING] security-jwt-secret-fallback.md 미결 상태 — target plan 이 이를 대체하는 구조인지 불명확

- **target 위치**: `prod-fail-closed-guards.md` 상단 출처 메모 — `"출처: plan/in-progress/refactor/04-security.md C-1·M-4·M-7 (P0 #3, 옵션 A: 단일 가드 블록)"`
- **관련 plan**: `plan/in-progress/security-jwt-secret-fallback.md` (worktree: unstarted, status: backlog, 미착수)
- **상세**: target plan 이 착수됨으로써 security-jwt-secret-fallback.md 가 추적하던 C-1 항목은 사실상 이 PR 에서 처리된다. 그러나 security-jwt-secret-fallback.md 는 여전히 `plan/in-progress/` 에 미착수 backlog 상태로 남아 있어, PR 머지 후에도 중복 추적이 발생한다. refactor README §기존 plan 과의 관계 표에도 "04 C-1 (JWT secret) — 기존 plan 참조 + fail-closed 가드 블록 합류"로만 기술되어 있고, 합류 후 security-jwt-secret-fallback.md 를 close 해야 한다는 절차가 없다.
- **제안**: target plan 의 체크리스트에 "security-jwt-secret-fallback.md → plan/complete/ 이동 (본 PR 이 C-1 을 대체 완료)" 항목 추가. 또는 target plan 착수 시점에 security-jwt-secret-fallback.md 에 "이 항목은 prod-fail-closed-guards PR 로 처리됨" 메모를 남기고 complete 이동.

---

### [WARNING] refactor/04-security.md C-1 spec 갱신 요구사항 — target plan 의 spec 변경이 부분적

- **target 위치**: `prod-fail-closed-guards.md` §Spec — `"1-auth.md §2.1: JWT_SECRET production fail-closed 노트"` 외 2건
- **관련 plan**: `plan/in-progress/refactor/04-security.md` C-1 — `"spec 갱신: 1-auth.md §2 에 fail-closed 1줄 + Rationale (planner)"`. refactor README spec 갱신 필요 항목 — `"1-auth.md §2.1 SameSite/CSRF 정책 공백 (04 M-5), secret-store.md placeholder 정책 (04 M-4)"`
- **상세**: target plan 은 `secret-store.md §3.3` 에 ".env.example=placeholder + 예시 키 production 거부"를 추가한다고 명시한다. refactor README 의 spec 갱신 필요 항목에 `secret-store.md placeholder 정책 (04 M-4)` 가 "developer 착수 시 planner 위임" 대기 목록으로 등재되어 있다. target plan 이 이 항목을 함께 처리하는 것은 중복 작업이 아니라 올바른 범위 내 처리이다. 단, refactor README 의 해당 목록 항목에 "prod-fail-closed-guards PR 에서 처리 완료" 메모가 없으면 이후 중복 작업 가능성이 있다.
- **제안**: PR 머지 후 refactor README spec 갱신 필요 항목 목록에서 `secret-store.md placeholder 정책 (04 M-4)` 와 `1-auth.md §2.1` 항목을 strike-through 처리하거나 target plan 참조로 닫아야 한다.

---

### [INFO] spec/5-system/1-auth.md 동시 변경 — unified-model-mgmt-5af7ee worktree (active)

- **target 위치**: `prod-fail-closed-guards.md` §Spec — `"1-auth.md §2.1: JWT_SECRET production fail-closed 노트"`
- **관련 plan**: `plan/in-progress/unified-model-management.md` (worktree: unified-model-mgmt-5af7ee, active), `spec/5-system/1-auth.md` 동시 변경
- **상세**: unified-model-mgmt-5af7ee 브랜치도 `spec/5-system/1-auth.md` 를 수정하고 있다. 그러나 unified-model-mgmt 변경 구간은 line 184(초대 rate limit), 312~331(RBAC 표 + Model Config), 348(audit log), 534(Rationale §2.3.A) 이고, target plan 의 변경 대상은 §2.1(line 240 부근 JWT 토큰 구조 표에 note 추가)로 **섹션 비중첩**이다. 머지 시 충돌 가능성은 낮으나, unified-model-mgmt-5af7ee 가 선행 머지되지 않으면 target plan PR 의 base 에 §RBAC 표 변경이 없어 rebase 필요성이 생긴다. security-fixes-audit-guard-secret-rotation.md 완료 문서(`plan/complete/`)에도 "W-1 merge 순서(unified-model-mgmt 후행 rebase) PR 본문 명시"가 이미 기록되어 있어 이 의존성은 알려진 상태다.
- **제안**: target plan PR 본문에 "unified-model-mgmt-5af7ee 선행 머지 권장 (같은 파일 1-auth.md 병행 수정)" 주석 추가로 충분하다. 직접 충돌은 아니므로 INFO 등급 유지.

---

## Stale 으로 skip 한 worktree (의무 — 0건)

worktree 충돌 후보로 식별한 `claude/unified-model-mgmt-5af7ee` 에 대해 stale 판정 cascade 를 수행했다:

- Step 1: `git merge-base --is-ancestor claude/unified-model-mgmt-5af7ee origin/main` → exit 1 (ACTIVE, main 에 미포함)
- Step 2: `gh pr list --state all --head claude/unified-model-mgmt-5af7ee` → 결과 empty (PR 없음, 아직 생성 전)
- Step 3: Fallback — active 로 처리. (stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장)

따라서 stale 으로 skip 된 worktree 는 0건이다.

나머지 active worktree (`claude/nav-spec-hygiene-6d2d79`, `claude/ai-node-override-fields`, `claude/auth-refresh-rotation-atomic`) 는 `spec/5-system/1-auth.md`, `spec/conventions/secret-store.md`, `spec/4-nodes/4-integration/11-mcp-client.md` 중 어느 파일도 수정하지 않으므로 §5 worktree 충돌 해당 없음.

---

## 요약

target plan `prod-fail-closed-guards` 는 refactor/04-security.md C-1·M-4·M-7 의 P0 권고를 단일 가드 블록으로 구현하는 방향으로 plan 의도와 전반적으로 정합하며, 선행 plan 미해소(선결 조건 위반) 또는 worktree 경합(CRITICAL)은 없다. 주요 경고 사항은 두 가지다: (1) refactor/04-security.md C-1 권장 옵션 A 가 `|| 'dev-jwt-secret'` fallback **제거**를 포함하는데 target plan 은 fallback **유지**로 구현하며, 이 결정 차이가 security-jwt-secret-fallback.md 의 "사용자/운영 합의 필요" 미결 항목과 충돌할 수 있다; (2) target plan 착수로 security-jwt-secret-fallback.md 가 사실상 대체 완료되나 plan 상태 갱신 절차가 없어 중복 추적 위험이 있다. worktree 충돌 후보 1건(unified-model-mgmt-5af7ee 의 1-auth.md 병행 수정) 은 섹션 비중첩으로 직접 충돌이 아니어서 INFO 로 처리했다. stale skip 0건.

---

## 위험도

MEDIUM

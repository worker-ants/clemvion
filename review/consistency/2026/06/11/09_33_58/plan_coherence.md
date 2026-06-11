# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/data-flow/, diff-base=origin/main)
Target: `spec/data-flow/` (실질 변경: `spec/data-flow/2-auth.md`, `spec/5-system/3-error-handling.md`)
분석 기준: `plan/in-progress/**` 현황 (2026-06-11)

---

## 발견사항

### [INFO] auth-refresh-rotation-atomic plan 이 complete/ 로 이동되어 있음 — 정상

- target 위치: `plan/complete/auth-refresh-rotation-atomic.md`
- 관련 plan: `plan/in-progress/refactor/05-database.md` C-1
- 상세: 본 worktree 의 plan 파일은 이미 `plan/complete/auth-refresh-rotation-atomic.md` 로 이동되어 있으며, `refactor/05-database.md` C-1 도 `[x] ✅ 완료 (2026-06-11, 옵션 A)` 로 체크됐다. target(`spec/data-flow/2-auth.md §1.4`) 의 트랜잭션 박스 추가는 plan 이 명시한 갱신 범위 (`data-flow/2-auth.md §1.4 시퀀스에 트랜잭션 박스 1개`) 와 정확히 일치한다. 미해결 결정 없이 수행된 정합한 완료다.
- 제안: 없음.

### [INFO] `refactor/05-database.md` C-1 권고안(옵션 A) 선택 — 미결정 항목 아님

- target 위치: `spec/data-flow/2-auth.md §1.4` 시퀀스 다이어그램 `rect` 박스 + Rationale "Refresh token 회전 원자성"
- 관련 plan: `plan/in-progress/refactor/05-database.md` C-1 spec 대조 판정 D (미결정 영역)
- 상세: spec 대조 판정 D("대비: 같은 문서 §1.4 WebAuthn 은 단일 트랜잭션 명시 — 원자화가 spec 비저촉")로 "결정 필요" 상태였으나, plan 이 옵션 A(권장안)를 명시하고 worktree 체크리스트에 `[x]` 완료로 기록되어 있다. target spec 이 이 결정을 반영하는 것은 일방적 결정 우회가 아니라 plan 이 권고한 옵션의 정상 이행이다.
- 제안: 없음.

### [INFO] `spec/5-system/3-error-handling.md` TOKEN_INVALID 설명 확장 — plan 범위 내

- target 위치: `spec/5-system/3-error-handling.md` TOKEN_INVALID 행
- 관련 plan: `plan/complete/auth-refresh-rotation-atomic.md` (`spec_impact: spec/5-system/3-error-handling.md` 명시)
- 상세: TOKEN_INVALID 에러 코드의 설명에 "refresh 회전 시 조건부 revoke 매칭 0건(동시 회전 경합)" 사용처를 추가한 것은 plan frontmatter 에 `spec/5-system/3-error-handling.md` 가 `spec_impact` 로 명시되어 있어 범위 내다. 다른 plan 이 이 에러 코드를 변경하는 중인 worktree는 발견되지 않았다.
- 제안: 없음.

### [INFO] `refactor/05-database.md` 의 다른 spec 갱신 요구 항목들은 미처리 상태 — 본 변경과 무관

- target 위치: `plan/in-progress/refactor/05-database.md` C-2, C-3 등
- 관련 plan: `plan/in-progress/refactor/05-database.md` (C-2: `data-flow/2-auth.md` 아님 — `13-replay-rerun.md §9.1`, C-3: `1-data-model.md §3`)
- 상세: C-2 (`re_run_of walk → 재귀 CTE`, `13-replay-rerun.md §9.1` 갱신 필요) 및 C-3 (`node_execution 인덱스`, `1-data-model.md §3` + `data-flow/3-execution.md` 갱신 필요) 가 미착수이나, 이들은 `spec/data-flow/2-auth.md` 와 무관하다. 본 변경이 이 항목들의 착수 조건을 변경하거나 무효화하지 않는다.
- 제안: 없음.

### [INFO] `spec-sync-auth-gaps.md` 추적 항목(LDAP/SAML)과 비충돌 확인

- target 위치: `spec/data-flow/2-auth.md §2.3 외부 > "셀프 호스팅은 LDAP/SAML 추가 가능"` 언급
- 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` (§1.3 LDAP/Active Directory 및 SAML 2.0 미구현 추적)
- 상세: target 이 LDAP/SAML을 구현했거나 결정을 내리지 않았다. `spec/data-flow/2-auth.md` 는 기존 main 브랜치 텍스트에 있던 `OAuth provider ... 셀프 호스팅은 LDAP/SAML 추가 가능` 문구를 건드리지 않았고, 본 변경이 해당 미구현 항목을 해소하거나 충돌하지 않는다.
- 제안: 없음.

---

## Worktree 충돌 후보 분석

### 충돌 후보 1: `unified-model-mgmt-5af7ee` — `spec/5-system/1-auth.md` 동시 수정

target 변경 파일(`spec/data-flow/2-auth.md`, `spec/5-system/3-error-handling.md`)과 `unified-model-mgmt-5af7ee` 의 변경 파일(`spec/5-system/1-auth.md`)은 **다른 파일**이다. `unified-model-mgmt-5af7ee` 는 `spec/data-flow/2-auth.md` 를 변경하지 않는다. 직접 파일 충돌 없음 — CRITICAL 미해당.

단, `spec/data-flow/2-auth.md` 는 `spec/5-system/1-auth.md` 를 cross-reference한다. `unified-model-mgmt-5af7ee` 가 `1-auth.md §3.2` 권한 표에서 `LLM Config`/`Rerank Config` → `Model Config` 로 통합하고 있으나, `data-flow/2-auth.md` 는 이 권한 표를 직접 재인용하지 않는다(2-auth.md 의 본문은 Token/Session 흐름만 다루고 RBAC 표를 포함하지 않는다). 내용 정합성 영향 없음.

### Stale 판정 cascade 결과

충돌 후보 3개 worktree 전부 stale 판정 cascade 를 적용:

**1. `claude/auth-refresh-rotation-atomic` (본 worktree)**
- Step 1: `git merge-base --is-ancestor` → exit 1 (ACTIVE)
- Step 2: `gh pr list --head claude/auth-refresh-rotation-atomic` → 결과 empty
- 판정: Step 3 fallback — active 로 처리. 단, PR 미생성 상태이므로 push 후 PR 생성 대기 중임.

**2. `claude/ai-node-override-fields`**
- Step 1: exit 1 (ACTIVE)
- Step 2: `gh pr list --head claude/ai-node-override-fields` → 결과 empty
- 판정: Step 3 fallback — active 처리. `spec/data-flow/2-auth.md` 를 변경하지 않으므로 worktree 충돌 후보에서 제외.

**3. `claude/unified-model-mgmt-5af7ee`**
- Step 1: exit 1 (ACTIVE)
- Step 2: `gh pr list --head claude/unified-model-mgmt-5af7ee` → 결과 empty
- 판정: Step 3 fallback — active 처리. `spec/data-flow/2-auth.md` 를 변경하지 않으므로 직접 충돌 없음 (위 §충돌 후보 1 분석 참조).

---

## Stale 으로 skip 한 worktree (의무)

0건. worktree 충돌 후보 3건 모두 stale 판정 cascade Step 1(ancestor 검사) 음성, Step 2(PR state) 응답 empty 로 Step 3 fallback — active 로 처리됨. stale skip 없음.

---

## 요약

target(`spec/data-flow/2-auth.md`, `spec/5-system/3-error-handling.md`)은 `plan/in-progress/refactor/05-database.md` C-1 이 권고한 옵션 A(refresh 토큰 회전 원자화)를 계획대로 이행한 결과이며, plan 이 명시한 spec 갱신 범위(`data-flow/2-auth.md §1.4 트랜잭션 박스`)를 정확히 반영한다. plan 이 "결정 필요"로 남겨둔 항목을 일방적으로 번복하는 변경은 없고, 다른 진행 중 plan 이 동일 파일(`spec/data-flow/2-auth.md`, `spec/5-system/3-error-handling.md`)을 수정하는 worktree도 없다. 3개 active worktree 모두 stale 판정 cascade 에서 Step 1/2 음성으로 Step 3 fallback active 처리되었으나, 실제 파일 중복은 없어 CRITICAL 해당 없음. worktree 충돌 후보 3건 중 stale skip 0건, active 3건 분석.

## 위험도

NONE

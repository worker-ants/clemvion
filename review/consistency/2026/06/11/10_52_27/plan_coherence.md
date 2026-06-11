# Plan 정합성 검토 결과

검토 범위: `spec/5-system/` (구현 완료 후 검토, diff-base=origin/main)
Target plan: `plan/in-progress/prod-fail-closed-guards.md` (worktree `prod-fail-closed-guards`)

---

## 발견사항

- **[WARNING]** `spec/5-system/1-auth.md` 동시 수정 — `unified-model-mgmt-5af7ee` 워크트리와 경합
  - target 위치: `spec/5-system/1-auth.md §3.2` (RBAC 매트릭스) · `§4.1` (감사 로그)
  - 관련 plan: `plan/in-progress/unified-model-management.md` (worktree `claude/unified-model-mgmt-5af7ee` — ACTIVE, Step 1 ancestor check: exit 1)
  - 상세: `prod-fail-closed-guards` 는 `spec/5-system/1-auth.md` 에 §2.1 JWT_SECRET production fail-closed 노트 + Rationale "Production fail-closed 가드" 섹션을 추가한다. `unified-model-mgmt-5af7ee` 는 동일 파일의 §3.2 RBAC 매트릭스에서 `LLM Config` / `Rerank Config` 두 행을 `Model Config` 단일 행으로 교체하고 §4.1 감사 로그 열에서 `llm_config.*` / `rerank_config.*` 를 `model_config.*` 로 대체한다. 두 워크트리의 변경 위치(§2.1+Rationale vs §3.2+§4.1)는 서로 다른 섹션이어서 내용 충돌은 없으나, `git merge` 시 두 브랜치가 동일 파일을 수정해 merge conflict 또는 검토 누락(한쪽 적용 후 다른쪽이 base 없이 rebase)이 발생할 수 있다.
  - 제안: 두 PR 중 먼저 머지된 쪽을 base 삼아 후발 PR 이 rebase 후 diff 재확인. 내용 충돌은 없으나 머지 순서를 조율하고 `unified-model-mgmt` 측 PR description 에 "1-auth.md 도 동시 수정 중인 PR(prod-fail-closed-guards) 와 충돌 확인 필요" 를 명시 권장.

- **[INFO]** `plan/in-progress/security-jwt-secret-fallback.md` 이미 complete 이동 확인
  - target 위치: `prod-fail-closed-guards.md` 체크리스트 첫 번째 항목 "security-jwt-secret-fallback.md superseded→complete"
  - 관련 plan: `plan/complete/security-jwt-secret-fallback.md` (status=superseded)
  - 상세: target plan 이 설명하는 대로 `security-jwt-secret-fallback.md` 는 이미 `plan/complete/` 로 이동돼 `status: superseded` 처리됐다. 불일치 없음, 추적 메모.

- **[INFO]** `plan/in-progress/auth-config-webhook-followups.md` 의 `secret-store.md §3.3` 후속 항목과의 도메인 구분
  - target 위치: `spec/conventions/secret-store.md §3.3` (prod-fail-closed-guards 수정)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` 35번 줄 ("ENCRYPTION_KEY 다도메인 재사용 위험. 중기 도메인별 키 분리 또는 HKDF 파생 검토 메모")
  - 상세: `auth-config-webhook-followups.md` 는 `secret-store.md §3.3` 에 "ENCRYPTION_KEY 다도메인 재사용 위험" 메모 추가를 미착수 후속으로 남겨뒀다. `prod-fail-closed-guards` 는 동일 §3.3 에 production 부팅 가드 문구를 추가한다 — 두 항목은 주제가 다르고(키 분리 검토 vs 부팅 가드) 직접 충돌하지 않는다. 단, `auth-config-webhook-followups.md` 가 착수될 때 §3.3 이 이미 수정된 상태임을 인지하고 올바른 위치에 삽입해야 한다.
  - 제안: `auth-config-webhook-followups.md` 에 "§3.3 은 prod-fail-closed-guards PR 이 부팅 가드 설명을 추가했으므로, 착수 시 갱신된 §3.3 을 base 로 사용" 메모 추가 권장. 긴급하지 않음.

- **[INFO]** `rag-rerank-followup.md` 가 `spec/5-system/1-auth.md §3.2·§4.1` 을 "[x] 완료" 로 표기하지만 `unified-model-mgmt-5af7ee` 브랜치가 해당 섹션을 재작성 중
  - target 위치: 해당 없음 (prod-fail-closed-guards 가 §3.2/§4.1 미수정)
  - 관련 plan: `plan/in-progress/rag-rerank-followup.md` (worktree: `rag-rerank-impl`) — Step 1 ancestor: ACTIVE, PR: 없음
  - 상세: `rag-rerank-followup.md` 는 §3.2 `Rerank Config` 행 추가·§4.1 `rerank_config.*` 감사 로그 추가를 [x] 체크 상태로 기록했다. 그런데 `unified-model-mgmt-5af7ee` 는 이를 `Model Config` 로 통합하는 방향으로 §3.2·§4.1 을 재작성한다. `prod-fail-closed-guards` 는 이 두 섹션을 건드리지 않으므로 본 PR 의 직접 충돌은 없다. 다만 `rag-rerank-impl` 과 `unified-model-mgmt-5af7ee` 간에 §3.2/§4.1 경합 문제가 별도로 존재한다. 이는 plan-coherence 관점 INFO 메모만 남기며 prod-fail-closed-guards 를 BLOCK 할 사항이 아님.

---

## 미해결 결정 충돌 검토

- `spec-sync-auth-gaps.md` 는 §1.3 LDAP/SAML 미구현을 추적하며 `worktree: (unstarted)` 상태다. `prod-fail-closed-guards` 는 §1.3 에 접촉하지 않아 충돌 없다.
- `spec-sync-mcp-client-gaps.md` 는 `spec/5-system/11-mcp-client.md` §3.3/§6.2/§8.2 미구현 항목을 추적한다. `prod-fail-closed-guards` 는 동 spec 에 `MCP_ALLOW_INSECURE_URL` production throw 내용을 추가하는데, 이는 미구현 surface 가 아닌 부팅 가드 추가이므로 `spec-sync-mcp-client-gaps.md` 의 미해결 결정과 직접 충돌하지 않는다.
- `security-backlog-invitation-token-hash.md` 는 `spec/5-system/1-auth.md §1.5.D` 에 대해 "착수 시 spec 결정 위임 먼저" 를 명시하고 있으나, `prod-fail-closed-guards` 는 §1.5.D 에 접촉하지 않는다. 충돌 없음.
- `refactor/04-security.md` 의 C-1/M-4/M-7 은 `prod-fail-closed-guards` 가 완료로 체크 처리했다. 나머지 미결(C-2, C-3, M-2, M-3 등)은 본 target 과 무관한 별도 항목이다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정 cascade 로 skip 된 항목:

- `audit-coverage-naming` (branch `claude/audit-coverage-naming`) — Step 1 ancestor check: exit 0 → **STALE**. main 에 포함된 non-squash 머지 브랜치.
- `exec-history-structure-ff390e` (branch `claude/exec-history-structure-ff390e`) — Step 1 ancestor check: exit 0 → **STALE**. 동일.

해당 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`prod-fail-closed-guards` (target) 는 `spec/5-system/1-auth.md`·`spec/5-system/11-mcp-client.md`·`spec/conventions/secret-store.md`·`spec/5-system/7-llm-client.md`·`spec/5-system/14-external-interaction-api.md` 를 수정한다. 미해결 결정 우회·선행 plan 미해소·내용 충돌은 없다. 단, `claude/unified-model-mgmt-5af7ee` 브랜치(ACTIVE)가 동일 `spec/5-system/1-auth.md` 를 §3.2/§4.1 에서 동시에 수정 중이어서 merge 순서 조율이 필요한 WARNING 이 1건 존재한다. 내용 자체의 의미 충돌은 없으나 git merge conflict 위험이 있다. worktree 충돌 후보 7건 중 stale 2건(audit-coverage-naming, exec-history-structure-ff390e) skip, active 5건 분석 — 그 중 spec 파일 직접 경합은 unified-model-mgmt-5af7ee 의 `1-auth.md` 1건.

---

## 위험도

LOW

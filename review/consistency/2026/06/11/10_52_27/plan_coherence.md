# Plan 정합성 검토 결과

**검토 모드**: 구현 완료 후 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
**Target worktree**: `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`)
**검토 일시**: 2026-06-11

---

## 발견사항

### **[WARNING]** `spec/5-system/1-auth.md` 동시 수정 — `claude/unified-model-mgmt-5af7ee` active worktree 와 머지 순서 경합 (내용 충돌 아님)

- **target 위치**: `spec/5-system/1-auth.md` — prod-fail-closed-guards 가 §2.1 테이블 바로 아래 `JWT_SECRET` production fail-closed 노트 삽입 + Rationale "Production fail-closed 가드" 섹션 신규 추가
- **관련 plan**: `claude/unified-model-mgmt-5af7ee` worktree (PR 미생성, Step 1 ACTIVE, Step 2 empty → Step 3 fallback → active)
- **상세**: `claude/unified-model-mgmt-5af7ee` 가 동일 파일 §3.2 권한 매트릭스의 `LLM Config` / `Rerank Config` 행을 `Model Config` 단일 행으로 교체하고 Editor CRUD 근거 blockquote 추가. `prod-fail-closed-guards` 는 같은 파일의 §2.1 + 파일 끝 Rationale 섹션을 수정.
- **hunk 범위 실측 (git diff origin/main...<branch> -- 1-auth.md)**: prod-fail-closed-guards = `@244–256` (§2.1) + `@550–575` (Rationale, 파일 끝). unified-model-mgmt-5af7ee = `@312–357` (§3.2). **두 변경 영역은 겹치지 않는다** — PR C 의 §2.1 hunk(244–256)는 sibling hunk(312~)보다 56줄 앞, PR C 의 Rationale hunk(550–575)는 sibling hunk(~357)보다 183줄 뒤. git 3-way merge 가 자동 병합하며 **content/semantic conflict 없음** (BLOCK 사유 아님 — Critical = 기능·API·요구사항 ID 충돌이며 본 건은 git 기계적 순서 위험에 불과). 분류 근거: 자동 checker 가 hunk 좌표를 계산하지 않고 "같은 파일 + 양쪽 PR 미생성" 만으로 Critical 후보를 올렸으나, 실측 좌표가 비중첩임을 main 이 검증해 WARNING 으로 확정.
- **stale 판정**: Step 1 exit 1 → ACTIVE (`git merge-base --is-ancestor` exit 1 재확인됨).
- **머지 우선순위**: `prod-fail-closed-guards` 만 PR(#539) 보유, sibling 은 PR 미생성 → PR C 가 먼저 머지되는 게 자연스러운 직렬화. 이후 `unified-model-mgmt-5af7ee` 가 rebase 시 비중첩이라 conflict 없이 흡수된다.
- **제안**: PR C 먼저 머지 → sibling rebase. PR #539 본문에 본 경합/우선순위 명시(완료).

---

### **[WARNING]** `spec/5-system/1-auth.md` 동시 수정 — `claude/audit-coverage-naming` active worktree 와 머지 순서 경합 (내용 충돌 아님)

- **target 위치**: `spec/5-system/1-auth.md`
- **관련 plan**: `claude/audit-coverage-naming` worktree (PR 미생성, Step 1 ACTIVE, Step 2 empty → Step 3 fallback → active)
- **상세**: `claude/audit-coverage-naming` 가 동일 파일 §4.1 기록 대상 액션 표를 개편(Action naming 규약 블록 + 구현 액션 표 교체). `prod-fail-closed-guards` 는 같은 파일의 §2.1 + 파일 끝 Rationale 섹션을 수정.
- **hunk 범위 실측**: audit-coverage-naming = `@339–367` (§4.1). prod-fail-closed-guards = `@244–256` + `@550–575`. **비중첩** — PR C §2.1 hunk(244–256)는 sibling(339~) 앞, PR C Rationale hunk(550–575)는 sibling(~367) 뒤. git 3-way 자동 병합, content conflict 없음. (직전 10_17_44 실행은 본 worktree 를 STALE 로 오판했으나, `git merge-base --is-ancestor claude/audit-coverage-naming origin/main` = exit 1 로 **active 가 사실** — 본 실행이 정정. 단 경합의 성격은 비중첩 git 순서 위험이라 WARNING.)
- **머지 우선순위**: sibling 은 PR 미생성, PR C 는 #539 보유 → PR C 우선 머지 후 sibling rebase 로 흡수.
- **제안**: PR C 먼저 머지 → sibling rebase. PR #539 본문에 명시(완료).

---

### **[WARNING]** `security-jwt-secret-fallback.md` supersede — plan 의 "결정 포인트 합의" 항목 PR 반영 확인 필요

- **target 위치**: `plan/in-progress/prod-fail-closed-guards.md` 체크리스트 "security-jwt-secret-fallback.md superseded→complete"
- **관련 plan**: `plan/in-progress/security-jwt-secret-fallback.md` (main HEAD 기준 in-progress, status: backlog)
- **상세**: `security-jwt-secret-fallback.md` 는 "결정 포인트(프로덕션 부팅 거부 여부)는 운영 영향이 있어 사용자/운영 합의 필요" 를 명시하고 있다. `prod-fail-closed-guards` 는 이 결정을 완료로 처리하고 해당 plan 을 `plan/complete/` 로 이동한다. PR 가 아직 main 에 머지되지 않은 상태라 main 기준으로는 이 결정이 아직 열려 있다. PR 본문에 "security-jwt-secret-fallback.md 의 프로덕션 부팅 거부 결정을 본 PR 에서 수행함" 이 명시되어 있는지 확인 권장.
- **제안**: PR 설명에 해당 결정 완료 내용 명시. 머지 후 `plan/in-progress/security-jwt-secret-fallback.md` 가 자동으로 `complete/` 로 이동됨을 확인.

---

### **[WARNING]** `spec/conventions/secret-store.md §3.3` 갱신 완결성 — M-4 spec 갱신 요건 충족 여부

- **target 위치**: `plan/in-progress/prod-fail-closed-guards.md` 체크리스트 — `spec/conventions/secret-store.md §3.3` 갱신 포함
- **관련 plan**: `plan/in-progress/refactor/04-security.md` M-4 — "spec 갱신: secret-store.md 에 '예시는 placeholder, 실값은 운영자 생성' + 거부 가드 기술 (planner)"
- **상세**: `prod-fail-closed-guards` 의 plan 파일에는 `spec/conventions/secret-store.md §3.3` 갱신이 체크리스트에 포함되어 있다. target 문서 범위(`spec/5-system/`)에 `secret-store.md` 는 포함되지 않아 본 검토 대상 외이나, M-4 의 spec 갱신 요건이 단일 PR 에서 누락되면 04-security 백로그가 부분 마감 상태가 된다. `git diff main..claude/prod-fail-closed-guards -- spec/conventions/secret-store.md` 로 실제 변경 여부 확인 권장.
- **제안**: secret-store.md §3.3 갱신이 포함됐는지 확인. 누락 시 04-security M-4 를 "impl 완료, spec 갱신 후속" 으로 표기하고 별도 planner 작업으로 분리.

---

### **[INFO]** `spec-sync-mcp-client-gaps.md` — `spec/5-system/11-mcp-client.md` 갱신 인지 필요

- **target 위치**: `spec/5-system/11-mcp-client.md` §3.2 — prod-fail-closed-guards 가 MCP_ALLOW_INSECURE_URL production throw + ALLOW_PRIVATE_HOST_TARGETS warn 분리 내용 추가
- **관련 plan**: `plan/in-progress/spec-sync-mcp-client-gaps.md` (`pending_plans` 에 `spec/5-system/11-mcp-client.md` 등재)
- **상세**: `spec-sync-mcp-client-gaps.md` 는 동 spec 파일의 미구현 surface(§3.3 cached_capabilities, §6.2 외부 mcpDiagnostics 등)를 추적한다. prod-fail-closed-guards 가 §3.2 에 production 가드 문구를 추가하는 것은 미구현 surface 가 아닌 별개 보안 정책이므로 plan 의 미해결 결정과 직접 충돌하지 않는다. 단, 해당 plan 착수 시 §3.2 가 이미 갱신된 상태임을 인지하고 기준 파일을 재확인해야 한다.
- **제안**: `spec-sync-mcp-client-gaps.md` 의 담당자에게 prod-fail-closed-guards 머지 후 §3.2 변경 내용 인지 전달.

---

### **[INFO]** `auth-config-webhook-followups.md` §3 secret-store.md §3.3 후속 항목 — 착수 시 base 파일 확인

- **target 위치**: `spec/conventions/secret-store.md §3.3` (prod-fail-closed-guards 수정)
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md` §3 — "ENCRYPTION_KEY 다도메인 재사용 위험. 중기 도메인별 키 분리 또는 HKDF 파생 검토 메모"
- **상세**: 두 항목은 주제가 다르고(키 분리 검토 vs 부팅 가드) 직접 충돌하지 않는다. `auth-config-webhook-followups.md` 착수 시 §3.3 이 이미 prod-fail-closed-guards PR 로 수정된 상태이므로 올바른 위치에 삽입해야 한다.
- **제안**: `auth-config-webhook-followups.md` 에 "§3.3 은 prod-fail-closed-guards PR 이 부팅 가드 설명을 추가했으므로 착수 시 갱신된 §3.3 을 base 로 사용" 메모 추가 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정 cascade 로 skip 된 항목:

- `exec-history-structure-ff390e` (branch `claude/exec-history-structure-ff390e`) — Step 1 ancestor (commit 230a0fba 가 main 의 조상 확인) → **stale**. `spec/5-system/` 미수정이어서 경합 후보도 아니었으나 stale 확정.
- `auth-refresh-rotation-atomic` (branch `claude/auth-refresh-rotation-atomic`) — Step 1 ACTIVE, Step 2 PR #537 state=MERGED → **stale** (squash merge). `spec/5-system/1-auth.md` 수정을 포함했으나 PR #537 이 이미 MERGED 이므로 경합 아님.
- `ai-node-override-fields` (branch `claude/ai-node-override-fields`) — Step 1 ACTIVE, Step 2 PR #536 state=MERGED → **stale** (squash merge). `spec/5-system/` 미수정.

위 3개 worktree 가 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`prod-fail-closed-guards` 의 target 변경(spec/5-system/1-auth.md, spec/5-system/11-mcp-client.md, spec/5-system/7-llm-client.md, spec/5-system/14-external-interaction-api.md)은 plan 에서 결정된 C-1·M-4·M-7 항목을 명확히 이행하며 미해결 결정 우회·선행 plan 미해소·후속 항목 의미 충돌은 없다. `spec/5-system/1-auth.md` 를 동시 편집 중인 active worktree 2개(`claude/unified-model-mgmt-5af7ee`, `claude/audit-coverage-naming`)가 존재하나, **hunk 좌표 실측 결과 PR C 의 변경 영역(§2.1 @244–256, Rationale @550–575)이 sibling 영역(@312–367)과 비중첩**이어서 git 3-way merge 가 자동 병합한다 — content/semantic conflict 없음. 따라서 BLOCK 사유(Critical = 기능·API·요구사항 ID 충돌)가 아닌 머지 순서 조율 WARNING 2건으로 분류한다(PR C 만 PR #539 보유 → 우선 머지). `security-jwt-secret-fallback.md` 의 합의 결정 문서화 완결성과 `secret-store.md §3.3` spec 갱신 여부는 WARNING 2건. worktree 충돌 후보 중 stale 3건(PR #537 MERGED, PR #536 MERGED, Step 1 ancestor 1건) skip.

> **분류 정정 메모**: 자동 plan-coherence checker 는 hunk 좌표를 계산하지 않고 "같은 파일 + 양쪽 PR 미생성" 만으로 두 경합을 Critical 후보로 올렸다. main 이 `git diff origin/main...<branch> -- spec/5-system/1-auth.md` 의 `@@` 좌표를 실측해 비중첩(50~183줄 간격)을 확인, WARNING 으로 확정했다. BLOCK: NO.

---

## 위험도

LOW

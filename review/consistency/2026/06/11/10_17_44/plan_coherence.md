## 발견사항

### [WARNING] spec/5-system/1-auth.md 동시 편집 — 병합 충돌 위험 (비-stale active worktree)
- **target 위치**: `spec/5-system/1-auth.md` §2.1 (JWT_SECRET production fail-closed 노트 삽입)
- **관련 plan**: `plan/in-progress/` 미등재 — `unified-model-mgmt-5af7ee` worktree(branch `claude/unified-model-mgmt-5af7ee`)가 동일 파일을 수정 중
- **상세**: `prod-fail-closed-guards`(본 target)는 `spec/5-system/1-auth.md §2.1` 에 JWT_SECRET fail-closed 노트 9줄을 삽입한다. `unified-model-mgmt-5af7ee` 는 동일 파일의 §3.2 권한 매트릭스(`LLM Config/Rerank Config` → `Model Config` 행 교체), §4.1 감사 로그 행 교체, Rationale `1.5.D` 추가 등 더 넓은 범위를 수정한다. 두 브랜치가 동일 파일을 서로 다른 섹션에서 병렬로 수정 중이므로 머지 시 충돌 가능성 존재. 단, 변경 위치가 §2.1(target)과 §3.2·§4.1·Rationale(unified-model)로 달라 의미 충돌(결정 우회)은 없고 라인 충돌 수준이다.
- **제안**: `prod-fail-closed-guards` 를 먼저 머지 후 `unified-model-mgmt-5af7ee` 가 리베이스하거나, PR 머지 순서를 조율해 충돌을 해소한다. 두 PR 리뷰어에게 동일 파일 병렬 편집 사실을 PR 본문에 명시 권장.

---

### [WARNING] spec/5-system/7-llm-client.md 동시 편집 — 병합 충돌 위험 (비-stale active worktree)
- **target 위치**: `spec/5-system/7-llm-client.md` §7.2 LLM_STUB_MODE 프로덕션 차단 설명 1줄 수정
- **관련 plan**: `unified-model-mgmt-5af7ee` worktree(branch `claude/unified-model-mgmt-5af7ee`)가 동일 파일의 §2~§4 전반(LLMConfig→ModelConfig 용어 교체, 리랭크 프로바이더 설명 수정 등)을 수정 중
- **상세**: `prod-fail-closed-guards` 는 §7.2 의 "프로덕션 차단" 설명 문장에서 `main.ts` 직접 가드 → `assertProductionConfig` 로 문구를 수정한다. `unified-model-mgmt-5af7ee` 는 같은 파일의 §2~§4 에서 `LLMConfig`/`RerankConfig` → `ModelConfig` 용어 전환 패치를 수행한다. 두 변경이 다른 줄에 있어 의미 충돌은 없으나 라인 충돌 또는 context overlap 가능성이 있다.
- **제안**: 동일 파일 동시 편집임을 양 PR 에 명시. `prod-fail-closed-guards` 가 먼저 머지 시 `unified-model-mgmt-5af7ee` 리베이스 필요.

---

### [INFO] 선행 plan 의존성 — spec/5-system/14-external-interaction-api.md 참조 일관성
- **target 위치**: `spec/5-system/1-auth.md §2.1` 에 삽입된 노트: `INTERACTION_JWT_SECRET 은 별도 서비스 생성자 throw 로 유지`
- **관련 plan**: `plan/in-progress/spec-sync-auth-gaps.md` (spec/5-system/1-auth.md 추적), `plan/in-progress/spec-sync-mcp-client-gaps.md` (spec/5-system/11-mcp-client.md 추적)
- **상세**: target이 `14-external-interaction-api.md #83-token-일반-규약` 에 cross-link를 걸고 있는데, `14-external-interaction-api.md` 는 target 브랜치에서도 수정됨(`spec/5-system/14-external-interaction-api.md` 변경 목록에 포함). 링크 대상이 같은 PR에서 같이 패치되므로 정합성 문제 없음. 단, `spec-sync-auth-gaps.md` 가 추적하는 LDAP/SAML 미구현 항목은 본 변경과 무관함을 확인 — 충돌 없음.
- **제안**: 추적 메모만. 별도 액션 불필요.

---

### [INFO] 후속 항목 — refactor/04-security.md C-1·M-4·M-7 완료 표기와 plan 상태 정합
- **target 위치**: `plan/in-progress/prod-fail-closed-guards.md` 체크리스트
- **관련 plan**: `plan/in-progress/refactor/04-security.md` C-1·M-4·M-7 (✅ 완료 표기됨)
- **상세**: `refactor/04-security.md` 는 C-1·M-4·M-7 항목에 이미 `✅ 완료 (2026-06-11, worktree prod-fail-closed-guards)` 를 기록했다. `prod-fail-closed-guards.md` 체크리스트는 `/ai-review + fix` 및 `/consistency-check --impl-done BLOCK: NO` 가 미완([ ])으로 남아있다. PR 머지 전 두 단계가 완료돼야 plan-lifecycle 규약상 `complete/` 이동 조건이 충족된다. 현재 상태는 정상 진행 중이며 정합성 결함은 아님.
- **제안**: 현행 체크리스트 순서대로 진행. `--impl-done` 후 `complete/` 이동.

---

### [INFO] spec/conventions/secret-store.md 동시 편집 — 다른 active worktree 없음 확인
- **target 위치**: `spec/conventions/secret-store.md` §3.3 수정
- **관련 plan**: 다른 active worktree 중 이 파일을 수정하는 브랜치 없음 확인
- **상세**: `audit-coverage-naming` 은 stale(Step 1 ancestor 통과), `ai-node-override-fields` 는 `spec/2-navigation`, `spec/3-workflow-editor` 만 수정, `auth-refresh-rotation-atomic` 은 `spec/5-system/3-error-handling.md`, `spec/data-flow/2-auth.md` 만 수정. `secret-store.md` 충돌 없음.
- **제안**: 추적 메모만.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip된 항목:

- `audit-coverage-naming` (branch `claude/audit-coverage-naming`) — Step 1: `git merge-base --is-ancestor` exit 0 → STALE (branch HEAD 가 origin/main 의 조상). 해당 worktree가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`prod-fail-closed-guards` target은 `spec/5-system/1-auth.md`(§2.1), `spec/5-system/11-mcp-client.md`(§3.2), `spec/5-system/7-llm-client.md`(§7.2), `spec/5-system/14-external-interaction-api.md`, `spec/conventions/secret-store.md` 5개 파일을 수정한다. 미해결 결정 우회나 선행 plan 미해소 충돌은 없다. 주요 리스크는 `unified-model-mgmt-5af7ee`(active) 가 `spec/5-system/1-auth.md` 및 `spec/5-system/7-llm-client.md` 를 동시에 수정하는 병렬 편집으로, 의미 충돌이 아닌 라인 충돌 수준의 WARNING 2건이다. 기타 `auth-refresh-rotation-atomic`(active) 은 다른 spec 파일(`3-error-handling.md`, `data-flow/2-auth.md`)만 수정해 교집합 없음. stale skip 1건(`audit-coverage-naming`, Step 1 ancestor 확인).

## 위험도

LOW

# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target 범위: `spec/4-nodes/4-integration/`
검토 worktree: `cafe24-allowlist-ui` (branch `claude/cafe24-allowlist-ui`)
검토 시각: 2026-06-02

---

## 발견사항

### [CRITICAL] `spec/4-nodes/4-integration/4-cafe24.md` 동시 편집 경합

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §8.3` (AI Agent allowlist UI 스펙 — `cafe24-restricted-scopes-followups.md §1` 의 구현 대상)
- **관련 plan**: `plan/in-progress/cafe24-restricted-scopes-followups.md §1` + `plan/in-progress/cafe24-backlog-residual.md`
- **상세**: branch `claude/cafe24-install-ratelimit-2891d1` (active, 6 commits ahead of main, PR 없음) 가 `spec/4-nodes/4-integration/4-cafe24.md §9.8` 에 rate-limiting 명세를 추가한 상태로 열려 있다. 동일 파일은 `cafe24-followups-bundle` (PR #415 OPEN) 에도 포함돼 있으며 `cafe24-install-ratelimit-2891d1` 을 ancestor 로 흡수한 aggregating PR 이다. `cafe24-allowlist-ui` 가 `spec/4-nodes/4-integration/4-cafe24.md §8.3` 을 편집하면 PR #415 또는 별도 ratelimit PR 과의 merge conflict 발생 위험이 있다.
  - `cafe24-install-ratelimit-2891d1`: `spec/4-nodes/4-integration/4-cafe24.md` 변경 (§9.8 rate-limiting note 삽입, 환경변수 표 2행 추가)
  - `cafe24-followups-bundle` (PR #415): 동일 diff 포함 (ancestor merge)
  - 두 branch 모두 Step 1 (ancestor) / Step 2 (GitHub PR state) 로 active 판정
- **제안**: `cafe24-allowlist-ui` 착수 전 PR #415 (`cafe24-followups-bundle`) 머지 완료 또는 이 branch 들이 `4-cafe24.md` 를 건드린 커밋이 main 에 반영된 후 rebase 하거나, §8.3 편집이 필요할 경우 PR #415 와 조율해 편집 충돌 없는 순서(직렬화)로 진행한다.

---

### [WARNING] `node-output-redesign` Plan P2 항목 — `spec/4-nodes/4-integration/4-cafe24.md` 의 `cursor?: string` 잔재 미해소

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §1` (`pagination` 표의 `cursor?: string` 문구 — schema 에서는 이미 폐기됨)
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` Phase E P2 항목 "Cafe24 §1 pagination `cursor?: string` spec 정정"; `plan/in-progress/node-output-redesign/cafe24.md §"구현 분석" 항목 2` ("spec 본문은 cursor 를 여전히 언급하지만 schema 에서 제거됨")
- **상세**: `node-output-redesign` plan 이 Phase E P2 로 `spec/4-nodes/4-integration/4-cafe24.md §1` 의 `cursor?: string` spec 정정을 예약해두었다. `cafe24-allowlist-ui` 가 `spec/4-nodes/4-integration/4-cafe24.md` 를 편집할 때 이 항목을 모르고 지나치면, 별도 Phase E 착수 시 동일 파일의 §1 을 다시 건드리게 된다 (중복 PR 위험). 즉각 착수 차단은 아니나 `cafe24-allowlist-ui` 편집 시 §1 cursor 잔재를 함께 정정하거나, 정정을 Phase E 로 남길 것을 plan 에 명시해야 한다.
- **제안**: `cafe24-allowlist-ui` 작업 시 `spec/4-nodes/4-integration/4-cafe24.md` 를 편집한다면, `node-output-redesign/README.md` Phase E P2 "Cafe24 §1 cursor 정정" 체크박스를 함께 처리하거나 — 또는 이 worktree 의 spec 편집 범위를 §8.3 에 한정하고 P2 는 별도 PR 로 예약함을 plan 에 명시한다.

---

### [WARNING] `cafe24-restricted-scopes-followups.md §1` — worktree 미할당 상태로 착수

- **target 위치**: `plan/in-progress/cafe24-restricted-scopes-followups.md` frontmatter `worktree: TBD (per-item)`
- **관련 plan**: `cafe24-restricted-scopes-followups.md §1` (AI Agent allowlist UI)
- **상세**: 현재 plan frontmatter 의 `worktree` 가 `TBD (per-item)` 이다. `cafe24-allowlist-ui` worktree 가 §1 을 담당하는 것으로 보이나 plan 본문에 명시되지 않았다. 다른 개발자가 같은 §1 을 다른 worktree 에서 착수하는 중복 착수 위험이 있다.
- **제안**: `cafe24-restricted-scopes-followups.md` 의 `§1` 헤더 아래 `worktree: cafe24-allowlist-ui` 를 명시하고, frontmatter 의 `worktree: TBD` 를 `cafe24-allowlist-ui` 로 갱신한다.

---

### [INFO] `cafe24-backlog-residual.md` A-2 nginx 마스킹 — 미해결 결정, target 과 무관

- **target 위치**: `plan/in-progress/cafe24-backlog-residual.md` A-2 항목
- **상세**: A-2 는 nginx 로그 마스킹 정책으로 코드 변경 없고 `spec/4-nodes/4-integration/` 범위 외. target 구현에 직접 영향 없음. 추적 메모.

---

### [INFO] `node-output-redesign` P3 — `spec/4-nodes/4-integration/1-http-request.md` `output.response: { error }` legacy 잔재

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §5.3.2`
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` Phase E P3 항목 "HTTP transport-failed envelope 의 `output.response: { error }` legacy 잔재 제거"
- **상세**: target 범위(`spec/4-nodes/4-integration/`) 에 포함된 `1-http-request.md` 에 Phase E P3 미처리 항목이 있다. `cafe24-allowlist-ui` 의 impl-prep 범위가 `http-request` 까지 포함한다면, 이 잔재가 구현에 영향을 줄 수 있음을 인지해야 한다. `cafe24-allowlist-ui` 가 http-request 파일을 직접 수정할 계획은 없으나, 현 spec 에 transport 실패 시 `output.response: { error }` 와 `output.error` 가 공존하는 점은 기존에 deprecation-noted 된 내용이다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 CRITICAL 분류에서 제외한 항목:

- `cafe24-allowlist-ui` (branch `claude/cafe24-allowlist-ui`) — Step 1: `git merge-base --is-ancestor` → **STALE** (HEAD 45fb3155 가 main 의 HEAD 와 동일, 아직 커밋 없음). 단, 이 worktree 는 현재 작업 대상이므로 stale skip 이 아닌 작업 중 상태. 참고용 기록.
- `ai-agent-emit-facade-277556` (branch `claude/ai-agent-emit-facade-277556`) — Step 1: ancestor 검사 → **STALE** (commits ahead of main: 0). Step 2 해당 branch 의 PR 없음(empty). `spec/4-nodes/4-integration/` 과 무관한 ai-agent emit 관련 branch. CRITICAL 분류 제외.

해당 stale worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/4-nodes/4-integration/` 를 대상으로 한 impl-prep 정합성 검토 결과, 가장 중요한 위험은 **`spec/4-nodes/4-integration/4-cafe24.md` 동시 편집 경합**이다. branch `claude/cafe24-install-ratelimit-2891d1` (PR #415 `cafe24-followups-bundle` 에 흡수된 active branch) 가 이미 동일 파일의 §9.8 을 수정한 상태로 열려 있어, `cafe24-allowlist-ui` 가 §8.3 을 편집할 경우 merge conflict 가 불가피하다. 이 branch 들이 main 에 반영되기 전 착수를 시도하면 rebase 비용이 발생한다. 추가로 `node-output-redesign` Phase E P2 로 예약된 `4-cafe24.md §1` `cursor?: string` 잔재 정정과 본 worktree 의 편집이 겹칠 수 있어 중복 PR 위험이 있다. plan frontmatter 의 `worktree: TBD` 미갱신 문제도 병렬 착수 충돌 예방을 위해 즉시 수정해야 한다. worktree 충돌 후보 중 stale 판정 skip: `ai-agent-emit-facade-277556` (commits ahead of main 0, spec/4-nodes/4-integration/ 무관) 1건, `cafe24-allowlist-ui` 자체(커밋 없음) 1건 — 실질적 active worktree 경합은 `cafe24-install-ratelimit-2891d1` / `cafe24-followups-bundle` (PR #415) 2건 분석.

---

## 위험도

**HIGH**

PR #415 (`cafe24-followups-bundle`) 머지 전 `cafe24-allowlist-ui` 에서 `spec/4-nodes/4-integration/4-cafe24.md` 를 편집하면 merge conflict 가 확실시된다. 착수 전 PR #415 의 main 반영 또는 편집 범위 조율이 선행되어야 한다.

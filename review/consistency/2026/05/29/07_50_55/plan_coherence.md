# Plan 정합성 검토 — spec-draft-mail-send-status

대상: `plan/in-progress/spec-draft-mail-send-status.md`  
검토일: 2026-05-29  
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

- **[INFO]** node-output-redesign/send-email.md 미해결 TODO 와의 관계 명시 부재
  - target 위치: 변경 4 — `spec/4-nodes/4-integration/3-send-email.md §4 실행 로직` 및 §5.3 추가
  - 관련 plan: `plan/in-progress/node-output-redesign/send-email.md` — 3건의 미해결 개선 권고 (`EMAIL_NO_RECIPIENTS` P1 spec/impl 이동, `port:'out'` 명시 여부, 부분 거부 테스트)
  - 상세: node-output-redesign/send-email.md 는 `spec/4-nodes/4-integration/3-send-email.md` 를 동일 대상으로 삼고 있으며, 세 항목이 `[ ]` (미완) 상태다. target plan 의 변경 4 는 §4·§5.3·§81 에 `EMAIL_HOST_BLOCKED` 행을 추가하며 이 항목들과 섹션이 겹친다. 충돌하는 결정은 아니지만, 향후 node-output-redesign 이 3-send-email.md 를 수정할 때 target plan 의 변경과 충돌하지 않도록 상호 참조가 필요하다.
  - 제안: target plan 에 "node-output-redesign/send-email.md 의 잔여 P1 권고(EMAIL_NO_RECIPIENTS 이동·port echo·부분 거부 테스트)는 본 변경 4 와 섹션 중첩. 본 변경 완료 후 node-output-redesign 에서 3-send-email.md 수정 시 SSRF 행 누락 없이 반영 필요" 한 줄 주석 추가 권장. node-output-redesign 쪽에도 "spec-draft-mail-send-status 변경 4 기준으로 3-send-email.md §4·§5.3 갱신됨" 을 기록하면 drift 방지.

- **[INFO]** `spec-harness-impl-coverage.md` 의 frontmatter 검사 의무와 target plan 의 "frontmatter 제외" 처리 — 명시적 근거는 충분
  - target 위치: §side-effect 점검 결과 "frontmatter status/code (item D) 본 draft 범위 제외"
  - 관련 plan: `plan/in-progress/spec-harness-impl-coverage.md` — 결정 D (partial-implementation discipline), 후속 plan 목록에 `spec-frontmatter-rollout.md` 포함
  - 상세: spec-harness 는 spec 신규/대규모 변경 시 frontmatter `code:`/`status:`/`pending_plans:` 갱신을 의무로 정의한다. target plan 은 이를 명시적으로 "별도 grooming plan(spec-frontmatter-rollout.md)에 위임" 한다고 기술했다. spec-frontmatter-rollout.md 는 `plan/complete/` 에 이미 이동되어 있으므로 해당 plan 이 처리 완료된 것이나, 4-integration.md 의 frontmatter 갱신 자체는 아직 진행 중인 별도 작업의 몫임을 확인. target 의 scope 분리 결정은 spec-harness 결정 D 와 충돌하지 않는다 — harness 는 "plan/in-progress 등록 + 해당 spec frontmatter 에 pending_plans 포함" 방식을 허용하기 때문이다.
  - 제안: 현 상태로 적합. target plan 의 Rationale 에 "4-integration.md·3-send-email.md 의 frontmatter status 갱신은 spec-impl-evidence.md §6 의 grooming 흐름에 위임됨" 이 이미 명시되어 있으므로 추가 조치 불요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `spec-update-ai-error-output-fields-594d0a` (branch `claude/spec-update-ai-error-output-fields-594d0a`) — Step 1: ACTIVE (squash merge, hash 변경), Step 2: PR #346 MERGED. `spec/2-navigation/2-trigger-list.md`, `spec/5-system/12-webhook.md`, `spec/4-nodes/3-ai/` 등 변경 포함. target plan 이 손대는 4개 spec 파일(4-integration.md / 3-error-handling.md / 3-send-email.md / 1-http-request.md)은 없음 — 충돌 후보 아님, stale skip.
- `w4-cidr-ipwhitelist-a829b8` (branch `claude/w4-cidr-ipwhitelist-a829b8`) — Step 1: ACTIVE (squash), Step 2: PR #348 MERGED. target plan 대상 파일과 교집합 없음 — stale skip.
- `eia-jti-tracking-7e68c5` (branch `claude/eia-jti-tracking-7e68c5`) — Step 2: PR #345 MERGED — stale skip.
- `llm-model-select-followup-refactor-4a3d96` (branch `claude/llm-model-select-followup-refactor-4a3d96`) — Step 2: PR #345 (shared batch MERGED) — stale skip.
- `docs-mobile-sidebar-complete-8659c2` (branch `claude/docs-mobile-sidebar-complete-8659c2`) — Step 2: PR #344 MERGED — stale skip.
- `triggers-auth-column-a80393` (branch `claude/triggers-auth-column-a80393`) — Step 1: ancestor of origin/main (0 commits ahead) — stale skip.

**비-충돌 후보로 확인된 active worktree:**
- `chat-channel-form-native-modal-c021b9` (branch `claude/chat-channel-form-native-modal-c021b9`) — Step 1: ACTIVE, Step 2: PR 없음, Step 3 fallback: active. 변경 파일 중 target plan 의 4개 spec 파일 없음 — 충돌 없음.

worktree 충돌 후보 7건 중 stale 6건 skip, active 1건 분석 (충돌 없음 확인).

stale 으로 skip 된 6개 worktree 가 `.claude/worktrees/` 에 잔존한다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec-draft-mail-send-status.md` 는 Plan 정합성 관점에서 이상 없다. 목표 spec 파일 4종(spec/2-navigation/4-integration.md, spec/5-system/3-error-handling.md, spec/4-nodes/4-integration/3-send-email.md, spec/4-nodes/4-integration/1-http-request.md)을 손대는 다른 active worktree 는 존재하지 않으며, 미해결 결정 우회도 발견되지 않았다. 선행 plan(spec-harness-impl-coverage, spec-frontmatter-rollout)의 frontmatter 의무는 target plan 이 명시적으로 별도 grooming 흐름에 위임하여 기술했고 이는 harness 결정 D 와 충돌하지 않는다. 유일한 주의 사항은 node-output-redesign/send-email.md 가 동일 파일(3-send-email.md)에 미해결 P1 권고를 보유하고 있어 이후 작업 시 target 변경 4 내용을 선반영 기준으로 삼아야 한다는 점이다 (INFO 등급). worktree 충돌 후보 7건 중 stale 6건 skip, active 1건은 대상 파일과 교집합 없음으로 CRITICAL 없음.

---

## 위험도

LOW

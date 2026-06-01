## 발견사항

### [WARNING] eia-sdk-publish.md §결정 #3 미기록 — target spec 이 존재하지 않는 결정을 인용
- target 위치: `spec/7-channel-web-chat/2-sdk.md` 상단 callout 박스 및 `## Rationale §R2`
  - `> **npm scope 확정**: 패키지명은 @workflow/web-chat — eia-sdk-publish.md §결정 #3 에서 @workflow/sdk 와 일관되게 @workflow/* 로 통일(2026-06-02).`
- 관련 plan: `plan/in-progress/eia-sdk-publish.md` §"사용자 결정 사항" #3 (Package scope)
- 상세: `eia-sdk-publish.md` 는 Package scope 결정 #3 을 여전히 옵션 나열 상태(`(a) @workflow/sdk / (b) @clemvion/sdk`)로 두고 있으며 "§결정 #3" 섹션이 존재하지 않는다. target spec 은 이 미결 결정이 `@workflow/web-chat` 로 확정된 것처럼 인용한다. 실제로 worktree `channel-web-chat-followups-1feff2` 커밋 `e64d84be` 에서 코드 레벨 결정이 이루어졌으나 `eia-sdk-publish.md` 에 반영되지 않았다.
- 제안: `eia-sdk-publish.md` 에 §결정 기록 절을 추가해 결정 #1 (publish 시점), #2 (registry: internal-only), #3 (scope: `@workflow/*`, `@workflow/web-chat`) 을 기록. target spec 인용이 plan 내 추적 가능한 결정을 가리키도록 정합화.

---

### [WARNING] channel-web-chat-followups.md / channel-web-chat-impl.md frontmatter worktree 필드가 삭제된 branch 를 가리킴
- target 위치: target spec 에 직접 기재되지 않음 (plan frontmatter 자체 문제, worktree 충돌 판정에 간접 영향)
- 관련 plan: `plan/in-progress/channel-web-chat-followups.md` line 2, `plan/in-progress/channel-web-chat-impl.md` line 2
- 상세: 두 plan 모두 `worktree: .claude/worktrees/channel-web-chat-spec-3b22b3` 를 기재하고 있으나 해당 branch 는 로컬/원격 모두 존재하지 않는다 (Step 1 명령 실패, Step 2 empty — Step 3 fallback 결과 stale 처리). 실제 active worktree 는 `channel-web-chat-followups-1feff2` (branch `claude/channel-web-chat-followups-1feff2`, main 대비 2커밋 앞). frontmatter 불일치로 향후 plan coherence / stale 판정 cascade 가 혼선을 빚을 수 있다.
- 제안: 두 plan 의 frontmatter `worktree` 필드를 `.claude/worktrees/channel-web-chat-followups-1feff2` 로 갱신. developer 권한 범위 내 수정 가능.

---

### [INFO] channel-web-chat-followups.md main branch 본문이 stale — 항목 7-b 완료 미반영
- target 위치: `spec/7-channel-web-chat/2-sdk.md` §1 (data-global), §3 (wc:resize), §5 (on() Unsubscribe / off())
- 관련 plan: `plan/in-progress/channel-web-chat-followups.md` §7-b (라인 39-43, main branch 기준 [ ] 열림)
- 상세: main branch 의 plan 파일은 §7-b 3항목을 `[ ]` 미완으로 기록하나, worktree `channel-web-chat-followups-1feff2` 의 커밋 `258afc65` 에서 구현 완료했고 target spec 도 명문화 완료. prompt_file 내 plan snapshot 에는 `✅ 완료 (2026-06-02, C-2)` 반영됨. PR 머지 전 정상 과도 상태이나, spec 이 완료 확정인데 plan main branch 가 미완으로 남아있는 불일치는 추적 목적상 기록.
- 제안: PR 머지 후 `channel-web-chat-followups.md` 에서 완료 항목 정리 또는 plan split(완료 항목 → complete/, 미완 항목 #1~#6 잔류).

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보: `channel-web-chat-spec-3b22b3` (plan frontmatter 기재 worktree)

- `channel-web-chat-spec-3b22b3` (branch `channel-web-chat-spec-3b22b3`) — Step 1: branch 부재로 `git merge-base --is-ancestor` 실패, Step 2: `gh pr list --head channel-web-chat-spec-3b22b3` empty, Step 3 fallback 적용. 단, `git branch --all` 에도 없고 `git worktree list` 에도 없어 branch 자체가 삭제됨 — 사실상 stale. §5 CRITICAL 대상에서 제외.

worktree 충돌 후보 1건 중 stale 1건 skip, active 충돌 0건 분석.

파일시스템에 `.claude/worktrees/channel-web-chat-spec-3b22b3` 디렉토리가 잔존한다면 `git worktree prune` 또는 `./cleanup-worktree-all.sh --yes --force` 로 정리 권장.

---

## 요약

target spec `spec/7-channel-web-chat/2-sdk.md` 는 channel-web-chat plan 과 전반적으로 정합하며 구현 완료된 내용(wc:resize, on()/off() unsubscribe, data-global 충돌 방지, @workflow/web-chat scope) 을 충실히 반영했다. 세 가지 갭이 있다: (1) `eia-sdk-publish.md §결정 #3` 이 실제로 기록되지 않아 spec 인용이 비실체적 레퍼런스를 가리킴 (WARNING — plan 갱신 필요), (2) channel-web-chat 두 plan 의 frontmatter worktree 필드가 삭제된 branch 를 가리킴 (WARNING — frontmatter 갱신 필요), (3) main branch plan 파일이 현재 worktree 완료 반영본보다 stale (INFO — PR 머지 후 정리). worktree 충돌 후보 1건 중 stale 1건 skip, active 충돌 0건.

---

## 위험도

LOW

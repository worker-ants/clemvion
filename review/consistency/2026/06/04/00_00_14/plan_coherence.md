## 발견사항

### [CRITICAL] kb-quality-fba2f2 worktree 와 동일 spec 파일 동시 편집 (active worktree 충돌)
- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §10 단락(line ~141), §11.4 링크(line ~213); `spec/4-nodes/3-ai/1-ai-agent.md` §4.1·§6.2 링크(여러 행)
- **관련 plan**: `plan/in-progress/` — 물리 worktree `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`)
- **상세**: kb-quality-fba2f2 worktree 는 "spec in-body 링크 무결성 build 가드 + 깨진 링크 110건 전수 청소" 작업으로 `spec/4-nodes/3-ai/0-common.md` 와 `spec/4-nodes/3-ai/1-ai-agent.md` 의 URL 앵커를 수정한다(예: `#23-v1-적용-범위-push-vs-inject-구분` → `#23-적용-범위-push-vs-inject-구분`, `#62-제공-변수` → `#62-저장-전략` 등 다수). 동시에 target(ai-context-memory-9c7e6e) worktree 는 동일 파일의 **같은 단락 범위**를 의미적으로 재작성한다(§10 memoryStrategy 행 추가·단락 수정, §11.4 ordering 표 확장). 두 브랜치 모두 GitHub PR 없이 ACTIVE(Step 1 non-ancestor, Step 2 empty → Step 3 conservative fallback). 직접 라인 충돌 발생 지점:
  - `0-common.md` line ~141: kb-quality 는 기존 §10 단락의 앵커 fragment 를 수정; target 은 같은 단락을 전면 교체(memoryStrategy 언급 추가).
  - `0-common.md` line ~213: kb-quality 는 `#5-실행-로직` → `#5-출력-구조` 로 앵커 수정; target 은 §11.4 ordering 표를 확장해 해당 줄 위치 이동.
  - `1-ai-agent.md` 여러 행: kb-quality 가 fragment 변경한 줄들이 target 의 §6.2/§7.5 주석과 겹침.
  두 브랜치를 순서 무관하게 병합하면 merge conflict 또는 잘못된 앵커가 남을 수 있다.
- **제안**: 두 worktree 의 작업을 직렬화한다. 선행 권장 순서: ai-context-memory-9c7e6e 를 먼저 PR → 머지, 이후 kb-quality-fba2f2 가 업스트림 변경분을 rebase 해 앵커 재검증 후 머지. 또는 kb-quality-fba2f2 의 anchor-fix 패치를 ai-context-memory-9c7e6e 브랜치에 cherry-pick/integrate 하여 단일 PR 로 통합.

---

### [WARNING] target spec 의 TC·IE frontmatter 가 main 과 달리 stale pending_plans 참조 포함
- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` frontmatter (`pending_plans: [spec-sync-text-classifier-gaps.md]`); `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter (`pending_plans: [spec-sync-information-extractor-gaps.md]`)
- **관련 plan**: `plan/complete/spec-sync-text-classifier-gaps.md`, `plan/complete/spec-sync-information-extractor-gaps.md` (commit `70afc8da` 에서 `in-progress` → `complete` 이동, PR #450 — main 기준)
- **상세**: ai-context-memory-9c7e6e 브랜치는 main 보다 4 커밋 뒤에서 분기되었다. 그 이후 main 에서 PR #450 이 TC·IE spec-sync 를 완료 처리해 관련 plan 을 `complete/` 로 이동하고 spec frontmatter 를 `status: implemented`(pending_plans 없음)로 갱신했다. 그러나 target worktree 는 해당 커밋들을 포함하기 전 상태라 TC·IE spec 에 이미 완료된 plan 을 `pending_plans` 로 참조하고 `status: partial` 로 표기한다. 이 상태에서 target 을 PR 로 제출하면 plan lifecycle 게이트(spec frontmatter validator)가 존재하지 않는 in-progress plan 을 참조하는 오류를 낼 수 있다.
- **제안**: PR 제출 전 `git rebase origin/main` (또는 merge) 을 실행해 최신 main 을 포함시킨다. rebase 후 2-text-classifier.md·3-information-extractor.md 의 `status: implemented` + pending_plans 삭제가 자동 포함된다. rebase conflict 발생 시 TC·IE 파일은 main 쪽을 기준으로 수용하고(이미 implemented), ai-context-memory 가 추가한 0-common.md·1-ai-agent.md 변경만 유지한다.

---

### [WARNING] node-output-redesign/ai-agent.md 의 pending 구현 항목이 target spec 으로 해결되지 않음 (impl 갭 미등록)
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.3(single-turn error 포트), §7.5(resumed transient), §7.4(config echo 통일)
- **관련 plan**: `plan/in-progress/node-output-redesign/ai-agent.md` — 미완 impl 항목: `executeSingleTurn` try/catch 미구현(CRITICAL 등급), `status: 'resumed'` transient emit 미구현, config echo 불일치
- **상세**: `node-output-redesign/ai-agent.md` 는 ai-agent 단일 실행 경로의 LLM 오류 시 `port: 'error'` 라우팅이 미구현이라고 명시(`llmService.chat` throw 시 engine FAILED 로만 처리 — line ~208 CRITICAL 항목)한다. target spec(§7.3/§7.9)은 에러 구조를 정의하지만, target worktree 의 `ai-agent.handler.ts` 를 확인한 결과 `executeSingleTurn` 의 `llmService.chat` 호출(line ~1551)에 `try/catch` 가 없다. 즉 target spec 은 에러 케이스를 명세했으나 구현 갭은 이 worktree 에서 해소되지 않았다. target plan(`ai-context-memory-auto.md`) 이 Phase G REVIEW 를 완료 표기했음에도 이 impl 갭이 후속 항목으로 plan 에 등록되지 않았다.
- **제안**: `ai-context-memory-auto.md` 또는 `ai-context-memory-followup-v2.md` 에 "ai-agent single-turn `executeSingleTurn` try/catch + error 포트 라우팅 구현 (node-output-redesign P0 연계)" 항목을 추가하거나, `node-output-redesign/ai-agent.md` 의 해당 `[ ]` 항목에 이 worktree 에서 미해소임을 명시한다.

---

### [INFO] ai-context-memory-9c7e6e 브랜치에 GitHub PR 없음 — stale 판정 불가 (Step 3 fallback)
- **target 위치**: worktree `ai-context-memory-9c7e6e` (branch `claude/ai-context-memory-9c7e6e`)
- **관련 plan**: `plan/in-progress/ai-context-memory-auto.md` Phase G 완료 표기 (2026-06-03)
- **상세**: `ai-context-memory-auto.md` Phase G (REVIEW 완료)가 체크됐음에도 GitHub PR 이 존재하지 않는다 (Step 1 non-ancestor, Step 2 empty). stale cascade Step 1/2 모두 음성 → Step 3 active 로 처리. 실제로 stale 이라면(이미 direct push 또는 다른 경로로 main 반영) cleanup 후 재검토 권장.
- **제안**: PR 을 생성하거나, 이미 main 에 직접 반영됐다면 `./cleanup-worktree-all.sh --yes --force` 실행 후 이 worktree 정리.

---

### [INFO] ai-agent-tool-connection-rewrite.md 의 5개 TBD 결정 — target spec 과 비충돌 확인
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 / §4 Tool Area 박스
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §결정 기록 (도구 등록 모델·시그니처·실행 컨텍스트·결과 라우팅·ND-AG-21 전부 TBD)
- **상세**: target spec 은 Tool Area 관련 내용을 모두 "재작성 예정 (현재 제거됨)" 경고 박스로 유지하고 있어 TBD 결정을 일방적으로 확정하지 않는다. 충돌 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR MERGED
- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 2 PR MERGED
- `feat-web-chat-demo` (branch `claude/feat-web-chat-demo`) — Step 2 PR MERGED
- `workflow-turn-timing-69fee2` (branch `claude/workflow-turn-timing-69fee2`) — Step 2 PR MERGED
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 2 PR MERGED (다수 PR)
- `spec-inprogress-impl2` (branch `claude/spec-inprogress-impl2`) — Step 1 ancestor STALE

해당 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

worktree 충돌 후보 7건 중 stale 6건 skip, active 2건(`ai-context-memory-9c7e6e`, `kb-quality-fba2f2`) 분석.

---

## 요약

`spec/4-nodes/3-ai/` 대상 구현 완료 후 검토 결과, **가장 중요한 문제는 `kb-quality-fba2f2` active worktree 와의 동일 spec 파일 동시 편집 충돌(CRITICAL)** 이다. 두 브랜치가 `0-common.md` §10 단락과 `1-ai-agent.md` §6.2/§7.5 참조 링크를 각각 의미 재작성(target)과 anchor 수정(kb-quality)으로 동시에 편집하므로 직렬화가 필요하다. 부가적으로 브랜치가 main 보다 4커밋 뒤져 TC·IE spec frontmatter 에 이미 완료된 plan 이 stale 참조로 남아 있다(WARNING). single-turn 오류 포트 구현 갭도 followup plan 에 후속 항목으로 등록되지 않아 누락이다(WARNING). worktree 충돌 후보 7건 중 stale 6건 skip, active 2건 분석.

---

## 위험도

CRITICAL

STATUS: OK

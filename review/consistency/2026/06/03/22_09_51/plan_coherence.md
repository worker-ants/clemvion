# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)  
Target: `spec/` (branch `claude/spec-inprogress-impl2`, worktree `spec-inprogress-groom-c7568b`)  
검토 기준일: 2026-06-03

---

## 발견사항

### [WARNING] spec-sync-structural-followups 의 "스킵" 결정을 target 이 번복

- **target 위치**: `spec/4-nodes/0-overview.md` — 파일 최상단에 신규 YAML frontmatter 추가 (`id: nodes-overview`, `status: partial`, `pending_plans: [marketplace-and-plugin-sdk.md]`)
- **관련 plan**: `plan/in-progress/spec-sync-structural-followups.md` §A 구조 정규화 처리 결과
  > "4-nodes/0-overview.md frontmatter — 스킵 — basename `0-overview.md` 는 spec-impl-evidence 가드 면제 대상이라 의무 아님. 추적성 이득 대비 가치 낮아 보류."
- **상세**: `spec-sync-structural-followups` 는 이 frontmatter 추가를 명시적으로 보류(사용자 결정으로 문서화)했다. Target 은 동일 파일에 frontmatter 를 추가하되 목적이 다르다(`pending_plans` 등록 = marketplace-and-plugin-sdk 연결). 두 변경의 이유가 다르고 spec-impl-evidence 가드 면제는 여전히 성립하므로 CRITICAL 은 아니나, 명시적 보류 결정이 존재하는 항목을 Plan 갱신 없이 번복한 점이 WARNING 수준의 불일치다.
- **제안**: `spec-sync-structural-followups.md §A` 의 해당 항목을 "[x] — frontmatter 추가 완료 (spec-inprogress-impl2)" 로 flip 하거나, 혹은 "보류 유지이나 marketplace pending_plans 는 0-overview.md 에 등록함" 으로 주석 갱신하여 결정 이유를 명시한다.

---

### [WARNING] active worktree 와 spec 파일 동시 수정 — ai-context-memory-9c7e6e

- **target 위치**: 아래 4개 spec 파일이 현재 worktree와 `ai-context-memory-9c7e6e` worktree 양쪽에서 수정 중
  - `spec/4-nodes/0-overview.md` — target: frontmatter 추가, ai-context-memory: §1.4.1 filter DSL 섹션 제거
  - `spec/5-system/4-execution-engine.md` — target: `$itemIsFirst`/`$itemIsLast` 추가(line ~541), ai-context-memory: `_contextKey` 기술 변경(line ~642)
  - `spec/5-system/5-expression-language.md` — target: `$itemIsFirst`/`$itemIsLast` 행 추가(line ~178), ai-context-memory: `$thread` 자동완성 note 변경(line ~212)
  - `spec/5-system/8-embedding-pipeline.md` — target: frontmatter `status: partial→implemented` + metadata 행 변경(line ~144), ai-context-memory: CSV 청킹 섹션 변경(line ~94)
- **관련 plan**: `ai-context-memory-9c7e6e` worktree 의 `plan/in-progress/ai-context-memory-auto.md` (worktree 내부에만 존재, main 미머지)
- **상세**: 양 worktree 가 동일 spec 파일을 수정한다. 각 변경은 **서로 다른 줄**에 닿으므로 내용 자체의 충돌은 없으나, 두 worktree 중 먼저 머지되는 쪽이 두 번째 쪽에 **3-way merge conflict** 를 발생시킬 가능성이 있다. 특히 `spec/4-nodes/0-overview.md` 와 `spec/5-system/8-embedding-pipeline.md` 는 ai-context-memory 가 본문을, target 이 frontmatter 를 건드려 conflict-free merge 가 보장되지 않는다.  
  **stale 판정 cascade**: ai-context-memory-9c7e6e 브랜치는 Step 1 ancestor 검사에서 ACTIVE, Step 2 GitHub PR 조회 결과 empty(PR 없음) → Step 3 보수적 fallback ACTIVE 처리.
- **제안**: 머지 순서를 조율하거나(이 worktree 먼저 머지 후 ai-context-memory rebase), 머지 시점에 두 파일을 수동 3-way merge 로 처리한다. `spec/5-system/8-embedding-pipeline.md` 의 경우 target 이 `status: implemented` 로 승격하고 ai-context-memory 는 본문만 수정하므로, 두 변경을 합산한 최종본이 논리적으로 일관하는지 확인이 필요하다.

---

### [WARNING] active worktree 와 spec 파일 동시 수정 — makeshop-api-catalog-730deb

- **target 위치**: 아래 5개 spec 파일이 현재 worktree 와 `makeshop-api-catalog-730deb` worktree 양쪽에서 수정 중
  - `spec/4-nodes/0-overview.md` — target: frontmatter 추가, makeshop: §1.4.1 filter DSL 제거 + §2.4 절 수정
  - `spec/4-nodes/4-integration/0-common.md` — target: db-query/send-email summaryTemplate 상태 갱신, makeshop: MakeShop 행 추가 + "Integration 4종" → "5종" 서술 변경
  - `spec/5-system/4-execution-engine.md` — target: `$itemIsFirst`/`$itemIsLast`(line ~541), makeshop: 미확인 변경 포함
  - `spec/5-system/5-expression-language.md` — target: `$itemIsFirst`/`$itemIsLast`(line ~178), makeshop: `$thread` note 변경(line ~212)
  - `spec/5-system/8-embedding-pipeline.md` — target: frontmatter + metadata 행, makeshop: 미확인 포함
- **관련 plan**: `makeshop-api-catalog-730deb` worktree 내 `plan/in-progress/makeshop-integration.md` (main 미머지)
- **상세**: `spec/4-nodes/4-integration/0-common.md` 의 경우 target 이 "Integration 4종" 행 서술을 `Database Query/Send Email` 요약으로 업데이트하고, makeshop 이 같은 파일에 "MakeShop" 을 5번째 Integration 으로 추가한다. 두 변경 모두 §5 summaryTemplate 표에 영향을 주며, makeshop 이 먼저 머지되면 target 이 추가한 `downscope 근거` 주석이 makeshop 의 MakeShop 행과 함께 처리되어야 한다. `spec/4-nodes/0-overview.md` 는 ai-context-memory 와 동일하게 양쪽이 §1.4.1 제거를 수행하므로 idempotent 이지만, target 의 frontmatter 추가와 겹치는 변경이 된다.  
  **stale 판정 cascade**: makeshop-api-catalog-730deb 브랜치는 Step 1 ACTIVE, Step 2 PR empty → Step 3 보수적 fallback ACTIVE 처리.
- **제안**: makeshop 과 이 target 의 머지 순서를 조율한다. `0-common.md` 에서 target 이 완성한 summaryTemplate 상태 표와 makeshop 이 추가할 MakeShop 행이 최종적으로 일관하는지 검토한다. 특히 target 이 추가한 `downscope 근거` 주석이 MakeShop 행 추가 후에도 올바른 위치에 남는지 확인한다.

---

### [INFO] spec-sync-integration-common-gaps — "결정 필요" 항목을 target 이 inline 결정으로 처리

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 summaryTemplate 표, `plan/in-progress/spec-sync-integration-common-gaps.md`
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` §"⚠ 재분류 (2026-06-03 groom)"
  > "send-email: 결정 필요(downscope vs DSL 확장)"
- **상세**: 계획 파일 본문에는 "decision-free 아님 → planner 결정 필요" 표기가 있었으나, target 은 동일 커밋에서 plan 을 `[x]` 로 완료 처리하면서 downscope 결정을 inline 으로 문서화했다 (plan 파일 내 `[x] ... downscope: 배열 슬라이스/조건 카운트 미지원으로 ... 수신자 수 + 제목`). 별도 합의 절차 없이 plan 내에서 결정을 완결한 구조다. Minor 이므로 INFO 처리. "결정 필요" 주석 자체는 plan 의 `⚠ 재분류` 섹션에 여전히 남아 있어 문서가 일부 inconsistent 한 인상을 준다.
- **제안**: `plan/in-progress/spec-sync-integration-common-gaps.md` 의 `⚠ 재분류` 섹션을 갱신하여 "send-email 은 2026-06-03 downscope 로 결정 완료" 주석을 추가해 문서 내 불일치를 해소한다.

---

### [INFO] spec-sync-expression-language-gaps — $trigger/$env 결정 미해소 항목은 그대로 유지

- **target 위치**: `spec/5-system/5-expression-language.md` §4 변수 표
- **관련 plan**: `plan/in-progress/spec-sync-expression-language-gaps.md`
  > `$trigger`/`$env` 런타임 주입: "결정 필요, decision-free 아님 → planner"
- **상세**: Target 은 `$itemIsFirst`/`$itemIsLast` 두 행을 추가한다(ForEach 항목 플래그). 이는 `spec-sync-expression-language-gaps.md` 에 명시된 결정 미해소 항목(`$trigger`/`$env`)과는 다른 변수이므로 충돌이 없다. 미해소 항목은 여전히 plan 에 `[ ]` 로 남아 있으며, target 이 이를 우회하지 않는다.
- **제안**: 조치 불요. 현황 추적용 기록.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1: ancestor 검사 NOT STALE(exit 1), Step 2: GitHub PR 상태 **MERGED** → **stale 확정**. 이 worktree 가 owner 로 등록된 plan 파일들(`spec-sync-expression-language-gaps.md`, `spec-sync-integration-common-gaps.md` 등 다수의 `worktree: spec-sync-audit` 파일)은 해당 worktree 가 이미 머지됐으므로 `worktree` 필드는 stale 정보다 — 파일 자체는 계속 main 의 `in-progress/` 에 존재하며 별개로 추적 중.

해당 worktree 가 여전히 물리 디렉토리에 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

Target(branch `claude/spec-inprogress-impl2`)은 `spec/` 전반에 걸쳐 구현 완료 후 frontmatter 상태 승격·summaryTemplate 동기화·ForEach 변수 표 추가 등을 수행한다. 주요 정합성 이슈는 두 가지다. 첫째, `plan/in-progress/spec-sync-structural-followups.md` 가 명시적으로 "스킵" 결정한 `spec/4-nodes/0-overview.md` frontmatter 추가를 target 이 수행하여 plan 갱신이 누락된 상태다(WARNING). 둘째, `ai-context-memory-9c7e6e` 와 `makeshop-api-catalog-730deb` 두 active worktree 가 target 과 동일한 spec 파일(4~5개 공통)을 수정 중이어서 머지 시 3-way conflict 가능성이 있다(WARNING ×2). 미해소 결정 항목(`$trigger`/`$env`)은 target 이 건드리지 않으므로 충돌 없음. worktree 충돌 후보 3건 중 stale 1건(spec-sync-audit, PR MERGED) skip, active 2건(ai-context-memory, makeshop) 분석.

---

## 위험도

**MEDIUM**

(active worktree 2개와의 동시 spec 수정 + plan 결정 번복 미문서화. 코드 충돌이 아닌 spec merge conflict 위험이며, 단방향 전파 차단이나 기능 손상은 아님)

STATUS: OK

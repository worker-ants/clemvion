# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope=`spec/conventions/spec-impl-evidence.md`, diff-base=`origin/main`)
검토 일시: 2026-06-04
Target branch: `claude/kb-quality-fba2f2`

---

## 발견사항

### [WARNING] Gate C 구현이 `spec-drift-gates.md` 의 "보류" 상태와 겉보기 충돌

- **target 위치**: `knowledge-base-quality-improvements.md` §item 7 + `spec/conventions/spec-impl-evidence.md` §4(Gate C `spec-plan-completion.test.ts`)
- **관련 plan**: `plan/in-progress/spec-drift-gates.md` §C — "plan 완료 시 spec 정합 결정 강제 (보류)" (미체크 항목 3개)
- **상세**: `spec-drift-gates.md` 는 Gate C 를 "보류" 로 명시하고 완료 조건 미충족 상태로 `in-progress` 에 잔류 중이다. kb-quality PR 은 `spec-plan-completion.test.ts` 로 Gate C 를 독자 구현하고 `spec-impl-evidence.md §4` 에 정식 등재했다. 그러나 `knowledge-base-quality-improvements.md §Rationale` 의 "Gate C/D 가 보류였던 이유와 재개" 절이 이 결정을 명시적으로 설명하고 있고, `spec-drift-gates.md` 자체의 §C 도 "착수 안 하기로 결정하면 본 plan 에 'C·D drop 결정' 명시 후 complete 이동 가능"이라고 재개 경로를 열어 두었다. 즉 kb-quality 가 Gate C 를 재개·구현한 것은 spec-drift-gates 의 "보류 → 재개 결정" 경로를 정당하게 밟은 것이다. **단, `spec-drift-gates.md` 의 §C 체크박스가 여전히 `[ ]` (미완) 상태이고 plan 이 `in-progress` 에 남아 있다.** kb-quality 머지 후에는 `spec-drift-gates.md` §C 완료 마킹 + plan 종료 처리가 필요하다.
- **제안**: kb-quality PR 머지 후 `plan/in-progress/spec-drift-gates.md` §C 항목을 `[x]` 처리하고, §D(Gate D)도 kb-quality 에서 advisory 구현 완료됐으므로 `[x]` 갱신. 완료 조건 충족 시 `plan/complete/` 이동. spec-drift-gates 의 현 worktree(`spec-drift-gates-b26bce`) PR 은 이미 MERGED — plan 파일만 갱신 필요.

---

### [CRITICAL] `ai-context-memory-9c7e6e` worktree 가 `spec/conventions/spec-impl-evidence.md` 를 동시 수정 (active)

- **target 위치**: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` + §1 제외 규칙 + §Rationale R-7
- **관련 plan**: `plan/in-progress/ai-context-memory-auto.md` (worktree `ai-context-memory-9c7e6e`)
- **상세**:
  - kb-quality 는 frontmatter `code:` 에 5개 파일을 추가하고 §4 에 Gate C/D 절을 신설한다.
  - `claude/ai-context-memory-9c7e6e` 는 동일 파일에서 (a) frontmatter `code:` 의 `spec-frontmatter-parse.ts`·`spec-frontmatter-parse.test.ts` 2개 항목을 **삭제**, (b) §1 제외 설명을 축약 재작성, (c) §Rationale R-7 전체를 **삭제**한다. 이 변경은 이미 main 에 머지된 `fix(docs-guard)` PR #453(commit `e79956ad`)이 추가한 R-7 과 CATALOG_FIELD_FILE 제외 로직을 실질적으로 되돌리는 내용이다.
  - ai-context-memory 브랜치의 merge-base 는 `66f4ffd9`(#449, spec-drift Gate A+B)로, #453 이 머지되기 **이전** 에 분기됐다. 브랜치가 최신 main 을 rebase/merge 하지 않은 채 이 삭제를 보유하고 있어, kb-quality 와 머지 시 `spec-impl-evidence.md` 에서 3-way conflict 가 발생한다.
  - 추가 위험: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` 에서도 `CATALOG_FIELD_FILE` 정규식 + `isApplicable` 제외 라인을 삭제해, 이미 해소된 444건 red 가 재발할 수 있다.
  - stale 판정: Step 1(ancestor check) NON-STALE, Step 2(PR state) empty(PR 없음) → **Step 3 fallback: ACTIVE** 처리.
- **제안**: `ai-context-memory-9c7e6e` 브랜치를 최신 `origin/main` 으로 rebase 또는 merge 한 뒤, `spec-impl-evidence.md` 와 `spec-frontmatter-parse.ts` 의 충돌을 해소(이미 머지된 R-7·CATALOG_FIELD_FILE 삭제 라인은 폐기). kb-quality PR 을 먼저 머지하는 경우, ai-context-memory PR 개설 전 반드시 최신 main 동기화 필요.

---

### [WARNING] `competitive-analysis-e0569b` worktree (OPEN PR #454) 도 `spec/conventions/spec-impl-evidence.md` 를 수정

- **target 위치**: `spec/conventions/spec-impl-evidence.md` §1 제외 설명 (3행)
- **관련 plan**: `plan/in-progress/competitive-analysis-e0569b` worktree 의 PR #454 ("docs(plan): n8n·Flowise·Dify·Langflow 대비 경쟁력 분석 리포트")
- **상세**: competitive-analysis PR 은 §1 제외 설명의 `basename 매칭` 주석·세부 설명을 축약 재작성한다(기능 변경 없음, 표현 정비). kb-quality 는 동일 §1 절에 변경을 가하지 않으나 파일 전체를 다루기 때문에 두 PR 이 순서 없이 머지되면 3-way conflict 발생 가능성이 있다. 충돌 범위는 §1 제외 설명 3행(wording only)이라 의미 충돌은 없고 수동 resolve 가 어렵지 않다.
- **제안**: kb-quality 와 competitive-analysis 중 하나를 먼저 머지한 뒤 나머지를 rebase. 또는 competitive-analysis PR 의 `spec-impl-evidence.md` 변경이 kb-quality 의 변경과 겹치지 않는다면 양쪽 diff 를 확인 후 순서 협의.

---

### [INFO] `plan/in-progress/fix-spec-frontmatter-catalog.md` 가 `in-progress` 에 잔류

- **target 위치**: `knowledge-base-quality-improvements.md` §item 2 — 이동 보류 이유 기록
- **관련 plan**: `plan/in-progress/fix-spec-frontmatter-catalog.md`
- **상세**: kb-quality §item 2 가 `fix-spec-frontmatter-catalog` 를 "별 doc 수정·표현 명확화·노트 추가 pre-existing follow-up 4건 문서화 → lifecycle §5 미해결 follow-up 보유로 in-progress 유지"로 보류했다. 해당 follow-up 4건(WARNING#1·#2·INFO#2·INFO#4)은 모두 non-blocking 문서/표현 정비다. INFO#4("background-context-key-followups §보류 의 본 항목 → 본 PR 완료 후 `[x]`/정리")는 이미 main PR #451 이 머지돼 해소 가능 상태다. 나머지 3건도 경미한 문서 개선이라 후속 plan 없이 단발 commit 으로 처리 가능하다.
- **제안**: `fix-spec-frontmatter-catalog.md` 의 follow-up 상태를 재확인하고, 잔여 항목이 모두 non-blocking 문서 정비라면 plan 을 `complete/` 로 이동 처리. 또는 kb-quality 범위에서 WARNING#2(§1 제외 표현 명확화) 를 함께 처리해 follow-up 목록을 소거 후 이동.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 제외된 항목:

- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2: PR MERGED
- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 2: PR MERGED
- `spec-drift-gates-b26bce` (branch `spec-drift-gates-b26bce`) — Step 2: PR MERGED

위 3개 worktree 는 이미 main 에 반영된 branch 다. 로컬 worktree 디렉토리가 남아 있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target(`spec/conventions/spec-impl-evidence.md`) 의 변경 내용은 `spec-drift-gates.md` Gate C/D "보류 → 재개" 경로를 정당하게 밟은 것으로, plan 결정과의 의미 충돌은 없다. 단, Gate C/D 구현 완료에 따라 `spec-drift-gates.md` 의 체크박스 갱신·plan 이동이 후속 처리로 필요하다(WARNING). 가장 큰 위험은 `ai-context-memory-9c7e6e` 가 main 동기화 없이 이미 머지된 R-7·CATALOG_FIELD_FILE 을 삭제하는 상태로 활성 상태라는 점(CRITICAL) — kb-quality 머지 전후 ai-context-memory 의 main rebase 를 강제해야 한다. `competitive-analysis-e0569b`(OPEN PR #454) 는 동일 파일의 표현만 변경해 머지 순서 조율로 해결 가능한 경미한 충돌이다(WARNING). worktree 충돌 후보 5건 중 stale 3건 skip, active 2건(`ai-context-memory-9c7e6e`·`competitive-analysis-e0569b`) 분석.

---

## 위험도

**HIGH**

(CRITICAL 1건: active worktree 의 동시 spec 수정이 이미 머지된 수정을 되돌릴 위험)

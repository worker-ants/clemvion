# Plan 정합성 검토 결과

검토 모드: --impl-done (scope=spec/, diff-base=origin/main)
대상 branch: claude/spec-inprogress-impl2 (worktree: spec-inprogress-groom-c7568b)

---

## 발견사항

### [CRITICAL] spec/conventions/spec-impl-evidence.md §1 제외 섹션 동시 수정

- **target 위치**: `spec/conventions/spec-impl-evidence.md` 라인 40-43 (`**제외**:` 헤더 + 기존 3개 불릿)
- **관련 plan**: `plan/in-progress/fix-spec-frontmatter-catalog.md` (worktree: `fix-spec-frontmatter-catalog`, PR #453 OPEN)
- **상세**: target branch 는 §1 제외 섹션 헤더를 "basename 매칭" 설명이 포함된 형태로 rewrite 하고 기존 2개 불릿을 확장했다 (`EXCLUDE_BASENAMES` 등재 명시). fix-spec-frontmatter-catalog branch(PR #453 OPEN) 는 같은 섹션 직후에 `spec/conventions/<name>-api-catalog/<resource>/**/*.md` 필드 카탈로그 제외 규칙(신규 불릿)과 `## Rationale R-7` 을 추가했다. 두 변경이 origin/main 의 동일 base(라인 40-45)를 각각 수정하고 있어 병합 시 conflict 가 발생한다. fix-spec-frontmatter-catalog 는 `spec-frontmatter-parse.ts` `isApplicable` 코드 변경도 동반한다.
- **제안**: target branch 를 main 에 머지하기 전에 fix-spec-frontmatter-catalog(PR #453) 를 먼저 머지하거나, target branch 가 §1 제외 섹션 재작성 시 `R-7` cafe24-api-catalog 제외 불릿도 함께 통합해야 한다. 둘 중 하나가 먼저 main 에 반영된 뒤 다른 쪽이 rebase 해야 conflict 가 없다.

---

### [WARNING] spec/4-nodes/4-integration/0-common.md 캔버스 요약 표 인접 행 경합

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약 표 — Database Query, Send Email 행 및 downscope 설명 주석
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` 추적 스코프와 별개로, `makeshop-api-catalog` branch (worktree: `makeshop-api-catalog-730deb`, PR 없음 — fallback ACTIVE) 가 동일 표에 MakeShop 행을 추가하면서 Database Query, Send Email 행을 원본("미구현 Planned") 값 그대로 두고 있다.
- **상세**: target branch 는 Database Query 행을 `{{queryType|upper}} · {{query}}` (구현됨)으로, Send Email 행을 `{{to.length}} recipients · {{subject}}` (구현됨)으로 갱신했다. makeshop branch 는 같은 표에 MakeShop 행을 삽입하되 Database Query/Send Email 행은 갱신 이전 값("미구현 Planned")을 그대로 유지하고 있다. 두 branch 가 병렬 상태에서 동일 테이블 행들을 서로 다른 값으로 두고 있어, 하나가 main 에 먼저 반영된 뒤 다른 쪽이 rebase 없이 머지되면 선행 변경이 롤백되거나 conflict 가 발생한다.
- **제안**: makeshop branch 가 main 에 머지되기 전에 target branch 를 먼저 main 에 반영(또는 makeshop branch 가 target 변경을 rebase)해야 한다. 순서: target → main → makeshop rebase. 또는 makeshop branch 가 Database Query/Send Email 행도 함께 최신화하도록 업데이트한다.

---

### [WARNING] spec-sync-integration-common-gaps 미해결 결정: Missing Integration 배지

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약 > `> **계획 (미구현)**:` 주석
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` — `⚠ Missing integration` 배지(§5) 항목이 "티어3 (cross-entity 검증 — warningRule DSL 밖, 아키텍처 결정 필요, 보류)"로 남아있다
- **상세**: target branch 는 Database Query/Send Email summaryTemplate 을 구현·반영하면서 Missing integration 배지 항목을 "티어3 보류" 로 spec 에 명시했다 (`> **계획 (미구현)**: ...`). plan 의 `[ ] §5 ⚠ Missing integration 배지` 체크박스는 미완료로 plan 파일에 남아있고 plan 도 in-progress 상태를 유지한다. 이는 의도된 처리이며 충돌이 아니나, warningRule DSL 아키텍처 결정이 선행되어야 이 항목을 구현할 수 있다는 점을 후속 작업자가 인지해야 한다.
- **제안**: 현 상태(spec 에 Planned 명시 + plan in-progress 유지)는 적절하다. 아키텍처 결정(warningRule cross-entity 검증 메커니즘) 이 필요할 때 plan 을 재활성화하면 된다.

---

### [INFO] spec-sync-expression-language-gaps: $trigger/$env 런타임 주입 결정 여전히 보류

- **target 위치**: `spec/5-system/5-expression-language.md` §4 변수 표
- **관련 plan**: `plan/in-progress/spec-sync-expression-language-gaps.md` — `$trigger`/`$env` 런타임 주입은 "tiER3 보류"
- **상세**: target branch 는 $itemIsFirst/$itemIsLast 를 expression-language spec §4 표에 추가했다. 이는 foreach-gaps 결정(a)에서 파생된 것이다. `$trigger`/`$env` 런타임 주입은 여전히 "결정 필요 (tier3)" 로 plan 에 남아있으며 target branch 는 이를 건드리지 않았다. 정합하다.
- **제안**: 추적 메모 수준. $trigger/$env 는 별도 planner 결정이 필요하다는 것이 plan 에 기록되어 있으므로 별도 착수 시점에 처리한다.

---

### [INFO] spec-sync-canvas-gaps: target 변경 범위 비중첩 확인

- **target 위치**: `spec/3-workflow-editor/0-canvas.md` §5.3.4 노드 요약 포맷 표
- **관련 plan**: `plan/in-progress/spec-sync-canvas-gaps.md` — 미니맵, 줌 슬라이더, 노드 삭제 버튼, 단축키, 팔레트 등 추적
- **상세**: target branch 는 캔버스 스펙 §5.3.4 의 캔버스 요약 표에서 Database Query/Send Email/Code/Template 행의 포맷을 갱신했다. canvas-gaps plan 이 추적하는 미구현 항목들(미니맵, 줌, 단축키, 팔레트)은 completely different 섹션이라 충돌 없음. canvas-gaps plan 은 spec-sync-audit worktree 를 참조하나 해당 worktree 는 물리적으로 부재하고, target branch 가 spec-sync-audit 작업의 일환으로 동작 중임을 확인했다.
- **제안**: 추적 메모 수준.

---

## Stale 으로 skip 한 worktree

worktree 충돌 후보 5개 전체에 대해 3-step cascade 적용:

- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 1: NOT ancestor. Step 2: PR MERGED. **STALE — skip.** 해당 worktree 는 `/Volumes/project/private/clemvion/.claude/worktrees/fix-bg-context-followups` 에 존재하나 branch 는 이미 머지됨. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target branch(claude/spec-inprogress-impl2) 는 spec-sync-audit 계열의 결정 필요 항목들 (foreach $itemIsFirst/$itemIsLast, node-common errorHandling config shape, data-common Code 요약 downscope, template 요약 downscope, send-email 요약 downscope, embedding-pipeline chunk metadata) 을 planner 결정을 plan 에 기록하면서 처리 완료했다. 각 결정은 plan 파일에 근거와 함께 기록되어 있어 미해결 결정 일방 우회에 해당하지 않는다. 그러나 `spec/conventions/spec-impl-evidence.md` §1 제외 섹션에서 fix-spec-frontmatter-catalog(PR #453 OPEN) 와 동일 라인 범위를 수정하는 CRITICAL 수준 워크트리 충돌이 발견됐다. 또한 `spec/4-nodes/4-integration/0-common.md` 캔버스 요약 표에서 makeshop-api-catalog(fallback ACTIVE) 와 인접 행 경합이 WARNING 수준으로 존재한다. worktree 충돌 후보 5건 중 stale 1건(fix-bg-context-followups — MERGED) skip, active 4건 분석.

---

## 위험도

**CRITICAL**

spec/conventions/spec-impl-evidence.md §1 제외 섹션에서 PR #453(OPEN) 과의 동일 라인 직접 충돌이 존재한다. 두 branch 의 머지 순서를 조율하거나 어느 한쪽이 다른 쪽을 통합한 뒤 PR 을 진행해야 한다.

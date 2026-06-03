# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope=`spec/`, diff-base=`origin/main`)
검토 대상 worktree: `claude/spec-inprogress-impl2` (`spec-inprogress-groom-c7568b`)
검토 일시: 2026-06-03

---

## 발견사항

### [CRITICAL] `spec/4-nodes/4-integration/0-common.md` — makeshop-api-catalog 와 동시 수정 경합

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약 표 (Database Query 행·Send Email 행 + downscope 노트)
- **관련 plan**: `plan/in-progress/makeshop-integration.md` (worktree `claude/makeshop-api-catalog-730deb`, active)
- **상세**:
  - target(`spec-inprogress-groom`) 은 Database Query 행을 `{queryType}·{쿼리 첫 줄}·미구현` → `{{queryType|upper}}·{{query}}·구현됨` 으로, Send Email 행을 `to: {수신자}·미구현` → `{{to.length}} recipients·{{subject}}·구현됨` 으로 변경했다.
  - `makeshop-api-catalog-730deb` 는 같은 표에서 MakeShop 신규 행을 삽입하면서, Database Query 행·Send Email 행을 **이전 origin/main 텍스트**(`미구현 (Planned)`) 그대로 기술하고 있다. §7 출력 구조 색인의 `Integration 4종` → `Integration 노드(…+MakeShop Planned)` 변경도 같은 파일 내에 있다.
  - 두 worktree 가 동일 표의 동일 행을 수정하여 머지 시 직접 텍스트 충돌이 발생한다. 우선순위 합의 없이 한쪽이 먼저 머지되면 나머지 worktree 의 PR 은 conflict 해소 없이 머지 불가.
- **제안**: 두 worktree 의 작업을 직렬화한다. `spec-inprogress-groom` 을 먼저 머지한 뒤 `makeshop-api-catalog-730deb` 를 rebase 하거나, `makeshop-api-catalog-730deb` 에서 Database Query/Send Email 행을 target 이 변경한 최신 텍스트로 수동 갱신 후 PR 작성한다.

---

### [WARNING] `spec/4-nodes/4-integration/0-common.md` — integration-common-gaps plan 의 미해결 항목과 target 결정 범위 확인 필요

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 + plan `spec-sync-integration-common-gaps.md`
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` (worktree `spec-sync-audit`)
- **상세**:
  - 해당 plan 에는 send-email downscope 결정 전 "결정 필요(downscope vs DSL 확장)" 로 기재된 항목이 있었다. target 은 이 결정을 `{{to.length}} recipients·{{subject}}` 로 내리고 plan 을 업데이트했다. 결정 자체는 사용자 승인(착수 전 reclass 기록) 없이 planner/dev 가 단독 결정한 것으로 보이나, plan 본문(spec-sync-integration-common-gaps §send-email downscope 확정)에 결정 근거가 명기되어 있어 결정 우회라 보기 어렵다.
  - `⚠ Missing integration 배지` 항목은 target 이 "티어3 보류"로 명시하고 spec 본문에 `> 계획(미구현)` 노트만 추가했다. 아키텍처 결정 우회 없이 플래그만 유지했으므로 문제 없다.
  - **확인 권장**: send-email downscope 결정이 별도 사용자 승인 없이 확정됐다는 점을 plan의 "사용자 결정" 항목으로 명시하거나, 검토 완료 여부를 본 worktree PR 설명에 기재할 것을 권장한다.
- **제안**: plan에 "send-email downscope 결정 (2026-06-03 spec-inprogress-impl2, 사용자 확인 대상)" 한 줄 추가 권장 (현재는 "결정·구현 완료"로만 기재).

---

### [WARNING] `spec/0-overview.md` — 3개 active worktree 가 동시 수정 (섹션 분리, 머지 전 주의)

- **target 위치**: `spec/0-overview.md` §6.1 워크스페이스 Integration RBAC 행 (line ~78)
- **관련 plan**:
  - `plan/in-progress/ai-context-memory-auto.md` (worktree `claude/ai-context-memory-9c7e6e`) — §8 문서맵 line ~135
  - `plan/in-progress/makeshop-integration.md` (worktree `claude/makeshop-api-catalog-730deb`) — §6.3 MCP Bridge 행 line ~98
- **상세**:
  - 세 worktree 가 `spec/0-overview.md` 를 동시 수정하지만 각각 **다른 섹션·다른 줄**을 건드린다. 현재 diff 기준으로 직접 충돌은 없다. 그러나 세 PR 이 동시에 open 될 경우 주석 충돌(context mismatch) 없이 자동 머지되더라도 내용 정합성을 사람이 확인해야 한다.
- **제안**: 각 worktree PR 이 머지된 직후 다음 worktree 를 rebase 하는 순서를 지킨다. 순서 권장: `spec-inprogress-groom` → `fix-bg-context-followups`(이미 spec/execution-engine 만 수정) → `ai-context-memory` → `makeshop-api-catalog`.

---

### [WARNING] `spec/5-system/4-execution-engine.md` — fix-bg-context-followups 와 동시 수정 (섹션 분리, 머지 전 주의)

- **target 위치**: `spec/5-system/4-execution-engine.md` §5.2 ForEach 컨텍스트 예시 (line ~305) + §6.1 표 `$item/$itemIndex` 행 (line ~542)
- **관련 plan**: `plan/in-progress/background-context-key-followups.md` (worktree `claude/fix-bg-context-followups`) — §6.1 `createContext` 시그니처 설명 (line ~642)
- **상세**:
  - target 은 §5.2 ForEach 예시 코드 블록과 §6.1 표의 `$item/$itemIndex` 행을 수정한다. `fix-bg-context-followups` 는 §6.1 의 전혀 다른 항목(`createContext` 시그니처 설명)을 수정한다. 편집 범위가 다른 섹션이라 자동 머지 가능하다.
  - 그러나 두 worktree 가 같은 파일을 수정하므로 하나가 먼저 머지되면 다른 쪽은 rebase 후 충돌 여부를 재확인해야 한다.
- **제안**: 머지 순서 지정 후 나중 PR 이 rebase 시 §5.2·§6.1 변경이 공존하는지 확인한다. 내용 충돌은 없을 것으로 판단되나, 자동 머지 결과를 사람이 diff 확인 권장.

---

### [INFO] `spec-sync-expression-language-gaps.md` — `$trigger`/`$env` 미해결 결정 유지됨 (정상)

- **target 위치**: `plan/in-progress/spec-sync-expression-language-gaps.md` + `spec/5-system/5-expression-language.md`
- **관련 plan**: 동일 파일
- **상세**:
  - target 은 `$itemIsFirst`/`$itemIsLast` 를 추가했지만 `$trigger`/`$env` 의 "결정 필요" 항목은 그대로 미구현으로 남겼다. spec 본문에도 `미구현 (Planned)` 표기가 유지되어 있다. plan 의 open 항목과 충돌 없음.
- **제안**: 없음. 추적만.

---

### [INFO] `fix-spec-frontmatter-catalog` worktree — MERGED PR (stale 처리됨)

- worktree `claude/fix-spec-frontmatter-catalog` 의 branch 는 Step 2 (gh pr list) 에서 `MERGED` 확인됨. spec/conventions/spec-impl-evidence.md 관련 작업은 완료되어 main 에 반영됨. target 의 동일 파일 변경은 이 작업 결과 위에 올려진 별도 변경 (§1 제외 항목 설명 보강)이므로 충돌 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 전수 검토:

| worktree | branch | stale 판정 |
|---|---|---|
| `fix-spec-frontmatter-catalog` | `claude/fix-spec-frontmatter-catalog` | Step 2: PR MERGED → **stale** |
| `fix-bg-context-followups` | `claude/fix-bg-context-followups` | Step 1: not ancestor / Step 2: PR MERGED → **stale** |
| `ai-context-memory-9c7e6e` | `claude/ai-context-memory-9c7e6e` | Step 1: not ancestor / Step 2: PR empty → Step 3 fallback: **active** |
| `makeshop-api-catalog-730deb` | `claude/makeshop-api-catalog-730deb` | Step 1: not ancestor / Step 2: PR empty → Step 3 fallback: **active** |

**Stale skip 목록**:
- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 2 PR MERGED. 해당 worktree 는 main 에 이미 포함됨.
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR MERGED. 단, git merge-base 에서 ancestor 아님 (squash merge). main 에 이미 포함됨.

두 stale worktree 모두 active 로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

> **주의**: `fix-bg-context-followups` 는 Step 2 에서 MERGED 확인됐으나, 위 §발견사항 WARNING 에서 `spec/5-system/4-execution-engine.md` 동시 수정을 경고로 기재했다. 해당 branch 가 이미 main 에 포함된 stale 임이 확인됐으므로 그 WARNING 은 **내용 충돌 없음**으로 재해석된다 — stale branch 의 변경은 이미 origin/main 에 있으므로 target 이 그 위에 추가 변경을 올리는 것이다.

---

## 요약

target(`spec-inprogress-groom`, worktree `claude/spec-inprogress-impl2`)의 spec/ 변경은 대부분 plan 에서 이미 결정이 확정된 항목을 spec 에 반영하거나 status 를 `implemented` 로 승격하는 작업이다. 미해결 결정(`$trigger`/`$env` 런타임 주입, `⚠ Missing integration 배지` 아키텍처)은 건드리지 않았다. 단, `spec/4-nodes/4-integration/0-common.md` 의 summaryTemplate 표를 `makeshop-api-catalog-730deb` 가 동시에 수정하고 있어 같은 행에 대한 **직접 텍스트 경합**이 발생한다(CRITICAL). 나머지 동시 수정 파일(`spec/0-overview.md`, `spec/5-system/4-execution-engine.md`)은 편집 구간이 달라 자동 머지 가능하지만 머지 순서 조율이 권장된다(WARNING). worktree 충돌 후보 4건 중 stale 2건(fix-spec-frontmatter-catalog·fix-bg-context-followups — 둘 다 PR MERGED) skip, active 2건(ai-context-memory-9c7e6e·makeshop-api-catalog-730deb) 분석.

---

## 위험도

**HIGH** — `spec/4-nodes/4-integration/0-common.md` 의 CRITICAL 경합이 해소되지 않으면 makeshop-api-catalog PR 이 conflict 로 차단된다. 두 worktree 의 작업 순서 확정 또는 makeshop 쪽 rebase 가 선행되어야 한다.

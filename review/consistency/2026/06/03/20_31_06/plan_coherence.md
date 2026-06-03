# Plan 정합성 검토 결과

검토 모드: spec draft (--spec)
Target 문서: `spec/4-nodes/4-integration/5-makeshop.md`
검토 일시: 2026-06-03

---

## 발견사항

### [CRITICAL] `plan/in-progress/makeshop-integration.md` 파일이 존재하지 않음
- **target 위치**: frontmatter `pending_plans: [plan/in-progress/makeshop-integration.md]`, §Overview 구현상태 블록, §9.6, §9.8
- **관련 plan**: `plan/in-progress/makeshop-integration.md` (파일 미존재)
- **상세**: target spec 은 `pending_plans` 및 본문 여러 곳에서 `plan/in-progress/makeshop-integration.md` 를 단일 진실(SoT)로 교차 참조한다 (§9.6 후속 webhook/trigger 과제, §9.8 C-6 편입 분해 상세). 그런데 `plan/in-progress/` 를 전수 탐색한 결과 해당 파일이 **존재하지 않는다**. 링크 대상이 없어 구현 착수 시 `pending_plans` frontmatter 가드가 깨지고, C-6 분해 상세 및 webhook 후속 과제의 추적 SoT 가 공백이다.
- **제안**: `plan/in-progress/makeshop-integration.md` 를 신설해야 한다. 최소한 (a) 구현 단계 작업 목록, (b) C-6 편입 분해 (`buildIntegrationMeta` 레지스트리 전환), (c) §9.6 CPIK webhook/trigger 후속 과제, (d) `worktree:` frontmatter 를 포함해야 한다. target spec 의 본문은 해당 plan 이 이미 존재한다는 전제로 작성되어 있으므로, plan 신설 전까지 링크된 앵커(`§C-6 편입`, `§후속`)는 dead reference 상태이다.

---

### [WARNING] C-6 트리거 선언이 `cafe24-backlog-residual.md` 갱신 없이 일방적으로 결론 내림
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §9.8`
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` C-6 항목 (라인 20)
- **상세**: `cafe24-backlog-residual.md` 의 C-6 항목은 현재 `[ ]` (미착수) 상태이며 "deferred — 2nd provider 시점까지" 라는 조건부 기록만 있다. target spec §9.8 은 "MakeShop 이 두 번째 provider 이므로 deferred 조건 충족 → makeshop 작업으로 편입" 이라고 결론짓고 있는데, `cafe24-backlog-residual.md` C-6 항목 자체는 이 결정을 아직 반영하지 않았다 (plan 에 "⏩ TRIGGERED" 표기나 "makeshop-integration.md 편입" 주석이 없음). plan 의 관리자가 C-6 항목을 보면 아직 미결정 deferred 상태로 보인다.
- **제안**: `cafe24-backlog-residual.md` C-6 항목에 "⏩ TRIGGERED (2026-06-03): `makeshop-integration.md` 로 편입" 주석을 추가해 두 plan 의 상태가 정합하도록 갱신해야 한다. target spec 에서 편입을 선언했으면 원본 plan 도 동기화가 필요하다.

---

### [WARNING] `spec/4-nodes/0-overview.md` 를 `spec-inprogress-groom-c7568b` worktree 와 동시 수정
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md` 의 브랜치 `claude/makeshop-api-catalog-730deb` 가 `spec/4-nodes/0-overview.md` 수정 포함
- **관련 plan**: `plan/in-progress/spec-inprogress-groom-c7568b` worktree (브랜치 `claude/spec-inprogress-groom-c7568b`) 가 동일 파일 수정 중
- **상세**: `claude/makeshop-api-catalog-730deb` 는 `spec/4-nodes/0-overview.md` §2.4 에 MakeShop 노드 행을 추가한다. `claude/spec-inprogress-groom-c7568b` 는 동일 파일 §1.4.1 에 템플릿 문법(filter DSL) 섹션을 추가한다. 두 브랜치 모두 같은 base commit(`c3d4f2b2`) 에서 분기했으며, `spec-inprogress-groom-c7568b` 는 PR 이 없는 active 브랜치이다 (stale 판정 cascade Step 1 ACTIVE, Step 2 PR 없음 → Step 3 active 처리). 직접 충돌 행은 다르지만, 두 브랜치 중 하나가 main 에 먼저 머지되면 나머지 브랜치는 수동 rebase/merge 가 필요하다.
- **제안**: 두 worktree 의 `spec/4-nodes/0-overview.md` 수정 영역이 다른 섹션이라 실제 충돌 가능성은 낮지만, 머지 순서를 조율하거나 먼저 main 에 들어간 변경을 다른 브랜치가 rebase 해야 한다. `spec-inprogress-groom` 의 PR 계획을 확인 후 우선순위를 조율할 것.

---

### [INFO] `catalog-sync` 테스트 미보호 상태를 spec 본문이 인식했으나 plan 에 미등록
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §Overview 구현상태 블록`
- **관련 plan**: 현재 미존재인 `plan/in-progress/makeshop-integration.md`
- **상세**: spec 은 "MakeShop API Catalog `_overview.md` 는 현재 sync test 미보호" 임을 명시하고, "구현 착수 시 backend 메타데이터 + catalog-sync 테스트를 함께 도입한다" 고 기술한다. 이 요건은 `makeshop-integration.md` 신설 시 구현 체크리스트 항목으로 반드시 등재해야 한다. 누락 시 catalog-sync 미보호 상태가 구현 완료 후에도 지속될 수 있다.
- **제안**: `makeshop-integration.md` 신설 시 "backend metadata + catalog-sync test 도입" 을 별도 체크리스트 항목으로 포함할 것.

---

### [INFO] §9.7 미확인 항목 4건이 open question 으로 남아 있음
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §9.7`
- **관련 plan**: 미존재 `plan/in-progress/makeshop-integration.md`
- **상세**: OAuth 호스트·data-call rate limit·timezone·POST/PUT envelope·pagination 방식 등 4~5건이 "구현 전 미확인" 으로 open question 상태다. 이는 spec-draft 단계에서 적절히 명시된 것이지만, `makeshop-integration.md` 신설 시 구현 착수 체크리스트에 "공식 문서 재확인 → spec §9.7 항목 확정" 단계를 포함해야 한다. 현재 이를 추적하는 plan 이 없어 구현자가 open question 을 그냥 지나칠 위험이 있다.
- **제안**: `makeshop-integration.md` 의 구현 전 단계에 §9.7 open question 확인 체크리스트 추가.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `cafe24-api-catalog-1665bd` (branch `claude/cafe24-api-catalog-1665bd`) — Step 2 PR #447 MERGED. `spec/conventions/makeshop-api-catalog/`, `spec/conventions/makeshop-api-metadata.md` 등 다수 파일을 수정했으나 이미 main 에 머지되어 충돌 위험 없음.
- `code-node-sandbox-979a97` (branch `claude/code-node-sandbox-979a97`) — Step 2 PR #434 MERGED. `spec/4-nodes/0-overview.md` 수정이 있었으나 stale.
- `conventions-code-data-9b32d5` (branch `claude/conventions-code-data-9b32d5`) — Step 2 PR #433 MERGED. `spec/4-nodes/0-overview.md` 수정이 있었으나 stale.
- `feat-web-chat-demo` / `claude/workspace-allowed-origins-settings` (branch `claude/workspace-allowed-origins-settings`) — Step 2 PR #441 MERGED. `spec/1-data-model.md` 수정이 있었으나 stale.
- `node-cancellation-engine-6bfcaa` (branch `claude/node-cancellation-engine-6bfcaa`) — Step 2 PR #442 MERGED. `spec/1-data-model.md` 수정이 있었으나 stale.
- `spec-sync-audit` — Step 2 PR #443/#440 모두 MERGED. stale.

stale worktree 가 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target spec `spec/4-nodes/4-integration/5-makeshop.md` 는 전반적으로 Cafe24 노드 패턴을 일관되게 미러링하며 고유 분기를 잘 명시하고 있다. 그러나 가장 심각한 정합성 문제는 **spec 이 참조하는 `plan/in-progress/makeshop-integration.md` 가 실제로 존재하지 않는다**는 점이다 (CRITICAL). spec frontmatter `pending_plans` 와 §9.6·§9.8 의 cross-reference 가 모두 dead link 상태이며, C-6 편입 결정의 구현 분해 상세와 webhook 후속 과제를 추적하는 SoT 가 공백이다. 추가로 `cafe24-backlog-residual.md` 의 C-6 항목이 갱신되지 않아 plan 간 상태 불일치가 있다 (WARNING). `spec/4-nodes/0-overview.md` 를 active worktree `spec-inprogress-groom-c7568b` 와 동시 수정하는 병렬 편집 위험도 존재한다 (WARNING). worktree 충돌 후보 12건 중 stale 6건 skip, active 1건(`spec-inprogress-groom-c7568b`) 분석.

## 위험도

HIGH

# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/, diff-base=origin/main)
대상 worktree: `.claude/worktrees/spec-inprogress-groom-c7568b` (branch `claude/spec-inprogress-impl2`)

---

## 발견사항

### [WARNING] foreach spec — "결정 필요" 항목을 결정 기록 없이 완료 처리
- **target 위치**: `spec/4-nodes/1-logic/9-foreach.md` — `status: partial → implemented` 승격, `pending_plans` 제거, `$itemIsFirst`/`$itemIsLast` top-level 변수 추가
- **관련 plan**: `plan/in-progress/spec-sync-foreach-gaps.md` (target branch 에서 `plan/complete/` 로 이동) — "재분류: decision-free 아님 → planner 결정 필요", 선택지 (a) `$itemIsFirst`/`$itemIsLast` / (b) `$loop.isFirst/isLast` 재사용 / (c) spec 의 `$item.isFirst` 약속 변경
- **상세**: target 이 선택지 (a)를 채택해 spec 과 코드(`expression-resolver.service.ts`)를 업데이트했다. 이는 기술적으로 올바른 해결이며 `$item`이 raw 값이라 속성 부착 불가하다는 제약을 정확히 반영한다. 그러나 `plan/complete/spec-sync-foreach-gaps.md` 에는 여전히 "결정 필요" 섹션만 존재하고 "결정: (a) 채택 — $itemIsFirst/$itemIsLast top-level 변수" 같은 결정 기록이 없다. `spec-sync-embedding-pipeline-gaps.md` 가 `## §6.1 처리 결과 (결정 A: 파서→metadata 경로)` 섹션을 추가한 것과 비교하면 일관성이 없다.
- **제안**: `plan/complete/spec-sync-foreach-gaps.md` 끝에 결정 기록 섹션 추가 — "결정 (2026-06-03): 선택지 (a) 채택 — `$itemIsFirst`/`$itemIsLast` top-level 변수. `$item` 은 raw 값(unknown type)이라 `.isFirst` 속성 부착이 타입 안전 불가, 별도 top-level 변수가 가장 명료한 API."

---

### [WARNING] node-common spec — "결정 필요" 항목을 결정 기록 없이 완료 처리
- **target 위치**: `spec/3-workflow-editor/1-node-common.md` — `status: partial → implemented` 승격, `pending_plans` 제거, config 저장 형태 nested `errorHandling` 확정, §2.4 Retry UI 구현 완료 반영, §2.5.1 Default Output UI 구현 완료 반영
- **관련 plan**: `plan/in-progress/spec-sync-node-common-gaps.md` → `plan/complete/` 이동 — "결정 필요: config 스키마 통일(flat vs nested) + policy 값 vocabulary + Reset to Type Default 의 type-default 출처 정의"
- **상세**: target 이 nested `config.errorHandling = { policy, retryConfig?, defaultOutput? }` 를 정식으로 채택하고 과거 flat `config.errorPolicy` 단축값에 대해 "로드 시 자동 마이그레이션" 정책을 명시했다. 기술적으로 엔진의 기존 계약(`error-policy.handler.ts`)과 정합하므로 올바른 결정이다. "Reset to Type Default" 는 타입별 기본값 표를 삭제하고 "미구현 — Planned" 로 후위 이동했다. 그러나 `plan/complete/spec-sync-node-common-gaps.md` 에 결정 기록이 없어, 왜 flat 를 버리고 nested 를 채택했는지의 Rationale 이 추적 불가하다.
- **제안**: `plan/complete/spec-sync-node-common-gaps.md` 에 결정 기록 추가 — "결정 (2026-06-03): nested errorHandling 채택. 엔진 기존 계약(`error-policy.handler.ts`)이 이미 nested 를 소비하므로 flat 는 dead path. 로드시 마이그레이션으로 하위 호환. type-default 추론은 미구현(Planned) 으로 연기."

---

### [WARNING] integration-common spec — send-email summaryTemplate 결정 기록 누락
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` — Send Email 요약을 `{{to.length}} recipients · {{subject}}` 로 downscope, Database Query 요약을 `{{queryType|upper}} · {{query}}` 로 downscope
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` (in-progress 유지) — "결정 필요: send-email `to: {수신자} +N` 은 배열 슬라이스/조건 카운트 필요 — DSL 불가"
- **상세**: target 이 `to.length recipients` downscope 결정을 내렸다. plan 은 in-progress 로 유지되며 `[x]` 완료 표시와 함께 "(downscope: 배열 슬라이스/조건 카운트 미지원으로 ...)" 를 기록했다. 이는 충분한 기록이다. 그러나 DSL 확장 vs downscope 중 왜 downscope 를 선택했는지의 Rationale 이 spec 본문(`0-common.md`) 에 없다. spec 에 `> **downscope 근거**: DSL 이 배열 slice/conditional 을 지원하지 않아 원래 포맷(`to: {수신자} +N`)을 표현 불가 — 대신 `to.length` 집계로 대체` 같은 인라인 주석이 있으면 독립적으로 이해 가능하다.
- **제안**: `spec/4-nodes/4-integration/0-common.md` 의 summaryTemplate 표 하단 또는 Rationale 절에 downscope 근거 1줄 추가. Plan 변경 불필요(이미 충분히 기록됨).

---

### [WARNING] data-common / template spec — "결정 필요" 항목을 결정 기록 없이 완료 처리
- **target 위치**: `spec/4-nodes/5-data/0-common.md` (Code 노드 요약 `{{language|upper}}` downscope), `spec/4-nodes/6-presentation/5-template.md` (`status: partial → implemented`), `spec/4-nodes/6-presentation/0-common.md` (Template 요약 `{{outputFormat}} · {{buttons.length}} buttons` 단일화)
- **관련 plan**: `plan/in-progress/spec-sync-data-common-gaps.md` → `plan/complete/` 이동, `plan/in-progress/spec-sync-template-gaps.md` → `plan/complete/` 이동 — 두 plan 모두 "결정 필요: summaryTemplate DSL 확장(`lines` primitive + title-case 필터) vs 약속 downscope"
- **상세**: target 이 DSL 확장 없이 downscope 를 채택했다. Code 노드는 `{{language|upper}}`(줄 수 없음), Template 는 `{{outputFormat}} · {{buttons.length}} buttons`(lines 없음). 기술적으로 현재 DSL 의 한계를 정직하게 반영한 결정이다. 그러나 완료된 plan 파일에 결정 기록이 없어 spec-sync-embedding-pipeline 처럼 "결정 X: downscope 채택 이유" 가 누락되어 있다. `plan/complete/spec-sync-data-common-gaps.md` 와 `spec-sync-template-gaps.md` 각각에 결정 섹션이 없다.
- **제안**: 두 plan/complete 파일에 "결정 (2026-06-03): DSL 확장 대신 downscope 채택 — `lines` primitive 는 summaryTemplate DSL scope 밖, title-case 필터 미존재. spec 원래 약속보다 현재 DSL 이 가진 표현력에 맞춤." 추가.

---

### [INFO] 계획됐던 `spec-update-c-sync-promotions.md` plan 미생성
- **target 위치**: 해당 없음 (plan 생성 누락)
- **관련 plan**: `plan/in-progress/spec-sync-structural-followups.md` §스펙 승격 위임 — "developer 는 spec 직접 수정 불가 → `plan/in-progress/spec-update-c-sync-promotions.md` 에 위임 노트 작성"
- **상세**: `spec-sync-structural-followups.md` 는 developer 가 `spec-update-c-sync-promotions.md` 를 작성해 spec 승격 작업을 planner 에게 위임할 것을 명시했다. 실제로 target worktree 가 그 planner 역할을 수행해 spec 을 직접 업데이트했으며, 해당 위임 plan 은 생성되지 않았다. 이는 프로세스상의 빈 칸이지만, target 이 이미 작업을 직접 처리했으므로 중복 plan 을 소급 생성할 필요는 없다. 단, `spec-sync-structural-followups.md` 에 "spec-update-c-sync-promotions.md 미생성 — target worktree (spec-inprogress-impl2) 가 직접 처리" 를 비고로 추가하는 것이 추적성에 도움된다.
- **제안**: `plan/in-progress/spec-sync-structural-followups.md` 의 "스펙 승격 위임" 섹션에 한 줄 추가 — "→ spec-inprogress-impl2 에서 직접 처리 완료 (2026-06-03). spec-update-c-sync-promotions.md 미생성."

---

### [INFO] spec-sync-expression-language-gaps.md — $itemIsFirst/$itemIsLast 추가로 plan 업데이트 권장
- **target 위치**: `spec/5-system/5-expression-language.md` — `$itemIsFirst`/`$itemIsLast` 두 행 추가
- **관련 plan**: `plan/in-progress/spec-sync-expression-language-gaps.md` — `$thread` autocomplete 만 처리 완료로 기록됨. `$itemIsFirst`/`$itemIsLast` 추가는 spec-sync-foreach-gaps 의 파생 결과이므로 expression-language-gaps 에 별도 항목으로 존재하지 않는다.
- **상세**: expression-language-gaps plan 에 `$itemIsFirst`/`$itemIsLast` 추가가 언급되지 않는다. plan 의 "처리 결과" 섹션에 해당 변수 추가를 brief note 로 기록하면 gap 이 어떻게 해소됐는지 연결고리가 생긴다. CRITICAL 이 아닌 이유: expression-language-gaps 는 여전히 `$trigger`/`$env` 미구현으로 in-progress 유지 대상이고, `$itemIsFirst`/`$itemIsLast` 는 foreach-gaps 에서 파생된 것이라 별도 추적 의무가 없다.
- **제안**: `plan/in-progress/spec-sync-expression-language-gaps.md` 의 "처리 결과" 섹션에 "$(foreach) `$itemIsFirst`/`$itemIsLast` 추가 — spec-sync-foreach-gaps 결정 (a) 파생 (2026-06-03)." 한 줄 추가.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토:
- target branch (`claude/spec-inprogress-impl2`) 가 수정하는 spec 파일: `spec/3-workflow-editor/1-node-common.md`, `spec/4-nodes/1-logic/9-foreach.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/6-presentation/5-template.md`, `spec/5-system/5-expression-language.md`, `spec/5-system/8-embedding-pipeline.md`

활성 worktree 목록 및 spec 파일 겹침 검사:
- `ai-context-memory-9c7e6e`: spec 수정 파일 `spec/0-overview.md`, `spec/1-data-model.md`, `spec/4-nodes/_product-overview.md`, `spec/4-nodes/3-ai/**` — **겹침 없음**. PR 없음 (Step 2 empty). Step 3 fallback → active. spec 파일 교집합이 없으므로 §5 충돌 해당 없음.
- `fix-bg-context-followups`: Step 2 PR MERGED → **stale**. spec 파일 겹침 불필요.
- `fix-spec-frontmatter-catalog`: Step 1 ancestor 검사 STALE → **stale**. spec 파일 겹침 불필요.
- `makeshop-api-catalog-730deb`: spec 수정 없음 (`codebase/` only). PR 없음. spec 파일 교집합 없으므로 §5 충돌 해당 없음.

### Stale skip 목록:

- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR MERGED
- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 1 ancestor check STALE

두 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target (`claude/spec-inprogress-impl2`) 은 `spec-sync-structural-followups.md §C` 의 스펙 승격 위임을 직접 처리하며 6개 spec 파일을 `partial → implemented` 로 승격했다. 활성 worktree 와의 spec 파일 충돌은 없다 (ai-context-memory 는 AI/데이터모델 영역, 본 target 은 노드공통/expression/embedding 영역). 주요 문제는 CRITICAL 이 아닌 추적성 결함 — `spec-sync-foreach-gaps`, `spec-sync-node-common-gaps`, `spec-sync-data-common-gaps`, `spec-sync-template-gaps` 4개 plan 이 "결정 필요" 섹션을 보유한 채 `complete/` 로 이동했고, 각 결정의 선택 근거가 plan 에 기록되지 않았다 (`spec-sync-embedding-pipeline-gaps` 의 "§6.1 처리 결과" 섹션처럼 결정 기록을 남겼어야 한다). 미해결 결정을 우회한 것이 아니라 결정을 내렸으되 그 결정을 plan 에 기록하지 않은 것이므로 WARNING 분류가 적절하다. worktree 충돌 후보 4건 중 stale 2건 skip, active 2건 분석 (spec 파일 교집합 없어 §5 충돌 없음).

---

## 위험도

LOW

STATUS: OK

# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견(Plan Coherence)이 있어 호출자가 차단해야 함

## 전체 위험도
**HIGH** — `spec/4-nodes/4-integration/0-common.md` 에서 `makeshop-api-catalog-730deb` worktree 와 직접 텍스트 경합(CRITICAL) 발생. 해소 전 머지 불가.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약 표의 Database Query·Send Email 행을 두 worktree 가 동시에 상이한 텍스트로 수정 — 머지 시 직접 텍스트 충돌 | `spec/4-nodes/4-integration/0-common.md` §5 (Database Query 행·Send Email 행) | worktree `claude/makeshop-api-catalog-730deb` (`plan/in-progress/makeshop-integration.md`) — 동일 행을 origin/main 원문(`미구현 (Planned)`)으로 보존 중 | 두 worktree 직렬화: `spec-inprogress-groom` 먼저 머지 후 `makeshop-api-catalog-730deb` rebase. 또는 `makeshop-api-catalog-730deb` 에서 해당 행을 target 최신 텍스트(`{{queryType|upper}}·{{query}}`·`{{to.length}} recipients·{{subject}}`)로 수동 갱신 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `spec/0-overview.md` 를 세 active worktree 가 동시 수정 (섹션은 다르나 머지 순서 조율 필요) | `spec/0-overview.md` §6.1 (line ~78) | `claude/ai-context-memory-9c7e6e` (§8 line ~135), `claude/makeshop-api-catalog-730deb` (§6.3 line ~98) | 머지 순서: `spec-inprogress-groom` → `ai-context-memory` → `makeshop-api-catalog`. 각 머지 직후 다음 worktree rebase |
| 2 | Plan Coherence | send-email downscope 결정(planner/dev 단독 확정)에 대한 사용자 승인 명시 부재 | `plan/in-progress/spec-sync-integration-common-gaps.md` §send-email downscope | 사용자 결정 항목 — plan 에 미기재 | plan 에 "send-email downscope 결정 (2026-06-03 spec-inprogress-impl2, 사용자 확인 대상)" 한 줄 추가 권장 |
| 3 | Plan Coherence | `spec/5-system/4-execution-engine.md` 동시 수정처럼 보였으나 `fix-bg-context-followups` 가 MERGED stale 로 확인 — 실질 충돌 없음 | `spec/5-system/4-execution-engine.md` §5.2·§6.1 | `claude/fix-bg-context-followups` (PR MERGED — stale) | 실질 충돌 없음. stale worktree 2건 cleanup 권장 |
| 4 | Rationale Continuity | `$itemIsFirst`/`$itemIsLast` 기존 "expression 미노출" 결정 번복 — 새 Rationale R-1 동반됐으나 `spec/5-system/5-expression-language.md` 에 추적 주석 없음 | `spec/4-nodes/1-logic/9-foreach.md` §3·Rationale R-1; `spec/5-system/5-expression-language.md` 변수 표 | origin/main `foreach.md` 주석 — "isFirst/isLast 는 expression 비노출 내부 상태" | `spec/5-system/5-expression-language.md` 에 "2026-06-03 Planned → 구현 전환, 근거 foreach.md R-1" 각주 삽입 |
| 5 | Rationale Continuity | `Use Default Output` 타입별 기본값 추론 → `null` 단일 폴백 번복 — 새 Rationale 동반, 과거 미구현 표기 없는 규범 기술과의 불일치를 구현 현실로 교정 | `spec/3-workflow-editor/1-node-common.md` §2.5.2·Rationale R-1; `spec/5-system/4-execution-engine.md` §4.4 | origin/main `1-node-common.md` §2.5.2 타입별 기본값 추론 규범 기술 | `spec/5-system/3-error-handling.md` 크로스레퍼런스 확인 완료. 추가 조치 불필요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `workspace.owner_id`(DB column) vs `ownerId`(DTO) 혼용 — 레이어 구분 불명확 | `spec/1-data-model.md §2.2`; `spec/2-navigation/9-user-profile.md §4.1` | user-profile spec 에서 DB 컬럼은 `owner_id`, DTO 필드는 `ownerId` 로 명시 구분 |
| 2 | Cross-Spec | `AssistantMessage`(data-model) vs `WorkflowAssistantMessage`(ai-assistant spec) 엔티티명 불일치 | `spec/1-data-model.md §2.22`; `spec/3-workflow-editor/4-ai-assistant.md` | 둘 중 하나로 통일 또는 data-model 에 코드베이스 entity 명 주석 추가 |
| 3 | Cross-Spec | `successRate` 분모 정책: dashboard 명시(`running·pending·cancelled 포함`) vs statistics 미기재 | `spec/2-navigation/7-statistics.md §2.2` | statistics spec 에 `Success Rate` 분모 정의 명시 |
| 4 | Cross-Spec | `spec/1-data-model.md` `settings` 필드 셀 내 API endpoint 인라인 기재 — 이중 유지보수 지점 | `spec/1-data-model.md §2.2 Workspace.settings` | endpoint 직접 기술 대신 `spec/2-navigation/9-user-profile.md §6.1` 포인터 |
| 5 | Cross-Spec | `Notification.type` 분리 원칙 설명이 data-model 인라인 중복 기재 | `spec/1-data-model.md §2.19`; `spec/2-navigation/4-integration.md §11.2` | data-model 은 enum 열거만, 비즈니스 로직 상세는 Integration spec 포인터 |
| 6 | Rationale Continuity | 캔버스 요약 포맷 downscope — Planned 포맷에서 구현 포맷으로 교체, invariant 충돌 없음 | `spec/3-workflow-editor/0-canvas.md §9`; 각 노드 `0-common.md §5` | 추가 조치 불필요 |
| 7 | Rationale Continuity | `spec/conventions/spec-impl-evidence.md` 제외 스코프 확장(루트→basename 전체) — 새 Rationale 항 없음 | `spec/conventions/spec-impl-evidence.md §1` | `## Rationale` 에 "R-8 — 0-overview.md 제외 스코프 basename 매칭 근거" 1단락 추가 권장 |
| 8 | Rationale Continuity | `spec/0-overview.md` §6.1 Integration RBAC 명시 강화 — 기존 구조 명시 보완, 신규 결정 아님 | `spec/0-overview.md §6.1` | 추가 조치 불필요 |
| 9 | Convention Compliance | `spec/conventions/node-output.md` — `## Rationale` 섹션 부재 | `spec/conventions/node-output.md` 전체 | 말미에 `## Rationale` 추가 (Principle 1.1 직교성·internal 필드 예외·`output.result` 래핑 한정 등 최소 3항) |
| 10 | Convention Compliance | `spec/conventions/swagger.md` — `## Rationale` 섹션 부재 | `spec/conventions/swagger.md` 전체 | 말미에 `## Rationale` 추가 (`ApiOkWrappedResponse`·`writeOnly/readOnly` 의무화·빈 껍데기 스키마 금지 근거) |
| 11 | Convention Compliance | `## N. Rationale` 번호 포함 heading — 표준 `## Rationale` 와 불일치 | `spec/conventions/conversation-thread.md §8`; `data-hydration-surfaces.md`; `interaction-type-registry.md` | `## N. Rationale` → `## Rationale` 로 섹션 번호 제거 (3개 파일) |
| 12 | Convention Compliance | `## 7. 폐기 대안 (Rationale)` 형식 — 표준 heading 과 불일치 | `spec/conventions/migrations.md §7` | `## Rationale` 로 교체하거나 별도 섹션 추가 후 내용 흡수 |
| 13 | Convention Compliance | `spec/data-flow/*.md` — spec-impl-evidence.md §1 적용 대상 외, frontmatter 미보유(정합) | `spec/data-flow/` 전체 | 범위 확장 시 `spec-impl-evidence.md §1` 에 명시적 제외 사유 기재 권장 |
| 14 | Plan Coherence | `spec-sync-expression-language-gaps.md` — `$trigger`/`$env` 미해결 결정 유지 (정상) | `plan/in-progress/spec-sync-expression-language-gaps.md` | 추적만. 추가 조치 불필요 |
| 15 | Plan Coherence | stale worktree 2건 (`fix-spec-frontmatter-catalog`, `fix-bg-context-followups`) cleanup 미완료 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 16 | Naming Collision | `$itemIsFirst`/`$itemIsLast` (ForEach top-level) vs `$loop.isFirst`/`$loop.isLast` (Loop nested) 비대칭 — 의도된 설계 차이, Rationale R-1 명시 | `spec/4-nodes/1-logic/9-foreach.md:68-69`; `spec/4-nodes/1-logic/3-loop.md:86-87` | `spec/5-system/5-expression-language.md` ForEach 행에 구분 단문 주석 추가 고려(선택) |
| 17 | Naming Collision | `config.errorHandling.policy` vs `config.errorPolicy` 유사명 — spec 경고 블록으로 사전 차단됨 | `spec/3-workflow-editor/1-node-common.md:169`; `spec/4-nodes/1-logic/0-common.md:95` | 추가 조치 불필요 |
| 18 | Naming Collision | `backoffMultiplier` 신규 도입 — 기존 이름 충돌 없음 | `spec/3-workflow-editor/1-node-common.md:166`; `spec/5-system/3-error-handling.md:240` | 추가 조치 불필요 |
| 19 | Naming Collision | summaryTemplate 포맷 식별자(`{{queryType|upper}}` 등) — schema config 키와 1:1 정합 확인 | `spec/3-workflow-editor/0-canvas.md:402-410` | 추가 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 직접 모순 없음. 명명 레이어 혼용(owner_id/ownerId, AssistantMessage/WorkflowAssistantMessage), successRate 분모 미명시 등 INFO 5건 |
| Rationale Continuity | LOW | 결정 번복 2건 모두 새 Rationale 동반. spec-impl-evidence 제외 스코프 확장 Rationale 항 미추가 1건 |
| Convention Compliance | LOW | CRITICAL/WARNING 없음. Rationale 섹션 부재 2건·번호 포함 heading 불일치 3건 등 INFO 5건 |
| Plan Coherence | HIGH | `spec/4-nodes/4-integration/0-common.md` 동일 행 직접 경합 CRITICAL 1건. 동시 수정 파일 머지 순서 조율 WARNING 2건 |
| Naming Collision | NONE | CRITICAL/WARNING 없음. 의도된 비대칭·경고 블록 사전 차단 등 INFO 7건 |

## 권장 조치사항

1. **(BLOCK 해소 — 즉시)** `spec/4-nodes/4-integration/0-common.md` 경합 해소: `spec-inprogress-groom` 을 먼저 머지하거나, `makeshop-api-catalog-730deb` 에서 Database Query·Send Email 행을 현재 target 텍스트로 수동 갱신 후 PR 작성.
2. **(WARNING 해소)** `spec/0-overview.md` 동시 수정 머지 순서 준수: `spec-inprogress-groom` → `ai-context-memory` → `makeshop-api-catalog` 순.
3. **(WARNING 해소)** `plan/in-progress/spec-sync-integration-common-gaps.md` 에 send-email downscope 사용자 확인 항목 한 줄 추가.
4. **(INFO 권장)** stale worktree 2건 cleanup: `./cleanup-worktree-all.sh --yes --force`.
5. **(INFO 권장)** `spec/conventions/spec-impl-evidence.md § Rationale` 에 "R-8 — 0-overview.md 제외 스코프 basename 매칭 근거" 추가.
6. **(INFO 권장)** `spec/conventions/node-output.md`, `spec/conventions/swagger.md` 말미에 `## Rationale` 섹션 추가.
7. **(INFO 권장)** `conversation-thread.md`, `data-hydration-surfaces.md`, `interaction-type-registry.md`, `migrations.md` 의 번호 포함 Rationale heading 을 `## Rationale` 로 교정.
8. **(INFO 선택)** `spec/2-navigation/7-statistics.md §2.2` 에 `Success Rate` 분모 정의 명시.
9. **(INFO 선택)** `spec/5-system/5-expression-language.md` ForEach 행에 Loop `$loop.isFirst` 와의 구분 단문 주석 추가.
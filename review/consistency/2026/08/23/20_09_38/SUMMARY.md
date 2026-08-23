# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 모두 전문 확보, Critical 없음.

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건은 전부 "핵심 변경 자체는 정합하나 인접 문서/트래커의 동기화가 새로 stale 해짐" 유형(evidence-trail·인용 동기화)이며, 기능적 충돌·미해결 결정 우회는 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없어 인계 대상 자체가 없음. 단, convention_compliance WARNING #2(`node-output.md` Principle 0 갱신)는 checker 스스로 "`spec/` 쓰기 권한이 없는 developer 턴에서 직접 고칠 수 없다"고 명시했으나 등급이 WARNING 이므로 본 표 대상은 아니다 — 권장 조치사항에 planner 턴 처리로 반영.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | §R17 "해소" 갱신을 인용하던 위성 문서가 stale 해짐 | `spec/5-system/14-external-interaction-api.md` §R17 (line ~1780) | `spec/conventions/conversation-thread.md` 388행 — "…일반 `nodeOutput` 키-allowlist 만 잔여 항목(…EIA §R17)" 문장이 여전히 "잔여"로 서술 | `conversation-thread.md` 해당 문장을 "`getStatus` 출구는 해소(2026-08-23), SSE/fanout 은 잔여"로 갱신 |
| 2 | convention_compliance | 신규 구현 파일이 spec frontmatter `code:` 미등재 | `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 목록 | `codebase/backend/src/shared/utils/node-output-allowlist.ts` (§R17 이 가리키는 핵심 구현체, 자매 파일 `strip-external-only-fields.ts` 는 이미 등재) | `code:` 목록에 `node-output-allowlist.ts` 추가 |
| 3 | convention_compliance | 코드가 명문화한 "wire-only 4키"가 상위 규약의 닫힌 레지스트리에 미반영 | `spec/conventions/node-output.md` Principle 0 (5필드+3예외 닫힌 목록, 이번 diff로 미변경) | `NODE_OUTPUT_ALLOWED_KEYS`(`node-output-allowlist.ts`) — `formConfig`/`conversationConfig`/`buttonConfig`/`interactionType` 4개 wire-only 키를 컴파일타임 SoT로 명문화, 실측(`interaction.service.ts`/`.spec.ts`)으로도 확인 | `project-planner` 턴에서 `node-output.md` Principle 0 에 "EIA wire 조립 레이어가 추가하는 wire-only 필드는 `NodeHandlerOutput` 계약 밖" 각주 추가, 또는 최소 `spec-sync-external-interaction-api-gaps.md` 에 정식 잔여 항목으로 등재 |
| 4 | plan_coherence | 형제 in-progress plan 이 이미 종결된 트래커 항목을 "미완료"로 인용 | `spec/5-system/14-external-interaction-api.md` §R17 신설 표 — 근거 트래커 `spec-sync-external-interaction-api-gaps.md` 의 해당 불릿이 이번 PR 에서 `[x]` 종결 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (다른 worktree `eia-r8-cache-scope-4ae434`) 178~182행 — "…불릿을 보존하고, 문구가 바뀌면 형제 트래커의 인용도 함께 갱신한다"는 자기 가드레일을 스스로 못 지킴 | 해당 plan 에 "2026-08-23 `nodeoutput-allowlist` PR 이 REST `getStatus` 출구를 종결(SSE/fanout 별도 잔여)" 각주 추가 — 별개 worktree라 이번 PR 범위 밖, planner 인계 메모로 남김 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | (carry-over, 이번 diff 밖) `EIA-NF-05` plain-text 섹션 참조 어긋남 — 실제 lock 서술은 §5.6 인데 §5.3 인용 | `spec/5-system/14-external-interaction-api.md` §3.5 `EIA-NF-05` 행 | `§5.3` → `§5.6` 정정 (별도 처리 무방) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 핵심 변경 내부 정합 양호. `conversation-thread.md` 의 §R17 인용 1건만 stale |
| rationale_continuity | NONE | 발견 없음 — 기존 원칙(3-출구 열거) 그대로 계승, 기각된 대안 재도입 없음 |
| convention_compliance | LOW | `code:` frontmatter 누락 1건 + `node-output.md` Principle 0 미동기 1건 (둘 다 WARNING, CRITICAL 없음) |
| plan_coherence | LOW | 트래커 flip 자체는 정당(3라운드 ai-review + impl-prep 반영), 형제 plan 인용 동기화만 누락 |
| naming_collision | NONE | 신규 식별자 4종·경로 1건 전수 grep, 충돌 없음 |

## 권장 조치사항
1. (선택, 우선순위 낮음) `spec/conventions/conversation-thread.md` 388행 §R17 인용을 최신 상태("`getStatus` 해소, SSE 잔여")로 정정.
2. `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 목록에 `codebase/backend/src/shared/utils/node-output-allowlist.ts` 추가.
3. `project-planner` 턴에서 `spec/conventions/node-output.md` Principle 0 을 wire-only 4키(`formConfig`/`conversationConfig`/`buttonConfig`/`interactionType`) 존재를 반영하도록 갱신하거나, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 정식 잔여 항목으로 등재.
4. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (7)항목에 이번 §R17 flip 을 반영하는 각주 추가 — 다른 worktree 소관이므로 해당 세션에 인계.
5. (선택) `EIA-NF-05` §5.3 → §5.6 섹션 참조 정정.

BLOCK 사유 없음 — 위 4건은 모두 WARNING 이며 push/turn-end 게이트를 차단하지 않는다.
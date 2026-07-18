# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 이번 changeset(merge-base `22cc48ef3` 기준: `interaction-type-registry.ts` JSDoc 정정, `interaction-type-exhaustiveness.test.ts` self-test fixture 보강, `interaction-type-guard-comment-false-negative.md` 체크박스 해소)은 spec/plan 어디와도 충돌하지 않으며, 5개 checker 전원이 harness payload 번들러의 기지(旣知) 결함(target 100% 치환)을 독립적으로 재현·우회했다. 유일한 실질 조치 필요 항목은 plan bookkeeping 갭(아래 WARNING #3) 1건.

## 참고 — 5개 checker 공통 사전 확인 (harness known issue, 비차단)
5개 checker 모두 prompt 에 번들된 "Target 문서"가 `spec/conventions/audit-actions.md` + `spec/conventions/cafe24-api-catalog/**`(222개 field 파일) 로 사실상 전량 치환되어 실 target(`spec/conventions/interaction-type-registry.md`)이 배제된 것을 독립적으로 발견했다. 이는 `plan/in-progress/interaction-type-guard-comment-false-negative.md` (harness 항목, 이미 "[심각도 격상 2026-07-18]"로 기록)가 예견한 known failure pattern 의 재현이며, 전원이 워크트리 직접 조사(`git diff`/`git merge-base`/`Read`)로 우회해 판정했다. 추가로 `origin/main`(HEAD `d25f552b2`, PR #978)이 이 브랜치의 fork-point(`22cc48ef3`) 이후 병렬 세션에서 독립 병합돼 있어 `git diff origin/main` 이 reverse-diff 오염(이 브랜치가 만들지 않은 "제거"가 보이는 현상)을 일으킨다는 점도 convention_compliance/plan_coherence/naming_collision/rationale_continuity 가 공통으로 확인했다. 두 결함 모두 이 브랜치 자체의 결함이 아니며 이미 별도 harness 트랙으로 분기 대상으로 기록되어 있다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 리뷰 payload 번들링이 target 규약(`interaction-type-registry.md` 등)을 100% 대체 — 기존 harness 결함의 심화 재현(0건까지 잘림) | `_prompts/convention_compliance.md` "## Target 문서" 섹션 | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 target 파일 선택/예산 로직 | 신규 조치 불필요 — `plan/in-progress/interaction-type-guard-comment-false-negative.md` 가 이미 별도 harness task 로 분기하기로 기록. WARNING #3 참고 (분기 산출물 미확인) |
| 2 | convention_compliance / plan_coherence / naming_collision / rationale_continuity | diff-base(`origin/main`)가 이 브랜치의 fork-point(`22cc48ef3`) 이후 병렬 PR #978(`d25f552b2`)을 이미 병합해 `git diff origin/main` 이 reverse-diff 오염(이 브랜치가 만들지 않은 "삭제"가 보임) | `git diff origin/main` 결과 중 `node-handler.interface.ts`, `information-extractor.handler.ts`, `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` | 병렬 세션 PR #978 (`docs(ai-nodes): IE endMultiTurnConversation` 계약 문서화) | 이 task 의 fix 불요. PR 병합 전 이 브랜치를 `origin/main` 위로 rebase/merge 해 #978 의 docblock 정합화(및 인터페이스-구현 선재 불일치)를 흡수 권장 |
| 3 | plan_coherence | `interaction-type-guard-comment-false-negative.md` harness 항목이 "별도 harness task 로 분기 완료 — 이로써 종결 조건 충족"이라 서술하지만, 체크박스는 미해소(`[ ]`)인 채 구체적 task ID/plan 경로가 없어 분기 사실이 검증 불가능(자매 완료 plan `resumable-handler-generic-typing.md` 의 `task_1844c96b` 선례와 대비) | `plan/in-progress/interaction-type-guard-comment-false-negative.md` harness 항목 | `plan/in-progress/harness-guard-followups.md` 등 기존 harness plan 3종(키워드 0건 확인) | (a) 실제 task ID/plan 경로로 구체화, 또는 (b) 미분기 상태라면 "분기 예정"으로 표현을 낮추고 harness 담당에게 명시적으로 위임 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 이번 changeset 은 `spec/**` 을 전혀 변경하지 않았고, 도메인 인접 spec(`interaction-type-registry.md`)도 이미 정합 | `spec/conventions/interaction-type-registry.md` | 조치 불요 |
| 2 | rationale_continuity | JSDoc "grep 가드"→"AST 가드" 정정 및 self-test fixture 보강은 §5 Rationale("가드는 깨뜨려 봤다로만 신뢰") 및 저장소 전역 AST-우선 원칙(PR #971/#972)을 강화 | `interaction-type-registry.ts`, `interaction-type-exhaustiveness.test.ts` | 조치 불요. `.tsx`/`ScriptKind` 분기 미추가 결정도 실측 근거(6종 프로브)로 정당화됨 — 향후 실제 `.tsx` 등록 사이트 발생 시 이 철회 근거를 spec §5 각주로 승격 고려(선택) |
| 3 | convention_compliance | 실질 신규 변경 3건 모두 `interaction-type-registry.md` §1.2/§2.1/§5 와 완전 정합 | `interaction-type-registry.ts`, `interaction-type-exhaustiveness.test.ts` | 조치 불요 |
| 4 | plan_coherence | `.tsx` 등록 사이트/`ScriptKind` 분기 철회 결정이 다른 어떤 plan/spec 과도 충돌하지 않음(corpus 전수 검색 0건) | `plan/in-progress/interaction-type-guard-comment-false-negative.md` | 조치 불요 |
| 5 | naming_collision | 신규 문자열은 test fixture 더미 리터럴 4종(`real_union_a`/`real_union_b`/`real_prop`/`ghost_regex`)뿐이며 테스트 파일 스코프에 갇혀 충돌 표면 없음(grep 확인) | `interaction-type-exhaustiveness.test.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec/** 무변경, 도메인 인접 spec 과도 정합 |
| rationale_continuity | NONE | 실 변경은 §5 Rationale 및 AST-우선 원칙 강화, 위반/번복 없음 |
| convention_compliance | LOW | payload 100% 치환 + reverse-diff 오염(둘 다 known, 비차단), 실 변경분은 규약 준수 |
| plan_coherence | LOW | 실 변경은 plan 후속 항목과 정확히 대응. harness "분기 완료" 주장이 산출물 미확인(bookkeeping 갭) |
| naming_collision | NONE | 신규 식별자 없음. test fixture 더미 문자열만 존재, 충돌 표면 없음 |

## 권장 조치사항
1. (선택, 비차단) `plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 "별도 harness task 로 분기 완료" 서술을 실제 task ID/plan 경로로 구체화하거나 "분기 예정"으로 낮추고, harness plan 에 항목을 신설해 명시적으로 위임할 것 (WARNING #3).
2. (선택, 비차단) 이 브랜치를 PR 병합 전 `origin/main` 위로 rebase/merge 해 병렬 PR #978 의 `endMultiTurnConversation` docblock 정합화를 흡수할 것 (WARNING #2). 현재 이 브랜치가 그 파일들을 건드리지 않으므로 텍스트 충돌 리스크는 낮음.
3. (harness 트랙, 이 세션 범위 밖) consistency-checker orchestrator 의 target 번들링 예산 로직(`consistency_orchestrator.py`)이 `spec/conventions/` alphabetical 순회 중 `cafe24-api-catalog/**` 로 예산을 소진하는 결함을 근본 수정할 것 (WARNING #1, 이미 3회 재현 기록됨).

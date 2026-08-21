# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. 다만 target 이 스스로 경고한 "자매 발산 재발" 패턴이 세 갈래로 실측 확인됐으므로, `plan/complete/` 로 이동시키기 전에 아래 WARNING 을 반영할 것을 강력 권고.

## 전체 위험도
**MEDIUM** — target 문서(`spec-update-masked-reject-framing.md`)의 두 정정(§6 시점, "재제출 경로 한정" 프레이밍) 자체는 코드·§R17 SoT 와 정확히 일치하지만, frontmatter `spec_impact`/grep 스코프가 본문이 실제로 다루거나 다뤄야 할 파일보다 좁다 — 정확히 target 이 경계하는 결함 계열이 세 곳(1개는 spec 본문, 2개는 plan lineage/frontmatter)에서 재발했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, plan_coherence | target 의 정정 2("재제출 경로 한정"→"Manual 실행 경로 한정")가 잡은 자매 두 곳(`3-error-handling.md:193`, `12-webhook.md:312`) 외에, 동일 계열의 "재제출 경로에서" 프레이밍이 `spec/1-data-model.md:471`(`Execution.input_data` 행)에도 남아 있고 target 의 `spec_impact`/정정 범위 밖이다 | `plan/in-progress/spec-update-masked-reject-framing.md` "정정 2" 절 + frontmatter `spec_impact` | `spec/1-data-model.md:471` | `spec_impact` 에 `spec/1-data-model.md` 추가, 471행 "재제출 경로에서" → "Manual 실행 경로(저작 주체 기준)에서" 로 정정 2 와 동일하게 정정. `git log` 확인 결과 이 문장은 커밋 `3e96f4b44`(폐기된 "출처 기준" 프레이밍)에서 작성됐고 후속 정정 커밋 `871d3fcb0`이 이 파일을 놓쳤다 |
| 2 | convention_compliance, plan_coherence(INFO) | target 본문 "⚠️ 절차 위반을 먼저 적는다 (W3)" 절이 developer 커밋 `50f799efd`가 고친 `spec/5-system/14-external-interaction-api.md` §R17 표 행을 "이 문서의 승인 범위 안에 명시적으로 편입한다"고 선언하지만, frontmatter `spec_impact` 목록에는 이 파일이 없다 | frontmatter `spec_impact` (L8-11) vs 본문 W3 절 (L41-55) | `spec/5-system/14-external-interaction-api.md` | `spec_impact` 에 `spec/5-system/14-external-interaction-api.md` 추가 — Gate C 기반 후속 감사(spec-coverage 등)가 이 편입을 놓치지 않도록 |
| 3 | plan_coherence | target 정정 1(§6 시점 "직후"→"전후")의 원인이 된 선행 plan `plan/in-progress/spec-draft-inputoverride-marker-reject.md`(같은 worktree, `status: in-progress`) 항목 5(a)가 지금도 "시점은 adapter `resolveTriggerParameters` 직후"라는 낡은 지시를 그대로 담고 있다 | `plan/in-progress/spec-update-masked-reject-framing.md` "정정 1" 절 | `plan/in-progress/spec-draft-inputoverride-marker-reject.md` 항목 5(a) | 선행 plan 항목 5(a)에 "→ `spec-update-masked-reject-framing.md` 로 정정됨" 각주를 달거나, target 정정과 함께 해당 plan 을 완료 처리해 `plan/complete/` 로 이동 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 정정 1의 "왜 2단계인지" 근거가 표 캐비엇 한 줄에만 남으면, 코드 쪽 JSDoc(60줄 넘는 표·반례)과 비대칭이라 다음 검토자가 `## Rationale` 을 훑어도 못 찾는다 | `1-manual-trigger.md` §6 표 vs `## Rationale` 섹션 | 표 캐비엇 + `## Rationale` 하위 신규 항목(예: `### masked_value_resubmitted 검사 시점 — raw 우선 + resolve 후 재검사`) 둘 다로 남길 것. `restoreVersion` 항목과 같은 형식 권장 |
| 2 | cross_spec | target 의 기술 진단(정정 1·정정 2) 자체는 코드(`reject-masked-resubmission.ts`)·§R17 SoT 와 대조해 정확함을 확인 — 조치 불요, 기록용 | 정정 1·정정 2 절 | 없음 |
| 3 | convention_compliance | 정정 2 절의 "`3-error-handling.md:193`", "`12-webhook.md:312`" 라인 번호 고정 참조는 검토 시점 기준 정확하나, 실행 전 다른 편집이 들어오면 stale 해질 수 있음 | "정정 2" 절 (L53) | 실제 편집 시점에 라인 번호 대신 절 제목으로 재확인 후 진행 (target 자체를 지금 고칠 필요는 없음) |
| 4 | rationale_continuity | W3(developer 턴의 spec 직접 수정)는 절차 위반이나 정정 2 대상 파일과 인과적으로 얽혀 있음 — target 이 이미 사후 정규 경로로 흡수를 명시했으므로 별도 조치 불요 | "⚠️ 절차 위반을 먼저 적는다 (W3)" 절 | 없음 (기록용) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `spec/1-data-model.md:471` 이 정정 2 와 같은 "재제출 경로" 계열 문구를 갖고 있으나 스코프 밖 |
| rationale_continuity | LOW | 두 정정 모두 §R17 canonical Rationale·실코드에 정확히 정렬됨. 근거 승격 제안만 남음 |
| convention_compliance | LOW | frontmatter `spec_impact` 가 본문 선언 스코프(4번째 파일)를 누락 |
| plan_coherence | MEDIUM | 선행 plan 의 stale "직후" 지시 + `1-data-model.md:471` 누락, 두 겹의 lineage drift |
| naming_collision | NONE | 신규 식별자 도입 없음 — wording-only 정정이라 충돌 대상 자체가 없음 |

## 권장 조치사항
1. `spec_impact` 에 `spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md` 두 파일을 추가하고, `spec/1-data-model.md:471` 의 "재제출 경로에서" 문구를 정정 2 와 동일 기준으로 정정한다 (WARNING #1, #2).
2. 정정 2 의 grep 스윕을 `재제출.*(한정|경로)` 등 변형 포함 패턴으로 재실행해 네 번째 잔여처가 없는지 재확인한다 (cross_spec/plan_coherence 공통 제안).
3. 선행 plan `spec-draft-inputoverride-marker-reject.md` 항목 5(a)에 정정 반영 각주를 달거나 완료 처리한다 (WARNING #3).
4. (선택) 정정 1의 근거를 `1-manual-trigger.md` `## Rationale` 섹션에도 정식 항목으로 남긴다 (INFO #1).
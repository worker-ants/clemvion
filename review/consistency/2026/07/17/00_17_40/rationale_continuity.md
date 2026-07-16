# Rationale 연속성 검토 결과

## 검토 범위 확인

`scope=spec/conventions/`, `diff-base=origin/main`. 실제 diff 를 직접 확인한 결과 (`git diff origin/main -- spec/conventions/`), 이번 변경은 4개 파일의 소규모 수정뿐이다 (prompt 에 전문이 첨부된 `audit-actions.md`·`cafe24-api-catalog/**` 는 이번 diff 에서 변경되지 않은 기존 콘텐츠 — scope 전체 read 로 포함된 것으로 판단):

1. `spec/conventions/cross-node-warning-rules.md` — 링크 경로 수정 (`plan/in-progress/parallel-p2-followups.md` → `plan/complete/parallel-p2-followups.md`)
2. `spec/conventions/execution-context.md` — 동일 링크 경로 수정 (§원칙 2 "결정 G" 각주)
3. `spec/conventions/node-cancellation.md` — 동일 링크 경로 수정
4. `spec/conventions/spec-impl-evidence.md` — `spec-link-integrity.test.ts` 가드 표 행의 서술 정정

1~3 은 `plan/in-progress/parallel-p2-followups.md` 가 `plan/complete/`로 실제 이동한 사실을 반영한 순수 경로 교정이다 (`plan/complete/parallel-p2-followups.md` 실존 확인, `plan/in-progress/` 쪽은 부재 확인). 링크 대상 파일 이동에 따른 기계적 수정이며 설계 결정·Rationale 과 무관하다 — 기각된 대안 재도입, 원칙 위반, 무근거 번복, invariant 우회 어디에도 해당하지 않는다.

4는 아래 상세.

## 발견사항

- **[INFO]** `spec-impl-evidence.md` 가드 표 정정 — 근거를 `## Rationale` 이 아닌 표 셀에만 기재
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4 가드 표, `spec-link-integrity.test.ts` 행
  - 과거 결정 출처: 동일 문서 자체 (동일 문서 §4 표의 기존 서술 — "plan/ 링크(=plan-coherence 담당)")
  - 상세: 이번 diff 는 "spec 문서가 `plan/**` 를 가리키는 링크는 plan-coherence-checker 가 담당하므로 `spec-link-integrity.test.ts` 검증 대상에서 제외된다"는 종전 서술을 "실제로는 spec 본문 스캔(1)에 target 필터가 없어 `plan/**` 링크도 검증 대상이며, plan-coherence-checker 는 `plan/**` 문서 *내부* 링크 위생만 담당한다"로 뒤집는다. 이는 설계 결정의 번복이 아니라 **가드 동작에 대한 기존 오기(誤記)를 실측(테스트 동작)에 맞춰 바로잡은 정정**으로 보인다 — `.claude/skills/consistency-checker/SKILL.md` 의 `plan-coherence-checker` 정의("`plan/in-progress/**` 미해결 결정·선행 plan 미해소·후속 항목 누락")도 "spec→plan 링크 유효성"을 언급하지 않아 정정된 서술과 부합한다. 다만 이 문서는 §Rationale 에 R-1~R-10 형태로 유사한 표-셀 뉘앙스를 문서화하는 관행이 있는데(R-7 이 카탈로그 제외 각주를, R-9 가 §4.2 family 분리를 별도 R-항목으로 정식화), 이번 정정은 표 셀 안의 긴 인라인 각주로만 존재하고 `## Rationale` 에는 대응 항목이 없다.
  - 제안: 필수는 아니나, 문서 자체의 기존 패턴과의 일관성을 위해 `## Rationale` 에 짧은 R-11 (또는 기존 R-9 "§4.2 family 분리" 항 보강)로 "spec→plan 링크는 `spec-link-integrity` 담당, plan 문서 내부 링크는 `plan-coherence-checker` 담당"이라는 책임 경계를 명문화하는 것을 권장. 향후 동일 오기가 재발하지 않도록 SoT 를 표 셀이 아니라 Rationale 섹션에 두는 편이 이 문서 자신의 관행과 정합적이다.

교차 검증한 항목 (문제 없음, 기록만):
- `spec/conventions/audit-actions.md` §3 레지스트리의 `workspace.transfer_ownership`(§2.3 유지)와 `## Rationale` "기각된 대안 — `ownership_transferred` 정규화 기각" 은 일치. 재도입 없음.
- `spec/conventions/cafe24-api-catalog/_overview.md` `## Rationale` "미문서화 seed 9개 outright 제거" 대상(`webhooks_list`, `mains_update`/`mains_delete` 등)이 `application.md`/`category.md` 표에 재등장하지 않음을 확인 — 기각·제거된 항목의 재도입 없음.

## 요약

이번 `spec/conventions/` 변경분은 실질적으로 plan 이동에 따른 링크 경로 교정 3건과 가드 서술 정정 1건뿐이며, 어느 것도 기존 spec `## Rationale` 이 명시적으로 기각한 대안을 재도입하거나 합의된 설계 원칙·invariant 를 위반하지 않는다. `spec-impl-evidence.md` 의 서술 정정은 결정 번복이 아니라 오기 교정으로 판단되며, 다만 근거가 `## Rationale` 대신 표 셀 각주에만 있어 문서 자신의 기존 관행(R-1~R-10)과 약간의 배치 비일관이 있다(INFO). prompt 에 함께 첨부된 `audit-actions.md`·`cafe24-api-catalog/**` 콘텐츠는 이번 diff 대상이 아니며 교차 확인 결과 기존 Rationale 과 정합적이다.

## 위험도

LOW

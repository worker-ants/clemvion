# Consistency Check 통합 보고서 (--spec, 확장 draft) — **BLOCK: NO**

target: `plan/in-progress/table-label-eval-vars.md`. table.md §1↔§4 label 평가 변수 불일치 정정 + (1차 발견) expression.md §4.1/§8.3.3 동일 불일치 정합 + ## Rationale 신설.

## 판정: BLOCK: NO (5 checker 전수, journal 확보)
- cross_spec **NONE** · rationale_continuity **NONE** · naming_collision **NONE** · plan_coherence **NONE**(journal) · convention_compliance **LOW**(INFO만).
- (plan_coherence FS-flakiness 로 디스크 미기록 → journal 복구: CRITICAL/WARNING 0, cross-link INFO만.)

## 수렴
| 라운드 | 발견 | 처분 |
|---|---|---|
| 18_19_18 | cross_spec WARNING×2: expression.md §4.1(L185)·§8.3.3(L497)에 동일 field/label 과대 서술 / rationale WARNING: 정정 근거 ## Rationale 기록 요망 | scope 확장(expression.md 2곳 + spec_impact 추가) + table.md ## Rationale R-1 신설 |
| 18_29_10 | INFO만: `## Rationale` R-4 앵커 오기(실제 workflow-list "§4"), `### R-1 —` em dash(규약은 마침표) | 반영: `§4 (태그 필터 단일화)` 링크·`### R-1.` 마침표 |

## 코드 ground truth (`table.handler.ts`)
- 셀/field(`:101-103`, per-row): `$dataSource`+`$sourceItem`+`$sourceItemIndex`.
- 라벨/label(`resolveColumnLabels :214-217`, dynamic 1회): `$dataSource` **만**.
→ §4-7 정확, §1(+expression §4.1/§8.3.3)이 과대 → 코드 진실로 정정(번복 아닌 최초 확정, rationale_continuity "도입 커밋 db496a3c2 당시 과대 일반화" 확인).

## 반영 파일
- `2-table.md`: §1 "가용" 열(셀·라벨/셀만) · §4-7 cross-ref · ## Rationale R-1 신설.
- `5-expression-language.md`: §4.1 note · §8.3.3 table 행 field/label 세분화.

→ spec 반영 완료. spec-link 11/11 PASS.

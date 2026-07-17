# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음. 전 항목이 INFO 수준(비차단).

## 전체 위험도
**LOW** — `spec/`은 이번 diff에서 전혀 수정되지 않았고(실제 변경은 `interaction-type-exhaustiveness.test.ts` 1개 파일의 정규식→TS AST 파싱 전환 + plan 문서 1건뿐), 유일한 잔여 이슈는 spec 문서 내 "grep" 표현의 용어적 staleness(이미 plan에 후속 항목으로 이월됨)와 이번 검토 prompt 번들링/diff-base 자체의 harness 결함(대상 spec 본문 누락, `origin/main`이 fork-point보다 앞서 있어 발생하는 reverse-diff 오염).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision (전원 공통 지적) | 검토 prompt 번들에 실제 target spec(`spec/conventions/interaction-type-registry.md`) 본문이 누락되고, 대신 무관한 `audit-actions.md`·`cafe24-api-catalog/**` 대용량 덤프가 채워짐 | prompt "Target 문서" 번들 | 전원 워킹트리 절대경로 직접 조회로 독립 검증해 결론엔 영향 없음. harness 번들러가 대용량 카탈로그 디렉터리를 별도 처리하거나 diff가 실제 참조하는 `code:`/`spec_impact` 파일을 우선 포함하도록 개선 권고 (비차단, 반복 발생 패턴이므로 orchestrator 개선 항목으로 기록) |
| 2 | cross_spec, convention_compliance | 지정된 `diff-base=origin/main`이 이 브랜치의 fork-point(`099f63ccadfdf9ce99d42c7dae0253d2557ae86d`)보다 앞서 있어(origin/main에 이후 커밋 `cdad5a1ec`, `29aa918a6` 포함), 그대로 diff하면 `spec/conventions/frontend-layering.md` 삭제 등 본 PR이 만들지 않은 변경까지 섞이는 reverse-diff 오염 발생 | prompt 상단 diff (diff-base 지정) | 두 checker 모두 fork-point SHA로 재계산해 우회 검증. 향후 diff-base는 `origin/main` 대신 fork-point SHA를 명시할 것 (기존에 문서화된 known failure pattern과 동일) |
| 3 | cross_spec, rationale_continuity, convention_compliance, plan_coherence | `spec/conventions/interaction-type-registry.md` §1.2 rule 3·§2.1(`system_error`/`rag` 행)·§5의 "grep 대상 파일"/"grep 검증 대상"/"코드 grep 결과" 표현이, 이번 diff로 구현이 순수 TS AST 파싱으로 전환된 이후 실체와 다소 어긋남 | `spec/conventions/interaction-type-registry.md` §1.2, §2.1, §5 | 이미 `plan/in-progress/interaction-type-guard-comment-false-negative.md` "후속(본 PR 범위 밖)" 섹션이 명시 이월했고, 직전 impl-prep 검토(`review/consistency/2026/07/17/19_54_00/`)도 동일하게 비차단 선택 항목으로 판정한 사안. project-planner가 별도 턴에서 "grep"→"AST(코드 리터럴 스캔)" 류로 표현만 다듬으면 됨. 이번 PR을 막을 사유 아님(중복 보고, 신규 조치 불요) |
| 4 | convention_compliance | 직전 impl-prep 리뷰가 지적한 테스트 파일 JSDoc/주석의 "grep" 서술("AST/grep guard", "grep-finds", "Known limitation" 주석 등)이 실제로 "AST guard"/AST 파싱 서술로 정확히 갱신되고 해소된 known-limitation 주석은 삭제됨을 확인 | `interaction-type-exhaustiveness.test.ts` 상단 JSDoc, `ENUM_VALUES` 주석 | 이행 확인 완료, 추가 조치 불요 |
| 5 | cross_spec | `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` 목록과 enum 값 SoT(`interaction-type-registry.ts`)가 spec §1.2/§2.1 표와 정확히 일치하며 이번 diff로 변경되지 않음 (매칭 알고리즘만 교체) | `interaction-type-exhaustiveness.test.ts` L40-44, L167-169 | 조치 불요 (확인용 기록) |
| 6 | convention_compliance | `spec/conventions/interaction-type-registry.md` frontmatter `code:` spec-link는 파일 경로 변경이 없어 dangling 없이 그대로 유효 | frontmatter `code:` 항목 | 조치 불요 |
| 7 | convention_compliance | 저장소 내 다른 문서(`migrations.md`, `i18n-userguide.md` §113)도 여전히 정규식 기반 정적 파싱 가드를 채택 중이라, 이번 AST 전환이 "정규식 가드 전면 금지"류의 공식 규정과 상충하지 않음(그런 규정 자체가 존재하지 않음) | `spec/conventions/migrations.md`, `spec/conventions/i18n-userguide.md` | 조치 불요 |
| 8 | naming_collision | 신규 식별자(`collectCodeStringLiterals` 함수, 관련 `describe` 스위트명, fixture 문자열 `real_literal`/`real_template`/`ghost_*`)는 모두 테스트 파일 내부 스코프에 국한되며 저장소 전역에서 이름 충돌 없음 | `interaction-type-exhaustiveness.test.ts` (신규 헬퍼 함수·픽스처) | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/**` 미변경 확인(fork-point 기준 재계산). 매칭 알고리즘 교체만, SoT/매트릭스 무변경. prompt 번들 결함·diff-base 오염을 INFO로 기록 |
| rationale_continuity | LOW | 어떤 Rationale도 재도입·번복 없음. §5 "가드는 깨뜨려 봤다로만 신뢰" 원칙에 따라 mutation 실측으로 PR #968 known limitation 해소. 잔여 "grep" 용어 staleness만 INFO |
| convention_compliance | NONE | `spec/conventions/**` 미수정, spec-link 유효, impl-prep 권고(JSDoc 갱신) 이행 확인. 잔여 spec "grep" 표현은 impl-prep이 이미 승인한 defer |
| plan_coherence | NONE | 다른 `plan/in-progress/**` 문서의 미해결 결정·선행조건과 충돌 없음. plan 자체가 후속 항목을 정확히 식별·이월 |
| naming_collision | NONE | 신규 식별자 전부 테스트 파일 내부 국한, 저장소 전역 검색 결과 충돌 없음 |

## 권장 조치사항
1. (비차단, 선택) project-planner가 별도 후속 턴에서 `spec/conventions/interaction-type-registry.md` §1.2 rule 3·§2.1 두 행·§5 rule 2의 "grep 대상 파일"/"grep 검증 대상"/"코드 grep 결과" 표현을 "AST(코드 리터럴) 스캔 대상"류로 갱신 — 이미 plan 문서에 후속 항목으로 이월되어 있으며 이번 PR의 선행조건 아님.
2. (harness 개선, 비차단) consistency-check 번들러가 대상 diff와 무관한 대용량 카탈로그(`cafe24-api-catalog/**`) 때문에 실제 target spec 문서가 크기 한도로 잘려 누락되는 사례가 재발했다 — diff가 실제로 참조하는 `code:`/`spec_impact` 경로를 우선 포함하도록 번들링 로직 개선 권고.
3. (harness 개선, 비차단) 향후 diff-base 산정 시 `origin/main`이 이 브랜치 fork-point보다 앞서 있는 경우를 자동 감지해 fork-point SHA를 쓰도록 orchestrator 로직 보강 권고 — 동일 known failure pattern이 이번에도 재현됨(5개 checker 중 2개가 직접 감지·우회).

---

## 산출 경위 + main 의 독립 검증 (main 기록)

Workflow 반환의 `summary_written: false` / `summary_status: STATUS=write_blocked` — 하네스가 `SUMMARY.md` basename 을 sub-agent 에게 write 허용하지 않으므로, 본 파일은 main 이 반환 `summary_markdown` 을 그대로 persist 한 것이다 (consistency-check skill §3 규약).

**분류기 장애 구간 실행 경고 대응**: 본 run 은 `claude-opus-4-8`(안전 분류기) 장애 구간에 실행돼 하네스가 "sub-agent 출력을 직접 검증하라" 경고를 붙였다. main 이 독립 확인한 사항:

- checker 5/5 `status: success` · `has_report: true`, `unfinished: []`, `recovered: []` — disk-write 갭으로 인한 카운트 누락(거짓 clean) 없음. 즉 CRITICAL=0 은 "checker 가 안 돌아서 0" 이 아니다.
- INFO #1·#2 의 harness 결함(번들 누락·reverse-diff 오염)은 **본 저장소에 이미 문서화된 known failure pattern** 과 동일하며, checker 들이 fork-point SHA(`099f63cca`) 재계산과 워킹트리 절대경로 직접 조회로 **스스로 우회**한 뒤 결론을 냈다. `plan_coherence`·`naming_collision` 의 리포트가 `git merge-base HEAD origin/main` 결과를 명시 인용해 실제 diff 가 2개 파일뿐임을 확인한 것이 교차 근거다.
- 따라서 "spec/ 미변경" 이라는 핵심 판정은 오염된 diff-base 가 아니라 fork-point 기준 재계산에 근거한다.

**SPEC-DRIFT 처리**: `/ai-review`(`review/code/2026/07/17/22_50_56/`)가 올린 [SPEC-DRIFT] 1건(spec 의 "grep" 부차 서술 stale)은 본 impl-done 에서도 INFO #3 으로 재확인됐고, **BLOCK 사유 아님** 으로 판정됐다. developer 는 `spec/` read-only 이므로 plan 의 "후속" 절에 project-planner 위임으로 이월 유지한다.

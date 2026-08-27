# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 모두 CRITICAL 0건)

## 전체 위험도
**LOW** — spec/conventions/ 안 이번 diff 의 유일한 변경(`spec-impl-evidence.md` §4.2 표 셀)이 하위 요약 문서(`PROJECT.md`)와 인접 plan 트래커(`harness-review-gate-followups.md`)로 완전히 전파되지 않은 국소 drift 3건(전부 WARNING)만 남음. 데이터 모델/API/요구사항ID/상태전이/RBAC/계층책임/명명 충돌은 5개 checker 전원 NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `PROJECT.md` §자동 가드 표의 `spec-link-integrity.test.ts` 행이 이번 PR 이 §4.2 에 추가한 scope(3) 거버넌스 문서를 반영하지 않음 — 같은 파일 안에 최신(§문서 링크 검증 절)/구식(§자동 가드 표) 스코프 서술이 공존 | `spec/conventions/spec-impl-evidence.md` §4.2 표, `spec-link-integrity.test.ts` 행 | `PROJECT.md:275` (§자동 가드 표) | `PROJECT.md:275` 를 `plan-frontmatter.test.ts` 행과 같은 패턴으로 "(1) spec 본문 (2) codebase JSDoc (3) 거버넌스 문서" 3-scope 요약으로 갱신 |
| 2 | plan_coherence | 신규 governance 스코프(루트 `*.md`+`.claude/**.md`)가 `extractLinks()` 의 알려진 멀티라인 링크 사각지대를 그대로 상속 — 실제로 `.claude/skills/code-review-agents/SKILL.md`·`.claude/skills/consistency-checker/SKILL.md` 에 해당 패턴이 실존함을 확인(이번엔 우연히 무해). 신규 fixture 도 이 사각지대를 재현하지 않음 | `spec/conventions/spec-impl-evidence.md:132` §4.2 표 셀 / `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` `extractLinks()` (105~111행) | `plan/in-progress/harness-review-gate-followups.md` §미해결 항목1 (2026-08-11 실측, `[ ]` 미해결) | `harness-review-gate-followups.md` 해당 항목에 "governance 스코프도 동일 사각지대 상속(2026-08-27 doclink-guard-scope, 실증 파일 2건)" 갱신 메모 추가, 또는 §4.2 서술에 멀티라인 미검증 캐비엇 명시 |
| 3 | plan_coherence | 이번 PR 이 두 차례 편집한 바로 그 표 셀에 이미 지적된 오기("plan-coherence-checker 가 plan/** 문서 내부 링크 위생을 담당한다")가 그대로 남음 — 실제 `plan_coherence` checker 정의(`role_instructions.py:249-256`)에 링크 검증 항목 없음을 재확인 | `spec/conventions/spec-impl-evidence.md:132` | `plan/in-progress/harness-review-gate-followups.md` §미해결 항목2 (2026-08-10 실측, `[ ]` 미해결) | 해당 문장을 "plan/** 문서 내부 링크 위생은 현재 어떤 checker/가드도 전담하지 않는다"로 정정하거나, 최소한 트래커에 "같은 셀 재편집됐으나 정정 미반영" 갱신 메모 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `## Rationale` R-9 의 §4.2 family 요약 괄호 문구("spec/plan 문서 자체의 구조·연결 무결성")가 이번에 추가된 scope(3) 거버넌스 문서를 담지 않아 오독 소지(모순은 아님) | `spec/conventions/spec-impl-evidence.md` `## Rationale` R-9 | "spec/plan **및 거버넌스** 문서 자체의 구조·연결 무결성"으로 한 구절 보강 |
| 2 | rationale_continuity | 신규 결정(governance 스코프 확장 + `check-doc-links.py` 폐기)이 이 문서의 관례(`R-1`~`R-10` 번호 절)를 따르지 않고 §4 표 셀 인라인 서술로만 존재 | `spec/conventions/spec-impl-evidence.md` §4 표 셀 | (선택) `## Rationale` 에 `R-11` 신설해 표 셀 서술 요약 인용 |
| 3 | naming_collision | 신규 함수/상수 4개(`collectGovernanceMarkdown` 등)는 기존 `collect*`/`findBroken*Links`/`*_SKIP_DIRS` 명명 패턴과 완전 정합, 전수 `git grep` 확인상 충돌 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` | 조치 불요 |
| 4 | naming_collision | "거버넌스" 용어가 `node-cancellation.md` 의 무관 산문 용례와 형태만 겹침(정식 식별자 아님, 도메인 분리로 혼동 여지 낮음) | `spec/conventions/spec-impl-evidence.md` §4.2 vs `spec/conventions/node-cancellation.md:166` | 조치 불요 |
| 5 | naming_collision | CI pathspec `:(glob)*.md`/`.claude/**` 신규 추가, 기존 pathspec 목록과 중복 없음(순수 추가) | `.github/workflows/spec-link-checks.yml` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 6개 관점(데이터모델/API계약/요구사항ID/상태전이/RBAC/계층책임) 전부 충돌 없음. 이미 code-review 2라운드가 잡은 SoT drift(§4.2 scope 3 미반영)는 이번 대조에서 정정 확인됨 |
| rationale_continuity | LOW | 기각된 대안 재도입·무근거 번복 없음. R-9 요약 문구 미갱신, 신규 결정이 번호 있는 R-N 절 대신 표 셀 인라인으로만 존재 (둘 다 INFO) |
| convention_compliance | LOW | target 문서 자체는 구조·frontmatter·명명·내용 정확성 전부 준수. `PROJECT.md` §자동 가드 표로의 전파만 누락(WARNING 1건) |
| plan_coherence | LOW | 같은 표 셀에 얽힌 선행 plan 미해소 2건(`harness-review-gate-followups.md`) — 멀티라인 링크 사각지대 상속(실증 확인), plan-coherence-checker 오귀속 오기 미정정 |
| naming_collision | NONE | 신규 식별자(함수/상수 4개, CI pathspec 2줄) 전수 grep 결과 기존 저장소와 충돌 없음. 명명 패턴 기존 자매 식별자와 일관 |

## 권장 조치사항
1. `PROJECT.md:275` §자동 가드 표의 `spec-link-integrity.test.ts` 행을 3-scope(spec 본문/codebase JSDoc/거버넌스 문서)로 갱신해 같은 파일 안 서술 불일치를 해소 (WARNING #1).
2. `plan/in-progress/harness-review-gate-followups.md` 의 두 미해결 항목(멀티라인 링크 사각지대, plan-coherence-checker 오귀속)에 이번 PR 관련 갱신 메모를 추가 — 근본 수정은 이 PR 범위 밖이어도 무방하나, 알려진 리스크가 스코프 확장으로 실증됐다는 사실과 같은 셀 재편집 사실은 트래커에 남겨야 함 (WARNING #2, #3).
3. (선택, 비차단) `## Rationale` R-9 문구 보강 또는 `R-11` 신설로 신규 결정을 문서 관례에 맞게 승격 (INFO #1, #2).
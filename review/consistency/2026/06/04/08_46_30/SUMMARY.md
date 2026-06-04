# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**HIGH** — `spec/conventions/spec-impl-evidence.md` 자체의 frontmatter `code:` 와 §4 가드 표가 이번 diff 로 추가된 신규 가드 4건을 반영하지 않아, 이 컨벤션 문서의 단일 진실(SoT) 역할이 자기 자신에서 깨진 상태

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 에 신규 구현 가드 4건(`plan-frontmatter.test.ts`, `spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-plan-completion.test.ts`) + 헬퍼 1건(`spec-links.ts`) 미등록 — spec 이 약속한 surface 와 구현 현황 불일치, SoT 자기파괴 | `spec/conventions/spec-impl-evidence.md` frontmatter `code:` (line 4–10) 및 §4 Build-time 가드 표 | `spec/conventions/spec-impl-evidence.md §2.1` (status: implemented 스펙의 code: ≥1 매치 의무), §4 가드 표 선언 | frontmatter `code:` 에 5개 경로 추가 + §4 표 제목에서 "(4건)" 제거 및 신규 4개 가드 행 추가 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | §4 Build-time 가드 표 제목이 "(4건)"으로 고정되어 있으나 실제 가드는 8건 이상으로 확장됨 — 독자 오해 유발 | `spec/conventions/spec-impl-evidence.md §4` (라인 100–107) | 실제 구현된 가드 파일 수 | §4 제목을 "Build-time 가드" (숫자 제거)로 갱신 후 신규 4개 가드 행 추가 |
| 2 | Convention Compliance | Gate C 도입 배경·`spec_impact` 필드 설계·cutoff 그랜드파더링 정책 Rationale 부재 | `spec/conventions/spec-impl-evidence.md §Rationale` (라인 174–215) | CLAUDE.md §정보 저장 위치 — "결정의 배경·근거는 spec 문서 끝의 Rationale에 기재" | `## Rationale` 에 `### R-8. Gate C — plan-completion spec-consistency` 항목 추가 |
| 3 | Convention Compliance | `spec-area-index.test.ts` 와 `spec-link-integrity.test.ts` 가 §4 분류 구조 밖에 위치 — "frontmatter/lifecycle 가드"와 "구조·링크 무결성 가드"가 혼재 | `spec/conventions/spec-impl-evidence.md §1`, §4 | 단일 진실 원칙 | §4에 소섹션(`### 4.1 Frontmatter/lifecycle 가드`, `### 4.2 구조·링크 무결성 가드`) 분리 |
| 4 | Cross-Spec | PROJECT.md §자동 가드 목록에 신규 가드 4건 미등재 — spec-impl-evidence §6 Rollout step 4 미이행 | `spec/conventions/spec-impl-evidence.md §4.2` | `PROJECT.md §자동 가드 (build-time 차단)` (line 233–254) | `PROJECT.md §자동 가드` 목록에 4건 추가 |
| 5 | Cross-Spec | `doc-sync-matrix.json` 에 신규 가드 미반영 — `test_row_count_matches_project_md_table` 검증이 향후 PROJECT.md 갱신 시 실패 가능 | `spec/conventions/spec-impl-evidence.md §4.2` | `.claude/config/doc-sync-matrix.json`, `.claude/tests/test_doc_sync_matrix.py` | PROJECT.md 목록 추가와 동시에 `doc-sync-matrix.json` 에 해당 rows 추가 |
| 6 | Rationale Continuity | `plan-frontmatter.test.ts` 의 sentinel/플레이스홀더 거부 규칙이 SoT로 위임된 `plan-lifecycle §4` 에 미등재 — "SoT = plan-lifecycle §4" 선언이 실제 규약 범위보다 좁음 | `spec/conventions/spec-impl-evidence.md §4.2` 표 비고 | `.claude/docs/plan-lifecycle.md §4` | plan-lifecycle §4 에 `(unstarted)` sentinel 허용 및 레거시 플레이스홀더 거부 규칙 명시, 또는 §4.2 비고에서 SoT 위임 범위 분리 명시 |
| 7 | Plan Coherence | `spec-drift-gates.md §C` 체크박스가 `[ ]` 미갱신 — Gate C 가 `spec_impact` frontmatter 방식으로 설계 변경 구현됐으나 plan 추인 미반영 | `spec/conventions/spec-impl-evidence.md §4.2`, `spec-plan-completion.test.ts`, Rationale R-8 | `plan/in-progress/spec-drift-gates.md §C` | `spec-drift-gates.md §C` 체크박스를 `[x]` 로 갱신, 설계 변경 주석 추가. C+D 완료 시 plan을 complete로 이동 |
| 8 | Plan Coherence | `spec-drift-gates.md §D` 체크박스 `[ ]` 미갱신 — Gate D 도 `knowledge-base-quality-improvements.md` 에서 완료 처리됐으나 원 plan 미반영 | `spec/conventions/spec-impl-evidence.md §4.2` Gate D 행 | `plan/in-progress/spec-drift-gates.md §D` | §D 체크박스 갱신 후 plan complete 이동 검토 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec-impl-evidence.md` 자체 frontmatter `code:` 가 기존 파일 실존으로 `spec-code-paths.test.ts` gate 현재 통과 가능 상태 | `spec-impl-evidence.md` frontmatter `code:` | 참고 유지 |
| 2 | Cross-Spec | Gate C cutoff `2026-06-04` — spec-impl-evidence R-8, plan-lifecycle §5, 테스트 코드 3곳 현재 동기화 일치 | `spec-impl-evidence.md R-8`, `plan-lifecycle.md §5`, `spec-plan-completion.test.ts` | 향후 cutoff 변경 시 3곳 동시 갱신 |
| 3 | Cross-Spec | `spec/conventions/` flat reference 면제 선언이 `spec-area-index.test.ts:196` 구현과 일치 | `spec-impl-evidence.md §4.2` 비고, `spec-area-index.test.ts:196` | 없음 |
| 4 | Rationale Continuity | R-8 의 "3곳 동기" 의무 중 `plan-lifecycle` 에 `spec_impact` 필드 미등재 | `spec-impl-evidence.md R-8`, `.claude/docs/plan-lifecycle.md §4` | plan-lifecycle §4 또는 §5 에 `spec_impact` 필드와 Gate C cutoff 추가, 또는 R-8 선언 범위 축소 |
| 5 | Rationale Continuity | `spec/conventions/` flat-reference 면제의 Rationale 기재 부재 — 추후 index 추가 시 가드 충돌 가능 | `spec-impl-evidence.md §Rationale` | R-9 에 flat-reference 설계 이유 한 줄 추가 |
| 6 | Rationale Continuity | Gate C `collectCompletePlans` 의 `archive/` 통째 제외 결정이 spec-impl-evidence 에 미명시 | `spec-plan-completion.test.ts:655–675`, `plan-lifecycle.md §1` | R-8 또는 §4.2 에 "Gate C 는 `plan/complete/archive/` 하위를 역사 보관용으로 제외" 한 줄 추가 |
| 7 | Plan Coherence | `fix-spec-frontmatter-catalog.md` WARNING#2 후속 항목(§1 제외 기술 표현 명확화)이 stale worktree에 묶여 추적 소실 위험 | `plan/in-progress/fix-spec-frontmatter-catalog.md §후속 WARNING#2` | 별도 task로 분리 또는 `knowledge-base-quality-improvements.md` 에 흡수 |
| 8 | Plan Coherence | `spec-link-integrity.test.ts` build 차단 등재 시점과 링크 수정 78건 완료 여부 정합 불명확 | `spec-impl-evidence.md §4.2`, `knowledge-base-quality-improvements.md §item 1` | item 1 링크 수정 완료 여부 확인; 미완료라면 가드 조기 등재 주의 |
| 9 | Naming Collision | `repoRoot()` 함수가 `impl-anchor-parse.ts` 와 `spec-frontmatter-parse.ts` 두 파일에 중복 선언 — 신규 파일은 후자에서 일관 import하여 오동작 없음 | `codebase/frontend/src/lib/docs/__tests__/` | 향후 단일 shared helper(`test-utils.ts`)로 통합 검토 |
| 10 | Naming Collision | `spec-links.ts` 가 `__tests__/` 내에 위치하나 테스트 블록 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` | `spec-links-utils.ts` 로 명명 변경 또는 `lib/` 디렉토리로 이전 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | PROJECT.md §자동 가드 목록 + doc-sync-matrix.json 에 신규 가드 4건 미반영 (WARNING 2건) |
| Rationale Continuity | LOW | plan-frontmatter sentinel 규칙이 SoT 문서에 미등재 (WARNING 1건) |
| Convention Compliance | HIGH | spec-impl-evidence.md 자체 frontmatter code: 및 §4 표에 신규 가드 4건 누락 (CRITICAL 1건, WARNING 3건) |
| Plan Coherence | LOW | spec-drift-gates.md §C·§D 체크박스 미갱신 (WARNING 2건) |
| Naming Collision | NONE | 충돌 없음 (INFO 3건) |

## 권장 조치사항

1. **(BLOCK 해소 — 즉시 필수)** `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 에 5개 경로 추가:
   - `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
   - `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts`
   - `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
   - `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
   - `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`

2. **(BLOCK 해소 — 즉시 필수)** `spec/conventions/spec-impl-evidence.md §4` 표 제목을 `"Build-time 가드"` 로 변경하고 신규 가드 4건의 행 추가 (§4.1/§4.2 소섹션 분리 포함 권장)

3. **(WARNING 해소)** `PROJECT.md §자동 가드` 목록에 4건 추가 + `doc-sync-matrix.json` rows 동기화 — spec-impl-evidence §6 Rollout step 4 이행

4. **(WARNING 해소)** `spec/conventions/spec-impl-evidence.md §Rationale` 에 `### R-8. Gate C` 항목 추가 (도입 배경, `spec_impact` 필드 의미, 그랜드파더링 cutoff, plan-lifecycle §5 관계 기술)

5. **(WARNING 해소)** `.claude/docs/plan-lifecycle.md §4` 에 `(unstarted)` sentinel 허용 + 레거시 플레이스홀더 거부 규칙 명시, 또는 `spec-impl-evidence §4.2` 비고의 SoT 위임 범위 분리 명시

6. **(WARNING 해소)** `plan/in-progress/spec-drift-gates.md §C` + `§D` 체크박스를 `[x]` 로 갱신 (설계 변경 주석 추가), C+D 모두 완료이므로 plan을 `plan/complete/` 로 이동

7. **(INFO — 향후)** `spec-impl-evidence.md R-9` 에 `spec/conventions/` flat-reference 면제 근거 한 줄 추가

8. **(INFO — 향후)** `repoRoot()` 중복 함수를 단일 shared helper로 통합, `spec-links.ts` 위치/명명 개선 검토
# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 위험도 NONE, CRITICAL/WARNING 0건)

## 전체 위험도
**NONE** — `spec/conventions/spec-impl-evidence.md` 는 이번 plan(`.github/workflows/spec-link-checks.yml` pathspec/실행범위 확장, `spec_impact: none`)에서 내용이 바뀌지 않으며, 5개 checker 모두 CRITICAL/WARNING 없이 INFO 참고사항만 남겼다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec-link-checks.yml` 실행 범위가 넓어지면 `PROJECT.md` §"문서 링크 검증"(376~383행)의 "가드 하나만 돈다"는 서술이 stale 해짐 | `PROJECT.md` §문서 링크 검증 | workflow 변경과 같은 커밋/PR 에서 `PROJECT.md` 서술도 함께 갱신 |
| 2 | cross_spec | target 내 검증 가능 수치(카탈로그 18개, 스캔 pathspec) 실측 일치 확인 | `spec-impl-evidence.md` R-7, §4.2 | 조치 불요 (기록용) |
| 3 | rationale_continuity | `spec-link-integrity` 잡 이름 유지 근거(`#1106`, required check 등록)는 harness/워크플로 설계이지 spec Rationale 은 아님 — 구현 단계에서 `test_workflow_yaml_structure.py` 로 재확인 필요 | 계획서 전제, 본 checker 검증 범위 밖 | 구현 시 별도 검토자가 확인 |
| 4 | convention_compliance | frontmatter·`plan-scan.ts`·basename 충돌 회피 규칙 등 target 의 자기 서술이 실제 코드(`spec-frontmatter-parse.ts`, `plan-scan.ts`)와 실측 일치 | `spec-impl-evidence.md` §1, §2.2, §3.1 | 조치 불요 (기록용) |
| 5 | convention_compliance | Rationale 소제목 스타일(`R-N` vs 서술형)이 conventions 문서군 내 두 갈래 | `spec-impl-evidence.md` §Rationale vs `audit-actions.md` | 조치 불요 — 통일하려면 `spec/conventions/` 메타 규약 신설 필요(이번 target 단독 문제 아님) |
| 6 | convention_compliance | `swagger.md`·`error-codes.md` 등 대부분의 `spec/conventions/**` 는 컨텍스트 예산 초과로 교차 검증 미수행 | 검토 프로세스 한계 | 필요 시 별도 좁은 번들로 재검토 요청 |
| 7 | naming_collision | `spec-link-integrity` job 이름이 실제 실행 범위(디렉터리 전체)와 어긋나 보일 수 있음 — 의도적 유지(harness 앵커) | `spec-link-checks.yml:70`, `test_workflow_yaml_structure.py:262` | job 정의부 주석에 "이름 유지, §4.2 전 가드 포함" 한 줄 추가 권장(강제 아님) |
| 8 | naming_collision | `plan/**` pathspec 추가는 `e2e.yml` 선례와 동일 형태 — 충돌 아님 | `.github/workflows/e2e.yml:25,33` | 조치 불요 |
| 9 | naming_collision | `PROJECT.md:382` 수동 실행 커맨드가 이번 변경 후 stale 해질 수 있음 (cross_spec #1 과 동일 사안, 다른 관점에서 중복 지적) | `PROJECT.md:382` | 구현 시 디렉터리 실행 커맨드로 함께 갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target 미변경, 6개 관점 모두 충돌 없음. 유일한 후속 사항은 `PROJECT.md` CI 서술 stale화 — 워크플로 변경과 함께 갱신 권고 |
| rationale_continuity | NONE | target 무수정(`git diff` 0), 번들된 Rationale(0-overview·1-data-model·일부 2-navigation) 도메인 비중첩. 기각된 대안 재도입·합의 위반 없음 |
| convention_compliance | NONE | frontmatter·plan-scan·basename 규칙 실측 일치. Rationale 소제목 스타일 차이는 단순 스타일, 위반 아님. 대부분 conventions 문서 교차검증 미수행(고지) |
| plan_coherence | NONE | 트래커(`spec-draft-nullable-notation-followups.md`)가 이미 합의한 처방 (b) 를 집행. `#1106` 데드락 우려 선결(required check 부재, 잡 이름 유지) 실측 확인. 선행 plan(`spec-link-checks.yml` 신설·pathspec 확장) 모두 완료. 후속 누락 없음 |
| naming_collision | NONE | 신규 식별자 없음. 재사용 job 이름은 harness 앵커 유지 목적으로 의도적, 충돌 아님. `plan/**` pathspec 은 `e2e.yml` 선례와 일치 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음)
2. `spec-link-checks.yml` pathspec/실행범위 확장 커밋과 **같은 PR** 에서 `PROJECT.md` §"문서 링크 검증"(376~383행 및 382행 실행 커맨드)을 디렉터리 전체 실행 기준으로 함께 갱신한다 (cross_spec #1, naming_collision #9 — 동일 사안 중복 지적, 우선순위 1).
3. (선택) `spec-link-checks.yml:70` job 정의부 주석에 "이름은 `spec-link-integrity` 로 유지되지만 §4.2 전 가드(디렉터리 전체)를 포함한다"는 한 줄을 추가해 향후 혼동을 줄인다 (naming_collision #7).
4. (선택) 구현 단계에서 `.claude/tests/test_workflow_yaml_structure.py` 로 잡 이름 고정·required-check 부재 전제를 재확인한다 (rationale_continuity 고지).

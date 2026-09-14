# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전문 확보 완료(모든 output_file 이미 디스크에 존재, 별도 영속화 불요), Critical 발견 없음.

## 전체 위험도
**MEDIUM** — 코드/spec 자체 충돌은 없음(4개 checker NONE)이나, `plan_coherence` 가 이 브랜치의 신규 plan 트래커 등재 3건에서 다른 in-progress plan 과의 중복·미상호참조 및 false-positive 프레이밍을 WARNING 등급으로 지적함.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 신규 항목 "repo-guard 등재 규약 부재"가 이미 존재하는 동일 미해결 결정을 중복 등재하고 상호참조하지 않음. 실측 표도 실제(14개 guard 중 4개 등재)보다 좁게(5개 중 2개) 서술됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 | `plan/in-progress/spec-conventions-engine-error-code-surface.md` §"관련" (2026-08-31 등재, 2026-09-04 재실측) | 신규 항목에 상대 plan 상호 인용 추가, 실측표를 "14개 중 4개"로 갱신, 정본(owner) plan 명시 |
| 2 | plan_coherence | 신규 harness 항목 "`--impl-prep`/`--spec` 번들이 spec 코퍼스를 통째로 절단"이 이미 더 상세히 진단된 동일 결함 클래스(꼬리-드롭)를 상호참조 없이 별개 결함처럼 재등재 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 (harness 소유) | `plan/in-progress/harness-review-gate-followups.md` §"승격은 됐는데 굶는다" / §M (근본원인·처방 후보 (a)~(d) 기등재) | 신규 항목에서 해당 절 인용, 같은 근본원인인지 1줄 판정 추가, owner 를 harness 로 통일해 같은 세션에서 검토 |
| 3 | plan_coherence | 신규 항목 "`cafe24-api-catalog/_overview.md` 에 lifecycle frontmatter 없음"이 이미 spec·코드 양쪽에서 확정된 예외 규칙과 충돌하는 false-positive 프레이밍(택일 결정처럼 등재) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 | `spec/conventions/spec-impl-evidence.md` §1 (밑줄 prefix `_*.md` 제외 명시) + `codebase/frontend/.../spec-frontmatter-parse.ts` `isApplicable()` 구현(이미 제외 처리) | "(a)/(b) 택일 결정" 프레이밍을 폐기하고 "§7.1 에 `_overview.md` 자신이 §1 예외에 해당한다는 상호참조 1줄 추가"로 좁혀 재등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `secret-store.md §R4` 가 인용하는 메서드명이 실제 코드(`remove()`)와 다름(`delete()`로 서술) — 이 PR 이전부터 존재하던 오기이나 신규 e2e 주석이 처음으로 명시 인용해 가시성 발생 | `spec/conventions/secret-store.md` §R4 vs `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` | planner 백로그에 `TriggersService.delete()` → `remove()` 정정 1줄 등재 (spec 쓰기 권한 밖이라 이 PR 범위 아님) |
| 2 | convention_compliance | 신규 테스트 태그 `[vacuity]`(영문)가 형제 가드의 기존 한국어 태그(`[전제]`/`[캐너리]`)와 언어 혼용 — 정식 규약 대상 아님 | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` | 다음에 해당 파일을 손댈 때 `[대조군]`/`[전제]` 계열로 맞추는 선택 사항 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec/conventions 델타 0(순수 코드 하드닝). `secret-store.md §R4` 메서드명 오기 1건(INFO, 기존 결함 가시화) 외 전 표면(TriggerDto.workflow 3표면, 비밀 컬럼 3중사본, §5.4 부재표현) 정합 확인 |
| rationale_continuity | NONE | 발견 0. R4 범위 한정·`CREATOR_PROJECTION` 선례·정적 가드 처방·AST vs 정규식 경계 전부 기존 합의와 정합, 근거 실측 보강 사례로 확인 |
| convention_compliance | NONE | 명명·출력포맷·문서구조·API문서·금지항목 5개 관점 전부 위반 없음. 태그 언어 혼용 1건(INFO) |
| plan_coherence | MEDIUM | diff 자체는 다른 plan 침해 없음. 단 신규 트래커 등재 3건 중 2건이 타 in-progress plan 과 중복·미상호참조, 1건은 이미 확정된 spec 예외와 충돌하는 false-positive 프레이밍 |
| naming_collision | NONE | 신규 export 6개 전부 파일 로컬 스코프, 신규 파일 2개 기존 관례 준수, 값 참조 기존 상수명(TRIGGER_RESPONSE_STRIP_COLUMNS 등)이 spec 서술과 일치 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음) 이번 PR 자체는 병합 가능.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 3건을 위 WARNING 표의 제안대로 정정: (1) repo-guard 등재 규약 항목에 `spec-conventions-engine-error-code-surface.md` 상호 인용 + 실측표(14개 중 4개) 갱신, (2) harness 번들 절단 항목에 `harness-review-gate-followups.md` §M 상호 인용, (3) `_overview.md` frontmatter 항목을 "택일 결정" 대신 "상호참조 1줄 추가"로 재프레이밍.
3. (低우선) planner 백로그에 `secret-store.md §R4` 의 `TriggersService.delete()` → `remove()` 오기 정정 1줄 등재.
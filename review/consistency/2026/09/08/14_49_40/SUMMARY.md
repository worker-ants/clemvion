# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**LOW** — plan_coherence 가 1건의 WARNING(복제된 근거 문장 중 일부만 정정되어 발생한 plan drift)을 보고했고, 나머지 4개 checker(cross_spec / rationale_continuity / convention_compliance / naming_collision)는 전부 NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `76bd51aab`가 `tsconfig.build.json` exclude 주석의 거짓 전제("devDependency 를 끌어오지 않는다")를 정정했지만, **같은 거짓 전제를 담은 두 plan 문서 자리는 정정하지 않음**. `d80583700` 한 커밋 안에서 (a) `source-scan.ts`에 `import * as ts from 'typescript'`(devDependency)를 추가하고 (b) 같은 커밋으로 `auth-guard-reflection-hardening.md`에 "트리거는 여전히 미충족"이라 써 넣어, 그 각주는 작성 순간부터 자기 커밋에 의해 거짓이었음 | `plan/in-progress/auth-guard-reflection-hardening.md:347-350`, `plan/in-progress/spec-draft-nullable-notation-followups.md:594-596`(B-2 항목 본문) | `codebase/backend/tsconfig.build.json` exclude 주석(`76bd51aab`가 이미 정정한 정본 서술) | 두 plan 자리에 `76bd51aab`의 W3 정정과 동일한 내용을 미러링: (1) `auth-guard-reflection-hardening.md` 347-350행 "여전히 미충족"→"이제 충족됨(후속 커밋이 devDependency import 를 추가) — 처방은 이미 같으므로 재작업 불요"로 정정, (2) `spec-draft-nullable-notation-followups.md` 594-596행 "devDependency 지뢰는 없다"를 취소선 처리하고 완료 각주(602-607행)에 한 줄 보강. 두 plan 의 최종 결론(추가 작업 불요)은 바뀌지 않으므로 재작업은 불요하나 근거 문장 정정 필요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/1-data-model.md ## Rationale` 의 "User 민감 컬럼" 표가 "쿼리 범위 `select` 투영" 패턴을 아직 4번째 행/각주로 명시하지 않음 (신규 아님, 기추적) | `spec/1-data-model.md ## Rationale` | `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner 담당 항목으로 등재됨 — developer 턴에서 추가 조치 불요, 재기표만 하지 않음 |
| 2 | naming_collision | `WorkflowVersionDetail` backend/frontend 동명·이형 충돌이 이번 PR 에서 backend 측 `WorkflowVersionDetailProjection` 개명으로 해소됨 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`, `codebase/frontend/src/lib/api/workflows.ts:107-` | 조치 불요 — 기존 충돌을 없애는 방향의 변경. frontend `WorkflowVersionDetail` 은 여전히 존재하므로 향후 재사용 시 이 rename 배경 참조 권장 |
| 3 | naming_collision | `enclosingScopeName` 승격으로 중복 AST 헬퍼(`enclosingName`) 단일화, 잔존 동명 정의 없음 | `codebase/backend/src/common/__test-utils__/source-scan.ts` | 조치 불요 |
| 4 | naming_collision | 신규 e2e 가 단언하는 `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 기존 spec §1.10 정의와 값이 정확히 일치(신규 식별자 아님) | `codebase/backend/test/webhook-trigger.e2e-spec.ts` B4, `spec/5-system/3-error-handling.md §1.10` | 조치 불요 |
| 5 | naming_collision | 신규 가드(`endpoint-path-conflict-wrap-guard.ts`)가 기존 private 메서드 `rethrowEndpointPathConflict` 명을 검증. fixture 는 프로덕션 스캔 범위 밖 격리 | `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 5라운드 연속 CRITICAL/WARNING 0. 이번 라운드 신규 델타(`ead63d797`·`76bd51aab`)는 프로덕션 코드 0줄, spec 표면 미접촉. 트리거 409 계약(§1.10)·User 민감 컬럼 응답 경계(§2.1.1/§2.3) 재확인 정합 |
| rationale_continuity | NONE | 6회 연속 검토. 유일 신규 커밋(`76bd51aab`)은 프로덕션 코드 0줄의 문서/테스트 정정이며, 정정 내용(`listMembers` DB 레벨 투영 전환) 자체가 `spec/1-data-model.md` Rationale 원칙과 일치 |
| convention_compliance | NONE | 22개 파일 diff 전수 확인. 신규 DTO/Swagger/에러코드/API 명명 없음. `WorkflowVersionDetailProjection` 개명은 wire-level 이 아니라 rename 정책 적용 대상 아님. 신규 e2e 는 기존 문서화된 계약 재확인 |
| plan_coherence | LOW | `76bd51aab`가 코드 주석 1곳의 거짓 전제는 정정했으나 동일 전제를 담은 두 plan 문서(`auth-guard-reflection-hardening.md`, `spec-draft-nullable-notation-followups.md`)는 정정하지 않음 — WARNING 1건 |
| naming_collision | NONE | spec 델타 0, 신규 코드 식별자는 전부 기존 헬퍼 재사용/중복 단일화/기존 충돌 해소(rename)이며 새 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, BLOCK:NO)
2. `plan/in-progress/auth-guard-reflection-hardening.md` 347-350행을 `76bd51aab`의 W3 정정 내용으로 미러링(devDependency 트리거가 이제 충족됨, 처방은 동일하므로 재작업 불요).
3. `plan/in-progress/spec-draft-nullable-notation-followups.md` 594-596행("devDependency 지뢰는 없다")을 취소선 처리하고 완료 각주(602-607행)에 정정 한 줄 보강.
4. `spec/1-data-model.md ## Rationale` 의 "쿼리 범위 select 투영" 패턴 4번째 행/각주 등재는 기존 planner 항목(`spec-draft-nullable-notation-followups.md`)에서 계속 추적 — 이번 턴 조치 불요.

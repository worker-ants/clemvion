# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 전문 확보, Critical 0건.

## 전체 위험도
**NONE** — `spec/2-navigation` 스코프 spec 델타는 0개(코드 전용 PR)이며, 구현(`IntegrationsService.rotate()` 락 재설계)이 §8 RBAC·§9 API 계약·상태 전이·에러 코드·명명 규약 어디와도 충돌하지 않고, 기각됐던 대안(advisory lock, 409 신설)의 무근거 재도입도 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence (4개 checker 중복 지적, 최강 등급 통합) | `spec/data-flow/5-integration.md` rotate 서술이 신규 `pessimistic_write` 재읽기 잠금 메커니즘을 언급하지 않음(형제 서술인 reauthorize L101 은 명시). 코드가 옳고 spec 산문만 지연된 정보 비대칭 — 부정 아닌 침묵 | `spec/data-flow/5-integration.md` L65-67 | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-20 `18_09_24` SPEC-DRIFT#1)에 planner 후속으로 등재됨. 별도 조치 불요 — 다음 planner 턴에서 "커밋 직전 `SELECT integration FOR UPDATE` 재읽기 후 머지 — CONC H-3 와 동일 메커니즘" 한 줄 추가 권고 |
| 2 | Rationale Continuity / Plan Coherence (2개 checker 중복 지적) | personal-scope 통합의 "본인 것만" 소유자 검증이 `assertCanRotate`에 없음(organization-scope admin 검사만 수행). `git show origin/main` 대조로 이 PR 이전부터 있던 갭 — 회귀 아님 | `codebase/backend/src/modules/integrations/integrations.service.ts` `assertCanRotate()` vs `spec/2-navigation/4-integration.md §8` "Rotate: 본인 것만(Personal)" | 이미 `review/code/2026/09/20/18_09_24/RESOLUTION.md`(INFO 6) + `spec-draft-nullable-notation-followups.md`에 등재. 권한 모델 전반(조회·수정·삭제) 범위 확정 후 별도 PR에서 처리. 우선순위 상향 시 `status: partial` + `pending_plans` 승격 고려 |
| 3 | Convention Compliance | 신규 e2e `integration-rotate-concurrency.e2e-spec.ts` 가 `4-integration.md` frontmatter `code:` 에 개별 미등재(형제 문서 `2-trigger-list.md`는 e2e-spec 을 개별 등재하는 강한 선례 보유). 강제 위반 아님(`spec-impl-evidence.md` R-1 글로브 매치로 가드 통과) | `spec/2-navigation/4-integration.md` frontmatter `code:` | 다음 `4-integration.md` 편집 planner 턴에서 `- codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts # §9.2 rotate 동시성 불변식 고정` 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 락 재설계가 §8 RBAC·§9 API·§6 상태 전이·§2.10 데이터 모델 어디와도 충돌 없음. `data-flow/5-integration.md` 서술 지연은 INFO(기등재) |
| Rationale Continuity | NONE | advisory lock 재도입 아님(코드 주석·plan 이 명시적으로 대조), 409 계약안은 `--spec` 반증 후 근거 있게 철회(`superseded`), CONC H-3 선례 인용 정확 |
| Convention Compliance | NONE | 에러 코드 신설 없이 기존 코드 재사용(rename-금지 원칙 부합), 헬퍼/파일 명명 기존 패턴 일치, DTO/swagger 변경 표면 없음. INFO 2건(비강제) |
| Plan Coherence | NONE | `plan/in-progress/**` 전체와 충돌하는 미해결 결정 없음. `--impl-prep` 지적 WARNING(400/422 drive-by 위험)이 실제로 잘 닫힘. 신규 후속 2건 정확히 등재됨 |
| Naming Collision | NONE | 신규 사설 식별자(`assertCanRotate`, `mergeAndValidateCredentials`, `dataSource`) 및 신규 e2e 파일 모두 기존 사용처와 비충돌, 철회된 `INTEGRATION_ROTATE_CONFLICT` 는 이력 문서 밖에 잔존하지 않음 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) 즉시 조치 없음.
2. 다음 `spec/data-flow/5-integration.md` 편집 시 rotate 서술에 "`SELECT integration FOR UPDATE`(pessimistic_write) 재읽기 후 머지 — CONC H-3 와 동일 메커니즘" 한 줄 추가 (planner, 이미 트래커 등재).
3. personal-scope "본인 것만" 소유자 검증 갭은 권한 모델 전반 범위 확정 후 별도 PR로 처리 (planner+developer, 이미 트래커 등재).
4. 다음 `4-integration.md` 편집 시 frontmatter `code:` 에 신규 e2e-spec 개별 등재 (형제 문서 `2-trigger-list.md` 패턴 따름).

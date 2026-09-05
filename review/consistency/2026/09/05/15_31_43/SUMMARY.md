# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음(5개 checker 전원 CRITICAL 0건). `spec/5-system/` 델타는 0(코드 전용 PR: 감사 로그 응답 과다 노출 보안 수정 + §5.4 응답-계약 검증 테스트 인프라 신설)이며, plan_coherence 가 WARNING 2건을 제기함.

## 전체 위험도
**MEDIUM** — Critical/충돌 없음. 다만 plan 이 스스로 건 "다음 touch 시 반영" 트리거 조건이 이번 실제 touch 에서 2건 충족됐는데도 후속 반영이 누락됨(WARNING).

## Critical 위배 (BLOCK 사유)

(해당 없음 — 5개 checker 모두 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `audit-logs.service.ts` 를 이번 PR 이 실제로 편집(`findAll()` join 축소)했는데, 같은 파일에 plan 이 "다음 touch 시 함께" 로 명시한 주석 오기 정정(`"12개+"` → `"12개"`, `:128`)이 누락 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:128` | `plan/in-progress/spec-sync-auth-gaps.md:169-171` (target spec `1-auth.md` frontmatter `pending_plans:` 등재 문서) | 1줄 diff 이므로 이번 PR 에 바로 반영하거나, 불가하면 plan 항목에 "이번 touch 에서도 미반영 — 사유" 를 추가해 트리거가 재이월됐음을 명시 |
| 2 | plan_coherence | plan 이 "2단계 착수 시 신설" 하라고 못 박은 `ExecutionDto` 스키마-레벨 회귀 가드(`execution-response.dto.spec.ts`, `execution-status-response.dto.spec.ts` 패턴)가, 실제 2단계 착수분(`ExecutionDto` 배선)과 함께 오지 않음 | `codebase/backend/test/workflow-execution.e2e-spec.ts` (신규 `assertMatchesContract` 배선만 있고 대응 `execution-response.dto.spec.ts` 부재) | `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4 drift 배치 — 2단계" 항목 | `execution-response.dto.spec.ts` 를 기존 패턴으로 신설하거나, 못 한다면 plan 의 "진행 상태(2026-09-05)" 표에 "배선은 됐으나 스키마-레벨 캐너리는 아직" 을 명시해 갭을 좁힐 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity | 신규 `response-contract.ts`(§5.4 시행 코드)가 `2-api-convention.md` frontmatter `code:` glob 에 미등재 — 이후 이 파일이 완화 방향으로 바뀌어도 SPEC-CONSISTENCY 게이트가 해당 spec 문서를 재검토 대상으로 못 잡음 | `spec/5-system/2-api-convention.md` frontmatter `code:` / 코드 `codebase/backend/src/shared/testing/response-contract.ts` | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer 가 이미 planner 트랙 backlog 로 등재. planner 가 다음에 이 spec 문서를 만질 때 `code:` 에 추가 권고 |
| 2 | convention_compliance | 신규 테스트 인프라(`response-contract.ts`) 배치 위치가 기존 `swagger-probe.ts` 관례와 일치, export 이름 충돌 없음 — 규약 위반 아님, 확인 기록용 | `codebase/backend/src/shared/testing/response-contract.ts` | 조치 불요 |
| 3 | convention_compliance | `AuditLogDto.user` 가 `@ApiPropertyOptional({nullable:true})`+`| null` 로 §5.4 금지 조합(optional+nullable) 선언 — diff 밖 기존 코드, 런타임은 항상 값 채움(선언보다 엄격, 결함 아님) | `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:25-26` | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` L341 트래커에 이미 등재·처분 완료(이전 코드 리뷰 라운드 15_12_02 확인) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0. 코드는 기존 `AuditLogUserDto` 계약·§5.4·RBAC(§4.2 Admin+)에 대한 정합화. `response-contract.ts` 의 `code:` frontmatter 미등재는 이미 추적 중(INFO) |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복·암묵적 가정 충돌 모두 해당 없음. 이전 라운드가 확정한 방향(응답-DTO 일반 대조 헬퍼)을 그대로 완결 |
| convention_compliance | NONE | 신규 코드·target 문서 원문 모두 `error-codes.md`/`swagger.md`/`audit-actions.md` 규약과 정합. 발견된 §5.4 drift 는 diff 밖·이미 처분된 항목 |
| plan_coherence | MEDIUM | plan 이 스스로 건 "다음 touch 시 반영" 트리거 조건이 이번 PR 에서 2건 충족됐는데 후속 반영 누락(주석 오기 정정, `ExecutionDto` 스키마 캐너리) |
| naming_collision | NONE | 신규 식별자(`AuditLogListItem`, `response-contract.ts` export 일체) 전수 grep 대조 결과 충돌 없음. 신규 endpoint·이벤트·ENV·spec 경로 도입 없음 |

## 권장 조치사항
1. `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:128` 주석 `"12개+"` → `"12개"` 정정(1줄) — 이번 PR 에 바로 반영하거나, 불가 시 `plan/in-progress/spec-sync-auth-gaps.md:169-171` 에 "이번 touch 도 미반영 — 사유" 를 추가.
2. `execution-response.dto.spec.ts` 를 `execution-status-response.dto.spec.ts` 패턴으로 신설하거나, `plan/in-progress/spec-draft-nullable-notation-followups.md` 진행 상태 표에 "ExecutionDto 배선은 됐으나 스키마-레벨 캐너리는 아직" 갭을 명시.
3. (선택, INFO) 다음에 `spec/5-system/2-api-convention.md` 를 편집할 때 frontmatter `code:` 에 `codebase/backend/src/shared/testing/response-contract.ts` 추가.
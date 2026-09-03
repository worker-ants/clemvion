# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 이번 diff(엔티티 nullable 컬럼 타입 정합화 배치 2, 13파일/396줄)는 `spec/5-system/` 을 변경하지 않는 순수 코드 정정이며, spec 데이터 모델·API 컨벤션·Rationale 과 정합한다. 유일한 실질 이슈는 관련 plan(`entity-nullable-column-type-mismatch.md`)의 frontmatter `spec_impact: none` 이 본문이 스스로 명시한 미해결 planner-턴 spec 후속 2건과 어긋난다는 것(WARNING, 이전에도 동일 세트에서 2회 재발한 패턴).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 Critical 이 없으므로 인계 대상 없음. 단, 아래 WARNING/INFO 에 기록된 두 건의 planner-턴 spec 후속(§2.2 명명 규칙 예외, `next_run_at` 표기 정정)은 이미 developer 가 자기 권한 밖으로 정확히 판단해 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 기록해 둔 상태다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `entity-nullable-column-type-mismatch.md` frontmatter `spec_impact: none` 이 본문의 미해결 planner-턴 spec 후속 2건(§2.2 명명 규칙 예외, `next_run_at` 표기)과 불일치 — 같은 plan 세트에서 이미 2회(`update-returning-tuple-shape.md`, `backend-lint-gate-broken-on-main.md`) 재발한 Gate C 오탐 패턴 | `plan/in-progress/entity-nullable-column-type-mismatch.md` (frontmatter) | `spec/1-data-model.md §2.9`(next_run_at), `spec/5-system/2-api-convention.md §2.2`(auth 네임스페이스 예외) | frontmatter 를 `spec_impact: [spec/1-data-model.md, spec/5-system/2-api-convention.md]` 로 정정하거나, 두 항목을 별도 spec-sync 트래커로 이관 후 `none` 유지. complete/ 이동 전에 처리 |
| 2 | convention_compliance | `2-api-convention.md §2.2` 명명 규칙의 두 예외(RPC-style sub-channel / `/api/external/*`) 어디에도 `/api/auth/*` 계열 15개 이상 엔드포인트가 포섭되지 않음 — 이번 diff 와 무관한 선재 gap이나 재확인 결과 여전히 미해결 | `spec/5-system/2-api-convention.md §2.2` | `spec/5-system/1-auth.md §5` 실제 엔드포인트 목록 | 이번 diff 를 막을 사유 아님. 이미 plan 에 planner 턴 후속으로 기록됨 — 다음 planner 턴에서 세 번째 명명 예외(인증 네임스페이스) 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/1-data-model.md:260` `Schedule.next_run_at` 표기가 non-null 이나 DB 는 `nullable: true`, 바로 아래 `last_run_at`(`Timestamp?`)과 비대칭 — 이 diff 가 만든 것 아님, 이미 planner-턴 후속으로 등재됨 | `spec/1-data-model.md:260` | 조치 불요 (추적 중) |
| 2 | convention_compliance | `redact-stored-error.ts` 시그니처 넓힘(`Record<...> | null`)은 §5.4 부재 표현 기본값(`null`, 키 유지)과 정합 | `codebase/backend/src/shared/utils/redact-stored-error.ts` | 조치 불요 |
| 3 | convention_compliance | `2-api-convention.md` 에 전용 `## Overview` 헤딩 부재 — `_product-overview.md` 보유 영역이라 규약 위반은 아니나 형제 문서(`1-auth.md`/`3-error-handling.md`)와 구조 불일치 | `spec/5-system/2-api-convention.md` | 추후 편집 시 짧은 Overview 추가 고려 (cosmetic) |
| 4 | convention_compliance | 엔티티 `@Column` 에 명시적 `type:` 추가하는 새 관례가 등장 중이나 `spec/conventions/**` 에 아직 미성문화 | diff 전반(`user.entity.ts` 등) | 배치 3 시점에 규약화 여부 재판단 (강제 아님) |
| 5 | plan_coherence | `/api/auth/*` 명명 예외 gap 의 추적 위치가 무관한 우선순위 P3 plan 내부라 plan 완료·아카이브 시 눈에 안 띄게 묻힐 위험 | `plan/in-progress/entity-nullable-column-type-mismatch.md` "## 할 일" | `spec-sync-common-gaps.md` 등 독립 트래커로 이관 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec/1-data-model.md 대상 필드 전부 이미 nullable 로 문서화, §5.4 정합. 선재 gap 2건은 이 diff 원인 아님 |
| rationale_continuity | NONE | 기각된 대안 재도입·무근거 번복 없음. 오히려 기존 nullable 계약을 코드에 뒤늦게 정렬 |
| convention_compliance | LOW | DTO/API/swagger/migration 규약 미접촉. §2.2 auth 네임스페이스 gap 은 이미 tracked, 이번 diff 무관 |
| plan_coherence | LOW | `spec_impact: none` 이 본문 미해결 후속 2건과 불일치 (동일 세트 재발 패턴) |
| naming_collision | NONE | 신규 식별자 도입 전무, 기존 필드명/함수명 그대로 유지 |

## 권장 조치사항
1. `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 `spec_impact` 를 `none` → 실제 영향받는 spec 경로 리스트로 정정하거나, 두 미해결 항목을 독립 spec-sync 트래커로 이관.
2. (선택, 비차단) 다음 planner 턴에서 `spec/5-system/2-api-convention.md §2.2` 에 `/api/auth/*` 액션 네임스페이스용 세 번째 명명 예외 추가.
3. (선택, 비차단) 같은 planner 턴에서 `spec/1-data-model.md §2.9` `next_run_at` 표기를 `Timestamp?` 로 정정.

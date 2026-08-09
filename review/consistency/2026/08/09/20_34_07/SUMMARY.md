# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 모두 CRITICAL 0건. WARNING 1건(plan 라이프사이클 위생)만 존재하며 target(`spec/5-system/`) 내적 일관성·타 spec 영역과의 충돌 없음.

## 전체 위험도
**LOW** — 5개 checker 전원 LOW/NONE. target 은 직전 커밋(`602f677cd`, PR #1112)으로 이미 `main` 에 반영된 내용의 사후 재검증이며, 직전 consistency-check 세션(20_07_08)이 지적한 WARNING 2건도 이번 대조에서 모두 반영·해소 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 완료된 plan `spec-draft-auth-invariants-sync.md` 이 `plan/in-progress/`에 남아 라이프사이클 이동 누락 — target 이 이미 반영한 5개 spec 변경을 이 plan 은 여전히 미완료로 보고 | `spec/5-system/1-auth.md ## Rationale`(부트 캐너리), `3-error-handling.md §1.3`, `data-flow/12-workspace.md ## Rationale`, `15-chat-channel.md §5.4`, `conventions/secret-store.md §2.1` | `plan/in-progress/spec-draft-auth-invariants-sync.md`(frontmatter `status: in-progress`) — 해당 5개 변경은 커밋 `602f677cd`(PR #1112)로 이미 main 반영 완료 | 이번 uuid-canary docstring fix 커밋에 곁들여 (a) 체크리스트 남은 2항목(`링크 무결성 회귀`, `commit + PR`) `[x]` 처리 (b) `git mv plan/in-progress/spec-draft-auth-invariants-sync.md plan/complete/` 실행. "이동만 담은 별 PR"은 금지 규칙이므로 이번 커밋에 묶는 것이 정본 경로(`plan-lifecycle.md §3`) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 신설 `VALIDATION_ERROR`(X-Workspace-Id 형식 오류) 행에 `details.field` 유무 미명시 | `spec/5-system/3-error-handling.md §1.3` | 헤더 레벨 거부라 DTO `field` 개념이 없음을 한 줄 명시 권고(비필수) |
| 2 | rationale_continuity | 번들에 `data-flow/12-workspace.md`·`secret-store.md`·`error-codes.md` 의 Rationale 원문 미포함, 실물 파일로 별도 대조 필요했음 | (checker 절차) | 향후 impl-prep 번들링 시 target 이 명시 참조하는 타 문서 `## Rationale` 섹션도 함께 포함 권고 |
| 3 | convention_compliance | `2-api-convention.md` 에 명시적 `## Overview` 섹션 없음(형제 문서 `1-auth.md`/`3-error-handling.md`는 보유) | `spec/5-system/2-api-convention.md` 상단 | 이번 작업 범위 밖. 추후 해당 파일 편집 기회에 `## Overview` 신설 권고 |
| 4 | convention_compliance | §1.3 표에 `VALIDATION_ERROR` 코드가 두 행으로 등재(규약 위반은 아님 — `error-codes.md`의 전역 공용 코드 예외에 해당) | `spec/5-system/3-error-handling.md §1.3` | 표 상단에 "동일 코드가 여러 행에 걸쳐 등재될 수 있다" 1줄 노트 추가 권고(선택) |
| 5 | convention_compliance | `common/utils/uuid.ts` docstring 이 정정된 spec 근거(캐너리 지목)를 아직 미반영 — 이번 developer 작업의 본 대상 | `codebase/backend/src/common/utils/uuid.ts` L20-26 | `data-flow/12-workspace.md ## Rationale` 정정 문구대로 e2e 인용 제거, `uuid.spec.ts`·`workspace-context.util.spec.ts` 두 단위 테스트를 근거로 교체 |
| 6 | plan_coherence | 후속 항목(uuid.ts 캐너리 인용 정정 + `workspace-reflection-canary.ts` "73건" 수치 정정)이 두 개의 서로 다른 plan 파일에 분산돼 한쪽만 보면 나머지 놓치기 쉬움 | `codebase/backend/src/common/utils/uuid.ts`, `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` | 두 docstring 을 한 커밋에서 함께 정정하고 완료 후 `spec-draft-auth-invariants-sync.md`·`auth-guard-reflection-hardening.md` 양쪽 체크박스 `[x]` 갱신 |
| 7 | plan_coherence | 미해결 결정과의 충돌 없음(확인 완료) | `1-auth.md ## Rationale`, `3-error-handling.md §1.3` | 조치 불요 — 이미 결정 확정, 이번 작업은 코드 주석을 그 결정에 맞추는 순수 정합화 |
| 8 | naming_collision | 직전 세션 WARNING(§1.3 에러 코드 컬럼 표기 불일치) 반영 확인 — 재발 없음 | `spec/5-system/3-error-handling.md:76-79` | 조치 불요(이미 해소) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | CRITICAL/WARNING 0건. INFO 1건(details.field 서술 비대칭) + 핵심 cross-reference 사슬 9개 항목 전수 검증 정합 |
| rationale_continuity | LOW | CRITICAL/WARNING 0건. 신설 Rationale 2건 모두 기각 대안 재도입 없음, 무근거 번복 없음 |
| convention_compliance | LOW | CRITICAL/WARNING 0건. INFO 3건(Overview 섹션 부재·코드 재사용 노트·uuid.ts docstring 미갱신) |
| plan_coherence | LOW | WARNING 1건(plan 라이프사이클 이동 누락) + INFO 2건(후속 항목 분산·미해결 결정 충돌 없음 확인) |
| naming_collision | NONE | CRITICAL/WARNING 0건. 직전 WARNING 반영 재확인, 신규 식별자 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 — 단, 현재 BLOCK:NO 이므로 필수는 아님) 이번 uuid-canary docstring fix 커밋에 `plan/in-progress/spec-draft-auth-invariants-sync.md` 체크리스트 완료 처리 + `plan/complete/` 이동을 함께 실어 plan 위생 회복.
2. `codebase/backend/src/common/utils/uuid.ts` L20-26 docstring 을 `data-flow/12-workspace.md ## Rationale` 정정 문구에 맞춰 갱신(e2e 인용 제거, `uuid.spec.ts`·`workspace-context.util.spec.ts` 두 단위 테스트 근거로 교체) — 이것이 이번 세션의 본 target.
3. `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` L26 "73건" 수치도 함께 정정(서브셋/상위집합 구분 명시) — `auth-guard-reflection-hardening.md` 완료 체크박스 동기화.
4. (선택, 비필수) `2-api-convention.md` 에 `## Overview` 섹션 신설 — 형제 문서 구조 정합.

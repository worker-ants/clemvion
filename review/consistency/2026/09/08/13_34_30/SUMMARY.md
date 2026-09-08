# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 성공 응답, Critical 발견 0건.

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(plan 간 유예 결정 선반영 미동기화), INFO 4건(문서 등재 갭·표기 불일치·정보성 메모)만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `tsconfig.build.json` exclude 확장(B-2)이 `auth-guard-reflection-hardening.md` 의 조건부 유예 결정(트리거: `__test-utils__` 의 devDependency import, 아직 미충족)을 다른 근거(dead code)로 사전 통보 없이 앞질러 실행. 실측으로 `check-backend-typecheck-ratchet.py` 가 `tsconfig.json`(exclude 없음)을 써서 실질 타입체크 회귀는 없음을 확인했으나, 두 plan 이 같은 대상에 대해 서로 다른 결론을 상호 참조 없이 보유 중 | `codebase/backend/tsconfig.build.json` exclude 배열 신규 항목 `**/__test-utils__/**`; `plan/in-progress/spec-followups-batch-b.md` B-2 | `plan/in-progress/auth-guard-reflection-hardening.md` 320행 미해결 체크박스(조건부 유예 서술) | `auth-guard-reflection-hardening.md` 해당 항목에 "2026-09-08 배치 B-2 가 다른 사유로 이미 exclude 를 추가함 — 트리거 조건은 아직 미충족이나 결과는 선반영됨. 타입체크 사각 우려는 ratchet 스크립트가 별도 tsconfig 사용으로 무관함을 확인" 코멘트를 남기고 종결하거나 상호 참조 링크 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | "쿼리 범위 DB-레벨 `select` 투영" 패턴이 `WorkflowVersionsService.findOne`에 이어 `WorkspacesService.listMembers`로 두 번째 적용됐으나, `spec/1-data-model.md` Rationale 결정표에 정식 등재되지 않음(3라운드 연속 동일 지적, 미반영 유지) | `codebase/backend/src/modules/workspaces/workspaces.service.ts`(`listMembers`) / `spec/1-data-model.md` `## Rationale` | 해당 항목에 "쿼리 범위 DB-레벨 select 투영(엔티티 전역 select:false와 구분)"을 채택 옵션의 하위 각주로 등재, 두 사례를 근거로 인용(project-planner 턴에서 처리) |
| 2 | Convention Compliance | `3-error-handling.md §2.1` 예시의 `requestId: "req_abc123"`이 같은 필드를 UUID로 정의하는 `2-api-convention.md §5.3`(및 실제 구현 `uuidv4()`)과 형식 불일치 | `spec/5-system/3-error-handling.md` §2.1 JSON 예시 | 예시 값을 UUID 형태 placeholder로 교체(project-planner 턴, 본 배치 developer 자기-반증 소정정 대상 아님 — 배치가 이 문장을 쓰지 않았음) |
| 3 | Naming Collision | `WorkflowVersionDetail` → `WorkflowVersionDetailProjection`(backend) 개명은 과거 W3/W5 라운드가 지적한 backend/frontend 동명 이형 타입 충돌을 해소하는 방향이며 신규 충돌 아님 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` | 조치 불요 — 향후 두 타입을 공유 패키지로 합칠 때 이름 유지 여부만 재확인 |
| 4 | Naming Collision | 신규 가드 파일의 `export const SRC_ROOT`가 형제 가드 파일 3곳과 동일 이름·동일 계산식으로 반복되나 각 파일 스코프 독립이라 충돌 아님(기존 컨벤션 준수) | `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` | 조치 불요 — 가드 파일이 더 늘면 공용 헬퍼 추출 고려(스코프 밖) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec/5-system 델타 0, 16개 코드 파일 전수 대조 — 트리거 409 계약·User 컬럼 투영·타입 개명·전역 예외 필터 확장 전부 기존 spec 앵커와 정합 |
| Rationale Continuity | LOW | 기각된 대안 재도입·근거 없는 번복 없음. query-scope select 투영 패턴이 두 번째 사례로 굳어졌는데도 spec Rationale 표 미등재(INFO, 반복 지적) |
| Convention Compliance | LOW | 명명·출력 포맷·문서 구조 규약 전부 준수. requestId 예시 UUID 형식 불일치 1건(INFO) |
| Plan Coherence | LOW | batch-b ↔ 상위 planner 트랙 대응 정확. tsconfig exclude 가 자매 plan 의 조건부 유예를 상호 참조 없이 앞지름(WARNING, 실질 회귀는 없음 확인) |
| Naming Collision | NONE | spec 레벨 신규 식별자 없음. 유일한 개명은 기존 충돌 해소 방향, 그 외 신규 식별자 전부 테스트/가드 내부 스코프 |

## 권장 조치사항
1. `plan/in-progress/auth-guard-reflection-hardening.md` 의 `__test-utils__` exclude 조건부 유예 항목에 "B-2가 다른 사유로 선반영함" 코멘트 추가 및 상호 참조 (WARNING #1 해소).
2. (선택, project-planner 턴) `spec/1-data-model.md` Rationale 표에 query-scope select 투영 패턴 정식 등재.
3. (선택, project-planner 턴) `spec/5-system/3-error-handling.md §2.1` requestId 예시를 UUID 형식으로 교체.

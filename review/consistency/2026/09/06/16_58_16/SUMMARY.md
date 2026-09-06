# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 Critical 없음. 전문 확보 실패 checker 없음(5/5 success + 인라인 전문 확보).

## 전체 위험도
**LOW** — target(`spec/2-navigation/`) spec 델타는 0이며, 이번 PR(User 엔티티 노출 방어 + trigger endpoint_path 충돌 계약 구현 + 하네스 파서 수정)은 기존 spec 이 이미 선언한 계약을 코드로 뒤늦게 맞추는 방향이라 다른 영역과의 직접 충돌은 없음. WARNING 2건(Swagger 데코레이터 누락, plan 이관 미집행)만 확인.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `PATCH /api/triggers/:id` · `POST /api/triggers` 에 신설된 409 `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 계약이 Swagger 데코레이터에 미반영 | `codebase/backend/src/modules/triggers/triggers.controller.ts` `create()`·`update()` (이번 diff 미포함, 기존 파일) | `spec/conventions/swagger.md` §2-4(409 → `@ApiConflictResponse`), `spec/2-navigation/2-trigger-list.md §3` 이 이미 서술한 계약 | `triggers.controller.ts` 의 `create()`·`update()` 에 `@ApiConflictResponse({ description: '동일 워크스페이스 내 endpointPath 중복 (RESOURCE_CONFLICT / TRIGGER_ENDPOINT_PATH_CONFLICT)' })` 추가. 부수로 `update()` 의 `@ApiBadRequestResponse` 설명에 `AUTH_CONFIG_NOT_FOUND` 케이스도 보강 |
| 2 | Plan Coherence | 자매 plan(`spec-draft-review-citations-enforcement.md` §「함께 처리할 것」#3)이 `spec-draft-api-convention-verifier-registration.md` 를 `plan/complete/` 로 이관하라고 지시했으나 미집행 — 열린 체크박스 0개인데도 `plan/in-progress/`·`status: in-progress` 그대로 | 해당 없음 (spec/2-navigation 무관, plan 위생 이슈) | `plan/in-progress/spec-draft-api-convention-verifier-registration.md` (frontmatter `status`) | 다음 planner 턴에서 `plan/complete/` 로 이동 + `status: complete` 갱신, 또는 실제 잔여 작업이 있다면 그 사실을 plan 에 명시해 "0 open" 주장을 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 도메인 세부 에러 코드 표현 방식 3번째 패턴(`details.code`, 접두 없음) 등장 — 기존 `top-level code 교체`/`details.<domain>Code` 두 관례와 공존 | `triggers.service.ts` `rethrowEndpointPathConflict`; `spec/5-system/3-error-handling.md §1.3` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재됨 — 별도 조치 불요 |
| 2 | Cross-Spec | `WorkflowVersionDetail` 프론트(optional/nullable)·백엔드(`ProjectedCreator` 3필드 고정) 동명 미러 drift, 현재는 비충돌이나 이름 동일로 오도 위험 | `codebase/frontend/src/lib/api/workflows.ts` vs `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(L580)에 등재됨 — 별도 조치 불요 |
| 3 | Plan Coherence | `.claude/**` harness 쓰기 권한 조항이 `CLAUDE.md` Skill 표에 없음 — 이번 diff 가 `review_guard.py`/`test_review_guard.py` 를 수정했으나 어느 역할에도 `.claude/**` 가 배정돼 있지 않은 기존 미결 유지 | `CLAUDE.md` Skill 표 (이번 diff 미변경) | 이미 `spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재됨 — 다음 planner 턴에서 Skill 표에 `.claude/**` 행 명시 시 종결 |
| 4 | Plan Coherence | `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 `details.code` 로 구현한 것은 "도메인 세부 에러 코드 표현 방식 정식화" 미결 정책을 일방 결정한 것이 아님 — spec 이 이미 그 문면을 갖고 있었고 코드가 그대로 실현 | `spec/2-navigation/2-trigger-list.md §3`(기존 문서, 이번 diff 로 미변경) | 조치 불요 — 검증 결과 문제 없음 |
| 5 | Naming Collision | `TRIGGER_ENDPOINT_PATH_CONFLICT`/`details.field='endpoint_path'`/`isEndpointPathUniqueViolation`/`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 신규 식별자는 기존 spec 선언과 의미 일치, 저장소 내 유일 선언 | `triggers.service.ts` vs `spec/2-navigation/2-trigger-list.md:94,164`, `V002__indexes.sql:26` | 조치 불요 — 충돌 없음 |
| 6 | Naming Collision | (scope 밖 참고) `WorkflowVersionDetail` 동명이형 선언은 spec/2-navigation 프론트매터 밖이며 이미 다른 트래커(`spec-draft-nullable-notation-followups.md`, `review/consistency/2026/09/06/16_29_00` W5)로 추적 중 | `codebase/frontend/src/lib/api/workflows.ts` / `workflow-versions.service.ts` | 별도 naming_collision 검토(scope=spec/3-workflow-editor)에서 다룰 사안 — 본 스코프 판정 대상 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec 델타 0, 실제 구현은 기존 spec 계약(endpoint_path 충돌, User/creator 데이터 경계)을 뒤늦게 실현. 다른 영역과 직접 모순 없음. INFO 2건은 이미 등재됨 |
| Rationale Continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·암묵적 가정 충돌 전부 없음. `select:false` 기각 이력과 정합적인 이름-기반 전수 검사 채택 |
| Convention Compliance | LOW | URL 명명·상태 토글·에러 코드·페이지네이션·DTO 위치·리뷰 인용 형식 전부 준수. 단 신설 409 계약이 `triggers.controller.ts` Swagger 데코레이터에 미반영(WARNING) |
| Plan Coherence | LOW | diff 는 plan 이 이미 추적해 온 항목들을 문서 부합하게 실행. 단 자매 plan 이관 지시 미집행(WARNING), harness 권한 미기술 기존 미결 유지(INFO) |
| Naming Collision | NONE | spec/2-navigation 스코프 내 신규 식별자 전부 기존 spec 선언과 일치, 충돌 없음. scope 밖 동명이형 건은 이미 별도 추적 중 |

## 권장 조치사항
1. `triggers.controller.ts` 의 `create()`·`update()` 에 `@ApiConflictResponse` 데코레이터 추가하여 409 `TRIGGER_ENDPOINT_PATH_CONFLICT` 계약을 Swagger 문서에 반영 (WARNING #1 해소).
2. 다음 planner 턴에서 `spec-draft-api-convention-verifier-registration.md` 를 `plan/complete/` 로 이관하고 `status: complete` 로 갱신 — 또는 실제 잔여 작업을 명시해 "0 open" 주장을 정정 (WARNING #2 해소).
3. 그 외 INFO 6건은 모두 이미 다른 plan/review 트래커에 등재되어 있어 이번 턴에서 추가 조치 불요 — 각 항목이 가리키는 트래커(`spec-draft-nullable-notation-followups.md` 등)에서 정상 처분되는지만 후속 확인.
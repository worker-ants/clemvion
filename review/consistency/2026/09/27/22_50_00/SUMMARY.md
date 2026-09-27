# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**MEDIUM** — Critical 은 없어 차단 사유는 아니지만, 신설 "참조의 소속" invariant(§1.1)가 저장소가 이미 확립한 "가드 1곳"/정적 완전성 가드 원칙을 스스로 인용하면서도 실제로는 그 보장 없이 구현된 신규 WARNING 1건과, 이미 트래커에 등재된 기지 WARNING 2건(Rationale §3 원문-정정 상호 참조 부재, 자매 API 문서 4곳 미러 공백)이 남아 있다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | Rationale §3 안에서 2026-07-05 원문 불릿("세 위반 모두 생성 경로와 동일한 `VALIDATION_ERROR` 재사용")과 2026-09-27 정정 단락("이 결정 뒤에도 생성 경로는 깊이만 봤다")이 상호 참조 없이 병존 — 타임라인 혼동 소지 | `spec/2-navigation/1-workflow-list.md` `## Rationale` §3 (원문 불릿 vs 바로 아래 정정 단락) | 같은 문서 §3 자체 + `spec/1-data-model.md §1.1`(신설 SoT) | 원문 불릿에 "(2026-09-27 정정 참고)" 각주 추가 또는 "같은 워크스페이스" 부분 취소선 처리. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(교차 워크스페이스 참조 후속)에 등재된 기지 항목 — 다음 planner 턴에서 처리 |
| 2 | rationale_continuity | 신설 "참조의 소속" invariant(§1.1)가 `spec/data-flow/12-workspace.md` Rationale("멤버십 검증은 가드 1곳에서 — 74번째 라우트에서 재발" 원칙을 명시 인용)을 스스로 근거로 들면서도, 실제 구현은 그 원칙이 요구하는 "가드 1곳" 이 아니라 7개 서비스(`folders`·`workflows`·`triggers`·`schedules`·`alerts`·`nodes`·`edges`)가 각자 수동 호출하는 opt-in 패턴이며, 대응하는 정적 완전성 가드(AST 스캔 등)가 없음 | `spec/2-navigation/1-workflow-list.md` L124-125, L141-142; `spec/data-flow/12-workspace.md` "본문 참조 id 도 저장 전에 소속을 본다" 절 | `spec/data-flow/12-workspace.md` Rationale "멤버십 검증은 가드 1곳에서(2026-08-08)" + `spec/2-navigation/2-trigger-list.md` `endpointPath` AST 가드(`endpoint-path-conflict-wrap*.ts`) 선례 | (a) `12-workspace.md` Rationale 에 "다만 이 입구는 서비스별 수동 호출이라 완전성은 코드 리뷰에 의존한다"는 한계를 명시하거나, (b) `endpointPath` 선례처럼 참조-소속 필드를 쓰는 `save()`/`insert()` 를 정적으로 스캔하는 repo-guard 테스트를 추가 |
| 3 | cross_spec, rationale_continuity, plan_coherence | §1.1 신설 규칙(교차 워크스페이스 참조 거부)의 API 문서 미러가 트리거/스케줄/알림/지식베이스 4개 화면 문서에서 아직 비어 있음 — 구현(`triggers.service.ts`·`schedules.service.ts`·`alerts.service.ts`·`knowledge-base.service.ts`)은 이미 착지 | 해당 없음(target `1-workflow-list.md` 자체는 무관, 자매 문서가 대상) | `spec/2-navigation/2-trigger-list.md §3`, `3-schedule.md §4`, `9-user-profile.md`(POST /api/alerts), `5-knowledge-base.md` | 별도 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md`(교차 워크스페이스 참조 후속)에 "구현 착지 후 반영"으로 이미 의도적 지연 등재됨. 다음 planner 턴에서 4개 문서 + Swagger `@ApiProperty` description 동시 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance | `common/utils/reference-in-scope.ts` 가 `nodes/core/error-codes` 를 역방향 import (이 코드베이스 유일 사례) | `codebase/backend/src/common/utils/reference-in-scope.ts` | 조치 불요 — `/ai-review` 3R(`review/code/2026/09/27/22_36_12` W1)에서 이미 수렴 예외로 처리·`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 트래킹 중. 재-flag 금지 |
| 2 | convention_compliance | `details[].code='INVALID_FIELD'` 인용 누락 (4곳) — 형제 문서(`2-trigger-list.md §2.3.1`)는 field+code 를 함께 인용하는 관례이나 이번 4곳은 field 만 인용 | `spec/2-navigation/1-workflow-list.md` §3 `POST/PATCH /api/workflows`, §3.1 `POST/PATCH /api/folders` | 완결성 제안, 규약 위반 아님·필수 대응 아님. 4곳에 `code` 필드 추가 시 wire 계약이 완전해짐 |
| 3 | convention_compliance | `## Overview` 섹션 부재 — 이번 PR 도입 아님, `spec/2-navigation/` 17개 문서 중 16개가 동일 관행 | `spec/2-navigation/1-workflow-list.md` 전체 | 이번 PR 범위 밖. 영역 전체 일괄 정리는 별도 planner 턴에서 판단 |
| 4 | plan_coherence | `settings.maxConcurrentExecutions` 에 `null` 이 오면 `@IsOptional()` 을 통과해 저장되는 문제 — 이번 diff 와 무관한 선재 이슈, 거부/허용 여부가 미해결 결정으로 남음 | `spec/2-navigation/1-workflow-list.md` §3.2 6번, `## Rationale` §2 "permissive 예외에 포함되지 않는다" | 이번 PR 범위 밖 — `plan/in-progress/spec-draft-nullable-notation-followups.md`(PATCH null 후속)에 이미 등재, 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Rationale §3 내부 모순, API 문서 미러 4곳 공백(둘 다 기지 트래커 항목) + INFO 1건(역방향 import, 이미 수렴) |
| rationale_continuity | MEDIUM | 위 두 건 재확인 + "가드 1곳" 설계 원칙과 실제 구현(수동 호출·정적 완전성 가드 부재) 간 괴리(신규 WARNING) |
| convention_compliance | NONE | INFO 2건(`details.code` 인용 완결성, `## Overview` 부재) — 규약 위반 아님 |
| plan_coherence | NONE | INFO 3건, 전부 이미 트래커 등재·이번 diff 스코프 밖 |
| naming_collision | NONE | 신규 식별자 충돌 없음 (실측: `assertReferenceInScope` 등 신규 유틸·`§1.1` 신설 앵커 전부 사전 사용처와 무충돌) |

## 권장 조치사항
1. (최우선) rationale_continuity WARNING #2 — `spec/data-flow/12-workspace.md` Rationale 에 "수동 호출이라 완전성은 코드 리뷰 의존" 한계를 명시하거나, `endpointPath` AST 가드 선례처럼 참조-소속 필드의 `save()`/`insert()` 완전성을 스캔하는 정적 repo-guard 테스트 추가를 다음 developer/planner 턴 백로그에 등재.
2. `spec/2-navigation/1-workflow-list.md` `## Rationale` §3 L198 원문 불릿에 L201 정정 단락을 가리키는 각주 추가(또는 취소선) — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재된 항목이므로 다음 planner 턴에서 함께 처리.
3. `2-trigger-list.md`/`3-schedule.md`/`9-user-profile.md`/`5-knowledge-base.md` 에 `§1.1` 미러 + Swagger `@ApiProperty` description 반영 — 이미 트래커 등재, 구현이 착지했으니 다음 planner 턴에서 진행.
4. (선택) `details[].code='INVALID_FIELD'` 4곳 보강 — 필수는 아니나 wire 계약 완결성 개선.

본 PR(`cross-workspace-refs`, `spec/2-navigation/1-workflow-list.md`)은 CRITICAL 없이 통과 가능하며, 남은 항목은 모두 이미 상위 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재되었거나 이번 diff 범위 밖의 선재 이슈다.
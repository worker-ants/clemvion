# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음

## 전체 위험도
**LOW** — `spec/5-system/` 자체 델타는 0(코드 전용 PR). 5개 checker 전원이 CRITICAL 미발견, WARNING 은 `convention_compliance` 1개(같은 유형 2건: `review-citations.md §2` 가 금지한 bare `hh_mm_ss` 인용 신규 도입)뿐이며 나머지는 전부 INFO — 대부분 이미 별도 worktree 의 planner plan 이 추적 중인 항목.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 신규 코드 주석에 `review-citations.md §2` 가 명시적으로 금지한 bare `hh_mm_ss` 인용 2건 도입 | `codebase/backend/src/modules/schedules/schedules.service.spec.ts`(JSDoc, `` `20_45_37` W2 ``) · `codebase/backend/test/schedule-trigger.e2e-spec.ts`(`//` 주석, `` `21_40_37` W1 ``) — 둘 다 이번 diff 의 `+` 라인 | `spec/conventions/review-citations.md §2` "bare `hh_mm_ss` 는 쓰지 않는다"(§4 는 *기존* 인용의 소급 정리만 면제, 신규 도입은 여전히 금지 대상) | 두 인용을 전체 경로 형태로 정정: `` `review/code/2026/09/05/20_45_37` `` / `` `review/code/2026/09/05/21_40_37` `` — `schedule-trigger.e2e-spec.ts` 는 262행 부근에 이미 전체 경로 형태로 같은 세션을 인용해 두었으니 그 형태에 맞추면 됨. 시행 가드가 없는 문서 규약이라 CI 는 못 잡으므로 이번 PR 안에서 수동 정정 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, plan_coherence | `secret-store.md §1` / `14-external-interaction-api.md §7.1` 의 "노출 창이 아직 닫혀 있지 않다" 서술이 이 diff(`TRIGGER_RESPONSE_STRIP_COLUMNS` + `SchedulesController.toResponse`)의 머지로 stale 해짐 | `spec/conventions/secret-store.md §1`, `spec/5-system/14-external-interaction-api.md §7.1` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(이 브랜치를 트리거 조건으로 명시)와 `plan/in-progress/spec-draft-notification-secret-storage.md` 양쪽이 추적 중 — 이 PR 조치 불요, 머지 후 planner 턴에서 §7.1 정정 이력 패턴으로 집행 |
| 2 | cross_spec | `ScheduleDto.trigger`/`TriggerDto.workflow` 키-생략형 근거가 OpenAPI JSDoc 에는 있으나 nav-spec 문서에는 아직 미반영 | `spec/2-navigation/3-schedule.md §4`, `spec/2-navigation/2-trigger-list.md` | 같은 plan 파일에 이미 미체크 항목으로 등재됨 — 신규 등재 불요 |
| 3 | cross_spec | 응답 축약 책임 소재가 레이어 간 비대칭(`TriggersService` 서비스 레이어 vs `SchedulesController` 컨트롤러 레이어) — 각기 근거 있음, 규약 위반 아님 | `triggers.service.ts` `sanitizeForResponse` vs `schedules.controller.ts` `toResponse` | 조치 불요. 세 번째 유사 리소스가 추가돼 패턴이 굳어지면 `2-api-convention.md`에 원칙 한 줄 고려 |
| 4 | rationale_continuity | §5.4 신규 "금지 조합"(`optional+nullable`) 축의 비소급 면제가 spec 원문이 아니라 plan 문서의 유추 적용(78건 래칫 베이스라인) | `swagger-dto-contract-guard.ts` `EXPECTED_OPTIONAL_NULLABLE_DRIFT` / `spec/5-system/2-api-convention.md §5.4` | spec 정정 의무 없음(이미 plan 에 유추임이 명시됨). 다음 §5.4 편집 기회에 "선언 형태의 조합 위반도 비소급 대상" 한 줄 추가하면 닫힘 — 비긴급 |
| 5 | plan_coherence | `4-integration.md §9.1` `IntegrationDto` 확장 필드(appUrl/mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt/consecutiveNetworkFailures) — 이 브랜치가 두 plan 의 선행조건을 충족(위반 아니라 완료 방향) | `spec/2-navigation/4-integration.md §9.1` | 이 PR 조치 불요. 병합 후 두 plan 문서(`spec-draft-nullable-notation-followups.md`, `spec-draft-notification-secret-storage.md`)의 §9.1 포인터 항목을 integrator 가 인지하면 충분 |
| 6 | plan_coherence | 신규 래칫 fixture(`optional-nullable.fixture.ts`)가 아직 어떤 spec 의 `code:` 에도 걸리지 않음 | `spec/5-system/2-api-convention.md` frontmatter `code:` | 이미 같은 plan 파일에 planner 항목으로 등재됨(fixture glob 추가 처방 포함) — 이 PR 조치 불요 |
| 7 | convention_compliance | 응답 DTO(`trigger-response.dto.ts`)가 엔티티에서 유니온 타입을 직접 import — `swagger.md §5-1` "엔티티 enum 에서 파생하지 않는다" 표면 위반이나 실제 실패 모드(enum 순서 흔들림) 미발생, `integration-response.dto.ts` 선례 있음 | `triggers/dto/responses/trigger-response.dto.ts` 2~5행 | 조치 불요. 다음 §5-1 편집 시 단독 타입-전용 import 예외를 한 줄 명시하면 재해석 분쟁 방지 |
| 8 | convention_compliance | 같은 DTO 파일 내 동일 enum 값 배열(`chatChannelHealth`/`notificationHealth`)이 두 번 반복 선언 — `swagger.md §5-1` 공유 리터럴 분리 원칙과 표면 충돌하나 두 축의 독립 진화 가능성 고려 시 현행 유지가 방어 가능 | `trigger-response.dto.ts` | 현상 유지 권장(강제 아님). 독립 진화 가능성 근거를 DTO 파일에 한 줄 남기면 다음 리뷰어 오독 방지 |
| 9 | naming_collision | `ScheduleTriggerWorkflowRefDto`(schedules 모듈) vs `TriggerWorkflowRefDto`(triggers 모듈) 명명 근접 — 접두사로 소유 모듈 구분되어 실질 충돌 아님 | `schedules/dto/responses/schedule-response.dto.ts`, `triggers/dto/responses/trigger-response.dto.ts` | 조치 불요. 추후 두 모듈 공유 필요 시 `TriggerRefDto`(공용) 통합 리팩터링 고려 가능 — 이번 PR 범위 밖 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 신규 데이터 모델/충돌 없음. secret-store.md/14-external-interaction-api.md 서술 stale화(추적 중), nav-spec 미반영(추적 중), 레이어 비대칭(무해) 3건 INFO |
| rationale_continuity | NONE | §5.4·secret-store.md §1.1 의 기존 Rationale 을 정확히 구현·확장. 무근거 번복 없음. INFO 1건(비소급 면제가 유추 적용) |
| convention_compliance | LOW | WARNING 1건(bare 시각 인용 신규 도입 2곳, review-citations.md §2). §5.4/swagger.md 나머지 규약은 폭넓게 준수. INFO 2건(enum import·중복 enum) |
| plan_coherence | LOW | 이 PR 이 두 별도 worktree planner 턴이 위임한 항목을 정확히 이행. 미결정 항목(선언적 SoT 전환, User 컬럼 방어) 우회 없음. INFO 3건(전부 이미 등재된 후속) |
| naming_collision | NONE | 신규 식별자 전수 grep 대조 결과 기존 코드/spec 과 충돌 없음. INFO 1건(명명 근접, 실질 충돌 아님) |

## 권장 조치사항
1. (WARNING 해소) `schedules.service.spec.ts`·`schedule-trigger.e2e-spec.ts` 의 bare `hh_mm_ss` 인용 2건을 `review/code/2026/09/05/<hh_mm_ss>` 전체 경로 형태로 정정한다 — `review-citations.md §2` 명시 금지 항목이며, 이 PR 이 새로 도입한 인용이라 §4 소급 정리 면제 대상이 아니다.
2. (병합 후 후속, 이 PR 조치 불요) `secret-store.md §1` / `14-external-interaction-api.md §7.1` 의 "노출 창 열림" 서술을 §7.1 정정 이력 패턴으로 갱신 — 두 plan 문서(`spec-draft-nullable-notation-followups.md`, `spec-draft-notification-secret-storage.md`)가 이미 이 브랜치를 트리거로 지목해 두었으므로 integrator/후속 planner 턴이 집행 여부만 확인.
3. (병합 후 후속, 이 PR 조치 불요) `spec/2-navigation/3-schedule.md §4`·`2-trigger-list.md`·`4-integration.md §9.1` nav-spec 반영과 `2-api-convention.md` frontmatter `code:` 에 fixture glob 추가 — 이미 planner 항목으로 등재됨.
4. 나머지 INFO(enum import 예외 명문화, 중복 enum 리터럴 근거 주석, DTO 명명 근접)는 강제 조치 없이 다음 관련 편집 시 반영 고려.
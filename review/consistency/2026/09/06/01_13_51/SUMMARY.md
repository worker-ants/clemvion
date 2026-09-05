# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음. BLOCK 사유 없음.

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 2건(둘 다 plan 문서·신규 DTO 명명의 소소한 사후 정리, target spec 자체엔 결함 없음). 나머지는 INFO 및 확인된 정합 사례.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> 해당 없음 — CRITICAL 자체가 없어 인계할 항목이 없음.

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `ScheduleDto.trigger` wire 형태에 대한 plan 자체 기록이 두 갈래로 갈리고(L474-477 "키 생략" vs L807-809 "기본형"), 실제 코드는 후자(기본형/상시 존재)와 일치. 전자가 사실관계 오류 | `spec/5-system/2-api-convention.md §5.4`(문서화 의무 규칙 자체는 무변경) — 오류는 `plan/in-progress/spec-draft-nullable-notation-followups.md` L474-477 | L807-809(동일 plan 파일의 정확한 기록), 실제 코드(`schedules.controller.ts toResponse()`) | plan L474-477 의 "키 생략" 표현을 취소선 정정하여 "기본형(null-present)"으로 바로잡고, L807-809 를 정본으로 명시하는 한 줄 추가. target(spec) 은 이 브랜치에서 변경 불요 — 후속 planner 턴이 nav-spec 문서화 시 잘못된 L474 를 참조하지 않도록 사전 정정 |
| 2 | naming_collision | `TriggerWorkflowRefDto {id,name}` ↔ `ScheduleTriggerWorkflowRefDto {name}` — 접두어 하나 차이인데 필드 구성이 달라 향후 치환 시 조용한 회귀(`id` undefined) 위험 | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`, `.../schedules/dto/responses/schedule-response.dto.ts` | 두 신규 DTO 간 명명 유사성 | 이미 양쪽 JSDoc 에 상호 경고 주석으로 완화됨(직전 라운드 W2 반영, 재발 아님). 추가 조치는 선택사항 — 원한다면 스케줄 쪽을 `ScheduleTriggerWorkflowNameRefDto` 로 리네임해 필드 구성을 이름에 반영 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `secret-store.md §1.1` "노출 창이 아직 닫혀 있지 않다" 서술이 이 브랜치 병합 시점에 stale 화됨 | `spec/conventions/secret-store.md §1` vs 코드의 `TRIGGER_RESPONSE_STRIP_COLUMNS`/`SchedulesController.toResponse` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` L797-805 가 추적 중(planner 턴 대기, developer 권한 밖). 신규 조치 불요 |
| 2 | cross_spec | `TriggerDto.workflow`/`ScheduleTriggerRefDto.workflow` 키-생략 사유가 nav-spec(`2-trigger-list.md`, `3-schedule.md §4`)에 아직 미반영 — §5.4 문서화 요구 잔여 갭 | `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md §4` | 이미 같은 plan 파일 L812-821 이 추적 중(planner 배정). 신규 조치 불요 — 단 WARNING #1 정정을 먼저 반영해야 이 후속 작업이 잘못된 사실을 옮기지 않음 |
| 3 | convention_compliance | 신설 `schedules.controller.ts` 500 응답(spec §1.1 한국어 문구 정확 준수)과 기존 `GlobalExceptionFilter.UNHANDLED_ERROR_MESSAGE`(영어, 이번 PR 무변경)가 동일 `code=INTERNAL_ERROR`에 대해 언어가 갈림 — 이 PR 의 회귀는 아니고 기존 drift 가 처음 나란히 드러난 것 | `codebase/backend/src/common/filters/http-exception.filter.ts` | 향후 트래커에 `UNHANDLED_ERROR_MESSAGE` 한국어화 항목 등재 검토(본 PR 블로커 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec/5-system 델타 0(코드 전용 PR). 비밀 스트립 4축·data model 필드·§5.4 검증 층 이원화 전부 정합 확인. 열린 두 항목(secret-store.md stale 예정, nav-spec 키-생략 사유 미반영)은 이미 plan 트래커가 추적 중인 알려진 갭(INFO) |
| rationale_continuity | NONE | CRITICAL/WARNING 없음. `select:false` 대신 컬럼 strip 채택 등 기존 Rationale 을 강화하는 방향으로만 이행, 기각된 대안 재도입·합의 원칙 위반 없음 |
| convention_compliance | NONE | spec/5-system 델타 0. 최신 커밋이 직전 라운드 CWE-209 결함을 spec §5.3 문면대로 정확히 닫음. 유일한 관측(INFO)은 이 PR 이 만든 회귀가 아닌 기존 drift |
| plan_coherence | LOW | target(spec/5-system) 자체는 무결. plan 문서 내부에 `ScheduleDto.trigger` wire 형태를 정반대로 적은 두 기록 공존(WARNING) — 후속 planner 항목이 잘못된 쪽을 참조할 위험 |
| naming_collision | LOW | spec 델타 0, 신규 코드 식별자 검토. `TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto` 명명 유사성(WARNING, 이미 완화됨) 외 진짜 의미 충돌 없음 |

## 권장 조치사항
1. (선택, BLOCK 없음이나 우선 정리 권장) `plan/in-progress/spec-draft-nullable-notation-followups.md` L474-477 의 "키 생략" 표현을 취소선 정정하여 실제 코드(기본형/상시 존재)와 일치시키고 L807-809 를 정본으로 명시 — 이후 planner 턴의 nav-spec 문서화가 잘못된 사실을 옮기지 않도록 선행.
2. (선택) `TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto` 명명 유사성은 이미 JSDoc 상호 경고로 완화됨 — 추가 리네임은 선택사항, 강제 아님.
3. (트래커 등재만) `GlobalExceptionFilter.UNHANDLED_ERROR_MESSAGE` 의 영어 문구를 spec §1.1 한국어 `INTERNAL_ERROR` 문구와 통일하는 항목을 후속 백로그에 기록 — 본 PR 의 블로커 아님.
4. `secret-store.md §1.1` stale 화 예정 서술 및 nav-spec 키-생략 사유 미반영(INFO #1, #2)은 이미 plan 트래커가 추적 중 — developer 권한 밖이므로 이 브랜치에서 추가 조치 불필요, planner 턴에서 처리.

BLOCK 사유가 없으므로 이 브랜치는 push/병합을 진행할 수 있다.

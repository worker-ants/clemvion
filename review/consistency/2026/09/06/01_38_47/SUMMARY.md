# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 확보 완료)

## 전체 위험도
**LOW** — CRITICAL/WARNING 급 spec-코드 불일치는 없으나, 이 PR 자신이 만든 spec 상태 서술의
"stale 화 예정" 후속 추적 범위가 한 군데 빠져 있어 WARNING 1건이 남는다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 이 없으므로 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 이 브랜치가 `TRIGGER_RESPONSE_STRIP_COLUMNS`/`deleteSecretColumns` 로 시크릿 응답 노출을 실제로 닫았는데, `spec/5-system/14-external-interaction-api.md` §7.1 의 "정정 이력" blockquote 는 여전히 "**현재 이 컬럼은 응답에도 나간다 … 미해결 결함**" 이라는 현재형 서술을 유지한다. 이를 갱신할 후속 plan 항목(`spec-draft-nullable-notation-followups.md`)이 문구가 복제된 `secret-store.md §1` 만 명시하고 EIA §7.1 은 빠뜨려, 다음 planner 턴이 그 항목만 따라가면 target(spec/5-system) 안에 거짓 서술이 그대로 남는다. | `spec/5-system/14-external-interaction-api.md` §7.1 정정 이력 blockquote | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `secret-store.md §1` 전용 미완료(`[ ]`) 항목 | 해당 plan 항목 제목·본문에 `14-external-interaction-api.md §7.1` 을 명시적으로 추가해, 다음 planner 턴이 두 위치("이 창은 `#<PR>` 로 closed" + 커밋 해시)를 한 번에 정정하도록 스코프를 넓힌다. 이번 PR 자체는 조치 불요(spec 쓰기는 developer 권한 밖). |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity | `secret-store.md §1` "노출 창이 아직 닫혀 있지 않다" 현재형 서술이 이 PR 머지로 stale 화 예정 (위 WARNING#1 과 자매 항목 — 같은 blockquote 문구가 EIA §7.1 에도 복제돼 있음) | `spec/conventions/secret-store.md` §1 (line 69~78) | 조치 불요. planner 턴에서 "이 창은 `#<PR>` 로 닫혔다" 정정 이력 추가(위 WARNING#1 처리 시 동반). |
| 2 | cross_spec | `TriggerDto.workflow`/`ScheduleTriggerRefDto.workflow` 키-생략 사유가 nav-spec(`2-trigger-list.md`, `3-schedule.md §4`)에 아직 미반영, plan 에는 이미 `[ ]` 등재(담당 planner) | `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md` §4 | 조치 불요. planner 턴에서 참조 필드 shape + §5.4 키-생략 사유 반영. |
| 3 | cross_spec, convention_compliance | `INTERNAL_ERROR` 고정 문구가 spec(`3-error-handling.md`, 한국어)과 `GlobalExceptionFilter` 기존 상수(영어 2종) 사이에서 갈림 — 이 PR 이 만든 신규 회귀 아님, 신설 코드는 spec 문구를 정확히 채택 | `codebase/backend/src/common/filters/http-exception.filter.ts` (`UNHANDLED_ERROR_MESSAGE`/`UNKNOWN_ERROR_MESSAGE`) | 조치 불요(이 PR 범위 밖, 이미 plan 등재·담당 developer). 필터 통일은 전역 영향이라 별도 작업으로. |
| 4 | naming_collision | `ScheduleTriggerWorkflowRefDto`(name만) vs `TriggerWorkflowRefDto`(id+name) — 이름 유사 자매 DTO, 실제 충돌 아님(필드 구성 다름, 양쪽 JSDoc 상호 경고 존재) | `schedule-response.dto.ts` / `trigger-response.dto.ts` | 조치 불요. 향후 3번째 "Ref" DTO 추가 시 접두어 관례 유지. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0(코드 전용 PR). 4축 시크릿 스트립·data model 필드·PATCH relations·§5.4 검증 층 전부 코드와 정합. INFO 3건 전부 developer 권한 밖/PR 범위 밖, 이미 plan 등재. |
| rationale_continuity | LOW | §5.4/secret-store §1.1/CWE-209 원칙을 코드가 정확히 인용·구현. 이전 라운드 Critical(시크릿 노출)을 이 PR 이 해소. INFO 1건(secret-store.md §1 stale 예정)은 이미 plan 등재. |
| convention_compliance | NONE | spec 델타 0. 신규 커밋(`0de16b488`) 전문 대조 결과 CRITICAL/WARNING 없음. §5.4 기본형/키-생략 판정·JSDoc 분리·명명 규약 전부 준수. |
| plan_coherence | LOW | plan-코드 정합성 매우 높음(커밋 해시 단위 대조). WARNING 1건 — EIA §7.1 정정 추적 범위 누락(secret-store.md만 지목, §7.1 빠짐). |
| naming_collision | NONE | 신규 식별자 전수 grep 대조, 의미 충돌 없음. INFO 1건(이름 유사 자매 DTO, 이미 문서화된 의도적 설계). |

## 권장 조치사항
1. (WARNING 해소, planner 턴) `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
   `secret-store.md §1` 전용 미완료 항목 제목·본문에 `spec/5-system/14-external-interaction-api.md §7.1`
   을 명시적으로 추가 — 다음 planner 턴이 두 위치를 함께 정정하도록 스코프 확장.
2. (동일 planner 턴) `secret-store.md §1` + EIA §7.1 "미해결 결함" 현재형 서술을 이 PR 머지 후
   "이 창은 `#<PR>`/커밋 해시로 닫혔다" 과거형 정정 이력으로 교체.
3. (planner 턴, 이미 등재) `2-trigger-list.md`·`3-schedule.md §4` 에 `workflow` 필드 키-생략
   사유(§5.4 기준 (b)) 반영.
4. (별도 작업, PR 범위 밖) `GlobalExceptionFilter` 의 미매핑 5xx 영어 문구 2종을
   `3-error-handling.md` 한국어 고정 문구로 통일할지 검토 — 전역 영향이라 독립 작업으로.
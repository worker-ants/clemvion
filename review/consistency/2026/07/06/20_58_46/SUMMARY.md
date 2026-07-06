# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 단, `rationale_continuity`/`convention_compliance` 2개 checker 결과 파일이 보고된 경로에 존재하지 않아 재시도 필요.

## 전체 위험도
**LOW** — 확인 가능한 3개 checker(cross_spec, plan_coherence, naming_collision) 모두 LOW, Critical/BLOCK 사유 없음. 다만 2개 checker(rationale_continuity, convention_compliance) 결과가 output_file 경로에서 확인되지 않아 이 부분은 "재시도 필요" 상태로 완전성이 제한됨.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/4-nodes/1-logic/12-background.md` §8.2 (모니터링 API 응답 스키마)가 attribution 방식 변경(§항목 1) 갱신 대상에서 누락 | target payload 항목 1 (spec-update 위임 범위 서술) | `12-background.md` §8.2 `notifications` 필드 설명, `background-runs.service.ts` `findByResource('background_run', …)` 호출부 | planner 위임 시 `12-background.md` §8.2 를 갱신 대상에 명시적으로 추가 |
| 2 | cross_spec | `notification-response.dto.ts` 의 `resourceType` Swagger 문서(허용값 "execution, background_run") 갱신 누락 가능성 | target payload 항목 1 | `notification-response.dto.ts` `@ApiPropertyOptional` 설명/예시 | DTO 갱신 시 `background_run` 언급 제거 + `background_run_id` 신규 필드 설명 추가를 체크리스트화 |
| 3 | naming_collision | `notification.background_run_id` 신규 컬럼 도입 시 `background-runs.service.findByResource('background_run', backgroundRunId)` 호출부가 target 계획에서 명시적으로 언급되지 않음 (dual-write drift 위험) | target payload 항목 1 | `background-execution.processor.ts` INSERT 로직, `background-runs.service.ts:398-403` | 작업 항목에 "INSERT 시 resource_type='workflow' 통일" + "findByResource 호출을 신규 background_run_id 컬럼 기반 조회로 치환"을 명시적으로 추가 |
| 4 | naming_collision | `notification.background_run_id` 가 API 응답 DTO 에 노출되는지 여부 미정 (프론트 `NotificationLite` 타입 계약과 연관) | target payload 항목 1 | `notification-response.dto.ts`, 프론트 `href.ts`/`NotificationLite` | spec-update 위임 문서(§2.1/§2.19)에 "내부 전용 컬럼, REST 응답 미노출" 여부를 명문화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, plan_coherence | §1.1 `background_failed` 행에 resource_type/resource_id 계약(신규 `background_run_id` attribution 방식) 명시 누락 — `execution_failed`/`schedule_failed` 행과 비대칭 | `spec/data-flow/8-notifications.md` §1.1 표 | 항목 1 구현 시 §1.1 `background_failed` 행도 동일 패턴으로 갱신 (planner 위임 범위에 명시적으로 추가) |
| 2 | cross_spec | `notification`(in-app) vs `notification-webhook`/`NotificationDispatcher`(outbound) 명명 유사성 — 기존 상태, 즉각 충돌 아님 | `spec/data-flow/0-overview.md` §4, `spec/1-data-model.md` §2.8 | 조치 불필요, 향후 동시 언급 시 명시적 구분 문구 권고 |
| 3 | cross_spec, naming_collision | 마이그레이션 번호 placeholder `V0xx` — 실제 최신은 `V106` | 최신 파일 `V106__schedule_trigger_id_index.sql` | 구현 착수 직전 `ls codebase/backend/migrations/ | tail` 로 재확인 후 채번 (통상 절차) |
| 4 | naming_collision | `notification.background_run_id` 컬럼명이 `V047` 의 JSONB path 인덱스명(`idx_node_execution_background_run_id`, 다른 테이블)과 표기 유사 | `codebase/backend/migrations/V047__node_execution_background_run_id_index.sql` | 신규 마이그레이션 주석에 "V047 인덱스는 다른 테이블의 JSONB path 인덱스, 본 컬럼과 무관" 명시 |
| 5 | plan_coherence | `team_invite` 이메일 2통 OPEN 항목(`spec-update-notifications-firing.md`)과 target 범위 경계 확인 — 충돌 없음 | target 범위 밖 | 조치 불요 (참고용 확인) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 항목 1(딥링크/attribution 분리)이 실측 코드 drift와 정확히 일치하는 정확한 진단이나, spec-update 위임 범위가 `12-background.md §8.2`·자기 문서 §1.1 `background_failed` 행을 누락 |
| rationale_continuity | 재시도 필요 | output_file 이 디스크에 존재하지 않아 결과 확인 불가 |
| convention_compliance | 재시도 필요 | output_file 이 디스크에 존재하지 않아 결과 확인 불가 |
| plan_coherence | LOW | target 이 근거 plan(`notif-hardening-followups.md`)과 완전히 정합, PR1~3 tracker 가 이월한 선존 결함을 정확히 이어받음. team_invite OPEN 항목과도 충돌 없음 |
| naming_collision | LOW | 신규 식별자(`background_run_id` 컬럼) 자체는 CRITICAL 충돌 없음. 기존 `findByResource('background_run', …)` 호출부 갱신 누락 위험 WARNING 2건 |

## 권장 조치사항
1. `rationale_continuity`, `convention_compliance` checker 재실행 (output_file 미생성 — 본 세션에서 직접 재실행).
2. planner 위임 시 spec-update 범위에 다음을 명시적으로 추가: (a) `spec/data-flow/8-notifications.md` §1.1 `background_failed` 행의 attribution 방식 문서화, (b) `spec/4-nodes/1-logic/12-background.md` §8.2 `notifications` 필드 설명 갱신, (c) `notification-response.dto.ts` Swagger 예시/설명 갱신.
3. 개발 착수 시 `background-runs.service.ts` 의 `findByResource('background_run', backgroundRunId)` 호출부를 신규 `background_run_id` 컬럼 기반 조회로 교체하는 작업을 명시적 작업 항목으로 계획에 추가 (dual-write drift 방지).
4. 마이그레이션 채번은 착수 직전 최신 번호(현재 `V106` 다음 = **V107**) 재확인 — 확인 완료.

---

## 재실행 addendum (2건 checker output_file 미생성분 복구)

원 Workflow 이 `rationale_continuity`/`convention_compliance` 를 success 로 보고했으나 output_file 이
디스크에 없어 직접 재실행함. 결과:

- **rationale_continuity** — risk=**LOW**, 0 CRITICAL / 1 WARNING / 3 INFO.
  WARNING: legacy `execution` resource_type fallback 제거에 Rationale 필요 → **처리됨** (migration V107·processor
  주석 + spec-update draft `spec-update-notifications-background-run-id.md` 의 Rationale 항목).
  (재실행 sub-agent 가 main repo review 경로에 Write → 세션 dir 로 복사 반영.)
- **convention_compliance** — risk=MEDIUM, **1 CRITICAL / 2 WARNING / 2 INFO**.
  - **[CRITICAL] = FALSE POSITIVE (재실행 타이밍 아티팩트)**: 원 impl-prep Workflow 는 **코드 작성 이전**에
    실행돼 **BLOCK: NO** 로 게이트를 통과했고, 그 clearance 이후에 구현을 착수했다. 본 checker 는 그
    이후 병렬 재실행분이라 진행 중인 워크트리(V107·entity·service 수정)를 보고 "게이트 사후 수행"으로
    오판했다. 실제 실행 순서상 게이트는 정상 준수됨 — **BLOCK 아님**.
  - **[WARNING] DTO `resourceType`/`type` Swagger 문서 옛 값 광고** → **처리됨** (`notification-response.dto.ts`
    의 `resourceType` description=`workflow`/`integration`/`workspace_invitation`, `type` example=`execution_failed` 로 갱신).
  - **[WARNING] spec §2.19/§2.1 에 `background_run_id` 미기재, 코드 선행 drift** → **처리됨** (spec-update draft
    `spec-update-notifications-background-run-id.md` 신설, planner 즉시 위임 대상으로 등록).

**최종 판정: BLOCK: NO** (실 Critical 0건 — convention_compliance 의 CRITICAL 은 재실행 타이밍 오판).

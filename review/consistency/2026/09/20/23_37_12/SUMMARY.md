# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. `spec_impact: none` 코드 전용 수정(`SchedulesService.remove()` 동시 DELETE 중복 감사)에 대해 spec 모순·Rationale 번복·규약 위반·신규 식별자 충돌 어느 축에서도 차단 사유 없음.

## 전체 위험도
**MEDIUM** — 차단 사유는 없으나, 이 plan 자신이 만든 두 후속 약속(IntegrationsService 트래커 등재, 스케줄 문서화 격차 반영)이 실행 메커니즘 없이 prose 로만 존재해 이 결함 클래스에서 이미 3회 반복된 "후속 항목 유실" 패턴이 재발할 위험(plan_coherence MEDIUM)이 전체 위험도를 끌어올린다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 미검출)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `IntegrationsService.remove()` 동일 결함 클래스(다섯 번째 자리)의 트래커 등재가 아직 실행되지 않음 — plan 은 "트래커에 등재한다"고 prose 로만 선언, 체크리스트에 실행 항목 없음, 트래커 grep 0건 | `plan/in-progress/schedule-dup-delete.md` (서두 표, 25~30행) | `plan/in-progress/spec-draft-nullable-notation-followups.md` (grep `IntegrationsService.remove\|INTEGRATION_DELETED` 0건) | 체크리스트에 "트래커 등재" 명시 체크박스 추가, 또는 이번 세션 중 즉시 등재. `plan/complete/` 이동 전 필수(선례 3회 반복된 유실 패턴) |
| 2 | plan_coherence | `3-schedule.md` 가 "동시 삭제 → 두 번째 404" 문서화 격차 트래커 항목의 스코프(workflow·workspace 두 문서만 열거)에서 빠져 있음 | `spec/2-navigation/3-schedule.md` §4 API (`DELETE /api/schedules/:id`) | `plan/in-progress/spec-draft-nullable-notation-followups.md:4785` | 이번 plan 종료 전 트래커 4785행 스코프 목록에 `3-schedule.md §4` 추가 |
| 3 | convention_compliance | `1-workflow-list.md` frontmatter `pending_plans` 가 이미 `plan/complete/` 로 이동한 plan(`workflow-duplicate-nodes-edges.md`)을 계속 참조 | `spec/2-navigation/1-workflow-list.md` frontmatter | `spec/conventions/spec-impl-evidence.md` §2.1/§3 | 신규 조치 불요 — `spec-draft-nullable-notation-followups.md` 기존 오픈 항목(2026-09-20 등재)이 이미 동일 사실을 다루므로 그 처리를 기다림 |
| 4 | convention_compliance | `GET /api/folders`(1-workflow-list.md §3.1) · `GET /api/triggers/:id/history`(2-trigger-list.md §3) 두 행이 응답 wrap 형태를 표에 기재하지 않음 | `1-workflow-list.md` §3.1 / `2-trigger-list.md` §3 | `spec/conventions/swagger.md` §5 | 신규 조치 불요 — 동일 followups 오픈 항목이 이미 등재, 처리 시 함께 닫힘 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `3-schedule.md` 에 `2-trigger-list.md §4.4` 와 대칭되는 "동시 삭제 → 두 번째 404" 결과 서술이 없음 (모순 아닌 침묵) | `spec/2-navigation/3-schedule.md` §4 | 위 WARNING #2 트래커 스코프 확장으로 함께 흡수 가능 |
| 2 | rationale_continuity | "판정 기준은 락 보호 하위 쓰기의 `affected`, CASCADE 로 사라지는 하위 행 자체는 판정자가 될 수 없다"는 원칙이 이번까지 3회(workflows/triggers/schedules) 반복 재발견되었으나 아직 Rationale 에 일반 원칙으로 명명되지 않음 | `spec/2-navigation/2-trigger-list.md §3` | `IntegrationsService.remove()` 차례에서 재도출 방지 위해 Rationale 에 한 문단 추가 권장(강제 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·감사 명명·advisory lock 소유·RBAC 전 축 정합. INFO 1건(대칭 서술 부재) |
| rationale_continuity | NONE | 기존 Rationale(0행 매치 판정·동시 삭제 404·외부호출 락외 원칙)을 번복 없이 정확히 확장 적용. INFO 1건 |
| convention_compliance | LOW | WARNING 2건 모두 기존 `spec-draft-nullable-notation-followups.md` 오픈 항목에 이미 등재되어 있어 신규 백로그 불요 |
| plan_coherence | MEDIUM | plan 이 만든 두 후속 약속(Integrations 트래커 등재, 스케줄 문서화 스코프 확장)이 체크리스트/트래커 실행 메커니즘 없이 prose 로만 존재 — 3회 반복된 "후속 유실" 패턴 재발 위험 |
| naming_collision | NONE | 신규 식별자 없음(감사 액션·lock key·상태쌍 전부 기존 재사용), spec/코드 변경 자체가 없음 |

## 권장 조치사항
1. `plan/in-progress/schedule-dup-delete.md` 체크리스트에 "`spec-draft-nullable-notation-followups.md` 에 `IntegrationsService.remove()` 항목 등재" 체크박스를 추가하거나, 이번 세션 중 즉시 그 트래커 항목을 등재한다 (`plan/complete/` 이동 전 필수).
2. `spec-draft-nullable-notation-followups.md:4785` 의 "동시 삭제 → 404 문서화 격차" 스코프 목록에 `3-schedule.md §4` 를 추가해 스케줄 축이 세 번째로 누락되지 않게 한다.
3. convention_compliance WARNING 2건(`1-workflow-list.md` stale `pending_plans`, `GET /api/folders`/`GET /api/triggers/:id/history` 응답 shape 미기재)은 신규 처리 불요 — 기존 followups 오픈 항목 처리 시 함께 닫는다.
4. (선택, 강제 아님) `2-trigger-list.md §3` Rationale 에 "판정자는 락 보호 쓰기의 `affected`, CASCADE 하위 행은 판정자가 될 수 없다" 일반 원칙을 한 문단 추가해 `IntegrationsService.remove()` 차례에서 동일 논리를 재도출하지 않도록 한다.

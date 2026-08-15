# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 확보)

## 전체 위험도
**MEDIUM** — cross_spec 이 MEDIUM(1건 WARNING), 나머지는 LOW/NONE. Critical 은 없으나 WARNING 3건이 spec SoT 문서 갱신 누락 패턴으로 수렴한다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 자체가 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `duration_ms`/`started_at` 이 "실행 시작~소요 시간"이라는 무조건적 서술을 유지하지만, EIA §6.5 가 새로 명문화한 "취소 경로(큐 대기 타임아웃·park 취소·공개 위젯 idle 회수) = 대기 시간" 예외가 반영되지 않음 | `spec/5-system/14-external-interaction-api.md` §6.5 (신설 캐비엇) | `spec/1-data-model.md` §2.13 Execution 엔티티 표 (`started_at`/`duration_ms` 행) | `1-data-model.md` 두 필드 행에 EIA §6.5 로의 cross-link 캐비엇 한 줄씩 추가, 또는 `spec-sync-external-interaction-api-gaps.md` 기존 "필드 분리" 항목에 사전 조치로 병기 |
| 2 | rationale_continuity | `avgExecutionTime`/`avgDurationMs` 집계를 `status='completed'` 로 좁힌 결정(`f79792621`)이 CHANGELOG/plan 에는 근거가 있으나 컨벤션상 SoT 위치인 spec `## Rationale` 에는 기록되지 않음 | `codebase/backend/.../dashboard.service.ts`, `.../statistics.service.ts` (커밋 `f79792621`) | `spec/2-navigation/0-dashboard.md:141`, `spec/2-navigation/7-statistics.md:69` (필드 설명·`## Rationale` 무변경) | `0-dashboard.md` `## Rationale` 에 "avgExecutionTime 은 status='completed' 로만 집계(2026-08-15) — durationMs 가 취소/타임아웃 경로에도 채워지기 시작해 오염 방지" 문단 추가, `7-statistics.md` 에 cross-ref |
| 3 | convention_compliance | 신설 `terminal-duration.ts` (스스로 EIA §6 을 SoT 로 자칭)가 어떤 spec frontmatter `code:` 글로브에도 매칭되지 않아 spec-impl-evidence 사슬이 이 파일에 한해 끊김 | `spec/5-system/14-external-interaction-api.md` frontmatter `code:`, §6 `durationMs` 행("구현됨"), §6.5 신설 캐비엇 | `codebase/backend/src/shared/utils/terminal-duration.ts` (신규 파일, 어느 spec `code:` 글로브에도 미매칭) | `14-external-interaction-api.md` 또는 `4-execution-engine.md` 의 `code:` 에 `codebase/backend/src/shared/utils/terminal-duration.ts` 명시 추가 (`strip-external-only-fields.ts` 개별 등재 선례와 동일 패턴). developer 권한 밖(`spec/` read-only) — project-planner 턴 필요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 재확인(pre-existing, diff 밖): EIA §8.2 HMAC 화이트리스트 불일치·`InteractionRequestContext` 구형 서술·§5.1 legacy 대비 오서술·`EIA-AU-09` 미정의 참조 4건 — 이미 `spec-sync-external-interaction-api-gaps.md` 추적 중, 이번 diff 와 무관 | `spec/5-system/14-external-interaction-api.md` 외 3곳 | 조치 불요(기존 트래커 유지) |
| 2 | rationale_continuity | `spec/data-flow/3-execution.md` 시퀀스 다이어그램이 취소 경로 신규 캐비엇(대기 시간 의미론, retry-turn 재진입 예외) 미반영 — 4라운드째 동일 상태로 이월, 회귀 아님 | `spec/data-flow/3-execution.md:111` (diff 밖) | 이번 PR 범위 밖이면 plan 에 "다음 턴 이연" 사유 명시 |
| 3 | plan_coherence | 직전 라운드(`10_52_07`) W4(retry-turn 재진입 시 DB≠emit `durationMs` invariant 캐비엇 누락)가 커밋 `a67ec89b7` 로 정확히 해소됨을 교차 확인 — target 의 `spec-sync-external-interaction-api-gaps.md` 포인터도 실재 확인(허위 아님) | `spec/5-system/14-external-interaction-api.md` §6.5 | 조치 불요 |
| 4 | plan_coherence | `retry-turn-terminal-guard.md` #2 를 가리키는 줄 번호 인용이 stale 이나 함수 심볼로 특정 가능, 실질 내용은 정합 — 이번 라운드도 무변화로 이월 | `plan/in-progress/eia-terminal-payload.md` "다른 plan 과의 관계" 절 | 조치 불요, 착수 시 자연히 재확인됨 |
| 5 | naming_collision | `resolveTerminalDurationMs`(신규) 가 형제 헬퍼 `toTerminalErrorPayload` 와 동일 역할(종결 필드 정규화)임에도 `resolve*` vs `to*` 로 접두어가 갈림 — 충돌 아님, 명명 일관성 참고 | `codebase/backend/src/shared/utils/terminal-duration.ts` | 필수 조치 아님. 다음에 파일 쌍을 만질 때 참고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `1-data-model.md` 가 EIA §6.5 의 "취소 경로 = 대기 시간" 신규 의미론을 반영 안 함 (WARNING 신규 등재) + pre-existing 4건 재확인(diff 밖) |
| rationale_continuity | LOW | 대시보드/통계 `completed`-only 집계 결정이 spec `## Rationale` 에 미기록 (WARNING) + 다이어그램 미동기화 이월 (INFO) |
| convention_compliance | LOW | `terminal-duration.ts` 가 spec-impl-evidence `code:` 글로브 어디에도 미매칭 (WARNING) — 그 외 축은 전부 규약 준수 |
| plan_coherence | NONE | 직전 라운드 WARNING 정확히 해소 확인, 자매 트래커 3개 동기 유지, 허위 포인터 없음 — 전부 INFO |
| naming_collision | NONE | 신규 식별자 6가지 관점 전수 대조, 충돌 0건 — 명명 접두어 불일치 1건만 INFO |

## 권장 조치사항

1. `spec/1-data-model.md` §2.13 `started_at`/`duration_ms` 행에 EIA §6.5 cross-link 캐비엇 추가 (cross_spec WARNING 해소, 원천 엔티티 SoT 오인 방지 — project-planner 권한)
2. `spec/2-navigation/0-dashboard.md`·`7-statistics.md` `## Rationale` 에 "completed 전용 집계" 결정 문단 추가 — 근거는 이미 CHANGELOG/plan 에 있어 옮겨적기만 필요 (rationale_continuity WARNING 해소 — project-planner 권한)
3. `14-external-interaction-api.md` 또는 `4-execution-engine.md` frontmatter `code:` 에 `terminal-duration.ts` 경로 추가 (convention_compliance WARNING 해소, spec-impl-evidence 사슬 복구 — project-planner 권한)
4. 위 3건 모두 `spec/` 쓰기 권한이 필요해 developer 턴에서는 직접 해소 불가 — project-planner 턴에서 일괄 처리 권장 (Critical 아니므로 즉시 차단 사유는 아니나, 다음 spec 갱신 시 함께 반영)
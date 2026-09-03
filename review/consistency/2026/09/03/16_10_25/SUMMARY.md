# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보)

## 전체 위험도
**LOW** — spec 델타 0(코드 전용 nullable 타입 정직화 PR)이고 새 위반은 없으나, 선재하던 spec 문서 오기재 2건(WARNING)이 확인됨. 둘 다 이번 PR 이 만든 것이 아니라 기존 gap 이며 하나는 이미 plan 에 planner 턴 후속 항목으로 등재되어 있음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 자체가 없어 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity(INFO로도 중복 지적) | `Schedule.next_run_at` 엔티티가 이번 diff 로 `Date \| null` 로 명시 확장되고 회귀 테스트로 고정됐으나, `spec/1-data-model.md` §2.9 표기는 여전히 non-nullable(`Timestamp`, `?` 없음) | `spec/1-data-model.md:260` (§2.9 Schedule 테이블) | `codebase/backend/src/modules/schedules/entities/schedule.entity.ts`(`nextRunAt: Date \| null`) + `schedule-runner.service.ts`/`schedules.service.ts` 의 명시적 `null` 대입 + 신규 가드 테스트 | planner 턴에서 `next_run_at` 을 `Timestamp?` 로 정정 + `spec/data-flow/10-triggers.md §3.2` 에 "cron 파싱 실패 시 NULL(정보성 컬럼, 발사 자체엔 영향 없음)" 한 줄 보강. **이미 `plan/in-progress/entity-nullable-column-type-mismatch.md` "할 일"에 "후속(planner 턴)" 으로 명시 등재되어 있어 개발자가 권한 밖으로 정확히 판단·위임한 상태** — 이번 PR 을 막을 사유 아님 |
| 2 | convention_compliance | `/api/auth/*` 액션형 엔드포인트 15개 이상이 URL 명명 규칙(§2.2)의 명시된 두 예외(RPC-style sub-channel action `{id}` 필수 / `/api/external/*`) 어디에도 포섭되지 않음 | `spec/5-system/1-auth.md §5` (엔드포인트 카탈로그) | `spec/5-system/2-api-convention.md §2.2` 명명 규칙표 | §2.2 에 "인증/세션 액션 네임스페이스(`/api/auth/{verb}`)는 리소스가 아닌 컨트롤러-style RPC라 복수형 명사·`{id}` 전제 규칙 밖" 예외 행 추가, 또는 action-only 네임스페이스는 2단계 상한 제외 원칙 명시. 이번 PR 과 무관한 선재 gap(코드 diff 는 API 표면 미변경) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence, rationale_continuity | `Schedule.next_run_at` 후속 항목이 이미 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 planner 턴 위임으로 정확히 기록됨 (developer 가 자기-반증형 소정정 예외 미해당으로 스스로 판단, `git diff -- spec/` 0건으로 확인) | `plan/in-progress/entity-nullable-column-type-mismatch.md` "## 할 일" | 별도 조치 불요 — 규약을 정확히 지킨 사례, 착수 시점 참고용 |
| 2 | convention_compliance | 프롬프트 예산으로 `spec/5-system/*.md` 20개 중 16개(`3-error-handling.md`·`4-execution-engine.md`·`6-websocket-protocol.md` 등)는 전문 미검토, 필요 범위만 발췌 확인 | `spec/5-system/` 하위 16개 문서 | 다음 standing 점검에서 별도 배치로 전문 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `Schedule.next_run_at` nullable 여부가 `spec/1-data-model.md` §2.9 와 어긋남(선재 gap, 이번 PR 이 더 뚜렷하게 드러냄) |
| rationale_continuity | NONE | CRITICAL/WARNING 없음. 3라운드 리뷰로 늘어난 9줄도 직전 세션(15_17_03, NONE)과 성격 동일. Rationale·선례(`Execution.error` 등)와 정합 |
| convention_compliance | LOW | `/api/auth/*` 15개 이상이 §2.2 명명 규칙의 명시 예외 두 가지 어디에도 포섭 안 됨(선재 gap). 감사 액션·에러코드 정합성은 매우 높음 |
| plan_coherence | NONE | 이번 diff 는 자신을 추적하는 plan 서술과 1:1 일치, 미해결 항목·후속 위임 모두 정확. 타 in-progress plan 과 충돌 없음 |
| naming_collision | NONE | 신규 코드 심볼·파일 경로 전부 저장소 전체 대조 결과 충돌 없음. spec 표면 신규 식별자 자체가 없음(spec 델타 0) |

## 권장 조치사항
1. (선택, 비차단) planner 턴에서 `spec/1-data-model.md:260` `next_run_at` 을 `Timestamp?` 로 정정 + `spec/data-flow/10-triggers.md §3.2` 에 NULL 케이스 한 줄 보강 — 이미 plan 에 등재된 후속 항목이므로 이번 PR 진행을 막지 않음.
2. (선택, 비차단) `spec/5-system/2-api-convention.md §2.2` 에 `/api/auth/*` 액션-네임스페이스 예외 조항 추가 — 별도 planner 턴 후속 과제로 등재 권장(현재 plan 에 미등재 상태이므로 이번 검토가 최초 기록).
3. 다음 standing convention 점검 시 `spec/5-system/*.md` 나머지 16개 문서 전문 검토 배치 편성.

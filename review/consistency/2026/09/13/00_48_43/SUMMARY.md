# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 전문 확보(모두 status=success, 인라인 전문 그대로 반영, 5개 checker 파일 모두 이미 디스크에 존재함을 확인). Critical 없음.

## 전체 위험도
**LOW** — 코드 전용 diff(keyset 커서 `id` 성분 `isUuidShaped` 검증 추가, `spec/5-system` 델타 0)이며 새로 만든 결함 없음. 유일한 실질 쟁점(cursor 실패 계약 비대칭)은 이번 diff가 새로 만든 것이 아니라 기존 갭을 유지한 채 노출을 굳혔을 뿐이고, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 결정 항목으로 정확히 등재돼 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없어 인계 대상 없음. 단, 아래 WARNING 2건은 developer 권한 밖(spec 카탈로그/계약 통일 결정)이라 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 등재된 상태이며, 이번 세션이 새로 인계할 것은 없다(선행 라운드에서 이미 정확히 처리됨).

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | 두 keyset 커서 디코더의 실패 계약이 다름(`login-history`=무효 시 무시+1페이지, `background-runs`=400 `INVALID_CURSOR`)에도 `2-api-convention.md §8.2`는 400 단일 표준만 서술. 이번 diff가 두 계약을 각각 강화해 비대칭이 문서화 없이 더 굳어짐 | `spec/5-system/2-api-convention.md §8.2` vs `codebase/backend/src/modules/auth/login-history.service.ts`(`decodeCursor`) / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`(`decodeCursor`) | 이번 diff가 새로 만든 결함 아님 — 선행 라운드(`review/consistency/2026/09/12/22_51_25`)에서 이미 지적, `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 등재됨(코드 주석·e2e 대조군까지 이미 명시). 신규 조치 불요 |
| 2 | cross_spec(INFO), convention_compliance(WARNING) | Background Runs 에러 코드 4종(`INVALID_CURSOR`/`INVALID_LIMIT`/`EXECUTION_NOT_FOUND`/`BACKGROUND_RUN_NOT_FOUND`)이 `3-error-handling.md §1` 중앙 카탈로그에 미등재. §1.6 각주의 `EXECUTION_NOT_FOUND` 분류도 §1.9 기준과 불일치 | `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:184`(이번 diff가 `INVALID_CURSOR` 호출부 1곳 증가) vs `spec/5-system/3-error-handling.md §1`, `spec/4-nodes/1-logic/12-background.md §8.7` | pre-existing 갭, 이번 diff가 신규 생성하지 않음. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목(§1.13 신설 + 역링크)으로 등재. 신규 조치 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `isUuidShaped` 소비처가 원 Rationale의 서술 범위(워크스페이스 헤더 인가 컨텍스트)를 벗어나 커서 id 검증(리소스 지목 컨텍스트)까지 확장됐으나, 원 Rationale SoT 문서에는 이 확장이 반영되지 않음 | `spec/data-flow/12-workspace.md`("UUID 검증 강도 비대칭" Rationale) vs `codebase/backend/src/common/utils/uuid.ts` JSDoc, `login-history.service.ts`, `background-runs.service.ts` | 코드 axis는 이미 자체 근거(plan §B 각주, JSDoc)를 남겨 블로킹 사유 아님. 여유 있을 때 planner 턴에서 `12-workspace.md` Rationale 말미에 소비처 확장 사실을 한 줄 각주로 추가 권장 |
| 2 | rationale_continuity | 트래커 처방("`GlobalExceptionFilter`에 22P02→400 분기 추가") won't-do 종결의 근거(`3-error-handling.md §1` JWT 클레임 미검증 원칙 인용)가 실제 spec 원문과 정확히 일치함을 확인 — 지어낸 근거 아님 | `CHANGELOG.md`, `plan/in-progress/keyset-cursor-uuid-validation.md §A` | 조치 불요. 다만 이 won't-do 결정이 트래커 체크박스에만 있어 archive 이동 시 근거가 묻힐 수 있음 — 향후 `3-error-handling.md` Rationale 절에도 짧게 등재 고려(비차단) |
| 3 | convention_compliance | 리뷰 인용 형식(`review-citations.md §2`) 전부 전체 경로 준수, 실재 세션 디렉터리 확인됨. Rationale 인용도 실제 spec 섹션과 정확히 일치 | 신규 주석 전체 | 조치 불요 |
| 4 | convention_compliance | 응답 포맷(에러 봉투 `error.code`, cursor pagination shape `data.items`/`nextCursor`) 규약과 신규 e2e 단언이 정확히 일치 | `background-monitoring.e2e-spec.ts`, `session-revocation.e2e-spec.ts`, `background-runs.service.spec.ts` | 조치 불요 |
| 5 | plan_coherence | 이미 완료된 선행 plan `plan/in-progress/trigger-uuid-and-guide-error-codes.md`(PR #1328, origin/main 머지 완료, 체크리스트 전항목 `[x]`)이 아직 `plan/complete/`로 이동되지 않음. 이름 유사성(uuid/error-codes 계열)으로 이번 plan과 혼동될 여지가 이미 한 번 실현됨(해당 문서 자신이 스코프 고지를 달아둠) | `plan/in-progress/trigger-uuid-and-guide-error-codes.md` | 이번 PR 범위 밖. 다음 정리 배치에서 `plan/complete/`로 이동 권고(plan-lifecycle 위생) |
| 6 | naming_collision | 신규 식별자(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로) 6개 관점 전수 확인, 충돌 없음. `isUuidShaped`·`INVALID_CURSOR` 등은 전부 기존 식별자 재사용 | 전체 diff | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | cursor 실패 계약 비대칭(§8.2 vs login-history)이 이번 diff로 각자 강화되며 굳어짐 — 이미 planner 항목으로 등재돼 신규 조치 불요 |
| rationale_continuity | NONE | 트래커 처방 번복(22P02→400 기각)에 실재 Rationale 근거 정확 인용, `isUuidShaped` 소비처 확장은 원칙 위반 아니나 SoT 미반영(INFO) |
| convention_compliance | LOW | 신규 규약 위반 없음. Background Runs 에러코드 카탈로그 미등재·§8.2 단일 계약 서술, 둘 다 pre-existing 이미 등재됨 |
| plan_coherence | NONE | 미해결 결정 우회·선행조건 무시·후속 누락 전부 없음. 완료된 무관 plan 1건이 in-progress 잔존(위생 이슈, INFO) |
| naming_collision | NONE | 신규 식별자 사실상 없음(기존 함수·에러코드·endpoint 재사용). 6개 관점 충돌 없음 |

## 권장 조치사항
1. (이번 PR 블로킹 항목 없음 — 조치 불요)
2. 향후 project-planner 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 두 항목(cursor 실패 계약 §8.2 각주 또는 통일 결정, Background Runs 에러코드 4종 §1.13 카탈로그 등재)을 함께 처리
3. 여유 있을 때 `spec/data-flow/12-workspace.md`의 `isUuidShaped` Rationale에 커서 id 검증 소비처 확장 사실을 각주로 추가
4. plan 위생: `plan/in-progress/trigger-uuid-and-guide-error-codes.md`(이미 완료·머지됨)를 `plan/complete/`로 이동
# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 불필요.

## 전체 위험도
**LOW** — 위반 사항은 모두 WARNING/INFO 수준이며, plan 문서의 권장안 갱신과 spec Rationale 보충이 후속 과제로 남음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Rationale Continuity / Plan Coherence | Option A 채택 + Option B 거절이 plan 권장안(Option B)을 번복하나 plan 문서 미갱신 — 결정 근거(WorkerHost NestJS lifecycle으로 §11.2 이미 충족, queue.pause() Redis 전역 플래그 multi-instance stall)가 plan·spec 어디에도 기록되지 않은 채 구현만 달라짐 | 검토 대상 변경 설명 전체 | `plan/in-progress/refactor/06-concurrency.md` M-2 "권장: B" 서술 | plan M-2의 옵션 비교표에 Option B 단점 추가("WorkerHost 자동 close로 §11.2 이미 충족 + queue.pause() Redis 전역 플래그") 및 "권장"을 B → A로 정정. spec §11 Rationale에도 framework 의존 이행 경로 한 줄 추가(planner 경유). 구현 PR 완료 후 planner 위임으로 처리 가능. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | §11.2 "신규 job consume 중단" 이행 수단이 spec에 미명시 — framework 의존 경로가 spec 추론 불가 | `spec/5-system/4-execution-engine.md §11` 항목 2 | §11 하위 또는 Rationale에 "신규 consume 중단은 @nestjs/bullmq WorkerHost의 onApplicationShutdown → worker.close() 경로로 이행, 별도 queue.pause() 금지(전역 Redis 플래그·multi-instance stall)" 보충(planner 경유) |
| 2 | Cross-Spec | data-flow/3-execution.md §3.3 "대상" 셀이 shutdown 중 시작 노드 포함 여부를 명시하지 않음 | `spec/data-flow/3-execution.md §3.3` | Option A 구현 후 "shutdown 중 registerInFlight된 노드 포함(early-return 없음)" 부연 추가 선택적 검토 |
| 3 | Rationale Continuity | spec §11 본문 항목 2 "신규 job consume 중단" 구현 수단 미명시 — plan이 동일 오해를 반복할 수 있음 | `spec/5-system/4-execution-engine.md §11` | 괄호 보충: "(@nestjs/bullmq WorkerHost가 NestJS shutdown lifecycle에서 worker close 처리 — 별도 queue.pause() 불필요)" (planner 경유) |
| 4 | Convention Compliance | spec/5-system/4-execution-engine.md frontmatter code: glob이 shutdown-state.service.ts를 커버하는지 미확인 | `spec/5-system/4-execution-engine.md` frontmatter | 구현 PR에서 code: 항목이 shutdown-state 경로를 포함하는지 확인, 누락 시 추가 |
| 5 | Convention Compliance | plan 완료 이동 시 spec_impact 선언 의무(Gate C) | `plan/in-progress/refactor/06-concurrency.md` 완료 이동 시 | plan complete 이동 시 frontmatter에 spec_impact: none 명시 |
| 6 | Plan Coherence | 구현 완료 후 plan 체크박스·README 집계 동기화 필요 | `plan/in-progress/refactor/README.md`, `06-concurrency.md` M-2 체크박스 | 구현 PR 완료 후 M-2 항목 [x] 완료 처리 및 README 집계 행 갱신 |
| 7 | Naming Collision | 신규 식별자 도입 없음 — 충돌 없음 | N/A | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | plan "권장 B" 잔존(WARNING) + spec §11.2 이행 수단 미명시(INFO 2건). spec·data-model 직접 충돌 없음. |
| Rationale Continuity | LOW | plan M-2 권장안 번복이 plan·spec 미갱신 상태로 진행(WARNING). 수정 방향 자체는 §11.4와 완전 정합. |
| Convention Compliance | NONE | SERVER_INTERRUPTED 에러 코드·메서드 명명·spec-impl-evidence 가드 모두 규약 준수. INFO 2건은 구현 완료 후 후속 처리. |
| Plan Coherence | LOW | Option B 거절 신규 근거가 plan 분석에 반영되지 않음(WARNING). "결정 대기(사용자)" 잠금 항목 아니므로 Critical 아님. |
| Naming Collision | NONE | 신규 식별자·파일·endpoint·환경변수 없음. 단일 파일 내 로직 수정만. |

## 권장 조치사항

1. **(구현과 함께 또는 직후 — planner 위임)** `plan/in-progress/refactor/06-concurrency.md` M-2의 옵션 비교표를 갱신: Option B 단점란에 "WorkerHost NestJS lifecycle이 §11.2 이미 충족 / queue.pause()는 Redis 전역 플래그로 multi-instance stall" 추가, "권장" B → A로 정정.
2. **(선택 — planner 경유)** `spec/5-system/4-execution-engine.md §11` Rationale에 "@nestjs/bullmq WorkerHost가 onApplicationShutdown → worker.close()로 신규 consume 중단 이행, 별도 queue.pause() 금지" 한 줄 추가.
3. **(구현 PR 내)** `spec/5-system/4-execution-engine.md` frontmatter `code:` glob이 `shutdown-state.service.ts`를 포함하는지 확인, 누락 시 추가.
4. **(plan 완료 이동 시)** `06-concurrency.md` frontmatter에 `spec_impact: none` 선언 및 README 집계 갱신.
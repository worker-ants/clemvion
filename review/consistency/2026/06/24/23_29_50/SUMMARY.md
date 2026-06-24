# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 차단 요인 없음.

## 전체 위험도
**LOW** — spec Rationale 동기화 공백 2건(WARNING 1, INFO 3). 모두 비차단이며 planner 후속 트랙으로 해소 가능.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | plan 권장 Option B(queue.pause)를 Option A 단독 채택으로 번복하면서 기각 근거가 spec Rationale 에 미등재 | `shutdown-state.service.ts` JSDoc (Option B 기각 설명) | `plan/in-progress/refactor/06-concurrency.md` M-2 — "권장: B" 명시 | `spec/5-system/4-execution-engine.md §11 Rationale` 또는 `spec/data-flow/3-execution.md ## Rationale` 에 "WorkerHost shutdown lifecycle 이 신규 consume 중단 담당 → queue.pause() 중복 불요; queue.pause() 는 전역 Redis 플래그라 multi-instance stall 부작용" 항목 추가 (planner 트랙) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `registerInFlight` "추적 중인" 범위 기술이 M-2 이후 확장된 사실을 반영하지 않음 | `spec/data-flow/3-execution.md §3.3` 표 "대상" 셀 · line 113 | "shutdown 진입 후 같은 세그먼트 내 노드도 포함 — M-2" 주석 추가 (planner 트랙) |
| 2 | Cross-Spec / Rationale Continuity (통합) | `queue.pause` 미채택 근거가 spec §11 Rationale 에 누락 | `spec/5-system/4-execution-engine.md §11` | §11 항목 2 설명 또는 Rationale 에 "신규 job consume 중단은 `@nestjs/bullmq` WorkerHost NestJS lifecycle 이 담당 → queue.pause() 불요; queue.pause() 전역 Redis 플래그 multi-instance stall 위험(M-2 결정)" 추가 (WARNING 1 과 동일 조치로 해소 가능) |
| 3 | Rationale Continuity | §11.2 "신규 job consume 중단" 이행 수단(WorkerHost lifecycle)이 spec 본문에 미명시 | `spec/5-system/4-execution-engine.md §11` 항목 2 | "(BullMQ `@nestjs/bullmq WorkerHost` NestJS shutdown lifecycle 이 SIGTERM 시 자동 worker close)" 한 줄 병기 |
| 4 | Naming Collision | 결과 파일 부재 — 재시도 필요 | `naming_collision.md` (파일 미존재) | checker 재실행 권장 (비차단) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | data-flow §3.3 "추적 중인" 범위 미갱신(INFO), §11 Rationale queue.pause 미기록(INFO) |
| Rationale Continuity | LOW | plan 권장 Option B → A 번복 근거 spec Rationale 미등재(WARNING), §11.2 이행 수단 암묵(INFO) |
| Convention Compliance | NONE | 모든 규약 통과 — 명명·에러코드·Swagger·plan 구조 위반 없음 |
| Plan Coherence | NONE | M-2 구현이 plan 결정(B→A 정정)과 완전 정합, C-2 와 표면 충돌 없음 |
| Naming Collision | 재시도 필요 | 결과 파일 미존재 — 차단 불가, 재실행 권장 |

## 권장 조치사항

1. **(비차단, planner 후속)** `spec/5-system/4-execution-engine.md §11 Rationale` 에 M-2 결정 항목 추가: Option B(`queue.pause`) 미채택 사유("WorkerHost shutdown lifecycle 이 신규 job consume 중단 담당 → queue.pause() 중복; queue.pause() 전역 Redis 플래그 → multi-instance stall"). WARNING 1 + INFO 2 를 단일 편집으로 해소.
2. **(비차단, planner 후속)** `spec/data-flow/3-execution.md §3.3` 표 `ShutdownStateService.onApplicationShutdown` 행 "대상" 셀에 "shutdown 진입 후 같은 세그먼트 내 시작 노드도 포함 — M-2" 주석 추가. INFO 1 해소.
3. **(비차단, 권장)** Naming Collision checker 재실행으로 결과 파일 확보.
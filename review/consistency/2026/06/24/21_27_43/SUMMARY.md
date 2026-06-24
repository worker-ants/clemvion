# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 이하.

## 전체 위험도
**LOW** — 구현 변경은 spec 기존 idempotency·동일패턴 원칙과 정합. 발견사항은 spec-sync defer 예정 항목 미기록 및 plan 체크박스 미갱신에 집중.

> **main 처분**: W-2(§7.4 spec 갱신 의무 defer 미분류) → plan C-1 체크박스에 "sibling planner spec-sync 후속 TODO" 명시 분리로 해소. W-1/INFO 카탈로그·§7.5.2·§9.2 등은 sibling planner spec-sync(merge-gate 동행)로 이관 — plan 에 추적 기록. INFO #8(503 주석 §6 인용 부정확) → 코드 주석을 SERVER_SHUTTING_DOWN(§11) 503 선례 준용으로 정정.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 | main 처분 |
|---|---------|------|-------------|-----------|------|------|
| 1 | Convention Compliance | `EXECUTION_ENQUEUE_FAILED` 신규 에러 코드가 카탈로그 SoT 미등재 | `error-codes.ts` | `spec/5-system/3-error-handling.md §1.4` | sibling spec-sync 시 §1.4 행 추가 (이미 defer) | sibling 이관, plan 추적 |
| 2 | Plan Coherence | plan C-1 의 spec 갱신 의무(§7.4 1줄)가 defer 분류 없이 미이행 | diff 에 spec 없음 | `plan/.../06-concurrency.md` C-1 | plan 에 "spec 갱신 미착수 — planner 후속" 명시 분리 | **반영** — plan C-1 에 명시 TODO 분리 |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| 1 | Cross-Spec | `EXECUTION_ENQUEUE_FAILED` §7.5.2 EXECUTION_* 목록 미등록 (명시 defer) | sibling spec-sync |
| 2 | Cross-Spec | §7.5.2 "4종" 에 cancel 누락 → "5종" | sibling spec-sync |
| 3 | Cross-Spec | REST stop() queued:false → 503 경로 spec 미정의 | sibling spec-sync §7.4 |
| 4 | Cross-Spec | nextSeq random fallback 제거 근거 §9.2 Rationale 미기록 | sibling spec-sync |
| 5 | Rationale Continuity | exec:cont:seq vs exec:seq 장애 처리 비대칭 §9.2 미설명 | sibling spec-sync §9.2 비고 |
| 6 | Rationale Continuity | REST stop() 503 경로 spec 미기록 | sibling spec-sync §7.4 |
| 7 | Rationale Continuity | cancelWaitingExecution void→ContinuationPublishResult 결정 §7.4 Rationale 미기록 | sibling spec-sync |
| 8 | Convention Compliance | 503 주석이 api-convention §6 인용하나 §6 표에 503 없음 | **반영** — 주석을 SERVER_SHUTTING_DOWN(§11) 503 선례 준용으로 정정 |
| 9 | Convention Compliance | cancelWaitingExecution async 전환 §7.5.2/6-websocket §4.2 미반영 | sibling spec-sync |
| 10 | Plan Coherence | C-1/M-7 체크박스 `[ ] 미착수` 잔류 | **반영** — 완료로 갱신 |
| 11 | Naming Collision | EXECUTION_ENQUEUE_FAILED 카탈로그 미등록 (충돌 없음) | sibling spec-sync |
| 12 | Naming Collision | nextSeq 동명(ContinuationBus private vs ConversationThread DTO) — 주석 명시됨, 변경 불요 | 무조치 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 4건 INFO — spec-sync defer 예정 |
| Rationale Continuity | LOW | 3건 INFO — 기각 대안 재도입 없음 |
| Convention Compliance | LOW | 1 WARNING(defer)·2 INFO |
| Plan Coherence | LOW | 1 WARNING(§7.4 defer 분류)·1 INFO(체크박스) |
| Naming Collision | NONE | 실제 충돌 없음 |

## 권장 조치사항 (main 반영 상태)

1. **(W-2 ✅반영)** plan C-1 에 "spec §7.4/§7.5.2 + 에러코드 카탈로그 갱신 — sibling planner spec-sync 후속(merge-gate 동행)" TODO 명시 분리.
2. **(W-1/INFO ✅추적)** EXECUTION_ENQUEUE_FAILED + §7.x spec-sync defer 를 plan 에 기록.
3. **(INFO #8 ✅반영)** `executions.service.ts` 503 주석을 §11 SERVER_SHUTTING_DOWN 503 선례 준용으로 정정.
4. **(INFO #10 ✅반영)** C-1·M-7 체크박스 완료 갱신.

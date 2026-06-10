---
worktree: plan-complete-turn-timing-aa533b
started: 2026-06-10
owner: developer (draft) → project-planner (적용)
spec_impact:
  - spec/5-system/16-system-status-api.md
---

# Spec update draft — dead code 제거 동반 SPEC-DRIFT 정리 (refactor 03 m-2)

> developer 는 `spec/` read-only — project-planner 가 `/consistency-check --spec` 후 반영.
> ai-review `22_00_04` SPEC-DRIFT 1·2 (3·4 는 grep 결과 spec 잔재 0 — 갱신 불요로 확인).

## 1. `spec/5-system/16-system-status-api.md §3` — 상수명 → getter 표현 (필수)

`FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` deprecated 상수가 제거됨
(외부 참조 0, 서비스는 `getFailedDegradedThreshold()`/`getDelayedDegradedThreshold()`
getter 사용). spec §3 의 상수명 직접 참조 2곳(:90, :94)을 getter 표현으로 갱신:

- :90 `recentFailed >= FAILED_DEGRADED_THRESHOLD` → `recentFailed >= getFailedDegradedThreshold()`
  (DELAYED 도 동일)
- :94 "코드상수 ↔ env 매핑: `FAILED_DEGRADED_THRESHOLD` ← ..." → "getter ↔ env 매핑:
  `getFailedDegradedThreshold()` ← `SYSTEM_STATUS_FAILED_THRESHOLD` ..." (의미·env 키 불변)

## 2. (선택) `spec/5-system/4-execution-engine.md §7.4` 구현 상태 메모 날짜

in-memory continuation 머신 full B3 제거가 2026-06-10 에 완성 (`registerContinuationHandlers`
no-op stub + `ContinuationBusService.on()` deprecated 메서드 제거). §7.4 구현 메모 날짜를
2026-06-10 으로 갱신 (선택 — 서사는 이미 worker 단일 경로로 정합).

## 체크리스트

- [ ] project-planner: `/consistency-check --spec` → BLOCK 확인
- [ ] 1 반영 (필수), 2 반영 (선택). frontmatter `code:` 영향 없음 확인
- [ ] 반영 후 본 draft 를 `plan/complete/` 로 이동

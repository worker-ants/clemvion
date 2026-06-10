---
worktree: plan-complete-turn-timing-aa533b
started: 2026-06-10
owner: developer (draft) → project-planner (적용)
spec_impact:
  - spec/5-system/16-system-status-api.md
  - spec/4-nodes/1-logic/10-parallel.md
  - spec/conventions/execution-context.md
---

# Spec update draft — dead code 제거 + M-5 freeze 동반 SPEC-DRIFT 정리 (refactor 03 m-2 / 06 M-5)

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

## 1b. `10-parallel.md §Rationale` + `execution-context.md §1` — M-5 freeze invariant (W-3, impl-done)

06 M-5 로 dev/test 환경에서 branch-local `nodeOutputCache`/`structuredOutputCache` 값 객체를
deep freeze 하는 메커니즘(`FREEZE_BRANCH_CACHE`/`freezeSharedCacheValues`)이 추가됐다 — spec
미기술. 행위 의미는 production 불변(freeze off)이라 비차단이나 단일 진실 보강 권장:

- `spec/4-nodes/1-logic/10-parallel.md §Rationale`(:14 shallow copy 결정 인근)에 "branch-local
  `nodeOutputCache` 값 객체 내부 mutate 금지 invariant — dev/test(`NODE_ENV in {development,test}`)
  에서 deep `Object.freeze` 로 기계 강제, production 무적용" 1줄 추가.
- `spec/conventions/execution-context.md §1` 에 `structuredOutputCache` 필드 추가 (`nodeOutputCache`
  와 동일 격리 규약). **확인됨**: `grep -n structuredOutputCache spec/conventions/execution-context.md`
  → **0건** (현재 미표기 — 추가 필요).

## 2. (선택) `spec/5-system/4-execution-engine.md §7.4` 구현 상태 메모 날짜

in-memory continuation 머신 full B3 제거가 2026-06-10 에 완성 (`registerContinuationHandlers`
no-op stub + `ContinuationBusService.on()` deprecated 메서드 제거). §7.4 구현 메모 날짜를
2026-06-10 으로 갱신 (선택 — 서사는 이미 worker 단일 경로로 정합).

## 체크리스트

- [ ] project-planner: `/consistency-check --spec` → BLOCK 확인
- [ ] 1 반영 (필수), 2 반영 (선택). frontmatter `code:` 영향 없음 확인
- [ ] 반영 후 본 draft 를 `plan/complete/` 로 이동

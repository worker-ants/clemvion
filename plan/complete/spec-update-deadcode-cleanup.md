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

## 2. ~~(선택) `spec/5-system/4-execution-engine.md §7.4` 구현 상태 메모 날짜~~ — 반영 안 함

**판정 (project-planner, 2026-06-10)**: 반영 불요. §7.4 의 "full B3 완료(2026-06-06, PR-B2b)" 날짜는
정확하다 — in-memory continuation 머신(`pendingContinuations`/`firstSegmentBarriers`/`runAiConversationLoop`
등)의 **실제 제거**가 그때 완성됐다. 2026-06-10 의 dead code 제거는 그 후 잔존한 **이미 no-op 이던
stub**(`registerContinuationHandlers` 빈 본체 + `ContinuationBusService.on()` deprecated 메서드)을 치운
것으로 **동작 무변경**이라 §7.4 서사(worker 단일 경로)에 영향이 없다. 날짜를 2026-06-10 으로 바꾸면
오히려 full B3 완성 시점을 오기재하게 된다.

## 체크리스트

- [x] project-planner: `/consistency-check --spec` (세션 `22_43_16`) → **BLOCK: NO**
- [x] 1·1b 반영 (system-status §3 getter + R-5 인근 메모, 10-parallel :14 + §Rationale freeze invariant,
      execution-context §1 structuredOutputCache). §2 는 위 판정대로 반영 안 함. frontmatter `code:` 영향 없음 확인
- [x] 반영 후 본 draft 를 `plan/complete/` 로 이동

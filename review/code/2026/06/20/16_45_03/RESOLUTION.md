# RESOLUTION — review/code/2026/06/20/16_45_03

parallel-p2 추가 커버리지 2건 + #652 prettier 정합. RISK=LOW, CRITICAL=0, WARNING=1. 코드 추가 변경 없음(전부 disposition/follow-up).

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| WARNING #1 (Scope) | `node-components.module.spec.ts` prettier 포맷팅이 테스트 PR 에 혼입 | **disposition — 유지**. 이미 별도 `style(test):` commit 으로 분리됨. 또한 #652(NODE_COMPONENT DI)가 남긴 `prettier/prettier` 에러가 main lint 게이트를 red 로 막고 있어, 본 변경의 lint 게이트 통과에 **필수**(제외 시 lint 실패). 즉 diff 노이즈가 아니라 main 회귀 해소. |

## TEST 결과
- lint: 통과 (PASS — 0 errors; #652 prettier 해소 후)
- unit: 통과 (PASS — backend 7140 + 전 패키지)
- build: 통과 (PASS — docker 이미지 포함)
- e2e: 통과 (PASS — 205 tests)

## 보류·후속 항목
- **SPEC-DRIFT (INFO) — `spec/4-nodes/1-logic/10-parallel.md §221` clamp 공식**: `effectiveConcurrency = max(1, floor(32/parentEffective))` 의 `max(1,…)` 하한(0-clamp deadlock 방지)이 spec 에 미명세. 코드 옳음 → project-planner 가 §221 공식 갱신(spec read-only). 별도 위임.
- **INFO (선택, 미적용)**: `immediateAbortObserved` → `toHaveBeenCalledTimes(2)`(현 `toHaveBeenCalled()` 도 정확 — 양 분기 모두 즉시경로 발화); `observedPeak===1` 은 p-limit(1) 직렬화로 결정적(타이머 무관)이라 유지; signal.aborted 통합테스트가 `parallel-executor.spec.ts:413-433` 와 일부 중복이나 통합 관점(상위 cascade) 보완 가치 — 유지. 전부 review 가 "필수 아님"으로 분류.

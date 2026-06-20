# 요구사항(Requirement) 리뷰

## 발견사항

### 파일 1: `parallel-p2-integration.spec.ts`

- **[INFO]** 기능 완전성 — pre-abort 신호 즉시 경로 커버 (기존 listener 경로만 커버)
  - 위치: 추가된 테스트 `상위 abortSignal 이 이미 abort 된 채 진입 → 분기가 즉시 signal.aborted 경로로 reject` (diff +41~+85)
  - 상세: 기존 테스트(`첫 분기 실패 시 다른 분기에 전달된 signal 이 abort 되어 fetch 가 즉시 중단`)는 `addEventListener` 경로만 커버했다. 새 테스트는 `context.abortSignal` 이 이미 `aborted` 상태로 전달될 때 executor 가 `cancelController.abort()`를 cascade 한 뒤 모든 분기 핸들러가 `signal.aborted` 즉시 경로(early-exit)로 진입함을 검증한다. `parallel-executor.ts:190`의 `if (upstreamSignal.aborted) { cancelController.abort(); }` 분기를 직접 타격하는 유일한 테스트다.
  - 제안: 현재 구현으로 충분. 단 `immediateAbortObserved`가 branchCount=2에 맞춰 `toHaveBeenCalledTimes(2)`로 강화하면 분기 수 단언이 더 명확해진다. 필수는 아님.

- **[INFO]** [SPEC-DRIFT] clamp 하한 `Math.max(1, ...)` 미명세
  - 위치: 추가된 테스트 `외부 effective=32 → 내부 1 로 clamp (하한 1, deadlock 방지)` (diff +93~+120)
  - 상세: 테스트는 `parentEffective=32`일 때 `allowed = Math.max(1, floor(32/32)) = 1`로 deadlock를 막는 하한 보장을 검증한다. 그러나 `/spec/4-nodes/1-logic/10-parallel.md` §221의 공식은 `floor(32 / parentEffective)` 만 명시하며, `Math.max(1, ...)` 래퍼(하한 보장)는 spec 본문에 없다. 구현(`parallel-executor.ts:161`)의 `Math.max(1, ...)` 는 합리적이고 의도적인 deadlock 방지 장치이며, 이를 제거하면 `parentEffective=32`일 때 `allowed=1→0`으로 deadlock이 발생한다. 따라서 코드가 옳고 spec 공식이 낡은 상태다.
  - 제안: 코드 유지 + spec 반영. `/spec/4-nodes/1-logic/10-parallel.md` §221의 공식을 `effectiveConcurrency = max(1, floor(32 / parentEffective))` 로 갱신하고, `max(1, ...)` 의 목적(0-clamp로의 deadlock 방지)을 한 줄 설명 추가.

- **[INFO]** 엣지 케이스 — `branchCount=2`/`errorPolicy='cancel-others-on-fail'`로 pre-abort 진입 시 executor 내부 실패 집계
  - 위치: pre-abort 테스트 `.catch(() => undefined)` 종결 (라인 +81)
  - 상세: 모든 분기가 즉시 AbortError로 reject되면 `failures.length > 0`이고 `errorPolicy === 'cancel-others-on-fail'`이므로 executor가 root cause를 throw한다. 테스트는 `.catch(() => undefined)`로 이 throw를 묵과하고 spy 단언만 한다. 실제 throw 내용을 단언하지 않아도 의도(즉시-abort 경로 발화 여부)를 충분히 검증한다 — 허용 범위의 생략.

- **[INFO]** TODO/FIXME 없음 — 추가된 코드 내 미완성 마커 없음.

---

### 파일 2: `node-components.module.spec.ts`

- **[INFO]** 변경 내용은 순수 포맷팅(줄 길이 규칙에 따른 Prettier 적용) — `new Set(ALL_NODE_COMPONENTS.map(...))` 를 3행으로 분리.
  - 위치: diff +380~+382
  - 상세: 기능·로직·엣지 케이스·반환값·비즈니스 규칙 전혀 변경 없음. 요구사항 충족 관점에서 검토 대상 없음.

---

## 요약

변경된 코드는 두 테스트를 추가해 기존 커버리지 갭을 정확히 타격한다. (1) pre-abort signal cascade 테스트는 `parallel-executor.ts:190`의 `upstreamSignal.aborted` 즉시 분기를 검증하며, 이 분기를 커버하는 기존 테스트가 없었으므로 기능 완전성을 실질적으로 향상한다. (2) clamp 하한(Math.max(1,...)) 테스트는 deadlock 방지 동작을 경계값으로 단언한다. 두 테스트 모두 `ParallelExecutor.execute()` 시그니처와 `cancelController` cascade 동작을 정확히 반영하며, 잘못된 기대값이나 누락된 단언은 없다. 다만 clamp 공식의 `Math.max(1, ...)` 하한이 `/spec/4-nodes/1-logic/10-parallel.md` §221에 명시되지 않아 spec 갱신이 필요하다(코드 수정 대상 아님). `node-components.module.spec.ts` 변경은 포맷팅뿐이다.

## 위험도

NONE

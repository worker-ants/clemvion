# Rationale 연속성 검토 결과

- **검토 대상**: `plan/in-progress/spec-update-deadcode-cleanup.md`
- **검토 모드**: spec draft (--spec)
- **검토 일시**: 2026-06-10

---

## 발견사항

### [INFO] §1 — 상수명 → getter 표현 갱신은 Rationale 내용과 정합

- **target 위치**: §1 (`spec/5-system/16-system-status-api.md §3` :90, :94)
- **과거 결정 출처**: `spec/5-system/16-system-status-api.md §Rationale R-5` — 실패 지표를 "최근 윈도우 + 누적(보관 중)"으로 분화하는 결정이 기록되어 있으며, §3 의 health 파생 규칙(:90, :94)은 그 결정의 반영.
- **상세**: target 은 `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 상수명을 `getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()` getter 표현으로 교체하는 surface 갱신을 제안한다. 환경변수(`SYSTEM_STATUS_FAILED_THRESHOLD`, `SYSTEM_STATUS_DELAYED_THRESHOLD`)와 기본값·의미는 불변이므로 R-5 의 "최근 윈도우 + 누적 분화" 결정을 번복하지 않는다. env 키·기본값 매핑도 그대로 유지.
- **제안**: 변경 없이 진행해도 Rationale 정합. 다만 §3 변경 시 R-5 참조 인근에 "상수 → getter 리팩터링(2026-06-10 dead code 제거)" 1줄 메모를 추가하면 미래 독자가 상수명이 사라진 이유를 추적하기 쉽다.

---

### [INFO] §1b — `nodeOutputCache` shallow copy 결정 Rationale 에 freeze invariant 추가

- **target 위치**: §1b (`spec/4-nodes/1-logic/10-parallel.md §Rationale` + `spec/conventions/execution-context.md §1`)
- **과거 결정 출처**: `spec/4-nodes/1-logic/10-parallel.md §4` (:14) — "분기 간 `variables` 는 `structuredClone` 으로 deep clone, `nodeOutputCache` 는 shallow copy 로 격리"가 본문에 명시. `§Rationale` 에는 shallow copy 결정에 대한 별도 문서화 항목 없음.
- **상세**: target 이 제안하는 추가 내용은 "branch-local `nodeOutputCache` 값 객체 내부 mutate 금지 invariant — dev/test 에서 deep freeze 로 기계 강제, production 무적용"이다. 이 freeze 메커니즘은 shallow copy 결정을 번복하거나 기각된 대안을 재도입하는 것이 아니라, shallow copy 정책의 내부 mutate 금지 invariant 를 명시·기계 강제하는 보강이다. Rationale 에 기록된 어떤 기각 결정과도 충돌하지 않는다. `structuredOutputCache` 의 `execution-context.md §1` 미표기는 단순 누락이므로 추가 정당.
- **제안**: 변경 없이 진행 가능. `10-parallel.md §Rationale` 에 추가할 때 "freeze 는 shallow copy 보조 강제 메커니즘으로 shallow copy 결정을 대체하지 않는다"는 맥락 1줄을 포함하면 future reader 의 혼동을 방지할 수 있다.

---

### [INFO] §2 — `execution-engine.md §7.4` 날짜 갱신 (선택) — Rationale 영향 없음

- **target 위치**: §2 (`spec/5-system/4-execution-engine.md §7.4` 구현 상태 메모 날짜)
- **과거 결정 출처**: 해당 없음 (날짜 메모는 Rationale 결정과 무관한 사실 기술).
- **상세**: 날짜 갱신은 서사·설계 원칙에 영향을 주지 않으며, 기각된 대안이 없다.
- **제안**: 해당 없음.

---

## 요약

target 문서 `spec-update-deadcode-cleanup.md` 의 세 변경 제안은 모두 기존 spec Rationale 에서 기각·폐기된 결정을 재도입하거나 합의된 설계 원칙을 위반하지 않는다. §1 의 상수명 → getter 표현 갱신은 R-5 의 "최근 윈도우 + 누적 분화" 결정의 의미·환경변수 매핑을 그대로 유지한 surface 리팩터링이다. §1b 의 freeze invariant 추가는 Parallel 노드의 shallow copy 결정을 보강하는 메커니즘이지 이를 번복하지 않는다. `structuredOutputCache` 의 `execution-context.md` 미표기 추가도 기존 격리 규약의 단순 누락 보완이다. Rationale 관점에서 차단 요인은 없으나, 두 개의 INFO 급 제안(§1 상수 제거 배경 메모 / §1b freeze-is-supplement 맥락 명시)으로 문서 완결성을 높일 수 있다.

## 위험도

LOW

# 신규 식별자 충돌 검토 — M-4 park-진입 dispatch 추출

검토 모드: --impl-prep (구현 착수 전)
대상: M-4 park-진입 dispatch 추출 (execution-engine.service.ts 3개 park-entry 사이트 일원화)

---

## 발견사항

### 1. 충돌 없음 — ParkEntryDispatch / buildParkEntryRegistry / ParkEntryContext / ParkEntrySelector / ParkEntryDispatchDeps

M-4 가 도입하는 타입·함수명은 코드베이스 내에서 이미 구현 완료된 상태이며 (`codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts`), spec/conventions/plan 영역 어디에도 동일 이름을 다른 의미로 사용한 사례가 없다.

- `ParkEntryDispatch` — resume 측의 `ResumeTurnDispatch` (`resume-turn-dispatch.ts`) 와 완전 대칭이며 명명 충돌 없음.
- `buildParkEntryRegistry` — factory 함수 이름이 `resumeTurnRegistry` 에 대응하는 `parkEntryRegistry` 패턴과 일치, 기존 코드베이스에서 해당 이름이 다른 의미로 사용된 곳 없음.
- `ParkEntryContext` / `ParkEntrySelector` / `ParkEntryDispatchDeps` — spec/plan 파일 전체에서 발견되지 않음 (신규).

### 2. 충돌 없음 — ParkReleaseSignal / isParkReleaseSignal

`ParkReleaseSignal` 은 `codebase/backend/src/shared/execution-resume/park-release-signal.ts` 에 이미 구현돼 있으며, spec 파일(`4-nodes/1-logic/12-background.md`, `4-nodes/2-flow/0-common.md`, `4-nodes/2-flow/1-workflow.md`, `data-flow/3-execution.md`, `5-system/4-execution-engine.md`) 에서 동일 의미로 참조된다. 다른 의미로 쓰인 사례 없음.

### 3. 충돌 없음 — 파일 경로 `park-entry-dispatch.ts`

`codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` 는 기존 `resume-turn-dispatch.ts` 와 동일 디렉토리에 위치하여 명명 컨벤션을 준수한다. 기존 파일과 경로 충돌 없음.

### 4. 충돌 없음 — dispatchParkEntry / parkEntryRegistry (private 멤버)

`execution-engine.service.ts` 내 private 멤버 `dispatchParkEntry` / `parkEntryRegistry` 는 기존 public API·spec 에 정의된 이름과 충돌하지 않는다.

### 5. INFO — spec §1.2 "park-entry emit 위치" 미갱신 (사전 인지된 사항)

- target 신규 식별자: `ParkEntryDispatch` registry, `dispatchParkEntry` 진입점
- 기존 사용처: `spec/conventions/interaction-type-registry.md §1.2` — "Backend emit 위치" 열이 park-entry dispatch 레이어를 기술하지 않음. 재개(resume) 측(`dispatchResumeTurn`, `resumeTurnRegistry`)은 §1.2 하단 주석에 기재되어 있으나, park-entry 측은 미기재.
- 상세: plan `02-architecture.md §M-4` 와 `plan/complete/exec-park-resume-dispatch-registry.md` 가 이미 "spec 갱신 필요 — `interaction-type-registry.md §1.2` emit 위치 열 + `spec-sync-resume-dispatch-registry.md` park-entry 레이어 추가 (planner)" 를 명시하고 있다. 구현은 이미 완료됐고 spec 갱신은 후속 planner PR 로 위임된 상태 — M-4 plan 본문에서 "spec 노트(interaction-type-registry.md §1.2 park-entry)는 후속 planner spec-sync PR" 이라 명시. 충돌이 아닌 예약된 누락.
- 제안: 식별자 충돌은 아님. 구현 착수 전 관점에서 별도 충돌을 생성하지 않으며, spec-sync PR 위임이 이미 계획됨.

---

## 요약

M-4 가 도입하는 모든 신규 식별자(`ParkEntryDispatch`, `buildParkEntryRegistry`, `ParkEntryContext`, `ParkEntrySelector`, `ParkEntryDispatchDeps`, `dispatchParkEntry`, `parkEntryRegistry`)는 기존 코드베이스·spec·plan 에서 다른 의미로 사용된 사례가 없다. `ParkReleaseSignal` 은 이미 spec/코드 양쪽에 동일 의미로 정착해 있어 충돌이 없다. `spec/conventions/interaction-type-registry.md §1.2` 의 park-entry emit 위치 미기재는 사전 인지된 후속 spec-sync PR 위임 사항으로, 식별자 충돌이 아니다. 전체적으로 충돌 발견 없음.

---

## 위험도

NONE

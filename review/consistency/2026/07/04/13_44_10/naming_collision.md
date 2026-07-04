# 신규 식별자 충돌 검토 — spec-draft-dataflow-exec-seq-3way

## 검토 대상
- target: `plan/in-progress/spec-draft-dataflow-exec-seq-3way.md`
- spec_impact: `spec/data-flow/3-execution.md` §1.1 mermaid 시퀀스 다이어그램의 `alt` 분기 3-way 화

## 발견사항

없음.

target 이 도입하는 변경은 §1.1 mermaid `alt` 블록에 `status == 'running'` 분기(BullMQ stalled 재배달, §7.1)를 추가하고 기존 2-way(`pending` / `status !== pending`) 분류를 3-way 로 재정렬하는 것뿐이다. 이 변경이 사용하는 식별자를 코퍼스 전체에서 대조한 결과:

- **`recordRunningSegmentStart`** — 이미 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7241`(정의) 및 `:967`, `:2713`, `:3157`(호출부)에 구현돼 있고, `spec/5-system/4-execution-engine.md:816`·`:929`, `spec/data-flow/3-execution.md:293` 에 이미 동일 의미로 spec 서술돼 있다. target 은 이 기존 이름을 §1.1 다이어그램에도 동일 의미로 재인용할 뿐이다.
- **`redriveStuckExecution`** — 마찬가지로 `execution-engine.service.ts:2826`(정의) 및 `:2670`, `:3158`(호출부)에 구현돼 있고, 동일 spec 두 곳에 이미 §7.5 case B 재구동으로 서술돼 있다. 의미·시그니처 변경 없이 재인용.
- **"PR4"** 라벨 — 정식 요구사항 ID 가 아니라 `spec/5-system/4-execution-engine.md:379/410/814~816` 에서 이미 통일적으로 쓰이는 구현 단계 참조 라벨. target 은 동일 라벨을 §1.1 다이어그램 주석에 재사용(신규 부여 아님).
- 새 엔티티/DTO/인터페이스명, 새 API endpoint, 새 webhook/queue/SSE 이벤트명, 새 ENV var/config key 는 target 어디에도 등장하지 않는다.
- 파일 경로: target 이 수정하는 대상은 기존 파일 `spec/data-flow/3-execution.md` 이며 신규 파일을 생성하지 않는다. plan 파일명 `plan/in-progress/spec-draft-dataflow-exec-seq-3way.md` 는 동일 디렉터리의 `spec-draft-c2-atomic-claim.md`, `spec-draft-c3-context-drift.md`, `spec-draft-crash-running-redrive.md` 와 동일한 `spec-draft-<slug>.md` 명명 컨벤션을 따른다.

즉 target 은 사용자 설명대로 **신규 식별자를 전혀 도입하지 않고**, 이미 구현·spec 반영된 식별자를 다이어그램 층위에만 뒤늦게 정합화하는 순수 drift 정정이다.

## 요약
target 문서(`spec-draft-dataflow-exec-seq-3way.md`)는 §1.1 mermaid 다이어그램의 `alt` 분기를 2-way 에서 3-way 로 갱신하는 순수 문서 정정이며, 사용하는 식별자(`recordRunningSegmentStart`, `redriveStuckExecution`, "PR4" 라벨)는 모두 `execution-engine.service.ts` 구현 및 `spec/5-system/4-execution-engine.md`·`spec/data-flow/3-execution.md` 기존 spec 서술과 이름·의미가 완전히 일치한다. 신규 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수/설정키, 파일 경로 어느 범주에서도 충돌 후보가 발견되지 않았다.

## 위험도
NONE

---

BLOCK: NO

- 신규 식별자 충돌 발견사항 없음(CRITICAL/WARNING 0건).

STATUS: SUCCESS

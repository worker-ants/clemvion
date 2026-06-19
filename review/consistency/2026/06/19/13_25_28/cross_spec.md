# Cross-Spec 일관성 검토 결과

**Target**: `spec/4-nodes/2-flow/1-workflow.md`
**검토 모드**: `--impl-prep` (구현 착수 전)
**검토 일시**: 2026-06-19

---

## 발견사항

### [WARNING] 에러 코드 카탈로그 불완전 — `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` 미등재

- **target 위치**: `spec/4-nodes/2-flow/1-workflow.md` §6 에러 코드 표
- **충돌 대상**: `spec/5-system/3-error-handling.md` §3.2 "대표 에러 코드" 표 (Sub-workflow 행)
- **상세**: target 이 노드 수준 `output.error.code` 로 `SUB_WORKFLOW_NOT_FOUND`, `SUB_WORKFLOW_TIMEOUT`, `SUB_WORKFLOW_QUEUE_FAILED` 를 정의하지만, `spec/5-system/3-error-handling.md` §3.2 의 Sub-workflow 행에는 `SUB_WORKFLOW_FAILED` 하나만 등재되어 있다. 에러 코드 카탈로그가 4개 중 3개를 누락한 상태라 구현자가 카탈로그만 보고 코딩할 때 코드 세분화를 누락할 위험이 있다.
- **제안**: `spec/5-system/3-error-handling.md` §3.2 Sub-workflow 행을 `SUB_WORKFLOW_NOT_FOUND` · `SUB_WORKFLOW_TIMEOUT` · `SUB_WORKFLOW_QUEUE_FAILED` · `SUB_WORKFLOW_FAILED` 4개로 확장. 또는 target §6 에 "(정식 카탈로그 SoT: `3-error-handling.md` §3.2 확장 필요)" 명시.

---

### [WARNING] `WORKFLOW_FORBIDDEN_WORKSPACE` 에러 코드 — 전사 카탈로그 미등재

- **target 위치**: `spec/4-nodes/2-flow/1-workflow.md` §2 설정 UI (W-6 주석)
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.4 워크플로우 실행 에러 표 / §3.2 Sub-workflow 에러 표
- **상세**: target §2 는 `assertSameWorkspace` 위반 시 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 throw 한다고 명시하나, 이 코드는 `spec/5-system/3-error-handling.md` 어디에도 등재되어 있지 않다. `spec/conventions/error-codes.md` 에도 정의가 없다. 이 코드가 노드 수준 `output.error.code` 로 `error` 포트를 통해 라우팅되는지, Pre-flight throw 로 처리되는지도 target §5 / §6 에 명시가 없어 에러 처리 경로가 불명확하다.
- **제안**: (a) `WORKFLOW_FORBIDDEN_WORKSPACE` 를 `spec/5-system/3-error-handling.md` §1.4 또는 §3.2 에 등재, (b) target §5.8 Pre-flight throw 표에 이 조건을 추가하거나 §5.3 런타임 에러(port `error`)로 명시. 현재 구현 동작과 일치하도록 target 에 섹션 보완.

---

### [WARNING] `RECURSION_DEPTH_EXCEEDED` vs `Maximum recursion depth exceeded` — 에러 코드 표면 불일치

- **target 위치**: `spec/4-nodes/2-flow/1-workflow.md` §4, §5.8, §6
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.4 워크플로우 실행 에러 표
- **상세**: `spec/5-system/3-error-handling.md` §1.4 는 `RECURSION_DEPTH_EXCEEDED` 를 "엔진 수준 에러 (execution status → `failed`)" 로 등재한다. target §5.8 은 동일 조건을 "Pre-flight throw" 로 분류하면서 메시지 문자열 `Maximum recursion depth exceeded (limit: 10)` 을 사용하되 `output.error.code` 값으로는 `RECURSION_DEPTH_EXCEEDED` 를 명시하지 않는다. 두 문서가 동일 이벤트를 서로 다른 레이어(엔진 레벨 실행 실패 vs 핸들러 Pre-flight throw)로 기술하는 것이 의도된 설계인지 불명확하다. Pre-flight throw 는 `output` / `port` 를 생성하지 않으므로 엔진이 NodeExecution 을 `failed` 로 마킹하고 Stop Workflow 를 따른다 — 이 경로에서 `RECURSION_DEPTH_EXCEEDED` 가 Execution 레벨 에러 코드로 기록되는지, 단순 unhandled throw 로 처리되는지가 두 문서 간에 정렬되지 않는다.
- **제안**: target §6 에 `RECURSION_DEPTH_EXCEEDED` 를 Pre-flight throw 코드로 명시하거나, `spec/5-system/3-error-handling.md` §1.4 에 "핸들러 Pre-flight throw 가 엔진 레벨 `failed` 로 격상" 이라는 설명을 추가해 두 레이어의 관계를 명확히 정렬.

---

### [INFO] `meta` 필드 — Async 모드에서 반환 없음 (node-output CONVENTIONS Principle 2 와 명시적 정렬 필요)

- **target 위치**: `spec/4-nodes/2-flow/1-workflow.md` §5.2 Async 정상 케이스 (JSON 예시에 `meta` 없음)
- **충돌 대상**: `spec/conventions/node-output.md` Principle 2 (`meta.durationMs` 공통 필수)
- **상세**: `spec/4-nodes/2-flow/0-common.md` §2 에 "Async 모드는 `meta` 를 반환하지 않음 (Planned)" 이 이미 명시되어 있어 0-common 과 1-workflow 간 내부 일관성은 유지되고 있다. 다만 CONVENTIONS Principle 2 가 `meta.durationMs: number` 를 "공통 필수"로 선언하는 반면, Async 모드에서 실질 실행 시간이 없다는 이유로 이를 생략하는 것이 explicit exception 으로 문서화되어 있지 않다.
- **제안**: target §5.2 또는 §5 서두에 "Async 모드는 즉시 반환하여 측정 대상 duration 이 없으므로 `meta` 를 생략한다 (CONVENTIONS Principle 2 explicit exception)" 주석 추가. CONVENTIONS Principle 2 에도 이 예외를 등재.

---

### [INFO] `manual_trigger` 전용 진입점 제한 — 실행 엔진 spec 참조 섹션 불명확

- **target 위치**: `spec/4-nodes/2-flow/1-workflow.md` §4 실행 로직 끝 주석 (`[실행 엔진 §6.1.1]` 참조)
- **충돌 대상**: `spec/5-system/4-execution-engine.md` §6.1
- **상세**: target §4 는 "sync 모드의 서브 워크플로우 진입점 trigger 는 `manual_trigger` 만 허용된다 — 자세한 내용은 [실행 엔진 §6.1.1]" 로 참조를 링크하지만, `spec/5-system/4-execution-engine.md` §6.1 에는 이 제한에 대한 명시적 서술이 없다. target 이 존재하지 않는 하위 섹션(`§6.1.1`)을 참조하고 있어 데드 앵커다.
- **제안**: `spec/5-system/4-execution-engine.md` §6.1 에 `executeInline` 진입 시 `manual_trigger` 외 trigger 타입을 throw 하는 규칙 추가, 또는 target 의 참조 링크를 실제 존재하는 섹션으로 수정.

---

### [INFO] `output.workflowId` async 출력 필드 — CONVENTIONS Principle 1.1 직교성과 명시적 정렬 필요

- **target 위치**: `spec/4-nodes/2-flow/1-workflow.md` §5.2, §5.2 표의 `output.workflowId` 행
- **충돌 대상**: `spec/conventions/node-output.md` Principle 1.1 (`config` 와 `output` 직교 — `config` 값의 `output` 중복 금지)
- **상세**: Async 케이스 `output.workflowId` 는 `config.workflowId` 와 항상 동일한 값을 echo 한다. 이는 Principle 1.1 이 금지하는 config 리터럴 값의 output 중복에 해당한다. target §5.2 표에서 "사용자 편의를 위한 echo" 로 이미 의도를 밝히고 있으나, Principle 1.1 의 공식 예외로 문서화하지 않았다.
- **제안**: target §5.2 에 "Principle 1.1 의도적 예외 — async envelope 에서 `output.workflowId` 는 sub-execution 추적 시 `config` 접근 없이 envelope 만으로 완결되도록 echo" 명시. 또는 CONVENTIONS Principle 1.1 에 이 패턴을 공식 예외로 등재.

---

## 요약

`spec/4-nodes/2-flow/1-workflow.md` 는 내부 일관성(`0-common.md`, `conventions/node-output.md` 5필드 규약, `5-system/4-execution-engine.md` rehydration 계약) 대부분을 올바르게 따르고 있다. Cross-spec 관점의 주요 위험은 에러 코드 카탈로그 동기화 미흡에 집중된다: `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` 3개가 `spec/5-system/3-error-handling.md` §3.2 에 미등재이고, 새로 도입된 `WORKFLOW_FORBIDDEN_WORKSPACE` 도 전사 카탈로그에 없다. 이들은 구현 시 열거형 정의 누락 위험을 낳는다. 나머지 발견사항(Principle 1.1 echo 예외, 데드 섹션 참조, meta 생략 예외)은 정보성이며 구현을 차단하지는 않는다.

---

## 위험도

MEDIUM

# 부작용(Side Effect) 리뷰

**대상**: C-1 dev 잔꼬리(작업 1b) — WorkflowForbiddenWorkspaceError 타입화, LlmCallRecord 공유 타입 전환, TurnRagDelta rename
**리뷰 일시**: 2026-06-19

---

## 발견사항

### [INFO] ErrorCode enum 신규 항목 노출 — Object.entries/Object.keys 동적 순회 코드 영향
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` (WORKFLOW_FORBIDDEN_WORKSPACE 추가)
- 상세: `ErrorCode` 객체에 새 키 `WORKFLOW_FORBIDDEN_WORKSPACE`가 추가됐다. `Object.keys(ErrorCode)` 또는 `Object.entries(ErrorCode)`를 순회하는 런타임 코드(예: error-codes.spec.ts의 UPPER_SNAKE_CASE 네이밍 검증 루프)가 이 신규 항목을 자동으로 처리하게 된다. plan RESOLUTION.md(I-13)에서 이미 unit 통과로 확인했으므로 추가 회귀 위험은 없다. 단, 클라이언트 코드 또는 외부 시스템에서 ErrorCode 키 목록을 전송하거나 캐시하고 있다면 신규 항목이 예상치 않게 노출될 수 있다.
- 제안: 영향 없음으로 확인됨(기존 단위 테스트 7134 통과). 클라이언트로 ErrorCode 키 목록을 직렬화해 전송하는 경로가 있는지 추가 확인 권장(비차단).

### [INFO] 에러 surface 변경 — mapSubWorkflowError 반환값 변경이 호출자 상태에 미치는 영향
- 위치: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L256–289 (`mapSubWorkflowError`)
- 상세: cross-workspace 호출 시 반환값이 `SUB_WORKFLOW_FAILED`에서 `WORKFLOW_FORBIDDEN_WORKSPACE`로 변경된다. `mapSubWorkflowError`의 반환값은 실행 결과 페이로드의 에러 코드 필드에 기록되며, 이 값을 분기 조건으로 사용하는 클라이언트(프론트엔드, webhook 핸들러, API 소비자) 측 상태 전이 로직에 영향을 줄 수 있다. 보안 강화 목적의 의도된 변경이나, 기존 `SUB_WORKFLOW_FAILED`를 기다리는 클라이언트 측 if/switch 분기가 침묵 실패(silent fallthrough)할 위험이 있다.
- 제안: 클라이언트 코드에서 `SUB_WORKFLOW_FAILED`를 체크하는 분기를 검색해 `WORKFLOW_FORBIDDEN_WORKSPACE` 처리 추가 여부 확인. 의도된 breaking change이므로 차단 아님.

### [INFO] WorkflowForbiddenWorkspaceError 도입 — 기존 catch 블록 포착 범위 변경 없음 확인
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (신규 클래스), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (assertSameWorkspace 변경)
- 상세: `assertSameWorkspace`가 이전에 plain `Error`를 던졌을 때는 `catch (e) { if (e instanceof Error) ... }` 계열의 모든 catch 블록에서 동일하게 처리됐다. `WorkflowForbiddenWorkspaceError`는 `Error`를 직접 상속하므로 `instanceof Error` 체크는 여전히 통과한다. 기존 catch 블록의 포착 범위는 변경되지 않는다. `mapSubWorkflowError`에서 typed 분기가 완전히 처리되므로 실제 위험은 없다.
- 제안: 영향 없음으로 판단. `Error` 상속 체계 유지로 기존 catch 포착 범위 무변.

### [INFO] LlmCallRecord[] 타입 loosen — 런타임 부작용 없음, 정적 보장 약화만 존재
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1488, L2413
- 상세: `llmCalls` 로컬 변수 타입이 인라인 `Array<{ requestPayload: unknown; responsePayload: unknown; durationMs: number; startedAt?: string; finishedAt?: string }>` 에서 `LlmCallRecord[]`(all-optional superset)로 변경됐다. 이 변수는 함수 스코프 로컬 변수로 외부 공유 상태를 변경하지 않는다. push site가 항상 전 필드를 공급하므로 직렬화된 trace 데이터 구조는 런타임에서 변경되지 않는다. 단, 정적 타입 계약이 느슨해져 컴파일러가 누락 필드를 잡아내지 못하는 부작용이 있다.
- 제안: 런타임 부작용 없음. 정적 보장 약화는 의도된 trade-off(trace/debug 구조 수용).

### [INFO] TurnRagDelta rename — exported 타입명 변경으로 외부 import 영향 가능성
- 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` (TurnDebugEntry → TurnRagDelta)
- 상세: `TurnDebugEntry`는 `export interface`로 공개 타입이었다. rename 후에는 `TurnRagDelta`로만 export된다. plan 설명("외부 type import 0")에 따르면 이 타입을 직접 import하는 외부 파일이 없으므로 런타임 부작용이 없다. 그러나 향후 이 타입을 문자열 기반으로 참조하거나 자동 생성 타입 파일을 사용하는 코드가 있다면 이름 변경이 영향을 줄 수 있다.
- 제안: 외부 import 0 확인으로 런타임 부작용 없음. 자동 생성 코드(openapi codegen 등)가 이 타입명에 의존하는지 추가 확인 권장(비차단).

### [INFO] 새 파일 생성(plan/review 문서) — 의도된 파일시스템 변경
- 위치: `plan/complete/c1-pr2-aiturn-blueprint.md`, `plan/in-progress/c1-dev-followups-1b.md`, `review/code/2026/06/19/22_49_28/` 디렉터리 내 다수 파일
- 상세: 다수의 계획 및 리뷰 문서가 파일시스템에 추가됐다. 이는 프로젝트 규약에 따른 의도된 파일 생성이며, 의도치 않은 부작용은 없다. 리뷰 아티팩트(SUMMARY, RESOLUTION, agent별 결과 파일)와 plan 파일은 git으로 추적되고 review/ 경로가 gitignore 대상이 아님을 MEMORY가 확인한다.
- 제안: 의도된 파일 생성. 부작용 없음.

---

## 요약

이번 변경셋(C-1 dev 1b)은 부작용 관점에서 전반적으로 안전하다. `WorkflowForbiddenWorkspaceError` 도입은 `Error` 직접 상속을 유지해 기존 catch 블록 포착 범위를 변경하지 않으며, `assertSameWorkspace` 내부의 throw 교체는 동일 의미의 에러를 typed class로 정확히 대체한다. `mapSubWorkflowError` 반환값 변경(`SUB_WORKFLOW_FAILED` → `WORKFLOW_FORBIDDEN_WORKSPACE`)은 실행 결과 페이로드 에러 코드를 바꾸는 의도된 breaking change이지만 전역 상태나 공유 상태를 변경하지 않으며, 클라이언트 측 침묵 실패 위험은 INFO 수준으로 확인 권장에 그친다. `LlmCallRecord[]` 전환은 로컬 변수 타입만 변경하고 런타임 데이터 구조는 불변이다. `TurnRagDelta` rename은 내부 파일 4곳으로 범위가 국한되며 외부 import가 없어 런타임 영향이 없다. 전역 변수 수정, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경, 예상치 못한 파일시스템 조작은 발생하지 않았다.

---

## 위험도

LOW

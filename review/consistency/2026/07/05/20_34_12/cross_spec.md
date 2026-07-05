# Cross-Spec 일관성 검토 — trigger-param 타입 통합 (impl-done)

## 대상
- `codebase/frontend/src/lib/api/triggers.ts` — `TriggerParameterType` union + `TriggerParameterDefinition` interface 신설
- `codebase/frontend/src/components/executions/rerun-modal.tsx` — 로컬 `ParamType`/`TriggerParameterDefinition` 제거 → import
- `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx` — 로컬 export `TriggerParameter` 제거 → `TriggerParameterDefinition` import·rename
- 참조 spec: `spec/4-nodes/7-trigger/0-common.md §1`
- 참조 backend: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`

## 발견사항

검토 관점 1~6 전부에 대해 위반 없음. 상세 확인 내역:

- **데이터 모델 정합**: 세 위치의 shape 비교 결과 완전 일치.
  - spec §1: `{ name: string; type: 'string'|'number'|'boolean'|'object'|'array'; required?: boolean; defaultValue?: unknown; description?: string }`
  - backend `trigger-parameter.types.ts`: `{ name: string; type: CoercibleType; required?: boolean; defaultValue?: unknown; description?: string }` (`CoercibleType` = 동일 5-union, `utils/coerce-type.ts` 정의)
  - frontend 신규 `lib/api/triggers.ts`: `TriggerParameterType` = 동일 5-union, `TriggerParameterDefinition` = 동일 5필드·동일 optional 여부
  - 필드명·타입·optional 마킹(`required?`, `defaultValue?`, `description?`) 모두 일치. 신규 필드 추가나 필드 제거 없음.

- **이름 정합**: 기존 frontend 에는 두 개의 동일-shape·다른-이름 타입(`rerun-modal.tsx` 의 로컬 `TriggerParameterDefinition`, `trigger-configs.tsx` 의 export `TriggerParameter`)이 존재했다. 이번 변경은 이를 `lib/api/triggers.ts` 의 단일 canonical `TriggerParameterDefinition` 으로 통합 — spec/backend 와 이름이 이미 일치하던 쪽(`TriggerParameterDefinition`)으로 수렴시켰으므로 오히려 3영역(spec·backend·frontend) 이름 일관성이 개선됨.

- **잔여 참조 확인**: `TriggerParameter`(구 이름) 잔존 참조를 grep 으로 전수 확인 — 0건. 두 소비 파일 모두 신규 import 로 전환 완료.

- **동작 변경 없음**: `coerceInput`/`displayValue`/`updateParameter` 등 로직은 타입 애노테이션만 교체되었고 값 흐름·컴포넌트 렌더링 로직은 불변. API 계약(endpoint, request/response shape), 요구사항 ID, 상태 전이, RBAC, 계층 책임 중 어느 것도 영향받지 않음 — 순수 타입 리팩터.

- **plan 문서 갱신**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-14 후속 체크박스가 `[ ]` → `[x]` 로 갱신되어 실제 작업 상태와 일치.

## 요약
이번 변경은 새로운 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 을 도입하지 않는 순수 타입 통합 리팩터다. spec `4-nodes/7-trigger/0-common.md §1` 의 `TriggerParameterDefinition` 스키마, backend `execution-engine/types/trigger-parameter.types.ts` 의 동일 정의, 그리고 새로 도입된 frontend canonical 정의(`lib/api/triggers.ts`) 3자의 필드·타입·이름이 완전히 일치하며, 기존에 존재하던 frontend 내부의 이름 불일치(중복 정의)를 오히려 해소했다. Cross-spec 관점에서 충돌 소지가 없다.

## 위험도
NONE

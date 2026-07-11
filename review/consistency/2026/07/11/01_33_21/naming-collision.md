# 신규 식별자 충돌 검토 — reserved `__` variable-name enforcement PR

대상: `git diff origin/main...HEAD` (39 files changed). 검토 범위는 상단 지시 4개 체크리스트.

## 발견사항

0건. 아래는 각 체크 항목별 근거.

### [Info] 1. 에러 코드 `RESERVED_VARIABLE_NAME` — 충돌 없음

- 신규 도입처: `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts:31` (`RESERVED_VARIABLE_NAME_CODE = 'RESERVED_VARIABLE_NAME'`)
- 카탈로그 등재: `spec/5-system/3-error-handling.md:85` (§1.3 유효성 검증 에러 표, 신규 행)
- 검증: `grep -rn "RESERVED_VARIABLE_NAME" spec codebase`(dist 제외) 결과, 이 PR 이 만든 5개 파일(`reserved-variable-name.util.ts`, 두 노드 handler/schema, `workflows.service.ts`, 3개 spec 파일 — `4-variable-declaration.md`, `5-variable-modification.md`, `3-error-handling.md`, `execution-context.md`) 외 다른 사용처 없음. `spec/5-system/3-error-handling.md` §1.3~1.9 전체 스캔 결과 동일 코드 문자열을 다른 의미로 쓰는 기존 행 없음.

### [Info] 2. `_shared/reserved-variable-name.util.ts` exports — 충돌 없음

- 파일 경로: `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts` — 같은 `_shared` 폴더의 기존 파일(`condition-eval.util.ts`, `value-masking.util.ts`)과 명명 컨벤션(`<name>.util.ts`) 일치, 경로 충돌 없음.
- `RESERVED_VARIABLE_PREFIX` / `isReservedVariableName` / `reservedVariableNameError` / `reservedVariableNameRuntimeError` 4개 export 전량 `grep -rn` 결과, 정의처 1곳 + 소비처(두 노드 schema/handler, `workflows.service.ts`, 각 `.spec.ts`)만 존재. 저장소 전역에 동명의 기존 함수·상수·"reserved prefix" 개념(`RESERVED_PREFIX` 등)이 없음(`grep -rniE "RESERVED_PREFIX|reserved.?prefix"` 무결과, 이 PR 파일 제외).
- 문서상 언급된 선례 "carousel `button.id` 의 `__item_` prefix schema-level reject"(`spec/conventions/execution-context.md:71,75`)는 별도 도메인의 prose 참조일 뿐, 코드 식별자를 공유하지 않음 — 충돌 아님.

### [Info] 3. `VARIABLE_DECLARATION_TYPE` / `VARIABLE_MODIFICATION_TYPE` — 충돌 없음

- 신설 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:37-38`
- 같은 파일의 기존 top-level const: `MANUAL_TRIGGER_TYPE`(36) / `MANUAL_TRIGGER_DEFAULT_POSITION`(39) / `AI_NODE_TYPES_WITH_LLM_CONFIG`(45) — 이름·값 모두 겹치지 않음.
- 값 `'variable_declaration'` / `'variable_modification'` 은 각 노드의 실제 `type` 리터럴과 정확히 일치(`variable-declaration.schema.ts:112`, `variable-modification.schema.ts:155`의 `type: 'variable_declaration'` / `type: 'variable_modification'`) — 새 별칭이 아니라 기존 노드 타입 문자열의 정확한 재참조.

### [Info] 4. spec §1.3 신규 행 — 기존 `RESERVED_VARIABLE_NAME` 행과 충돌 없음

- `spec/5-system/3-error-handling.md` §1.3(72행) "유효성 검증 에러" 표에 `RESERVED_VARIABLE_NAME` 행은 이번 diff 로 처음 추가(85행). 그 위·아래 인접 행(`MODEL_CONFIG_DEFAULT_MISSING`, `RESOURCE_CONFLICT`, `DUPLICATE_NODE_LABEL`, `WORKFLOW_VERSION_CONFLICT`, `INVALID_STATE`)와 코드 문자열·의미 모두 겹치지 않으며, §1.1~§1.9 전체를 통틀어 사전 등재된 동일 코드가 없음.

## 요약

이번 PR 이 새로 도입한 4개 범주의 식별자(에러 코드 `RESERVED_VARIABLE_NAME`, `_shared` 유틸 5개 export, `workflows.service.ts` 의 2개 노드-타입 상수, 그리고 §1.3 신규 카탈로그 행)를 저장소 전체(spec/, codebase/backend, codebase/frontend)에서 교차 검색한 결과 기존 사용처와의 의미 충돌·이름 재사용을 발견하지 못했다. 파일 경로(`_shared/reserved-variable-name.util.ts`)도 폴더 내 기존 `*.util.ts` 명명 관례를 그대로 따르며, 새 상수 값(`variable_declaration`/`variable_modification`)은 임의 별칭이 아니라 기존 노드 타입 리터럴의 정확한 재참조라 오히려 일관성을 높인다.

## 위험도

NONE

STATUS: DONE

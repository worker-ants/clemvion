# 신규 식별자 충돌 검토 — `variables.__*` 예약 prefix 강제 (task_7f283553)

대상: `/private/tmp/.../reserved-prefix-draft.md` (spec + code 원자 PR draft)
검토 범위: 신규 검증 메시지 2개, `context.variables` 네임스페이스 `__`/`_` prefix 의미 충돌, spec §6 표 중복, 단일 underscore 변수명 취급.

## 발견사항

### [Info] 신규 검증 메시지 2개는 저장소 내 유일 문자열 — 기존 메시지·WARNING_KO 와 충돌 없음
- target 신규 식별자: `variables[${i}].name must not start with reserved prefix "__"`, `modifications[${i}].variable must not start with reserved prefix "__"`
- 기존 사용처: `codebase/frontend/src/lib/i18n/backend-labels.ts:384-443` (`WARNING_KO`), `codebase/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts:91-96`, `codebase/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts:130-139`
- 상세: `rg "must not start with reserved prefix"` 결과 저장소 전체에서 0건 — 신규 문자열은 완전히 새로운 리터럴이라 기존 메시지와 정확 일치/부분 중복 없음. `WARNING_KO` (384-443행) 는 `[i]` 인덱스 보간이 없는 **정적** `warningRule` 메시지만 키로 등록하며, 기존 `validateVariableDeclarationConfig`/`validateVariableModificationConfig` 의 동적 `[i]` 메시지(`variables[i].name is required and must be a string` 등)도 이미 미등재 상태다. draft 가 신규 2개 메시지도 동일 패턴(i18n 미등재)을 따르겠다고 명시한 것은 기존 컨벤션과 정합적이며 새로운 충돌을 만들지 않는다.
- 제안: 변경 불필요.

### [Info] `merge.handler.ts` 의 `__proto__`/`constructor`/`prototype` 블록리스트는 다른 계층 — 실제 충돌 아님
- target 신규 식별자: Variable Declaration/Modification 의 `__` prefix 전면 reject (검사 대상: `context.variables` 맵에 **등록되는 변수 이름**)
- 기존 사용처: `codebase/backend/src/nodes/logic/merge/merge.handler.ts:177` `const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);` (Merge 노드 `merge_object` output 포맷 병합 시 JS 프로토타입 오염 방지용 **object key** 필터, `skippedKeys` 로 관찰)
- 상세: 두 가드는 스코프·시점·목적이 모두 다르다. (1) 스코프 — 신규 가드는 `context.variables` 맵의 "변수 이름"(키 문자열 자체)을 검사하고, Merge 가드는 여러 노드 출력을 병합할 때 **값 객체 내부의 own-property key** 를 검사한다. (2) 시점 — 신규 가드는 pre-flight config 검증에서 throw, Merge 가드는 런타임에 해당 key 를 조용히 skip(`meta.skippedKeys`)한다. (3) 목적 — 신규 가드는 "시스템 예약 네임스페이스" 보호, Merge 가드는 JS prototype-pollution 방지. 사용자가 변수 이름을 정확히 `__proto__` 로 선언하려 하면 신규 가드가 `__` prefix 이유로 먼저 차단하므로(부수 효과로 proto-pollution 도 방지), 두 가드가 동일 대상에서 서로 다른 이유로 동시에 발동하는 시나리오는 없다(신규 가드가 선점). 다만 Merge 노드가 병합한 객체가 **변수의 값**(예: `object` 타입 변수의 내부 프로퍼티)으로 저장되는 경우 그 내부 키는 어느 가드의 검사 대상도 아니다 — 이는 기존에도 존재하던 별개의 잔여 범위이며 본 draft 가 새로 만드는 충돌이 아니다.
- 제안: 변경 불필요. 다만 `execution-context.md` 원칙 5 개정 시 "잔여 리스크" 서술에 "변수 *이름* 자체의 `__` reject 이며, 객체 타입 변수 값 내부의 키(예: `merge_object` 로 조립된 값)는 별도(Merge 노드의 `blockedKeys`)로 다뤄진다"는 한 줄을 덧붙이면 향후 두 가드를 혼동한 오독을 예방할 수 있음(선택적 보강, 필수 아님).

### [Info] carousel `__item_` 선례는 별도 네임스페이스(버튼 id) — 인용은 메시지 포맷 미러일 뿐 충돌 아님
- 기존 사용처: `codebase/backend/src/nodes/presentation/_shared/button.types.ts:79-81`, `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts:349-351`, `codebase/backend/src/nodes/presentation/carousel/carousel.handler.ts:143` — presentation 노드 버튼 `id` 필드에 붙는 `__item_{idx}` separator(`buttons[${i}].id must not contain reserved separator "__item_"`)
- 상세: draft 는 이 선례를 "메시지 문구 형식"만 미러한다고 명시(변경 1 절)하며, 검사 대상은 `context.variables` 맵과 무관한 별도 도메인(카드형 프레젠테이션 노드의 버튼 상호작용 id)이다. 두 예약 규칙은 코드베이스에 이미 공존하며 서로 다른 필드(`button.id` vs `variables[i].name`/`modifications[i].variable`)·다른 메시지 문구("must not contain reserved separator" vs "must not start with reserved prefix")를 사용해 텍스트도 겹치지 않는다. 실제 네임스페이스 충돌 없음.
- 제안: 변경 불필요.

### [Info] 단일 underscore(`_foo`)는 `variables` 맵 내부에서 특별 취급되지 않음 — 원칙4 top-level 필드와 스코프 분리 확인
- 기존 사용처: `spec/conventions/execution-context.md:57-61`(원칙4 — `_resumeState`/`_callStack`/`_contextKey` 등 `ExecutionContext` **최상위** 엔진 전용 필드), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7554-7562`(`filterUserVariables` — `!key.startsWith('__')` 만 검사)
- 상세: `rg "startsWith('_'"` (단일 underscore) 로 `codebase/backend/src` 전체를 검색한 결과 `variables` 맵 내부 키에 대해 단일 `_` prefix 를 특별 취급하는 로직은 0건이다. `filterUserVariables` 도 오직 `__`(이중)만 검사하며 단일 `_` 는 사용자 변수로 그대로 통과·영속된다. 원칙4 의 `_`-prefix 규약은 `ExecutionContext` 최상위 필드(핸들러 계약 비노출, `variables` 맵 밖) 전용이라고 원칙5 자체가 명시적으로 구분해 두었으므로(`:68` "top-level `_`-prefix(원칙 4)와 구분"), draft 의 테스트 케이스("`_foo` 단일 underscore 는 허용")는 기존 규약과 정확히 정합하며 새 혼동을 만들지 않는다.
- 제안: 변경 불필요. draft 가 명시한 대로 두 원칙(4 vs 5)의 구분을 테스트 이름/주석에 남기는 것으로 충분.

### [Info] 신규 §6 표 행은 기존 표 행과 중복 없음
- 기존 사용처: `spec/4-nodes/1-logic/4-variable-declaration.md` §6 (표, "에러 코드" 절), `spec/4-nodes/1-logic/5-variable-modification.md` §6 (표)
- 상세: 두 표의 기존 "발생 조건" 컬럼(필수/타입/array-여부 검증)과 draft 가 추가하려는 조건("`variables[i].name`/`modifications[i].variable` 이 `__` 로 시작")을 대조한 결과 겹치는 행은 없다. 신규 행은 기존 `...name is required and must be a string` / `...variable is required and must be a string` 행 바로 아래 삽입하는 것이 표의 검증 순서(필수 → 타입 → 형식 제약)와 자연스럽게 맞물린다.
- 제안: 변경 불필요(순서 제안은 선택 사항).

## 요약
신규 검증 메시지 2개, `__`/`_` prefix 의미, spec 표 추가 행을 저장소 전역에서 대조한 결과 CRITICAL/WARNING 급 신규 식별자 충돌은 발견되지 않았다. 두 메시지 문자열은 저장소에 유일하며 `WARNING_KO` 미등재 패턴과도 정합한다. `merge.handler.ts` 의 `__proto__`/`constructor`/`prototype` 블록리스트와 carousel `__item_` separator 는 각각 다른 데이터 평면(값 내부 object key / 버튼 id)에서 동작하는 별개 가드로, 신규 `context.variables` 이름 reject 와 시점·목적·문자열이 모두 달라 실질적 충돌이 아니다(선점 관계일 뿐). 단일 underscore(`_foo`) 는 `variables` 맵 내부·원칙4(top-level 필드) 어느 쪽에서도 특별 취급되지 않아 draft 의 "허용" 결정과 충돌이 없고, spec §6 표에 추가될 신규 행도 기존 행과 중복되지 않는다. 문서 보강 여지(원칙5 잔여 리스크 서술에 Merge 값-내부-키 범위 구분 한 줄 추가)만 INFO 로 남긴다.

## 위험도
NONE

STATUS: DONE

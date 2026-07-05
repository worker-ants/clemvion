# 유지보수성(Maintainability) Review — trigger-param-type-consolidate

## 발견사항

- **[INFO]** 배치 위치는 기존 컨벤션과 일관됨
  - 위치: `codebase/frontend/src/lib/api/triggers.ts:20-33`
  - 상세: `lib/api/executions.ts` 등 다른 API 카탈로그 파일도 도메인 API 함수와 함께 관련 type/interface(`ExecutionStatus`, `ReRunRequest` 등)를 동일 파일에서 export 하는 관례를 따른다. `TriggerParameterDefinition`/`TriggerParameterType`을 트리거 API 카탈로그인 `triggers.ts`에 두는 것은 이 관례와 일치하며, "트리거 도메인의 canonical 홈"이라는 JSDoc 설명도 근거를 명확히 남긴다.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** 네이밍이 backend 정의와 완전히 정합
  - 위치: `codebase/frontend/src/lib/api/triggers.ts:20-33` vs `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:3-9`
  - 상세: interface 이름(`TriggerParameterDefinition`)과 필드(`name/type/required/defaultValue/description`)가 backend 것과 정확히 동일하다. 다만 `type` 필드의 타입 표현만 backend `CoercibleType`(별도 union, `execution-engine/utils/coerce-type.ts`) vs frontend `TriggerParameterType`(새로 정의된 union)으로 이름이 다르다. 값 집합(`string|number|boolean|object|array`)은 완전히 동일하므로 실질적 정합성에는 문제 없으나, 두 프로젝트(백/프론트) 경계를 넘어 타입을 공유할 수 없는 구조(별도 컴파일 유닛)라 이름까지 통일할 수는 없다는 제약을 감안하면 합리적 타협이다.
  - 제안: 필요시 JSDoc에 "값 집합은 backend `CoercibleType`과 동일하되 별도 선언"이라는 한 줄을 추가하면 향후 두 union 이 drift 할 때 더 빨리 알아챌 수 있다(현재도 JSDoc에 "이름·shape 정합" 언급은 있어 충분히 커버됨).

- **[INFO]** import 방향이 단방향이며 순환 없음
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:6`, `codebase/frontend/src/components/executions/rerun-modal.tsx:29-32`
  - 상세: 두 소비 컴포넌트가 모두 `@/lib/api/triggers`에서 타입만 import하는 구조이며, 반대 방향(`lib/api` → 컴포넌트) 의존은 없다. `trigger-configs.tsx`에서 제거된 로컬 `export type TriggerParameter`를 다른 파일에서 참조하던 곳이 있는지 확인한 결과 0건(해당 컴포넌트를 import하는 곳은 `ManualTriggerConfig`만 소비, 타입은 미소비)으로 안전하게 제거됐다.

- **[INFO]** 중복 제거 효과 확인
  - 위치: `rerun-modal.tsx:107-124` (제거된 로컬 `type ParamType`/`interface TriggerParameterDefinition`), `trigger-configs.tsx:40-46` (제거된 로컬 `export type TriggerParameter`)
  - 상세: 동일 shape의 타입이 세 곳(backend, 에디터 컴포넌트, re-run 모달)에 독립 선언되어 있던 것을 canonical 위치 하나로 단일화했다. `keyof TriggerParameterDefinition`, `TriggerParameterDefinition["type"]` 등 타입 연산도 새 import 로 그대로 동작해 리팩토링 범위가 타입 선언부에 국한된 점이 깔끔하다.

- **[INFO]** JSDoc 품질
  - 위치: `codebase/frontend/src/lib/api/triggers.ts:22-27`
  - 상세: canonical 타입에 spec 인용(`0-common.md §1`) + "값이 아니라 스키마" 라는 핵심 오해 소지 설명 + backend 대응 파일 경로까지 명시해, 향후 이 타입을 보는 개발자가 배경을 파악하기 쉽다. 가독성 관점에서 모범적인 주석.

## 요약

이번 변경은 순수 타입 중복 제거 리팩토링으로, 동작 변화 없이 세 곳에 흩어져 있던 동일 shape 의 트리거 파라미터 타입을 `lib/api/triggers.ts` 하나로 단일화했다. 배치 위치는 기존 `lib/api/*.ts` 파일들이 도메인 API 함수와 관련 타입을 함께 export 하는 컨벤션과 일치하고, 이름(`TriggerParameterDefinition`/`TriggerParameterType`)은 backend `trigger-parameter.types.ts`와 정합하며 값 집합도 backend `CoercibleType`과 완전히 동일하다. import 방향은 두 소비 컴포넌트가 API 레이어에 의존하는 단방향 구조로 순환이 없고, 제거된 로컬 타입에 대한 잔존 참조도 없어 안전하다. 유지보수성 관점에서 개선 사항이며 우려되는 지점은 발견되지 않았다.

## 위험도

NONE

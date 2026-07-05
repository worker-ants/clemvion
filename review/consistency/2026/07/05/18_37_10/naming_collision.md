# 신규 식별자 충돌 검토 — rerun-modal typed form (V-14 impl-done)

대상: `git diff origin/main...HEAD` 중 `codebase/frontend/src/components/executions/rerun-modal.tsx`
(impl-prep 단계 payload 오배선 이력으로 target 문서 대신 실제 diff 를 직접 분석)

## 발견사항

- **[WARNING] `TriggerParameterDefinition` shape 이 기존 프론트엔드 `TriggerParameter` 와 완전 중복**
  - target 신규 식별자: `TriggerParameterDefinition` (interface, `rerun-modal.tsx:106-112`)
  - 기존 사용처: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:10-16` — `export type TriggerParameter = { name; type: "string"|"number"|"boolean"|"object"|"array"; required?; defaultValue?; description? }`
  - 상세: 두 타입은 이름만 다를 뿐 필드 구성·타입이 100% 동일하며, 둘 다 manual_trigger 노드의 `config.parameters` 스키마(동일 도메인 개념)를 표현한다. `trigger-configs.tsx` 의 `TriggerParameter` 는 노드 config 편집 UI에서, `rerun-modal.tsx` 의 `TriggerParameterDefinition` 은 재실행 폼 렌더링에서 각각 독립적으로 재선언됐다. 서로 import 관계가 없어 향후 스키마 필드가 추가/변경될 때 한쪽만 갱신되고 다른 쪽이 stale 해질 위험(drift)이 있다. 다만 "다른 의미로 이미 쓰이는" CRITICAL 충돌은 아니다 — 동일 의미의 shape 이 이름만 바뀐 채 중복 선언된 경우다.
  - 참고: 백엔드에는 이미 같은 이름 `TriggerParameterDefinition` (`codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:3`, `type: CoercibleType`)이 SoT 로 존재하고 spec (`spec/4-nodes/7-trigger/0-common.md §"TriggerParameterDefinition 스키마"`, `spec/4-nodes/7-trigger/1-manual-trigger.md:23,109`)에도 동일 이름·동일 shape 으로 정의돼 있다. 이번 프론트엔드 로컬 재정의는 spec/backend 명명과 **이름이 일치**하고 shape 도 일치하므로 이 축에서는 오히려 바람직한 정합(같은 개념=같은 이름)이며 충돌이 아니다. 문제는 프론트엔드 내부에 이미 존재하는 `TriggerParameter`(trigger-configs.tsx)와의 이름 불일치·중복 쪽이다.
  - 제안: 우선순위 낮은 정리 항목으로, 두 프론트엔드 타입을 `codebase/frontend/src/lib/types/trigger.ts`(이미 "공유 Trigger 도메인 타입" 단일 출처로 존재)에 `TriggerParameterDefinition` 이름으로 통합하고 `trigger-configs.tsx`/`rerun-modal.tsx` 양쪽에서 import 하도록 리팩터 권장. 즉시 블로킹 사유는 아님(런타임 동작에 영향 없음, 두 파일이 서로 다른 화면·다른 라이프사이클).

- **[INFO] `ParamType` 지역 별칭이 백엔드 `CoercibleType` 과 이름만 다름**
  - target 신규 식별자: `type ParamType = "string" | "number" | "boolean" | "object" | "array";` (`rerun-modal.tsx:110`)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/utils/coerce-type.ts:1` `export type CoercibleType = ...` (동일 리터럴 유니온으로 추정), `trigger-configs.tsx:12` 의 인라인 동일 유니온
  - 상세: 프론트엔드 전역에서 `ParamType` 이라는 이름은 이번 diff 가 유일한 선언처이며 다른 파일과 충돌은 없다(다른 의미로 쓰인 사례 없음). 다만 백엔드 `CoercibleType` 과 개념이 동일한데 이름 체계가 다르다(Coercible- vs Param-). 크로스 레이어 명명 일관성 관점에서만 사소한 차이.
  - 제안: 변경 불요. 후속 정리 시 프론트-백엔드 명명 통일을 고려할 수 있으나 현재 스코프에서는 충돌 아님.

- **[INFO] `RerunField`/`displayValue`/`coerceInput`/`setParam`/`fields` — 전역 유일 선언, 충돌 없음**
  - target 신규 식별자: `RerunField` (interface), `displayValue()`, `coerceInput()` (모듈 함수), `setParam`/`fields` (컴포넌트 지역 변수)
  - 기존 사용처: 검색 결과 없음 (`grep -rn` 전체 codebase/spec 기준 `rerun-modal.tsx` 자기 자신 외 매치 0건)
  - 상세: `RerunField` 는 새 폼 필드 렌더 모델로, 기존 어떤 엔티티/DTO/타입과도 이름이 겹치지 않는다. `displayValue`/`coerceInput` 은 모듈 스코프 함수이나 `rerun-modal.tsx` 파일 내부에만 존재하고 export 되지 않아(재확인: import 되는 곳 없음) 전역 네임스페이스 오염 위험이 없다. `setParam`/`fields` 는 컴포넌트 내부 지역 변수로 스코프가 좁아 충돌 가능성 없음.
  - 제안: 변경 불요.

- **엔드포인트/이벤트/ENV/파일경로 충돌**: 이번 diff 는 `/executions/:id/re-run` 기존 endpoint 를 그대로 사용(신규 endpoint 없음), 신규 이벤트/ENV/설정키 도입 없음, 신규 파일 경로 없음(기존 `rerun-modal.tsx`/`rerun-modal.test.tsx` 수정만). 해당 관점에서 검토 대상 자체가 없음.

## 요약

이번 diff 가 새로 도입하는 식별자 중 백엔드/spec 의 `TriggerParameterDefinition` 과 이름이 겹치는 것은 오히려 의도적 정합(spec §"TriggerParameterDefinition 스키마"·backend `trigger-parameter.types.ts` 와 동일 shape)으로 보이며 CRITICAL 충돌이 아니다. 유일하게 주목할 사안은 프론트엔드 내부에 이미 존재하던 `TriggerParameter`(`trigger-configs.tsx`)와 이번에 새로 선언된 `TriggerParameterDefinition`(`rerun-modal.tsx`)이 shape 이 완전히 동일함에도 서로 다른 이름으로 각자 독립 선언되어 있다는 점(WARNING, drift 위험) — 다만 런타임 오류나 즉각적 혼선을 유발하지 않는 리팩터링 권고 수준이다. `ParamType`/`RerunField`/`displayValue`/`coerceInput` 등 나머지 신규 식별자는 전역 검색 결과 기존 사용처와 이름 충돌이 없다. Endpoint·이벤트·ENV·파일경로 축은 이번 diff 범위에 해당 사항이 없다.

## 위험도

LOW

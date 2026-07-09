# 테스트(Testing) 리뷰 — trigger-param-output-enricher

## 발견사항

- **[WARNING]** `use-expression-context.ts` 의 신규 `manual_trigger` 분기 2곳이 통합 테스트로 검증되지 않음
  - 위치: `codebase/frontend/src/components/editor/expression/use-expression-context.ts` L198-202 (`$input` fallback 분기), L256-257 (`$node` output 분기)
  - 상세: 저장소에 `codebase/frontend/src/components/editor/expression/__tests__/use-expression-context.test.ts` 가 이미 존재하지만, `enrich`/`information_extractor`/`transform`/`manual_trigger` 등 enricher 배선을 검증하는 케이스가 전혀 없다(grep 결과 0건). plan 문서(`plan/in-progress/trigger-param-output-enricher.md` "테스트" 절)도 이 배선 검증을 "build 통과로 배선 확인"으로 갈음한다고 명시하는데, 이는 컴파일 성공만 확인할 뿐 `sourceType === "manual_trigger"` / `nodeType === "manual_trigger"` 문자열 매칭이 실제 `node.data.type` 값과 맞물려 enricher 를 호출하고 그 결과가 `inputSchema`/`availableNodes[].outputSchema` 에 실제로 반영되는지는 검증하지 않는다. 기존 4개 enricher(information_extractor/form/table/transform)도 동일하게 미검증 상태였으므로 이번 PR 이 새로 만든 회귀는 아니지만, 신규 분기가 추가될 때마다 같은 갭이 누적되고 있다.
  - 제안: `useExpressionContext` 훅에 대해 manual_trigger 노드가 선택 노드이거나 predecessor 인 시나리오 각 1개씩 통합 테스트를 추가해, `output.parameters.<name>` 힌트가 `inputSchema`/`availableNodes[].outputSchema` 에 실제로 투영되는지 확인 권장. 여유가 되면 기존 3~4개 enricher 배선도 같은 테스트 파일에 백필(별도 후속 커밋 가능).

- **[INFO]** `output.parameters.properties` 에 기존 값이 있는 상태에서의 병합(merge) 시나리오 미검증
  - 위치: `node-output-schema-enrichers.ts` L1231-1242 (`{ ...existingParamsProps, ...userProps }`), 테스트 fixture `manualTriggerBaseSchema` (`__tests__/node-output-schema-enrichers.test.ts` L50-64)
  - 상세: 구현은 `output.parameters` 에 이미 `properties` 가 존재하면 이를 보존하며 신규 `userProps` 와 병합한다. 그러나 테스트의 `manualTriggerBaseSchema` 는 `output.properties.parameters` 가 `{ type: "object" }`(properties 키 자체 없음)이라 `existingParamsProps` 는 모든 테스트에서 항상 `{}` 로만 실행된다. "creates output.parameters.properties when it is an open record" 테스트(L157-167)도 동일하게 `properties` 가 아예 없는 shape 를 다룬다. 즉 "스키마에 이미 정의된 파라미터 이름 + 신규 config 파라미터가 공존"하는 실제 병합 경로(sibling `enrichInfoExtractorOutputSchema` 의 `existingFromSchema` 보존 테스트에 대응하는 케이스)가 이 describe 블록에는 없다.
  - 제안: `output.parameters.properties` 에 사전 정의된 필드(예: `preExisting: { type: "string" }`)를 포함한 fixture 로 별도 케이스를 추가해, 병합 후에도 `preExisting` 이 살아남는지 확인.

- **[INFO]** `warns and returns cloned schema when output property is missing` 케이스가 clone 결과의 무관 프로퍼티 보존 여부를 검증하지 않음
  - 위치: `__tests__/node-output-schema-enrichers.test.ts` L144-155
  - 상세: sibling 인 `enrichInfoExtractorOutputSchema`/`enrichFormOutputSchema` 의 동일 이름 테스트는 `result?.properties?.somethingElse` 가 원본 그대로 보존되는지까지 확인하지만(L328), Manual Trigger 버전은 `result).not.toBe(shape)` 와 `warn` 호출 여부만 검증한다.
  - 제안: `expect(result?.properties?.other).toEqual({ type: "string" })` 를 추가해 clone-and-fallthrough 경로가 원본 구조를 파괴하지 않음을 다른 enricher들과 동일 수준으로 명시.

- **[INFO]** 이름 누락/비-string name 엔트리에 대한 전용 케이스 부재
  - 위치: `__tests__/node-output-schema-enrichers.test.ts` L121-132 ("skips unsafe prototype keys and invalid identifiers")
  - 상세: sibling `enrichInfoExtractorOutputSchema` 테스트는 `{ type: "string" }`(name 없음), `{ name: "", ... }`, `{ name: 123, ... }` 세 케이스가 모두 무시되어 `result === baseSchema` 로 떨어지는 것을 명시적으로 검증한다(L271-281). Manual Trigger 버전은 `has space`/`1bad`/`__proto__` 만 다루고 name 누락·숫자 name 케이스는 별도로 다루지 않는다. `isSafeFieldName` 은 파일 내 공유 유틸이라 실질 위험은 낮지만, 이 파일의 기존 컨벤션(각 describe 가 계약을 독립적으로 재확인)과 비교하면 다소 얕다.
  - 제안: 우선순위는 낮음. 여유가 있으면 1개 케이스만 추가해 파일 전체의 일관성을 맞추는 정도로 충분.

- **[정보/확인 — 조치 불필요]** Mock/fixture 가 실제 backend 스키마와 정확히 일치
  - 위치: `manualTriggerBaseSchema` fixture (`__tests__/node-output-schema-enrichers.test.ts` L50-64) vs `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.schema.ts` L40 (`output.parameters: z.record(z.string(), z.unknown()).optional()`)
  - 상세: fixture 가 `output.parameters` 를 `properties` 없는 open `{ type: "object" }` 로 모델링한 것이 실제 backend zod 스키마(`z.record`)의 JSON-schema 변환 결과와 부합함을 대조 확인했다. Mock 이 실제 동작과 괴리되지 않는다 — 긍정적 사항으로만 기록.

## 요약

신규 `enrichManualTriggerOutputSchema` 는 기존 4개 enricher 와 동일한 패턴(undefined/empty 가드, 타입 매핑 fallback, unsafe key/식별자 차단, 불변성, output 부재 시 clone+warn fallthrough)을 그대로 재사용하는 순수 함수이며, 신규 `describe` 블록이 그 계약의 핵심 경로(빈/누락 파라미터, 타입 매핑 5종 전수, unsafe key 차단, 불변성, output 부재 fallback, open-record projection)를 sibling 테스트와 대등한 수준으로 커버한다. fixture 도 실제 backend `manualTriggerOutputSchema`(`z.record`) 형태와 대조 검증되어 mock 괴리가 없다. 다만 (1) 이 함수를 실제로 호출하는 `use-expression-context.ts` 의 두 배선 지점은 어떤 단위/통합 테스트로도 검증되지 않고 plan 문서 스스로도 "build 통과 확인"으로 갈음한다고 명시하고 있어 회귀 감지력이 약하며(다른 4개 enricher 배선도 동일 갭이라 이번 PR 고유의 신규 결함은 아님), (2) 기존 `output.parameters.properties` 값과의 병합 경로가 아직 한 번도 exercise 되지 않은 점은 향후 이 경로에 로직이 추가될 때 회귀를 놓칠 수 있는 잠재 갭이다. 두 가지 모두 즉시 차단할 결함은 아니며 후속 보강 권장 수준이다.

## 위험도

LOW

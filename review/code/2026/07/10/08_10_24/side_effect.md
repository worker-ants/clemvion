# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** 레지스트리 dispatch가 plain object bracket access로 바뀌며 `Object.prototype` 키 충돌 새 실패 모드 도입
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` `OUTPUT_SCHEMA_ENRICHERS` (약 L1656-1668) / `use-expression-context.ts` `OUTPUT_SCHEMA_ENRICHERS[sourceType]`, `OUTPUT_SCHEMA_ENRICHERS[nodeType]` (약 L172, L221)
  - 상세: 기존 코드는 `if (nodeType === "form") ... else if (...)` 형태의 명시적 문자열 비교 체인이었다. 리팩터 후에는 `OUTPUT_SCHEMA_ENRICHERS[nodeType]` 형태의 object bracket 조회로 바뀌었는데, `OUTPUT_SCHEMA_ENRICHERS`는 `Object.create(null)`이 아닌 일반 object literal이라 `Object.prototype` 체인을 물려받는다. 만약 어떤 노드의 `type` 값이 `"constructor"`, `"hasOwnProperty"`, `"toString"`, `"valueOf"` 등과 우연히(혹은 워크플로 JSON import 등으로) 일치하면 `OUTPUT_SCHEMA_ENRICHERS[nodeType]`는 `undefined`가 아니라 `Object.prototype`의 해당 메서드를 truthy 값으로 반환한다. 이어서 `enrich(inputSchema, config)`로 이를 함수처럼 호출하면 (예: `hasOwnProperty`) 인자 개수·`this` 바인딩 불일치로 예외가 던져지거나 스키마가 예기치 않은 값으로 오염될 수 있다. 기존 if/else 체인에서는 존재하지 않던 위협이다. 같은 파일 내 `isSafeFieldName`/`UNSAFE_KEYS`가 config의 필드명에는 prototype-pollution 방어를 이미 적용하고 있어(`__proto__`/`constructor`/`prototype` 차단), dispatch key인 `nodeType`에는 동일한 경계가 없는 비대칭이 눈에 띈다. (다만 인접 코드의 `nodeDefinitions[nodeType]` 조회도 동일한 클래스의 패턴이라 이 diff가 코드베이스에 완전히 새로운 취약 유형을 도입하는 것은 아니며, 실제 익스플로잇 가능성은 노드 타입 값이 신뢰되지 않는 입력으로 도달 가능한지에 달려 있다.)
  - 제안: 레지스트리를 `Object.create(null)`로 생성하거나, 조회 시 `Object.hasOwn(OUTPUT_SCHEMA_ENRICHERS, nodeType) ? OUTPUT_SCHEMA_ENRICHERS[nodeType] : undefined`로 안전하게 접근. 또는 `Object.freeze(OUTPUT_SCHEMA_ENRICHERS)`와 병행해 방어.

- **[INFO]** dev-only `console.warn` 진단 메시지 텍스트가 Table/Manual Trigger에서 변경됨 (behavior-preserving 주장과 미세하게 어긋남)
  - 위치: `node-output-schema-enrichers.ts` `enrichByProjecting` 내 warn 문 (diff L880-887), 및 이를 사용하는 `enrichTableOutputSchema`/`enrichManualTriggerOutputSchema` 호출부의 `warnLabel` 인자
  - 상세: 공통 골격(`enrichByProjecting`)으로 합치면서 경고 메시지 접미사가 `${warnLabel} outputSchema missing \`output\` property; dynamic field hints skipped.`로 통일됐다. 기존에는 Table이 `"...; column hints skipped."`, Manual Trigger가 `"...; parameter hints skipped."`로 각각 다른 문구였다. 두 enricher의 dev 콘솔 경고 텍스트가 조용히 바뀐 것이며, 관련 테스트는 `expect(warn).toHaveBeenCalled()`만 검증하므로 텍스트 변경을 잡아내지 못한다. `process.env.NODE_ENV !== "production"` 조건이라 프로덕션 사용자에게는 영향이 없지만, plan 문서(`plan/in-progress/expression-enricher-dry.md`)의 "spec·런타임·백엔드·사용자 가시 동작 무변경" 주장과는 엄밀히 어긋나는 관찰 가능한 출력 변화다.
  - 제안: 의도된 통합이면 무방하나, 로그 그레핑/모니터링에 옛 문구를 의존하는 곳이 있는지 확인. 없다면 현행 유지해도 무방.

- **[INFO]** 신규 public export `OUTPUT_SCHEMA_ENRICHERS`로 모듈 인터페이스 확장
  - 위치: `node-output-schema-enrichers.ts` 최하단 `export const OUTPUT_SCHEMA_ENRICHERS`
  - 상세: 기존에는 5개의 `enrich*OutputSchema` 함수만 export였다. 이번 diff로 모든 함수를 값으로 담은 레지스트리 객체가 새로 공개 export됐다(`use-expression-context.ts`와 테스트 파일이 이를 소비). 개별 `enrich*` 함수들의 시그니처·export 여부는 그대로 유지되어 기존 호출자(있다면)에 破壊적 영향은 없다. 다만 `OUTPUT_SCHEMA_ENRICHERS`는 `Object.freeze` 되어 있지 않은 module-level mutable 객체이므로, 향후 어떤 코드가 `OUTPUT_SCHEMA_ENRICHERS.someType = ...` 식으로 런타임에 키를 추가/치환하면 이 레지스트리를 참조하는 모든 소비처(현재는 `use-expression-context.ts`의 두 dispatch 지점)가 동시에 영향을 받는 공유 가변 상태가 된다. 현재 diff 범위 내에서 그런 변형 코드는 없다.
  - 제안: 의도적 공개 API라면 문제 없음. 실수로 인한 외부 변형을 원천 차단하려면 `Object.freeze(OUTPUT_SCHEMA_ENRICHERS)` 추가를 고려.

- **[INFO]** `getOrCreateObjectChild`/`mergeLeafProps`/`enrichByProjecting`은 항상 `cloneSchema()`로 만든 clone 위에서만 동작 — 원본 `baseSchema` 오염 없음 확인
  - 위치: `node-output-schema-enrichers.ts` `enrichByProjecting` (L1406-1437) 및 각 enricher의 `attach` 콜백
  - 상세: 리팩터 전후 모두 각 enricher가 `baseSchema`를 직접 mutate하지 않고 clone 위에서 작업 — 기존 "does not mutate the base schema" 테스트들이 그대로 통과하는 것으로 확인됨(diff에 해당 테스트 수정 없음). 의도치 않은 공유 상태 변경 없음.
  - 제안: 해당 없음(정보성 확인).

## 요약

이번 변경은 프론트엔드 전용 expression-autocomplete enricher 5종의 공통 골격을 `enrichByProjecting`/`cloneSchema`/`collectProps`/`getOrCreateObjectChild`/`mergeLeafProps`로 추출하고, `use-expression-context.ts`의 두 곳 `if/else` dispatch를 `OUTPUT_SCHEMA_ENRICHERS` 레지스트리 조회로 통합한 순수 내부 리팩터다. export된 5개 함수의 시그니처는 변경 없고, 스키마 clone-before-mutate 불변식도 유지되어 전역/공유 상태 오염 위험은 낮다. 다만 (1) 신규 레지스트리가 `Object.create(null)`이 아닌 일반 object라 `nodeType`이 `"constructor"`/`"hasOwnProperty"` 등과 우연히 겹치면 `Object.prototype` 메서드가 enricher로 오인되어 호출되는 새 실패 모드가 이론상 생겼고, (2) Table/Manual Trigger의 dev-only 경고 메시지 문구가 조용히 통일되어 "behavior-preserving" 주장과 미세하게 어긋난다. 둘 다 사용자 가시 런타임 동작이나 공개 API 계약에는 영향이 없는 낮은 실무 위험도의 항목이다.

## 위험도

LOW

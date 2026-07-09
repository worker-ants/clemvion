# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `MANUAL_TRIGGER_TYPE_MAP`이 `INFO_EXTRACTOR_TYPE_MAP`과 내용이 완전히 동일한 중복 상수
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts:20-31` (신규 `MANUAL_TRIGGER_TYPE_MAP`, L27부터) vs 기존 `INFO_EXTRACTOR_TYPE_MAP` (L14-19 부근)
  - 상세: 두 맵 모두 `{ string: "string", number: "number", boolean: "boolean", object: "object", array: "array" }` — 항목 순서만 다르고 키/값이 100% 동일한 "identity guard"다. JSDoc 주석("이미 JSON-schema 타입 이름이라 identity guard")도 동일한 취지를 설명한다. 이런 순수 identity 매핑은 `INFO_EXTRACTOR_TYPE_MAP`을 재사용하거나 공용 `JSON_SCHEMA_PRIMITIVE_TYPES` 상수 하나로 통합할 수 있었다.
  - 제안: 두 맵을 하나의 공용 상수(예: `JSON_SCHEMA_IDENTITY_TYPE_MAP`)로 합치고 두 enricher가 이를 공유하도록 리팩터링. 최소한 향후 새 enricher 추가 시 동일 맵을 또 만들지 않도록 주의.

- **[WARNING]** `enrich*OutputSchema` 함수 5개(이번 추가로 5번째)가 거의 동일한 골격을 반복
  - 위치: `node-output-schema-enrichers.ts` — `enrichManualTriggerOutputSchema` (L344 부근) 는 `enrichInfoExtractorOutputSchema` / `enrichFormOutputSchema` / `enrichTableOutputSchema`와 "clone → 배열 guard → safe-name 필터링 → 타입 매핑/fallback → 기존 output 노드 탐색 → 없으면 dev warn + clone 반환 → 기존 properties 와 병합" 구조가 사실상 동일하다.
  - 상세: 기존 4개 함수에 이어 5번째 거의 동일한 복제본이 추가되어 DRY 위반이 누적되고 있다. 이 패턴이 계속 늘어나면(신규 노드 타입마다 이 골격을 통째로 복붙) 공통 버그(예: `isSafeFieldName` guard 로직 변경, structuredClone 폴백 방식 변경)를 고칠 때마다 5곳 이상을 손으로 동기화해야 하는 리스크가 커진다.
  - 제안: 출력 경로(`outputPath: string[]`), 소스 배열 키, name/type/description 키, 타입 맵을 파라미터로 받는 공용 `projectFieldsIntoSchema(baseSchema, entries, options)` 헬퍼로 추출하고 5개 함수를 얇은 wrapper 로 축소. 이번 PR 범위를 벗어난다면 최소한 후속 리팩터링 TODO로 남길 것을 권장.

- **[WARNING]** `use-expression-context.ts`에 동일한 5-way dispatch 분기가 두 곳에 중복되어 수동 동기화 필요
  - 위치: `codebase/frontend/src/components/editor/expression/use-expression-context.ts:192-201`($input schema fallback) 및 `:250-257`(available node output projection)
  - 상세: 두 위치 모두 `information_extractor` / `form` / `table` / `transform` / `manual_trigger`를 나열하는 `if/else if` 체인이며, 이번 PR도 "두 호출부 모두" manual_trigger 분기를 추가해야 했다(plan 파일에도 "2개 호출부"로 명시). 신규 노드 타입이 추가될 때마다 두 곳을 모두 고쳐야 하고 하나만 빠뜨리면(예: `$input` 힌트만 갱신되고 `$node[...]` 힌트는 누락) 조용히 부분 회귀가 발생할 수 있다.
  - 제안: `nodeType → enrich 함수` 매핑 테이블(`Record<string, (schema, config) => JsonSchemaNode | undefined>`)을 모듈 상단에 하나 두고 두 호출부 모두 `ENRICHERS[nodeType]?.(schema, config) ?? schema` 형태로 단순화하면 새 노드 타입 추가 시 테이블 한 곳만 수정하면 된다.

- **[INFO]** 테스트 파일과 구현 파일에 거의 동일한 설명 주석이 두 번 존재
  - 위치: `__tests__/node-output-schema-enrichers.test.ts` L44-49(`manualTriggerBaseSchema` 위 주석) vs `node-output-schema-enrichers.ts` L332-345(`enrichManualTriggerOutputSchema` JSDoc, 이번 diff 기준 신규 함수 상단)
  - 상세: 두 주석 모두 "config.parameters(배열) vs output.parameters(name-keyed 객체)" 직교성을 거의 같은 문장으로 설명한다. 기존 4개 enricher의 테스트에도 유사하게 짧은 주석이 있지만, 이번 추가분은 구현 JSDoc과 거의 문장 단위로 겹쳐 향후 한쪽만 갱신되면 설명이 어긋날 소지가 있다.
  - 제안: 테스트 쪽 주석은 "왜 이 fixture 모양인지"만 짧게 남기고, 배경 설명은 구현 JSDoc을 참조하도록 축약(예: "see enrichManualTriggerOutputSchema JSDoc").

## 요약

`enrichManualTriggerOutputSchema` 추가는 기존 4개 enricher(`enrichInfoExtractorOutputSchema`/`enrichFormOutputSchema`/`enrichTableOutputSchema`/`enrichTransformOutputSchema`)와 동일한 네이밍·안전장치(`isSafeFieldName`, `Object.create(null)`, structuredClone 폴백, dev-only warn)를 그대로 재사용해 코드베이스 일관성은 매우 높고, 함수 길이·중첩 깊이·매직 넘버 측면에서도 기존 스타일 범위를 벗어나지 않으며 테스트도 형제 함수들과 동일한 커버리지 패턴(빈 배열/undefined config/unsafe 이름/타입 폴백/no-mutation/output 부재 fallback)으로 꼼꼼하게 작성됐다. 다만 이 "동일 스타일 반복"이 곧 문제이기도 하다 — identity 타입 맵의 완전 중복, 5번째로 복제된 enrich 함수 골격, 그리고 `use-expression-context.ts`의 두 곳으로 나뉜 dispatch 체인은 모두 이번 PR이 새로 만든 문제라기보다 기존에 누적돼온 구조적 부채이며, 신규 노드 타입이 추가될 때마다 여러 곳을 수동으로 동기화해야 하는 shotgun-surgery 위험이 계속 커지고 있다. 지금 당장 리팩터링을 요구할 정도는 아니지만, 다음 6번째 enricher가 추가되기 전에 공용 헬퍼/디스패치 테이블로 통합하는 것을 권장한다.

## 위험도
LOW

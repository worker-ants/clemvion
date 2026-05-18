# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `.meta({ ui: { required: true } })` 추가는 Zod 스키마 객체의 런타임 메타데이터를 변경하지만, 파싱·검증 동작(parse/safeParse)에는 영향이 없음
  - 위치: 파일 2, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 18의 각 `.meta()` 호출 부분
  - 상세: `z.meta()` 는 JSON Schema 직렬화 시 `ui.required` 필드를 포함시키는 메타데이터 어노테이션이다. Zod 의 `parse`/`safeParse`/`infer` 동작에는 관여하지 않으므로 기존 validator 호출자, 핸들러, DTO 역직렬화 경로에 런타임 부작용이 없다. 단, `z.toJSONSchema()` 로 JSON Schema를 생성하는 소비처(예: OpenAPI 문서, 프런트엔드 스키마 소비 코드)가 있다면 생성된 JSON의 `properties.<field>.ui.required` 값이 새로 나타난다.
  - 제안: 해당 변경이 의도한 동작이므로 이슈 없음. 단, `z.toJSONSchema()` 결과를 캐싱하거나 직렬화해 저장하는 경로가 있다면 캐시 무효화 여부 확인 권장.

- **[INFO]** `requiredWhen` 신규 필드 추가 (http-request `integrationId`, switch `switchValue`)
  - 위치: 파일 4 (`http-request.schema.ts` L127-129), 파일 14 (`switch.schema.ts` L80-82)
  - 상세: `requiredWhen: { field, equals/notEquals }` 는 기존 `visibleWhen` 와 동일한 메타 패턴이다. 프런트엔드의 `visibility.ts:36-46`에서 이를 읽어 asterisk 표시에 사용하므로 UI 동작이 변경된다. 그러나 백엔드 파싱·검증 경로에는 부작용이 없다.
  - 제안: 이슈 없음. `requiredWhen` 소비 측(visibility.ts 등)이 `notEquals` 키를 지원하는지 확인 필요 — switch 에서 `notEquals` 를 새로 사용하고 있으나 http-request는 `equals`를 사용함.

- **[INFO]** 테스트 파일에서 `databaseQueryNodeConfigSchema`, `httpRequestNodeConfigSchema`, `sendEmailNodeConfigSchema`, `formNodeConfigSchema` 를 새로 import
  - 위치: 파일 1, 3, 5, 17 (각 spec 파일 상단 import 추가)
  - 상세: 기존에 import되지 않던 export를 테스트에서 추가 참조한다. 이는 순환 의존 가능성은 없고(테스트 파일은 단방향 의존), `z.toJSONSchema()` 호출이 모듈 최상위 레벨(`describe` 블록 바깥, `const properties = ...`)에서 이루어진다. 이 시점에서 스키마 객체가 완전히 초기화되어 있으므로 모듈 로드 순서 부작용 없음.
  - 제안: 이슈 없음.

- **[INFO]** `logic-ui-required.spec.ts` 신규 파일 생성 — `z.toJSONSchema()` 를 `uiMeta()` 헬퍼 내부에서 호출
  - 위치: 파일 10 (`logic-ui-required.spec.ts`)
  - 상세: 각 테스트 실행 시 `z.toJSONSchema(schema)` 가 동적으로 호출된다. 이 함수는 순수 함수(외부 상태 변경 없음)이나, 대형 스키마를 반복적으로 JSON 직렬화하면 테스트 실행 시간이 증가할 수 있다. `it.each` 로 10개 케이스를 순회하며 매번 새로 직렬화한다.
  - 제안: 현재 스키마 크기 및 케이스 수에서는 문제없으나, 테스트 수가 늘면 `describe` 블록 상위 레벨에서 한 번만 직렬화하도록 리팩터링 고려.

- **[INFO]** `loop.schema.ts`의 `count` 필드: `required: true` 로 마킹되었으나 zod 기본값은 `'1'`
  - 위치: 파일 11 (`loop.schema.ts`), `loopNodeConfigSchema.count`
  - 상세: `count` 는 `.default('1')` 이 있어 parse 시 항상 값이 존재하지만, `warningRules` 의 `when: '!count'` 조건은 `count === ''` (빈 문자열) 일 때도 발화한다. `ui.required: true` 와 `default('1')` 의 조합은 사용자가 count 를 지우면 UI asterisk 가 표시되는 올바른 동작이다. 부작용 없음.
  - 제안: 이슈 없음.

## 요약

이번 변경은 16개 노드 스키마 파일의 `.meta({ ui: { ... } })` 블록에 `required: true` 또는 `requiredWhen: { ... }` 필드를 추가하고, 이를 검증하는 잠금 테스트를 추가하는 작업이다. 모든 변경은 Zod 메타데이터 레이어에 국한되며 파싱·검증·타입 추론 동작에 영향을 주지 않는다. 전역 변수, 환경 변수, 파일시스템, 네트워크, 이벤트/콜백 영역에는 어떠한 부작용도 없다. 공개 API 시그니처(`NodeComponentMetadata`, 각 `*Config` 타입, `*NodePorts`, `validate*Config` 함수)는 변경되지 않았으므로 기존 호출자에 대한 호환성 파손도 없다. `z.toJSONSchema()` 출력에 `ui.required`/`ui.requiredWhen` 키가 추가되므로 이 출력을 소비하는 프런트엔드 렌더링 경로에서 asterisk 표시가 의도대로 추가되는 것이 유일한 외부 관찰 가능 변화이며, 이는 이번 변경의 목적 자체다. `switch.schema.ts` 에서 처음 사용한 `notEquals` 키가 프런트엔드 `visibility.ts` 에서 올바르게 처리되는지 확인하는 것이 유일한 후속 검토 권고사항이다.

## 위험도

LOW

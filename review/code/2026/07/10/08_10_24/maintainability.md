# 유지보수성(Maintainability) 리뷰 결과

## 대상
- `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts`
- `codebase/frontend/src/components/editor/expression/__tests__/node-output-schema-enrichers.test.ts`
- `codebase/frontend/src/components/editor/expression/use-expression-context.ts`
- `plan/in-progress/expression-enricher-dry.md`

behavior-preserving DRY 리팩터. 5개 `enrich*OutputSchema` 함수가 반복하던 `clone → output
노드 탐색 → dev-warn fallback → 중첩 경로 병합` 골격을 `enrichByProjecting` +
`collectProps` / `getOrCreateObjectChild` / `mergeLeafProps` / `cloneSchema` 로 추출하고,
`use-expression-context.ts` 의 두 곳(5-way `if/else if`) dispatch 를
`OUTPUT_SCHEMA_ENRICHERS` 레지스트리 조회로 대체했다. 기존 ai-review(#875 W3/W4, #878 W3)
지적을 정면으로 해소하는 리팩터다.

## 발견사항

- **[WARNING]** 헬퍼 간 방어 패턴 비대칭 — non-null assertion vs 방어적 초기화
  - 위치: `node-output-schema-enrichers.ts` `enrichTableOutputSchema` 내부 `attach`
    콜백 (`outputNode.properties!.rows`, `outputNode.properties!.rows = rowsNode;`)
  - 상세: 같은 파일의 자매 헬퍼 `getOrCreateObjectChild` / `mergeLeafProps` 는
    둘 다 `if (!parent.properties) parent.properties = {};` 로 로컬에서 방어적으로
    non-null 을 보장한다. 반면 `enrichTableOutputSchema` 의 `attach` 콜백은 같은
    불변식(`outputNode.properties` 가 이미 초기화되어 있음)을 `!` non-null
    assertion 으로 가정한다. 이 불변식은 콜백 자신이 아니라 호출자인
    `enrichByProjecting` 의 `if (!outputNode.properties) outputNode.properties = {};`
    (한 프레임 위)이 보장한다 — 지금은 안전하지만, 콜백이 로컬적으로
    self-contained 하지 않아 향후 `enrichByProjecting` 내부 순서가 바뀌거나
    `attach` 가 다른 경로에서 재사용될 경우 조용한 런타임 예외로 이어질 수 있는
    잠재 위험이다. 같은 파일 안에서 두 가지 다른 방어 스타일(방어적 초기화 vs
    비단언)이 공존하는 것 자체가 일관성 측면에서도 약점.
  - 제안: `getOrCreateObjectChild`/`mergeLeafProps` 와 동일하게
    `if (!outputNode.properties) outputNode.properties = {};` 를 콜백 로컬에서
    한 번 더 방어적으로 넣거나(비용 거의 없음), 혹은 `attach` 콜백 타입 자체를
    `properties` 가 보장된 타입(e.g. `JsonSchemaNode & { properties: Record<...> }`)
    으로 좁혀 타입 시스템이 불변식을 강제하도록 한다.

- **[INFO]** `enrichByProjecting` 시그니처 밀도
  - 위치: `node-output-schema-enrichers.ts` `enrichByProjecting(baseSchema, rawItems,
    buildUserProps, attach, warnLabel)`
  - 상세: 위치 인자 5개 중 2개가 서로 다른 시그니처의 콜백, 1개가 표시용 라벨
    문자열이다. 호출부(4곳)마다 JSDoc 없이 인자 순서만으로 어떤 콜백이 무엇을
    하는지 되짚어야 한다. 현재는 파일 상단·함수 자체의 JSDoc 설명이 충분히
    보완하고 있어 심각하지 않지만, 6번째 node type 추가 시 인자 순서 실수
    (`buildUserProps`/`attach` 뒤바꿈 등) 가능성이 있다.
  - 제안: 필수는 아니나, 옵션 객체(`{ rawItems, buildUserProps, attach, warnLabel }`)
    로 바꾸면 호출부 가독성이 개선되고 인자 순서 실수를 원천 차단할 수 있다.
    (파일 규모·호출부 4곳을 고려하면 현재 상태도 수용 가능한 트레이드오프.)

- **[INFO]** `getOrCreateObjectChild` / `mergeLeafProps` 역할 경계
  - 위치: `node-output-schema-enrichers.ts` L1358-1394 (전체 파일 컨텍스트 기준)
  - 상세: 두 헬퍼 모두 "object 노드를 get-or-create 하고 `.properties` 를 병합"
    한다는 점에서 개념적으로 인접해 있다. 차이(중간 wrapper 노드 보존 vs 최종
    leaf 교체)는 JSDoc 으로 명확히 문서화되어 있어 실질적 혼동 위험은 낮지만,
    신규 기여자가 "왜 헬퍼가 둘로 쪼개졌는지"를 파악하려면 두 JSDoc 을 모두
    읽어야 한다. 현 상태로도 유지보수 가능한 수준.
  - 제안: 현행 유지 가능. 필요시 두 헬퍼의 JSDoc 에 상호 `{@link}` 참조를 추가해
    "이 둘은 왜 별개인가"를 한쪽만 읽어도 알 수 있게 보강하면 좋다.

- **[INFO]** 회귀 방지 테스트가 리팩터 동기를 정확히 겨냥
  - 위치: `__tests__/node-output-schema-enrichers.test.ts` `describe("OUTPUT_SCHEMA_ENRICHERS
    registry", …)`
  - 상세 (긍정): 이번 리팩터가 해소하려는 결함 클래스("새 node type 을 한 dispatch
    지점에만 추가하고 다른 지점을 빠뜨림")를 정확히 겨냥한 테스트다 — 레지스트리
    전체 매핑을 `toEqual` 로 스냅샷하고, 미등록 타입에 대해 `undefined` 를 검증한다.
    이런 "구조를 검증하는 테스트"는 회귀 방지 가치가 높고 앞으로 6번째 enricher가
    추가될 때도 그대로 가드 역할을 한다.

## 요약

`node-output-schema-enrichers.ts`/`use-expression-context.ts` 리팩터는 이전 리뷰에서
반복 지적된 5-way 중복(스키마 clone·output 탐색·dev-warn·경로 병합 골격, 2곳
dispatch)을 `enrichByProjecting` + 소형 헬퍼(`collectProps`/`getOrCreateObjectChild`/
`mergeLeafProps`/`cloneSchema`) + `OUTPUT_SCHEMA_ENRICHERS` 레지스트리로 깔끔하게
소비했다. JSDoc 이 각 함수의 역할·예외(Transform 이 `enrichByProjecting` 을 쓰지 않는
이유 등)를 충실히 설명하고, 레지스트리 완전성을 검증하는 신규 테스트가 리팩터의
핵심 동기(부분 회귀 방지)를 직접 커버한다. 함수 길이·중첩 깊이·매직넘버 문제는
보이지 않으며 기존 컨벤션(`Object.create(null)`, `structuredClone` 폴백, dev-only
`console.warn`)과도 일관적이다. 유일하게 짚을 점은 `enrichTableOutputSchema` 의
`attach` 콜백이 자매 헬퍼들과 달리 non-null assertion 에 의존해 로컬 self-containment
가 약간 떨어진다는 것과, `enrichByProjecting` 의 5-인자 시그니처가 다소 밀도가
높다는 점인데 둘 다 차단 사유는 아니다.

## 위험도

LOW

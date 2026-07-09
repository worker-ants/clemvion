# 요구사항(Requirement) Review — expression-enricher-dry

대상: `node-output-schema-enrichers.ts` DRY 리팩터 (`cloneSchema`/`collectProps`/
`getOrCreateObjectChild`/`mergeLeafProps`/`enrichByProjecting` 추출 +
`OUTPUT_SCHEMA_ENRICHERS` 레지스트리), `use-expression-context.ts` 의 2곳 dispatch를
레지스트리 lookup으로 교체, 신규 registry 완전성 테스트 2건. plan 문서 자체 명시대로
"behavior-preserving, 순수 내부 리팩터".

## 방법론

5개 enricher(`enrichInfoExtractorOutputSchema`/`enrichFormOutputSchema`/
`enrichTableOutputSchema`/`enrichTransformOutputSchema`/
`enrichManualTriggerOutputSchema`)의 리팩터 전/후 로직을 diff 기준 line-by-line 대조,
`use-expression-context.ts` 두 dispatch 지점의 분기 세트(5-way if/else → registry
lookup) 동등성 확인, `spec/5-system/5-expression-language.md` §7.2 enricher 투영
규칙 표와 코드의 line-level 일치 여부 확인.

## 발견사항

- **[INFO]** Table enricher의 dev-only 경고 문자열이 리팩터로 변경됨
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` `enrichByProjecting` (경고 메시지 템플릿), 기존 Table 전용 분기는 `"...Table outputSchema missing \`output\` property; column hints skipped."`
  - 상세: 4개 enricher(info_extractor/form/table/manual_trigger)가 공용 `enrichByProjecting`으로 합쳐지면서 `warnLabel` 파라미터로 접두어만 교체하고 접미어는 `"...outputSchema missing \`output\` property; dynamic field hints skipped."`로 통일됨. 기존에는 Table만 `"column hints skipped."`라는 다른 접미어를 썼음. dev 전용 `console.warn`이고 어떤 테스트도 경고 문자열 내용을 assert하지 않으므로(`expect(warn).toHaveBeenCalled()`만 확인) 기능/테스트 회귀는 없음. 다만 plan 문서(`plan/in-progress/expression-enricher-dry.md`)가 "spec·런타임·백엔드·사용자 가시 동작 무변경"을 명시적으로 표방하는 만큼, 엄밀히는 개발자에게 보이는 diagnostic 출력이 미세하게 변경된 점은 사실.
  - 제안: 의도된 통합이면 문제 없음(현행 유지 권장). 완전한 문구 보존이 필요하면 `warnLabel`을 접두어가 아니라 전체 접미어 문자열로 파라미터화.

- **[INFO]** `OUTPUT_SCHEMA_ENRICHERS`의 선언 타입이 `Record<string, Fn>`으로, 인덱스 접근 시 `undefined` 가능성이 타입에 드러나지 않음
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` (`OUTPUT_SCHEMA_ENRICHERS` 선언부), 소비처 `use-expression-context.ts` (`OUTPUT_SCHEMA_ENRICHERS[sourceType]` / `OUTPUT_SCHEMA_ENRICHERS[nodeType]`)
  - 상세: 두 소비처 모두 `if (inputSchema && enrich)` / `if (enrich)` 런타임 가드가 있어 실질적 결함은 아님. 다만 신규 테스트("returns undefined for an unregistered node type")가 런타임에는 `undefined`가 나옴을 검증하는데, 정적 타입은 이를 표현하지 않아 향후 가드 누락 시 컴파일러가 못 잡아줄 여지가 있음(`noUncheckedIndexedAccess` 미적용 가정).
  - 제안: `Partial<Record<string, Fn>>`로 선언하면 타입-런타임 정합이 개선됨. 필수 아님(현재 두 호출부 모두 가드 존재).

- **[INFO]** plan 체크리스트 미체크 상태와 실제 구현 완료 상태 불일치
  - 위치: `plan/in-progress/expression-enricher-dry.md` `## 설계` / `## 테스트` 섹션의 `- [ ]` 항목들
  - 상세: diff상 `cloneSchema`, `enrichByProjecting`(문서의 `mergeObjectProp`은 `getOrCreateObjectChild`+`mergeLeafProps` 2개로 분리 구현됨 — 설계보다 세분화되었으나 기능은 동일), `OUTPUT_SCHEMA_ENRICHERS` export, 2곳 dispatch 교체, registry 완전성 테스트가 모두 구현·커밋되어 있음에도 체크박스가 미체크. 기능결함 아님, plan-lifecycle 갱신 누락(리뷰/커밋 마무리 단계에서 정리 권장).
  - 제안: RESOLUTION 단계에서 체크박스 갱신.

## Spec fidelity 상세 확인

`spec/5-system/5-expression-language.md` §7.2 "config 기반 스키마 보강 (enricher)" 표
(라인 416-426)와 코드를 대조:

| spec 투영 규칙 | 코드 구현 | 일치 |
|---|---|---|
| `information_extractor`: `config.outputSchema[].name` → `.output.result.extracted.<name>` | `enrichInfoExtractorOutputSchema` → `getOrCreateObjectChild(outputNode,"result")` + `mergeLeafProps(result,"extracted",userProps)` | 일치 |
| `form`: `config.fields[].name` → `.output.interaction.data.<field>` | `enrichFormOutputSchema` → `getOrCreateObjectChild(outputNode,"interaction")` + `mergeLeafProps(interaction,"data",userProps)` | 일치 |
| `table`: `config.columns[].field` → `.output.rows[i].<field>` | `enrichTableOutputSchema` → `rowsNode.items.properties` 병합(전용 인라인 attach, `mergeLeafProps` 미사용 — array items라 문서에도 명시된 의도적 예외) | 일치 |
| `transform`: `set_field.field` / `rename_field.to` → `.output.<name>` | `enrichTransformOutputSchema` → `output` 통째 교체(`enrichByProjecting` 미사용, JSDoc에 명시된 의도적 예외) | 일치 |
| `manual_trigger`: `config.parameters[].name` → `.output.parameters.<name>` | `enrichManualTriggerOutputSchema` → `mergeLeafProps(outputNode,"parameters",userProps)` | 일치 |
| 안전장치: unsafe 키/비식별자 거부, `{{ }}` expression skip, 중첩 경로(`user.name`) skip, base shape 미허용 시 base로 silent fallback | `isSafeFieldName`(`UNSAFE_KEYS`+`SAFE_IDENTIFIER_RE`), Table의 `fieldName.includes("{{")`, Transform의 `field.includes(".")`, `enrichByProjecting`의 `!outputNode` → cloned 반환(dev warn) 경로 모두 유지 | 일치 |

`enrichManualTriggerOutputSchema`의 JSDoc이 인용하는 `manual-trigger spec §4/§5.1` (config.parameters
배열 vs output.parameters 이름-키 객체, "직교" 관계, Principle 1.1)도
`spec/4-nodes/7-trigger/1-manual-trigger.md` §4 항목5·§5.1 필드 표와 문구까지 일치.

CRITICAL 급 spec 불일치나 SPEC-DRIFT는 발견되지 않음 — 순수 내부 구조 리팩터가 기존
spec 투영 규칙을 그대로 보존.

## 동작 동등성(behavior-preserving) 검증 근거

- 5개 enricher 각각의 (1) empty/undefined short-circuit, (2) clone-before-mutate,
  (3) 안전 필터(`isSafeFieldName`, `{{ }}` skip, dot-path skip), (4) 병합 규칙(기존
  값과 spread 순서 `{...existing, ...userProps}`), (5) `output` 미존재 시 dev-warn +
  clone 반환 fallback 이 리팩터 전/후 line-level로 동일 로직임을 확인. Table의
  `rowsNode.items` 처리와 Transform의 `output` 전체 교체 로직은 각각 JSDoc에 명시된 대로
  공용 헬퍼 미사용 예외로 유지되어 문서-구현 간 괴리 없음.
- `use-expression-context.ts`의 두 dispatch 지점 모두 기존 5-way `if/else if`가 다루던
  정확히 동일한 5개 노드 타입 집합을 registry가 커버(코드베이스 전체에서 이 두 지점
  외에 개별 enricher 함수를 직접 호출하는 소비처 없음 — grep 확인, 별도 dispatch
  누락 없음).
- `use-expression-context.ts` 2번째 dispatch 지점(`$node["Label"].output`)은 기존에도
  `outputSchema` truthy 가드 없이 enrich를 호출했고(각 enricher 자체가 `!baseSchema`
  short-circuit 보유), 리팩터 후도 동일 — 회귀 아님.
- 테스트 파일은 기존 테스트를 하나도 삭제/변경하지 않고 registry 완전성 테스트 2건만
  추가 — behavior-preserving 주장에 부합하는 회귀 게이트 구성.

TODO/FIXME/HACK/XXX 주석, 반환값 누락 경로, 데이터 유효성 검증 약화, 비즈니스 로직
변경, 함수명·주석과 구현 간 괴리는 발견되지 않음.

## 요약

`node-output-schema-enrichers.ts`의 5개 enricher를 `cloneSchema`/`collectProps`/
`getOrCreateObjectChild`/`mergeLeafProps`/`enrichByProjecting` 공용 헬퍼로 추출하고
`use-expression-context.ts`의 2곳 if/else dispatch를 `OUTPUT_SCHEMA_ENRICHERS`
레지스트리 lookup으로 교체한 순수 구조 리팩터로, line-by-line 대조 결과 모든
enricher의 전/후 동작(안전 필터·병합 규칙·dev-warn fallback·short-circuit)이 완전히
동등하며 `spec/5-system/5-expression-language.md` §7.2 투영 규칙 표 및
`spec/4-nodes/7-trigger/1-manual-trigger.md` §4/§5.1과도 line-level로 일치한다.
발견된 3건은 모두 INFO(Table dev-warn 문구 미세 변경, registry 타입이
`Partial<Record>`가 아닌 점, plan 체크리스트 미갱신)로 기능적 결함이나 spec
불일치가 아니며 즉시 조치가 필요하지 않다.

## 위험도

NONE

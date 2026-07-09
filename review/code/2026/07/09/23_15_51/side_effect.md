# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** `console.warn` dev-only 부작용 — 기존 패턴과 동일, 신규 위험 아님
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts:826-830` (`enrichManualTriggerOutputSchema` 내부)
  - 상세: `outputNode` 가 없거나 object 가 아닐 때 `process.env.NODE_ENV !== "production"` 가드로 `console.warn` 을 호출한다. `env var 읽기` + `console` 부작용이지만, 동일 파일의 `enrichInfoExtractorOutputSchema`/`enrichFormOutputSchema`/`enrichTableOutputSchema` 가 이미 동일 패턴을 사용 중이며 프로덕션 빌드에서는 비활성화된다. 새 전역 상태나 새로운 env var 를 도입하지 않음.
  - 제안: 조치 불요 (기존 컨벤션 준수 확인 목적의 기록).

- **[INFO]** 새 exported 함수 추가는 순수 additive — 기존 시그니처/인터페이스 영향 없음
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts:797-846` (`enrichManualTriggerOutputSchema` export), `use-expression-context.ts:1272-1276`, `1284-1285`(호출부)
  - 상세: 기존 4개 enricher(`enrichFormOutputSchema` 등)의 시그니처·동작은 변경되지 않았다. `use-expression-context.ts` 의 두 `if/else if` 체인 끝에 `manual_trigger` 분기가 추가됐을 뿐이라, 기존 브랜치(`information_extractor`/`form`/`table`/`transform`)의 조건·순서·동작에는 영향이 없다(상호 배타적 `else if` 체인이라 새 분기 추가가 이전 분기 도달 여부를 바꾸지 않음). `manual_trigger` 타입 노드가 이전에는 raw(미보강) `outputSchema` 를 반환했던 것이 이제 보강된 스키마를 반환하는 의도된 동작 변경이며, 이는 기능 목적 자체이므로 "의도치 않은" 부작용은 아니다.
  - 제안: 조치 불요.

- **[INFO]** 상태 비변경(immutability) — 테스트로 명시적 검증됨
  - 위치: `node-output-schema-enrichers.ts:818-823` (`structuredClone`/`JSON.parse(JSON.stringify(...))` 분기), 대응 테스트 `__tests__/node-output-schema-enrichers.test.ts:707-715` ("does not mutate the base schema")
  - 상세: `baseSchema` 를 직접 변형하지 않고 깊은 복제본(`cloned`)만 변형 후 반환한다. `Object.create(null)` 로 `userProps` 를 생성해 스프레드 병합(`{...existingParamsProps, ...userProps}`) 시 프로토타입 오염 경로를 차단하는 것도 기존 4개 enricher와 동일한 안전장치. 모듈 스코프의 `MANUAL_TRIGGER_TYPE_MAP` 은 런타임에 변경되지 않는 정적 lookup 객체로, 기존 `INFO_EXTRACTOR_TYPE_MAP`/`FORM_FIELD_TYPE_MAP` 과 동일한 위상이며 새로운 가변 전역 상태가 아니다.
  - 제안: 조치 불요.

- **[INFO]** 파일시스템 변경은 코드 외 산출물(plan/spec 문서)에 한정
  - 위치: `plan/in-progress/trigger-param-output-enricher.md`(신규), `spec/5-system/5-expression-language.md`(표 갱신)
  - 상세: 런타임에 파일을 쓰거나 읽는 코드 경로는 추가되지 않았다. 두 문서 변경은 리뷰 대상 diff 자체(정적 파일)이며 실행 중 부작용이 아니다.
  - 제안: 조치 불요.

## 요약

이번 변경은 기존 4개 output-schema enricher(`enrichInfoExtractorOutputSchema`/`enrichFormOutputSchema`/`enrichTableOutputSchema`/`enrichTransformOutputSchema`)와 동일한 "깊은 복제 후 변형, 원본 불변, unsafe 키 차단, dev-only 경고" 패턴을 그대로 재사용해 `enrichManualTriggerOutputSchema` 를 추가한 것으로, 새로운 전역 변수·환경 변수·네트워크 호출·파일시스템 부작용을 도입하지 않는다. `use-expression-context.ts` 의 두 호출부는 기존 `else if` 체인 끝에 배타적 분기를 추가하는 형태라 기존 노드 타입(information_extractor/form/table/transform)의 동작에 영향이 없으며, 기존 함수 시그니처도 전혀 변경되지 않았다(신규 export 만 추가). `manual_trigger` 타입 노드의 autocomplete 스키마가 보강되는 것은 기능의 의도된 목적이지 부작용이 아니다. 테스트(`does not mutate the base schema`)로 비-mutation 도 명시적으로 검증되어 있다.

## 위험도
NONE

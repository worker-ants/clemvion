# 테스트(Testing) 리뷰 — request-body-guard

## 발견사항

- **[WARNING]** `UNVALIDATED_METATYPES` 의 개별 원소 중 `Number` · `Boolean` · `Array` 는 어느 테스트에서도 독립적으로 관측되지 않는다
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:15-21` (배열 정의) · `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:42-47` (`isUnschematized` 가 이 배열을 `.includes` 로 소비) · 대조군은 `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts:91-131` (`BodyFixtureController`)
  - 상세: `request-body-advertised.spec.ts` 의 대조군(`BodyFixtureController`)이 잡는 설계 타입은 `Object`(inline/interface/unknown) 와 `String`(`@Body('a')`)뿐이고, `undefined` 항은 별도 테스트(179-208행)로 커버된다. 그러나 배열의 나머지 원소 `Number` · `Boolean` · `Array` 는 이 파일에도, `validation.pipe.spec.ts` 에도 대응하는 라우트/케이스가 없다. `validation.pipe.spec.ts` 역시 `toValidate`/`UNVALIDATED_METATYPES` 를 클래스 메타타입으로만 exercising 하고 원시 타입 배열의 개별 원소를 직접 찌르지 않는다. plan(`plan/in-progress/request-body-guard.md`)의 뮤턴트 표 G7("파이프 목록에서 `Object` 제거")은 `Object` 하나만 검증했고, `Number`/`Boolean`/`Array` 를 배열에서 빼는 뮤턴트는 시도되지 않았다 — 프로젝트가 이미 겪은 "분기 매트릭스가 완성돼 보여도 배열의 각 항목은 별도 표면" 패턴과 정확히 같은 모양이다. 이 세 항목이 실수로 빠지면 파이프의 검증 스킵 동작과 가드의 위반 판정이 조용히 갈리는데, 두 파일 어느 테스트도 RED 로 잡지 못한다.
  - 제안: `BodyFixtureController` 에 `@Body() _body: number`(또는 `boolean[]`) 같은 자리를 하나 더 추가해 `Number`/`Array` 최소 한 개는 위반 목록에서 직접 관측되게 한다. 완전한 대칭을 원하면 `Boolean` 도 추가하되, 최소한 배열 삭제 뮤턴트가 이 스펙만으로 죽는 원소를 하나 이상 확보하는 것이 목적이다.

- **[INFO]** `scanRequestBodyAdvertised` 의 정렬 1차 키(`controller.localeCompare`)가 실제로 서로 다른 두 컨트롤러 간 위반 순서로 검증되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:101-106` (`violations.sort((a, b) => a.controller.localeCompare(b.controller) || a.handler.localeCompare(b.handler))`) · 검증측 `request-body-advertised.spec.ts:148-157`
  - 상세: 대조군의 위반 4건(`inlineBare` · `interfaceBody` · `keyedBody` · `unknownBody`)이 전부 `BodyFixtureController` 하나에서만 나와, `toStrictEqual` 단언이 실제로 exercising 하는 것은 2차 키(`handler.localeCompare`)뿐이다. `a.controller.localeCompare(b.controller) ||` 를 통째로 제거하는 뮤턴트를 넣어도 이 파일의 어떤 테스트도 실패하지 않는다(실제 코드 스캔 테스트는 빈 배열만 확인하므로 순서를 보지 않는다).
  - 제안: 대조군에 컨트롤러를 하나 더 추가해(예: `interfaceBody`보다 알파벳상 앞서는 이름의 두 번째 컨트롤러에 위반 하나) 1차 키가 실제로 순서를 가르는 케이스를 하나 넣는다. 리포트 가독성용 정렬이라 CRITICAL 은 아니지만, 8/8 뮤턴트 표가 이 축은 다루지 않았다.

- **[INFO]** `bodyArgIndexes` 의 신규 정렬(`.sort((a, b) => a - b)`)이 직접 단위 테스트로 검증되지 않는다
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:174-181`
  - 상세: 이 함수는 이번 diff 에서 `bodyParamDesignType` 내부 로직을 추출하며 정렬을 새로 추가했다. 기존 `swagger-probe.spec.ts`(비변경 파일, `bodyParamDesignType` 을 통해 간접 exercising)는 `@Body()` 가 0개·1개·2개인 경로만 확인하고, 2개인 경우는 즉시 던지므로 정렬된 배열의 순서 자체를 관찰하지 않는다. `request-body-advertised-guard.ts` 도 키 지정 본문을 `keyedBody(@Body('a') _a: string)` 하나만 테스트해 인덱스가 하나뿐이라 정렬 분기가 돌 필요가 없다. 정렬이 뒤바뀌어도(`sort` 제거) `checked`/`unschematized` 카운트나 위반 매핑에는 영향이 없어 보이므로 실질 위험은 낮지만, 새로 추가된 코드 한 줄이 어떤 테스트로도 KILL 되지 않는 상태다.
  - 제안: 낮은 우선순위. 필요시 두 개 이상의 키 지정 `@Body()` 를 가진 라우트를 하나의 컨트롤러에 추가해 `bodyArgIndexes` 반환값이 오름차순인지 직접 단언한다.

- **[INFO]** `designType` 표시 로직이 이름 없는(anonymous) 함수/클래스 케이스를 다루지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:96-98` (`typeof designType === 'function' ? designType.name : '(없음)'`)
  - 상세: `designType.name` 이 빈 문자열인 익명 클래스/함수가 `design:paramtypes` 에 emit 되는 경우(실제 Nest 라우트에서는 거의 발생하지 않음) 위반 메시지가 빈 문자열로 표시된다. 실전 발생 가능성이 낮아 CRITICAL/WARNING 급은 아니라고 판단했다.

## 요약

`request-body-advertised` 가드의 테스트 설계는 전반적으로 견고하다. `beforeAll` 로 실제 `src/modules` 컨트롤러를 스캔하는 통합형 테스트에 `checked > 70`·`unschematized > 0` 형태의 vacuity floor 를 붙여 "위반 0건" 단언이 공허해지는 것을 사전 차단했고, 별도의 순수 fixture 컨트롤러(`BodyFixtureController` 등)로 판정 함수의 각 분기(인라인·인터페이스·`unknown`·키 지정 원시 타입·`@ApiExcludeEndpoint`/`@ApiExcludeController`·설계 타입 미emit)를 명시적으로 가른다. 실제 NestJS 데코레이터와 `Reflect` 메타데이터를 그대로 쓰고 mock/stub 을 전혀 쓰지 않아 프로덕션 동작과의 괴리 위험도 낮다. plan 문서의 뮤턴트 8/8 표가 이를 뒷받침한다. 다만 파이프·가드가 공유하는 `UNVALIDATED_METATYPES` 배열의 원소 중 `Number`·`Boolean`·`Array` 세 개는 어느 테스트에서도 개별적으로 exercising 되지 않아, 이 배열이 실수로 축소되는 회귀를 잡지 못하는 갭이 있다(WARNING). 그 외 정렬 로직(1차 키·`bodyArgIndexes` 신규 정렬) 관련 두 건은 리포트 순서에만 영향을 주는 낮은 우선순위 갭이다. `swagger-probe.ts` 리팩터링(`bodyParamDesignType` → `bodyArgIndexes` 위임)은 기존 `swagger-probe.spec.ts` 의 회귀 테스트(0개/1개/2개 `@Body()` 경로)를 그대로 통과시키는 구조라 회귀 위험은 낮다.

## 위험도

LOW

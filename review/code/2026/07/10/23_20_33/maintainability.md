# 유지보수성(Maintainability) 리뷰 — EIA `getStatus.context` 스키마화

대상: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts`,
`codebase/backend/src/modules/external-interaction/interaction.service.ts` 및 관련 테스트.
Diff base: `origin/main` (a02db4f9a 스펙 + 0302bd7ea 구현).

## 발견사항

- **[WARNING]** `WaitingContextBaseDto`(abstract class, unexported) vs `WaitingContextBase`(exported type) — 접미사 "Dto" 하나 차이의 근접 동명 쌍
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:85` (`abstract class WaitingContextBaseDto`), `:139-149` (`export type WaitingContextBase = Pick<NodeOutputContextDto, ...>`)
  - 상세: 두 심볼은 목적이 다르다 — `WaitingContextBaseDto` 는 `ButtonsContextDto`/`NodeOutputContextDto` 가 상속하는 Swagger 데코레이터 보유 클래스(런타임 OpenAPI 메타데이터 담당)이고, `WaitingContextBase` 는 `interaction.service.ts` 조립부의 TS-widening 방지용 순수 타입 레벨 헬퍼(런타임에 아무 존재감 없음)다. 이름이 "Base"/"BaseDto" 로만 갈리기 때문에 IDE 자동완성·grep·"go to definition" 시 둘을 혼동하기 쉽고, `interaction.service.ts` 상단 import(`type WaitingContextBase`) 만 보면 그것이 `responses.dto.ts` 의 `WaitingContextBaseDto` 를 가리키는 것으로 오인하기 쉽다.
    이 프로젝트의 기존 관례(예: `common/dto/pagination.dto.ts` 의 `export class PaginationQueryDto`, 이를 `extends` 하는 8개 이상의 Query DTO)는 "공유 베이스는 그냥 export 해서 직접 쓴다" 는 단순한 패턴이다. 이번 PR 은 그 대신 "베이스는 숨기고, 같은 필드셋을 별도 이름의 `Pick<>` 타입으로 다시 노출" 하는 새로운 패턴을 도입했는데, 이 우회가 필요한 이유(예: 데코레이터 메타데이터를 타입 레벨에서 감추기 위함 등)가 코드 어디에도 설명돼 있지 않다. 실제로 `abstract class` 를 export 하는 데는 TS 상 아무 문제가 없다(구조적 타이핑이라 객체 리터럴 대입에 `new` 불필요) — 즉 이 이중 구조 자체가 불필요한 간접 계층일 가능성이 있다.
    부가로, `WaitingContextBase` 는 논리적 부모인 `WaitingContextBaseDto` 대신 형제 서브클래스 `NodeOutputContextDto` 에서 `Pick` 한다(`WaitingContextBaseDto` 가 export 되지 않아 어쩔 수 없이 우회한 것으로 보임). 오늘은 `NodeOutputContextDto` 가 3개 필드를 override 하지 않아 결과가 동일하지만, 왜 `ButtonsContextDto` 나 베이스 클래스가 아니라 `NodeOutputContextDto` 를 pick 소스로 골랐는지는 주석에 없다 — 향후 두 variant 중 하나가 이 필드를 override 하면 `base` 의 타입이 실제로는 반대편 variant 와 안 맞을 수도 있는데, 그 위험이 코드로는 전혀 드러나지 않는다.
  - 제안: `WaitingContextBaseDto` 를 `export` 하고 `interaction.service.ts` 의 `const base: WaitingContextBaseDto = {...}` 로 바로 쓰는 방식으로 `WaitingContextBase` 타입 alias 자체를 제거한다(가장 단순, 기존 `PaginationQueryDto` 관례와도 일치). 굳이 두 심볼을 유지해야 할 이유가 있다면, 접미사만 다른 이름 대신 어휘 자체가 다른 이름을 쓴다 — 예: `WaitingContextEnvelopeFields` 또는 `WaitingContextCommonFields`.

- **[INFO]** `const base: WaitingContextBase` 명시 annotate 이유 — 설명 위치는 적절, 다만 미묘하게 redundant
  - 위치: `interaction.service.ts:306`(호출부 인라인 주석) / `responses.dto.ts:140-144`(타입 JSDoc)
  - 상세: object spread 가 `interactionType` 리터럴을 넓힌다는 설명이 호출부(짧은 한 줄)와 타입 선언부(전체 문단) 양쪽에 있어, 어느 쪽을 먼저 보든 이유를 찾을 수 있다 — discoverability 자체는 양호하다. 추가로 `context` 변수가 `ExecutionStatusDto['context']` 로 미리 타입 고정돼 있어(`interaction.service.ts:259`), 이 annotation 을 실수로 지워도 TS 컴파일 에러로 즉시 드러난다(런타임 버그가 아니라 컴파일 타임 가드) — 이 안전망은 주석에 언급되지 않지만 실질적으로 "왜 걱정 안 해도 되는지"를 보강하는 사실이라 짧게 한 줄 덧붙이면(`annotation 을 지워도 컴파일 에러로 드러난다` 정도) 향후 리팩터러가 더 자신 있게 건드릴 수 있다. 필수는 아님.

- **[INFO]** ternary 재구성(`getStatus`) — 원래 if/else-if 대비 가독성 트레이드오프
  - 위치: `interaction.service.ts:303-324`
  - 상세: 기존 if/else-if 를 `if (interactionType) { const base = ...; context = cond ? {...} : {...}; }` 로 바꾸며 (a) `base` 조립을 `interactionType` guard 안으로 옮겨 불필요한 생성을 없애고 else-if 의 중복 `interactionType` 재확인을 제거했다(복잡도 관점에서는 개선). 반면 (b) 중첩 깊이는 `WAITING_FOR_INPUT → nodeExec?.node → interactionType` 3단으로 한 단 늘었고, ternary false-branch 는 코드 1줄(`{ ...base, nodeOutput: out }`)에 리딩 주석이 4줄이라 코드:주석 비율이 매우 비대칭이다. 이 파일에 `llm.service.ts:174` 와 동일한 "주석-후-`?`/`:`" 포매팅 선례가 있어 코드베이스에서 완전히 낯선 패턴은 아니지만, 이 지점은 문서 프롬프트가 지목한 대로 "판별자 미사용" 결정의 핵심(crux)이라 가장 잘 읽혀야 하는 자리다. 짧고 대칭적인 두 branch 에는 ternary 가 적합하지만, 지금처럼 한쪽 branch 에 설계 결정 전체를 설명하는 문단급 주석이 붙는 경우는 if/else 블록(주석이 블록 내부 자체 줄에 위치, `?`/`:` 연산자와 뒤섞이지 않음)이 시각적으로 더 스캔하기 쉽다.
  - 제안: 이 특정 분기만 if/else 로 되돌리는 것을 고려(다른 이점은 `if (interactionType) {}` guard 로 이미 확보됨). 유지한다면 최소한 false-branch 의 4줄 주석 중 앞 2줄(구현 설명)을 `NodeOutputContextDto` 클래스 JSDoc 으로 옮기고, ternary 옆에는 fallthrough 한 줄만 남겨 code:comment 비율을 완화할 수 있다.

- **[INFO]** buttons→nodeOutput fallthrough 문서화는 discoverable 하나 6곳 분산 — 드리프트 리스크
  - 위치: `responses.dto.ts:86`(`WaitingContextBaseDto.interactionType` 필드), `:124-126`(`NodeOutputContextDto` 클래스 JSDoc), `:192-197`(`ExecutionStatusDto.context` 필드), `interaction.service.ts:319-322`(ternary else 주석), `interaction.service.spec.ts:428-448`(단위 테스트), `responses.dto.spec.ts:109-116`(OpenAPI 스키마 회귀 테스트)
  - 상세: "판별자 없는 이유 = buttons 가 buttonConfig 복원 실패 시 nodeOutput 변형으로 fallthrough" 라는 동일 불변식이 최소 6곳에서 서로 다른 표현으로 반복 서술된다. 실제 코드가 있는 지점(ternary)과 테스트 2건이 이 서술을 회귀로부터 실질적으로 보장하지만, 나머지 4곳(클래스/필드 JSDoc)은 prose 뿐이라 향후 이 fallthrough 조건이 바뀌어도(예: buttonConfig 복원 로직이 개선돼 fallthrough 가 사라지는 경우) 테스트 2건만 고치고 JSDoc 4곳은 stale 로 남을 위험이 있다. discoverability 관점에서는 매우 우수하지만(어느 파일을 먼저 열어도 근거를 찾음), 향후 변경 시 동기화 부담이 있다는 점은 인지해 둘 만하다. 차단 사유는 아님.

- **[INFO]** `getStatus` 메서드 길이·중첩 — 이번 diff 로 소폭 증가, 기존부터 큰 편
  - 위치: `interaction.service.ts:242-356` (약 115줄), 그 중 WAITING_FOR_INPUT 분기(`:260-326`)만 약 66줄
  - 상세: 이 메서드는 diff 이전에도 이미 길었고(존재/상태 확인 → currentNode/context 재구성 → result/error 매핑까지 한 함수), 이번 변경은 `CurrentNodeDto` 타이핑과 `WaitingContextBase` 도입으로 순 증가분은 크지 않다. 다만 방금 지적한 대로 중첩이 한 단 더 깊어졌고, 메서드 하나가 "waiting 표면 재구성" 이라는 별도 책임을 계속 흡수하고 있다. 당장 문제는 아니나 다음에 이 영역을 건드릴 때는 `buildWaitingContext(execution, ctx): { currentNode, context }` 형태의 private 헬퍼로 분리해 `getStatus` 를 얇게 유지하는 편이 좋다.
  - 제안: 이번 PR 범위에서 강제할 필요는 없음(기회비용 대비 낮은 우선순위). 다음 관련 변경 시 리팩터 후보로 기록.

- **[INFO]** 그 외 diff(테스트 파일 2건, `CurrentNodeDto`/`ButtonsContextDto`/`NodeOutputContextDto` 신설, `eia-types.ts` 타입 정정)는 기존 코드베이스 컨벤션(spec 절 인용 JSDoc, `@ApiExtraModels`/`getSchemaPath` 패턴, `it.each` 테스트 구조, 한국어 주석 톤)과 잘 일치한다. 매직 넘버·중복 코드·과도한 순환 복잡도는 발견되지 않았다.

## 요약

핵심 설계 결정(판별자 없는 `oneOf` + buttons→nodeOutput fallthrough)은 코드·JSDoc·테스트 전방위에 걸쳐 이례적일 만큼 잘 문서화돼 있고, `const base: WaitingContextBase` annotation 의 필요성도 호출부·타입 선언부 양쪽에서 확인 가능해 discoverability 자체는 양호하다. 다만 `WaitingContextBaseDto`(abstract class) 와 `WaitingContextBase`(Pick 타입)라는 접미사 하나 차이의 근접 동명 쌍은 실질적인 혼동 리스크이며, 기존 코드베이스의 "공유 베이스 DTO 는 그냥 export"(`PaginationQueryDto`) 관례에서 벗어난 새 패턴이라 별도 설명 없이는 왜 이렇게 이중화됐는지 이해하기 어렵다 — 베이스 클래스를 직접 export 해 타입 alias 를 없애는 쪽이 더 간단하고 일관적이다. `getStatus` 의 ternary 재구성은 복잡도 면에서는 중립~소폭 개선이지만 fallthrough 근거를 담은 false-branch 의 코드:주석 비율이 비대칭이라 "가장 잘 읽혀야 할 자리" 치고는 스캔하기 약간 불편하다. 두 지적 모두 차단급은 아니며, 나머지 변경분은 가독성·네이밍·일관성 면에서 코드베이스 표준을 잘 따른다.

## 위험도

LOW

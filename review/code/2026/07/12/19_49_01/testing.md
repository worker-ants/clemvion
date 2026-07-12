# 테스트(Testing) 리뷰 — EIA 응답 DTO `status` 리터럴 유니온 SoT 통합

## 발견사항

- **[WARNING]** 신규 SoT(`EXECUTION_STATUS_VALUES`)의 실제 값 내용을 검증하는 테스트가 없다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts` (assertion 부재), `execution-status.literal.ts`
  - 상세: `execution-status-response.dto.spec.ts` 는 `context`/`currentNode`/`result`/`error` 등 여러 필드의 OpenAPI 스키마를 꼼꼼히 assert 하지만, 정작 이번 diff 가 직접 건드린 `status` 필드의 `enum` 배열 내용은 리팩터 전에도 후에도 한 번도 검증하지 않는다(`executionStatus.properties?.status` 를 참조하는 테스트가 0건). 게다가 엔티티→DTO 경계인 `interaction.service.ts:379` 의 `status: execution.status as ExecutionStatusDto['status']` 는 명시적 `as` 캐스트라 컴파일타임 타입체커도 이 경계에서 값 일치를 강제하지 못한다. 즉 `EXECUTION_STATUS_VALUES` 배열에 오타(`'compelted'` 등)나 순서 실수가 생겨도 — 이 SoT 통합이 막으려던 바로 그 종류의 drift — 어떤 자동 테스트도 잡지 못한다. 순수 리팩터라 당장 회귀는 아니지만, "SoT 로 drift 를 막는다" 는 본 변경의 목적을 실제로 검증하는 유일한 안전망이 될 좋은 기회를 놓쳤다.
  - 제안: `execution-status-response.dto.spec.ts` 에 `expect(status.enum).toEqual([...EXECUTION_STATUS_VALUES])` 한 줄 추가. 나아가 `new Set(EXECUTION_STATUS_VALUES)` 와 `new Set(Object.values(ExecutionStatus))`(엔티티) 의 집합 동등성(순서 무관) 테스트를 추가하면 엔티티↔DTO 값 누락/추가 drift 까지 잡을 수 있다(문서화된 DTO↔엔티티 결합 회피 원칙은 런타임 import 없이 test-only 비교로 지킬 수 있음).

- **[WARNING]** `InteractAckDto` 는 OpenAPI 스키마 회귀 테스트 파일 자체가 없다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.ts` (대응 `.spec.ts` 부재 — `git log --all` 확인 결과 과거에도 존재한 적 없음)
  - 상세: `ExecutionStatusDto` 는 `execution-status-response.dto.spec.ts` 로 실제 `SwaggerModule.createDocument()` 를 생성해 스키마를 회귀 검증하는 반면, `InteractAckDto` 는 동형의 검증이 전혀 없다. 이번 diff 는 정확히 `currentStatus` 필드의 타입/enum 선언 방식을 바꿨는데(`enum: [...EXECUTION_STATUS_VALUES]`, `currentStatus?: ExecutionStatusLiteral`), 그 산출물(OpenAPI 문서상 enum 배열, description 등)을 검증하는 테스트가 없어 이 필드의 wire 계약은 `interaction.controller.spec.ts`/`interaction.service.spec.ts` 의 간접적 문자열 assertion(`currentStatus: 'cancelled'` 등)에만 의존한다 — 이는 서비스 반환값 검증이지 OpenAPI 스키마 검증이 아니다. Pre-existing 갭이지만, 이 필드를 직접 리팩터링한 시점이 보강하기 가장 좋은 타이밍이다.
  - 제안: `execution-status-response.dto.spec.ts` 와 동일 패턴(스텁 컨트롤러 + `SwaggerModule.createDocument`)으로 `InteractAckDto` 최소 스키마 회귀 테스트를 추가하거나, 기존 파일에 두 번째 `describe` 블록으로 합류.

- **[INFO]** 회귀 확인: 기존 15개 스키마 회귀 테스트는 리팩터 후에도 green
  - 위치: `execution-status-response.dto.spec.ts`
  - 상세: `npx jest src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts` 실행 결과 `15 passed, 15 total` — 커밋 메시지의 "DTO 스키마 회귀 15건 green" 주장과 일치. 순수 타입/enum 소스 교체이며 런타임 산출 스키마는 동일하게 유지됨을 실측 확인.

- **[INFO]** 신규 파일 `execution-status.literal.ts` 자체에 대한 단위 테스트는 불필요
  - 상세: 로직 없는 순수 상수 배열 + 파생 타입 선언이라, 소비 지점(두 DTO 의 OpenAPI `enum`)을 통한 간접 검증으로 충분하다. 다만 그 간접 검증이 현재 존재하지 않는다는 것이 위 WARNING 2건의 핵심이다.

- **[INFO]** Mock/격리/가독성 관점 — 해당 없음
  - 상세: 본 diff 는 테스트 코드를 전혀 변경하지 않았다(신규 `.spec.ts` 없음, 기존 파일 무변경). 기존 테스트의 mock 구성·격리·가독성은 그대로이며 이번 변경으로 영향받지 않는다.

## 요약

`ExecutionStatusDto.status` / `InteractAckDto.currentStatus` 를 공유 SoT(`execution-status.literal.ts`)로 통합한 behavior-preserving 리팩터로, 기존 15건 OpenAPI 스키마 회귀 테스트가 변경 후에도 green(직접 실행 확인)이라 회귀 관점에서는 안전하다. 다만 이 리팩터가 막으려는 "여러 곳에 중복 선언된 enum 이 미래에 따로 놀 위험"을 정작 테스트로 검증하는 지점 — `status`/`currentStatus` 필드의 OpenAPI `enum` 배열 내용 자체에 대한 assertion, 그리고 엔티티 `ExecutionStatus` 와의 값 집합 동등성 — 이 하나도 추가되지 않았다. 더구나 엔티티→DTO 경계(`interaction.service.ts:379`)가 `as` 캐스트로 컴파일타임 체크를 우회하고 있어, 테스트가 유일한 안전망인데 그 자리가 비어 있다. `InteractAckDto` 는 애초에 OpenAPI 스키마 회귀 테스트 파일 자체가 없어 이번에 바뀐 `currentStatus` 필드도 무검증 상태로 남는다. 둘 다 소규모 추가로 해소 가능한 갭이라 즉시 차단 사유는 아니다.

## 위험도
LOW

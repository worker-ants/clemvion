# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 마스킹 적용 지점에서 `Record<string, unknown> | null` → `Record<string, unknown>` 로 타입을 강제 캐스트해 null 가능성을 숨긴다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:922-928` (`toResponseExecution`), 같은 파일 `:603-611` (`findById` 내 `nodeExecutions` map)
  - 상세: `redactStoredErrorForResponse`(`codebase/backend/src/shared/utils/redact-stored-error.ts:57-64`)는 `Record<string, unknown> | null` 을 반환한다(입력이 `null`/`undefined` 면 `null`). 그런데 `toResponseExecution` 은 `{ ...rest, error: redactStoredErrorForResponse(rest.error) } as Execution` 으로, `findById` 는 `{ ...ne, error: redactStoredErrorForResponse(ne.error) } as NodeExecution` 으로 결과를 강제 캐스트한다. `Execution.error`/`NodeExecution.error` 엔티티 필드는 둘 다 `Record<string, unknown>` 으로 선언돼 있고 `| null` 이 없다(`entities/execution.entity.ts`, `entities/node-execution.entity.ts`). 즉 이 함수가 실제로 반환할 수 있는 `null` 케이스가 타입 단언 뒤로 조용히 사라진다. `stop`/`findById`/`getChain` 의 반환 타입이 모두 이 엔티티 타입을 그대로 쓰므로("`Execution` 이면 `error` 는 항상 객체"), 이후 이 메서드들의 결과를 다루는 코드가 늘어나면 `.error` 를 null-check 없이 접근하는 코드가 컴파일러 경고 없이 들어갈 수 있다. 현재는 컨트롤러가 값을 그대로 JSON 직렬화만 하므로 런타임 영향은 없지만, 새 함수가 도입한 정직한 `| null` 반환 타입을 캐스트 한 자리에서 지워버리는 것은 타입 시스템이 앞으로의 회귀(다른 "자매 표면" 사고)를 잡아줄 기회를 스스로 줄이는 셈이다.
  - 제안: `Execution`/`NodeExecution` 엔티티 타입을 바꾸는 대신, 이 두 지점의 반환 타입을 `Omit<Execution, 'error'> & { error: Record<string, unknown> | null }` 같은 명시적 타입으로 좁히거나, `ExecutionDetailWithTrigger`/`getChain` 반환 타입 자체를 `error: ... | null` 을 인정하는 별도 타입으로 선언해 `as Execution` 무단 단언을 제거하는 편이 안전하다. 최소한 캐스트 옆에 "왜 null 가능성을 무시해도 되는지"에 대한 근거 주석을 남기는 편이 좋다(현재 주석은 캐스트를 한 자리에 모으는 이유만 설명하고, null 로 좁혀지는 문제 자체는 언급하지 않는다).

- **[INFO]** 같은 목적의 mock QueryBuilder 헬퍼 `buildSingleQB` 가 한 파일 안에서 문자 그대로 두 번 정의된다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` — `describe('findById → execution_node_log 기반 executionPath 채움', ...)` 안의 `buildSingleQB`(파일 396~404행)와, 이번 PR 이 새로 추가한 `describe('Execution.error 응답 마스킹 — 표면 전수', ...)` 안의 `buildSingleQB`(파일 861~869행)가 `leftJoinAndSelect`/`leftJoin`/`addSelect`/`where`/`getOne` mock 체인까지 완전히 동일하다.
  - 상세: 이 저장소는 "자매 표면마다 독립적으로 방어 테스트를 두는" 것을 의도적 관행으로 삼고 있어(각 표면이 별도 unit 으로 회귀를 잡아야 한다는 문서화된 원칙), 표면별 `it` 블록이 반복되는 것 자체는 설계 의도에 맞다. 다만 이번에 새로 추가된 `buildSingleQB` 는 새로운 테스트 로직이 아니라 **같은 파일에 이미 존재하는 헬퍼 함수의 완전한 복제**이고, 표면 간 독립성과는 무관하다 — 헬퍼를 outer `describe`(또는 파일 최상위)로 끌어올려 두 블록이 공유해도 "한 표면이 빠지면 전체가 깨진다"는 방어 목적은 그대로 보존된다.
  - 제안: 두 `buildSingleQB` 중 하나를 지우고 파일 상단(다른 공용 헬퍼 `buildListQB`/`baseFake` 근처)으로 끌어올려 공유한다.

- **[INFO]** `findById` 의 `nodeExecutions` 재구성 체인이 메서드 체이닝 도중에 괄호로 끊겨 가독성이 떨어진다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:603-611`
  - 상세: `reconcilePreParkWaitingStatus(nodeExecutions).map((ne) => ({...}) as NodeExecution)` 를 한 표현식으로 이어 쓰면서, prettier 개행이 `reconcilePreParkWaitingStatus(\n  nodeExecutions,\n).map(\n  (ne) =>\n    ({...}) as NodeExecution,\n)` 형태로 쪼개져 호출 대상과 인자, 콜백 본문이 서로 다른 줄에 흩어진다. 한 표현식 안에 "정규화 → 마스킹" 두 단계가 압축돼 있어 각 단계가 무엇을 하는지 한눈에 들어오지 않는다.
  - 제안: `const reconciled = reconcilePreParkWaitingStatus(nodeExecutions);` 로 중간 변수를 만들고 `.map(...)` 을 별도 문으로 분리하면, 두 단계(전처리/마스킹)가 시각적으로도 분리돼 바로 위 주석("`NodeExecution.error` 도 같이 마스킹한다…")이 가리키는 지점이 더 명확해진다. 사소한 스타일 이슈라 필수는 아니다.

## 요약

이번 변경의 핵심 산출물인 `redactStoredErrorForResponse`(신규 leaf util)는 함수 자체가 8줄 남짓으로 매우 짧고, 단일 책임(egress 마스킹, 형태 보존)을 명확히 지키며, 이름도 기존 자매 유틸 `toTerminalErrorPayload`/`ExecutionError` 예외 클래스와 혼동되지 않도록 의도적으로 골라졌다. 4개 호출부(`background-runs.service.ts`, `executions.service.ts` 의 `findById`/`toExecutionDto`/`toResponseExecution`)가 전부 이 한 함수를 통해 마스킹을 걸어 "자매 표면 중 하나만 놓친다"는 이 저장소의 반복 결함 패턴을 구조적으로 막았고, `stop`/`stopInternal` 분리(공개 wrapper 가 유일한 마스킹 관문, private 본체는 마스킹 이전 값 반환)도 같은 목적의 깔끔한 리팩터다. 함수 길이·중첩 깊이·매직 넘버 측면에서 새로 추가된 코드에 문제는 없다. 다만 (1) 새 헬퍼가 반환하는 정직한 `| null` 타입이 두 호출부에서 엔티티 타입으로의 강제 캐스트에 묻혀 버리는 타입 안전성 저하가 하나 있고, (2) 새 테스트 파일에 이미 존재하는 헬퍼 함수를 그대로 복제한 자리가 하나 있다. 문서(주석·JSDoc)는 이 저장소의 기존 스타일대로 매우 상세하지만 기존 파일들(`terminal-error-payload.ts` 등)과 밀도가 일관돼 새로운 문제는 아니다. plan/spec/review 아카이브 파일들은 링크 경로 정정과 상태 갱신 위주의 기계적 변경으로 유지보수성 관점에서 특기할 사항이 없다.

## 위험도

LOW

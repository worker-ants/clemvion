# 유지보수성 코드 리뷰 — getStatus() 2단계 컬럼 projection

- diff base: `origin/main`
- 대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()`), `interaction.service.spec.ts`

## 발견사항

- **[WARNING]** projection 컬럼 목록이 인라인 리터럴 — SoT 이중화 + 침묵 회귀 위험
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:253-260`
  - 상세: 1단계 `select: ['id','status','workflowId','startedAt','finishedAt','outputData']` 가 함수 내부에 하드코딩되어 있다. 이 리스트는 (a) DTO 조립 코드(`execution.workflowId`, `execution.finishedAt ?? execution.startedAt`, `execution.outputData` 등)와, (b) 테스트의 `BASE_COLUMNS`(`interaction.service.spec.ts:754-761`) 두 곳과 암묵적으로 동기화되어야 하는 3중 SoT다. 향후 `ExecutionStatusDto` 에 필드를 추가하면서(예: `retryCount`, `triggerId` 등) 이 `select` 갱신을 빠뜨리면 `execution.<field>` 는 `undefined` 가 되고, 특히 `startedAt`/`finishedAt` 류는 `updatedAt` fallback 체인(`finishedAt ?? startedAt ?? new Date()`)처럼 **조용히 다른 값으로 대체**돼 런타임 예외 없이 스펙 위반 응답이 나갈 수 있다. plan 문서(`plan/in-progress/eia-getstatus-column-projection.md` W2)가 이미 이 정확한 리스크를 인지하고 전용 테스트(`updatedAt — finishedAt 우선, 없으면 startedAt 의 실값`)로 가드했지만, 그 가드는 "이번 PR 이 만든 6개 컬럼이 계속 select 에 남아있는지" 만 검증하며, **미래에 새 필드가 추가되는데 select 갱신을 잊는 케이스**는 여전히 안 잡는다(구현·테스트 리터럴이 서로 독립적으로 두 번 타이핑돼 있을 뿐 어느 쪽도 다른 쪽에서 파생되지 않음).
  - 파일 내 기존 관행과의 비교: 같은 파일의 다른 3개 `select` 호출부(`interact` refresh:156, `refreshToken`:209, `loadAndAssertAlive`:386)는 모두 `['id','status']` 2컬럼짜리 소규모 인라인이라 이런 위험이 사실상 없다. 코드베이스 전역(`chat-channel.dispatcher.ts`, `nodes.service.ts`, `notification-fanout.service.ts` 등 8개 파일)도 전부 인라인 리터럴이 관행이며, 명명 상수/`satisfies (keyof X)[]` 선례는 어디에도 없다.
  - **권고 (명확화)**: 코드베이스 전역 관행(인라인)과의 일관성을 이유로 이 자체를 강제 리팩터링할 필요는 없다고 판단한다. 다만 이 지점은 (1) 파일 상단에 `TERMINAL_STATUSES`/`SSE_SEQ_PLACEHOLDER` 모듈 상수 선례가 **이미 이 파일 안에 존재**하고, (2) 컬럼 수가 6개로 이 파일의 다른 select 보다 3배 많으며, (3) `updatedAt` fallback 체인이라는 침묵 회귀 특유 위험까지 겹친다는 점에서 로컬 예외로 상수화할 가치가 있다. 예:
    ```ts
    const STATUS_PROJECTION_COLUMNS = [
      'id', 'status', 'workflowId', 'startedAt', 'finishedAt', 'outputData',
    ] as const satisfies readonly (keyof Execution)[];
    ```
    이렇게 하면 (a) 컬럼명 오탈자를 컴파일타임에 잡고, (b) 테스트가 `import` 해 `toEqual(STATUS_PROJECTION_COLUMNS)` 로 진짜 단일 SoT 를 만들 수 있다(아래 6번 참고). 강제 사항은 아니며, 파일 내 다른 3개 소규모 select 는 지금처럼 인라인 유지가 맞다(과잉 일반화 지양).

- **[WARNING]** 테스트 `BASE_COLUMNS`(`interaction.service.spec.ts:754-761`) 가 구현 리터럴을 독립적으로 재복제 — 결합이 "형식적"
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:748-773`
  - 상세: `selectOf()` 헬퍼와 `BASE_COLUMNS` 는 구현부 select 배열을 그대로 다시 타이핑한 것이다. 두 리스트가 우연히든 의도적으로든 동기화되지 않으면(예: 구현에서 컬럼을 지우면서 테스트 상수도 실수로 똑같이 지우는 복붙 오류) 테스트가 green 인 채로 실제 회귀를 놓칠 수 있다. 근본 원인은 위 1번과 동일 — "새 필드 사용 시 select 도 늘려야 한다"는 규율이 사람의 기억에만 의존한다.
  - 제안: 1번 권고(모듈 상수 승격)를 채택하면 테스트가 그 상수를 import 해 `toEqual`로 비교하는 것으로 자연스럽게 해소된다. 다만 현재처럼 `expect.arrayContaining(BASE_COLUMNS)` (완전 일치가 아닌 부분집합 검증) 방식은 "구현이 여분 컬럼을 추가하거나 순서를 바꿔도 테스트가 깨지지 않는" black-box 이점도 있어 나름의 합리성은 있다 — 채택 여부는 트레이드오프 선택의 문제이며 필수는 아니다.

- **[INFO]** 컬럼별 trailing 주석(`// updatedAt fallback`, `// updatedAt 우선값`) — 이 diff 에서 처음 등장하는 스타일, 순서가 살짝 헷갈릴 수 있음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:257-259`
  - 상세: 배열 항목별 trailing comment 는 파일 내 다른 select 호출부에도, grep 한 코드베이스 전역 다른 7개 select 호출부에도 선례가 없다 — 이번 diff 가 도입한 새 관행이다. 내용 자체는 각 컬럼이 어떤 응답 필드로 소비되는지 명시해 위 1번 리스크를 완화하는 유용한 문서화라 판단한다(노이즈로 보기 어려움). 다만 실제 fallback 우선순위는 `execution.finishedAt ?? execution.startedAt ?? new Date()` (`finishedAt` 이 우선)인데, 배열에는 `startedAt` 이 먼저 나오고 그 옆에 "fallback" 주석이 붙어 있어, 위→아래로 읽으면 "fallback 이 먼저, 우선값이 나중"으로 보여 순간적으로 우선순위를 헷갈릴 여지가 있다.
  - 제안: 급하지 않은 사소한 개선. 컬럼 순서를 `finishedAt, startedAt`(실제 우선순위 순)으로 바꾸거나, 주석을 한쪽에만 `// finishedAt 없을 때 이 컬럼으로 updatedAt fallback` 처럼 순서 독립적인 단일 문장으로 통합하면 더 명확해진다.

- **[INFO]** 주석 밀도 — JSDoc·1단계 인라인·2단계 인라인 세 곳에서 "2단계 조회" 취지가 부분 중복 서술
  - 위치: `interaction.service.ts:238-240`(JSDoc) / `246-250`(1단계 인라인) / `277-280`(2단계 인라인)
  - 상세: JSDoc 요약(238-240)이 이미 "얇은 projection + waiting 시에만 재조회 + 수 MB 컬럼"을 언급하는데, 바로 아래 함수 본문(246-250)이 "500 turn × 4000자(conversation-thread §4) · 수 MB" 를 다시 구체 수치로 재서술한다. 두 곳이 사실상 같은 rationale 을 설명하며, 향후 규모 상한(500 turn/4000자)이 바뀌면 두 곳 모두 갱신해야 하는 부담이 생긴다. 다만 이 파일은 diff 이전부터 이미 spec 근거를 여러 위치(JSDoc + 본문)에 유사하게 반복 서술하는 관행을 갖고 있어(예: durable park 스냅샷 설명이 225-243 JSDoc 과 271-273 본문에 유사 반복), **이 diff 는 기존 스타일의 연장이지 새로운 이탈이 아니다**. 프로젝트가 spec 참조 주석을 중시하는 관행(CLAUDE.md·developer SKILL) 과도 맞다.
  - 제안: 급하지 않음. 굳이 다듬는다면 "500 turn × 4000자" 같은 구체 수치는 `conversation-thread §4` spec 문서 한 곳에만 두고 코드 주석에서는 참조만 남기는 방향도 고려할 수 있으나(수치 변경 시 코드 동기화 부담 축소), 현재 밀도는 이 파일 기준 노이즈로 보기 어렵다 — 유지 권고.

- **[INFO]** `getStatus()` 함수 길이/구조 — 추출 필요성 낮음(YAGNI)
  - 위치: `interaction.service.ts:245-381` (137 lines, 주석/공백 포함 — 실질 코드는 약 70~80 lines)
  - 상세: 이번 diff 로 2단계 조회(`Promise.all` 병렬 fetch)가 추가되며 함수가 다소 길어졌다. 그러나 diff 는 기존에 이미 `if (execution.status === WAITING_FOR_INPUT)` 분기 안에 있던 순차 코드(conversationThread 계산 → nodeExec 조회)를 병렬화 + select 좁히기로 바꾼 것뿐이며, **중첩 깊이·분기 수는 늘지 않았다**(if(waiting) → if(nodeExec?.node) → interactionType 3-way 분기는 diff 이전과 동일 구조).
  - 제안: `loadWaitingSurface()` 같은 private 메서드 추출은 가독성에 도움될 수 있으나, 이번 diff 범위에서 강제할 필요는 없다. 향후 이 분기에 세 번째 조회 단계 등이 추가돼 복잡도가 실질적으로 늘어난다면 그때 추출을 고려하는 것을 권고(현시점 추출은 YAGNI).

- **[INFO]** 변수명 `threadRow` / `execution` / `nodeExec` — 명확함, 문제 없음
  - 위치: `interaction.service.ts:251, 281-294`
  - 상세: `threadRow` 는 "얇은 partial row(사실상 `id`+`conversationThread` 만)" 임을 이름으로 암시해, 1단계 base projection 결과인 `execution` 과 성격이 다름을 잘 구분한다. `nodeExec` 도 파일 전역에서 일관되게 쓰이는 이름(다른 메서드에서도 유사 패턴 없음이나 자기설명적). 개선 제안 없음.

- **[INFO]** `Promise.all` 구조분해 `const [threadRow, nodeExec] = ...` — 가독성 문제 없음
  - 위치: `interaction.service.ts:281-294`
  - 상세: 두 프로미스가 서로 다른 리포지토리(`executionRepository`/`nodeExecutionRepository`) 호출이라는 것이 변수명과 바로 위/옆 주석에서 충분히 드러난다. 배열 위치와 변수명 매핑에 혼동 여지가 낮다(원소 2개, 이름이 이미 의미 구분). 개선 제안 없음.

## 요약

이번 diff 는 `getStatus()` 를 2단계 조회로 전환하면서 기존 로직의 분기/중첩 구조는 그대로 유지한 채 성능 최적화만 추가했고, 리스크가 큰 지점(`updatedAt` fallback 침묵 회귀)은 plan 문서에서 사전에 식별해 전용 테스트로 가드하는 등 유지보수성에 대한 팀의 인지 수준이 높다. 가장 실질적인 잔여 리스크는 6컬럼짜리 `select` 인라인 리터럴이 구현·테스트 두 곳에 독립 SoT 로 존재해 향후 DTO 필드 추가 시 갱신 누락이 재발할 여지가 있다는 점인데, 이는 파일 내 이미 존재하는 모듈 상수 선례(`TERMINAL_STATUSES`, `SSE_SEQ_PLACEHOLDER`)를 따라 이 지점만 국소적으로 상수화하면 저비용으로 해소 가능한 개선이다. 트레일링 주석·상세 rationale 서술은 노이즈라기보다 리스크 완화용 문서화로 판단되며, 코드베이스 기존 스타일(spec 근거 반복 서술, 인라인 select 관행)과도 크게 어긋나지 않는다. 전반적으로 blocking 사유는 없다.

## 위험도

LOW

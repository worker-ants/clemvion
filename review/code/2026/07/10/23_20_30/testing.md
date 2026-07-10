# 테스트(Testing) Review

대상:
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`const llmContext` 에 `LlmCallContext` 명시 타입 주석 + import 추가)
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` (`collection retry loop` 블록에 attribution 회귀 테스트 1건 추가)
- (참고 컨텍스트로 payload 에 포함된 `review/consistency/2026/07/10/22_52_18/*.md` 6개 — impl-prep 단계 consistency-check 산출물. 마크다운 문서이며 실행 코드가 아니므로 테스트 커버리지 관점 검토 대상 아님. 단, mutation 검증 근거로 활용함.)

## 발견사항

- **[INFO]** 커버리지 갭 — collection-retry 2회차 호출에서 "attribution 부재(undefined)의 대칭성"이 미검증
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts:1027` (신규 `it`), `retryState()` 헬퍼(:970-992)
  - 상세: 신규 테스트는 `executionId`/`workflowId`/`nodeExecutionId` 를 **명시 주입**했을 때 1·2회차 `chat` 호출이 동일한 값을 받는지만 검증한다. 반면 `retryState()` 기본값(오버라이드 없음 → `executionId` 부재 → `llmContext` 는 `undefined`)으로 2회 이상 chat 을 태우는 기존 테스트(`routes to error port after exceeding maxCollectionRetries` 등)는 `chat` 호출 인자를 전혀 단언하지 않는다. 즉 "1회차는 정상적으로 `undefined`, 2회차만 실수로 `{}`/부분 객체가 새어 들어간다" 류의 반대 방향 회귀는 어느 테스트도 잡지 못한다. `SUMMARY.md` 의 mutation 검증도 "첫 반복만 `llmContext` 전달·재시도는 강제로 `undefined`" 변조만 시도했고, 그 반대 방향(원래 `undefined`인데 재시도에서 값이 새는 경우)의 변조는 실측되지 않았다.
  - 제안: `retryState()` 기본값(override 없음)으로 2회 이상 chat 을 태우는 케이스에서 `mock.calls[0][2]`/`mock.calls[1][2]` 모두 `undefined` 임을 대칭적으로 확인하는 assertion 을 (기존 `feeds tool_result back and loops...` 테스트에 추가하거나 별도 `it` 로) 보강하면 이번에 메운 갭의 반대쪽 실패 모드까지 대칭 커버된다. 블로킹 사유는 아님 — 실제 프로덕션 리스크는 "attribution 이 누락되는" 방향이 압도적으로 크고 그쪽은 이미 견고히 커버됨.

- **[INFO]** 검증 정밀도 — `objectContaining` 은 초과 필드 유출을 잡지 못함 (기존 저장소 관행과 일치, 낮은 우선순위)
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts:1039-1049` (신규 `it` 내 `expectedContext` 단언)
  - 상세: `expect.objectContaining({...})` 은 부분 매칭이라, `llmContext` 에 향후 리팩터가 의도치 않은 추가 필드를 흘려도(예: `pickResumeIdentificationFields` 류 헬퍼 도입 시) 이 테스트는 여전히 통과한다. 다만 이 패턴은 저장소 전역에서 이미 확립된 관용구(`mock.calls[` 사용 spec 64개 중 43개가 `objectContaining` 병용 — consistency-check `convention-compliance.md` 로 확인됨)이므로 이 PR 만의 결함은 아니다.
  - 제안: 없음(선택적). 필요 시 향후 `toEqual({ workflowId, executionId, nodeExecutionId })` 정확 매칭으로 강화할 수 있으나, 현재 저장소 관행과 어긋나므로 이 변경 범위에서 강제하지 않는다.

- **[INFO]** `ai-turn-executor.ts` 타입 주석 변경은 런타임 동작 무변화 — 신규 unit 테스트 불요, 기존 회귀 테스트로 이미 충분히 검증됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2606-2610` (`const llmContext: LlmCallContext = {...}`)
  - 상세: 순수 컴파일 타임 가드(excess-property check 활성화)라 실행 시 분기/값이 바뀌지 않는다. `ai-turn-executor.spec.ts` 의 기존 tool-loop 2회차 attribution 단언(`does not count condition tools toward toolCalls in multi-turn...`, `mock.calls[1][2]` 단언)이 이미 이 리터럴의 런타임 값(`workflowId`/`executionId`/`nodeExecutionId`)을 검증하고 있고, 이번 변경은 그 값에 영향을 주지 않는다(직접 확인: 코드 diff 는 대입식 좌변에 타입 표기만 추가, 우변 값 표현식은 무변경). Consistency-check `SUMMARY.md` 에 기록된 mutation 검증(오탈자 `nodeExecutionID` 삽입 시 타입 주석 有 → `tsc` 컴파일 에러로 즉시 실패, 無 → 조용히 통과)도 직접 재현 가능한 절차로 기술돼 있어 이 가드의 실효성이 실증됐다. 커버리지 관점에서 결함 없음.
  - 제안: 없음(정보성 확인). 단, 이 타입 주석이 잡는 것은 필드 **오탈자**(구조적 오류)뿐이며 `state.workflowId`/`state.nodeExecutionId` 자체가 리팩터로 사라지는 회귀(옵셔널이라 `undefined` 허용)는 여전히 런타임 회귀 테스트에 의존한다는 점은 기존 rationale-continuity 검토에서도 명시돼 있어 이 리뷰에서 재확인만 함.

- **[INFO]** 테스트 가독성/구조 — 우수
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts:1022-1049`
  - 상세: 신규 테스트는 (a) 왜 필요한지(spec §1.3 참조, `ai-turn-executor.spec.ts` 의 대칭 선례, `retryState()` 기본값의 함정)를 사전 주석으로 명시하고, (b) 인접 테스트(`resume turn passes row PK...`, `:1622` 근방)가 이미 쓴 `exec-attr-1`/`wf-attr-1`/`nodeexec-row-1` 과 겹치지 않게 `-2` 계열 리터럴을 사용해(이전 라운드 naming-collision INFO 를 실제로 반영) grep 가독성을 확보했으며, (c) 정의 id(`node-def-2`)와 row PK(`nodeexec-row-2`)를 의도적으로 다른 값으로 둬 "정의 id 가 row PK 자리에 유입"되는 혼동 자체를 assertion 으로 배제한다. 실제 코드(`information-extractor.handler.ts:1037` `params.llmContext` 고정 캡처, `runTurnWithCollectionRetries` `for (;;)` 루프)와 대조해도 테스트가 검증하려는 불변식과 정확히 일치한다.
  - 제안: 없음.

- **[INFO]** Mock 적절성 / 테스트 격리 — 문제 없음
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` 전체 `beforeEach`(파일 상단), `retryState()` 헬퍼(:970-992)
  - 상세: `mockLlmService` 가 매 테스트마다 새로 생성되고(`chat: jest.fn()...`), `retryState()` 는 매 호출마다 새 객체를 리턴하는 순수 팩토리라 테스트 간 상태 공유·오염이 없다. `mockResolvedValueOnce` 를 2회 체이닝해 1·2회차 응답을 분리한 것도 실제 `traceChat` 순차 호출과 대응해 mock 이 실제 동작을 정확히 모사한다. `handler = new InformationExtractorHandler(mockLlmService as never)` 생성자 주입 구조 덕분에 이런 정밀한 mock 배치가 가능 — 테스트 용이성 관점에서도 코드 구조가 이미 우호적이다.
  - 제안: 없음.

- **[INFO]** 회귀 테스트 유효성 — mutation 검증으로 vacuous-test 아님이 실증됨 (드문 수준의 실증)
  - 위치: `review/consistency/2026/07/10/22_52_18/SUMMARY.md` (payload 참고 컨텍스트)
  - 상세: 구현 후 검증 단계에서 `runTurnWithCollectionRetries` 를 "첫 반복만 `llmContext` 전달, 재시도는 `undefined`" 로 실제 변조해 신규 테스트만 실패하고 기존 `feeds tool_result back and loops...` 는 통과함을 확인했고, `nodeExecutionId`→`nodeExecutionID` 오탈자 주입으로 타입 주석 유무에 따른 `tsc` 결과 차이(대조군 실험)까지 실측했다. 이는 "테스트가 실제로 뭔가를 검증하는가"에 대한 가장 직접적인 증거이며, 이 리뷰가 별도로 재요구할 필요가 없을 만큼 충분하다.
  - 제안: 없음.

## 요약

이번 변경은 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 의 순수 타입 주석(런타임 무영향, 컴파일 타임 오탈자 가드)과 `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` 의 attribution 회귀 테스트 1건 추가로 범위가 매우 좁다. 신규 테스트는 기존 `describe('collection retry loop')` 블록의 헬퍼(`retryState`/`finalizeCall`)를 그대로 재사용해 스타일 일관성을 지키고, `ai-turn-executor.spec.ts` 의 tool-loop 2회차 attribution 단언과 대칭을 이루도록 설계됐으며, 이전 consistency-check 라운드(naming-collision INFO)의 fixture 리터럴 구분 권고까지 반영돼 있다. 실행 후 mutation 검증(루프 attribution 고정 캡처 변조·타입 오탈자 대조군)으로 이 테스트가 실제로 유의미한 회귀를 잡는다는 것이 이미 실측 확인됐다는 점이 특히 눈에 띈다. 유일하게 짚을 만한 갭은 "attribution 이 애초에 `undefined` 인 기본 경로에서 2회차 호출도 여전히 `undefined` 로 유지되는지"의 대칭 검증이 빠져 있다는 점인데, 이는 실제 프로덕션 리스크(값이 누락되는 방향)에 비해 발생 가능성이 낮은 반대 방향 엣지 케이스라 비차단 INFO 로만 기록한다. Mock 사용·테스트 격리·가독성·회귀 유효성 모두 양호하며 Critical/Warning 급 결함은 없다.

## 위험도

LOW

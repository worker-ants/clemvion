# 아키텍처(Architecture) Review

대상: AI 노드 실패 시 대화 이력 도달 불가(Inv-8) 수정 diff — `conversation-inspector.tsx`, `result-detail.tsx`, `output-shape.ts`, `use-execution-events.ts` 외 fixture/테스트.
중점 검토 요청: (a) `conversation-inspector.tsx`의 인라인 재파싱 잔존이 옳은지, (b) 그 결과 컴포넌트가 데이터 변환 책임을 여전히 갖는 게 타당한지, (c) `result-detail.tsx`의 `hasLiveSystemError` 기반 소스 선택 위치가 적절한지.

## 발견사항

- **[WARNING]** 인라인 재파싱이 "죽은 채로" 물리적으로 잔존 — spec §9.11 3-함수 계약을 우회로만 지키는 구조
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:862-928` (`SummaryView` 내 `items` `useMemo`)
  - 상세: `if (conversationMessages.length > 0) return conversationMessages;` guard를 추가한 것은 옳은 방향이지만, 그 아래 55줄의 인라인 재파싱(turnCounter 수동 관리, `callNameById` 맵, RAG 문자열 감지 등)은 현재 유일한 두 호출 경로(`result-detail.tsx`) 기준으로 **도달 불가능한 코드**다.
    - `result-detail.tsx`가 넘기는 `conversationMessages`(live일 땐 store, history일 땐 `historyMessages = parseHistoryMessages(result.outputData)`)와, 인라인 경로가 참조하는 `resolveResultField<unknown[]>(output, "messages")`는 **동일한 `result.outputData`를 동일한 `output.result.messages ?? output.messages` 우선순위로** 읽는다 (`parseHistoryMessages`의 `messagesSource` 계산과 `resolveResultField` 구현이 구조적으로 동치 — `codebase/frontend/src/lib/conversation/conversation-utils.ts:627-651`, `codebase/frontend/src/components/editor/run-results/resolve-result-field.ts:11-30`).
    - `parseHistoryMessages`가 `[]`를 반환하는 유일한 조건(`messagesSource` 부재)에서는 인라인 경로의 `msgsRaw` 역시 배열이 아니므로 즉시 `conversationMessages`(빈 배열)로 폴백한다. 즉 guard가 막지 못하고 인라인 경로가 실행되는 경우는 존재하지 않는다.
    - 이 코드가 실행되는 유일한 시나리오(호출자가 messages가 실재함에도 빈 배열을 넘기는 경우)는 현재 콜 그래프 어디에도 없다. 그럼에도 diff 자체의 주석(`인라인 재파싱은 ... output.error → system_error 합성을 하지 못한다`)이 인정하듯 이 경로는 **알려진 버그를 가진 채** 남아있다.
  - 왜 문제인가: (1) spec §9.11이 "변환 함수는 3개뿐"이라고 명시한 계약을, 실질적으로는 지키면서도(우회) 물리적으로는 4번째 경로가 여전히 소스에 존재해 계약과 코드가 불일치한다. (2) 방어적 주석만으로는 재발을 막지 못한다 — 나중에 guard 조건이 완화되거나(예: 다른 caller 추가, 조건 리팩터링 실수) `historyMessages`를 빈 배열로 넘기는 경로가 생기면, 이번에 고친 바로 그 회귀(§9.9 Inv-8 / CT-S16·CT-S17: `system_error` 미합성으로 오류 인라인 마커 소실)가 **조용히 재발**한다. dead code가 "고쳐지지 않은 채 잠들어있는 시한폭탄"이 되는 전형적 패턴.
  - 제안: 인라인 재파싱 블록을 완전히 삭제하고 `items = conversationMessages`(사실상 `useMemo` 자체도 불필요할 정도로 단순화 가능 — `isLive` 분기도 동일한 값을 반환하므로)로 축소할 것. 향후 정말 "호출자가 넘기지 않아도 자체 복원"이 필요해지면 로컬 재구현이 아니라 이미 존재하는 canonical re-export(`./conversation-utils` → `parseHistoryMessages`, `codebase/frontend/src/components/editor/run-results/conversation-utils.ts:1-9`)를 import해 위임해야 한다 — §9.11 "다중 정의 금지" 원칙 그대로.

- **[INFO]** `conversation-inspector.tsx`가 정적으로는 여전히 "변환 책임을 진 컴포넌트"처럼 보임 — 응집도 저하
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:846-928`
  - 상세: guard 추가로 *동작*은 이제 "이미 변환된 items를 신뢰"로 바뀌었지만, `SummaryView` 내부에는 여전히 (1) `rawOutput.output` unwrap(‑ing) 로직 자체 재구현(§`output-shape.ts`의 `unwrapNodeOutput`과 부분 중복되는 별도 unwrap), (2) `resolveResultField` 호출, (3) 죽은 재파싱 함수가 물리적으로 공존한다. 위 항목 삭제 전까지는 "이 프레젠테이션 컴포넌트가 데이터 변환 책임을 갖는가"라는 질문에 코드만 보고는 답하기 어렵다 — 책임이 (a)에서 지적한 우회로 인해 사실상 `result-detail.tsx` + `conversation-utils.ts`로 이전됐음에도, 파일 구조는 여전히 변환 책임을 진 것처럼 남아 다음 유지보수자의 추적 비용을 늘린다.
  - 제안: (a) 삭제 후 `output` 변수는 `§9.12`의 `turnCount`/`endReason` 표시(아래쪽 `resolveResultField(output, "turnCount")` 등)에만 남기고, 재파싱 전용 타입/헬퍼는 전량 제거해 `SummaryView`가 "표시 전용" 책임만 갖도록 코드 구조로도 명확히 할 것.

- **[INFO]** `hasLiveSystemError` 기반 소스 선택은 레이어 배치상 타당 — 다만 identity 매칭 단위가 스토어의 기존 관례와 어긋남
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1065-1079`
  - 레이어 배치 판단: spec §9.3 "오류 종결 · live" 행과 §9.10("`result-detail.tsx` — 탭 가시성·데이터 소스 선택의 렌더 게이트 소유자")이 이 선택 책임을 `result-detail.tsx`에 명시적으로 귀속시킨다. 따라서 이 로직을 `conversation-inspector.tsx`로 내리는 것은 오히려 §9.11 계약(변환/소스결정 로직 분리)을 재침범하는 것이 되므로, **현재 위치가 spec이 지정한 SoT와 정합한다.**
  - 그럼에도 구현 디테일에 개선 여지:
    1. `hasLiveSystemError`는 `m.systemError?.nodeId === result.nodeId`만 비교하고 `nodeExecutionId`는 무시한다(`codebase/frontend/src/components/editor/run-results/result-detail.tsx:1070-1072`). 이 스토어는 이미 loop/재실행 시나리오를 위해 `nodeExecutionId`를 1차 식별자로 쓰는 인덱스(`nodeResultIndexByExecId`, `findNodeResult` — `codebase/frontend/src/lib/stores/execution-store.ts:231-239, 690-708`)를 갖고 있는데, 이 신규 선택 로직만 더 거친 단위인 `nodeId`로 매칭한다. 동일 `nodeId`가 여러 `nodeExecutionId`로 반복 실행되는 상황(loop 노드, retry 이후 재실행 시 store에 과거 execution의 `system_error`가 잔존)에서 현재 보고 있는(다른 execution의) 결과에 대해 "live"로 오판해 stale store 사본을 `historyMessages` 대신 노출할 위험이 있다. `NodeResult.nodeExecutionId`(옵셔널, `execution-store.ts:38`)가 존재할 때는 이를 우선 비교하고 없을 때만 `nodeId` 폴백으로 두면 이 스토어의 기존 identity 관례(§실행 기록의 execution 단위 식별)와 일관성을 유지하면서도 현재 테스트(CT-S15~17, `makeResult()`가 `nodeExecutionId`를 세팅하지 않음)를 깨지 않는다.
    2. `hasLiveSystemError` / `historyMessages` / `effectiveConversationMessages` 세 값이 바로 위에서 계산되는 `aiMetadata`/`turnRefIndex`(`result-detail.tsx:1020-1032`, `useMemo` 적용)와 달리 `useMemo`로 감싸이지 않아 매 렌더마다 `conversationMessages.some(...)` 스캔과 `parseHistoryMessages(result.outputData)` 재파싱이 무조건 재실행된다. 기능 결함은 아니나 동일 컴포넌트 내 다른 파생값과 패턴이 어긋나고, 무관한 리렌더(예: 탭 전환)마다 불필요한 재계산 비용이 든다.
  - 제안: (1) `result.nodeExecutionId` 존재 시 `nodeExecutionId` 우선 비교로 전환, (2) 세 파생값을 `useMemo`로 승격.

- **[INFO]** `isConversationOutput`의 반복적 heuristic OR-체인 확장 — 이번 diff의 근본 원인이 된 패턴이 그대로 반복
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:778-847` (`endReason` 화이트리스트에 `condition`/`error` 추가)
  - 상세: 이 함수 자체가 문서화하듯("종결 사유 화이트리스트는 backend 의 endReason enum 과 정합해야 한다... 누락은 drift 였다"), `isConversationOutput`은 여러 shape(legacy/canonical/waiting)을 문자열 리터럴 화이트리스트로 흡수하는 heuristic 판별 함수이며, 이번 버그(R1/R2, Inv-8)와 CT-S9/10/15/16/17 계열 회귀들의 근본 원인이 정확히 이 패턴이다 — 새 terminal state가 backend에 추가될 때마다 이 OR-체인에 수동으로 문자열을 추가해야 하고, 놓치면 미리보기가 통째로 사라진다. 같은 파일의 `MULTI_TURN_INTERACTION_TYPES`는 AST exhaustiveness 가드(`interaction-type-exhaustiveness.test.ts`)로 drift를 컴파일/테스트 단계에서 차단하는 선례가 이미 있는데, `endReason` 화이트리스트는 그 선례를 따르지 않고 여전히 주석-only 동기화다.
  - 제안: 근본 해결은 이번 diff 범위를 넘지만, `endReason` 화이트리스트에도 동일한 exhaustiveness 가드(또는 backend와 공유되는 타입/상수)를 도입해 이 함수가 앞으로도 "고치고 또 놓치는" 순환에 빠지지 않도록 후속 작업으로 트래킹할 것을 권고.

## 요약

이번 diff의 핵심 아키텍처 결정 — `conversation-inspector.tsx`의 `items` 계산에 "호출자 신뢰" guard를 추가해 §9.11의 3-함수 변환 계약을 사실상 지키게 하고, 데이터 소스 선택 책임(`hasLiveSystemError`)을 spec이 명시적으로 지정한 SoT 소유자(`result-detail.tsx`)에 둔 것 — 은 레이어 경계 관점에서 방향이 맞다. 다만 실행이 확인하듯 인라인 재파싱은 현재 콜 그래프에서 도달 불가능한 dead code로 전락했음에도 삭제되지 않아 spec 계약과 물리적 코드가 어긋난 상태로 남았고, 이는 향후 guard 조건이 흔들릴 경우 오늘 고친 바로 그 버그를 재발시키는 잠재적 함정이다. 또한 `hasLiveSystemError`의 identity 매칭이 스토어가 이미 확립한 `nodeExecutionId` 우선 관례를 따르지 않고 더 거친 `nodeId` 단위로 회귀해 loop/재실행 시나리오에서 stale store 데이터를 오판 노출할 소지가 있다. 두 문제 모두 즉각적인 기능 파손을 일으키지는 않지만(현재 테스트는 통과), 코드와 계약의 불일치·identity 단위 불일치라는 형태로 기술 부채를 남긴다. 근본적으로는 `isConversationOutput`의 문자열 화이트리스트 heuristic 자체가 이 계열 회귀의 반복적 진원지라는 점도 후속 검토 대상이다.

## 위험도

LOW — 현재 테스트·기능은 정상이며 CRITICAL/즉시 파손 요소는 없으나, dead code 잔존과 identity 매칭 단위 불일치는 향후 회귀 재발 가능성을 남기는 실질적 기술 부채로 WARNING 처리했다.

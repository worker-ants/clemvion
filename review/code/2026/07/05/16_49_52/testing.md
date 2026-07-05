# 테스트(Testing) 리뷰 — execution-detail-node-subtabs (V-05)

## 대상

- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` — 노드 상세 우측 패널을 로컬 4탭(preview/input/output/error) 구현에서 에디터 공용 `ResultDetail` 재사용으로 교체.
- `codebase/frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-detail-waiting.test.tsx` — 완결 AI/비-AI 노드 서브탭 노출 테스트 2건 신설, 기존 waiting(form/buttons/ai_conversation) 회귀 테스트 6건 유지.

## 발견사항

- **[INFO]** 메시지 레벨(assistant 선택 시 Response/Request/LLM Usage) 탭 자체는 이번 diff 의 신규 테스트로 커버되지 않음 — 그러나 갭 아님
  - 위치: `execution-detail-waiting.test.tsx` (본 PR 신설 2건), 대조: `codebase/frontend/src/components/editor/run-results/__tests__/result-detail.test.tsx:319-425` (`describe("selection-driven tab visibility for AI conversation nodes")`, 특히 `it("assistant message selected → Preview + Response/Request/LLM Usage")`)
  - 상세: 이번 변경은 실행 상세 페이지가 `ResultDetail`을 **prop 그대로 전달**(`selectedConversationItemIndex={selectedMsgIndex}`, `onSelectConversationItem={setSelectedMsgIndex}`)하는 얇은 wrapper로 축소되었다. 메시지 레벨 탭 표시 로직(user 선택 시 Preview만 / assistant 선택 시 Preview+Response+Request+LLM Usage) 자체는 `ResultDetail` 내부에 있으며, 그 컴포넌트는 이미 격리된 단위 테스트(`result-detail.test.tsx`)로 상세히 커버되어 있다(사전 존재, 본 PR에서 미변경 — `git log`로 확인). 페이지 레벨에서 이 로직을 다시 검증하는 것은 `ResultDetail` 자체 테스트와 중복이며, 오히려 실질적 갭은 "페이지가 `selectedMsgIndex` state를 올바르게 배선해 `ResultDetail`에 넘기는지"이다.
  - 제안: 필수는 아니나, 페이지 레벨에 "완결 AI 대화 노드에서 assistant 메시지를 클릭하면 Response/Request 탭이 나타난다"는 **1개의 얕은 통합 테스트**를 추가하면 배선(prop 전달) 자체의 회귀(예: prop 이름 오타, index 미전달)를 잡을 수 있다. 현재는 이 배선이 온전히 TypeScript 컴파일 타임 체크에만 의존한다 — 런타임 잘못된 매핑(e.g. `selectedConversationItemIndex` 대신 다른 index state를 넘기는 실수)은 어떤 테스트로도 검출되지 않는다. 우선순위는 낮음(LOW): 컴파일러가 prop 시그니처를 강제하고, 완결 대화 케이스는 `result-detail.test.tsx`가 이미 데이터 흐름을 검증.

- **[INFO]** 신설된 2건의 서브탭 노출 테스트는 탭 "존재"만 검증하고 탭 "내용"은 미검증
  - 위치: `execution-detail-waiting.test.tsx:1451-1473` (`completed AI node exposes Config and LLM Usage sub-tabs`, `completed non-AI node exposes Config but not LLM Usage`)
  - 상세: `screen.findByText("설정")`/`screen.getByText("LLM 사용량")`으로 탭 라벨(버튼)의 존재만 확인하고, 클릭 후 실제 Config JSON(`{model: "gpt-4o", temperature: 0.5}`)이나 LLM Usage 수치(`totalTokens: 100` 등)가 렌더되는지는 검증하지 않는다. 다만 그 콘텐츠 렌더링 자체는 `ResultDetail`의 책임이고 이미 자체 단위 테스트(`result-detail.test.tsx`)에서 검증되므로, 페이지 레벨에서는 "올바른 데이터가 `ResultDetail`로 전달되어 올바른 탭 세트가 나타나는지"만 확인하는 것으로 충분한 스코프 분리다. 이 점에서 두 신규 테스트의 스코프는 적절하다.
  - 제안: 조치 불필요(정보 제공 목적).

- **[INFO]** `NodeStatusIcon`·`toNodeResult`의 `nodeCategory` 매핑 등 diff에 남아있는 헬퍼 로직에 대한 직접 유닛 테스트는 없음
  - 위치: `page.tsx:897-909` (`toNodeResult`)
  - 상세: `toNodeResult`는 diff 대상은 아니었지만(이번 PR에서 로직 자체는 불변), `nodeCategory: def?.category ?? "unknown"`가 `ResultDetail`의 `isPresentation`/AI 분기 판단에 쓰이는 핵심 매핑이다. 현재 테스트 mock (`vi.mock("@/lib/node-definitions", ...)` → `getNodeDefinition: () => undefined`)이 항상 `undefined`를 반환하도록 고정되어 있어, 신규 완결-AI 테스트에서 `nodeCategory`는 항상 `"unknown"`으로 흐른다. AI 노드의 LLM Usage 탭 노출 판단이 `nodeCategory`가 아니라 `outputData.meta` 존재 여부(node-output 규약)에 의존한다면 문제 없으나, 만약 `ResultDetail` 내부에 `nodeCategory === "ai"`류 분기가 있다면 이 테스트는 그 경로를 전혀 exercise 하지 못한 채 통과할 수 있다.
  - 제안: `ResultDetail`의 LLM Usage 표시 조건이 `meta` 필드 유무 기반임을 재확인했다면(현재 fixture 설계상 그렇게 보임 — AI만 `meta` 포함) 문제 없음. 다만 `getNodeDefinition` mock이 categories를 구분하지 않는 점은 향후 category 기반 분기가 추가될 때 조용히 깨질 수 있는 잠재 취약점이므로, mock을 `nodeType`에 따라 category를 반환하도록 구체화해두면 더 견고하다.

## 항목별 평가 요약

1. **테스트 존재 여부**: PR이 삭제한 로컬 4탭 구현·waiting 핸들러(handleFormSubmit 등)에 대응하는 6개 기존 waiting 회귀 테스트가 그대로 유지되고, 신규 코드 경로(완결 노드의 Config/LLM Usage 노출)에 대해 2건이 추가됨 — 적절.
2. **커버리지 갭**: 페이지 레벨에서 메시지 선택(assistant 클릭 → Response/Request) 배선은 테스트되지 않으나, 그 로직 자체는 `ResultDetail` 단위 테스트가 이미 충분히 커버하고 있어 실질적 리스크는 낮음(위 INFO 참고).
3. **엣지 케이스**: `outputData: null`인 완결 노드, `error` 존재 시 Error 탭 등은 신규 diff에서 직접 다루지 않으나 기존 waiting 테스트 및 `ResultDetail` 자체 테스트가 커버.
4. **Mock 적절성**: `ws-client`(getWsClient), `node-definitions`, `next/navigation` mock 모두 이전과 동일한 패턴 유지. `useExecutionInteractionCommands`가 `ResultDetail` 내부로 이동했음에도 별도 mock 추가 없이 실제 훅이 실행되며 `getWsClient` mock을 통해 emit 호출을 검증 — 실제 동작과의 괴리 없이 통합 레벨로 잘 검증됨.
5. **테스트 격리**: `beforeEach`에서 `vi.clearAllMocks()` + `useExecutionStore.getState().reset()`으로 각 테스트가 독립적. 신규 2건도 동일 패턴을 따름 — 문제 없음.
6. **테스트 가독성**: `makeCompletedExecution(nodeType)` 헬퍼가 AI/비-AI 분기를 명확히 표현하고, 테스트명("V-05" 태그 포함)이 의도를 잘 드러냄.
7. **회귀 테스트**: 6건의 waiting 상호작용 테스트(form submit, button click, waitingNodeId reset, 재-auto-select 방지, end_conversation, submit_message)가 `ResultDetail`로의 교체 후에도 그대로 통과하도록 유지됨 — `page.tsx`가 이제 `onFormSubmit`/`onButtonClick`/`onConversationEnd`로 얇게 위임하지만 실제 커맨드 실행은 `ResultDetail` 내부 훅이 담당하므로 이 테스트들은 이제 사실상 통합 테스트(페이지 + ResultDetail + interaction-commands 훅)로 격상되었고 여전히 유효.
8. **테스트 용이성**: `page.tsx`가 로컬 상태(4탭 enum, waiting 핸들러 8개)를 제거하고 얇은 prop 전달 컴포넌트가 되어 테스트 용이성이 오히려 개선됨 — 탭 콘텐츠 로직은 이미 격리 테스트된 `ResultDetail`에 위임, 페이지는 배선만 검증하면 되는 구조.

## 요약

이번 변경은 페이지 로컬 구현을 이미 충실히 단위 테스트된 공용 컴포넌트(`ResultDetail`)로 교체하는 리팩터링이며, 신설된 2개의 완결-노드 서브탭 테스트가 새로 열린 코드 경로(비-waiting 상태에서 Config/LLM Usage 노출)를 적절히 커버한다. 기존 6개의 waiting 상호작용 회귀 테스트도 `ResultDetail`이 내부적으로 동일한 커맨드 훅과 이벤트 emit 경로를 사용하므로 여전히 유효하며 오히려 통합 테스트로서의 가치가 커졌다. 질문의 핵심인 "메시지 레벨(assistant 선택 시 Response/Request) 테스트 여부"는 페이지 자체 테스트에는 없지만, 그 로직의 SoT인 `result-detail.test.tsx`가 이미 상세히(user/assistant 선택별 탭 가시성, References 필터링 등) 검증하고 있어 실질적 커버리지 갭은 아니다. 다만 페이지→ResultDetail 간 `selectedMsgIndex` prop 배선 자체를 확인하는 얕은 통합 테스트 1건을 추가하면 향후 배선 실수(예: 잘못된 state 전달)를 더 조기에 잡을 수 있어 권장 사항으로 남긴다. 전반적으로 테스트 격리·가독성·mock 적절성 모두 양호하다.

## 위험도

LOW

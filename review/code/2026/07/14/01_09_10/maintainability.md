# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

- **[INFO]** 후행 optional positional 파라미터 누적 — 확장 시 호출부 가독성 저하 위험
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `continueExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation`, `resolveWaitingNodeExecutionId` 시그니처에 `expectedNodeId?: string` 추가
  - 상세: 5개 메서드 모두 새 컨텍스트 필드를 위치 기반 마지막 인자로 덧붙이는 패턴을 택했다. `continueButtonClick(executionId, buttonId, expectedNodeId)` 처럼 호출부가 문자열 나열이라 인자 순서 실수(특히 `buttonId` ↔ `expectedNodeId` 둘 다 string)에 취약해질 여지가 생긴다. 다만 기존에도 `expectedCommand` 가 이미 positional 이었으므로 이번 diff 가 새 패턴을 도입한 것은 아니고 기존 컨벤션을 그대로 이어간 것이다.
  - 제안: 현재 1개 필드 추가 수준에서는 문제 없음. 향후 publisher 경로에 컨텍스트 필드가 더 필요해지면(`{ expectedNodeId, ... }` 형태의) options 객체로 전환하는 편이 호출부 자기서술성(self-documenting)에 유리하다.

- **[INFO]** `continueButtonClick` / `continueAiConversation` / `endAiConversation` / `continueExecution` 자체 JSDoc 에는 신규 파라미터 설명이 없음
  - 위치: `execution-engine.service.ts` 4개 public 메서드 (예: `continueButtonClick` 은 JSDoc 자체가 없고, `continueAiConversation`/`endAiConversation` 은 한 줄 요약만 존재)
  - 상세: `expectedNodeId` 의 의미·면제 조건에 대한 상세 설명은 오직 `resolveWaitingNodeExecutionId` 의 `@param` 블록에만 존재한다. 호출자가 `continueButtonClick` 시그니처만 보고는 세 번째 인자의 의도를 알 수 없고, 내부 private 헬퍼까지 따라가야 한다.
  - 제안: 4개 public 메서드 JSDoc에 `@param expectedNodeId` 한 줄(또는 `resolveWaitingNodeExecutionId` 참조 링크)을 추가하면 탐색 비용이 줄어든다. 급하지 않은 개선.

- **[INFO]** e2e 신규 테스트가 직전 테스트의 DB 셋업 보일러플레이트를 거의 그대로 복제
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` 신규 `it('G-2. submit_form nodeId 가 대기 노드와 불일치 → 409 STATE_MISMATCH (F-1)', ...)` (바로 위 테스트 `G` 와 node/execution/node_execution INSERT ~25줄이 거의 동일)
  - 상세: 파일 전체가 이미 A~H 테스트마다 유사한 workspace/workflow/node/execution INSERT 시퀀스를 반복하는 구조라 이번 diff 가 새로 만든 문제는 아니다. 다만 테스트가 늘어날수록 "waiting form 노드 + waiting execution + waiting node_execution" 셋업이 계속 복제되어, 스키마가 바뀌면 여러 테스트를 동시에 손봐야 하는 부담이 커진다.
  - 제안: `insertWaitingFormNode(db, { workflowId, nodeId })` 류의 공용 helper 로 추출 검토 (이번 diff 범위를 벗어나는 선택적 개선).

- **[INFO]** "`in_process_trusted` nodeId 면제" 설명이 5곳에 거의 동일 문구로 중복 기재
  - 위치: `execution-engine.service.ts` (`resolveWaitingNodeExecutionId` JSDoc `@param expectedNodeId` + 함수 내부 inline 주석), `interaction.service.ts` (`interact()` 상단 주석 + `assertNodeId` JSDoc), `hooks.service.ts` (nodeId 제거 지점 주석), `spec/5-system/4-execution-engine.md` (표 + `> in_process_trusted nodeId 면제` 인용 블록)
  - 상세: 코드 로직 중복은 아니고 설명 주석/문서의 반복이라 즉각적 위험은 없다. 다만 프로젝트가 SDD 로 spec 교차참조를 적극 권장하는 컨벤션과 일치하는 스타일이긴 해도, 예외 조건(`in_process_trusted` 판정 기준 등)이 향후 바뀌면 5곳을 모두 동기화해야 하는 drift 위험이 존재한다.
  - 제안: 현재는 문제 없음 — 이후 예외 규칙이 더 복잡해질 경우 spec 문서를 single source 로 삼고 코드 주석은 "see spec §7.5.1" 수준으로 축약하는 것을 고려.

## 긍정적 관찰

- `resolveWaitingNodeExecutionId` 에 추가된 nodeId 불일치 검사는 기존 guard-clause 스타일(0건/2건 이상 체크와 동일한 형태)을 그대로 따르는 얕은 early-return 구조라 순환 복잡도 증가가 미미하고 가독성을 해치지 않는다. 표면(interactionType) 검증은 별도 메서드(`assertCommandMatchesWaitingSurface`)로 위임되어 단일 책임이 유지된다.
- `hooks.service.ts` 에서 `nodeId: 'chat-channel'` placeholder 문자열을 제거한 것은 오히려 매직 스트링을 없애는 개선이다 — 실제 nodeId 가 아닌 값을 존재-검사 통과용으로 심어두던 이전 패턴보다 명확해졌다.
- 신규 테스트 케이스(`F-1` 계열)는 명명이 plan ID(`F-1`)를 일관되게 접두어로 사용해 기존 테스트 파일의 네이밍 컨벤션(`I-5`, `W-2`, `변경 2.3` 등)과 정합하며, 각 케이스가 단일 시나리오만 검증해 함수/테스트 길이가 적절하다.
- 변수명 `expectedNodeId` 는 서비스 계층(`interaction.service.ts`)과 엔진 계층(`execution-engine.service.ts`) 전체에서 동일하게 사용되어 데이터 흐름 추적이 쉽다.

## 요약

이번 변경은 `expectedNodeId` optional 파라미터 하나를 5개 메서드에 일관된 패턴으로 threading 하고, 관련 테스트(unit/e2e) 를 빠짐없이 갱신했으며, 신규 로직은 기존 guard-clause 스타일을 그대로 따라 복잡도 증가가 거의 없다. 매직 넘버·중첩 심화·순환 복잡도 급증 같은 구조적 문제는 발견되지 않았고, 오히려 `chat-channel` placeholder nodeId 를 제거해 명확성이 개선됐다. 지적된 항목은 모두 INFO 수준으로, 향후 컨텍스트 필드가 더 늘어날 경우의 positional-param 확장성, 일부 public 메서드 JSDoc 누락, e2e 테스트 셋업 보일러플레이트 반복(기존부터 있던 패턴), 그리고 동일 설명 주석의 다중 위치 중복(SDD 컨벤션과 일치)에 관한 것으로, 지금 당장 조치가 필요한 문제는 아니다.

## 위험도

LOW

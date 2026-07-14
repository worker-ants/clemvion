# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** class-level JSDoc "dispatch 매핑" 표가 새 `expectedNodeId` 인자를 반영하지 않아 오래된 주석이 됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:84-89` (`InteractionService` 클래스 JSDoc, 이번 diff 로 수정되지 않은 블록)
  - 상세: 클래스 JSDoc 은 여전히
    ```
    submit_form      → ExecutionEngineService.continueExecution(executionId, data)
    click_button     → ExecutionEngineService.continueButtonClick(executionId, buttonId)
    submit_message   → ExecutionEngineService.continueAiConversation(executionId, message)
    end_conversation → ExecutionEngineService.endAiConversation(executionId)
    ```
    로 2-인자/1-인자 시그니처만 나열한다. 그러나 이번 변경으로 `interact()` 본문(같은 파일 113~193줄)은 네
    호출 모두에 세 번째 인자 `expectedNodeId` 를 추가로 넘기며(`assertNodeId(dto, ctx)` 도 2-인자로 바뀜),
    이 사실이 이 facade 요약표에는 반영되지 않았다. 같은 파일 안에서 실제 호출부와 클래스 상단 요약 문서가
    불일치하는 전형적인 "오래된 주석" 케이스 — 향후 유지보수자가 이 표만 보고 시그니처를 오인할 수 있다.
  - 제안: 표에 `expectedNodeId` 컬럼(또는 각주)을 추가해 "외부 caller 는 `dto.nodeId`, `in_process_trusted` 는
    `undefined`" 를 요약하거나, 상세 설명은 아래 `assertNodeId`/`resolveWaitingNodeExecutionId` JSDoc 을
    참조하도록 명시.

- **[WARNING]** 신규 nodeId 불일치 거부(202→409 breaking behavior)에 대한 CHANGELOG 항목 누락
  - 위치: `/CHANGELOG.md` (diff 대상 아님 — 이번 변경 세트에 CHANGELOG 갱신이 포함되지 않음)
  - 상세: 이 변경은 종전엔 `assertNodeId` 가 `dto.nodeId` **존재 여부만** 검사해 통과시키던 요청을, 이제
    `resolveWaitingNodeExecutionId` 가 실제 대기 노드와 **값 일치**까지 강제하고 불일치 시
    `InvalidExecutionStateError` → EIA 409 `STATE_MISMATCH` 로 거부한다(`execution-engine.service.ts`
    §7.5.1 nodeId 검사, e2e `G-2` 신규 케이스, `interaction.service.spec.ts` 다수). 이는 외부 EIA
    클라이언트가 이전엔 202 를 받던 요청 조합이 이제 409 로 바뀌는 **breaking behavior** 다 — 실제로 같은
    plan 문서(`plan/in-progress/eia-command-waiting-surface-guard.md` F-3)가 "본 PR 은 종전 202 를
    반환하던 명령 조합을 409 로 바꾼다... 공지 필요 여부·채널을 planner 가 명시적으로 결정할 것" 이라고
    스스로 명시하고 있다. 이 저장소의 CHANGELOG 관례(예: 같은 plan 의 F-2 항목, `## Unreleased —
    채팅 채널 표면 불일치...`)는 이런 동작 변화를 상세히 기록해 왔는데, 이번 F-1 슬라이스에는 대응
    항목이 diff 에 없다.
  - 제안: F-2 항목과 같은 형식으로 `## Unreleased — EIA nodeId 일치 검증 강화 (execution-engine §7.5.1
    nodeId 불일치)` 항목을 추가해 (a) 무엇이 바뀌었는지(존재 검사 → 값 일치 검사), (b) 왜(§7.5.1/EIA-IN-13
    이 이미 약속한 "다른 nodeId" 거부의 뒤늦은 이행), (c) breaking 여부와 F-3 결정 상태를 기록.

- **[INFO]** plan 문서의 F-1 섹션이 본 구현 완료를 반영하지 않음
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md` (diff 대상 아님)
  - 상세: 같은 plan 안의 F-2 는 상세 체크리스트(`[x]` 8개 항목, ai-review/consistency-check 산출물 경로,
    완료일)로 완결을 기록하는데, F-1 섹션(100~113줄)은 여전히 "**그러나 지금 고칠 수 없다**... 선행 작업:
    ... 그 뒤에야 nodeId 일치 검사를 넣을 수 있다" 라는 **차단 서술 그대로** 남아 있다. 이번 diff 는 그
    선행 작업(hooks.service.ts 의 `nodeId: 'chat-channel'` placeholder 제거 + `expectedNodeId` 배선)과
    본 작업(nodeId 일치 검사 추가) 을 모두 구현·테스트·spec 반영까지 마쳤음에도 plan 은 미갱신 상태다.
  - 제안: F-1 섹션도 F-2 와 동일한 체크리스트 포맷으로 완료 처리(구현/테스트/e2e/ai-review/consistency-check
    경로 기재) 하거나, 최소한 "완료 (날짜)" 표시로 갱신. plan-lifecycle 관례상 완료된 slice 는 diff 와
    함께 반영되는 것이 일반적이라, 이번 세트에서 빠진 점을 짚어둔다.

- **[INFO]** 공개 continuation 메서드(`continueButtonClick`/`continueAiConversation`/`endAiConversation`)의
  `@param` 문서 부재 — 새 `expectedNodeId` 파라미터가 무설명으로 추가됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4815`(`continueButtonClick`,
    JSDoc 자체 없음), `:4834-4836`(`continueAiConversation`, 한 줄 요약만), `:4864-4866`(`endAiConversation`,
    한 줄 요약만)
  - 상세: 반대로 private `resolveWaitingNodeExecutionId` 의 `expectedNodeId` 는 이번 diff 에서 상세
    `@param` 문서(면제 조건까지)를 잘 갖췄다. 그러나 이를 호출하는 4개 public 메서드 쪽에는 신규
    `expectedNodeId?: string` 파라미터에 대한 설명이 전혀 없어(`continueExecution` 도 마찬가지), 이
    서비스의 공개 API 만 보는 소비자(WS gateway 등)는 파라미터 의미를 하위 private 메서드 JSDoc까지
    추적해야 한다. 심각도는 낮음 — 기존에도 이 4개 메서드는 파라미터 문서가 빈약한 pre-existing 패턴.
  - 제안: 최소 `continueExecution`(§10.9 sentinel 설명 바로 아래) 에 `@param expectedNodeId` 한 줄만
    추가해 어떤 caller 가 어떤 값을 넘겨야 하는지 명시하면, 다른 3개 메서드도 동일 패턴을 참조하도록
    유도 가능.

- **[INFO]** spec 갱신 자체는 모범적
  - 위치: `spec/5-system/4-execution-engine.md` §7.5.1
  - 상세: 표에 "nodeId 불일치" 행을 신설하고, `in_process_trusted` 면제를 별도 인용 블록으로 명확히
    설명했으며, `resolveWaitingNodeExecutionId(executionId, expectedCommand, expectedNodeId?)` 시그니처까지
    정확히 인용했다. 코드 인라인 주석(`execution-engine.service.ts` §7.5.1 검증 블록,
    `interaction.service.ts` `assertNodeId`/`interact()` 상단)도 모두 이 spec 문구를 그대로 참조해
    정합성이 높다. 별도 조치 불필요 — 긍정적 관찰로 기록.

## 요약

이번 변경(F-1: EIA/WS continuation 명령의 nodeId 일치 강제)은 spec(§7.5.1)·private 헬퍼 JSDoc·인라인
주석·테스트 주석(F-1 태그)까지 전반적으로 문서화 수준이 높고, 특히 `resolveWaitingNodeExecutionId` 의
`@param expectedNodeId` 문서와 `hooks.service.ts` 의 placeholder 제거 사유 주석은 "왜" 를 잘 남겼다.
다만 (1) 같은 파일 안에서 시그니처가 바뀐 4개 호출을 요약하는 클래스 JSDoc 표가 갱신되지 않아 즉시
오래된 주석이 됐고, (2) 이 저장소가 기능 슬라이스마다 상세 CHANGELOG 항목을 남기는 확립된 관례가
있음에도 breaking-behavior 성격(202→409)의 이번 변경엔 그 항목이 diff 에 없으며, (3) plan 문서의
F-1 섹션이 여전히 "차단됨" 상태로 남아 구현 완료 사실과 어긋난다. 코드 자체의 신규 로직에 대한 설명
품질은 우수하지만, 주변 문서(클래스 요약 JSDoc·CHANGELOG·plan 상태)와의 동기화가 한 박자 늦었다.

## 위험도

MEDIUM

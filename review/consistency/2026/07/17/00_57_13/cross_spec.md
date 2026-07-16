# Cross-Spec 일관성 검토 결과 (2회차)

> target: `plan/in-progress/ai-node-failed-conversation-preview.md`
> 1회차 산출물: `review/consistency/2026/07/17/00_32_29/` (BLOCK: YES, CRITICAL 1건 — 탭 정책 이중 SoT)

## 1회차 CRITICAL 정정 검증 — 해소 확인

1회차 CRITICAL(`conversation-thread.md §9.13` 신설이 `3-execution.md §10.6.1`과 이중 SoT를 형성)은 실측 확인 결과 **해소되었다**.

- `spec/conventions/conversation-thread.md` 전체에 `9.13`, `§9.13` 문자열이 더 이상 존재하지 않는다 (grep 확인) — §9.13 신설이 실제로 폐기됨.
- target 문서 헤더의 "관련 spec" 블록이 SoT 경계를 명시적으로 4분할했다: 탭 정책 SoT = `3-execution.md §10.6.1/§10.8`, 요구사항 = `_product-overview.md ED-EX-13`, 데이터 소스·불변량·시나리오 = `conversation-thread.md`, 이력 화면 참조 정합 = `14-execution-history.md`. 이 분할은 기존 `14-execution-history.md:211`("서브 탭 전체 구성·조건·기본탭·auto-fallback 은 §10.6.1 이 단일 진실")과 정합한다.
- `conversation-thread.md` §9.3 신규 행(항목 B.4)은 "1차 소스" 슬롯을 별도 행으로 경쟁시키지 않고 기존 conversation-Preview-탭 행의 "예외 조건으로 종속" 시키는 서술을 택해 표 정규화를 유지한다 — 1회차 Naming Collision INFO에 대한 타당한 대응.
- Inv-8(§9.9 신설)이 "탭 가시성·기본 선택 규칙 자체는 §10.6.1을 cross-ref"라고 명시해 렌더 불변량(store 도달성)과 탭 정책(어느 탭을 보여줄지)의 책임을 분리했다 — 같은 컴포넌트(`ResultDetail`)에 대한 두 번째 SoT를 만들지 않는다.

이중 SoT CRITICAL은 재발하지 않는다.

## 실측 교차검증 — target 진단의 정확성

target의 "오류 경로는 실질적으로 하나다" 재진단(§ "2026-07-17 실측")을 `spec/5-system/4-execution-engine.md`와 대조했다.

- `spec/5-system/4-execution-engine.md:1333`: "AI Agent multi-turn 의 turn 처리가 LLM throw(429/timeout/connection)로 종결될 때, 엔진의 `handleAiTurnError` → `finalizeAiNode('FAILED')` 가 직접 Execution을 `failed`로 전이시켜야 spec §7.9의 `port='error', status='ended'` shape으로 정상 finalize된다."
- 이는 target의 핵심 주장(§7.9의 handler-level `port:'error'/status:'ended'` shape이 있어도 엔진이 항상 NodeExecution을 FAILED로 귀결시켜 `node.completed`가 아니라 `node.failed`만 발사된다)과 **정합**한다. target의 재진단은 기존 execution-engine spec과 교차검증되는 올바른 근거 위에 있다 — 1회차 대비 진단 정확도가 개선되었다.

## 발견사항

- **[WARNING]** `14-execution-history.md §3.4` 신규 cross-reference가 EH-DETAIL-12(cross-node 전용)에 단일 노드 갭을 오귀속할 가능성
  - target 위치: Phase 1 개정 대상 C.8 (`14-execution-history.md §3.4` "완료된" 한정 갱신 + "failed 종결 노드의 새로고침 후 복원은 EH-DETAIL-12(v2) 로드맵" 상호 참조), 및 "스코프 › 제외" 절 ("`outputData: null` 로 영속되므로 store 가 비면 복원 매체가 없다 — spec §7 v2 로드맵 … EH-DETAIL-12 영역")
  - 충돌 대상: `spec/2-navigation/_product-overview.md` EH-DETAIL-12 정의("여러 노드의 presentation/AI turn 을 seq·timestamp·source 로 interleave 한 **통합** 대화 뷰"), `spec/conventions/conversation-thread.md §7` v2 로드맵("실행 이력 화면의 ConversationThread **크로스노드** 뷰")
  - 상세: EH-DETAIL-12는 스펙 정의상 **cross-node**(여러 노드에 걸친 interleave) 전용 요구사항이다. 그런데 target이 이 ID로 위임하는 실제 갭은 **단일 노드**(그 AI Agent 노드 자신)의 failed 종결 대화 복원이며, cross-node interleave와 무관하다. 실측 결과 이 단일 노드 갭도 target 스코프 밖일 필요는 없어 보인다:
    - 백엔드 `finalizeAiNode`(`ai-turn-orchestrator.service.ts:1249`)는 `isFailed` 분기에서도 `nodeExec.outputData = finalOutput`(§7.9 shape, `output.result.messages` 포함)을 그대로 저장하고, `NODE_FAILED` WS 페이로드에도 `output: nodeExec.outputData` 를 실어 emit한다(`:1308`). 즉 DB 영속 `outputData`는 failed 멀티턴 노드에도 **null이 아니다**.
    - REST `/executions/:id` 경로(`apply-execution-snapshot.ts:91-104`, 모든 노드에 무조건 `outputData: ne.outputData` 대입 → `executions/[executionId]/page.tsx` 의 `loadHistoricalExecution`)는 이 실제 backend 값을 그대로 `result.outputData` 에 반영한다. `isConversationOutput`(`output-shape.ts:135` `hasResultMessages = !!result && Array.isArray(result.messages)`) 기준으로도 이 shape은 조건을 만족할 가능성이 높다.
    - `result-detail.tsx`의 현재 렌더 게이트(`isCompletedConversation = result.status === "completed" && isConversationOutput(...)`)가 히스토리 뷰까지 막는 실제 이유는 **`status === 'completed'` 조건 자체**이지, "복원 매체 부재"가 아니다.
    - target의 "제외" 근거 문장("outputData: null 로 영속되므로")은 frontend WS 라이브 핸들러의 하드코딩(`use-execution-events.ts:866`, `outputData: null` — REST/DB 값과 무관하게 로컬 변수만 null)과 실제 DB 영속 값을 혼동한 것으로 보인다.
  - 제안: (a) "제외" 절의 근거 문장을 "outputData 가 null" → "frontend WS 라이브 이벤트 로컬 변수가 null(REST/DB 값은 아님)"로 정정하거나, (b) 실측 재검토 후 히스토리 뷰 복원이 실제로 이번 plan 스코프 안에서(예: `applyExecutionSnapshot`의 FAILED 분기에도 `parseHistoryMessages` seeding 추가, 혹은 `result-detail.tsx`의 `isCompletedConversation`을 status 무관 `isConversationOutput`으로 완화) 저비용으로 해결 가능한지 재평가할 것. 만약 정말 스코프 밖으로 유지한다면, `14-execution-history.md §3.4` 의 cross-reference는 EH-DETAIL-12(cross-node) 대신 **단일 노드 범위의 별도 언급**(예: "단일 노드 failed 종결의 REST 복원은 미해결 — 후속 이슈, cross-node 통합 뷰와는 별개")으로 재작성해 EH-DETAIL-12 정의(cross-node)와의 스코프 불일치를 피할 것.

- **[INFO]** `execution.node.failed` WS 페이로드 shape의 기존 spec drift가 target 진단의 근거 문서에 반영되어 있지 않음
  - target 위치: 배경 절 "node.failed 경로는 outputData: null (use-execution-events.ts:866) + status: 'failed' 로 노드 결과를 쓴다" 서술
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md:184` (`execution.node.failed` 페이로드 shape을 `{ executionId, nodeId, nodeExecutionId, nodeName, error }` 로만 문서화, `output`/`input` 필드 누락) vs 실제 백엔드 emit(`output: nodeExec.outputData` 포함, `ai-turn-orchestrator.service.ts:1296-1314`)
  - 상세: 이 drift는 target이 만든 것이 아니라 기존에 존재하던 것이며(`§5-system/6-websocket-protocol.md:187`의 "Note (spec drift)" 문단이 인접 필드의 유사 drift를 이미 인정) target의 변경 범위 밖이다. 다만 target의 "outputData: null" 진단이 이 실제로 더 풍부한 WS 페이로드 shape을 문서가 과소 기술하고 있다는 사실과 맞물려, 위 WARNING의 근거를 강화한다.
  - 제안: 본 target plan 범위 밖 — 별도 `websocket-protocol.md` 정합화 백로그로 남겨도 무방. 언급만 해 둔다.

- **[INFO]** 양방향 교차 참조 확인 — 정합
  - target 위치: Phase 2 "plan_coherence WARNING 1 대응" 말미 "양방향 교차 참조 의무 — 그쪽 plan 에도 본 plan 역참조 추가"
  - 실측: `plan/in-progress/node-output-redesign/ai-agent.md:213`에 "(2026-07-17 frontend 파급 — 교차 참조)" 항목으로 본 target plan(`ai-node-failed-conversation-preview.md`)에 대한 역참조가 이미 존재함을 확인. 의무 이행 완료.

- **[INFO]** 요구사항/시나리오 ID 신규성 확인 — 충돌 없음
  - `Inv-8`, `CT-S15`, `CT-S16` 은 `spec/` 전체에서 grep 결과 현재 어디에도 존재하지 않아 순수 신규 ID다 (충돌 없음).
  - `ED-EX-13`(L121), `EH-DETAIL-12`(L256 of `2-navigation/_product-overview.md`) 는 기존 ID를 그대로 재사용하며 의미 변경 없이 예외/참조만 추가하는 방식이라 ID 의미 충돌 없음.
  - `§10.6.1`의 기존 retryable 전용 예외 문구를 인용하는 spec 파일은 `3-execution.md`·`14-execution-history.md` 둘뿐임을 확인(`conversation-thread.md`는 무관한 문맥에서만 매치) — 예외 확장 시 갱신 대상에서 누락된 제3의 spec 파일은 없다.

## 요약

1회차 BLOCK 사유였던 탭 정책 이중 SoT는 §9.13 폐기 + §10.6.1 SoT 유지 구조로 완전히 해소되었으며, target의 핵심 실측 재진단("오류 경로는 실질적으로 하나다")은 `5-system/4-execution-engine.md:1333`의 기존 엔진 spec과 교차검증되는 올바른 근거 위에 있다. 데이터 모델·API 계약·상태 전이·RBAC 관점에서는 target이 건드리는 영역이 없어 해당 축의 충돌은 없다. 유일한 잔여 이슈는 WARNING 1건 — "실행 이력 화면(`/executions/:id`)에서 failed 노드 대화 복원 불가"를 EH-DETAIL-12(정의상 cross-node 전용 v2 로드맵)에 위임하는 신규 cross-reference가, 실측 결과 이 갭이 실제로는 백엔드 DB에 이미 영속된 단일 노드 데이터의 렌더 게이트 문제(현재 `isCompletedConversation`의 `status==='completed'` 제약, `applyExecutionSnapshot` FAILED 분기의 store 시딩 누락)에 더 가까워 보여, 스코프 오귀속·근거 문장("outputData: null 로 영속")의 부정확성 소지가 있다는 점이다. 이는 기능적 모순을 일으키지는 않지만(단지 v2로 과잉 이관될 뿐), 새로 작성될 spec cross-reference의 정확성에 영향을 주므로 병합 전 재검토를 권장한다.

## 위험도

MEDIUM

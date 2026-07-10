## 발견사항

- **[INFO]** B4 리팩터가 같은 함수 안에서 동일 패턴(`state.nodeId`)의 raw cast 를 하나 남겨둠
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2815`
    (`processMultiTurnMessage` → `scheduleMemoryExtraction` 호출 인자 `selfNodeId`)
  - 상세: 이번 diff 는 같은 메서드(`processMultiTurnMessage`) 안에서 `resumeState.nodeId ?? ''`
    로 이미 두 곳을 교체했다 — `executeProviderToolBatch` 인자의 `nodeId`(L2717 부근)와,
    `applyMultiTurnTurnMemory` 내부의 동일 패턴(L2283). 그런데 L2815 의
    `selfNodeId: (state.nodeId as string) ?? ''` 는 그대로 raw cast 로 남아 있다. `resumeState`
    변수는 L2509 에서 이미 선언돼 L2815 까지 동일 스코프에서 살아있으므로 교체 자체는 트리비얼했을
    것이다. `plan/in-progress/llm-usage-resume-followups.md` 의 B4 범위 정의(§B4)는 "attribution
    조립 3사이트"(workflowId/executionId/nodeExecutionId)로 명시적으로 한정하고 있어 `nodeId` 단독
    사용처는 엄밀히는 범위 밖일 수 있다 — 다만 인접 코드에서 이미 `nodeId` 도 함께 전환한 전례가
    있어(L2283, L2717), 이 한 곳만 남은 것이 "의도적 제외"인지 "단순 누락"인지 diff/커밋 메시지에서
    구분되지 않는다. 런타임 동작은 완전히 동일(두 캐스트 모두 no-op)하므로 기능 리스크는 없다.
  - 제안: (a) 일관성을 위해 `resumeState.nodeId ?? ''` 로 마저 교체하거나, (b) 의도적으로 남긴
    것이라면 L2277-2279 의 `[B4]` 주석에 "scheduleMemoryExtraction 의 selfNodeId 는 attribution
    조립 3사이트에 포함되지 않아 원래 캐스트 유지" 같은 한 줄 스코프 코멘트를 추가해 향후 리더가
    "왜 같은 필드가 두 가지 방식으로 접근되는가"를 재조사하지 않도록 한다.

- **[INFO]** `applyMultiTurnTurnMemory` 안에서 `resumeState` 전환과 잔존 raw cast(`summaryModelConfigId`)가 인접해 있지만 구분 근거가 인라인에 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2277-2296`
  - 상세: L2277-2279 의 `[B4]` 주석 직후 `resumeState.nodeId`/`resumeState.workflowId`/
    `resumeState.nodeExecutionId` 로 전환됐지만, 바로 아래 L2296 의
    `summaryModelConfigId: state.summaryModelConfigId as string | undefined` 는 여전히 raw cast 다.
    plan 문서(§B4)에는 "summaryModelConfigId 등 non-attribution·catchall 필드는 범위 밖 — 계속
    캐스트" 라는 근거가 있으나, 이 근거는 코드 주석에는 없다 — plan 파일을 보지 않은 리뷰어/차기
    작업자는 "왜 바로 옆 필드만 안 바뀌었는가"를 다시 조사해야 한다.
  - 제안: `[B4]` 주석에 "attribution 3필드(workflowId/executionId/nodeExecutionId)+nodeId 만
    범위, summaryModelConfigId 등 기타 필드는 계속 raw cast" 한 구절을 덧붙이면 향후 재질문을
    없앨 수 있다. 경미하며 선택 사항.

## 요약

B2(spec/CHANGELOG 서술 정밀화)·B3(회귀 테스트 추가 주석)·B4(타입 접근 전환 인라인 주석) 세
갈래 모두 문서화 품질이 높다. `spec/5-system/4-execution-engine.md` §6.1 표 갱신은
`spec/data-flow/7-llm-usage.md §1.3`(SoT)의 실제 코드 확인 사실(Text Classifier=단발/resume 없음,
멀티턴만 resume 턴)과 정확히 일치하며, CHANGELOG 항목도 동일 어휘로 정정됐다. B3 신규 테스트는
스펙 참조·이전 리뷰 태그(WARNING#5/INFO#4)·대칭 테스트 위치(`ai-turn-executor.spec.ts:520`)까지
인라인에 남겨 추적성이 좋고, 회귀 의도(정의 id 가 row PK 자리에 유입되면 안 됨)도 명시적으로
단언한다. B4 의 `[B4]` 인라인 주석들은 `narrowResumeState`(기존 M-7 JSDoc)를 재사용한다는 것과
"필드명 오탈자 컴파일 타임 차단" 근거를 정확히 설명하며 과장 없이 검증 가능한 주장만 담고 있다.
유일한 흠은 같은 리팩터링 의도(raw cast → `resumeState` 타입 접근)가 동일 스코프·동일 필드
패턴에 대해 한 곳(L2815)만 비대칭적으로 남아 있고, 그 경계(어디까지가 B4 범위인지)가 plan 파일에는
있으나 코드 인라인 주석에는 없어 향후 독자가 재추적해야 한다는 점이다 — 기능적 위험은 없다.

## 위험도
LOW

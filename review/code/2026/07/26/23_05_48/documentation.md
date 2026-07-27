# 문서화(Documentation) 리뷰 — ie-resume-turn-boundary-cancel (2026-07-26 23:05, 4차 라운드)

## 발견사항

- **[WARNING]** `assertLinkedTransitionApplied` 파라미터가 `applied` → `shouldProceed` 로 개정(3차 라운드, ai-review WARNING #5)됐는데, 그 메서드를 참조하는 4개 호출부의 `@throws` JSDoc·주석은 여전히 옛 이름(`applied === false`)을 인용한다 — 이 PR 자신이 만든 rename 이 이 PR 자신의 새/기존 문서에 완전히 미러되지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:395`(`reparkAiResumeTurn` `@throws`, "`applied === false`"), `:434`(`emitAiWaitingForInput` `@throws`, "`applied === false`"), `:1322`·`:1325`(`finalizeAiNode` `@throws`, "`applied === false`" 2회) — 대조: 같은 파일 `:332`~`:358`(`assertLinkedTransitionApplied` 정의 직전 JSDoc, `shouldProceed` 로 정확히 갱신됨), `:361`(실제 파라미터 시그니처 `shouldProceed: boolean`).
  - 상세: 커밋 `d1d8d2db1`(SUMMARY#5, "파라미터명을 `shouldProceed` 로 개정 + JSDoc 에 통일을 명시")의 diff 자체를 `git show`로 확인한 결과, 이 커밋은 `assertLinkedTransitionApplied` 정의부 JSDoc(§332-358)과 `finalizeAiNode` 의 `@throws` 블록(§1317-1325)을 **같은 커밋에서 함께 편집**했음에도, 새로 작성해 넣은 `finalizeAiNode` `@throws` 텍스트 자체가 옛 이름 `applied === false` 를 그대로 쓴다(1322·1325줄) — 즉 이 diff 가 새로 추가한 문장 안에서 이름이 어긋난다. `reparkAiResumeTurn`(395줄)·`emitAiWaitingForInput`(434줄)의 `@throws` 는 2차 라운드(커밋 `157bfb887` 계열)에서 당시 정확한 이름(`applied`)으로 작성된 뒤 3차 라운드의 rename 스윕에서 누락됐다. 같은 클래스의 staleness 가 테스트 주석에도 있다: `ai-turn-orchestrator.service.spec.ts:245`("`nodeExec=null + applied=false` 조합")·`:337`("`applied === false`") 도 동일하게 옛 이름을 쓴다. 기능에는 영향 없지만(파라미터명은 런타임과 무관), 이 PR 이 스스로 지적한 "같은 이름이 두 가지 의미로 읽혀 오해를 부른다"는 문제의식과 정확히 같은 결의 잔여 drift — 다음에 이 헬퍼를 form/button 후속 PR 에서 참고할 때 실제 시그니처(`shouldProceed`)와 문서상 이름(`applied`)이 달라 혼란을 줄 수 있다.
  - 제안: 5개 지점(`ai-turn-orchestrator.service.ts:395,434,1322,1325`, `ai-turn-orchestrator.service.spec.ts:245,337`)의 `applied` 인용을 `shouldProceed` 로 정정한다. 짧은 fix 이므로 이번 라운드에 함께 처리 가능.

- **[INFO]** `spec/5-system/4-execution-engine.md` 의 `## Rationale` §C-1 멤버 수(12/7)가 코드 실측치(15/10)와 여전히 어긋나 있음 — 단 이미 `spec-update-node-cancellation-shutdown-classification.md` #7 보강 8번으로 위임돼 추적 중이라 새 발견은 아니다.
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:36-41`(모듈 JSDoc, "distinct **15**"·"`AiTurnEngineDriver` 합계 **10**" — 직접 인터페이스를 세어 확인: Core 2 + Interaction 1 + ReentryState 1 + AiTurn 자체 6(`assertExecutionNotCancelled`/`buildResumeCheckpoint`/`isCheckpointEligibleNodeType`/`applyPortSelection`/`markNodeCancelled`/`assertActiveExecutionAndSaveNodeExec`) + Retry 자체 5 = 15, AiTurn 합계 = 2+1+1+6 = 10 — 코드 쪽 수치는 정확함).
  - 상세: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #7 보강 8번이 코드/spec 수치를 같은 턴에 15/10 으로 맞추도록 이미 위임해 뒀고, `developer` 는 `spec/` 쓰기 권한이 없어 규약대로 직접 수정하지 않았다. 새 조치 불요 — project-planner 턴에서만 반영.
  - 제안: 조치 불요(이미 추적됨). project-planner 턴에서 위임 항목 반영 여부만 확인.

- **[INFO]** README/API 문서/신규 env 변수 문서화 해당 없음 — 이번 변경은 엔진 내부 취소 가드(`AiTurnEngineDriver` 확장)와 테스트 전용 e2e 지연 프로토콜(`__e2e_delay_ms`, `StubLlmClient`)에 한정돼 공개 API·설정·README 표면을 건드리지 않는다.
  - 위치: 해당 없음(범위 확인 목적의 기록).
  - 제안: 조치 불요.

## 요약

핵심 코드(`AiTurnOrchestrator`, `ExecutionEngineService`, `EngineDriver` 계열 인터페이스)의 JSDoc·인라인 주석은 세 차례 리뷰 라운드를 거치며 상세하고 정확하게 유지·정정돼 왔다 — 이전 라운드(22_11_22)가 지적한 CHANGELOG "3곳→4곳" 누락, `EngineDriver` 멤버 수 표기(14/9)는 이번 최종 상태에서 모두 올바르게 갱신·재검증됐다(직접 세어 확인). 이번 라운드에서 새로 확인한 잔여 항목은, 3차 라운드가 `assertLinkedTransitionApplied` 의 파라미터를 의미 중립적으로 `applied`→`shouldProceed` 로 개정하면서 그 파라미터를 인용하는 4개 호출부 JSDoc·2개 테스트 주석(총 6곳)에는 rename 이 전파되지 않아, 이 PR 스스로 문제 삼았던 "같은 이름이 다른 의미로 읽힌다"는 이슈의 축소판이 문서 레이어에 남았다는 점이다 — 기능적 영향은 없는 순수 문서 정확성 이슈다. spec 문서(`execution-engine.md ## Rationale`)의 멤버 수 stale 은 이미 project-planner 위임으로 투명하게 추적되고 있어 추가 조치가 필요하지 않다. README/API 문서/신규 설정 변수는 이번 diff 범위상 해당 사항이 없다.

## 위험도

LOW

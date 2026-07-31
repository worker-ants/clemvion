# 문서화(Documentation) 리뷰 — retry_last_turn 2차 claim 삽입 위치 수정

대상 커밋: `414550a1d` (`b351731f0` 위에 후속 ai-review CRITICAL #1/#2 수정). 리뷰 대상 파일:
`codebase/backend/src/modules/execution-engine/retry-turn.service.ts`,
`retry-turn.service.spec.ts`.

## 발견사항

- **[WARNING]** `claimSpawnedRetryRow` JSDoc 안에서 백스톱 커버리지에 대한 **자기모순 서술**.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:484-487` (대가/트레이드오프 문단) vs `:502-513` ("알려진 백스톱 갭" 문단)
  - 상세: 484-487 문단은 "복구는 `recoverStuckExecutions`(stale RUNNING Execution 재claim) 백스톱이 담당한다" 라고 **무조건** 서술한다. 바로 아래 502-513 문단(이번 커밋에서 신규 추가)은 동일 JSDoc 안에서 "실측 결과 그 백스톱은 **이 케이스에 닿지 않는다**" 라며 정확히 그 주장을 반증한다(`failOrphanRunningNodeExecutions` 는 stale RUNNING **Execution** 재구동 경로에서만 호출되는데, discard 후 Execution 은 이미 `failed`(terminal) 라 그 경로 대상이 아님). `git show 414550a1d` 로 확인한 결과 484-487 문단은 이전 라운드(`b351731f0`)의 인라인 주석을 그대로 옮겨온 것이고, 502-513 문단만 이번 커밋에서 새로 추가됐다 — 옮기면서 앞 문단을 반증 내용에 맞춰 손보지 않아 같은 메서드 안에 상호 모순되는 두 주장이 공존하게 됐다. 앞부분만 읽는 독자는 "복구는 이미 처리된다"고 오해할 수 있다.
  - 제안: 484-487 문단을 "형제 continuation 4종(`claimResumeEntry`)은 `recoverStuckExecutions` 백스톱으로 복구되지만, **이 2차 claim 경로는 그 백스톱이 닿지 않는다** — 상세는 아래 '알려진 백스톱 갭' 참조" 식으로 수정해 두 문단이 같은 결론을 가리키도록 정정.

- **[WARNING]** `runAiConversationLoop` 를 가리키는 stale 참조가 JSDoc 2곳에 남아 있음 (커밋 메시지 자체가 W10 으로 인지하고 있으나 파일에는 여전히 존재).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:123` (`retryLastTurn` 독스트링 "재진입 구현 완료" 문단), `:272-273` (`applyRetryLastTurn` 독스트링 "재진입 절차" 6번 항목)
  - 상세: 두 곳 모두 "`runAiConversationLoop` 로 재진입/구동" 이라고 서술하지만, 실제 재진입은 `this.aiTurnOrchestrator.processAiResumeTurn(...)` 이 수행한다(같은 파일 `:438` 인라인 주석 "옛 `runAiConversationLoop`(initialAction) 장수 루프 replay 를 turn-park 모델의 단발 처리기로 이관한다"가 이를 정확히 서술하고, `ai-turn-orchestrator.service.ts:186` 주석도 "옛 in-memory 장수 루프(`runAiConversationLoop`)는 제거됐다" 라고 확인해 준다). 즉 같은 파일 안에 정확한 서술(438)과 stale 서술(123, 272-273)이 공존한다. 이번 커밋이 바로 그 "재진입 절차" 리스트를 편집(항목 삽입 + 번호 재부여)했음에도 인접한 6번 항목의 stale 내용은 그대로 남았다.
  - 제안: 두 곳을 `processAiResumeTurn`(`AiTurnOrchestrator` 경유) 참조로 정정. 이미 `plan/in-progress/retry-turn-terminal-guard.md` 의 "W10" 으로 인지되어 "다음 문서-정리 턴" 으로 이월된 항목이므로 그 턴에서 함께 처리해도 무방하나, 지금 손 댄 리스트의 바로 옆 줄이라 회귀 위험 없이 같이 고칠 수 있었던 저비용 수정이었다.

- **[WARNING]** SoT spec 문서가 이번 커밋이 반증한 백스톱 주장을 그대로 유지 — 코드/plan 은 정정됐는데 spec 은 stale.
  - 위치: `spec/5-system/4-execution-engine.md:1387-1391` (`### retry 재진입의 원자 claim` 섹션의 "대가(의도된 트레이드오프)" 문단, 2026-07-28 작성)
  - 상세: 이 spec 문단은 "복구는 `recoverStuckExecutions`(stale RUNNING Execution 재claim, §7.5 case B) 백스톱이 담당한다" 라고 무조건 서술한다. 그런데 이번 커밋(`414550a1d`)이 `claimSpawnedRetryRow` JSDoc 에 추가한 "알려진 백스톱 갭" 문단과 `plan/in-progress/retry-turn-terminal-guard.md:340`(신규 항목 #15, "discard 후 Execution 은 이미 `failed`(terminal) 로 남아 그 경로 대상이 아니다")이 바로 이 주장을 실측으로 반증했다. 코드 JSDoc·plan 문서는 정정됐지만 프로젝트의 "단일 진실" spec 문서(`CLAUDE.md` 정보 저장 위치 원칙)는 여전히 예전 주장을 담고 있다 — `developer` 는 `spec/` 에 read-only 라 직접 고칠 수 없는 영역이다.
  - 제안: `project-planner` 턴으로 해당 spec 문단에 "이 2차 claim 경로에는 그 백스톱이 닿지 않아 discard 시 RUNNING orphan row 가 남을 수 있다"는 캐비앗을 반영. spec-impl 정합성 관점에서도 이 gap 은 `consistency-checker`/`spec-coverage` 대상.

- **[INFO]** `CHANGELOG.md` 가 이번 라운드(원자 claim의 삽입 위치 수정, CRITICAL #1/#2)를 반영하지 않음 — 개발자 스스로 W12 로 인지하고 "다음 문서-정리 턴" 으로 이월.
  - 위치: `CHANGELOG.md` (루트, "## Unreleased — AI multi-turn resume turn 경계 cancel 가드 + park 짝 전이 lost-update 차단" 항목 7)
  - 상세: 이 항목은 이전 커밋(`771801e3e`, "retry-turn 종결 2경로의 무가드 terminal 쓰기 차단")까지만 반영돼 있고, `b351731f0`(원자 claim 도입)·`414550a1d`(삽입 위치 결함 2건 수정) 은 언급이 없다. 이 파일은 바로 이 클래스의 동시성 수정을 상세히 기록해 온 전례가 있어(같은 섹션 6번 항목 등) 누락이 두드러진다.
  - 제안: 이미 추적 중(plan W12)이므로 급하지 않으나, "문서-정리" 턴에서 누락되지 않도록 우선순위 표에 명시적 항목화 권장(아래 참조).

- **[INFO]** 문서 부채 항목(W10 `runAiConversationLoop` stale 참조 / W11 `ContinuationExecutionProcessor` "처리 흐름" stale 서술 / W12 CHANGELOG 미갱신)이 plan 파일의 **번호 있는 우선순위 표**가 아니라 날짜 있는 라운드-로그 산문("조치하지 않음" 불릿)에만 기록됨.
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md` (같은 라운드에서 W2→#16, W4→#17 은 표에 번호로 추가됐으나 W10~W12 는 "### 조치하지 않음 (defer, plan 등재 — 위 §코드 표 #16·#17 신규)" 산문 블록에만 존재)
  - 상세: 이 프로젝트 자체의 과거 교훈(fix→리뷰 stale 루프에서 "미룬 항목은 그 턴에 plan/ 에 적어라 — 산문만으로는 유실된다")과 정확히 같은 패턴이다. 다음 라운드가 이 plan 파일의 우선순위 표만 훑으면 W10~W12 는 눈에 띄지 않아 누락될 위험이 있다.
  - 제안: W10/W11/W12 를 P3 항목으로 표에 번호 부여(예: #18~#20) 해 durable 하게 추적.

- **[INFO]** 스타일 일관성 — `claimSpawnedRetryRow` 는 단일 호출부(`applyRetryLastTurn`)를 갖고 순서 불변식이 치명적인데도, 같은 파일의 자매 private 종결 헬퍼(`completeRetryExecution`, `failRetryExecution`)가 쓰는 `@internal` + "다른 경로에서 호출하지 말 것" 경고 태그가 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:470-519` (`claimSpawnedRetryRow` JSDoc 전체)
  - 상세: 기능적 문제는 아니지만, 이 메서드의 "claim 은 반드시 손상 판정보다 먼저 호출돼야 한다" 라는 불변식 자체가 호출 순서에 민감하므로 자매 헬퍼와 동일한 태그 관례를 따르면 일관성이 좋아진다.
  - 제안: 선택 사항. `@internal` 태그 추가 고려.

## 검토했으나 문제 없음 (참고)

- `RetryTurnService` 클래스 최상단 "책임" 문단과 `applyRetryLastTurn` "재진입 절차" 번호 목록에 2차 claim 단계 반영(W9) — 정확하고 잘 반영됨.
- `claimSpawnedRetryRow` 의 SQL 조건(`jsonb_exists`, `status = :running`) 서술은 실제 구현과 정확히 일치.
- `delete spawnedRow.inputData[RETRY_STATE_KEY]` 관련 주석(:349-356)은 왜 필요한지, 무엇을 보호하는지 정확히 서술하고 테스트((d)/(e))도 이를 검증.
- `retry-turn.service.spec.ts` 의 신규/수정 테스트 설명 주석은 실제 동작(discard, save() 미호출, 재배달 안전성)과 일치하며 과장·누락 없음.
- `spec/4-nodes/3-ai/1-ai-agent.md` §7.9/§12.8 은 이번 변경으로 인한 사용자 가시 계약(에러 코드, WS 프로토콜) 변화가 없어 갱신 불필요 — 2차 claim 은 순수 내부 동시성 안전장치.
- 이 프로젝트는 모듈별 README 관례가 없음(spec/ 이 SoT) — README 미갱신은 정상.
- 신규 환경변수/설정 옵션 없음 — 설정 문서화 항목 해당 없음.

## 요약

코드 자체의 JSDoc/인라인 주석 밀도는 이례적으로 높고 대부분 정확하며, W9(클래스·메서드 독스트링에 2차 claim 반영)도 충실히 이행됐다. 다만 이번 커밋이 직접 추가한 `claimSpawnedRetryRow` JSDoc 안에서 "백스톱이 복구를 담당한다"는 옛 서술과 "실측 결과 그 백스톱은 닿지 않는다"는 신규 서술이 같은 곳에 모순되게 공존하는 것이 가장 눈에 띄는 결함이며, 이 모순의 상위 버전이 SoT spec 문서(`spec/5-system/4-execution-engine.md:1387-1391`)에도 그대로 남아 project-planner 턴을 필요로 한다. 그 외 `runAiConversationLoop` stale 참조·CHANGELOG 미갱신·산문에만 기록된 문서 부채 항목(W10~W12)은 개발자 스스로 이미 인지·이월한 항목들로 즉시 차단 사유는 아니지만, 다음 "문서-정리" 턴에서 실제로 처리되도록 plan 표에 번호로 고정해 두는 편이 이 프로젝트가 이미 겪은 "산문 유실" 패턴을 반복하지 않는다.

## 위험도

MEDIUM

# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 발견사항

- **[CRITICAL] `spec/1-data-model.md` §2.13 "Execution.error ↔ NodeExecution.error 관계" 의 "응답 마스킹" 행이 target 의 최신 결정과 직접 모순**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "적용 범위는 총칭이 아니라 열거다" 항목(2026-08-16 갱신) 및 "~~잔여 ①~~ 해소(2026-08-16)" 항목, `spec/5-system/6-websocket-protocol.md` §4.1 표 하단 "값-패턴 마스킹 (강제됨 — 결정 2026-08-16)" 캐비엇
  - 충돌 대상: `spec/1-data-model.md` L564 (`Execution.error ↔ NodeExecution.error 관계` 표의 "응답 마스킹" 행) — 이번 diff 에 포함되지 않은 별도 spec 영역
  - 상세: `spec/1-data-model.md` L564 는 두 가지를 주장한다. ① 마스킹이 걸리는 곳은 "`ExecutionsService` 4곳(`findById`·`toExecutionDto`·`getChain`·`stop`) + `BackgroundRunsService` body 노드" 라고 구체적 개수를 다시 적고 있다 — 그런데 target 의 `14-external-interaction-api.md` 는 바로 이 "4곳" 표기를 명시적으로 "낡았다" 고 지적하며(`"초판은 "4곳"이라 적었는데 이후 여섯으로 늘며 낡았다"`) 표면 **여섯** + 컬럼 **둘**(`error`, `outputData`)로 갱신했다. ② 더 심각한 것은 `1-data-model.md` 가 "⚠️ '이 두 컬럼은 어디서 나가든 마스킹된다' 로 읽으면 안 된다 — WS `execution.node.*` **emit** 등 별도 emit 계약 경로는 **미포함**이다" 라고 **명시적으로 부정**하는데, target 은 바로 이 PR 에서 "**잔여 ① 해소(2026-08-16)**: WS `execution.node.*` **emit** 경로의 `error` — 아래 'emit 경로 값-패턴 마스킹' 불릿이 닫았다" 라고 정정했고, `6-websocket-protocol.md` §4.1 에도 "위 execution/node 이벤트 payload 는 **emit 시점**에 자격증명 값-패턴이 마스킹된다 … 대상은 특정 필드가 아니라 payload 전체 … `error`(node.failed)" 를 강제 사양으로 추가했다. 즉 `1-data-model.md` 는 지금 **틀린 사실**(WS `execution.node.*` emit 은 마스킹 안 됨)을 단언하고 있으며, 이는 이 저장소가 이미 2회 반복해 겪은 "표면 열거 stale" 실패 패턴(같은 문서 안에서도 "4곳"→"여섯" 으로 정정)이 다른 spec 영역으로는 전파되지 않은 사례다. `git log` 상 이 행은 직전 커밋 `f5351e9c2`(현재 target 브랜치의 직계 부모, origin/main 에 이미 병합됨)에서 "4곳" 으로 확정된 뒤 이번 target 커밋들(`107c8038f`~`81c9fcd60`)이 그 전제를 두 번(표면 개수, WS 커버리지) 갱신했는데 `1-data-model.md` 는 갱신되지 않았다.
  - 제안: `spec/1-data-model.md` L564 를 (a) 구체적 개수를 다시 적지 않고 "`Execution.error` 는 [EIA §R17](./5-system/14-external-interaction-api.md#적용-범위는-총칭이-아니라-열거다) 열거를 SoT 로 egress 마스킹된다" 로 참조만 남기거나, (b) 최소한 "WS `execution.node.*` emit 은 미포함" 캐비엇을 삭제/정정해 "WS `execution.node.*` emit 도 emit 시점 값-패턴 마스킹 대상(2026-08-16)" 으로 갱신할 것. 이 저장소가 반복적으로 겪은 실패 형태이므로 target PR 범위에 `spec/1-data-model.md` 미러 갱신을 포함시키는 것을 권장한다.

- **[WARNING] `spec/5-system/13-replay-rerun.md` §10.2 Re-run 모달 문서에 `inputData` 비-마스킹 결정의 교차 참조가 없음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ② — `outputData` 해소, `inputData` 는 의도적 비대상(2026-08-16)" 항목 — "Re-run 모달이 `inputData` 를 프리필해 `inputOverride` 로 되보내고 … 마스킹하면 리터럴 `'***'` 가 **새 실행의 실제 입력값**이 된다" 라고 Re-run 모달 동작을 직접 인용
  - 충돌 대상: `spec/5-system/13-replay-rerun.md` §10.2(Re-run 모달, `rerun-modal.tsx` 대응 spec) — 이번 diff 에 포함되지 않음
  - 상세: target 이 인용하는 위험 경로(모달 프리필 → `useOriginalInput=false` 기본값 → `inputOverride` 재제출)의 **정본 spec 위치는 `13-replay-rerun.md` §10.2** 인데, 그 문서 자체에는 "`inputData` 는 egress 마스킹 대상이 아니며 마스킹해서는 안 된다" 는 취지의 캐비엇이 없다(모순은 아니고 **침묵**). 실제로 같은 브랜치의 `b05756d9e` 커밋이 "`inputData` 마스킹 철회" 를 다루면서 `12-webhook.md`·`14-external-interaction-api.md` 만 갱신하고 `13-replay-rerun.md` 는 건드리지 않았다. Re-run 모달을 직접 다루는 문서에 이 불변식이 없으면, 훗날 이 파일만 보고 작업하는 사람이 "표시 개선" 명목으로 `inputData` 마스킹을 재도입해 §R17 이 이미 CRITICAL 로 되돌린 회귀를 반복할 위험이 있다.
  - 제안: `13-replay-rerun.md` §10.2(또는 데이터 소스 절)에 "`inputData` 는 egress 마스킹 대상이 아니다 — 재제출되는 값이므로 마스킹하면 실제 입력을 오염시킨다 ([EIA §R17](../5-system/14-external-interaction-api.md#잔여--outputdata-해소-inputdata-는-의도적-비대상-2026-08-16))" 캐비엇 1줄 추가.

- **[INFO] `codebase/frontend` 유저 가이드(`run-results.mdx`/`.en.mdx`)의 별도 "실행 에러 응답 예시" 가 구 필드명(`nodeName`)·구 에러 코드(`NODE_EXECUTION_FAILED`)를 그대로 유지**
  - target 위치: `spec/5-system/3-error-handling.md` L258-259 (2026-08-17 정정 — `nodeName`→`nodeLabel`, "엔진 emit 은 전수가 `nodeLabel`" 실측 근거)
  - 충돌 대상: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` / `.en.mdx` L163-178 부근 "에러 메시지 해석" 예시(`"code": "NODE_EXECUTION_FAILED"`, `"nodeName": "AI Agent"`) — spec/** 이 아니라 codebase/** 이므로 엄밀히는 cross-spec 스코프 밖이나, 이번 target 이 고친 것과 **동일한 예시 문구**("Node 'AI Agent' failed: LLM connection timeout")를 미러하고 있어 spec 쪽만 고쳐지고 유저 문서 쪽 사본은 그대로 낡았다.
  - 상세: `3-error-handling.md` §1.4 는 "구 에러 코드 `NODE_EXECUTION_FAILED` … 는 노드 수준 envelope 에 더 이상 사용하지 않는다" 고 명시하는데, 이 유저 가이드 예시는 그 폐기된 코드와 `nodeName` 필드를 동시에 쓰고 있다(이번 PR 범위 밖의 기존 drift로 추정 — target 커밋은 같은 파일의 "Output" 행만 마스킹 캐비엇으로 수정했다).
  - 제안: 별도 documentation-sync 항목으로 처리(코드 리뷰/문서 동기화 담당). cross-spec CRITICAL/WARNING 대상은 아님.

## 요약

target(`spec/5-system/`)이 이번에 도입한 마스킹 관련 정정(`nodeName`→`nodeLabel`, EIA §R17 표면 열거 갱신, WS emit 레이어 값-패턴 마스킹 신설) 자체는 대상 파일 5개(`3-error-handling.md`·`6-websocket-protocol.md`·`12-webhook.md`·`14-external-interaction-api.md`·`15-chat-channel.md`) 사이에서는 상호 정합적이며, `conventions/conversation-thread.md`·`conventions/chat-channel-adapter.md`·`spec/2-navigation/14-execution-history.md`·`spec/3-workflow-editor/3-execution.md` 등 인접 영역과도 충돌이 없다(오히려 기존 교차 참조를 뒷받침한다). 다만 `spec/1-data-model.md` §2.13 의 "응답 마스킹" 행이 이번 target 갱신을 반영하지 못한 채 **WS `execution.node.*` emit 은 마스킹 미포함**이라는, 이제는 사실이 아닌 주장을 그대로 유지하고 있어 데이터 모델 SoT 문서와 EIA/WS 스펙 간에 직접적인 모순이 발생했다. 이 저장소가 반복적으로 겪어 온 "마스킹 카탈로그 미러 drift" 패턴의 재발이며, target PR 병합 전에 `1-data-model.md` 동반 갱신이 필요하다. `13-replay-rerun.md` 의 침묵은 모순은 아니나 동일한 재발 위험이 있어 WARNING 으로 별도 기록한다.

## 위험도
HIGH

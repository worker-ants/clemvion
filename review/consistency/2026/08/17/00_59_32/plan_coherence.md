Based on my review of the target spec changes (`spec/5-system/**` masking work — origin/main...HEAD) against the in-progress plans, particularly `plan/in-progress/eia-fanout-and-internal-data-masking.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, and adjacent EIA/WS plans:

### 발견사항

- **[WARNING]** `execution.node.*`/비-종결 `execution.*` emit 값-패턴 마스킹 추가가 다른 plan의 잔존 "미해소" 노트를 실질적으로 닫았는데 그 plan이 갱신되지 않음
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 신설 캐비엇("값-패턴 마스킹(강제됨 — 결정 2026-08-16)... 대상은 특정 필드가 아니라 payload 전체") + 구현 `codebase/backend/src/modules/websocket/websocket.service.ts`(`emitExecutionEvent`/`emitNodeEvent` 의 `maskWireEnvelope`)
  - 관련 plan: `plan/in-progress/ie-resume-turn-boundary-cancel.md` "6차 라운드 추가 후속" 절, `USER_MESSAGE` 라이브 시그널의 secret 마스킹 비대칭 (ai-review INFO, security)" 항목 (파일 내 그 근방)
  - 상세: `ai-turn-orchestrator.service.ts` 의 `emitUserMessageLiveSignal`(`USER_MESSAGE` 이벤트)는 `this.eventEmitter.emitExecution(...)` → `ExecutionEventEmitter.emitExecution` → `WebsocketService.emitExecutionEvent` 를 그대로 경유한다. 즉 이번 target 이 `emitExecutionEvent`/`emitNodeEvent` 공유 초크포인트에 건 `maskWireEnvelope` 는 필드명·이벤트 타입 무관 payload 전체에 적용되므로, `USER_MESSAGE` 의 `message` 필드도 이제 값-패턴 마스킹을 받는다. 그런데 `ie-resume-turn-boundary-cancel.md` (아직 `plan/in-progress/`, 미이동)의 6차 라운드 절은 이 항목을 여전히 "값-패턴 마스킹을 거치지 않는다"는 미해소 상태로 서술하고 있고, 이번 target·`eia-fanout-and-internal-data-masking.md`·`spec-sync-external-interaction-api-gaps.md` 어느 쪽도 이 교차 참조를 갱신하지 않았다. `spec-sync-external-interaction-api-gaps.md` 의 새 "잔여 ①·②·③" 열거·"WS 대기-재개 경로 재사용 점검" 신규 항목에도 이 구체적 사실(USER_MESSAGE 도 동일 초크포인트를 공유해 이미 해소됐다는 것)이 반영돼 있지 않다.
  - 제안: `ie-resume-turn-boundary-cancel.md` 의 해당 절에 "해소(2026-08-16/17, `emitExecutionEvent` 공유 초크포인트 `maskWireEnvelope` 도입으로 `USER_MESSAGE` 포함 전 execution 이벤트에 값-패턴 마스킹 적용됨 — [EIA §R17](../../spec/5-system/14-external-interaction-api.md)/[WS §4.1](../../spec/5-system/6-websocket-protocol.md#41))" 한 줄 addendum. 코드 변경은 불요(이미 커버됨) — 문서 정합만 필요.

이 외에는 확인된 문제가 없다:
- `eia-fanout-and-internal-data-masking.md` frontmatter `spec_impact` 는 이전 라운드(`00_47_04` WARNING)가 지적한 5개 누락을 7개 전체로 정정 완료(diff 파일 7개와 정확히 대응).
- `spec-sync-external-interaction-api-gaps.md` 의 A/B/D 항목 체크박스가 target diff 가 실제로 닫은 항목만 `[x]`, 새로 연 항목(SECRET_LEAK_PATTERNS `token=` 갭·`inputData` 프런트 마커 가드 선행·`kb:`/`background:run` 채널 검토·유저가이드 Error 탭·`sanitize-error-message.ts` JSDoc 배치)은 전부 `[ ]` 로 정확히 등재됨. target 이 이를 이미 닫힌 것처럼 과장하는 문구는 없음.
- "workflow-assistant LLM 도구(`explore-tools.service.ts`)의 마스킹 우선순위" 는 tracker(`:225`, "결정 항목")가 명시적으로 미결로 남긴 항목인데, target(§R17 "잔여 ③")도 정확히 "범위 밖 유지"로 같은 결정을 그대로 열어 둠 — 미해결 결정을 우회하지 않았다.
- `plan/complete/eia-internal-rest-error-masking.md` 로의 링크 정정(`./` → `../complete/`)이 실제 이동과 일치하며 파일 존재 확인됨.
- `retry-turn-terminal-guard.md` #4(P2, COALESCE 실 DB 검증 잔여)·`ws-event-types-extract.md`·`ai-agent-tool-connection-rewrite.md`·`cafe24-backlog-residual.md` 등은 target diff 범위와 겹치는 미해소 결정이 없음.

### 요약
Target(`spec/5-system/**` EIA/WS 마스킹 확장)과 정본 tracker(`spec-sync-external-interaction-api-gaps.md`)·집행 plan(`eia-fanout-and-internal-data-masking.md`)은 여러 라운드에 걸쳐 매우 높은 수준으로 정합화되어 있고, 이전 라운드(`00_47_04`)가 지적한 frontmatter drift 도 해소됐다. 유일하게 새로 발견한 것은 이번 target 의 emit 초크포인트 마스킹이 부수적으로 닫아버린 다른 plan(`ie-resume-turn-boundary-cancel.md`)의 잔존 보안 노트(`USER_MESSAGE` 마스킹 비대칭)가 그 plan 쪽에서 갱신되지 않은 문서 드리프트다 — 코드·spec 은 정확하고 사용자에게 미치는 실질 위험은 없으며(오히려 보안이 개선된 방향), 순수 plan 문서 정합 이슈다.

### 위험도
LOW

# Plan 정합성 검토 — spec/5-system/14-external-interaction-api.md (--impl-prep)

## 발견사항

- **[WARNING]** 신규 plan(`eia-terminal-payload.md`)이 종결 payload 정리 작업을 3개 기존 plan 과 교차 참조 없이 중복 등재
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 "종결 이벤트의 필드 집합 (normative)" 표 — `result.outputs`/`durationMs` "미구현 (Planned)", `error` "구현됨 — 형태 불일치" 행
  - 관련 plan:
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (target frontmatter 의 `pending_plans:` 로 지정된 **정본** plan) — "종결 이벤트의 `result.outputs`·`durationMs` emit", "`execution.failed` 의 `error` 를 객체로 통일" 두 항목이 아직 `[ ]` 미완료
    - `plan/in-progress/spec-draft-eia-notification-payload-contract.md` `## 후속 (developer)` 절 (185~207행) — 같은 두 항목을 거의 동일한 문구로 재서술 (`durationMs`·`result.outputs` 채우기, `error` 객체 통일)
    - `plan/in-progress/backend-lint-gate-broken-on-main.md` 774~791행 — 같은 항목을 `[developer]` 태그로 재등재하며 "택일 필요 — planner 결정"까지 남긴 이력을 보유
  - 상세: 새로 생성된 `plan/in-progress/eia-terminal-payload.md` (`--impl-prep` 착수 대상, 오늘 작성)는 위 세 plan 중 어느 것도 `grep` 결과 언급하지 않는다. 세 plan 모두 지금 이 정확한 코드 지점(`execution-engine.service.ts`/`retry-turn.service.ts` 의 종결 emit)을 대상으로 동일한 미해결 항목을 들고 있다. 이 저장소는 "SoT 한쪽만 고친다" 재발을 여러 차례 겪었고(§Rationale/메모리), 이번에도 구현이 끝난 뒤 `eia-terminal-payload.md` 체크리스트만 닫히고 세 plan 의 `[ ]` 는 그대로 남을 위험이 크다(다음 spec-coverage/plan_coherence 라운드가 다시 "빈 약속" 로 재발견하게 된다).
  - 제안: `eia-terminal-payload.md` 에 위 세 plan 을 명시적으로 역참조로 추가하고, 구현 완료 시 세 plan 의 해당 체크박스를 함께 닫는 절차를 체크리스트에 포함할 것 (plan 갱신).

- **[WARNING]** `eia-terminal-payload.md` 범위가 정본 plan 이 명시한 "동반 필수" 정리(back-compat wrap·유령 타입 필드)를 누락
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 도입부 "삭제된 약속" 콜아웃 — `finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId` 는 "엔진에 개념 자체가 없다... 되살리지 않는다"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "`execution.failed` 의 `error` 를 객체로 통일" 항목 — "통일되면 그 wrap 과 union 을 함께 제거한다" / `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 192행 "`chat-channel/types.ts:388` 을 (1) 최종형과 동기화"
  - 상세: 코드 실측 결과 두 갭이 현재도 살아 있다. (1) `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:535~568` 의 `execution.failed` 분기가 `errorRaw` 가 string 인지 object 인지 런타임에 분기하는 back-compat wrap 을 유지 중이며, 주석이 "후속: execution-engine 의 emit shape 를 spec EIA §6.4 정합으로 마이그레이션하는 별 plan (`spec-update-execution-failed-payload-shape`)" 을 가리키는데 그 plan 은 저장소에 존재한 적이 없다(이미 `backend-lint-gate-broken-on-main.md` 776행이 확인). (2) `codebase/backend/src/modules/chat-channel/types.ts:386~390` 의 `EiaCompletedEvent.result` 타입이 여전히 `finalNodeId?: string; finalPort?: string` 를 선언하는데, target §6 은 이 필드들이 "설계된 적이 없다"고 명시했다 — 타입과 spec 이 어긋난 채 방치돼 있다. `eia-terminal-payload.md` 의 범위 목록(§`## 범위`)에는 이 두 파일이 전혀 등장하지 않는다.
  - 제안: `eia-terminal-payload.md` 범위에 (a) `chat-channel.dispatcher.ts` back-compat wrap 제거/단순화 + 그 stale 주석의 존재하지 않는 plan-name 참조 정정, (b) `chat-channel/types.ts` `EiaCompletedEvent.result` 에서 `finalNodeId`/`finalPort` 제거를 명시적으로 추가할 것 (plan 갱신). 둘 다 developer 권한 내 코드 변경이라 planner 위임 대상이 아니다.

- **[WARNING]** 동일 코드 블록(`retry-turn.service.ts` `failRetryExecution` 의 `emitExecution` 호출, :956~965)을 겨냥하는 두 plan 이 서로를 참조하지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 `result.cancelledBy` 행("경로 1곳 누락... `retry-turn-terminal-guard` #2") 및 `error` 행("현행 일부 경로는 string")
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md` 307~311행 (`[ ]` 미완료, "`EXECUTION_CANCELLED` payload 에 `cancelledBy` 누락") vs `plan/in-progress/eia-terminal-payload.md` §"착수 전 갈라야 할 것" 표의 `retry-turn.service.ts:963` 행
  - 상세: 실코드(`codebase/backend/src/modules/execution-engine/retry-turn.service.ts:956~965`)를 확인하면 두 plan 이 고치려는 자리가 **같은 10줄짜리 object literal**(`emitExecution(... { status: finalStatus, ...(!isCancelled ? { error: errMessage } : {}) })`)이다 — `eia-terminal-payload.md` 는 `error: errMessage` 를 객체로 바꾸려 하고, `retry-turn-terminal-guard.md` #2 는 같은 emit 에 `cancelledBy` 를 추가하려 한다. `eia-terminal-payload.md` 는 이 사실을 인지하지 못한 채 라인 번호만 인용하고 있다(`grep` 결과 두 plan 모두 서로를 언급하지 않음). target §6 표는 이 둘을 별개 행으로 정확히 인용하고 있어 spec 자체는 정합하지만, 구현 계획 차원에서 조율이 없으면 한쪽 PR 이 다른 쪽이 아직 반영하지 않은 필드를 놓친 채 그 자리를 다시 건드리게 된다.
  - 제안: `eia-terminal-payload.md` 착수 시 같은 턴에 `retry-turn-terminal-guard.md` #2(`cancelledBy`)도 함께 처리하거나, 최소한 두 plan 사이에 상호 참조를 남겨 순서/충돌을 명시할 것.

- **[INFO]** `eia-terminal-payload.md` 의 "nodeId 필수 여부" 미해결 표시가 target 에 의해 이미 답변돼 있음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 `execution.failed` 페이로드 예시 — `"nodeId": "uuid" | null,` (커밋 `9a4d3e32b`, 2026-08-13)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` §"착수 전 갈라야 할 것 — `nodeId`" — "`Execution.error` 컬럼은 ... `nodeId` 를 저장한 적이 없다", "`:3301`(worker 크래시)은 노드가 아예 없다... 결론에 따라 (a) `nodeId` 를 optional 로 정정(planner) 또는 (b) 확보 가능한 경로에만 채움"
  - 상세: target 의 `nodeId` 필드는 이미 `"uuid" | null` 로 nullable 선언돼 있다(§6.4, 바로 전 세션 `spec-draft-eia-notification-payload-contract.md` 작업의 산출물). 즉 plan 이 "planner 결정이 필요할 수 있다"고 열어둔 (a) 경로는 이미 spec 이 답을 준 상태이며, `nodeId` 가 없는 경로(worker 크래시)는 `null` 을 채우면 그대로 스펙 합치다. 이것은 target-plan 충돌이 아니라 plan 의 전제가 최신 target 반영 전 시점 기준으로 쓰여 있다는 뜻이다.
  - 제안: `--impl-prep` 착수 시 이 항목을 재확인해 planner 에스컬레이션 없이 (b) 경로(가능한 곳만 채우고 나머지는 `null`)로 바로 진행할 것. plan 문구를 "이미 nullable 로 정합됨" 으로 갱신 권장.

## 요약

target(`spec/5-system/14-external-interaction-api.md`) 자체는 관련 plan 들(특히 정본으로 지정된 `spec-sync-external-interaction-api-gaps.md`, `retry-turn-terminal-guard.md`)의 미완료 항목을 정확히 반영하고 있어 spec ↔ plan 사이의 직접적 결정 충돌은 없다. 다만 이번 세션에서 새로 생성된 실행 plan(`plan/in-progress/eia-terminal-payload.md`)이 착수 직전임에도, 완전히 동일한 작업을 이미 추적 중인 3개 plan(spec-sync-external-interaction-api-gaps.md/spec-draft-eia-notification-payload-contract.md/backend-lint-gate-broken-on-main.md) 및 동일 코드 블록을 겨냥하는 1개 plan(retry-turn-terminal-guard.md #2)과 교차 참조 없이 독립적으로 등재됐다. 정본 plan 이 명시한 "동반 필수" 정리(chat-channel.dispatcher.ts back-compat wrap, chat-channel/types.ts 유령 필드)도 새 plan 범위에서 빠져 있어, 이대로 구현하면 체크박스 drift 와 미완료 정리가 재발할 위험이 있다. CRITICAL(미해결 결정 우회)은 없음 — 전부 WARNING(plan 간 조율 누락)과 INFO(이미 해소된 전제 재확인) 수준.

## 위험도
MEDIUM

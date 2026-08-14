# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 발견사항

- **[WARNING]** `eia-terminal-payload.md` 가 스스로 "미등재" 라 적은 companion 항목이 실제로도 체크리스트에 없다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 (`error.code` / `nodeId` nullable 계약, 필드 집합 표)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` — ③-d 절(96~98행)과 "동반 필수" 체크리스트(172~177행)
  - 상세: ③-d 는 `chat-channel/types.ts:392-401` 의 `EiaFailedEvent.error.code`(현재 `string`, non-nullable)·`nodeId`(현재 optional) 가 #1169 이후 §6.4 의 `code: … | null` 계약과 어긋났고 **"plan 이 등재하지 않았던 항목"** 이라고 스스로 명시했다. 실측으로 재확인: `codebase/backend/src/modules/chat-channel/types.ts:392-401` 은 지금도 `code: string`(non-nullable) 이다. 그런데 실행 체크리스트인 "동반 필수" 절(172~177행)에는 이 항목이 여전히 없고, `chat-channel.dispatcher.ts` wrap 정리·`EiaCompletedEvent.result` 유령 필드 2건만 있다. `error` 객체화 구현 시 이 목록만 보고 작업하면 §6.4 nullable 계약과 `EiaFailedEvent` 타입이 계속 어긋난 채 남는다.
  - 제안: `eia-terminal-payload.md` "동반 필수" 절에 `chat-channel/types.ts:392-401` (`EiaFailedEvent.error.code`/`nodeId` nullable 동기화) 항목을 추가할 것.

- **[WARNING]** `eia-terminal-payload.md` "범위" 체크리스트가 같은 문서의 "범위 조정" 결정과 어긋난다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 (`durationMs`/`result.outputs` Planned 행)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` — "재판정 ③ 에 따른 범위 조정"(114~122행) vs "범위" 체크리스트(166~178행) 및 체크리스트 최하단 205행
  - 상세: 114~122행은 `durationMs`(취소 경로 DB write + emit 시그니처 확장 필요, ③-c) 와 `result.outputs` 를 **"다음"** PR 로 명시적으로 분리했다("이번 PR — error 객체화 4곳 … 다음 — durationMs(cancel 배관 포함) + result.outputs"). 그런데 그보다 아래 있는 "범위" 절(166~178행)은 여전히 `durationMs`·`result.outputs` 를 이번 작업 범위 체크박스로 나열하고, 체크리스트 최하단 205행("planner 턴 완료")의 서술도 "종결 payload 구현(error 객체화·durationMs·result.outputs)을 이제 착수할 수 있다" 고 셋을 함께 언급한다. `--impl-prep` 재실행 이후 이 문서만 보고 착수하면 방금 내린 범위 축소 결정과 반대로 durationMs/result.outputs 까지 같은 PR 에 넣을 위험이 있다.
  - 제안: "범위" 절의 `durationMs`·`result.outputs` 두 줄에 "다음 PR 로 이연(재판정 ③ 범위 조정 참조)" 각주를 달거나 별도 하위 목록으로 분리하고, 205행의 서술도 "error 객체화만 착수 가능, durationMs/result.outputs 는 후속 PR" 로 정정할 것.

- **[WARNING]** `spec-draft-eia-62-waiting-payload.md` 가 이제 반증된 실측 전제를 그대로 갖고 있다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 Rationale (`code` nullable 근거 문단) — 현재 작업 트리에서 이미 정정됨(uncommitted diff)
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (4)절 118~121행
  - 상세: `eia-terminal-payload.md` ③-b 가 "`code` 를 만드는 건 sentinel 뿐" 이라는 전제를 반증했다(`WORKER_HEARTBEAT_TIMEOUT` 무조건 부착 + 취소 계열 `RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT` 도 코드를 만듦) 그리고 target spec §6.4 Rationale 은 이미 그 문장을 정정했다(uncommitted diff 확인). 그러나 그 문장의 최초 출처인 `spec-draft-eia-62-waiting-payload.md` (4) 절은 여전히 "실측: 종결 `error` 를 싣는 4개 지점 중 `code` 를 실제로 갖는 것은 `finalizeFailedExecution` 의 sentinel 경로(`ErrorPortFallbackError`/`ExecutionTimeLimitError`)뿐이다" 라는 반증된 문장을 그대로 갖고 있다. 이 plan 문서는 자신의 다른 절(예: (3))에서 "틀린 근거를 남겨 두면 다음 사람이 그걸 인용해 또 틀린다" 는 정확히 같은 위험을 스스로 경계하고 있어, 이번 누락은 그 원칙의 예외가 아니라 재발이다. 결론(`code` nullable)은 안 바뀌므로 CRITICAL 은 아니지만, 이 plan 이 향후 다시 인용될 근거 문서로 남아 있다.
  - 제안: `spec-draft-eia-62-waiting-payload.md` (4)절에 "정정(2026-08-14, `eia-terminal-payload.md` ③-b)" 각주를 달아 실제로 코드를 만드는 경로가 여럿임을 반영할 것 — 결론 자체는 유지.

## 요약

target(`spec/5-system/14-external-interaction-api.md`)과 `plan/in-progress/**` 사이의 미해결 결정 충돌은 발견되지 않았다 — §6.2 봉투 래퍼·`error.code`/`nodeId` nullable·data-model §2.14·WS §4.4 strip 범위(깊이 무관)·§R8 캐시 닫힌 목록 등, 지금까지 여러 라운드에 걸쳐 조정된 결정들은 target 문서에 정확히 반영돼 있고 관련 plan(`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-r8-alignment.md`, `spec-draft-eia-notification-payload-contract.md`, `spec-sync-external-interaction-api-gaps.md`)의 체크리스트와도 실측상 어긋나지 않는다. 다만 진행 중인 `eia-terminal-payload.md` 자체가 같은 날 세 차례(①②③) 재판정을 거치며 스스로 만든 최신 결정(범위 분리·companion 타입 수정 필요성)을 자신의 실행형 체크리스트(동반 필수/범위) 및 자매 plan(`spec-draft-eia-62-waiting-payload.md`)의 근거 문단에 완전히 전파하지 못했다 — 전부 결론을 뒤집는 수준은 아니지만, `--impl-prep` 을 통과시킨 뒤 실제 구현 착수 시 체크리스트만 보고 진행하면 (a) `EiaFailedEvent` 타입 동기화 누락, (b) 방금 내린 PR 분할 결정 위반 스코프 진행, (c) 반증된 근거 재인용의 세 가지 재발 위험이 있다. 세 항목 모두 developer 권한 내 plan 문서 수정으로 즉시 해소 가능한 WARNING 수준이며, spec 쓰기 권한이 필요한 CRITICAL 항목은 없다.

## 위험도

MEDIUM

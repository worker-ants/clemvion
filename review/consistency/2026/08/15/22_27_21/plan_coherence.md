### 발견사항

- **[WARNING]** `KbEventType` 정본 위치 서술이 target(`spec/5-system/**`) 3곳에서 아직 stale — plan 은 이미 인지·등재했지만 target 은 미반영
  - target 위치:
    - `spec/5-system/6-websocket-protocol.md:740` — "backend 권위 정의는 `WebsocketService` 의 `KbEventType` union"
    - `spec/5-system/6-websocket-protocol.md:1034` — "`WebsocketService.emitKbEvent` 의 `KbEventType` union" (plan 은 "부분만 stale" 로 정확히 진단 — 메서드는 안 옮겼으니 그 부분은 여전히 맞고 union 소재만 낡음)
    - `spec/5-system/8-embedding-pipeline.md:276` — "backend 권위 정의는 `WebsocketService.emitKbEvent` (KbEventType union)"
    - `spec/5-system/10-graph-rag.md:552` — "`websocket.service.ts` 의 `KbEventType` union 에서 #443 에서 제거됐다"
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` §"후속 (이 PR 범위 밖)" → "planner 턴 — 이동한 심볼의 '정본 위치' 서술 stale (전수)" — 위 4곳을 포함해 `spec/data-flow/6-knowledge-base.md:288`·`spec/data-flow/0-overview.md:110` 까지 총 6곳을 unchecked(`[ ]`)로 정확히 열거해 두었다
  - 상세: 이번 diff(`ExecutionEventType`/`NodeEventType`/`KbEventType` 등을 `websocket.service.ts` → `websocket-events.types.ts` 로 이동)로 `KbEventType` union 의 실제 소재가 바뀌었는데, target spec 은 여전히 `WebsocketService`/`websocket.service.ts` 를 union 의 정본 위치로 지목한다. re-export 가 살아 있어 "거짓" 은 아니지만(plan 표현 그대로), 새 파일 구조의 SoT 를 반영하지 못한다. plan 자체가 이 gap 을 이미 정확히 실측·등재했으므로 **누락은 없다** — 다만 target 문서 본문은 이 리뷰 시점까지 미수정 상태다
  - 제안: plan 이 이미 명시한 대로 별도 **planner 턴**에서 6곳을 심볼(`KbEventType`) 기준으로 일괄 정정. 이번 PR(ws-event-types-extract, `spec_impact: none`) 은 값/타입 이동만을 스코프로 명시했으므로 이 gap 을 이번 PR 에서 닫을 필요는 없음 — 다만 정합 시점까지 target 이 stale 함을 기록해 둔다

- **[INFO]** `spec_impact: none` 선언이 실제 diff(spec 파일 1줄 변경)와 문자 그대로는 어긋난다
  - target 위치: (해당 없음 — plan frontmatter)
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` frontmatter `spec_impact: none`
  - 상세: `git diff origin/main...HEAD -- spec/5-system/6-websocket-protocol.md` 는 frontmatter `code:` 목록에 `websocket-events.types.ts` 1줄이 추가된 것을 보여준다. Gate C(`spec_impact`) 는 `plan/complete/` 이동 시점에만 강제되므로(in-progress 단계는 의무 아님) 현재 차단 사유는 아니다. 다만 이 plan 이 나중에 `plan/complete/` 로 이동할 때 `spec_impact: none` 을 그대로 두면 게이트가 통과하더라도 실제로는 `spec/5-system/6-websocket-protocol.md` 를 건드린 셈이라 필드가 부정확해진다(위 WARNING 의 6개 후속 항목이 실행되면 추가로 더 늘어날 목록)
  - 제안: `plan/complete/` 이동 시점에 `spec_impact` 를 `none` → 실제 변경 파일 목록(최소 `spec/5-system/6-websocket-protocol.md`)으로 갱신할 것을 완료 체크리스트에 남겨 둘 것

### 요약
검토 대상 diff 는 사실상 `plan/in-progress/ws-event-types-extract.md` 단일 작업(순환 참조 우회를 위한 `websocket.service.ts` → `websocket-events.types.ts` 값/타입 추출, `spec_impact: none` 리팩터)이며, 이 plan 은 이례적으로 자기 감사가 철저해 — 6라운드 ai-review 수렴, 심볼 기준 라인 인용 재확인, `NotificationEventType` 충돌 방지 JSDoc, 자매 트래커(`spec-sync-external-interaction-api-gaps.md` W7) 동시 갱신 — plan 정합성 관점에서 새로 지적할 미해결 결정 충돌이나 선행 plan 미해소는 발견되지 않았다. 유일한 잔여 문제는 이 PR 이 만든 심볼 이동이 target(`spec/5-system/`) 3곳(그리고 `spec/data-flow/` 2곳)에 stale `KbEventType` 위치 서술을 남겼다는 것인데, 이는 plan 자신이 정확히 실측·등재해 둔 채 "이 PR 범위 밖 — planner 턴" 으로 명시적으로 미룬 상태다. 즉 plan 과 target 사이에 숨겨진 모순은 없고, 이미 알려진 채 open 인 후속 항목이 그대로 open 상태로 남아 있을 뿐이다.

### 위험도
LOW

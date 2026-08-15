# Plan 정합성 검토 — `spec/5-system/` (--impl-done, diff-base=origin/main)

대상 브랜치: `claude/ws-event-types-extract` (실제 diff: `websocket.service.ts` 의
런타임 값/타입을 `websocket-events.types.ts` 로 분리하는 리팩터 + `6-websocket-protocol.md`
frontmatter `code:` 목록 갱신 1줄).

## 발견사항

- **[WARNING]** `KbEventType` 정본 선언 위치 stale 서술 — 후속 항목이 실제 범위보다 좁게 등재됨
  - target 위치: `spec/5-system/6-websocket-protocol.md:740`, `:1034`,
    `spec/5-system/8-embedding-pipeline.md:276` (+ 참고: `spec/data-flow/6-knowledge-base.md:288`,
    target 범위인 `spec/5-system/` 밖이지만 같은 문구 반복)
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` §"후속 (이 PR 범위 밖)"
    (line 156) — `19_27_37` 코드 리뷰 INFO1 로 등재된 항목
  - 상세: 이번 리팩터로 `KbEventType` 의 정본 선언이 `websocket.service.ts` 에서
    `websocket-events.types.ts` 로 실제 이동했다(`websocket-events.types.ts:254`,
    `websocket.service.ts` 는 `export type { KbEventType }` 로 re-export 만 함,
    `websocket.service.ts:22-45`). plan 의 후속 항목은 이 staleness 를
    **`spec/5-system/10-graph-rag.md:552` 한 곳만** planner 턴 대상으로 적어 뒀다. 그런데
    똑같이 `WebsocketService` 를 `KbEventType` union 의 소유자로 지목하는 문장이
    `spec/5-system/` 안에만 최소 3곳 더 있다(`6-websocket-protocol.md` §4.3 "backend
    권위 정의는 `WebsocketService` 의 `KbEventType` union", 같은 파일 §KB 채널 단위 전환
    절 "`WebsocketService.emitKbEvent` 의 `KbEventType` union", `8-embedding-pipeline.md`
    §8 "backend 권위 정의는 `WebsocketService.emitKbEvent` (KbEventType union)"). re-export
    덕에 문장이 즉시 거짓은 아니지만(plan 이 graph-rag.md 건에 대해 이미 같은 논리로
    INFO 처분), 그 논리를 적용한다면 나머지 세 곳에도 동일하게 적용돼야 하는데 후속
    항목 리스트는 그중 하나만 담아, planner 턴이 그 항목만 처리하고 "해소"로 닫으면
    나머지가 조용히 stale 로 남는다.
  - 제안: `ws-event-types-extract.md` §후속 항목을 갱신해 위 3곳(및 `data-flow/6-knowledge-base.md:288`)을
    함께 나열하거나, "`WebsocketService` 의 `KbEventType`" 패턴 전체를 `grep -rn` 으로
    잡아 planner 턴 인계 시 전수 목록을 넘기도록 항목 문구를 바꿀 것. 코드 자체는
    developer 권한 밖이라 이번 PR 이 막을 이유는 아님(INFO 수준 처분과 동일 근거) —
    plan 문서만 갱신하면 된다.

## 요약

이번 diff(`websocket.service` 값/타입을 `websocket-events.types.ts` 로 분리)는 정본 트래커
(`spec-sync-external-interaction-api-gaps.md`)와 개별 plan(`ws-event-types-extract.md`)이
같은 커밋에서 동시 갱신됐고, 다른 in-progress plan 들의 `websocket.service.ts:<line>` 절대
라인 인용도 전수 확인해 심벌 기준으로 정리돼 있어(§"하위 라인 인용 재확인") 전반적으로
plan 정합성 관리가 꼼꼼하다. `spec/5-system/6-websocket-protocol.md` frontmatter `code:`
목록 추가도 기계적 동기화로 기존 선례(`spec-draft-eia-r8-alignment.md` 사후 기록)와 같은
근거로 정당화된다. 유일한 발견은 developer 가 이미 planner 턴으로 인계한 "`KbEventType`
정본 위치 서술" 후속 항목이 실제로는 1곳이 아니라 최소 3~4곳에 걸쳐 있는데 plan 이 1곳만
등재해, 향후 planner 턴이 부분적으로만 처리하고 종결 처리될 위험이 있다는 점이다. 이 diff
를 막을 사안은 아니며(developer 권한 밖·INFO 급 판단이 이미 내려짐) plan 문서 갱신만
필요하다.

## 위험도
LOW

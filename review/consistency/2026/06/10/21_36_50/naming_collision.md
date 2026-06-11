# 신규 식별자 충돌 검토

## 발견사항

- **[INFO]** 04 m-4 — 새 Redis pub/sub 채널 이름이 plan/spec 어디에도 명시되지 않음
  - target 신규 식별자: 미정 (integration credential 회전 알림용 Redis pub/sub 채널명)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/5-system/4-execution-engine.md §9.1–9.2` 에 기존 Redis 키/채널 패턴(`{service}:{workspaceId}:{resource}`)과 BullMQ 큐 카탈로그가 정의돼 있다. `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/4-nodes/4-integration/2-database-query.md §2` 는 현재 단일-인스턴스 evict 만 기술하며 Redis 채널은 정의하지 않는다.
  - 상세: `plan/in-progress/refactor/04-security.md m-4` 는 "integration 업데이트 이벤트 pub/sub(Redis) 전파 → 전 인스턴스 해당 integrationId 풀 즉시 evict" 를 확정안으로 기술하나 채널 이름 문자열을 지정하지 않았다. 기존 Redis 키 패턴(`exec:*`, `core:*`, `ws:*`)과 충돌하는 이름으로 구현될 경우 식별자 충돌이 발생할 수 있다. 기존에 폐기된 `execution:continuation` 채널과 같은 colon-separated 패턴이 관행이지만 `integration:*` 공간은 현재 공문서화 상태다.
  - 제안: 구현 착수 전 채널 이름(예: `integrations:credential-rotated`) 을 `spec/4-nodes/4-integration/2-database-query.md §2` 또는 실행 엔진 §9.1 Redis 키 표에 먼저 등재해 다른 pub/sub 용도와의 충돌을 방지한다.

## 충돌 없음으로 확인된 항목

- **03 M-6**: `registerContinuationHandlers` 함수 + deprecated `on()` 메서드 **제거** — 새 식별자 없음. 해당 심볼은 `plan/in-progress/refactor/03-maintainability.md M-6` 에 dead code 로 확인됐고, `spec/5-system/4-execution-engine.md §7.4` 는 이미 BullMQ 단일 경로만 기술한다.
- **03 m-2**: `toEiaEvent` alias + system-status 상수 2건 **제거**, `types.ts` deprecated 주석 정리 — 새 식별자 없음. 모두 "외부 참조 0건" 확인된 예약 삭제 심볼이다.
- **06 M-5**: parallel branch `nodeOutputCache` 값 dev/test `Object.freeze` — `nodeOutputCache` 는 `spec/4-nodes/1-logic/10-parallel.md:14` 에 이미 정의된 기존 식별자. `Object.freeze` API 는 표준 JS 전역이라 충돌 없음.
- **06 M-1**: WS `resumed` ack 필드 spec 문구 정리(planner-only) — 코드 식별자 추가 없음. `resumed` 필드는 `spec/5-system/6-websocket-protocol.md §4.2` 에 기존 정의된 식별자이며, 이번 변경은 의미 재정의(enqueue 수락 여부)지 이름 신설이 아니다.
- **review_guard `_porcelain_path` off-by-one fix**: `.claude/hooks/_lib/review_guard.py` 의 기존 private 메서드 버그 수정 — `_porcelain_path` 는 이미 존재하는 메서드명이며 새 식별자 없음.

## 요약

이번 구현 묶음(dead code 제거 3건 + dev/test deep freeze + credential rotation pub/sub + spec 문구 정리 + tooling 버그 수정)은 전반적으로 기존 식별자의 **제거 또는 내부 구현 변경**에 해당하며 신규 식별자 충돌 위험은 매우 낮다. 유일한 주의 지점은 `04 m-4` 의 Redis pub/sub 채널 이름으로, 현재 plan/spec 어디에도 구체 문자열이 지정되지 않아 구현 시점에 기존 `exec:*`/`ws:*`/`core:*` 공간과 충돌할 가능성이 0 은 아니다. 이는 INFO 수준이며, 채널 이름을 spec에 먼저 등재하면 충분히 예방 가능하다.

## 위험도

LOW

STATUS: OK

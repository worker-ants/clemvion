# 테스트(Testing) Review

## 검토 범위 확인

실제 실행 코드 변경은 2개 파일이다(나머지 `review/code/2026/07/17/02_31_18/**`는 직전 라운드의 리뷰 산출물 기록으로, 테스트 가능한 코드가 아니다 — 지적 사항 없음).

1. `codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatus` 반환 타입을 `Promise<boolean>` → `Promise<SeedOutcome>`(`"ended" | "stale" | "continue"`) 3-state 로 승격, `sendCommand`(410)·`endConversation`을 `finalizeEnded` 경유로 통합.
2. `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — `applyConfig` 종료 회귀 테스트의 decorative assertion 을 fake timer 로 실효화, 신규 3개 테스트 추가(W5: `start()` 직후 terminal, W7a: staleness 폐기, W7b: 410/SSE terminal dedup).

이하 발견사항은 **실제로 mutation 을 가해 재현·검증**한 것과, 코드 정독으로 확인한 것을 구분해 표기한다. (mutation 재현 후 `git status`/`git diff`로 워크트리 원상복구 확인 완료.)

## 발견사항

- **[WARNING]** `applyConfig`(세션 복원) 경로 고유의 `"stale"` 게이팅을 exercise 하는 테스트가 없음 — mutation 으로 재현 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:643-646`(`const outcome = await seedWaitingFromStatus(clientRef.current, saved); if (outcome !== "continue") return;`)
  - 상세: RESOLUTION.md 는 이번 라운드의 핵심 성과로 "`Promise<boolean>`→ 3-state `SeedOutcome` 승격, 세 호출부 모두 `!== \"continue\"` 로 게이팅. mutation 확인 — staleness 가드 무력화 시 신규 테스트 1건 실패"라고 기록한다. 실제로 `seedWaitingFromStatus` **함수 내부**의 공유 staleness 체크(`if (sessionRef.current !== session) return "stale";`)를 무력화하면 신규 W7(a) 테스트(`stale 응답(세션 교체 후 도착)은 폐기된다`)가 정확히 실패한다 — 이 부분은 직접 재현해 확인했다.
    그러나 W7(a) 테스트는 `start()` → `handleEiaEvent`("execution.replay_unavailable") 경로로만 staleness 를 유발한다. `applyConfig`(마운트 시 세션 복원) 자신의 outer 게이팅 라인(`:646`)을 `if (outcome !== "continue") return;` → `if (outcome === "ended") return;`(즉 `"stale"`을 빠뜨린 mutation)로 좁혀도 **현재 33개 테스트 전부 통과**함을 직접 재현해 확인했다. 이는 정확히 SUMMARY.md WARNING #2 가 원래 지적했던 시나리오(마운트 직후 `getStatus` 왕복 중 host 가 새 대화를 시작 → 지연 응답이 새 대화의 SSE 스트림을 옛 토큰으로 탈취)의 **바로 그 코드 위치**이므로, 공유 가드 로직이 다른 호출부(`replay_unavailable`)를 통해 간접적으로 보호된다는 사실이 `applyConfig` 자체의 게이팅 라인이 옳다는 것까지 보장하지 않는다.
  - 제안: 저장 세션을 pre-seed 한 뒤 `boot()`(→`applyConfig`)이 발행하는 `getStatus` 를 pending 상태로 잡아두고, 그 사이 `actions.newChat()`(또는 host `resetSession`)으로 세션을 교체한 뒤 terminal 응답을 resolve 시켜 — `openStream`이 옛 토큰으로 재오픈되지 않고 새 대화 상태가 오염되지 않음을 단언하는 `applyConfig` 전용 회귀 테스트 추가.

- **[WARNING]** 신규 fake-timer 테스트가 `try/finally` 없이 `vi.useRealTimers()`를 마지막 줄에서만 호출 — 같은 파일의 기존 관례와 불일치, 조기 실패 시 fake timer 가 후속 테스트로 누수
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:218-257`(`vi.useFakeTimers({ shouldAdvanceTime: true })` … `expect(refreshCalls).toBe(0); vi.useRealTimers();`)
  - 상세: 같은 파일의 기존 fake-timer 테스트(`:764-814`, "fake timer: BOOTED 후 refresh delay(만료 30분 전) 경과 → refresh-token 호출")는 `try { … } finally { vi.useRealTimers(); }` 로 감싸 어떤 단언이 실패해도 fake timer 를 확실히 해제한다. 이번에 수정된 테스트(:218-257)는 이 관례를 따르지 않고 `vi.useRealTimers()`를 블록 맨 끝에만 둔다 — 앞선 `expect` 3개(`getEs()`, `sessionStorage.getItem`, `refreshCalls`) 중 하나라도 실패하면 `vi.useRealTimers()`가 스킵된다.
    직접 `expect(refreshCalls).toBe(999)`로 강제 실패시켜 재현한 결과, 이 특정 스위트에서는 `shouldAdvanceTime: true` 옵션 덕분에 나머지 32개 테스트가 (real `setTimeout` 기반 대기 포함) 예외 없이 통과했다 — 즉 **현재는 실질적 cascading failure 로 이어지지 않음**을 확인했다. 다만 이는 `shouldAdvanceTime` 옵션의 부수 효과에 의존하는 우연한 안전성이며, 코드 구조 자체는 여전히 다음 사람이 옵션을 바꾸거나(예: `shouldAdvanceTime` 제거) 이 테스트 뒤에 다른 fake-timer 가정을 가진 테스트를 추가할 때 조용히 깨질 수 있는 취약한 패턴이다. 바로 옆(:764-814)에 안전한 관례가 이미 존재하는데 신규 코드가 그것을 재사용하지 않은 점이 일관성 문제다.
  - 제안: `try { … } finally { vi.useRealTimers(); }`로 감싸 기존 관례와 통일.

- **[INFO]** (긍정 확인) `refreshCalls` decorative assertion 실효화(W6) — mutation 재현으로 실제 검출력 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:214-257`
  - 상세: 세션 만료를 `30분+6초`로 당기고 `vi.useFakeTimers({shouldAdvanceTime:true})` + `advanceTimersByTimeAsync(10_000)`로 타이머를 실제 통과시킨 결과가 직전 라운드 testing 리뷰가 지적한 "만료 90분 → 실제 refresh 지연 60분(real timer) → `refreshCalls`가 게이팅 여부와 무관하게 항상 0"이라는 tautological 단언 문제를 실질적으로 해소했음을 확인했다. `SeedOutcome`의 `"stale"` 분기(위 WARNING 대상)와 무관하게, 이 특정 assertion 자체의 회귀 검출력은 이제 유효하다.

- **[INFO]** (긍정 확인) W1/W3(`endedRef` dedup) 회귀 테스트 — mutation 재현으로 검출력 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:412-430`(`sendCommand` 410 catch) 및 `use-widget-eager-start.test.ts:1479-1554`("in-flight 명령의 410 이 SSE terminal 뒤 도착해도 conversationEnded 는 1회만")
  - 상세: 410 catch 를 `finalizeEnded("gone")` 경유에서 직전(02_04_13 이전) 구현("직접 `dispatch(ENDED)` + `sendEvent`")으로 되돌리는 mutation 을 가하고 재실행한 결과, 신규 W7(b) 테스트가 `expect(endedEvents.length).toBe(1)` 단언에서 정확히 실패(`received 2`)함을 확인했다 — RESOLUTION.md 의 mutation 검증 주장이 사실과 부합한다. 시나리오 구성(`/interact`를 in-flight 로 잡아둔 채 SSE terminal 을 먼저 발화시킨 뒤 410 을 resolve)도 실제 W1 결함 재현 조건과 정확히 일치해 가독성·의도 표현이 양호하다.

- **[INFO]** (긍정 확인) 기존 회귀 테스트가 리팩터링 후에도 여전히 유효 — 별도 재실행 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:970`(`종료 명령이 실패(410)해도 optimistic 로컬 종료 유지`), `:887`(`endConversation 2회 연속 호출 → 재진입 가드`), `:1118`(`submit_message 명령이 410(Gone) → phase ended`)
  - 상세: `sendCommand`/`endConversation`을 `finalizeEnded`로 통합한 리팩터링(W1·W4)에도 이 diff 밖의 기존 테스트들이 그대로 통과한다(`vitest run` 전체 33/33 확인) — 첫 발생 410 경로, 재진입 가드, optimistic 종료 유지 등 핵심 계약이 회귀 없이 유지됨을 별도 검증했다.

- **[NONE]** `review/code/2026/07/17/02_31_18/**`(RESOLUTION.md·SUMMARY.md·`_retry_state.json`·`meta.json`·reviewer 산출물 다수)
  - 상세: 테스트 가능한 실행 코드가 아닌 리뷰 산출물 기록. CLAUDE.md 컨벤션에 부합하는 정상 보관이며 테스트 관점 지적 사항 없음. 다만 RESOLUTION.md 의 "무력화 시 1 fail" 서술은 W1/W3에 대해서는 본 리뷰가 직접 재현해 정확함을 확인했고, W2(staleness)에 대해서는 "공유 함수 내부 가드" 기준으로는 정확하나 "호출부(`applyConfig`)별 게이팅"까지 포괄한다고 읽으면 과장이다(위 WARNING #1 참고) — 다음 RESOLUTION 작성 시 "무력화"가 정확히 어느 코드 라인을 겨냥한 것인지 명시하면 이런 해석 차이를 줄일 수 있다.

## 요약

이번 라운드는 직전 testing 리뷰(02_31_18)가 지적한 3개 WARNING(`start()` 게이팅 테스트 부재, decorative `refreshCalls` 단언, W2/W3 전용 회귀 테스트 부재)을 실질적으로 메웠다 — W6(decorative assertion)과 W1/W3(dedup)는 직접 mutation 을 가해 재현한 결과 주장대로 정확히 검출됨을 확인했다. 다만 새로 도입된 3-state `SeedOutcome` 계약에는 잔여 커버리지 갭이 하나 남아 있다: `applyConfig`(세션 복원) 자신의 `"stale"` 게이팅 라인은 `start()`/`handleEiaEvent` 경로를 통한 간접 테스트로만 보호되고, `applyConfig` 고유의 게이팅을 좁히는 mutation(“stale”을 빠뜨리는 변경)은 33개 테스트 전부가 통과함을 실측으로 확인했다 — 이는 정확히 이 코드 변경이 원래 고치려던 concurrency 결함(WARNING #2)의 위치다. 부수적으로 신규 fake-timer 테스트가 파일 내 기존 `try/finally` 관례를 따르지 않아, 현재는 `shouldAdvanceTime` 옵션 덕에 증상이 드러나지 않지만 구조적으로는 조기 실패 시 후속 테스트에 fake timer 가 누수될 수 있는 취약점이다.

## 위험도

MEDIUM

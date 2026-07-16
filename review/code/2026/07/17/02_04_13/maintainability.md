# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[CRITICAL]** `seedWaitingFromStatus` 의 신규 teardown 부작용이 두 번째 호출부(세션 복원 경로)에서 가드되지 않음 — 같은 함수의 두 호출부가 서로 다른 안전 가정을 전제
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:551-573` (`applyConfig`, 특히 570-572행) vs `309-346` (`start()`, 특히 332-335행)
  - 상세: 이번 diff 는 `seedWaitingFromStatus`(240-278행)에 "terminal 상태면 `teardownSession()` + `ENDED` dispatch + host 통지" 부작용을 새로 추가했다. 이 함수는 정확히 두 곳에서 호출된다.
    1. `start()`(332행): `await seedWaitingFromStatus(client, session);` 직후 `if (startGenRef.current !== gen) return;`(334행) 로 재확인한 뒤에만 `openStream`/`scheduleRefresh` 를 진행한다. `teardownSession()` 이 `startGenRef.current++` 를 수행하므로(143행) 이 가드가 우연히도 신규 terminal 분기의 부작용을 안전하게 걸러낸다.
    2. `applyConfig`(세션 복원, 570행): `if (clientRef.current) await seedWaitingFromStatus(clientRef.current, saved);` 다음 줄에서 **아무 재확인 없이** `openStream(saved, "0");`(571행) 과 `scheduleRefresh();`(572행) 를 무조건 실행한다.
    이번 PR 이전에는 `seedWaitingFromStatus` 가 `waiting_for_input` 외에는 완전 no-op 이었으므로 두 번째 호출부가 가드 없이도 안전했다. 이번 변경으로 함수의 부작용 범위가 넓어졌지만, `start()` 는 (다른 이유로 이미 존재하던) `gen` 재확인 덕에 우연히 보호되는 반면 `applyConfig` 는 그 재확인 패턴이 아예 없다. 결과적으로 새로고침 등으로 세션을 복원했는데 그 execution 이 이미(버퍼 gap 중) 종료된 상태라면: `seedWaitingFromStatus` 가 `teardownSession()`(스트림 close + 저장 세션 clear) 과 `ENDED` dispatch 를 수행한 직후, `applyConfig` 가 같은 `saved`(이미 폐기된 세션)로 **새 SSE 스트림을 다시 연다**(`openStream(saved, "0")`, 이 시점 `streamRef.current` 는 방금 닫힌 뒤 재대입됨) 그리고 이미 종료된 execution 에 대해 토큰 갱신도 재예약한다(`scheduleRefresh()`). `state.phase` 는 `"ended"` 인데 살아있는 SSE 연결이 남는 모순 상태가 된다 — 정확히 이 PR 이 `execution.replay_unavailable` 경로에서 고치려던 "버퍼 gap 중 종료 유실" 증상과 동일한 조건(gap 안에 terminal 이벤트 유실)이 세션 복원 경로에서는 반대 방향(스트림이 무기한 열린 채 남음)으로 재현된다.
  - 제안: `applyConfig` 에도 `start()` 와 동일한 재확인을 추가한다(가장 단순하게는 `seedWaitingFromStatus` 가 자신이 teardown 을 수행했는지를 반환값(boolean)으로 알리고, 호출부는 `if (ended) return;` 형태로 통일). 또는 `handleEiaEvent` 의 TERMINAL_EVENTS 분기와 동일한 3줄(teardown+dispatch+sendEvent)을 공유 헬퍼로 추출해(아래 WARNING 참고) 호출부가 그 헬퍼의 반환값만 보고 후속 동작을 결정하도록 계약을 명시화하는 편이 두 호출부가 다시 어긋나는 것을 구조적으로 방지한다.

- **[WARNING]** terminal 처리(teardown + ENDED dispatch + host 통지) 3줄이 두 곳에 거의 동일하게 중복
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:184-189`(`handleEiaEvent` 의 `TERMINAL_EVENTS` 분기) vs `249-255`(`seedWaitingFromStatus` 의 신규 terminal 분기)
  - 상세: 두 블록 모두 `teardownSession(); dispatch({ type: "ENDED", reason }); bridgeRef.current?.sendEvent("conversationEnded", { reason });` 를 수행한다(reason 계산식만 `name` vs `` `execution.${status.status}` `` 로 다름). RESOLUTION.md 는 이를 "SSE terminal 경로와 동일 처리"로 의도했다고 밝히고 있으나, 실제로는 로직이 복제된 것이지 공유되는 것은 아니다. 위 CRITICAL 항목이 보여주듯 "동일 처리를 두 곳에 각자 작성"하는 패턴은 호출부별 후속 가드가 어긋나도 컴파일·테스트 단계에서 드러나지 않는다.
  - 제안: `endConversation(reason: string)` 같은 공용 헬퍼(`useCallback`, deps `[teardownSession]`)로 추출해 두 지점 모두 호출. 호출부가 "종료로 처리됐는지" 를 판별해야 하는 지점(`applyConfig` 등)은 이 헬퍼의 반환값을 활용하도록 강제할 수 있어 위 CRITICAL 재발을 구조적으로 막는다.

- **[INFO]** (긍정적 확인) 이전 리뷰 라운드(`01_42_44`) WARNING 항목들이 이번 diff에서 정확히 반영됨
  - 위치: `use-widget.ts:280-286` (`seedWaitingFromStatusRef` 갱신이 `useEffect(() => {...})` 로 전환, `apiRef` 컨벤션과 통일), `use-widget-eager-start.test.ts` 전체(`(init?.method ?? "GET") === "GET"` 관용구로 5개 신규 판정 지점 전부 통일 확인 — grep 결과 기존 관용구와 100% 일치)
  - 상세: 별도 조치 불요, 확인 목적의 기록. `seedWaitingFromStatus` 의 `useCallback` deps 가 `[]` → `[teardownSession]` 으로 늘어난 상황에서 render-time 대입 방식을 유지했다면 실제로 stale closure 위험이 현실화했을 것 — effect 전환이 결과적으로 필수였다는 RESOLUTION.md 의 판단은 타당하다.

- **[INFO]** `useWidget` 훅 비대화는 여전히 진행형(이전 라운드에서도 지적, 조치 보류)
  - 위치: `use-widget.ts` (`useWidget` 함수 전체, 약 107-647행)
  - 상세: 이번 diff 로 `seedWaitingFromStatus` 에 분기 1개, `applyConfig` 에 호출 1개가 늘었을 뿐이라 diff 자체 기여분은 작지만, SSE 이벤트 처리·세션 복원·terminal 판정이 한 함수 스코프에 계속 누적되고 있다. 위 CRITICAL 항목처럼 "여러 호출부에 흩어진 동일 계약을 유지보수자가 전부 추적해야 하는" 문제는 이 함수가 커질수록 재발 확률이 올라간다.
  - 제안: 즉시 조치 불필요하나, `useEiaStream`(가칭) 분리 시 terminal 판정·teardown 계약을 그 훅의 단일 진입점으로 강제하는 설계를 권장.

- **[NONE]** `webauthn.controller.spec.ts` 신규 `describe('webauthnList', ...)` 블록
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts:47-87`
  - 상세: 같은 파일의 기존 `describe` 블록들(네이밍·mock 셋업·assertion 스타일)과 일관되고, `sessions.controller.spec.ts` 와 의도적으로 대칭시켰다는 주석 근거도 명확하다. 매직 넘버·과도한 중첩 없음.

## 요약

이번 diff 의 핵심은 `seedWaitingFromStatus` 에 terminal 처리를 추가해 "버퍼 gap 중 종료된 execution" 을 감지하도록 만든 것이다. 이 자체는 이전 리뷰 라운드가 지적한 실질 버그(무기한 streaming 정지)를 정확히 고쳤고, 테스트 관용구 통일·ref effect 전환 등 이전 WARNING 들도 모두 성실히 반영됐다. 다만 이번 fix 는 `seedWaitingFromStatus` 의 부작용 범위를 넓히면서 두 호출부 중 하나(`applyConfig` 세션 복원 경로)를 감사하지 않아, `start()` 호출부가 (다른 목적으로 존재하던) `gen` 재확인 덕에 우연히만 안전한 것과 달리 복원 경로는 무방비 상태로 남았다 — teardown 직후 동일 세션으로 스트림을 재개설하는 모순이 발생할 수 있다. 이는 "동일 종료 처리 로직이 두 지점에 복제돼 있고 공유 계약이 코드로 강제되지 않는다" 는 구조적 유지보수성 문제(WARNING)의 직접적 파생 결과이므로, 공용 헬퍼로 추출해 호출부가 그 반환 계약을 따르도록 강제하는 리팩터를 함께 권장한다.

## 위험도

HIGH

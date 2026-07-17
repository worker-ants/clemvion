# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[CRITICAL]** `worldGenRef` 단일화로 `newChat()`/`resetSession`/`endConversation()` 이 `applyConfig()` 최초 부팅(`isEmbedAllowed` 대기) 을 조기 무효화 → 위젯이 영구 정지할 수 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`
    - `teardownSession()` (L178) — `worldGenRef.current++` 무조건 실행
    - `newChat()` (L556-579), 특히 B-1 분기 L563-566 (`resetSessionRefs()` 호출에 `configRef.current` null 가드 없음)
    - `endConversation()` (L593-628), 특히 L598 가드(`endedRef.current || state.phase === "ended"`)와 L615(`resetSessionRefs()`)
    - `applyConfig()` (마운트 effect, L656-691), 특히 L660(`const gen = worldGenRef.current;`) ~ L663(`if (worldGenRef.current !== gen) return;`)
    - `host-bridge.ts` L58 — `hostOrigin` 이 아직 null(= 첫 `wc:boot` 전)이면 origin 검증 없이 `wc:command` 를 즉시 처리
  - 상세:
    이번 리팩터는 기존에 서로 독립적이던 3개 무효화 축(`start()` 전용 `startGenRef`, `seed`/`sendCommand` 의 `sessionRef` 동일성, `applyConfig` 부팅 전용 지역 `cancelled` 플래그) 을 `worldGenRef` 하나로 합쳤다. 그런데 `applyConfig()` 의 **첫 번째 await**(`isEmbedAllowed`, `configRef.current`/`clientRef.current` 가 아직 세팅되지 않은 시점) 은 종전엔 마운트 effect 로컬 `cancelled` 로만 보호돼 `teardownSession()`(= `newChat`/`endConversation`) 호출과 **완전히 무관**했다. 리팩터 후에는 같은 `worldGenRef` 를 공유하므로, `wc:boot` 수신 직후 `isEmbedAllowed()` 의 실제 네트워크 왕복(`/api/hooks/:path/embed-config`)이 아직 끝나지 않은 상태에서 host 가 `wc:command {action:"resetSession"}` 을 보내면(또는 `actions.newChat()`/`actions.endConversation()` 를 직접 호출하면):
    1. `newChat()` → (`startedRef.current` 가 아직 `false` 이므로 booting-coalesce 분기를 타지 않고) `resetSessionRefs()` → `teardownSession()` → `worldGenRef.current++`.
    2. `isEmbedAllowed()` 가 나중에 resolve 되면 `applyConfig()` 의 `if (worldGenRef.current !== gen) return;` 가 참이 되어 **`configRef.current`/`clientRef.current`/`setConfig(cfg)` 를 영원히 실행하지 않고 함수가 조용히 종료**된다.
    3. `newChat()` 자신이 마지막에 부르는 `void start()` 도 `if (!cfg || !client) return;` 에 걸려 즉시 no-op — 즉 이 경로에는 어떤 재시도/복구 메커니즘도 없다.
    4. `widget-app.tsx` 의 `expanded = visible && state.open && !!config;` 가 `config` 가 계속 `null` 이므로 패널이 영원히 열리지 않는다 — 런처만 뜨고 클릭해도 아무 반응이 없는(대화가 전혀 시작되지 않는) **영구 정지 상태**가 되며, 콘솔 경고조차 없다(silent failure). 페이지 새로고침 없이는 복구 불가.

    `host-bridge.ts` L58 을 보면 `hostOrigin` 이 아직 pin 되지 않은 상태(=아직 한 번도 `wc:boot` 를 못 받은 상태)에서도 `wc:command` 는 origin 검증 없이 그대로 처리되므로, "boot 도착 → 즉시 뒤이어 command 도착" 시퀀스를 막는 핸드셰이크 동기화가 전혀 없다. 코드 주석이 `resetSession` 을 "라이브 미리보기 등 host 가 대화를 처음부터 다시 시작" 용도로 명시하는데, 라이브 프리뷰류 UI 는 정확히 이런 짧은 간격의 연속 메시지를 보내기 쉬운 환경이라 이 레이스가 순전히 이론적이라 보기 어렵다.

    반대로 `applyConfig()` 의 **두 번째 await**(`seedWaitingFromStatus`, 세션 복원 분기 L682-687) 는 이 시점엔 이미 `configRef.current`/`sessionRef.current`/`startedRef.current=true` 가 세팅돼 있어 `newChat()` 이 진짜로 "새 세션으로 교체" 하는 것이 맞고, `seedWaitingFromStatus` 가 `"stale"` 을 반환해 옛 세션의 `openStream`/`scheduleRefresh` 를 막는 것도 의도된 정상 동작이다(코드 추적으로 확인). 문제는 **config 확립 이전** 구간에 한정된다 — `newChat`/`endConversation` 은 "아직 아무 세션도 없다" 는 전제로 호출돼도 무해할 것으로 설계돼 있으나(`teardownSession()` 내부의 `if (configRef.current) clearSession(...)` 가드가 그 전제를 보여줌), `worldGenRef.current++` 한 줄만은 그 가드 없이 실행돼 부팅 자체를 죽인다.

    부수적으로 `endConversation()` 이 이 시점에 불리면(`state.phase` 초기값은 `"collapsed"` 라 L598 가드를 통과함) `finalizeEnded()` 가 `bridgeRef.current?.sendEvent("conversationEnded", ...)` 를 발사한다 — `conversationStarted` 를 한 번도 보낸 적 없는 host 에게 `conversationEnded` 만 도착하는 의미상 모순된 이벤트/콜백 시퀀스도 함께 발생한다.

    기존 회귀 테스트(`use-widget-eager-start.test.ts` 등, plan 상 "36 passed") 는 전부 `await waitFor(() => expect(result.current.config).not.toBeNull())` 이후에 `newChat()`/`resetSession` 을 호출하는 패턴이라 이 경로를 커버하지 않는다(`grep` 확인 — 모든 `actions.newChat()`/`sendHostCommand("resetSession")` 호출이 config 확립 후에 위치).
  - 제안:
    가장 국소적인 수정은 `teardownSession()` 최상단에 `if (!configRef.current) return;` 가드를 추가하는 것 — 아직 아무것도 확립되지 않은 상태에서는 `closeStream()`/`clearRefreshTimer()`/`clearSession()` 모두 이미 사실상 no-op 이므로, `worldGenRef` 증가만 함께 건너뛰어도 `resetSessionRefs()` 의 나머지 라인(`sessionRef.current = null` 등)은 초기값과 동일해 부작용이 없다. 이렇게 하면 `newChat`/`endConversation`/`applyConfig` 세 곳을 개별로 손대지 않고 choke point 한 곳에서 해결된다. 회귀 테스트로는 `fetchEmbedConfig` 용 fetch mock 을 (다른 테스트들이 webhook POST 에 쓰는 것과 같은) 수동 `resolve` 패턴으로 바꿔 in-flight 상태를 만든 뒤, 그 사이 `sendHostCommand("resetSession")` 또는 `actions.newChat()` 을 호출하고, 이후 embed-config 응답을 resolve 시켰을 때 `result.current.config` 가 정상적으로 채워지는지(`not.toBeNull()`) 단언하는 케이스를 추가할 것을 권장.

- **[WARNING]** `worldGenRef` JSDoc 의 "무효화 지점은 두 곳뿐" 이라는 서술이 실제 코드(세 곳)와 불일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L140-142(JSDoc) vs L182 부근(`teardownSession`) · L~985(`start()` 의 `const gen = ++worldGenRef.current;`) · L~752(unmount cleanup)
  - 상세: JSDoc 은 "무효화 지점은 두 곳뿐이다 — `teardownSession()` 과 언마운트 cleanup" 이라 명시하지만, `start()` 자신도 `const gen = ++worldGenRef.current;` 로 세계를 증가(교체)시킨다(주석에 "이유"는 별도로 설명돼 있으나 JSDoc 본문의 "두 곳" 카운트에는 반영 안 됨). 이 자체가 버그를 유발하진 않지만(이 리뷰에서 `start()` 의 증가 로직은 별도로 추적해 정합성을 확인함), "불변식은 이 두 지점만 봐도 충분하다" 는 잘못된 전제로 향후 유지보수자가 새 async 경로를 추가할 때 `start()` 의 증가를 놓치고 추론할 위험이 있다.
  - 제안: JSDoc 을 "무효화 지점은 세 곳 — `teardownSession()`(종료·새 대화·대화 종료) · `start()`(세계 교체) · 언마운트" 로 정정.

- **[INFO]** `start()` 에는 `seedWaitingFromStatus` 이후 `worldGenRef` 재검사가 있지만 `applyConfig()` 복원 분기에는 동일 위치의 재검사가 없음(비대칭)
  - 위치: `use-widget.ts` L~1001-1004(`start()`, `seedWaitingFromStatus` 반환 후 `if (worldGenRef.current !== gen) return;`) vs L682-688(`applyConfig` 복원 분기, `outcome !== "continue"` 체크만 있고 그 직후 `worldGenRef` 재검사 없이 바로 `openStream(saved, "0")`)
  - 상세: 코드 흐름을 추적한 결과, `seedWaitingFromStatus` 자신이 진입 시점에 자체 `gen` 을 캡처해 내부에서 이미 staleness 를 검사하고, 그 반환("continue") 시점부터 호출부가 재개되는 시점까지는 real 이벤트(SSE/클릭 등은 매크로태스크)가 끼어들 수 없는 마이크로태스크 경계뿐이라 실질적 회귀는 아닌 것으로 판단된다. 다만 두 호출부가 같은 반환 계약(`SeedOutcome`)을 쓰면서 한쪽만 방어적 재검사를 갖는 비대칭은, 향후 두 함수 사이에 실제 `await` 가 추가되는 리팩터가 일어나면 그 즉시 `applyConfig` 쪽에서 조용히 회귀가 재발할 수 있는 잠재 지뢰다.
  - 제안: 대칭성을 위해 `applyConfig` 복원 분기에도 동일한 `if (worldGenRef.current !== gen) return;` 재검사를 추가(비용 거의 없음, 미래 리팩터 방지용 방어적 일관성).

- **[INFO]** 신규 `eslint-disable-next-line react-hooks/exhaustive-deps` (unmount cleanup 의 `worldGenRef.current++`)
  - 위치: `use-widget.ts` L~745-752 (마운트 effect의 cleanup, `worldGenRef.current++;` 직전)
  - 상세: 이 disable 은 "cleanup 이 ref 의 stale snapshot 이 아니라 그 시점 최신 값을 증가시켜야 한다" 는 정당한 이유로 추가됐고 근거 주석도 명확하다 — 실제로 값 캡처 제안대로 고치면 의미가 깨진다는 판단은 타당하다. 다만 새 `eslint-disable` 은 항상 "왜 이 규칙이 오탐인지" 를 재검토해야 하는 지점을 하나 늘리는 것이라, 향후 이 cleanup 이 다른 ref 접근을 추가하는 방향으로 확장될 경우 이 disable 이 진짜 DOM-ref 류 버그까지 함께 가려버릴 수 있다.
  - 제안: 별도 조치 불요(현재는 근거가 충분) — 향후 이 블록에 코드가 추가되면 disable 범위가 계속 `worldGenRef.current++` 한 줄에만 한정되는지 재확인 권장.

- **[없음]** 시그니처/공개 인터페이스 변경: `useWidget()` 반환 형태(`{ state, config, actions: {...} }`), `seedWaitingFromStatus`/`teardownSession`/`start`/`sendCommand` 등 콜백 시그니처 모두 변경 없음. `startGenRef` → `worldGenRef` 리네이밍은 훅 내부 전용(export 안 됨)이라 외부 호출자 영향 없음.
- **[없음]** 전역 변수/환경 변수/파일시스템: 신규 전역 변수·`process.env` 접근·파일 I/O 없음. `sessionStorage` 호출(`saveSession`/`clearSession`/`loadSession`)은 기존과 동일 호출 지점 유지, 신규 호출 없음.
- **[없음]** 네트워크 호출 형태: 신규 endpoint/호출 패턴 추가 없음(가드 로직 변경뿐). 단, 위 CRITICAL 항목이 트리거되면 기존에 발생해야 할 webhook `POST /api/hooks/:path` 호출 자체가 **억제**되는 부작용이 있음(위 CRITICAL 참조).
- 테스트 파일(`use-widget-eager-start.test.ts`) 신규 케이스(유령 표면 회귀 테스트) 는 기존 `vi.stubGlobal`/`afterEach(vi.unstubAllGlobals)` 패턴을 그대로 따르고, fake timer 도입이나 미해제 리소스가 없어 테스트 격리 관점 부작용 없음.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 변경은 문서 전용(실행 부작용 없음).

## 요약

이번 변경의 핵심은 3종의 서로 다른 staleness 가드(`startGenRef`/`sessionRef` 동일성/`applyConfig` 로컬 `cancelled`)를 `worldGenRef` 하나로 통합해 기존에 실측 재현된 "종료된 위젯이 stale seed 응답으로 부활" 버그를 고치는 것이며, 그 목적 자체는 코드 추적으로 정확히 달성됐다(공개 인터페이스·전역 상태·파일시스템·환경변수·네트워크 호출 형태 자체에는 부작용 없음). 그러나 가드 축을 하나로 합치는 과정에서 `applyConfig()` 의 **부팅 전(설정이 아직 확립되지 않은) 구간** 이 `newChat()`/`resetSession`/`endConversation()` 의 `teardownSession()` 호출과 새롭게 결합돼버렸고, 이 결합은 "이미 세션이 있는 상태의 교체"에는 올바르지만 "아직 아무것도 없는 상태" 에는 의미가 없을 뿐 아니라 부팅 자체를 조용히 죽이는 새로운 실패 모드를 만든다 — host 가 `wc:boot` 직후 `resetSession` 을 빠르게 연달아 보내면(라이브 프리뷰 등에서 개연성 있는 시나리오) `config` 가 영원히 `null` 로 남아 위젯이 페이지 새로고침 없이는 복구 불가능한 상태로 정지한다. 이는 기존 코드에는 없던, 이번 리팩터가 "무엇이 바뀌었는지 구분할 필요 없이 바뀌었으면 중단" 이라는 단순화된 계약을 채택하면서 새로 만들어낸 부작용이며, 현재 테스트 스위트(36 passed)에도 커버되지 않는다. 그 외 JSDoc 상 "무효화 지점 두 곳" 서술이 실제(`start()` 포함 세 곳)와 어긋나는 점, `applyConfig`/`start()` 사이의 방어 재검사 비대칭은 당장의 버그는 아니나 향후 회귀 재발 위험을 낮추는 차원의 개선 여지로 남겨둔다.

## 위험도

HIGH

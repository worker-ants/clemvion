# 부작용(Side Effect) Review

대상: `codebase/channel-web-chat/src/{lib/widget-state.ts,widget/use-widget.ts,widget/use-token-refresh.ts}` 및 대응 테스트, `CHANGELOG.md`, plan 문서, `review/code/2026/07/17/08_29_33/**` 신규 아티팩트.
직전 리뷰(`08_29_33`)가 CRITICAL 로 지적한 "부팅 중 명령 → 위젯 영구 정지"의 fix(`teardownSession()` 조기 return)와, `useTokenRefresh` 의 `cancelledRef`→`worldGenRef` 시그니처 변경을 중점 검증했다.

## 발견사항

- **[WARNING]** `teardownSession()` 부팅-전 조기 return 이 "메모리 상 세션 없음"과 "저장소(sessionStorage) 상 세션 존재"를 혼동 — 부팅 완료 후 옛 세션이 조용히 부활해 `resetSession` 요청을 무효화할 수 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `teardownSession()`(L187-206, 특히 L198 조기 return) · `newChat()`(L583-606) · `applyConfig()` 세션 복원 분기(L699-722, 특히 L699 `loadSession` · L700-703 `RESTORED` dispatch); `codebase/channel-web-chat/src/lib/widget-state.ts` `case "RESTORED"`(L125-126, 가드 없음) · `case "NEW_CHAT"`(L179-184)
  - 상세: 새 조기 return 의 근거 주석(L188-193)은 "정리할 세션도 스트림도 타이머도 없다"고 말하는데, 이는 `sessionRef`/`streamRef`/`timerRef` 같은 **메모리 상태**에는 참이지만 `sessionStorage` 에 이미 **영속된** 세션에는 적용되지 않는다 — 그 저장소 값은 `configRef.current` 와 무관하게 이전 페이지 로드/이전 마운트에서부터 존재할 수 있다. 재현 경로:
    1. 이전 대화가 `sessionStorage["clemvion-web-chat:session:<path>"]` 에 유효(미만료) 세션으로 남아있는 상태에서 위젯이 재마운트(예: 호스트 페이지 새로고침, 또는 코드 주석이 직접 언급하는 "라이브 미리보기" 재실행).
    2. `wc:boot` 수신 직후 `applyConfig()` 가 `isEmbedAllowed()` 네트워크 왕복 중(아직 `configRef.current === null`).
    3. 이 창에서 host 가 `wc:command {action:"resetSession"}` 을 보낸다 — `host-bridge.ts` L58 은 `hostOrigin` 핀 이후 origin 검증만 하고 부팅 완료 여부는 보지 않으므로 이 시퀀스를 막을 핸드셰이크가 없다(이번 라운드의 C1 재현과 동일한 창).
    4. `newChat()` → `startedRef.current` 가 아직 `false` 라 R9-A coalesce 분기(L586)를 타지 않고 `resetSessionRefs()` → `teardownSession()` → **조기 return**(저장소 미삭제, `worldGenRef` 미증가) → `dispatch({type:"NEW_CHAT"})`(`widget-state.ts` L179-184, UI 만 일시적으로 빈 패널로 리셋) → `start()` 는 `!cfg` 로 no-op.
    5. `isEmbedAllowed()` resolve → `configRef.current = cfg` 등 확립(C1 fix 가 의도한 대로 정상 진행) → `loadSession(cfg.triggerEndpointPath)` 가 **2에서 지워지지 않은 옛 세션을 그대로 반환** → `sessionRef.current = saved; startedRef.current = true; dispatch({type:"RESTORED", executionId: saved.executionId})`.
    6. `widget-state.ts` `case "RESTORED"`(L125-126) 는 `WAITING`(L138, 이번 diff 의 W4 가드)과 달리 `state.phase` 를 전혀 검사하지 않으므로, 방금 4에서 dispatch 된 `NEW_CHAT`(phase→`"panel"`) 을 무조건 덮어쓰고 `phase→"streaming"` 으로 전이한다. 이어 `openStream(saved, "0")`/`scheduleRefresh()` 까지 옛 세션으로 정상 수행된다.
    결과: host 가 명시적으로 요청한 "대화를 처음부터 다시 시작"(코드 자체 주석, `resetSession` 케이스 L755)이 **조용히 무효화**되고, 옛 대화가 이어진다 — 에러도 경고도 없다. 서버 측에서도 옛 execution 이 취소되지 않는다(`newChat()` 의 `cancel` 명령은 `prevSession = sessionRef.current` 가 이 시점엔 `null` 이라 발사되지 않음, L591-595). C1 fix 이전에는 이 시퀀스가 2단계에서 `applyConfig` 자체가 gen 불일치로 죽어(총 영구 정지) 이 하위 시나리오까지 도달하지 못했으므로, **이 특정 증상은 C1 fix 로 인해 새로 관측 가능해진 것**이다(더 나쁜 "영구 정지"가 더 미묘한 "리셋 무시"로 치환됨 — 전체적으로는 개선이지만 새 gap 이 남음).
    이번 diff 의 신규 회귀 테스트(C1, W2, W3, W4, W5) 중 `sessionStorage.setItem` 으로 기존 세션을 미리 심어둔 뒤 부팅 중 `resetSession` 을 쏘는 조합은 없다(grep 확인 — `sessionStorage.setItem` 과 `resetSession` 이 같은 테스트에서 만나지 않음, C1 테스트는 저장소를 비운 상태로 시작).
  - 제안: `teardownSession()` 이 `configRef.current` 를 몰라 저장소 키를 못 지우는 것이 근본 제약이므로, 별도의 "리셋 대기" 플래그(예: `pendingResetRef`)를 도입해 (a) 부팅 전 `newChat()`/`resetSession` 발생 시 이 플래그만 세우고, (b) `applyConfig()` 가 `configRef.current`/`clientRef.current` 를 확립한 직후 `loadSession` 을 부르기 전에 이 플래그를 확인해 참이면 `clearSession(cfg.triggerEndpointPath)` 를 호출하고 복원 분기를 건너뛰도록 한다. 최소한, 이 트레이드오프를 의도적으로 수용하기로 결정한다면 위 6단계 시나리오를 그대로 고정하는 회귀 테스트를 추가해 "현재 동작이 알려진 상태"임을 명시할 것.

- **[INFO]** `teardownSession()` 조기 return 자체의 국소 안전성은 확인됨 — 단, 코드 전역의 문서화되지 않은(타입/런타임 미강제) 불변식에 의존
  - 위치: `use-widget.ts` L198(조기 return) vs `closeStream`(L177-180)·`clearRefreshTimer`(`use-token-refresh.ts` L64-69)·`configRef.current` 대입 지점(L670, L695 — grep 으로 전수 확인, 해제 0곳)
  - 상세: `streamRef.current` 를 채우는 유일한 함수는 `openStream()` 이고, 이는 `start()`(L423 `if (!cfg || !client) return;` 로 선차단) 또는 `applyConfig()`(L695 `configRef.current = cfg` 이후에만 도달)에서만 호출된다. `timerRef.current` 를 채우는 `scheduleRefresh()` 도 마찬가지로 `start()`/`applyConfig()` 의 config 확립 이후에만 불린다. 즉 `configRef.current === null` 인 구간에는 `streamRef`/`timerRef` 가 항상 비어있어, `closeStream()`/`clearRefreshTimer()` 를 건너뛰어도 실제로 잃는 정리 작업이 없다 — 코드 추적으로 검증 완료. 또한 `configRef.current` 는 확립(L695) 후 다시 `null` 로 돌아가는 대입이 코드베이스에 없음을 grep 으로 전수 확인했다(RESOLUTION.md §C1 의 주장과 일치) — 따라서 이 조기 return 분기는 위젯 인스턴스 생애주기당 "부팅 완료 전" 이라는 좁고 1회성인 창에서만 살아있고, 부팅 후에는 영구히 도달 불가능한 죽은 분기가 된다(부팅 후 `finalizeEnded`/`endConversation` 등 다른 3개 진입점은 전부 세션·클라이언트 존재를 전제하므로 이 분기와 만나지 않음, 개별 추적 완료).
    다만 이 안전성 논증은 컴파일러나 런타임 assertion 이 아니라 **수작업 grep 감사**로만 성립한다 — 향후 "config 재설정"류 기능(예: host 가 `apiBase`/`triggerEndpointPath` 를 바꿔 재부팅시키는 기능)이 `configRef.current = null` 대입을 도입하면서 동시에 `sessionRef`/`streamRef`/`timerRef` 를 재사용 가능한 상태로 남겨두면, 이 조기 return 이 그 시점의 실제 정리 작업을 조용히 건너뛰는 회귀가 재발할 수 있다. 이는 plan 문서 스스로 인정하는 "가드는 규율이지 구조가 아니다" 패턴이 이번 fix 자체의 안전성 근거에도 그대로 적용됨을 뜻한다.
  - 제안: 차단 사유 아님(현재 코드에서는 안전 확인됨). 후속으로 `configRef.current` 를 null 로 되돌리는 코드가 생기면 이 early-return 조건도 함께 재검토해야 함을 JSDoc 에 한 줄 남겨두는 것을 권장.

- **[INFO]** `useTokenRefresh` 시그니처 변경(`cancelledRef` 제거 → `worldGenRef` 주입) — blast radius 완전 봉쇄 확인, 단 새 cross-hook 암묵 계약 발생
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts` L27-45(`TokenRefreshDeps`, non-exported) · L60(`useTokenRefresh` 시그니처) · L86-96(`.then()` gen 재검증) · L107(unmount effect); 호출부 `use-widget.ts` L170-175
  - 상세: `grep -rl "useTokenRefresh"` 로 저장소 전체를 검사한 결과 참조 파일은 `use-token-refresh.ts`(정의) · `use-widget.ts`(유일한 프로덕션 호출자, 이번 diff 로 이미 `worldGenRef` 추가 반영됨) · `use-token-refresh.test.ts`(유일한 테스트 호출자, `setup()` 헬퍼가 이미 `worldGenRef: { current: 0 }` 반영) 세 곳뿐이다. `TokenRefreshDeps` 인터페이스는 `export` 되지 않아 모듈 경계 밖 소비자가 없고, `use-widget-eager-start.test.ts`/`use-widget.test.ts` 는 재-export 된 상수(`TOKEN_REFRESH_LEAD_MS` 등)만 참조할 뿐 훅 자체나 그 인자 타입을 직접 쓰지 않는다 — 따라서 이 시그니처 변경으로 인한 놓친 호출자는 없다.
    동작 측면에서도 새 `worldGenRef` 가드는 기존 `cancelledRef` 가 보호하던 범위(언마운트)를 포함하면서 그것이 놓쳤던 `teardownSession()` 경로(새 대화·대화 종료)까지 넓힌 **진strict superset** 이다 — `cancelledRef` 가 막던 시나리오 중 `worldGenRef` 가 못 막는 경우는 발견되지 않았다(코드 추적: gen 증가 지점 3곳 모두 실제로 세션을 무효화하는 이벤트와 1:1 대응, 과잉 무효화로 정상 갱신을 폐기하는 경로도 없음 — `start()` 의 gen 증가는 `sessionRef.current` 가 비어있을 때만 도달해 in-flight 갱신과 충돌 불가).
    다만 새 설계는 이 훅이 **더 이상 자체적으로 언마운트를 보호하지 않고, "소유자(useWidget)가 언마운트 cleanup 에서 worldGenRef 를 반드시 올린다"는 외부 계약에 전적으로 의존**한다는 구조적 변화를 수반한다(JSDoc L38-42 에 이미 명시). 현재는 유일한 소유자가 그 계약을 정확히 지키므로(`use-widget.ts` L768-778 마운트 effect cleanup) 문제가 없으나, 이 훅이 향후 두 번째 소비자를 얻고 그 소비자가 언마운트 시 `worldGenRef` 를 올리는 것을 누락하면 — 예전 `cancelledRef` 는 그런 상황에서도 자체적으로 안전했던 반면 — 새 설계는 그 소비자의 실수를 감지·방어할 방법이 없다.
    회귀 테스트 커버리지 측면에서도, `use-token-refresh.test.ts` 의 "언마운트 후 타이머 미발화" 테스트(L132-140, 구 "cancelled 가드" 부제 제거됨)는 **아직 발화하지 않은 예약 타이머**가 언마운트 후 안 도는 것만 확인하고, "언마운트 시점에 이미 in-flight 인 `refreshToken()` 응답이 언마운트 후 도착해도 `sessionRef`/storage 를 되살리지 않는다"는 이 훅 자신의 unmount-in-flight 시나리오는 이 파일 안에서 직접 검증되지 않는다(그 시나리오는 `use-widget-eager-start.test.ts` 의 W3 테스트가 대신 커버하지만, W3 는 `start()` 의 webhook POST in-flight 케이스이지 `scheduleRefresh()`/`refreshToken()` in-flight 케이스가 아니다 — 정확히 동형이지만 별개 코드 경로).
  - 제안: 차단 사유 아님(현재 유일한 소비자는 계약을 올바르게 지킴, 문서화도 이미 충실). 여유가 있다면 `use-widget-eager-start.test.ts` 에 "refreshToken in-flight 중 위젯 언마운트 → 지연 응답이 storage 를 되살리지 않는다" 케이스를 W3 와 대칭으로 추가해 이 훅 고유의 unmount-in-flight 경로도 직접 고정할 것을 권장(현재는 간접적으로만 방어됨).

- **[없음]** 기타 부작용 축 — 확인됨, 이상 없음
  - **전역 변수**: 신규 전역 변수/모듈 스코프 상태 없음. `worldGenRef`/`endedRef` 는 훅 인스턴스별 `useRef` 로 컴포넌트 스코프에 격리됨.
  - **환경 변수**: `process.env` 읽기/쓰기 변경 없음.
  - **파일시스템**: 코드(`use-widget.ts` 등)는 파일 I/O 없음. `review/code/2026/07/17/08_29_33/*.md`·`_retry_state.json` 은 전부 **신규 파일**(기존 파일 덮어쓰기 아님, `git diff` 로 `new file mode` 확인) — 프로젝트 컨벤션(`review/code/<날짜>/<시각>/`)에 부합하는 리뷰 산출물 커밋이며 의도치 않은 파일시스템 부작용 아님.
  - **시그니처/인터페이스 변경**: `useWidget()` 의 반환 형태(`{state, config, actions}`)·`actions` 내 각 함수 시그니처는 무변경. `useTokenRefresh` 시그니처 변경은 위에서 별도 분석(봉쇄 확인). `widgetReducer(state, action)` 시그니처 무변경 — `WAITING` 케이스 내부에 조기 return 만 추가.
  - **네트워크 호출**: 신규 endpoint·신규 호출 패턴 없음. 가드 로직 변경만이며, `applyConfig` catch 분기(L380 대응 위치)의 신규 gen 재검사도 호출 자체가 아니라 이미 받은 응답의 처리 여부만 바꿈.
  - **이벤트/콜백**: `bridgeRef.current?.sendEvent(...)` 호출 지점·조건 무변경(이번 diff 는 `finalizeEnded`/`sendEvent` 자체를 건드리지 않음). 단, 위 WARNING 시나리오가 실제로 트리거되면 host 입장에서는 `resetSession` 명령에 대해 어떤 이벤트도 오지 않고(성공/실패 신호 없음) 대신 예상 밖의 `conversationStarted`/기존 스레드 메시지가 뒤늦게 도착하는 형태로 나타날 수 있음 — 이는 위 WARNING 항목의 연장.
  - 테스트 전용 `flushAsync()` 헬퍼(`use-widget-eager-start.test.ts`): 프로덕션 코드 부작용 아님. 사용되는 모든 `describe` 블록을 grep 으로 대조한 결과 파일 내 `vi.useFakeTimers()` 호출은 전부 `shouldAdvanceTime: true` 이고, `flushAsync` 를 쓰는 블록 대부분은 기본(real timer) 상태라 `setTimeout(r,0)` 매크로태스크가 정상적으로 흐른다 — 결함 없음.

## 요약

핵심 검증 대상인 `teardownSession()` 최상단 조기 return(`if (!configRef.current) return;`)은 국소적으로는 안전하다 — `closeStream`/`clearRefreshTimer` 가 정리할 대상(`streamRef`/`timerRef`)은 `configRef.current` 확립 이전에는 코드 구조상 항상 비어있고, `configRef.current` 는 한번 세팅되면 grep 전수 확인상 다시 null 로 돌아가지 않아 이 분기는 위젯 생애주기 중 부팅 전이라는 좁은 창에서만 유효하다. 그러나 이 안전성 논증 자체가 "메모리 상태(ref)"에만 미치고 `sessionStorage` 의 **영속 상태**는 놓친다는 사각을 하나 남긴다 — 부팅 전 유효한 저장 세션이 이미 있는 상태에서 `resetSession`이 그 창에 들어오면, C1 fix 덕분에 부팅 자체는 살아나지만 지워졌어야 할 옛 세션이 저장소에 그대로 남아 `applyConfig` 복원 분기가 그것을 되살리고 `widget-state.ts` 의 `RESTORED` 케이스(가드 없음)가 방금 dispatch 된 `NEW_CHAT` 을 덮어써, host 의 명시적 리셋 요청이 조용히 무효화되는 새 시나리오가 생긴다. C1 이전에는 이 하위 경로 자체가 (더 심각한 영구 정지로 인해) 도달 불가능했으므로, 이는 이번 fix 가 새로 관측 가능하게 만든 잔여 gap 으로 본다. `useTokenRefresh` 의 `cancelledRef`→`worldGenRef` 전환은 유일한 프로덕션/테스트 호출자가 모두 갱신되어 시그니처 변경의 블라스트 반경이 완전히 봉쇄됐고, 보호 범위도 기존 대비 strict superset 이라 회귀는 없다 — 다만 이 훅이 이제 "소유자가 언마운트 시 세대를 올린다"는 외부 계약에 전적으로 의존하게 된 구조적 변화는 문서화가 충실하지만 향후 두 번째 소비자가 생기면 재검토가 필요하다.

## 위험도

MEDIUM

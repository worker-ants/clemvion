# 부작용(Side Effect) Review

대상: `codebase/backend/.../webauthn.controller.spec.ts`(테스트 전용) · `codebase/channel-web-chat/src/widget/use-widget.ts`(프로덕션) · `use-widget-eager-start.test.ts`(테스트) · `plan/**`·`review/**`·`spec/**` 문서 변경.

핵심 프로덕션 부작용은 `use-widget.ts` 에 신설된 `finalizeEnded`(+`endedRef` 1회 가드)와 `seedWaitingFromStatus` 의 `Promise<boolean>` 반환 계약 확장에 집중 검토.

## 발견사항

- **[WARNING]** 신설된 `endedRef` "host `conversationEnded` 1회 발사" 가드가 `sendCommand` 의 `410 Gone` 종료 경로를 포함하지 못해, 문서화된 "중복 발사 방지" 불변식이 이 경로에서는 깨진다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:396-401`(`sendCommand` catch, 미가드) vs `:166-174`(`finalizeEnded`, `endedRef` 가드) / 호출부 3곳(`handleEiaEvent:215`, `seedWaitingFromStatus:289`)
  - 상세: 이번 diff 는 `finalizeEnded(reason)` 헬퍼를 추출하며 "SSE terminal 과 REST 폴백 terminal 이 같은 종료에 대해 각각 발화해도 host `conversationEnded` 를 두 번 보내지 않는다"(`:160-161` JSDoc, `RESOLUTION.md` W3, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 동형 서술)고 명시적으로 계약을 정의했다. 그러나 파일 안에서 `bridgeRef.current?.sendEvent("conversationEnded", ...)` 를 발사하는 지점은 3곳이 아니라 **최소 4곳**이다 — `finalizeEnded`(`:172`, 가드됨) 외에 `sendCommand` 의 `EiaError status===410` catch(`:398-401`)가 있고, 이 경로는 `endedRef` 를 전혀 참조·설정하지 않는다.
    재현 시나리오: 사용자가 메시지를 전송(`sendCommand` in-flight, `client.interact(...)` 대기 중)한 사이 같은 execution 이 SSE terminal 이벤트로 먼저 종료되면 → `handleEiaEvent` → `finalizeEnded` 가 `endedRef=true` 설정 + `teardownSession()` + `dispatch(ENDED)` + **conversationEnded #1** 발사. 뒤이어 서버가 이미 종료된 execution 에 대한 `interact` 요청에 `410 Gone` 을 반환하면 `sendCommand` 의 catch 가 `endedRef` 를 확인하지 않고 무조건 `dispatch({type:"ENDED", reason:"gone"})` + **conversationEnded #2** 를 또 발사한다. `sendEvent`(→ `host-bridge.ts` `post("wc:event", ...)`)와 reducer 의 `ENDED` case(`widget-state.ts:152`) 모두 자체 중복 방지가 없어(리듀서는 `phase` 만 재설정, `sendEvent` 는 무조건 `postMessage`) host 는 동일 종료에 대해 `wc:event conversationEnded` 를 2번 수신한다. 이 경합은 "명령 in-flight 중 execution 이 외부(타임아웃 reaper·SSE)로 먼저 종료"라는, 위젯이 이미 대비 중인(§idle-reaper GC) 흔한 시나리오라 발생 가능성이 낮지 않다.
    근본 원인: `finalizeEnded` 가 호출하는 `teardownSession()`(`:144-150`)은 `closeStream`/`clearRefreshTimer`/`clearSession` 만 수행하고 **`sessionRef.current` 를 null 로 만들지 않는다**(그 일은 더 넓은 범위인 `resetSessionRefs()`—`newChat`/`endConversation` 전용—만 한다). 따라서 `finalizeEnded` 로 자동 종료된 뒤에도 `sendCommand` 의 `if (!session || !client) return;` 가드는 여전히 `session` 을 truthy 로 보고 무효화된 토큰으로 `interact` 호출을 계속 시도한다.
  - 제안: `sendCommand` 의 410 catch 를 `finalizeEnded("gone")` 을 통하도록 바꿔(또는 진입부에 `if (endedRef.current) return;` 추가) 동일 1회 가드에 편입시킬 것. 근본적으로는 `finalizeEnded`(혹은 `teardownSession`)가 `sessionRef.current = null` 도 함께 수행해 "이미 종료된 세션"으로 후속 `sendCommand` 호출 자체를 조기 차단하는 편이 `resetSessionRefs` 와의 비대칭도 없앤다. 회귀 테스트: "SSE terminal 종료 후 in-flight sendCommand 가 410 을 받아도 conversationEnded 는 1회만 발사" 케이스 추가 권장.

- **[INFO]** `endConversation()` 도 동일한 `dispatch(ENDED)+sendEvent(conversationEnded)` 시퀀스를 `finalizeEnded`/`endedRef` 밖에서 독자 수행 — 현재는 자체 가드(진입부 `state.phase === "ended"` 조기 return + `resetSessionRefs()` 로 `sessionRef.current` 즉시 null화)로 방어되어 실질 중복 발사 경로는 확인되지 않았으나, "새 헬퍼로 종료 시퀀스를 강제한다"는 이번 diff 의 리팩터 취지(W1 대응)와는 결이 어긋난다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:534-562`(`endConversation`)
  - 상세: `finalizeEnded` 도입 시 "공개 액션 `endConversation()` 과 이름이 겹쳐 shadow 된다"는 이유로 헬퍼 통합을 명시적으로 보류했다(`RESOLUTION.md` W1 행 각주). 그 결과 파일에 종료 시퀀스가 여전히 두 벌(`finalizeEnded` 경유 2곳 + `endConversation` 경유 1곳 + 위 `sendCommand` 410 경로 1곳, 총 4갈래) 존재한다. `endConversation` 은 우연히 안전하지만(자체 phase 체크 + 즉시 sessionRef null화), 이 안전성이 `endedRef` 계약과 무관하게 성립한다는 점이 "우연한 보호는 대칭성이 없어 다른 호출부에서 깨진다"는 이번 라운드 자신의 교훈(`RESOLUTION.md` 말미)과 같은 패턴이다.
  - 제안: 즉시 조치 불필요(현재 안전). 다음에 종료 경로를 다시 만질 때 `endedRef`/`finalizeEnded` 를 4개 발사 지점 전체의 단일 choke point 로 통합할 것을 권고(이름 충돌은 `finalizeEnded` 를 그대로 두고 `endConversation` 내부에서 `finalizeEnded(reason)` 를 호출하는 방식으로 해소 가능해 보인다).

## 확인 완료 — 문제 없음

- `applyConfig`(세션 복원, `:592-621`)·`start()`(`:347-386`)·`handleEiaEvent` 의 `replay_unavailable` fire-and-forget(`:209-210`) 3개 호출부 모두 실제 코드에서 `seedWaitingFromStatus` 의 `Promise<boolean>` 반환값으로 정확히 게이팅됨을 직접 확인(diff 주장과 실제 파일 상태 일치) — 이전 CRITICAL#1(무효 토큰 SSE 재오픈·storage 부활)은 재현되지 않음.
- `seedWaitingFromStatus` 는 module 내부 전용(비export) 헬퍼라 `Promise<void>→Promise<boolean>` 시그니처 변경이 외부 소비자·공개 API 에 영향 없음. 3개 내부 호출부 전부 갱신 확인.
- `seedWaitingFromStatusRef.current = seedWaitingFromStatus` 대입이 render-body 가 아니라 `useEffect(() => {...})`(deps 없음, 매 렌더 재대입)로 되어 있어 `apiRef` 컨벤션과 일치 — deps 확장(`[teardownSession]→[finalizeEnded]`)에 따른 TDZ/stale-ref 위험 없음.
- `sessionRef.current !== session` staleness 가드는 `resetSessionRefs()`(newChat/endConversation)가 `sessionRef.current` 를 null 화하는 경로에 대해서는 정확히 작동(fire-and-forget `getStatus` 응답이 이미 리셋된 세션에 잘못 적용되는 것을 차단).
- `endedRef` 는 컴포넌트 인스턴스별 `useRef` — 전역 변수·모듈 스코프 상태 아님. `resetSessionRefs()` 에서만 재해제(`:477`)되어 "새 대화마다 재무장" 의도와 일치.
- `webauthn.controller.spec.ts` / `use-widget-eager-start.test.ts` 변경은 순수 테스트 추가(신규 `it`)이며 프로덕션 코드·전역 상태·시그니처를 건드리지 않음 — 부작용 없음.
- `plan/**`·`review/**`·`spec/**` 변경은 문서 전용. `review/code/2026/07/17/02_04_13/**` 신규 파일들은 직전 라운드 리뷰 프로세스의 정상 산출물(orchestrator 가 항상 생성)이지 이번 코드 변경이 유발한 의도치 않은 파일시스템 부작용이 아님.
- 신규 네트워크 호출·환경 변수 읽기/쓰기·전역 변수 도입 없음.

## 요약

이번 diff 의 실질 부작용 표면은 `use-widget.ts` 하나다. 직전 라운드가 지적한 CRITICAL#1(세션 복원 경로 무방비)과 W1–W3(종료 로직 중복·staleness·중복 host 통지)은 실제 파일 상태 기준으로 올바르게 반영됐음을 확인했다. 다만 이번에 신설한 "`endedRef` 로 host `conversationEnded` 를 1회만 보낸다"는 계약 자체가 파일 안의 4개 발사 지점 중 2곳(`finalizeEnded` 경유)만 커버하고 `sendCommand` 의 `410 Gone` 종료 경로는 빠뜨렸다 — SSE/REST-snapshot 종료와 in-flight 명령의 410 응답이 겹치는, 위젯이 이미 대비 중인 종류의 레이스에서 host 중복 통지가 재발할 수 있다. `endConversation` 도 같은 헬퍼 밖에 있으나 자체 가드로 현재는 안전하다. 그 외 시그니처·전역 상태·파일시스템·환경변수·네트워크 관점에서는 새로운 위험이 없다.

## 위험도
WARNING

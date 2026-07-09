# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `endConversation()` 이 `booting` phase(webhook POST in-flight) 에서 호출되면 백엔드 종료 명령(`cancel`)이 아예 발사되지 않고 조용히 로컬만 `[ended]` 로 전이한다 — spec 표(§3.1 "대화 종료" 행)의 "그 외 phase(booting/streaming/...)면 `cancel`" 계약과 실제 동작이 어긋난다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `endConversation()` (˜L415-431) + `start()` 의 gen guard (˜L277-300)
  - 상세: `endConversation()` 은 명령 발사 대상을 `sessionRef.current`(로컬 변수 `session`)에서 캡처한다. `booting` 중에는 `persist(cfg, res)` 가 아직 호출되지 않아 `sessionRef.current` 가 `null` 이고, `if (session && client)` 가드에 의해 `client.interact(...)` 자체가 스킵된다. 동시에 `resetSessionRefs()` → `teardownSession()` 이 `startGenRef.current++` 로 in-flight `start()` 를 무효화하므로, webhook 이 나중에 202 로 resolve 돼도 `startGenRef.current !== gen` 체크에 걸려 `persist()` 가 **영원히 호출되지 않는다** — 즉 그 execution 의 `endpoints`/`token` 을 위젯이 다시는 획득하지 못해 재시도 경로도 없다. 결과적으로 서버에는 사용자가 "대화 종료" 를 눌렀음에도 명시 취소 명령을 받지 못한 execution 이 `running`/`waiting_for_input` 상태로 남는다. `새 대화`(newChat) 는 이런 orphan 을 spec 이 명시적으로 허용하지만("이전 execution 은 명시 종료 명령을 보내지 않으므로 서버에선 잔존"), `대화 종료` 는 spec 이 "즉시 서버 종료가 필요하면 `cancel`/`end_conversation` 을 쓴다" 고 대비시켜 명시적 종료를 기대하는 경로라 이 경우엔 의도 대비 실제 부작용(명령 누락)이 발생한다. 완화 요인: 위젯이 발급한 per-execution 토큰의 TTL/idle 만료가 최종적으로 정리하므로 무기한 리소스 누수는 아니고, 발생 창(webhook 왕복 수백ms)도 좁다.
  - 제안: booting 중 `endConversation` 호출 시에도 최소한 webhook 완료 후(또는 최근 발급된 `res.executionId`/token 을 별도 ref 로 임시 보관해) best-effort `cancel` 을 1회 시도하도록 보강하거나, 이 gap 을 spec §3.1 에 "booting 중 종료는 TTL 로만 정리됨(newChat 과 동일)" 으로 명시적으로 하향 조정해 표와 구현을 정합화할 것.

- **[INFO]** `InteractionService.getStatus()` 가 `execution.conversationThread` 를 clone 없이 그대로 응답 `context.conversationThread` 에 참조로 담는다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` ˜L246-250 (`const conversationThread = execution.conversationThread ?? undefined;` → `base` 객체 spread)
  - 상세: 반환된 DTO 필드가 TypeORM 이 로드한 엔티티 프로퍼티와 동일 객체 참조를 공유한다. 현재는 request-scope 내에서 즉시 JSON 직렬화되고 in-place mutate 경로가 없어 실질 위험은 낮음(이전 리뷰 라운드 INFO#15 로 이미 defer 확정됨) — 재검증 결과도 동일하게 저위험으로 판단, 신규 이슈로 에스컬레이션할 근거 없음. 참고로만 기록.
  - 제안: 조치 불필요(기존 defer 결정 유지). 향후 SSE 쪽처럼 `cloneThread` 적용을 고려할 수 있으나 저우선.

- **[INFO]** `PanelActions` 인터페이스에 필수 필드 `endConversation: () => void` 가 추가됨.
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` `interface PanelActions`
  - 상세: 시그니처 확장이지만 `Panel` 은 위젯 내부 전용 컴포넌트이고 유일한 실사용처 `widget-app.tsx` 는 `useWidget()` 의 `actions` 객체 전체를 그대로 전달(`<Panel ... actions={actions} />`)하므로 자동으로 채워진다. `panel.test.tsx` 의 `BASE_ACTIONS` 도 동일 커밋에서 갱신됨. 외부 공개 API 가 아니라 호출자 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** 공개 EIA REST 표면(`GET /api/external/executions/:id`) 의 `context` 에 `conversationThread` 필드가 추가되어 응답 페이로드가 (buffer 만료 없이도) 전체 대화 히스토리 크기로 커질 수 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`, DTO `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (`context?: Record<string, unknown> | null` — 느슨한 타입이라 필드 추가가 타입 파괴는 아님)
  - 상세: additive/backward-compatible 필드 추가(키 자체도 부재 시 생략)라 기존 외부 클라이언트를 깨뜨리지 않는다. 다만 이미 공개 중인 SSE `waiting_for_input` payload 와 동일 데이터를 REST 단발 응답에도 노출하는 것이므로 신규 민감 표면은 아니며, payload 크기 증가는 기존 turn cap 에 의해 상한이 있어 즉시 위험은 낮다(이전 리뷰 INFO#14 로 이미 defer). 신규 이슈 아님, 재확인 목적 기록.
  - 제안: 조치 불필요(기존 defer 결정 유지).

- **[검증 완료, 이슈 아님]** 이전 라운드 WARNING #1(`endConversation()` 이 종료 명령 발사 **후** teardown 하던 원래 설계였다면 SSE terminal 이벤트와 경합해 `conversationEnded` 가 2회 발사될 수 있었음)이 이번 diff 에서 올바르게 해소됨을 코드로 확인.
  - 위치: `use-widget.ts` `endConversation()`(`resetSessionRefs()` → `dispatch ENDED` → `bridgeRef.sendEvent` 순서가 `client.interact(...)` **이전**에 실행), `closeStream()`(˜L126-129, `streamRef.current?.close()` 를 동기 호출)
  - 상세: `resetSessionRefs()` 가 `client.interact` 호출 전에 SSE `EventSource.close()` 를 동기 실행하므로, 종료 명령이 유발하는 서버측 terminal SSE 이벤트가 도착해도 `handleEiaEvent` 콜백이 더 이상 트리거되지 않는다 — 중복 `dispatch({type:"ENDED"})`/중복 `conversationEnded` 콜백 발사 경로가 차단됨. `if (state.phase === "ended") return;` 가드도 이미 종료된 상태에서의 재진입을 방지. 신규 회귀 없음.

## 요약

핵심 부작용 리스크는 `getStatus()` 의 durable `conversationThread` 동봉이 순수 additive read-only 확장이라는 점에서 낮다(전역 상태·파일시스템·환경변수 접근 없음, DB 쓰기 없음, 기존 클라이언트 호환). 프런트 `roleOf`/`isActiveConversationPhase` 도 순수 함수 추가로 부작용 없음. `endConversation` 의 teardown-before-command 순서 재배치는 이전 리뷰가 지적한 중복 `conversationEnded` 콜백 경합을 코드 레벨에서 실제로 해소했음을 확인했다. 다만 새로 발견한 것으로, `booting` phase(webhook 왕복 중)에 "대화 종료" 를 누르면 gen guard 메커니즘이 해당 execution 의 세션 정보(`persist()`) 획득 자체를 영구히 차단해 서버측 취소 명령이 한 번도 발사되지 않는 좁은 race 가 있다 — spec 표가 명시한 "booting/streaming 도 `cancel` 발사" 계약과 실제 구현이 어긋나는 (완화된) WARNING 급 gap 이다. 나머지는 이전 리뷰 라운드에서 이미 저위험으로 defer 확정된 항목의 재확인(INFO)뿐이다.

## 위험도

MEDIUM

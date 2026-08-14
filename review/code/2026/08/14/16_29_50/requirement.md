### 발견사항

- **[INFO]** `stripAndRedact`(`interaction.service.ts`)의 세 출구 중 `result`/`error`는 `execution.status`가 정확히 `COMPLETED`/`FAILED`일 때만 채워지고 `CANCELLED`에서는 둘 다 `null`이다 — 이는 이번 diff 가 만든 동작이 아니라 기존 로직(삼항 조건은 이번 변경으로 손대지 않음)이고, spec §5.3 예시(`"result": {...} | null, // completed 시`, `"error": {...} | null, // failed 시`)와 정확히 일치한다. 회귀 아님, 확인 목적으로만 기록.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()` 반환부, `result:`/`error:` 삼항), `spec/5-system/14-external-interaction-api.md:480-482`
  - 상세: 이번 diff 의 실질 변경은 `stripAndRedact` 호출을 두 곳(`result`/`error`)과 waiting 분기(`nodeOutput`)에 대칭으로 거는 것뿐이고, 어느 상태에서 어느 필드를 채우는지의 조건문 자체는 변경 범위 밖이다.
  - 제안: 조치 불요.

- **[INFO]** `emitKbEvent`/`emitBackgroundRunEvent`/`emitNotificationEvent`는 `stripExternalOnlyFields`를 거치지 않는다 — 확인 결과 의도된 설계이고 누출 표면이 아니다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:487-620` (해당 3개 메서드)
  - 상세: 외부 fanout 구독자(`SseAdapter`/`NotificationFanout`/`ChatChannelDispatcher`)는 `WebsocketService.executionEvents$` 단일 sink 만 구독한다(코드베이스 전수 grep으로 확인, `executionEvents` 참조 파일은 `chat-channel.dispatcher.ts`/`notification-fanout.service.ts`/`sse-adapter.service.ts`뿐). 이 sink 는 `emitExecutionEvent`/`emitNodeEvent` 두 곳만 `executionEventSubject.next(...)`를 호출해 채운다. `emitKbEvent`/`emitBackgroundRunEvent`는 `gateway.broadcastToChannel`만 호출해 내부 WS 채널로만 나가고, `emitNotificationEvent`는 하드코딩된 6개 필드만 조립해 `llmCalls`가 애초에 들어갈 수 없는 shape 이다. 따라서 이 3개 메서드에 strip 이 없는 것은 결함이 아니다.
  - 제안: 조치 불요. (참고: `stripExternalOnlyFields` JSDoc 의 "새 외부 표면이 생기면 여기를 부르면 된다"는 이미 이전 라운드(`15_58_26` W2)에서 이 함정을 인지하고 대조표로 보강했다.)

- **[INFO]** 핵심 보안 요구사항(depth-무관 name-based strip, WS fanout + REST 양쪽 3출구 대칭 적용)이 코드·테스트·spec 세 층위에서 line-level 로 일치함을 직접 실행으로 재확인 — 새 발견 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:101-146`(`stripExternalOnlyFields`/`stripDeep`), `codebase/backend/src/modules/websocket/websocket.service.ts:450-453,524-527`(fanout 2곳), `codebase/backend/src/modules/external-interaction/interaction.service.ts:98-108,379,439-446`(REST 3곳), `spec/5-system/6-websocket-protocol.md:520`(§4.4 strip 선언), `spec/5-system/14-external-interaction-api.md:1386-1399`(§R17 세 출구 대칭 서술)
  - 상세: `npx jest strip-external-only-fields`(16/16) · `npx jest websocket.service.spec interaction.service.spec`(134/134) 를 직접 재실행해 통과 확인. `stripDeep`의 경계 연산자(`>`)·`maxDepth` 시맨틱(호출 시 depth=0 시작, 자매 `sanitizePayloadForWs`/`deepRedactSecrets`와 동일 규약)도 소스 대조로 검증했다. spec §4.4/§6.2/§R17 세 곳 모두 "필드명 기준 깊이 무관 제거, WS fanout + EIA REST getStatus 양쪽"으로 코드와 정확히 부합하는 문구를 담고 있다. TODO/FIXME/HACK/XXX 주석 없음(grep 확인).
  - 제안: 없음(positive finding).

### 요약
이번 diff 의 실질 코드 변경(`strip-external-only-fields.ts` 신설, `websocket.service.ts`/`interaction.service.ts`의 strip 적용 대칭화)은 "raw LLM 프롬프트가 depth-1 strip 우회 + REST 스냅샷 미방어로 외부에 새고 있었다"는 요구사항을 완전히 충족한다 — WS fanout 두 emit 지점과 REST `getStatus()`의 세 출구(waiting `nodeOutput`/terminal `result`/terminal `error`) 모두 같은 헬퍼를 이름 기반·깊이 무관으로 통과시키며, null/undefined/원시값/빈 배열/`__proto__`/다원소 배열/식별자 보존(clone-on-write) 등 엣지 케이스가 유닛·통합 테스트로 촘촘히 고정돼 있다(직접 재실행으로 150건 전부 통과 확인). spec(WS §4.4, EIA §6.2/§R17)과 코드가 필드명·상수·경계 연산자·호출 순서까지 line-level 로 일치하며, 관련 이력(7라운드 코드 리뷰 + 다수 consistency 라운드)이 모두 `review/`와 `plan/`에 정직하게 기록돼 CRITICAL 0으로 수렴한 상태다. 이번 리뷰에서 새로운 CRITICAL/WARNING 은 발견되지 않았다 — KB/background-run/notification emit 경로가 strip 을 우회하는지 별도로 전수 확인했으나 애초에 외부 fanout sink 를 타지 않아 문제가 없었고, `getStatus`의 `cancelled` 상태 `result`/`error` null 반환도 spec 예시와 정확히 일치한다. 브랜치의 표제 작업(`eia-terminal-payload.md`, 종결 payload `error` 객체화 등)은 이번 diff 에서 코드 변경이 전혀 없고 plan 상 "미착수"로 정직하게 남아 있어 요구사항 미이행이 아니다.

### 위험도
NONE

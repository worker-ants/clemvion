## 발견사항

- **[WARNING]** `execution.replay_unavailable` 폴백이 `getStatus` 응답의 `waiting_for_input` 이외 상태(터미널 상태)를 처리하지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1405-1431` (`seedWaitingFromStatus`), 소비부 `use-widget.ts:1343-1349` (`handleEiaEvent` 의 `execution.replay_unavailable` 분기)
  - 상세: SSE 5분 버퍼가 만료돼 `replay_unavailable` 이 오는 시점은 클라이언트가 **5분 이상 재연결하지 못한** 상황이다(`codebase/backend/src/modules/external-interaction/sse-adapter.service.ts` `replayOrSignalUnavailable`/`BUFFER_RETENTION_MS`). 이 창 동안 execution 이 실제로 `completed`/`failed`/`cancelled` 로 전이됐다면 그 terminal SSE 이벤트도 함께 버퍼에서 유실되어 다시는 전송되지 않는다(서버는 "신호 후 연결 유지"만 하고 재전송하지 않음 — EIA spec Rationale `R-replay-unavailable`: "신호 후 연결 유지"). 그런데 `seedWaitingFromStatus` 는 `status.status === "waiting_for_input"` 일 때만 `dispatch({type:"WAITING", ...})` 하고, 그 외 상태(terminal 포함)는 조용히 no-op 한다. 결과적으로 이 gap 안에서 execution 이 이미 종료됐다면 위젯은 `[ended]` 로 전이하지 못하고 기존 phase(특히 `streaming` — "AI 응답 중" 스피너)에 무기한 멈춰 있을 수 있다. `awaiting_user_message` 상태라면 사용자가 다음 메시지를 보낼 때 `sendCommand` 의 410 처리(`use-widget.ts:1506-1511`)로 사후 복구되지만, `streaming` 상태(사용자 액션 트리거가 없는 구간)에서는 복구 경로가 없다.
  - 제안: `seedWaitingFromStatus`(또는 별도 헬퍼)가 `status.status` 가 terminal(`completed`/`failed`/`cancelled`)일 때도 `dispatch({type:"ENDED", ...})` 로 반영하도록 분기를 추가. 신규 회귀 테스트로 "버퍼 만료 중 execution 이 이미 종료된 경우" 케이스를 `use-widget-eager-start.test.ts` 에 추가할 것을 권장. spec 쪽(`spec/7-channel-web-chat/1-widget-app.md §3.1`, `spec/5-system/14-external-interaction-api.md` R-replay-unavailable)도 현재 "getStatus 로 현재 상태 보정" 이라고만 서술해 terminal 케이스를 명시하지 않는데, 이는 침묵(회색지대)에 가까워 CRITICAL 이 아닌 WARNING 으로 분류함 — 코드 결정이 아니라 구현 커버리지 갭.

- **[INFO]** `execution.replay_unavailable` 다중 수신 시 `seedWaitingFromStatus` 동시 호출에 대한 순서/de-dup 가드 없음
  - 위치: `use-widget.ts:1343-1349`
  - 상세: 재연결이 짧은 간격으로 반복되면(불안정 네트워크) 여러 `getStatus` 요청이 동시에 in-flight 가 될 수 있고, 먼저 보낸 요청이 나중에 resolve 되면 최신 스냅샷을 이전 값으로 덮어쓸 수 있다(`start()`/`teardownSession` 에 있는 `startGenRef` 같은 세대 가드가 이 경로엔 없음). 서버가 gap 당 1회만 신호를 보내는 설계라 실무 발생 가능성은 낮음.
  - 제안: 필요 시 `startGenRef` 유사 패턴으로 stale 응답을 무시하는 가드 검토(현재 리스크는 낮아 즉시 수정 필수는 아님).

- 파일 1(`webauthn-response.dto.ts`) 및 spec 정합 확인: 신규 JSDoc(`WebAuthnCredentialListDto` 가 `SessionListDto` 와 동일 `{items:[]}` shape 이며 `{data:{items}}` load-bearing 계약이라는 서술)은 `spec/5-system/2-api-convention.md:434-436`(§5.2 "비-페이징 고정 컬렉션은 `{data:{items}}` 유지" Rationale) 및 `spec/5-system/1-auth.md:469` 와 line-level 로 정확히 일치함. 문제 없음.
- 파일 2(테스트 리팩터) 검증: `installControllableEventSource()` 추출 후 4개 호출부 전부 `getEs()` 로 재배선됐고 잔존 `latestEs`/`latest` 변수 없음(grep 확인). `npx vitest run src/widget/use-widget-eager-start.test.ts` 실제 실행 결과 **27 passed** (plan 서술과 일치), `npx tsc --noEmit` 도 clean. TODO/FIXME 등 미완성 마커 없음.
- 파일 3(`use-widget.ts`) 검증: `execution.replay_unavailable` 소비 분기가 스트림/세션을 건드리지 않고(teardown 미호출) `seedWaitingFromStatusRef` 만 통해 재동기화하는 구현은 spec `1-widget-app.md §3.1`("종료 신호가 아니므로 스트림·세션은 유지") 서술과 정확히 일치. TDZ 우회를 위한 ref 패턴은 매 렌더 대입이지만 부작용 없는 idempotent 대입이라 문제 없음. `seedWaitingFromStatusRef` 타입과 `seedWaitingFromStatus` 시그니처도 일치.
- 파일 4~7(plan/spec 문서) 검증: `use-widget-eager-start.test.ts` 실제 로그(27 passed) 및 코드 구현과 plan 서술("완료" 표기, "installControllableSse 로 통합하지 않은 이유" 등) 이 실제 diff 내용과 부합함. `spec/7-channel-web-chat/1-widget-app.md` 갱신 문구도 코드·EIA spec(`14-external-interaction-api.md` EIA-IN-07/EIA-NF-03/§5.2 Rationale)과 모순 없음. `grep` 로 구코드베이스 전체에서 "미배선/no-op" 류의 stale 문구가 남아있지 않음을 확인.

## 요약
핵심 기능(`execution.replay_unavailable` SSE 신호 소비 → `getStatus` 폴백 재동기화)은 spec(`1-widget-app.md §3.1`, EIA `14-external-interaction-api.md`)과 line-level 로 정확히 일치하게 구현됐고, 관련 테스트(27 passed)·타입체크가 모두 통과했다. 테스트 헬퍼 리팩터(`installControllableEventSource` 추출)와 webauthn DTO 주석 정정도 각각 실제 코드/스펙과 부합해 문제 없다. 다만 버퍼 만료 시점에 execution 이 이미 terminal 로 전이된 경우 `seedWaitingFromStatus` 가 `waiting_for_input` 상태만 처리하고 terminal 전이를 반영하지 않아, `streaming` 국면에서 사용자 액션 트리거 없이 위젯이 무기한 멈춰 있을 수 있는 엣지 케이스가 커버되지 않았다 — 회귀 테스트도 이 분기를 검증하지 않는다.

## 위험도
LOW
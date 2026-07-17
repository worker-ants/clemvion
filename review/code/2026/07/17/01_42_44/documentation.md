### 발견사항

- **[INFO]** 렌더 본문에서 직접 ref 를 대입(React "impure render" 관행 위반 소지)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatusRef.current = seedWaitingFromStatus;` (diff 상 `useWidget()` 본문, `seedWaitingFromStatus` `useCallback` 정의 직후)
  - 상세: `handleEiaEvent` 가 자신보다 아래에 정의된 `seedWaitingFromStatus` 를 TDZ 없이 참조하기 위해 ref 홀더를 도입했고, 그 ref 대입을 `useEffect` 가 아니라 컴포넌트 함수 본문(렌더 경로)에서 조건 없이 매 렌더마다 수행한다. React 의 "렌더는 순수해야 한다" 원칙상 `ref.current` 쓰기는 통상 이벤트 핸들러/effect 안에서만 하는 것이 권장되며, 렌더 중 mutate 는 concurrent 렌더링(예: 폐기되는 렌더, StrictMode 이중 호출) 환경에서 이론적으로 예측 불가한 타이밍 이슈의 소지가 된다.
  - 실질 위험도는 낮음: `seedWaitingFromStatus` 는 `useCallback(..., [])` 로 첫 렌더 이후 참조가 안정적이라 대입이 멱등적이며, `handleEiaEvent` 는 이벤트 콜백으로 렌더 완료 후에만 실행되므로 현재 관측 가능한 버그는 없음. 주석에 의도(재정렬 시 diff·deps 사슬 churn 회피)가 명시돼 있어 트레이드오프로 판단한 흔적은 있음.
  - 제안: 최소 변경으로 유지하려면 현행 유지도 무방하나, 엄밀히 하려면 `useEffect(() => { seedWaitingFromStatusRef.current = seedWaitingFromStatus; })`(deps 없이 매 렌더 후) 로 감싸는 편이 React 순수성 규칙에 더 부합.

- **[INFO]** `execution.replay_unavailable` 소비 분기에 in-flight/디바운스 가드 부재 — 반복 수신 시 중복 네트워크 호출 가능성
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `handleEiaEvent` 의 `else if (name === "execution.replay_unavailable")` 분기
  - 상세: 이 SSE 이벤트는 기존에는 완전 no-op(스트림·세션에 아무 부작용 없음)이었으나, 본 변경으로 수신 시마다 `seedWaitingFromStatus(client, session)` → `GET status` 네트워크 호출 + `dispatch({type:"WAITING",...})` 를 유발한다. `seedWaitingFromStatus` 자체엔 try/catch soft-fail 만 있고 "이미 진행 중" 가드가 없어, 서버/재연결 로직이 이 이벤트를 짧은 간격으로 재발사하면(예: 반복 reconnect 중 버퍼 만료 신호 재발생) 중복 GET 요청과 중복 `WAITING` dispatch 가 발생할 수 있다. 스펙·plan·회귀 테스트로 의도된 기능 추가임은 명확하나, 이 특정 부작용(네트워크 호출 트리거링 조건에 rate-limit 없음)은 검토 대상.
  - 제안: 문제로 확인되면 `seedWaitingFromStatus` 호출에 진행 중 플래그(ref) 가드를 추가해 동시/연속 replay_unavailable 이벤트에 대한 중복 호출을 억제. 현재 우선순위는 낮음(서버가 이 이벤트를 짧은 간격으로 반복 발사할 시나리오가 확인되지 않음).

- **[INFO]** 의도된 인터페이스/네트워크 행동 변경 (문서화됨, 참고용)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (신규 분기) + `spec/7-channel-web-chat/1-widget-app.md §3.1`(동반 갱신) + `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(추적 항목 완료 처리)
  - 상세: 이전엔 완전 무시되던 서버 이벤트가 이제 위젯의 실제 네트워크 호출(`GET status`)과 UI 상태 갱신(`WAITING` dispatch)을 유발한다 — spec·plan·신규 회귀 테스트(`use-widget-eager-start.test.ts` "버퍼 만료 재동기화")로 뒷받침되는 의도된 변경이며 "예상치 못한" 부작용은 아님. 호스트 통합자 관점에서 위젯의 네트워크 트래픽 패턴이 달라진다는 점만 참고로 기록.

- **[NONE]** `codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts` — JSDoc 주석만 교체, 런타임/시그니처/인터페이스 변경 없음.

- **[NONE]** `use-widget-eager-start.test.ts` 의 `installControllableEventSource()` 추출 — 테스트 파일 로컬 스코프의 헬퍼 리팩터로 외부 시그니처·공개 API 영향 없음. 로컬 클로저 변수(`latestEs`/`latest`)를 `getEs()` 접근자로 교체한 것은 동작 동등성이 명시적으로 검증됨(26→27 passed, 의도적 구현 무력화로 신규 테스트 실패 확인).

- **[NONE]** `plan/**`·`spec/**` md 파일 변경 — 문서/추적 갱신only, 코드 부작용 없음.

### 요약
production 코드 변경은 `use-widget.ts` 한 곳(EIA `execution.replay_unavailable` SSE 이벤트를 기존 `seedWaitingFromStatus` 로 배선)이 핵심이며, TDZ 회피를 위한 ref 홀더 패턴(렌더 본문에서의 ref 대입)과 이벤트 수신마다 추가 네트워크 호출을 유발하는 신규 분기가 부작용 관점에서 눈여겨볼 지점이다. 두 사항 모두 실질적 버그로 이어질 근거는 약하고(콜백 참조 안정성, 문서화된 설계 트레이드오프) 스펙·plan·회귀 테스트로 뒷받침되는 의도된 동작 확장이다. 나머지 파일(webauthn DTO 주석, 테스트 헬퍼 추출, plan/spec 문서)은 부작용 없음.

### 위험도
LOW
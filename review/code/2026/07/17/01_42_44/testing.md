# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** GET `/auth/2fa/webauthn/credentials` 의 `{ data: { items: [] } }` 응답 shape 를 "load-bearing 계약"이라고 새로 문서화했지만, 이를 고정(pin)하는 테스트가 어느 계층에도 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts:36-41` (JSDoc), 실제 반환부 `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:281-288` (`webauthnList`)
  - 상세: JSDoc 은 "`SessionListDto` 와 동일 shape 이며 bare array 로 낮추지 않는다"는 계약을 명시했으나, 실측 결과 `webauthn.controller.spec.ts` 에는 `webauthnList` 를 대상으로 한 `it(...)` 이 전혀 없고(`describe`/`it` grep 결과 `webauthnRegisterVerify`/`webauthnDelete`/`webauthnRegenerateRecovery` 3개뿐), `test/webauthn-2fa.e2e-spec.ts` 에도 `GET credentials` 호출이 없다. 반대로 동일 패턴의 `SessionsController.listSessions` 는 `sessions.controller.spec.ts:58,112` 에서 `expect(result).toEqual({ data: { items: [sample] } })` 로 shape 를 고정하고 있어 비대칭이다. 지금 이 diff 는 주석만 바꿨을 뿐 실제 계약을 검증하는 테스트는 추가하지 않았으므로, 향후 누군가 "bare array 로 낮추지 않는다"는 주석을 못 보고 리팩터링해도 아무 테스트도 실패하지 않는다.
  - 제안: `webauthn.controller.spec.ts` 에 `describe('webauthnList', ...)` 를 추가해 `listCredentials` mock 결과가 `{ data: { items: [...] } }` 로 매핑되는지(빈 배열 케이스 포함) `sessions.controller.spec.ts` 와 동일한 방식으로 pin. 여력이 되면 `webauthn-2fa.e2e-spec.ts` 에도 TransformInterceptor 를 통과한 최종 wire shape(`{ data: { items: [] } }`, 이중 래핑 아님)를 1건 e2e 로 고정.

- **[INFO]** `execution.replay_unavailable` 처리의 방어적 null-guard(`if (client && session)`) 및 `seedWaitingFromStatus` 실패 경로가 이 신규 소비 배선 자체로는 테스트되지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:173-179` (`if (client && session) void seedWaitingFromStatusRef.current?.(client, session);`), 관련 테스트는 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1123-1200`(신규 `describe("useWidget — 버퍼 만료 재동기화...")`) 1건만 존재
  - 상세: 신규 테스트는 happy path(진행 중 실행에서 `replay_unavailable` → `getStatus` 재조회 성공 → `waiting_for_input` 표면 반영)만 커버한다. 다음 경로는 미커버: (1) `client`/`session` 이 아직 없거나 이미 teardown 된 상태에서 이벤트가 도착하는 race(guard 가 실제로 방어하는 대상), (2) 폴백 `getStatus` 자체가 실패(네트워크 오류/410)하는 경우 — 데이터 유실 복구 시나리오인데 복구 수단마저 실패했을 때 사용자에게 어떤 상태로 남는지 unasserted (콘솔 warn 만 하고 조용히 무시), (3) `getStatus` 가 `waiting_for_input` 이 아닌 상태(예: `completed`/`running`)를 반환하는 분기. `seedWaitingFromStatus` 자체는 다른 호출부(race-fix, 복원 통합 등)에서 성공 경로가 검증돼 있어 완전히 미검증은 아니지만, `replay_unavailable` 트리거 관점의 실패/방어 경로는 전무하다.
  - 제안: 우선순위가 높은 (2)(getStatus 실패 시 정상적으로 스트림·세션이 유지되고 크래시하지 않는지)만이라도 1건 추가 권장. (1)은 실서비스에서 실제 발생 가능한 race(패널 종료 도중 지연 도착 SSE)이므로 여력이 되면 추가.

- **[INFO]** `getStatus` fetch 매처가 `init?.method === undefined` 로 다른 유사 테스트(`(init?.method ?? "GET") === "GET"`)와 다른 조건식 사용
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1160`(신규 테스트) vs 기존 패턴 `use-widget-eager-start.test.ts:1046`("race fix" 테스트)
  - 상세: 현재 `EiaClient.getStatus`(`codebase/channel-web-chat/src/lib/eia-client.ts:94-101`)가 `method` 를 명시하지 않으므로 `init?.method === undefined` 는 지금은 정확히 맞지만, 실제 구현이 `method: "GET"` 을 명시적으로 넣도록 바뀌면 이 mock 브랜치가 조용히 매치 실패해 `unexpected fetch` reject 로 빠지고 실패 사유가 모호해진다. 같은 파일 내 기존 관례(`?? "GET"`)와 불일치.
  - 제안: 일관성을 위해 `(init?.method ?? "GET") === "GET"` 패턴으로 통일 권장(현재 통과에는 영향 없는 사소한 개선).

- **[INFO]** `EventSource` stub 헬퍼 추출(`installControllableEventSource`) 리팩터링은 기계적 등가 치환이며 실측으로도 회귀 없음 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:71-97`(신규 헬퍼), 4개 호출부 치환
  - 상세: `npx vitest run src/widget/use-widget-eager-start.test.ts` 로 직접 재실행해 27/27 통과 확인(커밋 메시지 claim 과 일치). 클로저 캡처(`let latest`) → `getEs()` 리턴 방식으로 바뀐 것도 각 테스트가 독립적으로 새 인스턴스를 받으므로 테스트 격리에 영향 없음. `installControllableSse()` 를 그대로 통합하지 않고 별도 헬퍼로 분리한 판단(fetch mock 이 케이스마다 다른 3곳을 보존)은 회귀 테스트 유효성을 지키는 올바른 설계 판단.

## 요약

핵심 신규 로직(`execution.replay_unavailable` 소비 배선)에 대해 happy path 회귀 테스트를 추가했고, 커밋 메시지에 명시된 대로 구현을 일부러 무력화해 해당 테스트만 실패하는지 확인하는 mutation 검증까지 거쳐 신뢰도가 높다. 실측으로도 `use-widget-eager-start.test.ts` 27/27, `webauthn.controller.spec.ts` 8/8 모두 통과해 회귀는 없다. 다만 (1) webauthn DTO 주석이 새로 천명한 "load-bearing 계약"을 고정하는 테스트가 backend 어느 계층에도 없어 문서와 테스트 커버리지 사이 괴리가 남아 있고, (2) 프런트 신규 소비 로직은 happy path 1건뿐이라 방어적 null-guard 및 폴백 실패 경로(재동기화 수단 자체 실패 시나리오)가 비어 있다. 둘 다 이번 diff 를 막을 정도는 아니며 후속 보강 대상이다.

## 위험도
LOW

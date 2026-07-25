# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `Cafe24CallOptions`/`MakeshopCallOptions` 에 `signal?: AbortSignal` 옵셔널 필드 추가 — 인터페이스 확장
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:73` (`signal?: AbortSignal;`), `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:67`
  - 상세: 옵션 객체에 옵셔널 필드가 추가됐을 뿐 기존 필수 필드·`call()` 메서드 시그니처는 그대로다. 필드를 넘기지 않는 기존 호출자는 `signal: undefined` 로 동작해 이전과 동일 경로(리스너 미등록)를 탄다. `JSON.stringify` 대상은 `opts.body` 뿐이라 `AbortSignal` 이 직렬화(로그/영속화)를 오염시키지도 않는다(grep 확인). 하위 호환 확장으로 실질적 파급 없음.
  - 제안: 없음(정보성).

- **[INFO]** 호출자 소유 `AbortSignal` 에 `addEventListener`/`removeEventListener` 등록 — 클래스 내부가 아닌 외부(execution-scoped) 객체에 리스너를 붙이는 부작용
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` `executeWithRateLimit` 내 `const upstream = opts.signal; ... upstream.addEventListener('abort', onUpstreamAbort, { once: true });` 블록 (diff 게이트 `1218`~`1227`) 및 동일 패턴 `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` (diff 게이트 `847`~`856`)
  - 상세: `context.abortSignal` 은 여러 노드/호출이 공유할 수 있는 execution 단위 신호다. 여기 등록된 리스너는 각 호출마다 독립 클로저(`onUpstreamAbort`)를 만들고, `finally` 에서 **같은 참조**로 `removeEventListener` 하므로 성공 경로에서도 정확히 해제된다 — RESOLUTION.md 가 기록한 "성공 시 리스너 미해제" 결함(이전 커밋)은 이번 diff 에서 이미 수정된 상태로 확인됨. 429/401 재시도로 인한 재귀(`executeWithRateLimit` 이 자기 자신을 `return this.executeWithRateLimit(...)` 으로 호출)도 재귀 호출 전에 현재 프레임의 `finally` 가 이미 실행되므로 리스너 누적이 없다(코드 직접 대조 완료). 동시에 같은 `upstream` 시그널을 공유하는 별도 호출이 있어도 클로저가 호출별로 분리돼 있어 교차 오염은 없다.
  - 제안: 없음 — 부작용은 있으나 격리·해제가 올바르게 설계됨. `http-request.handler.ts` 에 동일 클래스의 선재 리스너 누수가 남아있다고 plan(`node-cancellation-residual-signal-propagation.md`) 에 후속으로 명시돼 있으니, 이번 diff 범위 밖이라는 판단은 타당.

- **[INFO]** already-aborted 분기에서도 `this.fetchImpl(...)` 호출(네트워크 계층 진입)은 생략되지 않음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` diff 게이트 `1220`~`1223`(`if (upstream.aborted) { controller.abort(); }` 후에도 이어지는 `response = await this.fetchImpl(url, {...})` 호출부, 게이트 `1230`), 동일 패턴 makeshop 쪽
  - 상세: 실행이 이미 취소된 상태(`upstream.aborted === true`)라도 코드는 조기 return 없이 `controller.abort()` 만 먼저 호출한 뒤 그대로 `fetchImpl` 을 호출한다. 즉 "취소된 실행"에 대해서도 fetch 함수 자체는 매 호출 진입한다 — 실제 소켓 오픈은 `fetch`/`undici` 구현이 이미 aborted 된 signal 을 보고 즉시 reject 하는 것에 의존한다. 이는 커밋 메시지·PR 코멘트(`"carries an aborted signal", not "skips the call"`)에 명시된 **의도된 설계**이며 결함은 아니다. 다만 "네트워크 호출" 관점 체크리스트상, 취소된 실행에서도 fetch 진입점을 매번 타는 점은 기록해 둘 가치가 있다(실측상 실제 TCP/TLS 핸드셰이크가 일어나는지는 Node 런타임의 `fetch`/`undici` 내부 동작에 달려 있고 본 diff 범위 밖).
  - 제안: 없음(설계 의도 확인됨). 향후 실제로 불필요한 네트워크 라운드트립이 관측되면 조기 return 도입을 고려할 수 있다는 점만 plan 에 이미 낙제 없이 기록돼 있음.

- **[INFO]** `context.abortSignal` 자체는 신규 필드가 아님 — 인터페이스 변경 아님
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:236` (`abortSignal?: AbortSignal;`, 본 diff 밖의 기존 코드)
  - 상세: `Cafe24Handler`/`MakeshopHandler` 가 `context.abortSignal` 을 client 호출에 실어 보내는 것(diff 게이트 `cafe24.handler.ts:260`, `makeshop.handler.ts:247`)은 이미 존재하는 `ExecutionContext.abortSignal` 필드를 읽어 전달할 뿐, `ExecutionContext` 인터페이스 자체를 바꾸지 않는다. `http-request.handler.ts` 가 이미 쓰는 것과 동일 패턴(코드에서 직접 확인).
  - 제안: 없음.

- **[INFO]** 신규 테스트가 실제 프로덕션 코드 경로에 부작용을 일으키지 않음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` describe 블록 `abortSignal cascade (node-cancellation §4)` (게이트 `95`~`249`), `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts` 동일 블록, 두 handler spec 의 `abortSignal forwarding` 블록
  - 상세: 테스트 내 `upstream.abort()` 호출·`fetchMock.mockImplementationOnce` 는 모두 테스트 더블 범위 안에 격리돼 있고, 실제 `fetch`/DB/네트워크에 영향 없음. `repo.update` 미호출 단언(cancel 시 `recordNetworkFailure` 스킵)과 호출 단언(timeout 시 카운터 유지)이 상호 대조군으로 존재해 회귀에 강함.
  - 제안: 없음.

- **[INFO]** `plan/`·`review/` 마크다운 변경은 문서/추적 산출물이며 코드 실행 경로에 영향 없음
  - 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(신규), `review/code/2026/07/25/21_02_33/RESOLUTION.md`(신규)
  - 상세: `RESOLUTION.md` 는 직전 리뷰가 잡은 2 Critical(취소가 `cancelled` 대신 `error(network)`로 오분류되던 것, 취소가 네트워크 실패 카운터를 오염시키던 것)과 1 Warning(성공 경로 리스너 미해제)이 **이미 이번 diff 의 최종 코드에 반영**돼 있음을 뒷받침한다 — 실제 diff 코드(재throw + `upstream?.aborted` 분기 + `finally` cleanup)와 RESOLUTION.md 서술이 일치함을 대조 확인.
  - 제안: 없음.

## 요약

이번 diff 는 Cafe24/MakeShop API client 의 `Cafe24CallOptions`/`MakeshopCallOptions` 에 옵셔널 `signal` 필드를 추가하고, handler 가 기존에 이미 존재하던 `context.abortSignal` 을 그 필드로 전달하며, client 내부에서 실행 취소 신호를 자신의 per-call timeout `AbortController` 로 cascade 하는 변경이다. 시그니처·공개 인터페이스는 모두 하위 호환 방식(옵셔널 필드 추가)으로 확장됐고, 새로 등록되는 이벤트 리스너(호출자 소유 `AbortSignal` 위)는 `finally` 블록에서 동일 참조로 정확히 해제되며 재귀(429/401 재시도) 경로에서도 리스너 누적이 발생하지 않음을 코드 대조로 확인했다. 전역 변수·환경 변수·파일시스템 부작용은 없고, 신규 네트워크 호출도 없다(기존 fetch 호출에 signal 을 실어 보낼 뿐). 유일하게 기록해 둘 지점은 "이미 취소된 실행"에서도 조기 return 없이 `fetchImpl` 진입점을 그대로 타는 설계인데, 이는 커밋 주석과 plan 문서에 의도적으로 명시된 사항이라 결함으로 보지 않는다. RESOLUTION.md 를 통해 직전 리뷰에서 지적된 부작용 관련 Critical 2건(취소의 오분류, 네트워크 실패 카운터 오염)·Warning 1건(성공 경로 리스너 미해제)이 실제 코드에 반영돼 해소됐음도 대조 확인했다.

## 위험도

NONE

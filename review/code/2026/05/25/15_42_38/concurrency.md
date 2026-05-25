# 동시성(Concurrency) 리뷰 결과

리뷰 일시: 2026-05-25
대상 파일:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `review/consistency/2026/05/25/15_27_39/` (markdown 산출물 — 동시성 무관)

---

## 발견사항

### [INFO] `waitForAiConversation` 루프 내 `button_click` 분기 — 루프 재진입 패턴 검토

- 위치: `execution-engine.service.ts` diff +3063~+3092 (`else if (action.type === 'button_click')` 분기)
- 상세: 신규 분기는 `button_click` action 수신 시 `unknownSkipCount` 를 증가시키지 않고 warn 로그만 남긴 뒤 `waitForAiConversation` 루프를 재진입한다. 루프는 단일 async/await 체인으로 구성되어 있으며, 각 iteration 마다 `pendingContinuations` Map 에 새로운 Promise resolver 를 등록한 뒤 `await` 로 외부 이벤트를 기다린다. Node.js 단일 스레드 이벤트 루프 모델에서 `button_click` 이 무한히 반복되어도 Promise 체인이 stack 을 점유하지 않고 microtask queue 를 통해 순차 처리되므로, 이벤트 루프 블로킹 위험은 없다.
- 제안: 현재 구현에 동시성 문제는 없다. 단, `button_click` 이 이론적으로 무한 반복될 수 있으므로, 운영 환경에서 과도한 warn 로그 발생 시 로그 레이트 리미팅을 검토할 수 있다 (기능 정확성 문제는 아님).

### [INFO] `pendingContinuations` Map 단일 인스턴스 접근 — 비동기 경쟁 조건 부재 확인

- 위치: `execution-engine.service.ts` 전체 (`pendingContinuations` Map 사용 패턴)
- 상세: `pendingContinuations` 는 Node.js 단일 스레드 환경에서 동작하므로 Map 의 get/set/delete 가 인터리빙될 수 없다. `button_click` 분기 추가 후에도 Map 에 대한 비동기 접근 패턴이 변경되지 않았다. `await` 경계 전후로 Map 키를 재확인하는 로직이 없지만, `applyContinuation` 이 `resolve` 호출 직후 `delete` 하고 다음 iteration 이 `set` 을 수행하는 순서가 이미 보장되어 있다.
- 제안: 해당 없음. 현재 구현으로 충분하다.

### [INFO] 테스트 내 `flushPromises` 반복 호출 패턴 — 테스트 신뢰성 관점

- 위치: `execution-engine.service.spec.ts` +68~+87 (신규 테스트의 `for` 루프 내 `await flushPromises()`)
- 상세: 테스트는 `setImmediate` 기반의 `flushPromises()` 를 25회 루프에서 매 iteration 마다 호출한다. 이 패턴은 Promise microtask 를 모두 drain 한 뒤 다음 pending resolve 를 주입하는 방식으로, 단일 스레드 Jest 환경에서 각 iteration 의 순서가 보장된다. 경쟁 조건이 발생할 구조적 요인이 없다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 `waitForAiConversation` 루프에 `button_click` 에 대한 명시적 else-if 분기를 추가하여, 텔레그램 stale inline_keyboard 클릭이 `MAX_UNKNOWN_SKIPS` 카운터에 누적되지 않도록 한다. Node.js 단일 스레드 이벤트 루프 특성상 루프 재진입이 Promise 체인을 통해 안전하게 처리되며, `pendingContinuations` Map 에 대한 동시 접근 위험도 없다. async/await 사용은 기존 패턴을 그대로 유지하고 있으며, 새로 추가된 분기에서 await 누락이나 비동기 흐름 오류가 없다. 동시성 관점에서 이 변경은 위험도가 없다. 나머지 변경 파일(review/consistency 산출물)은 동시성과 무관한 문서 파일이다.

---

## 위험도

NONE

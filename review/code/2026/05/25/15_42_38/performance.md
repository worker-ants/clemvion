# 성능(Performance) 리뷰

리뷰 대상: telegram-carousel-button-click (2026-05-25)
주요 변경: `execution-engine.service.ts` `waitForAiConversation` — `button_click` 전용 else-if 분기 추가 + 대응 테스트 케이스

---

## 발견사항

### [INFO] warn 로그 문자열 빌드 — 스택 할당 비용은 경미하나 메시지 길이 주의

- 위치: `execution-engine.service.ts` 신규 else-if 분기 내 `this.logger.warn(...)` 호출 (diff 라인 +3063~+3063+22)
- 상세: 경고 메시지 문자열이 리터럴 + 런타임 값 보간으로 구성되어 있으며, `buttonIdRaw` 를 `slice(0, 64)` 로 잘라서 사용하는 것은 올바른 처리다. `button_click` 은 stale inline_keyboard 클릭이 누적될 수 있는 경로이므로 실제 운영에서 매우 높은 빈도로 호출될 수 있다. 현재 구현은 매 호출마다 고정 길이 문자열을 생성해 로거에 전달한다. 프레임워크(NestJS Logger / pino 등)가 로그 레벨에 따라 문자열 보간을 지연(lazy)하지 않는다면, 로그 레벨이 warn 이상으로 설정되어 있는 한 비용은 항상 발생한다.
- 제안: 현재 규모에서는 문제가 되지 않지만, 클릭이 수백 회/초 이상 유입될 수 있는 채널에서는 pino structured logging 의 `{ executionId, buttonId }` 객체 패턴으로 변경하면 문자열 연결 비용을 줄일 수 있다. (참고: `buttonIdStr` 변수는 이미 올바르게 길이 제한되어 있음)

---

### [INFO] 테스트 루프 — 25회 `await flushPromises()` 순차 호출

- 위치: `execution-engine.service.spec.ts` 신규 테스트 케이스 `for (let i = 0; i < 25; i += 1)` (diff 라인 +79~+84)
- 상세: 테스트가 `for` 루프 안에서 25회 `await flushPromises()` 를 순차 실행한다. `flushPromises` 는 `setImmediate` 기반의 마이크로태스크 드레인으로 루프당 최소 1 이벤트 루프 틱을 소비한다. 이는 단순 단위 테스트치고는 이벤트 루프 전환이 많은 편이나, 테스트의 목적(25회 연속 button_click 이 MAX_UNKNOWN_SKIPS 를 초과해도 대화가 살아있는지 검증)을 위해 필수적이다. `pendingContinuations` Map 에서 매 iteration 마다 새 엔트리가 등록되는 것을 기다려야 하므로 배치 처리로 단축하기 어렵다.
- 제안: 테스트 실행 시간 측면에서는 허용 범위이나, 25 → 21 (MAX_UNKNOWN_SKIPS+1) 로 반복 횟수를 줄여도 회귀를 동등하게 검증할 수 있다. 그러나 충분한 마진을 두어 25로 설정한 의도(주석에 명시)가 있으므로 변경 필요성은 낮다.

---

### [INFO] `warnSpy.mock.calls.map((c) => String(c[0]))` — 호출 후 전체 스캔

- 위치: `execution-engine.service.spec.ts` 신규 테스트 케이스 라인 +95~+98
- 상세: `warnSpy.mock.calls` 전체를 `map` 한 뒤 `some` 으로 스캔한다. warn 호출 수가 많아질수록 O(n) 탐색 비용이 증가하지만, 테스트 컨텍스트에서의 warn 호출 수는 매우 제한적이므로 실질적 영향은 없다. 프로덕션 코드가 아닌 테스트 어설션이다.
- 제안: 문제 없음. 현 구현 그대로 유지 권장.

---

### [INFO] `buttonIdRaw` 타입 단언 + `slice(0, 64)` — 적절한 방어 처리

- 위치: `execution-engine.service.ts` 신규 분기 내 `const buttonIdRaw = (action as { buttonId?: unknown }).buttonId;` (diff 라인 +3059)
- 상세: `buttonId` 가 `string` 이 아닐 경우를 방어하여 `''` 로 폴백하고, 문자열 최대 64바이트로 제한하는 것은 올바른 처리다. 불필요한 객체 생성이나 메모리 누수 위험이 없다. `typeof` 가드 + `slice` 조합은 O(1) 연산이다.
- 제안: 현 구현 그대로 유지 권장.

---

## 요약

이번 변경은 `waitForAiConversation` 내 무한 누적 가능한 `button_click` 이벤트를 `MAX_UNKNOWN_SKIPS` 카운터에서 분리하는 단순한 else-if 분기 추가다. 추가된 코드 경로는 O(1) 로직(타입 가드, 64자 슬라이스, warn 로그 1회)으로 구성되어 있으며, 기존 루프 구조나 데이터 구조를 변경하지 않는다. 메모리 할당, N+1 쿼리, 블로킹 I/O 등의 성능 이슈는 발견되지 않았다. 운영 환경에서 stale 클릭이 높은 빈도로 유입될 경우 warn 로그 문자열 생성 비용이 누적될 수 있으나, 이는 기존 else 분기의 warn 로그와 동일한 수준이며 채널 채널의 클릭 속도 한계를 고려하면 실질적 병목이 될 가능성은 낮다. 테스트 케이스의 25회 순차 `flushPromises` 는 목적에 부합하며 CI 속도에 미치는 영향은 미미하다.

---

## 위험도

NONE

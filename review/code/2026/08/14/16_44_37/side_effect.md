### 발견사항

- **[INFO]** `stripAndRedact` 가 `stripExternalOnlyFields` 의 clone-on-write 결과를 `deepRedactSecrets` 에 넘기면서, `llmCalls` 를 포함한 payload(이 PR 이 정확히 겨냥하는 케이스)에 대해 `deepRedactSecrets` 의 기존 identity 캐시(`DEEP_REDACT_CACHE`)가 항상 miss 로 빠진다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:98-108`(`stripAndRedact`, 특히 105-107) ↔ `codebase/backend/src/shared/utils/sanitize-error-message.ts:107`(`DEEP_REDACT_CACHE` 선언), `:136-141`(depth-0 캐시 조회/저장)
  - 상세: `DEEP_REDACT_CACHE` 는 `deepRedactSecrets` 에 **depth-0 로 넘어온 객체의 identity** 로 키를 잡는 `WeakMap`이다. 종전 코드는 `deepRedactSecrets(nodeExec.outputData ?? {})`/`deepRedactSecrets(execution.outputData ?? null)` 처럼 엔티티 필드를 **직접** 넘겼으므로, 같은 실행 레코드에 대한 반복 `getStatus()` 폴링(클라이언트가 `waiting_for_input` 동안 흔히 하는 패턴)이 같은 객체 identity 를 재사용하면 캐시가 적중할 여지가 있었다. 지금은 `stripExternalOnlyFields(value, MAX_REDACT_DEPTH)` 가 먼저 끼어드는데, `stripDeep`(`strip-external-only-fields.ts:105-146`)은 `llmCalls` 처럼 실제로 지울 것이 있으면 재귀 경로 전체에서 `{...obj}` 로 **새 최상위 객체를 매번 새로 할당**한다(clone-on-write는 "손 안 댄 서브트리" 에만 identity 를 보존하지, 최상위 자체는 스트립이 일어난 이상 항상 새 객체다). 그 결과 `deepRedactSecrets` 가 받는 depth-0 객체의 identity 가 호출마다 달라져 캐시가 절대 적중하지 않는다. 정확성 버그는 아니다(WeakMap 이라 stale 값이 남지도, 메모리가 새지도 않는다) — 다만 이 PR 이 새로 추가한 코드 경로가 **다른 모듈이 소유한 기존 전역 캐시의 효과를 조용히 무력화**하는 상호작용이며, 하필 캐시가 가장 도움이 됐을 대형 페이로드(`llmCalls`)에서 그렇다. `RESOLUTION.md`(`11_02_16`) WARNING 2 는 `stripDeep` **자체**에 identity 캐시가 없다는 지적을 유예한 것으로, 메커니즘은 다르지만 결이 같은 항목이다(둘 다 "이 PR 이 반복 emit/조회 시나리오의 캐싱 이점을 제거한다").
  - 제안: 별도 조치 불요 — REST `getStatus` 는 WS fanout 처럼 초당 다회 emit 되는 hot path 가 아니라 사용자 폴링 빈도로 제한되고, 이미 JSDoc 의 "비용 (실측)" 절이 이중 순회 비용을 문서화하고 있다. 다만 다음에 `stripDeep`/`deepRedactSecrets` 캐싱을 함께 재검토할 때(WARNING 2 후속) 이 상호작용도 같이 고려할 것.

- **[INFO]** `stripExternalOnlyFields` 시그니처가 `(envelope) => Record<string, unknown>` 에서 `<T>(value: T, maxDepth: number) => T` 로 바뀌었으나, 종전 함수가 `websocket.service.ts` 모듈 비공개(non-exported)였으므로 이 diff 밖의 호출자에 영향이 없다 — 확인했으나 문제 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:101-103`(신규 공개 시그니처) — 종전 정의는 `codebase/backend/src/modules/websocket/websocket.service.ts` 에서 삭제됨
  - 상세: `grep -rn "stripExternalOnlyFields" codebase/`로 전수 확인한 결과 이 diff 가 갱신한 2개 호출부(`websocket.service.ts:450`,`524`) + 1개 신규 호출부(`interaction.service.ts:106`, `stripAndRedact` 내부)만 존재하고, 옛 1-인자 시그니처를 쓰는 잔존 호출부는 없다. 함수가 새로 **공개(export)** 됐지만 현재는 두 모듈만 소비하며 둘 다 자매 sanitizer 의 `MAX_*_DEPTH` 상수를 명시적으로 넘긴다(계약이 JSDoc `@param maxDepth` 에 문서화됨).
  - 제안: 조치 불요.

- **[INFO]** 내부 WS 채널(에디터)로의 broadcast 는 strip 이전에 이미 발생하고, strip 은 입력을 변형하지 않는다는 계약이 테스트로 고정돼 있다 — 이미 broadcast 된 wire envelope 이 이후 fanout 처리로 소급 오염될 경로 없음 (positive finding)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:442`(`this.gateway.broadcastToChannel(channel, eventType, wireEnvelope)`, strip 이전) → `:450-453`(strip 호출, 새 파생 객체) → `:454-457`(`attachRoutingContext`, 미등록 시 동일 참조 반환·등록 시 `{...wireEnvelope, ...additions}` 로 새 객체 — 원본 미변형)
  - 상세: `strip-external-only-fields.spec.ts`의 "입력을 변형하지 않는다" 테스트와 `websocket.service.spec.ts`의 "제거할 필드가 없으면 fanout payload 가 wire envelope 과 동일 객체다(할당 없음)" 테스트가 이 불변성을 실행으로 고정한다. `attachRoutingContext`(546-560, 이 diff 밖)도 항상 신규 병합 객체를 반환하거나 무변경 시 동일 참조를 반환할 뿐 원본을 mutate 하지 않는다.
  - 제안: 없음.

- **[INFO]** `emitExecutionEvent`/`emitNodeEvent` 의 이벤트·콜백 계약(호출 순서·인자 shape·구독자에게 노출되는 `{executionId, eventType, seq, payload}`)은 이 diff 로 변경되지 않았다 — strip 구현만 교체됐다 (positive finding)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:424-481`(`emitExecutionEvent`), `:503-538`(`emitNodeEvent`)
  - 상세: `this.gateway.broadcastToChannel(...)` → 파생 payload 구성 → `this.executionEventSubject.next({...})` 순서와 인자 구조가 그대로다. 바뀐 것은 파생 payload 를 만드는 내부 호출이 로컬 함수에서 공유 유틸(+명시적 `maxDepth` 인자)로 바뀐 것뿐이며, 신규/삭제된 이벤트 타입이나 구독자 인터페이스 변경은 없다.
  - 제안: 없음.

- **[INFO]** 이 diff 의 애플리케이션 코드(`interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts`)에는 신규 전역 변수·환경 변수 읽기/쓰기·네트워크 호출·파일시스템 접근이 없다 — 확인했으나 문제 없음
  - 위치: 세 파일 전체 (`grep -n "process.env"` 0건, 신규 module-level `let`/가변 싱글턴 0건)
  - 상세: `EXTERNAL_STRIPPED_FIELDS`(`strip-external-only-fields.ts:91`)는 `websocket.service.ts` 에 있던 module-private 상수를 그대로 옮긴 것이고 `as const` readonly 배열이라 이 diff 안에서 mutate 되지 않는다(다만 공유 모듈로 옮기며 export 범위가 넓어진 점은 위 두 번째 항목과 함께 참고). `review/**`·`plan/**`·`CHANGELOG.md`·`spec/**` 에 대한 파일시스템 쓰기는 이 프로젝트의 정식 리뷰/플랜 워크플로 산출물(CLAUDE.md "정보 저장 위치" 표)이지 코드가 런타임에 일으키는 부작용이 아니다.
  - 제안: 조치 불요.

### 요약

핵심 변경(`stripExternalOnlyFields` 를 depth-1 shallow strip 에서 깊이 무관 재귀 strip 으로 바꾸고, WS fanout·EIA REST `getStatus` 가 같은 공유 유틸을 부르게 통일한 것)은 부작용 관점에서 안전하다 — 입력 비변형(clone-on-write, 테스트로 고정)·`__proto__` 오염 방지(스프레드 + `defineProperty`, 테스트로 고정)·이벤트/콜백 계약 불변·신규 전역 변수·환경 변수·네트워크·파일시스템 부작용 없음을 코드 추적과 소스 확인으로 검증했다. `stripExternalOnlyFields` 의 시그니처가 바뀌었으나 종전 함수가 module-private 이었으므로 외부 호출자 영향은 없고, 이 diff 안의 모든 호출부가 이미 갱신돼 있다. 유일하게 새로 짚을 만한 상호작용은 `stripAndRedact` 의 clone-on-write 산출물이 `deepRedactSecrets` 의 기존 identity 캐시(`DEEP_REDACT_CACHE`, 다른 모듈 소유)를 `llmCalls` 포함 payload 에 대해 항상 무력화한다는 점인데, 정확성 버그가 아니고 이미 문서화·유예된 성능 논의(WARNING 2)와 같은 계열이라 INFO 로 남긴다.

### 위험도
LOW

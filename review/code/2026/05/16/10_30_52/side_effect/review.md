# 부작용(Side Effect) 코드 리뷰

## 발견사항

### 파일 4 & 5: ChatMessage 인터페이스 확장 + LlmService sanitize 처리

- **[INFO]** `ChatMessage` 인터페이스에 선택적 필드 `source?: 'live' | 'injected'` 추가
  - 위치: `backend/src/modules/llm/interfaces/llm-client.interface.ts` — `source?` 필드 신규
  - 상세: 기존 인터페이스에 선택 필드(optional)를 추가하는 변경이므로 기존 호출자에게 즉각적 파괴적 영향은 없다. 다만 `ChatMessage` 를 직접 생성하는 모든 코드(handler, mock, test stub)가 해당 필드를 인식하지 못하면 런타임에서 `source: undefined` 로 전달되어 `withSourceMarker`의 backfill 로직이 작동한다. 이 동작은 의도된 것이나 구현 전체를 이해하지 못한 새 기여자가 `source` 미포함 메시지를 `push`하면 자동으로 `'live'`로 취급되는 암묵적 계약이 생긴다.
  - 제안: JSDoc에 "미제공 시 emit 레이어에서 `'live'`로 backfill된다"는 명시적 안내가 이미 잘 작성돼 있음. 추가 조치 불필요.

- **[WARNING]** `LlmService.chat`에서 `source` 필드를 strip하는 sanitize 단계가 `params` 원본 객체를 변형하지 않고 새 배열을 생성하나, `void source`를 사용하는 패턴이 의도를 흐릴 수 있음
  - 위치: `backend/src/modules/llm/llm.service.ts` — `sanitized` 블록 (라인 ~224)
  - 상세: `({ source, ...rest }) => { void source; return rest; }` 에서 `void source`는 "사용하지 않는 변수" lint 경고를 억제하기 위한 관용구이나, TypeScript `noUnusedLocals` 규칙에 따라서는 단순히 `_source`로 이름을 바꿔 언더스코어 prefix로 명시하는 편이 더 관용적이다. 현재 패턴은 기능적으로 정확하며 원본 `params` 객체를 변경하지 않는다(spread 사용). 부작용 없음.
  - 제안: `({ source: _source, ...rest }) => rest` 로 단순화하면 `void` 부작용 패턴 제거 가능. 선택 사항.

### 파일 2: `withSourceMarker` 함수 + `buildConversationConfigFromOutput` 변경

- **[INFO]** `withSourceMarker`가 module-private(`export` 없음) 순수 함수로 도입됨
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` — 라인 ~96-104
  - 상세: 전역 변수 수정 없음. 입력 배열을 변형하지 않고 새 배열을 반환(`.map((m) => ({ ...m, source: 'live' }))`). 기존 두 호출 지점(`buildConversationConfigFromOutput`, `condMessages` 블록)에서 `filter` 결과를 `withSourceMarker`로 감싸는 방식으로 주입되어 원본 `messagesAll`은 수정되지 않는다.
  - 제안: 부작용 없음. 다만 `withSourceMarker`가 `system` 역할 메시지에도 적용될 경우를 대비해, filter 이후에 호출되고 있음을 확인했으므로 시스템 메시지가 포함될 일은 없다.

- **[WARNING]** `withSourceMarker`가 `system` 롤 메시지를 명시적으로 제외하지 않음
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` — `withSourceMarker` 구현부
  - 상세: 함수 내부 로직은 `m.source === 'injected' || m.source === 'live'`가 아닐 경우 `source: 'live'`를 붙인다. 현재 두 호출 지점 모두 `.filter((m) => m.role !== 'system')` 이후에 `withSourceMarker`를 호출하므로 시스템 메시지가 들어오지 않는다. 그러나 함수 시그니처(인자 타입 `Array<Record<string, unknown>>`)는 역할 필터링을 가정하지 않아, 미래에 다른 지점에서 `withSourceMarker`를 filter 없이 호출하면 시스템 메시지에도 `source: 'live'`가 붙는다. 이는 스펙 §4.4.6 위반 가능성.
  - 제안: `withSourceMarker` 내부에서 `m.role === 'system'`인 메시지는 건드리지 않는 가드를 추가하는 것이 방어적으로 바람직하다: `m.role === 'system' ? m : (m.source === 'injected' || m.source === 'live' ? m : { ...m, source: 'live' })`.

### 파일 6: `mapTurnsToChatMessages` 함수에서 `source: 'injected'` 추가

- **[INFO]** 기존 반환값 구조에 `source: 'injected'` 필드 추가
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `mapTurnsToChatMessages` 함수 전체
  - 상세: 함수 시그니처는 변경되지 않았다(`ConversationTurn[]` → `ChatMessage[]`). 반환되는 각 `ChatMessage` 객체에 `source: 'injected'`가 추가될 뿐이다. 이 함수의 소비자는 `LlmService`(provider 호출 전 strip됨)와 `buildConversationConfigFromOutput`(emit 레이어)이므로 직접적 파괴적 부작용은 없다. `LlmService`의 sanitize 단계가 `source`를 제거하므로 LLM API 측에는 영향 없음이 확인된다.
  - 제안: 이상 없음.

- **[INFO]** `system` case에도 `source: 'injected'`가 붙음
  - 위치: `ai-agent.handler.ts` — `case 'system'` 분기
  - 상세: `withSourceMarker`는 filter 후 호출돼 시스템 메시지를 보지 않지만, `mapTurnsToChatMessages`는 `system` 롤 메시지에도 `source: 'injected'`를 붙인다. 이 메시지는 이후 `buildConversationConfigFromOutput`의 `filter((m) => m.role !== 'system')`에서 걸러지므로 WebSocket으로 emit되지는 않는다. LLM 호출 경로에서는 `sanitize`로 strip된다. 기능적 문제 없음.
  - 제안: 혼란을 줄이기 위해 `system` case에서는 `source`를 붙이지 않아도 무방하나, 현 동작도 안전하다.

### 파일 9 & 10: `messagesToConversationItems` 변경 + `ConversationItem.isInjected` 추가

- **[WARNING]** `ConversationItem` 인터페이스에 `isInjected?: boolean` 추가 — 기존 소비자 영향
  - 위치: `frontend/src/lib/stores/execution-store.ts` — `isInjected?` 신규 필드
  - 상세: 선택 필드이므로 타입 수준에서의 파괴적 변경은 없다. 그러나 `ConversationItem`을 소비하는 UI 컴포넌트가 `isInjected` 플래그를 무시하면 injected 메시지와 live 메시지가 시각적으로 구분되지 않아 UX 불완전이 발생한다. 이는 부작용이라기보다 기능 미완성이나, "injected context chip" 렌더링이 이번 PR에 포함되지 않았다면 인터페이스와 UI 사이의 의미론적 격차가 생긴다.
  - 제안: 이번 PR 범위 내에서 `isInjected === true`인 항목에 대한 UI 처리(chip 렌더, 또는 명시적 skip 로직)가 있는지 확인 필요. 없다면 후속 PR 계획을 주석 또는 TODO로 명시 권장.

- **[WARNING]** `messagesToConversationItems`의 `turnIndex: currentTurn || 1` 변경 — 엣지 케이스
  - 위치: `frontend/src/lib/conversation/conversation-utils.ts` — user 분기 내 `turnIndex: currentTurn || 1`
  - 상세: 기존 코드에서 `currentTurn`은 user 메시지가 올 때마다 증가했으므로 첫 user 메시지에서 `currentTurn === 1`이 보장됐다. 이번 변경에서 injected user 메시지는 `currentTurn`을 증가시키지 않으므로 첫 메시지가 injected인 경우 `currentTurn`은 여전히 0이다. `turnIndex: currentTurn || 1`이 이를 보정하나, `0 || 1 === 1`은 JavaScript 특성상 0을 falsy로 처리하는 관용구이다. 이는 injected 메시지가 첫 번째로 올 때 `turnIndex === 1`을 반환하는 의도된 동작이지만, 의미론적으로 injected 메시지의 `turnIndex`가 실제 turn 번호와 다를 수 있다는 점에서 혼란 가능성이 있다.
  - 제안: 0 보정보다 `isInjected` 메시지에 명시적으로 `turnIndex: 0` 또는 별도 처리(예: `isInjected ? null : currentTurn`)를 고려하면 의미가 더 명확해진다. 현재 동작은 기능적으로는 테스트로 검증되었으므로 필수 수정은 아님.

### 파일 11: `use-execution-events.ts` — 인라인 타입 확장

- **[INFO]** WebSocket 이벤트 핸들러 내 인라인 타입 두 곳에 `source?: "live" | "injected"` 추가
  - 위치: `frontend/src/lib/websocket/use-execution-events.ts` — 라인 ~222, ~319
  - 상세: 인라인 타입 선언 추가이므로 런타임 동작 변경 없음. 기존 핸들러 로직은 `source` 필드를 직접 처리하지 않고 `messagesToConversationItems`로 넘기는 방식이므로 처리는 그쪽에서 담당한다. 전역 상태·이벤트 발생 패턴의 변경 없음.
  - 제안: 이상 없음.

### 파일 3: `third-party-oauth.controller.spec.ts` — 타입 캐스팅 개선

- **[INFO]** `headers` 타입 캐스팅을 `Record<string, unknown>`에서 `Record<string, string>`으로 강화
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` — 라인 ~425
  - 상세: 테스트 전용 변경. `String(contentType ?? '')` → `contentType ?? ''`로 단순화. `Record<string, string>`으로 타입이 좁아졌으므로 컴파일 타임에 더 정확한 검증이 가능하다. 부작용 없음.
  - 제안: 이상 없음.

### 파일 12 & 13: plan/review 문서 신규 생성

- **[INFO]** `plan/in-progress/spec-update-impl-prep-findings.md` 신규 파일 생성
  - 위치: `plan/in-progress/spec-update-impl-prep-findings.md`
  - 상세: plan 문서 규약에 맞는 frontmatter 포함. 파일시스템 부작용 관점에서 의도된 신규 생성이며 기존 파일을 변경하지 않는다.
  - 제안: 이상 없음.

- **[INFO]** `review/consistency/2026/05/16/10_01_06/SUMMARY.md` 신규 생성
  - 위치: `review/consistency/2026/05/16/10_01_06/SUMMARY.md`
  - 상세: nested ISO 경로 규약을 따름. 기존 데이터에 영향 없음.
  - 제안: 이상 없음.

---

## 요약

이번 변경의 핵심은 `ChatMessage.source` 마커(`'live' | 'injected'`)를 스택 전체(backend 인터페이스 → handler → emit 레이어 → LlmService sanitize → frontend store → WebSocket 이벤트 핸들러)에 일관되게 전파하는 것이다. 부작용 관점에서 가장 주목할 지점은 두 가지다. 첫째, `withSourceMarker` 함수가 `system` 롤 메시지에 대한 가드를 내부적으로 갖지 않아 호출 지점이 filter 선행을 보장하지 않으면 system 메시지에도 `source: 'live'`가 붙을 수 있다(현재 두 호출 지점은 안전하나 미래 확장 리스크). 둒째, `messagesToConversationItems`에서 injected 메시지가 `currentTurn`을 증가시키지 않도록 바뀌어 `turnIndex`의 의미론이 변경됐으며 `ConversationItem.isInjected`가 추가됐지만 UI 레이어에서의 소비 구현이 이번 PR에 포함되는지 확인이 필요하다. 전역 변수 수정, 예상치 못한 파일시스템 부작용, 네트워크 호출 추가, 이벤트 발생 패턴 변경은 발견되지 않았다. `LlmService`의 sanitize 처리가 `source` 필드를 LLM API 호출 전 strip하는 것이 명확히 확인되어 provider API에 대한 의도치 않은 데이터 노출 위험은 없다.

---

## 위험도

LOW

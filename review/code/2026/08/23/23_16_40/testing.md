# 테스트(Testing) 리뷰 — SSE/fanout nodeOutput allowlist (23_16_40)

이번 라운드는 직전 리뷰(`22_51_46`)의 WARNING 2건(REST 표면 확대 미검증 W1, `buttonConfig`
copy-on-change 미검증 W2)에 대한 후속 조치다. 두 항목 모두 실제 코드에서 확인했다.

## 발견사항

- **[INFO]** `emitNodeEvent` 경로는 신규 allowlist 캐너리가 exercise 하지 않는다 — `emitExecutionEvent` 경로로만 검증됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 함수 `emitExecutionEvent`(327번째 줄 `toFanoutEnvelope` 호출)와 `emitNodeEvent`(394번째 줄 `toFanoutEnvelope` 호출) — 두 공개 메서드가 같은 `private toFanoutEnvelope`(468번째 줄)를 공유한다.
  - 상세: 신규 캐너리 4건(`websocket.service.spec.ts` 762/803/848/882번째 줄, gate 기준)은 전부 `service.emitExecutionEvent(...)` 로만 호출한다. `toFanoutEnvelope` 가 private 이고 두 진입점이 동일 구현을 공유하므로 한쪽만 검증해도 로직 결함은 잡히지만, "두 진입점 중 하나만 배선됐다"는 이 저장소가 반복 겪은 결함 형태(§ `plan/in-progress/sse-nodeoutput-allowlist.md` M3 도입 사유와 같은 우려 축)를 진입점 레벨에서는 아직 실측하지 않은 셈이다. 실제 도메인상 `nodeOutput`/`buttonConfig` 를 싣는 이벤트는 `emitExecutionEvent` 뿐이라(코드 주석상 `emitNodeEvent` 는 "현재 llmCalls 를 포함하지 않으나 미래 누출 경로 차단용" 방어심층화 목적) 위험은 낮다.
  - 제안: 우선순위 낮음. `emitNodeEvent` 가 `nodeOutput` 을 실제로 실어 나르는 새 케이스가 생기면 그때 같은 패턴(top-level + `_retryState` 대조군)의 캐너리를 이 진입점에도 추가할 것.

- **[INFO]** `envelope.nodeOutput`/`envelope.buttonConfig` 가 명시적 `null` 인 방어 분기는 WS 통합 레벨에서 여전히 미검증 — 단, 이번 라운드에서 실측 근거를 대며 명시적으로 defer 됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 함수 `allowlistFanoutNodeOutput` 188번째 줄(`if (top !== null && typeof top === 'object')`)·194번째 줄(`if (bc !== null && typeof bc === 'object')`)
  - 상세: 직전 라운드 testing 리뷰(`22_51_46`, INFO)가 지적했던 항목과 동일하고, `RESOLUTION.md`(`review/code/2026/08/23/22_51_46/RESOLUTION.md` #10)에 "이미 있는 `제거할 필드가 없으면 … 동일 객체` 테스트가 무변경 경로를 지난다"는 근거로 defer 처리했다. `nodeOutput` 이 `undefined`(키 자체 생략)인 이벤트들은 다수 존재하고 `top !== null` 분기가 `undefined` 에서도 동일하게 스킵되므로 크래시 위험은 사실상 이미 간접 커버되지만, 리터럴 `null` 값(예: 향후 어떤 핸들러가 `nodeOutput: null` 을 명시적으로 낼 경우)을 넣는 케이스는 어떤 테스트도 직접 실행하지 않는다. 표준적인 null-guard 라 위험은 낮음.
  - 제안: 우선순위 낮음(이미 근거를 남기고 defer). 재개 신호는 실제로 `nodeOutput: null` 을 내는 핸들러/경로가 생기는 시점.

- **[INFO]** 신규 캐너리 4건이 기존 `describe('llmCalls strip — 외부 fanout 수신자 보호', …)` 블록 안에 위치해 블록명이 실제 검증 대상(allowlist)과 어긋난다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` 604번째 줄(`describe('llmCalls strip — 외부 fanout 수신자 보호'`)와 그 안의 762/803/848/882번째 줄(신규 `it`/`it.each`)
  - 상세: 공유 헬퍼(`nextFanoutEvent`, `beforeEach` 의 `service`/`gateway`)를 그대로 쓰기 위한 실용적 배치로 보이나, 블록명이 "llmCalls strip" 이라 `nodeOutput`/`buttonConfig` allowlist 캐너리를 찾을 때 탐색성이 떨어진다. 기능적 결함은 아니다.
  - 제안: 우선순위 낮음. 다음 정리 라운드에서 `describe('nodeOutput allowlist — fail-closed (EIA §R17 / SSE)', …)` 같은 하위 블록으로 옮기는 것을 검토(지금 강제할 정도는 아님).

## 강점 (직전 라운드 WARNING 해소 확인)

- **W1 해소 확인**: `interaction.service.spec.ts` 신규 캐너리(733~763번째 줄)가 REST `getStatus` 응답에서 chat-channel 4키(`payload`·`title`·`rendered`·`nodeType`)가 통과하면서도 같은 응답에서 `_retryState` 는 여전히 제거됨을 한 테스트로 함께 고정한다 — "확장이 의도" 임을 실제 mock(`nodeRepo.findOne` → `allowlistNodeOutputKeys` 소비 경로)으로 검증했다(`interaction.service.ts` 392번째 줄 호출부와 직접 대조 확인). vacuous 하지 않다 — `nodeRepo.findOne` mock 이 실제 `getStatus` 코드 경로(`nodeExec.node`·`meta.interactionType` 판별)를 정확히 태운다.
- **W2 해소 확인**: `buttonConfig.nodeOutput` 이 이미 깨끗한 fixture 로 `fanout.payload` 와 `fanout.payload.buttonConfig` **양쪽**의 참조 동일성을 단언하는 캐너리(848~872번째 줄)가 추가됐고, 대응 뮤테이션 M5(`plan/in-progress/sse-nodeoutput-allowlist.md`)가 "그 가드만 제거하면 이 캐너리만 RED" 를 실측으로 기록했다. 기존 M4 테스트(911번째 줄, `제거할 필드가 없으면 … 동일 객체`)는 top-level 분기만 덮었는데, 이번 추가로 두 분기 모두 copy-on-change 계약이 회귀 테스트로 고정됐다.
- 대조군(counter-example) 설계 일관성: 신규 캐너리마다 "제거됨" 단언과 "내부 WS 는 원문 보존" 단언을 쌍으로 둬 payload 를 통째로 날려 통과하는 거짓-GREEN 구현을 배제한다.
- 테스트 격리: `beforeEach` 가 매 테스트마다 `service`/`gateway`(fresh `jest.fn()`)를 재생성하고, 각 캐너리가 서로 다른 `executionId`(`exec-allowlist-form`/`exec-allowlist-buttons`/`exec-bc-identity`/`exec-chat-${key}`)를 쓴다 — seq allocator 상태·Subject 구독 경합 없이 독립 실행된다. REST 쪽도 `makeMocks()` 가 테스트마다 새 mock 인스턴스를 만들어 상태 누수가 없다.
- `node-output-allowlist.spec.ts` 의 "[리터럴] wire 전용 키가 목록에서 사라지면 여기서 잡힌다" 테스트가 `it.each([...NODE_OUTPUT_ALLOWED_KEYS])`(파생 fixture) 앞에 배치되어, 배열 자체에서 키가 빠질 때 파생 테스트가 케이스 수 감소로 조용히 통과하는 함정(이 저장소가 이미 실측으로 확인한 형태)을 리터럴 대조로 막는다 — 8키 추가분(`payload`·`title`·`rendered`·`nodeType`)도 리터럴 목록과 `Object.keys` 정렬 비교 양쪽에 반영됨을 확인했다.
- 뮤테이션 검증(M1~M5, `plan/in-progress/sse-nodeoutput-allowlist.md`)이 예측을 실행 전에 기록하고 실측과 대조하는 방식(2-column)을 지켜 재현성이 높다. M3(`buttonConfig` 블록만 제거 → buttonConfig 캐너리만 RED, top-level 은 GREEN)와 M5(`buttonConfig` copy-on-change 가드만 제거 → 신규 캐너리만 RED)가 "두 배선 지점을 한 덩어리로만 검증하지 않는다"는 원칙을 실제로 갈라 실증했다.
- 회귀 영향: `node-output-allowlist.ts`/`.spec.ts` 의 기존 unit 스위트(경계값·`null`/배열/원시값 passthrough·`__proto__` 오염 방어·`Object.freeze` 불변성 검증)는 이번 4키 추가로 깨지는 곳이 없다 — 새 키도 같은 배열 원소로 취급되므로 기존 로직·계약 변경이 없다.

## 요약

직전 라운드 testing WARNING(`buttonConfig` copy-on-change 미검증) 과 side_effect WARNING(REST 표면 확대 미검증) 이 각각 전용 캐너리 + 뮤테이션(M5)과 REST 캐너리로 정확히 닫혔다. 새 캐너리들은 대조군(제거 대상 vs 보존 대상 vs 내부 WS 불변)을 쌍으로 두고, `it.each` 파생 fixture 의 vacuous 위험을 리터럴 대조로 선방어하는 등 이 저장소의 축적된 테스트 관례를 일관되게 따른다. 테스트 격리(fresh mock/서비스 인스턴스, 고유 executionId)와 가독성(각 캐너리 JSDoc 이 "왜 필요한가"를 재발 방지 이력과 함께 서술)도 양호하다. 남은 갭은 전부 INFO 수준(`emitNodeEvent` 진입점 미검증, WS 레벨 명시적 `null` 미검증 — 둘 다 근거 있는 낮은 우선순위, describe 블록명 미스매치)이며 회귀·CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도
LOW

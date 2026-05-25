# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep`  
**검토 대상 (target)**: `spec/conventions/chat-channel-adapter.md`  
**검토 일시**: 2026-05-25

---

## 발견사항

### [INFO] `ChatChannelConfig.botIdentity.botId` 타입 — Convention vs 15-chat-channel.md 간 잠재 미스매치

- **target 위치**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` — `botIdentity?: { botId: number; username: string; teamId?: string }`
- **충돌 대상**: `spec/5-system/15-chat-channel.md §4.1 Trigger.config.chatChannel` 예시 JSONC — `"botIdentity": { "botId": 123456789, "username": "myworkflow_bot" }`
- **상세**: Convention 의 TypeScript 인터페이스는 `botId: number` (숫자 원시 타입), 15-chat-channel.md 의 JSONC 예시도 숫자 리터럴(`123456789`)을 사용해 형식상 일치한다. 그러나 Telegram Bot API 의 `getMe.id` 필드가 JavaScript 의 안전 정수 범위(`Number.MAX_SAFE_INTEGER = 2^53 - 1`)를 초과하는 큰 정수로 성장할 가능성이 있고, TypeScript `number` 는 IEEE 754 64-bit float 이므로 `bigint` 가 아니면 표현 한도가 있다. 현재는 직접 충돌이 아니나 providers/telegram.md 의 `getMe` 캐시 처리에 타입 명시가 없어 구현 시 혼선 발생 가능.
- **제안**: 경미한 주석 보강 — providers/telegram.md §3.1 `botId` 필드에 "JavaScript 안전 정수 범위 이내 (텔레그램 현 정책) — 향후 `string` 전환 대비" 노트를 추가하거나 Convention §2.3 `botId` 에 `string | number` union 을 검토할 것. 단, 현재 v1 spec 맥락에서는 즉각 차단 불필요.

---

### [INFO] `EiaEvent` union 의 `execution.ai_message.presentations` 필드 — EIA spec §6.5 와의 SoT 위임 정합성 확인 필요

- **target 위치**: `spec/conventions/chat-channel-adapter.md §1.2 EiaEvent` — `execution.ai_message` variant 에 `presentations?: PresentationPayload[]` 필드 추가 (2026-05-25 Changelog)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §6.5 페이로드` — EIA §6.5 가 SoT 이며, 본 컨벤션은 "내부 필드의 SoT 는 EIA §6 의 각 페이로드 형식" 이라고 선언(§1.2 마지막 문장)
- **상세**: Convention §1.2 는 `EiaEvent` 를 "별 신규 타입 정의 없이 EIA spec 의 payload shape 재사용 (drift 회피)" 라고 선언하며 EIA §6 에 위임한다. 그러나 동일 §1.2 내 `execution.ai_message` variant 에 `presentations?: PresentationPayload[]` 가 인라인으로 정의되어 있다. EIA §6.5 가 이 필드를 어떻게 정의하는지 직접 검증했을 때, 15-chat-channel.md CCH-MP-01 및 Convention §3 매핑 표 양쪽이 "EIA §6.5 line 536" 을 cross-ref 로 가리키나, EIA spec 내 실제 `presentations` 필드의 공식 정의가 §6.5 본문에 명시적으로 등장하는지 확인이 필요하다. 위임 선언과 인라인 정의가 혼재하면 EIA §6.5 갱신 시 Convention §1.2 가 silent drift 할 위험이 있다.
- **제안**: EIA §6.5 의 `execution.ai_message` payload 에 `presentations` 필드 공식 정의가 있다면 Convention §1.2 의 인라인 타입 선언을 제거하고 EIA 위임 주석만 유지. 없다면 EIA §6.5 를 먼저 갱신 후 Convention 을 위임 형태로 정리.

---

### [INFO] `ChatChannelInternalEvent` — `seq: number` 필드와 EIA 외부 이벤트의 `seq` 어휘 동일 사용

- **target 위치**: `spec/conventions/chat-channel-adapter.md §1.3 ChatChannelInternalEvent` — `seq: number` 포함
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md EIA-NX-08` — `seq` 는 execution 내 monotonic counter, WebSocket §2.2 와 동일 값
- **상세**: Convention §1.3 의 `execution.node.completed` (chat-channel-internal) 이벤트가 `seq: number` 를 포함한다. EIA-NX-08 및 WebSocket §2.2 의 `seq` 는 execution 전체의 monotonic counter 로 정의된다. chat-channel-internal 이벤트의 `seq` 가 동일 counter 에서 채번되는지, 아니면 별도 카운터인지가 불명확하다. 15-chat-channel.md CCH-AD-07 에서 "TX commit 후 호출 (EIA-RL-04 정합)" 을 언급하나 `seq` 의 발급 주체·채번 경로는 명시되지 않는다.
- **제안**: Convention §1.3 에 `seq` 필드 출처 주석 추가 — "EIA-NX-08 / WS §2.2 와 동일 execution 단위 monotonic counter (실행 엔진 §4.4 의 WebsocketService 가 부여)" 또는 별도 카운터라면 그 정책을 명시.

---

### [INFO] `classifyExecutionFailure` 의 `error.code` SoT 참조 — `spec/5-system/3-error-handling.md` 문서 존재 확인

- **target 위치**: `spec/conventions/chat-channel-adapter.md §3.1` — "카테고리 매핑 (error.code enum 의 SoT 는 `spec/5-system/3-error-handling.md §1.4 / §3.2`)"
- **충돌 대상**: `spec/5-system/3-error-handling.md` (문서 자체의 존재·내용)
- **상세**: Convention §3.1 매핑 표는 `HTTP_4XX`, `HTTP_5XX`, `HTTP_TIMEOUT`, `HTTP_TRANSPORT_FAILED`, `LLM_RATE_LIMIT`, `LLM_TIMEOUT`, `LLM_CALL_FAILED`, `LLM_RESPONSE_INVALID`, `MAX_COLLECTION_RETRIES_EXCEEDED`, `EMAIL_SEND_FAILED`, `EXECUTION_TIMEOUT`, `CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `SUB_WORKFLOW_FAILED`, `DB_*`, `RECURSION_DEPTH_EXCEEDED`, `MAX_ITERATIONS_EXCEEDED`, `CYCLE_DETECTED`, `INVALID_EXPRESSION`, `VARIABLE_NOT_FOUND`, `TYPE_MISMATCH`, `ERROR_PORT_FALLBACK` 를 열거하며 이를 `spec/5-system/3-error-handling.md §1.4 / §3.2` 에 위임한다. 해당 spec 파일의 존재 및 이 코드 목록과의 완전 일치는 별도 검증이 필요하다. 특히 `DB_*` 와 같은 와일드카드 표현이 error-handling spec 에서도 동일하게 쓰이는지 또는 개별 코드 (`DB_CONNECTION_FAILED`, `DB_QUERY_FAILED` 등) 로 분리되어 있는지 확인이 필요하다. 불일치가 있으면 분류 helper 가 unknown fallback 에 떨어져 CCH-ERR-04 warn 로그를 남기게 된다.
- **제안**: 구현 착수 전 `spec/5-system/3-error-handling.md §1.4 / §3.2` 를 열어 Convention §3.1 의 매핑 표와 코드 집합이 완전히 일치하는지 cross-check 수행. `DB_*` 를 명시적 코드 목록으로 전개하거나 SoT 문서의 패턴을 일치시킬 것.

---

### [WARNING] `ChannelMessage.body` — `form_prompt` 의 `hint: KeyboardHint` vs `ChatChannelConfig.uiMapping.visualNode` 의 동명 'text' 의미 혼동 위험

- **target 위치**: `spec/conventions/chat-channel-adapter.md §2.2 ChannelMessage / §2.3 ChatChannelConfig.uiMapping.visualNode` — 주석 "(시각 렌더 모드 — 동 파일 §2.2 KeyboardHint 의 'text' (입력 hint) 와 의미 다름)"
- **충돌 대상**: `spec/5-system/15-chat-channel.md §4.1 Trigger.config.chatChannel.uiMapping.visualNode` — `"text" | "photo" | "auto"` 설명
- **상세**: Convention §2.3 에서 `visualNode: "text"` (시각 렌더 모드 = 텍스트 fallback) 와 `KeyboardHint` 의 `"text"` (입력 힌트 = 텍스트 키보드) 가 **동일한 문자열 리터럴 `"text"`** 를 다른 맥락에서 사용한다. 주석으로 "의미 다름" 을 경고하고 있으나, 두 타입이 같은 파일·코드 영역에 공존하면 개발자가 잘못된 타입에 `"text"` 를 assign 하거나 TypeScript 가 silently 통과시키는 위험이 있다. 15-chat-channel.md §4.1 의 JSONC 예시도 동일하게 두 enum 이 혼재 가능하다.
- **제안**: `uiMapping.visualNode` 의 TypeScript 타입을 `"text" | "photo" | "auto"` 대신 `"text_fallback" | "photo" | "auto"` 로 rename 하거나, 최소한 CCH-MP-04 / telegram §5.4 SoT 문서에 "visualNode='text' 는 KeyboardHint='text' 와 다른 의미" 경고를 모든 참조 위치에 일관되게 표기. 별도 type alias `VisualNodeMode` 를 선언해 `KeyboardHint` 와 구조적으로 분리하는 것이 가장 안전.

---

### [INFO] `languageHints` 5개 키 (비-실행실패 안내) 의 EN default 미정의

- **target 위치**: `spec/conventions/chat-channel-adapter.md §3.1` 및 15-chat-channel.md §4.1.1 — "기존 5 키 (`groupChatRefusal` 등) 의 EN default 화는 본 spec 범위 밖 — 별 plan 추적"
- **충돌 대상**: `spec/5-system/15-chat-channel.md §4.1.1 languageHints default 문구 표` — CCH-ERR-* 6 키만 KO/EN 쌍 정의
- **상세**: Convention 의 `ChatChannelConfig.languageLocale` 가 `"en"` 으로 설정되어 있을 때, `languageHints.executionStillRunning` / `groupChatRefusal` / `executionStarted` / `executionCompleted` / `help` 5개 키의 EN default 가 어떤 문구인지 spec 에 정의되어 있지 않다. 구현자가 임의로 EN 문구를 삽입하거나 'ko' fallback 만 사용하게 될 수 있어 locale 설정의 의미가 절반만 적용된다.
- **제안**: 구현 착수 전 15-chat-channel.md §4.1.1 에 5개 키의 EN default 문구를 추가하거나 "EN 미정의 키는 항상 'ko' 문구 사용" 을 spec 으로 명시.

---

### [INFO] `ChatChannelInternalEvent` 의 `node.type` 4종 한정 — `spec/1-data-model.md §2.6 Node.type` presentation 범주와의 정합

- **target 위치**: `spec/conventions/chat-channel-adapter.md §1.3` — `node.type ∈ { "carousel" | "table" | "chart" | "template" }` (form 제외)
- **충돌 대상**: `spec/1-data-model.md §2.6 Node.type` 표 — presentation 범주: `carousel`, `table`, `chart`, `form`, `template` 5종
- **상세**: Convention §1.3 은 chat-channel-internal 이벤트 대상을 4종(`carousel`/`table`/`chart`/`template`)으로 명시하고 `form` 을 제외한다. 데이터 모델의 presentation 5종과 비교해 `form` 제외 이유가 "form 은 항상 blocking" 이라는 설명으로 §R-CCA-7 (e) 에 Rationale 이 있다. 직접 충돌은 아니지만 "form 이 반드시 blocking 이다" 는 전제가 미래에 비-blocking form 이 도입될 경우 여기 4종 제한이 충돌 지점이 된다.
- **제안**: Convention §1.3 주석에 "form 은 설계상 항상 blocking — 비-blocking form 도입 시 본 필터 재검토 필요 (별 plan `chat-channel-form-native-modal`)" 를 명시해 미래 변경 트리거를 안전망으로 두는 것을 권장.

---

### [INFO] Adapter Registry `provider` 문자열 표준 — `_overview.md` 단일 진실과의 동기화

- **target 위치**: `spec/conventions/chat-channel-adapter.md §5 Adapter Registry` — "신규 어댑터 추가 시 `spec/4-nodes/7-trigger/providers/_overview.md` 인덱스에 새 provider 행 추가"
- **충돌 대상**: `spec/5-system/15-chat-channel.md CCH-AD-01` — "supported provider 는 `providers/_overview.md §1` 단일 진실 (v1 supported: `telegram` / `slack` / `discord`)"
- **상세**: 양쪽 모두 `_overview.md §1` 을 단일 진실로 가리키나, Convention §5 의 절차(4단계)가 15-chat-channel.md CCH-AD-01 의 provider 목록 갱신 의무를 명시하지 않는다. 신규 provider 추가 체크리스트에서 CCH-AD-01 의 "v1 supported" 표현이 갱신되지 않아 stale 해질 위험이 있다.
- **제안**: Convention §5 의 신규 어댑터 추가 4단계 절차에 "5. CCH-AD-01 의 `v1 supported: ...` 표현 갱신" 항목을 추가.

---

## 요약

`spec/conventions/chat-channel-adapter.md` 는 2026-05-25 기준 대규모 갱신(R-CCA-5 ~ R-CCA-7, ChatChannelInternalEvent 신설, ai_conversation/ai_form_render silent 정책, execution.failed 분류 helper)을 반영한 상태로, 주요 cross-spec 링크(`spec/5-system/15-chat-channel.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/interaction-type-registry.md`, `spec/conventions/secret-store.md`, `spec/1-data-model.md §2.8 Trigger`)와의 **직접 모순(CRITICAL)은 발견되지 않았다**. `ai_form_render` 4종 enum 확장, `ChatChannelInternalEvent` 신설, `renderNode` union 확장 모두 15-chat-channel.md (CCH-AD-07, CCH-MP-06) 및 interaction-type-registry.md 와 양방향 cross-link 가 정합된다. 발견된 항목은 모두 INFO 또는 WARNING 등급으로, 구현 시 혼선을 유발할 수 있는 명명 중복(`visualNode`/"text" vs `KeyboardHint`/"text"), EIA 위임 원칙과 인라인 정의 혼재, `DB_*` 와일드카드 매핑, 비-실행실패 5개 `languageHints` 키의 EN default 미정의가 주된 리스크다. 구현 착수 전 WARNING 항목(동명 'text' 리터럴 혼용)의 명명 정리를 권장하며, 나머지 INFO 항목은 구현 PR 에서 주석·doc 보강으로 해소 가능하다.

---

## 위험도

LOW

STATUS: OK

# 요구사항(Requirement) 리뷰

## 발견사항

### **[WARNING]** [SPEC-DRIFT] `execution.message` 이벤트가 EIA spec §5.2 SSE 이벤트 목록에 미등록
- 위치: `spec/5-system/14-external-interaction-api.md` §5.2 SSE 이벤트 목록(L383~387)
- 상세: `spec/5-system/14-external-interaction-api.md §5.2`의 SSE 이벤트 종류 열거에 `execution.message`가 없다. 현재 §5.2 이벤트 목록은 `execution.ai_message` / `execution.user_message` / `execution.tool_call_started` / `execution.tool_call_completed` / `execution.resumed` 를 나열하지만, 이번 신설된 `execution.message`(presentation 4종 비차단 완료 시 발행)는 포함되지 않는다. EIA-NX-02(outbound notification 화이트리스트)에도 `execution.message`가 없는데, 이는 outbound webhook 화이트리스트를 건드리지 않는다는 계획된 설계 결정(plan §결정/주의)이므로 EIA-NX-02 측 추가가 아니라 SSE 전용 이벤트로 §5.2 이벤트 목록에만 추가돼야 한다.
- 판단: 코드는 의도적으로 SSE 전용 additive 이벤트를 구현했고 spec §5.2 본문이 아직 이를 반영하지 않은 상태다. 구현이 옳고 spec 갱신이 누락된 경우 — plan `Phase 4 W1(a)(b)` 에서 갱신 예정이나 해당 커밋에 포함되지 않았다.
- 제안: 코드 유지 + spec 갱신. `spec/5-system/14-external-interaction-api.md §5.2` SSE 이벤트 목록에 `execution.message` 행 추가(발행 시점: presentation 4종 비차단 완료, payload: `{nodeId, nodeType, presentations:[{config,output}]}`, 외부 노출: SSE 표면만, 5분 replay 적용). 아울러 §8 매핑 테이블에도 동반 추가 필요(plan `W1(b)`).

---

### **[WARNING]** [SPEC-DRIFT] `wc:command` payload `action:"resetSession"`이 SDK spec §3 테이블에 미등록
- 위치: `spec/7-channel-web-chat/2-sdk.md` §3 host↔iframe postMessage 프로토콜 테이블(L86)
- 상세: `spec/7-channel-web-chat/2-sdk.md §3` 의 `wc:command` 행은 지원 action을 `open`/`close`/`show`/`hide`/`sendMessage(text)`/`updateProfile`/`shutdown` 으로 명시한다. 이번 커밋에서 구현된 `resetSession` action은 이 목록에 없다. 위젯 `use-widget.ts`에서 `case "resetSession": apiRef.current.newChat()` 로 처리하고 `live-preview.tsx`의 `postCommand("resetSession")`으로 발행한다. 구현 자체는 완전하며 plan Phase 2.3에 명시된 설계 결정이다.
- 판단: 코드가 의도적으로 추가된 action이며 되돌리면 기능이 사라지므로 코드가 옳고 spec이 낡은 경우(SPEC-DRIFT). plan `Phase 4 W2`에서 갱신 예정이나 해당 커밋에 포함되지 않았다.
- 제안: 코드 유지 + spec 갱신. `spec/7-channel-web-chat/2-sdk.md §3` `wc:command` 행의 페이로드 목록에 `resetSession` 추가(설명: 세션 초기화 — closeStream→clearSession→start, 운영 콘솔 미리보기 및 host 사용 가능).

---

### **[WARNING]** [SPEC-DRIFT] 2-column 배치 및 "새 세션" 버튼이 admin-console spec §6에 미반영
- 위치: `spec/7-channel-web-chat/5-admin-console.md` §6(라이브 미리보기)
- 상세: `spec/7-channel-web-chat/5-admin-console.md §6` 라이브 미리보기 본문에 (a) 세션 초기화 버튼 기능 설명이 없고, (b) xl+ 2-column 배치 / xl 미만 세로 stack 조건 명세가 없으며, (c) sticky 우측 컬럼 동작 설명이 없다. §1 화면 구조 다이어그램은 2-column 배치를 이미 암시하지만 §6 본문 명세에는 구체적 조건이 없다. 코드 `page.tsx`는 `xl:grid-cols-[minmax(0,1fr)_minmax(360px,400px)] xl:items-start`와 `xl:sticky xl:top-6`로 구현되어 있고 `live-preview.tsx`에 "새 세션" 버튼이 추가되었다.
- 판단: 코드가 의도적인 UX 개선을 구현했고, spec §1 다이어그램이 이 의도를 암시하고 있으나 §6 본문에 구체적 동작이 누락 → SPEC-DRIFT.
- 제안: 코드 유지 + spec 갱신. `spec/7-channel-web-chat/5-admin-console.md §6`에 (a) "새 세션" 버튼(위젯 `ready` 상태에서만 활성, `wc:command {action:"resetSession"}` 발행), (b) xl+ 2-column 배치 조건(외형+스니펫 좌 / 미리보기 우 sticky), (c) xl 미만 단일 컬럼 세로 stack 조건 추가. plan `Phase 4 I2/I4`.

---

### **[INFO]** blocking presentation 노드(버튼 있는 carousel 등)에 대한 `execution.message` 미발행 테스트 누락
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 신규 `execution.message` describe 블록
- 상세: 현재 테스트는 (1) 비차단 presentation 노드 완료 시 `execution.message` 발행, (2) 비-presentation 노드 완료 시 미발행 두 케이스를 커버한다. 그러나 **blocking 케이스** — presentation 노드라도 `output.status === 'waiting_for_input'`(버튼이 있는 carousel/table 등)인 경우 `execution.message`를 발행하지 않아야 한다는 케이스가 없다. 코드상 blocking 분기에서는 `emitExecution(EXECUTION_MESSAGE)` 호출이 없으므로 구현은 올바르나, plan Phase 5.1에서 "blocking(버튼) 케이스 미발행" 테스트를 명시했지만 실제 코드에는 반영되지 않았다.
- 제안: blocking carousel(status: 'waiting_for_input') 케이스에서 `execution.message` 미발행을 검증하는 테스트 케이스 추가 권장.

---

### **[INFO]** `parseMessage` 반환 타입이 익명 객체 — 명명 타입 부재
- 위치: `codebase/channel-web-chat/src/lib/eia-events.ts` L753~758(새로 추가된 `parseMessage` 함수)
- 상세: `parseMessage(ev: ExecutionMessageEvent): { presentations?: Array<Record<string, unknown>> }` 의 반환 타입이 인라인 익명 객체다. `parseAiMessage`의 반환 타입은 `ParsedAiMessage` 인터페이스로 명명되어 있는 반면, `parseMessage`만 익명 타입을 사용한다. 기능상 문제는 없지만 타입 이름이 없어 호출자가 타입을 참조하거나 확장하기 어렵다.
- 제안: `ParsedMessage` 인터페이스를 정의해 반환 타입에 사용하거나, 기존 `ParsedAiMessage`의 부분 타입으로 표현하는 것을 고려. 현 기능에는 영향 없음.

---

### **[INFO]** `ExecutionMessageEvent.seq` 필드가 실제 wire payload에 미포함
- 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` L907~912 `ExecutionMessageEvent` 인터페이스
- 상세: `ExecutionMessageEvent`에 `seq?: number` 필드가 선언되어 있으나, 백엔드 `execution-engine.service.ts`에서 `emitExecution`에 전달하는 payload `{ nodeId, nodeType, presentations: [...] }`에는 `seq`가 포함되지 않는다. `seq`는 SSE 어댑터가 이벤트 프레임 레벨의 `id:` 필드로 할당하는 방식이라 payload body에 없어도 SSE 규약상 문제는 없고, `AiMessageEvent`도 `seq?: number`를 가지므로 일관성은 있다. optional 필드라 런타임 오류도 없다.
- 제안: 현 구현 유지 가능. seq가 payload body에 불필요하다면 타입 선언에서 제거하거나, SSE id 값이 payload에도 동봉됨을 명확히 하는 주석 추가.

---

## 요약

본 커밋은 세 가지 기능(presentation 노드 `execution.message` 이벤트 신설, 미리보기 세션 초기화 `resetSession`, 2-column 배치)을 구현하며, 각 기능의 구현 완전성은 높다. 공용 상수 `PRESENTATION_NODE_TYPES` 추출로 의존 방향 위반을 방지하고, `parseMessage` / `ExecutionMessageEvent` 타입 추가로 프론트엔드 타입 계약을 정교화했으며, 발행/미발행 두 축의 단위 테스트가 추가되었다. 발견된 WARNING 3건은 모두 **SPEC-DRIFT** — 코드 구현 자체는 올바르고 의도적이며 spec 본문이 아직 갱신되지 않은 상태다(`spec/5-system/14-external-interaction-api.md §5.2`, `spec/7-channel-web-chat/2-sdk.md §3`, `spec/7-channel-web-chat/5-admin-console.md §6`). plan Phase 4에서 갱신 예정이나 이번 커밋에는 포함되지 않았다. INFO 3건(blocking 케이스 테스트 누락, 반환 타입 명명, seq 필드)은 기능에 영향 없는 품질 개선 사항이다. 코드 버그 또는 요구사항 누락으로 판단되는 CRITICAL/WARNING은 없다.

## 위험도

LOW

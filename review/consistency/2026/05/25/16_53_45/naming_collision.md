# 신규 식별자 충돌 검토 — chat-channel-template-render-outbound

검토 대상: `plan/in-progress/chat-channel-template-render-outbound.md`  
검토 일시: 2026-05-25

---

## 발견사항

### 1. [CRITICAL] `CCH-AD-06` 요구사항 ID 충돌

- **target 신규 식별자**: target §B "§3.1 `CCH-AD-06` 신설" — chat-channel 어댑터가 `execution.node.completed` (in-process WS Subject) 를 presentation 노드 한정 sub-filter 로 추가 구독하는 요구사항.
- **기존 사용처**: `spec/5-system/15-chat-channel.md` §3.1 라인 60.

  ```
  | CCH-AD-06 | 인터랙션 응답 (텔레그램 reply / inline_keyboard tap / 다단계 form answer) 도착 →
  어댑터가 InteractionService.interact(ctx, dto) 를 in-process 직접 호출 ...
  ```

- **상세**: 기존 `CCH-AD-06` 은 "인터랙션 응답 → `InteractionService.interact()` in-process 직접 호출" 을 정의하는 완전히 다른 요구사항이다. target 의 신규 `CCH-AD-06` 은 "presentation 노드 `execution.node.completed` 구독" 을 정의하므로 동일 ID 가 서로 다른 두 의미를 갖게 된다. 스펙 본문 상호 참조 · 구현 추적 · 일관성 검토 모두 혼선이 직결된다.
- **제안**: target 의 신규 요구사항에 `CCH-AD-07` (또는 `CCH-AD-05` 보강 형태로 기존 §3.1 에 sub-항목 추가) 을 부여할 것. 기존 `CCH-AD-06` 은 변경하지 않는다.

---

### 2. [CRITICAL] `EiaNodeCompletedEvent` 를 `EiaEvent` union 에 추가 — 타입명 의미 충돌

- **target 신규 식별자**: `spec/conventions/chat-channel-adapter.md §1.2` 에 새 union variant 신설:

  ```typescript
  | { type: "execution.node.completed"; executionId: string; triggerId: string; workflowId: string;
      node: { id: string; type: string; label?: string };
      output: Record<string, unknown>;
      meta?: Record<string, unknown>;
      timestamp: string; seq: number };
  ```

- **기존 사용처**: `spec/conventions/chat-channel-adapter.md §1.2` 라인 82–95, 라인 383 (Rationale R3).

  현재 `EiaEvent` 는 "EIA §6 outbound notification payload 의 **5종 union**" 으로 명시된다. Rationale R3 는 "EIA spec §6 의 payload 가 SoT — 본 컨벤션은 union 만 정의. 두 spec 간 type drift 회피" 를 명시한다.

  그러나 `execution.node.completed` 는 EIA §5 (SSE debugging event, `spec/5-system/14-external-interaction-api.md` 라인 347 및 752) 에 명시적으로 "디버깅 이벤트" 로 분류된다. EIA §6.1 outbound notification 화이트리스트 5종에 포함되지 않는다.

- **상세**: `EiaEvent` 라는 타입명이 "EIA spec §6 payload 5종" 을 의미하도록 Rationale R3 에서 설계되었으나, target 이 chat-channel-internal 한정 이벤트를 동일 union 에 추가하면 타입명의 의미가 "EIA 6종 + 내부 이벤트 N종" 으로 암묵적으로 확장된다. 이는 R3 의 "drift 회피" 설계 원칙과 직접 충돌하며, 향후 EIA spec §6 변경 시 어느 variant 가 EIA SoT 를 따르고 어느 variant 가 내부 정의인지 구분이 불분명해진다.
- **제안**: 내부 이벤트용 별도 union 타입 `ChatChannelInternalEvent` (또는 `NodeCompletedEvent`) 을 신설하고, `renderNode` 시그니처를 `EiaEvent | ChatChannelInternalEvent` 또는 오버로드로 확장하거나, `renderNodeFromNodeCompleted(event: EiaNodeCompletedEvent, ...)` 함수를 별도로 정의할 것. `EiaEvent` 자체는 기존 5종 union 그대로 유지.

---

### 3. [WARNING] `CCH-MP-01` 정의 범위 갱신 — 기존 정의와 불일치 가능성

- **target 신규 식별자**: target §B "§3.3 `CCH-MP-01` 보강 (presentations[] 처리 추가)":

  ```
  CCH-MP-01 (갱신) | ... payload 의 presentations?: PresentationPayload[] 필드 ...
  가 비어있지 않으면 4종 display-only presentation ... ChannelMessage 시퀀스로 text 뒤에 추가 발송.
  ```

- **기존 사용처**: `spec/5-system/15-chat-channel.md` §3.3 라인 76.

  ```
  | CCH-MP-01 | AI Multi Turn 의 execution.ai_message → 채널 텍스트 메시지 1건 이상으로 변환 (provider 별 길이 제한 분할) | 필수 |
  ```

  또한 `spec/5-system/15-chat-channel.md` Rationale §R-CC-13 (라인 628–638) 이 "CCH-MP-01 outbound 의무 완전 충족" 을 Discord v1 유예 근거로 인용하고 있으며, `spec/conventions/chat-channel-adapter.md §3` 매핑 표 (`execution.ai_message` 행) 도 현재 `text 1건` 으로 정의되어 있다.

- **상세**: `CCH-MP-01` 을 갱신하는 것 자체는 충돌이 아니나, R-CC-13 의 "CCH-MP-01 outbound 의무 완전 충족" 인용 문맥이 "텍스트만" 전송으로 이해되어 있다. presentations[] 처리를 추가한 후 R-CC-13 을 갱신하지 않으면 Discord v1 유예 범위가 의도치 않게 확장되거나 불명확해진다 (Discord v1 이 presentations[] 처리도 의무를 충족해야 하는가?). 또한 `spec/conventions/chat-channel-adapter.md §3` 매핑 표의 `execution.ai_message` 행과 현재 `§1.2 EiaEvent` 의 `ai_message` 타입 정의 모두 `presentations?` 를 포함하지 않으므로, spec 갱신 이후 두 파일 간 drift 가 발생한다.
- **제안**: target 이 제안하는 두 파일 갱신 (`chat-channel-adapter.md §1.2` + §3, `15-chat-channel.md §3.3`) 을 동시에 수행하고, R-CC-13 에 "presentations[] 처리 의무는 CCH-MP-01 보강분 — Discord v1 유예 범위 재논의 여부 명시" 주석을 추가할 것.

---

### 4. [WARNING] `§1.2` 의 `EiaAiMessageEvent` 이름 — 타입 선언 없이 주석에만 등장

- **target 신규 식별자**: target §A 섹션 제목 "§1.2 EiaEvent union — `EiaAiMessageEvent` 에 `presentations?` 필드 추가".
- **기존 사용처**: `spec/conventions/chat-channel-adapter.md §1.2` 라인 82–95. 현재 `EiaEvent` 는 named union type 으로 정의되어 있으나 각 variant 에 개별 이름(`EiaAiMessageEvent`, `EiaNodeCompletedEvent`)이 부여된 적 없다. 코드베이스 검색 범위에서도 `EiaAiMessageEvent` 타입명은 등장하지 않는다.

- **상세**: target 이 `EiaAiMessageEvent` 를 Named type 처럼 언급하지만 실제 spec 에는 anonymous union variant 만 존재한다. 구현 단계에서 개발자가 `type EiaAiMessageEvent = Extract<EiaEvent, { type: "execution.ai_message" }>` 를 별도 정의할 여지가 있으나, spec 단에서 이름을 부여하지 않으면 "갱신 대상" 식별이 모호해진다.
- **제안**: target spec 본문에서 `EiaAiMessageEvent` 를 사용한다면 `spec/conventions/chat-channel-adapter.md §1.2` 에 `type EiaAiMessageEvent = Extract<EiaEvent, { type: "execution.ai_message" }>` 별칭을 명시하거나, variant 보강을 "기존 `execution.ai_message` variant 에 `presentations?` 추가" 로 표현하여 named type 처럼 오해받지 않도록 명확화할 것.

---

### 5. [INFO] `CCH-MP-06` — 신규 ID, 기존 번호 체계 내 충돌 없음

- **target 신규 식별자**: `CCH-MP-06` (비-blocking presentation 노드 `execution.node.completed` → 채널 메시지 변환).
- **기존 사용처**: `spec/5-system/15-chat-channel.md` 상 `CCH-MP-05` 까지 정의됨. `CCH-MP-06` 미사용.
- **상세**: 충돌 없음. 다만 `CCH-AD-06` 충돌 해결(발견사항 1)로 신규 listener 요구사항이 `CCH-AD-07` 로 이동할 경우, `CCH-MP-06` 의 참조 ID 가 바뀐 어댑터 요구사항을 올바르게 가리키는지 확인 필요.
- **제안**: 발견사항 1 해결 후 `CCH-MP-06` 본문이 `CCH-AD-07` (또는 최종 확정 ID) 를 참조하도록 일치시킬 것.

---

### 6. [INFO] `execution.node.completed` 이벤트명 — EIA spec 내 기존 정의와 의미 범위 확인 필요

- **target 신규 식별자**: `execution.node.completed` (chat-channel-internal in-process listener용).
- **기존 사용처**: `spec/5-system/14-external-interaction-api.md` 라인 347 및 752 — EIA §5 SSE 디버깅 이벤트 목록에 이미 `execution.node.completed` 가 정의되어 있다. 라인 752 의 WebSocket ↔ SSE 이벤트 대응 표에도 `execution.node.completed` 가 포함되어 있다.
- **상세**: 이벤트명 자체의 충돌은 없으나 (target 이 EIA §5 의 기존 이벤트를 chat-channel 내부 구독 대상으로 재사용하는 것은 설계 의도와 정합), EIA §6.1 화이트리스트 5종과의 구분을 spec 본문에서 더 명확히 표기해야 한다. 현재 target 의 매핑 표 주석("chat-channel-internal — EIA §6.1 outbound 화이트리스트 5종에는 없음")은 적절하다. 단, `EiaEvent` union 에 포함시키는 경우(발견사항 2) 이 구분이 흐려진다.
- **제안**: 이벤트명 재사용은 허용하되, 별도 union 타입(발견사항 2 제안 참조)에 격리하고 해당 타입의 주석에 "EIA §5 디버깅 이벤트를 in-process에서 직접 구독 — 외부 HTTP/SSE 미노출" 을 명기할 것.

---

## 요약

target 이 도입하는 신규 식별자 중 가장 심각한 충돌은 두 건이다. 첫째, `CCH-AD-06` 이 기존 `spec/5-system/15-chat-channel.md §3.1` 의 "InteractionService in-process 직접 호출" 요구사항 ID 와 완전히 동일하면서 전혀 다른 의미를 부여받는다. 사용자·개발자·다른 spec 참조가 동일 ID 로 서로 다른 의무를 읽게 되므로 즉시 수정이 필요하다. 둘째, `EiaNodeCompletedEvent` variant 를 `EiaEvent` union 에 추가하는 방식이 "EIA §6 payload 5종만 담는다" 는 기존 Rationale R3 와 충돌하며, 타입명의 의미 경계가 허물어진다. 나머지 발견사항(CCH-MP-01 보강 후 R-CC-13 미갱신 위험, EiaAiMessageEvent 이름 모호성, CCH-MP-06 참조 ID 의존성)은 권고 수준이다.

---

## 위험도

**HIGH**

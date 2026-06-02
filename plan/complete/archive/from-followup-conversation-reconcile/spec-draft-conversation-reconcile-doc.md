---
worktree: followup-conversation-reconcile
started: 2026-06-03
owner: planner
---

# Spec draft — conversation reconcile 명문화 (PR #428 후속)

머지된 동작/현행 계약의 **문서화**이며 신규 계약 추가가 아니다.
(consistency-check 07_55_53 의 BLOCK/WARNING/채택 INFO 반영 개정본)

## 변경 1 — `spec/conventions/conversation-thread.md` §9.7 `user_message` 행

### Before
```
| `user_message` | APPEND optimistic `ai_user` `ConversationItem` (text=`payload.message`), dedup by `receivedAt` (재emit / 재구독 중복 차단) | 사용자 발화(q) 조기 노출 ([WebSocket §4.4 `execution.user_message`](../5-system/6-websocket-protocol.md#44-실행-진행-이벤트)) |
```

### After
```
| `user_message` | APPEND optimistic `ai_user` `ConversationItem` (text=`payload.message`), dedup by `receivedAt` (재emit / 재구독 중복 차단). **단, 클라이언트가 직접 발화해 송신 즉시 optimistic `ai_user` bubble 을 표시한 경우처럼 동일 발화의 bubble 이 이미 존재하면, echo 는 새 항목을 append 하지 않고 그 bubble 에 권위 `receivedAt` 을 stamp 하며 reconcile 한다 (이 stamp 는 turn 종료 `ai_message` REPLACE 의 보조 선행 단계). bubble 이 없을 때(채널 텍스트 인바운드 등)만 append** | 사용자 발화(q) 조기 노출 ([WebSocket §4.4 `execution.user_message`](../5-system/6-websocket-protocol.md#44-실행-진행-이벤트)) |
```

(WARNING-1: `submit_message` 식별자 제거 → 동작 서술. Naming: "optimistic `ai_user` bubble" / "채널 텍스트 인바운드" 기존 표기 통일. INFO Cross-Spec 1: stamp 가 REPLACE 보조 선행 단계임 명시.)

## 변경 2 — `spec/5-system/6-websocket-protocol.md` §4.4 Reconciliation 노트(현 620행) 갱신

### Before
```
> **Reconciliation**: `tool_call_started` / `tool_call_completed` / `user_message` 가 손실되어도 turn 종료 시 도착하는 `execution.ai_message` 의 `messages` 스냅샷과 `meta.turnDebug[].toolCalls` 가 권위적이다. 클라이언트는 tool 항목은 `toolCallId`, optimistic user bubble 은 `receivedAt` 을 키로 dedup 한다. 즉 `user_message` 는 q 의 조기 노출(라이브 UX)만 담당하고, 영속/이력 정합은 `ai_message` 스냅샷이 보장한다.
```

### After
```
> **Reconciliation**: `tool_call_started` / `tool_call_completed` / `user_message` 가 손실되어도 turn 종료 시 도착하는 `execution.ai_message` 의 `messages` 스냅샷과 `meta.turnDebug[].toolCalls` 가 권위적이다. 클라이언트는 tool 항목은 `toolCallId`, optimistic user bubble 은 `receivedAt` 을 키로 dedup 한다. 단, 클라이언트가 직접 발화해 송신 즉시 표시한 동일 발화 bubble 이 이미 있으면 `user_message` 는 새 bubble 을 append 하지 않고 기존 bubble 에 `receivedAt` 을 stamp 해 reconcile 한다 (`receivedAt` 은 이후 재emit 의 dedup 키로 계속 동작). 즉 `user_message` 는 q 의 조기 노출(라이브 UX)만 담당하고, 영속/이력 정합은 `ai_message` 스냅샷이 보장한다.
```

(WARNING-2: §4.4 Reconciliation 노트를 새 분기(stamp vs append) 반영으로 갱신.)

## 변경 3 — `spec/5-system/6-websocket-protocol.md` §4.4 `llmCalls[]` 표 직후 노트 추가

§4.4 `execution.ai_message` payload 표의 `presentations` 행 바로 다음, json 예시 블록 직전:

```
> **`llmCalls[].requestPayload` / `responsePayload` 는 raw 디버그 payload** 다 —
> LLM provider 와의 원본 요청/응답(시스템 프롬프트·대화 이력·tool 정의·사용자
> 입력 등 민감 데이터 포함 가능)을 마스킹 없이 운반하며, 에디터의 디버깅
> 타임라인(Response/Request/LLM Usage 탭) 같은 **개발자·에디터 surface** 전용이다.
> v1 은 별도 redaction 을 적용하지 않으며, 에디터 surface 는 기존 워크플로 RBAC 로
> 간접 제한된다. 다중 테넌트·비편집자 노출 범위에 대한 **명시적 접근제어·마스킹
> 정책은 open item** (제품 결정 필요) — 본 노트는 현행 동작을 명문화할 뿐 정책을
> 규정하지 않는다. 설계 근거는 §8 Rationale 참조.
```

(INFO Cross-Spec 3: editor-only RBAC 간접 제한 범위 한정.)

## 변경 4 — `spec/5-system/6-websocket-protocol.md` §8 Rationale 항목 1개 추가

```
- **`ai_message.llmCalls[]` raw payload 운반 (v1, redaction 없음)**: 디버깅
  타임라인이 어시스턴트 메시지 단위로 Request/Response/Usage 를 보여주려면 원본
  payload 가 필요하다. v1 은 에디터 surface 전용(기존 RBAC 간접 제한)이라 별도
  redaction 을 적용하지 않는다. 다중 테넌트·비편집자 노출에 대한 마스킹/접근제어는
  open item — 상세는 §4.4 `llmCalls[]` 노트 참조.
```

(INFO Rationale 4: 변경 3 동반 근거 기록.)

## Rationale
- 모든 변경은 이미 머지/출하된 동작(PR #428)과 현행 wire 계약의 **서술적 문서화**다.
  새 필드·새 상태·새 이벤트·동작 변경 없음.
- **dedup 확장 이유(WARNING-2)**: 클라이언트가 직접 발화하면 송신 즉시 표시되는
  로컬 bubble 의 타임스탬프는 *클라이언트* 시각이고, `user_message` echo 의 dedup
  키는 *서버* `receivedAt` 이라 둘이 불일치한다. 따라서 기존의 `receivedAt` 단일
  dedup 으로는 이 로컬 bubble 케이스를 잡지 못해 중복 표시(PR #428 회귀)가 발생했고,
  stamp-reconcile 분기로 해소한다. `receivedAt` 은 그대로 재emit/재구독 dedup 키로
  유지된다.
- §9.7.1 의 "frontend 구현 식별자(상수명 등)는 본문 비노출" 방침(spec-코드 drift
  회피)을 준수해 식별자(`optimisticPending` 등)는 본문에 쓰지 않고 동작만 기술한다.
- 변경 3/4 의 I-3 는 정책(접근제어/redaction)을 **결정하지 않고** open item 으로만
  표기 — 제품 결정 영역 침범 회피.

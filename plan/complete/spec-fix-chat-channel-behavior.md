---
worktree: chat-channel-spec-fix-5fc137
started: 2026-05-22
completed: 2026-05-22
owner: project-planner
---

> 구현 결과: spec/5-system/15-chat-channel.md (CCH-CV-03 행에 (a) waiting_for_input / (b) running·pending / (c) terminal 3분기 명시 + Rationale R9 — 큐 미적재 정당화), spec/conventions/chat-channel-adapter.md (§1.1 parseUpdate null 단일 의미 명확화 + 안내 발송 책임 호출자 이동, §4 Form step 3 dispatcher 책임 명확화), spec/4-nodes/7-trigger/providers/telegram.md (§5.3 phone 행 v1 stub 명확화) 반영. 후속 plan `spec-fix-form-phone-validation` 추적.


# Spec Fix Draft — Chat Channel 동작 명세 보완

## 원본 발견사항

### SUMMARY#8: CCH-CV-03 `running` 케이스 미정의 (requirement.md / api_contract.md)

`spec/5-system/15-chat-channel.md §3.2 CCH-CV-03` 는 두 케이스만 정의한다:
- `waiting_for_input` → 인터랙션 forwarding
- 종료된 execution → 새 execution 시작

`running` 상태 (워크플로우 실행 중, `waiting_for_input` 미도달) 에서 두 번째 메시지가 도착하는 케이스가 미정의여서 구현자가 임의 결정해야 한다.

### SUMMARY#12: `parseUpdate` pure 계약 / group refusal 반환 타입 불명확 (security.md / architecture.md / testing.md)

`telegram.md §4` 의 group chat → `null` + 안내 발송, unsupported type → `null` + 안내 발송이
호출자(`HooksService`) 가 `null` 만으로 두 케이스를 구분할 수 없는 문제가 있다.
또한 `chat-channel-adapter.md §4` step 3 의 "같은 필드 재질문" 이 어댑터가 직접 `sendMessage` 를 호출하는 것인지 불명확하다 (pure 계약 위반 가능성).

### SUMMARY#9: telegram.md §5.3 phone 타입 Form spec 불일치 (requirement.md / documentation.md)

`telegram.md §5.3` 의 `(특수) phone` 행이 `Form spec type: text + custom validation rule = phone pattern` 으로 주석을 달았으나, 실제 `spec/4-nodes/6-presentation/4-form.md §1 type Enum` 에 `phone` 이 없고 `ValidationRule` 에 phone pattern 표현이 spec화되지 않았다.

## 제안 변경

### SUMMARY#8 — CCH-CV-03 running 케이스 추가

**파일**: `spec/5-system/15-chat-channel.md §3.2 CCH-CV-03`

현재:
```
CCH-CV-03 | 필수 | 활성 execution + waiting_for_input → interact(). 종료된 execution → 신규 execute().
```

변경안:
```
CCH-CV-03 | 필수 | 메시지 수신 시 conversation 상태별 처리:
  - execution.status = waiting_for_input → InteractionService.interact() in-process 호출
  - execution.status = running (waiting_for_input 미도달) → 채널에 "처리 중" 안내 메시지 발송 + 202 무시 (대기 큐 미적재)
  - execution 종료 (completed/failed/cancelled) 또는 conversation 없음 → 새 execute() 시작
```

### SUMMARY#12 — parseUpdate 반환 타입 확장 + §4 step 3 명확화

**파일**: `spec/conventions/chat-channel-adapter.md §1.1`

`parseUpdate` 의 반환 타입 확장 권고:
```typescript
// 현재
parseUpdate(raw: unknown, config: ChatChannelConfig): Promise<ChannelUpdate | null>;

// 권고 (v2 option — v1 은 null = 무시로 유지, 안내 발송은 HooksService 가 raw body 에서 chat.type 추출하여 판단)
// parseUpdate 는 pure 계약 유지. 안내 발송 책임은 호출자.
// 단, null 의 의미를 명확화:
// - null = "무시 — 호출자가 body 에서 chat.type 등을 확인해 안내 여부 결정"
// 봇 메시지(from.is_bot=true)는 안내 미발송.
// group chat refusal은 호출자가 sendMessage 로 languageHints.groupChatRefusal 발송.
```

**파일**: `spec/conventions/chat-channel-adapter.md §4 step 3`

변경:
```
실패 → 같은 필드 재질문
```
→
```
실패 → 같은 필드의 `form_prompt` ChannelMessage 를 반환 — `sendMessage` 는 호출자(ChatChannelDispatcher)가 담당.
       parseUpdate 는 pure 계약 (side-effect free) 을 유지한다.
```

### SUMMARY#9 — telegram.md §5.3 phone 타입 명확화

**파일**: `spec/4-nodes/7-trigger/providers/telegram.md §5.3`

`(특수) phone` 행 설명 변경:
```
현재: "Form spec type: text + custom validation rule = phone pattern"
변경: "Form spec 에 `phone` type 미존재 — v1 은 `type: 'text'` 필드로 처리.
       phone pattern validation (`/^\+?[\d\s\-()+]+$/`) 이 Form spec 에 추가되거나
       telegram.md 에 구체 ValidationRule 예시 추가 필요 (미결 — spec-fix-form-phone-validation 추적)"
```

## 추적

- CCH-CV-03 running 케이스 spec 갱신 → 구현 plan 의 HooksService `handleChatChannelWebhook` 업데이트 필요
- phone validation rule spec화 → `spec/4-nodes/6-presentation/4-form.md` 별도 갱신 plan 필요

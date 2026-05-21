---
worktree: chat-channel-spec-fix-5fc137
started: 2026-05-22
completed: 2026-05-22
owner: project-planner
---

> 구현 결과: spec/5-system/15-chat-channel.md (Rationale R8 — NotificationDispatcher 분리 후속 + listener dedup/teardown 의무 정책, §5.4 Bot Token Rotation API 응답 계약 — `{ data }`/`{ error }` 표준 envelope + 200/400/404/502 코드 5종) 반영. 후속 plan `chat-channel-dispatcher-split` 추적.


# Spec Fix Draft — Chat Channel 아키텍처 + API 계약 보완

## 원본 발견사항

### SUMMARY#14: CCH-AD-05 NotificationDispatcher 단일 책임 경계 (architecture.md)

`NotificationDispatcher` 가 (a) 외부 HTTP POST, (b) Redis pub/sub, (c) in-process EventEmitter 세 갈래를 동시에 담당한다.
향후 provider 증가 시 fan-out 분기가 늘어나는 구조. spec 에 "provider 2개 이상 시 ChannelDispatcher 분리" 언급이 없다.

### SUMMARY#15: rotate-bot-token API 응답 형식 미명시 (api_contract.md)

`POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 성공/실패 응답 계약이 spec 에 없다.
유사한 EIA endpoint 와의 일관성도 불명확하다.

## 제안 변경

### SUMMARY#14 — 아키텍처 후속 plan 명시

**파일**: `spec/5-system/15-chat-channel.md §11 후속 plan` (또는 Rationale 추가)

추가할 내용:
```markdown
### 후속 아키텍처 결정 — ChannelDispatcher 분리 (provider ≥ 2 시)

현재 v1 설계에서 `NotificationDispatcher` 는 세 가지 fan-out 갈래를 담당한다:
(a) 외부 HTTP POST, (b) Redis pub/sub SSE, (c) in-process EventEmitter (Chat Channel).
Chat Channel provider 가 2개 이상으로 늘어나면 `ChannelDispatcher` (EventEmitter 전담 in-process bus)를
`NotificationDispatcher` 에서 분리하는 리팩토링을 검토할 것.

또한 EventEmitter 리스너 중복 방지 정책: `setupChannel()` 호출 시 동일 triggerId 의 기존 리스너를 제거 후 새 리스너 등록.
`teardownChannel()` 호출 시 반드시 리스너 해제 (메시지 중복 발송 방지).
```

### SUMMARY#15 — rotate-bot-token API 응답 계약 추가

**파일**: `spec/5-system/15-chat-channel.md §3.4 CCH-SE-04` 또는 §5 API 명세

추가할 내용:
```markdown
#### rotate-bot-token 응답 형식

**성공 (200 OK)**:
```json
{
  "triggerId": "<trigger-id>",
  "rotatedAt": "<ISO8601>",
  "chatChannelHealth": "ok"
}
```

**실패 케이스**:
| HTTP | code | 사유 |
|---|---|---|
| 404 | TRIGGER_NOT_FOUND | trigger 미존재 |
| 400 | CHAT_CHANNEL_NOT_CONFIGURED | chatChannel 미설정 |
| 400 | CHAT_CHANNEL_PROVIDER_UNKNOWN | 미지원 provider |
| 502 | CHAT_CHANNEL_SETUP_FAILED | Telegram setWebhook API 실패 |
```

## 추적

- NotificationDispatcher 분리는 v1 이후 결정이므로 spec Rationale 에 언급만 추가.
- rotate-bot-token API 응답 계약은 현재 구현과 일치하도록 확인 후 spec 에 반영.

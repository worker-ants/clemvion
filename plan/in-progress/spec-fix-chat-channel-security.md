---
worktree: chat-channel-telegram-0c106c
started: 2026-05-22
owner: resolution-applier
---

# Spec Fix Draft — Chat Channel 보안 관련 spec 정합

## 원본 발견사항

### SUMMARY#5: CCH-SE-03 vs v1 plaintext stub 모순 (requirement.md / security.md / api_contract.md)

CCH-SE-03 은 "config JSONB 평문 금지 + secret store reference 만 보관"을 **필수** 요구사항으로 명시한다.
그러나 `spec/5-system/15-chat-channel.md §4.1` 과 `spec/conventions/chat-channel-adapter.md §2.3` 에
`v1 stub: plaintext 보관` 이 명시되어 있어 같은 문서 안에서 요구사항(필수)과 구현 의도가 충돌한다.
Bot API Token 은 봇 계정 완전 장악 권한이므로 평문 저장은 고위험 취약점이다.

### SUMMARY#13: EIA-AU-08 scope 플래그 외부 HTTP 오염 가능성 (security.md / api_contract.md)

`InteractionRequestContext.scope: 'in_process_trusted'` 가 선택 필드이므로, 외부 HTTP 요청 guard가
실수 또는 악의적 수정으로 이 플래그를 set 하면 token 검증이 완전히 우회된다. spec 에는 구조적 장치가 없다.

## 제안 변경

### SUMMARY#5 — CCH-SE-03 우선순위 조정 + §4.1 주석 명시

**파일**: `spec/5-system/15-chat-channel.md`

CCH-SE-03 행 변경:
```
| CCH-SE-03 | 필수 (v2; v1 은 §4.1 plaintext stub) | config JSONB 에 botToken 평문 금지 — secret store reference 만 보관 (`secret://triggers/:id/bot-token`). **v1 구현 단계에서는 notification.signing.secret 와 동일한 plaintext stub 을 일시 허용** (별 plan `spec-fix-chat-channel-security.md` → 별도 구현 plan 으로 추적). |
```

§4.1 `botTokenRef` 필드 설명에 주석 추가:
```markdown
<!-- v1 구현: 평문 Trigger.config.chatChannel.botToken 으로 stub.
     별 plan spec-update-chat-channel-bot-token-stub 에서 secret reference 경로로 갱신 예정.
     현재 구현은 CCH-SE-03 의 v1 예외 허용 — post-impl plan 에서 추적. -->
```

**파일**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig`

`secretToken` 필드 주석 명확화:
- `secretToken` 이 이미 인터페이스에 `secretToken?: string` 으로 존재함 (현재 상태 OK).
- 주석에 "v1 stub: botTokenRef 와 동일 plaintext 보관" 을 "v1 stub: 서버 자체 생성 값으로 DB 에 평문 보관 — secret store 연동은 별 plan 추적" 으로 명확화.

### SUMMARY#13 — EIA-AU-08 구현 제약 명시 + 타입 분리 권고

**파일**: `spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-08`

Implementation Note 추가:
```markdown
**구현 요건 — `InteractionGuard` 제약**:
- 외부 HTTP 요청에서 합성되는 `InteractionRequestContext` 에 `scope` 필드를 추가하는 코드 경로를 절대 갖지 않는다.
- HTTP request body / header 에서 역직렬화 시 `scope` 필드는 반드시 strip 되어야 한다 (DTO `excludeExtraneousValues` 적용).
- `scope: 'in_process_trusted'` 는 서버 내부 모듈(ChatChannelDispatcher 등)이 ctx 를 직접 생성할 때만 set 가능.

**권고 (v2 이후)**: `InteractionRequestContext` 를 두 타입으로 분리 —
- `ExternalInteractionRequestContext` (HTTP용, `tokenFamily` 필수, `scope` 없음)
- `InternalInteractionRequestContext` (in-process, `scope: 'in_process_trusted'` 필수)
```

## 추적

이 draft 가 project-planner 에 의해 spec 에 반영된 후, 별도 구현 plan (`spec-update-chat-channel-bot-token-stub.md`) 을 신설해 CCH-SE-03 v2 implementation 을 추적한다.

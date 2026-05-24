# @workflow/chat-channel-validation

Chat Channel provider 의 inbound-signing plaintext (Slack signing secret / Discord ed25519 application public key) 형식 검증을 단일 진실로 추출한 패키지.

Backend service / DTO 와 frontend client-side 검증이 같은 정규식을 사용하도록 보장.

## Exports

```ts
import {
  SLACK_SIGNING_SECRET_REGEX,
  DISCORD_PUBLIC_KEY_REGEX,
  isValidSlackSigningSecret,
  isValidDiscordPublicKey,
} from '@workflow/chat-channel-validation';
```

- `SLACK_SIGNING_SECRET_REGEX` — `/^[a-f0-9]{32}$/` lowercase hex 32 chars
- `DISCORD_PUBLIC_KEY_REGEX` — `/^[a-f0-9]{64}$/` lowercase hex 64 chars (ed25519 32 bytes)
- `isValidSlackSigningSecret(value)` / `isValidDiscordPublicKey(value)` — boolean 헬퍼

## SoT

- `spec/4-nodes/7-trigger/providers/slack.md §6` — Slack signing secret 형식
- `spec/4-nodes/7-trigger/providers/discord.md §6` — Discord ed25519 public key 형식
- `spec/conventions/secret-store.md §5.5 (b)` — provider-issued plaintext 흐름

## 신규 provider 추가 시

본 파일 (`src/index.ts`) 에 새 정규식 + 헬퍼 export 만 추가. backend `triggers.service.ts` 의 `assertInboundSigningPlaintextByProvider` 분기 + frontend `triggers/page.tsx` 의 client-side 검증이 같은 export 를 import.

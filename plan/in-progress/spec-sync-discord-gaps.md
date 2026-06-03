---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# discord — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/7-trigger/providers/discord.md

## 미구현 항목

- [ ] **§3.1 setupChannel public key cross-verify + botIdentity.publicKey 저장** — `GET /applications/@me` 응답 `verify_key` 와 사용자 입력 public key 의 일치 검증, 불일치 시 `BOT_TOKEN_INVALID` error 분기, `botIdentity.publicKey` 저장이 없다. 현재는 `id`/`name` 만 저장 (`botId` = `hashStringToInt(id)`). inbound 서명 검증 자체는 §6 (`assertInboundSigningPlaintextByProvider` 정규식 + `verifyDiscordSignature` ed25519) 으로 동작하므로, 본 항목은 setup 시점의 추가 안전장치.
- [ ] **§5.1(b) AI Multi Turn reply — "Reply" 버튼 → Modal TEXT_INPUT 경로** — `renderAiMessage` 가 응답 메시지에 "Reply" 버튼(`custom_id: "__reply__"`)을 첨부하지 않고, parseUpdate 에 `__reply__` 분기가 없어 `clemvion_reply` modal 을 여는 진입점이 없다 (도달 불가). MODAL_SUBMIT 의 `clemvion_form` 이외 TEXT_INPUT → `text_message` normalize 일반 경로는 이미 존재하나 진입점 부재. 현재 reply 는 (a) `/<prefix> reply <message>` slash 만 동작. spec 이 (b) 를 v1 default UX 로 약속.

## 부수 narration 미스매치 (본 audit 에서 spec 본문에 "미구현 Planned" 로 인라인 표기 완료 — 코드 변경 추적용)

- [ ] **§3 sendMessage(image) 실제 이미지 첨부** — 현재 caption/fallbackText 만 content 로 POST. multipart attachments / `embeds.image.url` 미구현.
- [ ] **§5.4 carousel `auto` embed + imageUrl** — 현재 모든 시각형이 markdown 텍스트 fallback. carousel 카드별 `embeds: [{image:{url}}]` 분기(imageUrl) 미구현 (embeds 호출처 없음).
- [ ] **§3.3 modal title / TEXT_INPUT 길이 제약** — modal title 하드코딩 `'양식'` (form 제목 미반영), TEXT_INPUT `min_length`/`max_length` 미부여 (placeholder 만 부여, 길이 검증은 submit 후 어댑터).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__7-trigger__providers__discord.md 참조.
- evidence: discord.adapter.ts(setupChannel 74-122, sendMessage image 232-238, openFormModal 261-287), discord-message.renderer.ts(renderAiMessage 76-88, carousel 429-441), discord-update.parser.ts(__reply__ 분기 부재, MODAL_SUBMIT 118-157).

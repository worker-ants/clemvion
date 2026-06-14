---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# discord — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/7-trigger/providers/discord.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-discord-gaps PR)**: §3.1·§3.3·§5.1(b) 구현/확인 완료. §3·§5.4(이미지/embeds)는
> 공유 `ChannelMessage.body.image` 타입 확장 + Discord embeds/multipart 인프라 의존으로 보류(spec 이 v1=text fallback 명시).
> spec doc-sync(§3.1·§3.3·§5.1(b) "미구현"→구현)는 본 PR 에서 동반 갱신.

- [x] **§3.1 setupChannel public key cross-verify + botIdentity.publicKey 저장** — cross-verify(verify_key↔inboundSigningRef)·`BOT_TOKEN_INVALID` throw 는 **이미 구현**(C-11). 본 PR 에서 `botIdentity.publicKey = application.verify_key` 캐시 저장 추가(비민감). 테스트: setupChannel publicKey 검증.
- [x] **§5.1(b) AI Multi Turn reply — "Reply" 버튼 → Modal** — **이미 구현됨 확인**: renderAiMessage 가 마지막 텍스트 청크를 buttons(`__reply__`)로 승격, parseUpdate `__reply__`→`open_form_modal(modal=reply)`, openFormModal→`clemvion_reply` modal, MODAL_SUBMIT→text_message normalize 전부 존재. plan 의 "도달 불가" 서술 stale. 테스트(renderer reply 버튼) 추가.

## 보류 (인프라/공유타입 의존 — 별도 PR)

- [ ] **§3 sendMessage(image) 실제 이미지 첨부** — caption/fallbackText text fallback 유지. multipart attachments / `embeds.image.url` 미구현. `ChannelMessage.body.image` 가 `bytes: Buffer` 라 URL-embed 경로는 공유 타입 확장 필요. spec v1 = text fallback 명시.
- [ ] **§5.4 carousel `auto` embed + imageUrl** — markdown 텍스트 fallback 유지. carousel 카드별 `embeds: [{image:{url}}]` 분기는 공유 타입(imageUrl) + embeds 발송 경로 필요 — telegram §5.4 와 동일 cross-provider 작업으로 묶어 별도 PR.
- [x] **§3.3 modal title 동적화 + TEXT_INPUT 길이 제약** — modal title 을 `formConfig.title`(extractFormTitle)→pendingFormModal.title→OpenFormModalParams.title 로 전달, Discord openFormModal 이 사용(45자 truncate, languageHints/`양식` fallback). TEXT_INPUT 에 `min_length`/`max_length`(FormModalField + extractFormFields 가 field.validation 에서 추출) 부여(Discord 0–4000 cap). 테스트: extractFormFields/Title + openFormModal title·min/max.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__7-trigger__providers__discord.md 참조.
- evidence: discord.adapter.ts(setupChannel 74-122, sendMessage image 232-238, openFormModal 261-287), discord-message.renderer.ts(renderAiMessage 76-88, carousel 429-441), discord-update.parser.ts(__reply__ 분기 부재, MODAL_SUBMIT 118-157).

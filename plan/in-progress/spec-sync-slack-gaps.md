---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# slack — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/7-trigger/providers/slack.md

## 미구현 항목

> **진행 현황 재확인 (2026-06-14, m-cleanup 감사)**: structural-followups C-12 이후 일부 진척 있음 — `SlackClient.filesInfo`·`filesUploadV2` 메서드 실재(`slack-client.ts:76,87`), `response_url` `replace_original` 비동기 POST 구현됨(`slack.adapter.ts:243`, ackInteraction), HooksService enrichInbound 가 file_upload→files.info 보강 호출(`hooks.service.ts:288`). **그러나 `file_upload → submit_form` 합성은 여전히 미구현** — `forwardToInteractionService`(`hooks.service.ts:640~672`)가 text_message·button_callback 만 라우팅하고 file_upload/contact_share 는 "Phase 4 에서 처리" 주석만 남은 no-op. 따라서 본 plan 은 **in-progress 유지**, 잔여는 아래 ①의 submit_form 합성부 + ②의 sendMessage image→uploadV2 배선 검증.

- [ ] **`file_shared` → `files.info` 보강 → `submit_form`** (R-S-7 / §4.1 / §5.3): files.info 보강은 구현됨(위 재확인). **잔여**: form `file` 필드 검증 + EIA `submit_form` 합성(`forwardToInteractionService` file_upload 분기) 미구현.
- [ ] **`files.uploadV2` (image / 시각형 v2 PNG)** (§3 sendMessage(image) / §5.4): `filesUploadV2` 메서드는 실재. **잔여**: adapter `sendMessage` 의 image kind 가 실제 `filesUploadV2` 를 호출하는지 배선 검증 필요(현재 text fallback 가능성).
- [x] **`response_url` 비동기 후속 POST** (§5.2 step 3 / §4.2): `slack.adapter.ts` ackInteraction 이 `response_url` 로 `replace_original: true` POST 구현 완료 (2026-06-14 확인).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__7-trigger__providers__slack.md 참조.
- 3초 ack(즉시 200), `views.open` native modal open, `auth.revoke` rotation, `chat.postMessage` 백오프 등은 구현 완료 — 본 plan 범위 아님.

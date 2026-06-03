---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# slack — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/7-trigger/providers/slack.md

## 미구현 항목
- [ ] **`file_shared` → `files.info` 보강 → `submit_form`** (R-S-7 / §4.1 / §5.3): `parseUpdate` 의 `file_upload` 반환은 구현됐으나, `HooksService` 의 file_upload 처리가 Phase 4 스텁(no-op)이고 `SlackClient` 에 `filesInfo` 메서드가 없다. mimeType/filename/url_private 보강 + form `file` 필드 검증 + EIA `submit_form` 합성 전부 미구현.
- [ ] **`files.uploadV2` (image / 시각형 v2 PNG)** (§3 sendMessage(image) / §5.4): `SlackClient.filesUploadV2` 가 Phase 3 스텁으로 호출 시 reject. 현재 image kind 는 text fallback. v1 = text 라 동작엔 문제 없으나 spec 이 약속한 uploadV2 경로 자체는 부재.
- [ ] **`response_url` 비동기 후속 POST** (§5.2 step 3 / §4.2): `response_url` 은 payload 타입에만 존재하고 이를 사용한 비동기 갱신 POST 경로(`replace_original` 등)가 없다.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__7-trigger__providers__slack.md 참조.
- 3초 ack(즉시 200), `views.open` native modal open, `auth.revoke` rotation, `chat.postMessage` 백오프 등은 구현 완료 — 본 plan 범위 아님.

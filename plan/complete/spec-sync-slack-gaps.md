---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
spec_impact:
  - spec/4-nodes/7-trigger/providers/slack.md
---

# slack — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/7-trigger/providers/slack.md

## 미구현 항목

> **코드 직접 재검증 (2026-06-14, impl-slack-gaps)**: audit 시점(2026-06-03) 이후 코드가 진척돼 plan 의 "전부 미구현"
> 서술 다수가 **stale**임을 확인. items 2·3 은 완전 구현, item 1 은 핵심 경로(file_upload→form 값→submit_form) 구현됨 —
> 잔여는 form `file` 필드의 MIME 검증뿐이며 이는 slack 고유가 아니라 **`state.formState` 의 fieldsCatalog v1 한계**(다단계
> 폼이 field name/제약을 state 에 저장 안 해 `field_<idx>` heuristic 사용)에 종속 — `hooks.service.ts:735-740` 가 PR-E
> 보강 항목으로 명시. 따라서 slack-gaps 단독의 clean 구현 갭은 없음.
> (m-cleanup 감사 노트의 "file_upload→submit_form 미구현" 서술은 `forwardToInteractionService` no-op 만 보고 폼 시퀀스
> 핸들러 `handleFormStep`(L730) 경로를 놓친 것 — 아래 ① 에서 정정.)

- [x] **`file_shared` → `files.info` 보강 → `submit_form`** (R-S-7 / §4.1 / §5.3): **핵심 경로 구현 완료** — `SlackClient.filesInfo` 존재(`slack-client.ts:76`), `HooksService.enrichInbound` 가 file_upload→files.info 보강, **폼 시퀀스 핸들러 `handleFormStep`(hooks.service.ts:779)가 file_upload 를 form 필드 값(fileId/mimeType/filename/urlPrivate)으로 누적→submit_form 호출**. `forwardToInteractionService` 의 file_upload no-op 은 **폼 시퀀스 밖** 경로라 by-design(활성 폼 없으면 제출 대상 없음).
- **[v2 로드맵 이관]** form `file` 필드 MIME 검증 — slack 고유 아님. `state.formState.fieldsCatalog` v1 한계(다단계 폼이 field 제약을 state 에 미저장 → `field_<idx>` heuristic, `hooks.service.ts:791-796` 주석 "PR-E")에 종속. spec `slack.md §4.1` 이 "잔여(Planned)" 로 명시 = spec↔code 정합(live drift 없음). 추적 SoT = spec §4.1 Planned 마커(PR-E 는 committed plan 아닌 코드 주석 라벨).
- [x] **`files.uploadV2` (image PNG)** (§3 / §5.4): **구현됨** — `slack.adapter.ts:202` 가 image body 를 `client.filesUploadV2`(channel_id/filename/file=bytes/initial_comment)로 실 업로드, 실패 시 chat.postMessage text fallback.
- [x] **`response_url` 비동기 후속 POST** (§5.2 / §4.2): **구현됨** — `slack.adapter.ts` `ackInteraction` 이 `response_url` 로 `replace_original` POST(button_callback 후 "선택 완료" 갱신).

## 종결 (2026-07-05)
- 5인 검증 재확인: 두 `[x]`(files.uploadV2 image·response_url replace_original) 코드-정합, file_shared→submit_form 핵심 경로도 구현 완료. 유일 잔여(form-file MIME)는 spec §4.1 "잔여(Planned)" = **live drift 0**.
- spec `slack.md` `status: partial → implemented` 승격 + `pending_plans` 제거(같은 commit). 잔여 Planned 은 spec §4.1 마커가 SoT.
- (stale cite 정정: 구 `hooks.service.ts:735-740`/`L730`/`L747-778` → 실제 `handleFormStep` L779, PR-E 주석 L791-796.)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__7-trigger__providers__slack.md 참조.
- 3초 ack(즉시 200), `views.open` native modal open, `auth.revoke` rotation, `chat.postMessage` 백오프 등은 구현 완료 — 본 plan 범위 아님.

---
worktree: chat-channel-form-native-modal-c021b9
started: 2026-05-24
owner: project-planner (spec done) → developer (impl, TBD)
status: in-progress
---

# Form native modal — Slack views.open + Discord MODAL_SUBMIT

v1 Convention §4 "Form 다단계 시퀀스 규약" (모든 어댑터 동일 다단계 텍스트) 의 예외 절을 신설 — provider 가 native form UI (Slack `views.open` modal / Discord MODAL_SUBMIT) 를 지원 시 단일 step 으로 처리.

> **Spec 단계 완료 (2026-05-28)**: Convention §4.1 / R-CCA-8 신설, slack.md §5.3 / R-S-6 + discord.md §5.3 / R-D-6 격상, 15-chat-channel.md CCH-MP-03 + formMode enum 갱신, telegram.md §5.3 cross-link 정정. consistency-check `--spec` 통과 (rationale-continuity OK — R4 "native UI 분기는 v2 옵션" 의 실현). 다음 단계 = developer 의 `--impl-prep` + 백엔드 구현.
>
> **impl-prep consistency-check (00_48_25) — CRITICAL 3건은 false-positive 판정**: cross-spec/convention-compliance checker 가 "Convention §4.1 / R-CCA-8 / form_modal / form_submission / formMode enum 미존재" 를 CRITICAL 로 보고했으나, 이는 checker 가 provider spec 의 Convention cross-link 를 **미병합 origin/main** 경로로 resolve 해 읽었기 때문 (origin/main grep 0건 vs worktree HEAD grep 11건 — `git show` 로 검증 완료). worktree HEAD (commit 78e5c71a) 의 spec 상태는 완전히 일관적. impl-prep 게이트 본질(구현 전 spec 내부 정합성)은 충족 — 진행.

## 진입 조건 (Convention 변경 필요)

- [x] Convention §4 의 "v1 다단계 시퀀스 통일" 결정 (R4) 번복 정당화 — R4 갱신 + R-CCA-8 신설. 번복이 아니라 R4 가 명시한 "native UI 분기는 v2 옵션" 의 실현으로 정당화 (rationale-continuity checker I1 확인).
- [x] modal 의 5 fields 한계 대응 — Convention §4.1 + R-CCA-8 대안 3: Discord modal 5 TEXT_INPUT hard limit 을 공통 분모로 통일, 5 초과 시 §4.2 다단계 fallback.
- [x] Telegram (modal 미지원) 의 영향 — `supportsNativeForm = false` 로 항상 §4.2 다단계 유지 (telegram.md §5.3 명시).

## 산출물 범위

1. **Spec 변경** — `spec/conventions/chat-channel-adapter.md`
   - §4 다단계 시퀀스 규약에 예외 절 추가 — "provider 가 supportsNativeForm = true 면 5 fields 이하는 modal 우선"
   - Rationale R4 갱신 (조건부 native UI 허용)
2. **Spec 갱신** — `spec/4-nodes/7-trigger/providers/slack.md` §5.3 / `discord.md` §5.3
   - R-S-6 / R-D-6 의 "v2 옵션" → "v2 채택" 으로 갱신
   - Slack: `views.open` API + `view_submission` payload 처리
   - Discord: MODAL_SUBMIT (이미 parser 가 normalize 중) + render 시 modal action 트리거

3. **Backend 구현** (spec settle 후 developer `--impl-prep` 부터)
   - `types.ts`: `ChannelMessage.body` 에 `form_modal` variant + `ChannelUpdate.command` 에 `form_submission` variant 추가. `ChatChannelAdapter` 인터페이스에 `supportsNativeForm: boolean` 추가.
   - **3 어댑터 모두** `supportsNativeForm` 선언 — telegram=false, slack/discord=true.
   - **formMode 분기 로직** (공통): `auto`/`native_modal`/`multi_step` + capability + 필드 type 범위 + fields ≤ 5 평가 → modal 경로 / §4.2 다단계.
   - Slack: `slack-client.ts` 에 `views.open` 추가, `slack-update.parser.ts` 에 view_submission(`callback_id==='clemvion_form'`) → form_submission + `__open_form__` block_actions 분기. renderer 에 `form_modal` 버튼 합성 + modal view builder.
   - Discord: `discord-update.parser.ts` 에 MODAL_SUBMIT custom_id 분기 (`clemvion_form`→form_submission / `clemvion_reply`→text_message) + `__open_form__` 버튼 분기. renderer 에 `form_modal` 버튼 + `{type:9}` MODAL builder (TEXT_INPUT only, select/checkbox/file 포함 시 다단계 강등).
   - `formMode` DTO validator enum 확장 (`multi_step|native_modal|auto`) — trigger config 검증 (15-chat-channel §4.1).
   - `languageHints.formOpenLabel` KO/EN default 등록 (backend default 문구 store).
   - dispatcher: form_modal 버튼 클릭 → modal open 호출은 `ackInteraction` 안 (Convention §1.1).

4. **Test**
   - Unit: formMode 분기 — ≤5 text-fields → modal / 6+ → 다단계 / Discord select 포함 → 다단계 / Telegram → 항상 다단계 / multi_step opt-out.
   - Unit: parseUpdate form_submission normalize (Slack view.state.values / Discord components 평탄화), Discord custom_id 두 경로 분기.
   - Integration: form_modal 버튼 클릭 → modal open → submit → form_submission → EIA submit_form. server-side 검증 실패 → Slack response_action errors / Discord 버튼 재노출.

## 위험

- Convention §4 의 강제 정책 번복 — rationale-continuity-check 가 위반 검출 가능. R4 번복 정당화 필요.
- Slack `views.open` 는 trigger_id (3초 유효) 가 필수 — interactivity 응답 후 즉시 호출해야 함.
- Discord modal 도 interaction.token 으로 응답 (15분 유효).

## 참조

- Convention: `spec/conventions/chat-channel-adapter.md §4 / R4`
- Slack spec: `slack.md §5.3 / R-S-6`
- Discord spec: `discord.md §5.3 / R-D-6`

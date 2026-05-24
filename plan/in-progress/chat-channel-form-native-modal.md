---
worktree: (assigned at impl-start)
started: 2026-05-24
owner: developer (TBD)
status: backlog
---

# Form native modal — Slack views.open + Discord MODAL_SUBMIT

v1 Convention §4 "Form 다단계 시퀀스 규약" (모든 어댑터 동일 다단계 텍스트) 의 예외 절을 신설 — provider 가 native form UI (Slack `views.open` modal / Discord MODAL_SUBMIT) 를 지원 시 단일 step 으로 처리.

## 진입 조건 (Convention 변경 필요)

- [ ] Convention §4 의 "v1 다단계 시퀀스 통일" 결정 (R4) 번복 정당화
- [ ] modal 의 5 fields 한계 (Slack `views.open` plain_text_input + Discord modal 5 TEXT_INPUT) 대응 — 5 초과 시 다단계 fallback
- [ ] Telegram (modal 미지원) 의 영향 — 기존 다단계 그대로 유지

## 산출물 범위

1. **Spec 변경** — `spec/conventions/chat-channel-adapter.md`
   - §4 다단계 시퀀스 규약에 예외 절 추가 — "provider 가 supportsNativeForm = true 면 5 fields 이하는 modal 우선"
   - Rationale R4 갱신 (조건부 native UI 허용)
2. **Spec 갱신** — `spec/4-nodes/7-trigger/providers/slack.md` §5.3 / `discord.md` §5.3
   - R-S-6 / R-D-6 의 "v2 옵션" → "v2 채택" 으로 갱신
   - Slack: `views.open` API + `view_submission` payload 처리
   - Discord: MODAL_SUBMIT (이미 parser 가 normalize 중) + render 시 modal action 트리거

3. **Backend 구현**
   - `ChannelMessage.body.kind = 'form_modal'` 신설 (또는 기존 form_prompt 확장)
   - Slack: `views.open` API client + view_submission parser 분기
   - Discord: 이미 parser 가 MODAL_SUBMIT 처리 — render 측에서 modal trigger 메시지 합성

4. **Test**
   - Unit: 5 fields 이하 → modal / 6+ → 다단계 fallback
   - Integration: modal submit → form data → EIA submit_form

## 위험

- Convention §4 의 강제 정책 번복 — rationale-continuity-check 가 위반 검출 가능. R4 번복 정당화 필요.
- Slack `views.open` 는 trigger_id (3초 유효) 가 필수 — interactivity 응답 후 즉시 호출해야 함.
- Discord modal 도 interaction.token 으로 응답 (15분 유효).

## 참조

- Convention: `spec/conventions/chat-channel-adapter.md §4 / R4`
- Slack spec: `slack.md §5.3 / R-S-6`
- Discord spec: `discord.md §5.3 / R-D-6`

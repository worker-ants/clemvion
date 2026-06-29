# 신규 식별자 충돌 검토 — `spec/4-nodes/7-trigger/providers/slack.md`

검토 모드: spec draft (--spec)

## 발견사항

- **[INFO]** Slack Web API 메서드를 `/api/<method>` 로 렌더링 — 내부 REST 경로와 표기 prefix 공유
  - target 신규 식별자: `POST /api/auth.test`, `POST /api/chat.postMessage`, `POST /api/views.open`, `POST /api/files.uploadV2`, `POST /api/auth.revoke` (slack.md §3 표 · §3.1 · §3.3)
  - 기존 사용처: 같은 문서 §3.2 의 우리 내부 endpoint `POST /api/triggers/:id/chat-channel/rotate-bot-token` 과 `/api/` prefix 를 공유. inbound 경로는 `spec/5-system/15-chat-channel.md` 의 `/api/hooks/...`
  - 상세: Slack 외부 API 는 점-구분(`auth.test` / `views.open`), 우리 REST 는 슬래시 path segment(`triggers/:id/chat-channel/...`) 라 **실제 라우트 충돌 없음**. 하이퍼링크가 `https://api.slack.com/methods/*` 를 가리키고 §3.1 코드블록은 full host(`https://slack.com/api/...`)를 보여줘 의미는 명확하다. 다만 `/api/` 라벨이 외부/내부 두 네임스페이스를 한 문서에서 섞어 표기하는 모호성이 있다. telegram.md / discord.md 도 동일 패턴이라 기존 컨벤션과 일치(회귀 아님).
  - 제안: 변경 불요(established convention). 명확화를 원하면 외부 메서드를 `Slack: chat.postMessage` 형태로 host 를 명시.

## 점검 관점별 결과 (충돌 없음 근거)

1. **요구사항 ID 충돌** — 없음. `R-S-1`~`R-S-9` 는 Slack 전용 prefix 로 namespacing. Discord 는 `R-D-*`, Telegram 은 `R-T-*`/`R2` 를 쓰며 `grep -rn "R-S-[0-9]" spec/` 결과 slack.md 외 출현은 전부 discord.md 의 **참조**(R-S-1/R-S-2/R-S-8 인용)일 뿐 재정의가 아니다. CCH-* / CCH-SE-04 등은 15-chat-channel.md 가 SoT 이고 slack.md 는 인용만 한다.
2. **엔티티/타입명 충돌** — 없음. `clemvion_form`(callback_id)·`__open_form__`·`open_form_modal`·`form_submission`·`ChannelUpdate.kind` 들·`conversationKey`·`hashStringToInt`·`assertInboundSigningPlaintextByProvider`·`ChatChannelTokenRotatorService` 는 모두 `spec/conventions/chat-channel-adapter.md` + `spec/5-system/15-chat-channel.md` 에 이미 정의된 **cross-provider 컨벤션**이며 Discord 가 동일 식별자를 같은 의미로 사용(예: discord.md 의 `custom_id: "clemvion_form"`, `kind: "form_submission"`). Slack 의 재사용은 의미 동일 → 충돌 아님(통합된 컨벤션).
3. **API endpoint 충돌** — 없음. 신규 내부 endpoint `POST /api/triggers/:id/chat-channel/rotate-bot-token` 은 15-chat-channel.md CCH-SE-04 에 이미 정의된 공용 endpoint 의 인용(신설 아님). 나머지 `/api/*` 는 Slack 외부 메서드(위 INFO 참조).
4. **이벤트/메시지명 충돌** — 없음. `url_verification` / `event_callback` / `block_actions` / `view_submission` / `file_shared` 는 Slack 플랫폼 이벤트명(우리 네임스페이스 아님). 내부 command kind(`open_form_modal` 등)는 컨벤션 enum 재사용.
5. **환경변수·설정키 충돌** — 없음. config 키 `inboundSigningRef`·`botTokenRef`·`botIdentity`·`chat_channel_token_v2`·`secret://triggers/{id}/inbound-signing`·`secret://triggers/{id}/bot-token` 은 Telegram/Discord 공유 슬롯(R-S-1 / R-D-1). signing 정규식 `^[a-f0-9]{32}$` 는 Slack 전용(Discord 는 `^[a-f0-9]{64}$`) — provider 분기로 분리. 신규 ENV var 도입 없음.
6. **파일 경로 충돌** — 없음. provider catalog `_overview.md` 가 이미 `| slack | slack.md | supported (v1) |` 등록. user_guide `slack.mdx`/`slack.en.mdx`, i18n `triggers.ts` 는 telegram/discord 와 동일 명명 컨벤션이며 디스크상 기존 파일과 1:1(target 이 갱신 대상). 명명 컨벤션 위반 없음.

## 요약

target `spec/4-nodes/7-trigger/providers/slack.md` 가 도입하는 식별자는 전부 기존 chat-channel provider 컨벤션을 의도적으로 재사용하거나 Slack 네임스페이스로 분리돼 있어 충돌이 없다. 핵심 공유 식별자(`clemvion_form`·`__open_form__`·`open_form_modal`·`form_submission`·`inboundSigningRef`·`secret://triggers/{id}/inbound-signing`·`rotate-bot-token` endpoint·`ChatChannelTokenRotatorService`·`hashStringToInt`·`assertInboundSigningPlaintextByProvider`·`conversationKey`)는 모두 `spec/conventions/chat-channel-adapter.md` 와 `spec/5-system/15-chat-channel.md` 가 SoT 인 cross-provider 컨벤션이고 Discord/Telegram 이 동일 의미로 이미 사용하므로 Slack 의 재사용은 정합적이다. 요구사항 ID `R-S-1`~`R-S-9` 는 Slack 전용 prefix 로 `R-D-*`/`R-T-*` 와 분리되며, signing 정규식·callback_id·DTO kind 의 provider 별 차이는 backend 분기 책임으로 흡수된다. provider catalog·user_guide mdx·i18n 파일 경로도 기존 명명 컨벤션을 따르고 충돌하지 않는다. 유일한 관찰점은 Slack 외부 API 를 `/api/<method>` 로 표기해 내부 `/api/*` REST 와 prefix 를 공유하는 표기 모호성(INFO)이나 실제 라우트 충돌은 없고 두 기존 provider 문서와 동일한 패턴이다.

## 위험도

NONE

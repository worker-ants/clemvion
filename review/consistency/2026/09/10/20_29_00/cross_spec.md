# Cross-Spec 일관성 검토 — `spec-draft-chat-channel-patch-token.md` (2라운드)

검토 대상: `plan/in-progress/spec-draft-chat-channel-patch-token.md`
검토 모드: `--spec` (draft), 2라운드 — 1라운드(`20_13_39`)의 CRITICAL(`R-CC-17` 충돌)·W1·W2 는 이미
처분됨(필드 경로 유예 / 표 2행 인용 삭제 / `R-CC-21` 채택). 본 라운드는 프롬프트가 지정한 좁은
초점(변경안 C 의 v2 결정 침범 여부, slack/discord 비대칭, secret-store.md·2-trigger-list.md·
3-error-handling.md 와의 충돌)에 한정하고, 그 과정에서 새로 발견한 항목 1건을 추가한다.

## 0. 초점 1 — 변경안 C 가 §5.4.1.1 의 v2 유예 결정을 침범하는가

**결론: 침범하지 않는다.** 소스를 대조했다.

- `spec/5-system/15-chat-channel.md` §5.4.1.1 표의 3행("회전 (rotation)")은 **이미** *"v1
  미정의 — PATCH body 의 `config.chatChannel.inboundSigningPlaintext` / `inboundSigning` 직접
  변경은 400 `VALIDATION_ERROR`... 로 차단"* 이라고 선언 중이다(현재 `origin/main` 문면, 이 draft
  이전부터).
- `spec/2-navigation/2-trigger-list.md` 도 이미 세 곳(§2.3.1 표 119행, §3 API 176행, R-12)에서
  "`inboundSigning`/`inboundSigningPlaintext` 도 PATCH 로 변경 불가" 를 문서화하고 있다.
- 반면 실제 구현 `TriggersService.assertInboundSigningPlaintextByProvider`
  (`triggers.service.ts:642-691`)는 `update()`(`:482`)에서도 `create()`(`:401`)와 동일 로직을
  타서, slack/discord 에 대해 **부재를 400 으로 막고 존재하면 형식 검증만 거쳐 통과**시킨다 —
  이미 선언된 "v1 차단"의 정반대다.
- 변경안 C 는 이 표의 "회전" 행 문면을 구현과 재정합시키는 것이고, v2 후보 목록(A/B/C, 표 아래
  불릿)에는 손대지 않는다. draft 의 자기 진단("v2 회전 설계는 그대로 두고, 이미 선언된 v1 차단을
  구현이 어기는 것을 되돌릴 뿐")은 **정확하다.**

## 초점 2 — slack/discord 비대칭(부재 400 → present 400)이 생성(POST)의 "여전히 필수" 를 깨는지

**spec 문서 차원에서는 깨지지 않는다.** §5.4.1.1 표 1행("최초 트리거 생성")과 2-trigger-list.md
151행("Chat Channel (토글) | ... slack/discord 한정 `inboundSigningPlaintext` 입력")은 변경안 C 가
건드리지 않아 창조 경로의 "필수" 서술이 그대로 남는다.

다만 **구현 레벨 함정 하나**를 짚어 둔다(스펙 문구 자체의 모순은 아니라 INFO): 현재
`assertInboundSigningPlaintextByProvider` 는 `create()`/`update()` 양쪽에서 **동일 코드**로 호출된다
(`assertChatChannelInputSafe` 경유, `:401`·`:482`). D-1/변경안 C 를 문자 그대로 "이 함수에 presence
차단을 추가"로 구현하면 slack/discord 의 **생성(POST)에서도** 존재를 막아 창조 자체가 깨진다. draft
본문은 "이 turn 에서 하지 않는 것 — 구현"으로 이 함수 분기를 명시적으로 다루지 않는데, D-1 문구
("present 면 400")가 **어느 endpoint 의 present 인지**(PATCH 한정)를 서술 시점에 한 번 더
명확히 하거나, 후속 등재 목록에 "생성/수정 경로 검증 함수 분리 필요"를 한 줄 추가하면 developer
턴에서 이 함정을 피하기 쉬워진다. (참고로 이 분리가 이뤄지면 `providers/slack.md:275`·
`discord.md:297`의 "trigger 생성 시점에 정규식 검증"이라는 기존 문구도 — 지금은 update 에도 같은
검증이 걸려 있어 살짝 부정확한데 — 오히려 더 정확해진다. 이건 이 draft 에 유리한 방향의 부수
효과이지 충돌이 아니다.)

## 초점 3 — `secret-store.md` · `2-trigger-list.md` · `3-error-handling.md` 와의 충돌 여부

**충돌 없음.** 확인한 근거:

- `secret-store.md §5.5`(`(a) server-issued` / `(b) provider-issued` 두 경로 예시, `createChatChannelTrigger`)는 **생성(POST) 경로만** 보여주며 D-1/D-2 가 규정하는 PATCH 동작과 겹치지 않는다 — 상충 없음. `secret-store.md §5.1`(Rationale 확인, round 1 기록)도 `botToken` 존재 조건부 `rotate()`를 정본 예시로 이미 보여주고 있어 D-2 의 방향과 정합적이다(재확인, round 1 INFO 유지).
- `2-trigger-list.md` §2.3.1 120행("Chat Channel | botToken")은 지금 **`botTokenRef`(ref) 변경만** 차단 대상으로 적고 있고 `botToken`(값) 자체의 PATCH 차단은 문면에 없다 — 정확히 변경안 A 가 메우려는 그 구멍이다. 119행/176행/R-12 는 `inboundSigning`/`inboundSigningPlaintext` 차단을 이미 갖고 있어 변경안 C 와 정합. 새 결정이 기존 문면과 모순되는 지점은 없다.
- `3-error-handling.md` §1.3 은 `VALIDATION_ERROR`(400 기본값)를 일반 카탈로그로 등재할 뿐 `details` 세부 shape 를 규정하지 않는다 — D-1 이 어떤 `details.field` 표기를 택하든 이 문서와 직접 모순되는 지점이 없다(필드 경로 표기 자체의 정확성은 1라운드 W1 대로 후속 e2e 실측 대기, 본 라운드 재지적 대상 아님).

## 발견사항

### [WARNING] `spec/data-flow/14-chat-channel.md §1.3` 이 D-2 착지 시 즉시 낡는다 — spec_impact·변경안 모두 누락
- **target 위치**: draft의 `spec_impact`(front-matter, `15-chat-channel.md`·`2-trigger-list.md` 두 개뿐) 및 "변경안" A~F 목록 전체 — 이 파일이 어디에도 없다.
- **충돌 대상**: `spec/data-flow/14-chat-channel.md` §1.3 "Bot token 라이프사이클" 표, "최초 setup" 행:
  > `최초 setup | 트리거 create/update 시 setupChatChannel: plaintext (botToken, provider-issued inboundSigningPlaintext) → secret store UPSERT → adapter.setupChannel(...) ... | secret_store rows + UPDATE trigger.config, ...`
  이 문서 Overview 는 스스로 "그 분기 이후의 source→sink 를 **단일 진실**로 둔다"고 선언한다.
- **상세**: D-2 의 결정("PATCH 경로는 비밀을 쓰지 않는다" — `chatChannel` 이 실린 PATCH 전후로
  bot token·inbound signing 값은 동일해야 한다)이 반영되면, 이 data-flow 문서의 "최초 setup" 행이
  기술하는 "트리거 **create/update** 시 ... plaintext → secret store UPSERT" 라는 문장은 **update
  경로에 한해 거짓**이 된다. `15-chat-channel.md`(시스템 spec)와 `data-flow/14-chat-channel.md`
  (데이터 흐름 spec)가 정확히 같은 메커니즘(`setupChatChannel`)에 대해 서로 반대되는 사실을
  선언하는 상태로 남는다 — 둘 다 "SoT" 를 자처하는 문서라 이 모순은 다음 사람이 어느 쪽을 믿을지
  판단해야 하는 부담을 남긴다. `spec/conventions/chat-channel-adapter.md §7`(변경 관리)의 동시
  갱신 의무는 어댑터 *인터페이스* 변경 시 `15-chat-channel.md` + `providers/<name>.md` 만
  지정하므로 이 data-flow 문서는 그 의무 목록에도 걸리지 않는다 — 명시적으로 챙기지 않으면
  빠진다. 참고로 `data-flow/10-triggers.md`(§1.2/§1.5, chatChannel 라우팅 SoT)는 인증·라우팅
  분기만 다뤄 이 결함이 없다 — `14-chat-channel.md §1.3` 한 곳만 해당.
- **제안**: `spec_impact` 에 `spec/data-flow/14-chat-channel.md` 를 추가하고, 변경안에 "G. §1.3
  '최초 setup' 행을 생성(POST)과 PATCH(비밀 미변경, ref 재유도)로 분리 — `15-chat-channel.md
  §5.4.1` 표 구조를 미러"를 신설할 것을 권한다. 최소한 한 줄이라도 "PATCH 경로는 D-2(2026-09-10)
  이후 이 표에서 제외됨" 각주를 붙이지 않으면, `--impl-done` 게이트를 통과한 뒤에도 이 문서만
  구현과 반대 사실을 말하는 상태로 방치된다.

## 요약

프롬프트가 지정한 세 초점 모두 문제를 찾지 못했다 — 변경안 C 는 §5.4.1.1 이 이미 선언한 v1 차단을
구현에 재정합시키는 것일 뿐 v2 후보 결정에는 손대지 않고, slack/discord 비대칭 반전은 스펙 문서
층위에서는 생성(POST)의 "필수" 서술을 건드리지 않으며, `secret-store.md`·`2-trigger-list.md`·
`3-error-handling.md` 어느 것과도 직접 모순이 없다(오히려 `2-trigger-list.md` 의 `botTokenRef`
전용 차단 문구는 변경안 A 가 메우려는 실제 구멍임을 재확인했다). 다만 이번 라운드에서 새로
`spec/data-flow/14-chat-channel.md §1.3` 이 D-2 착지 시 그대로 낡는다는 것을 발견했다 — 이 문서는
"create/update 시 plaintext→secret store UPSERT" 라고 자신을 SoT 로 선언하며 적고 있어, D-2 가
15-chat-channel.md 에만 반영되고 이 문서가 그대로 남으면 두 SoT 문서가 같은 메커니즘에 대해
반대 사실을 말하게 된다. spec_impact·변경안 목록 어디에도 이 파일이 없어 그대로 넘어갈 위험이
있다. 그 외 구현 레벨 함정(검증 함수가 create/update 양쪽에서 공유돼 있어 무분별하게 고치면
생성 경로까지 깨질 수 있음)은 spec 문구 자체의 모순은 아니라 INFO 로만 기록한다.

## 위험도

MEDIUM — 확인된 CRITICAL 은 없다(1라운드 CRITICAL 은 처분 완료, 프롬프트 지정 초점 3개 모두
문제 없음). 새로 찾은 WARNING 1건(`data-flow/14-chat-channel.md` 미동기화)은 그대로 두면 구현
착지 후 SoT 문서 간 직접 모순으로 남는 실질 위험이라 반영을 권한다.

STATUS: success

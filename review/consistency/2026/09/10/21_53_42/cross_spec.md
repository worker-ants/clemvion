# Cross-Spec 일관성 검토 — telegram signing carve-out draft

대상: `plan/in-progress/spec-draft-telegram-signing-carveout.md` (spec_impact: `spec/5-system/15-chat-channel.md`, `spec/data-flow/14-chat-channel.md`)

## 사전 검증 — target 의 사실 전제

target 이 근거로 드는 3층 증거(adapter 코드 · 호출부 코드 · spec 본문)를 직접 열어 대조했다.

- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts:73` — `setupChannel` 이 매 호출마다 `randomBytes(24)` 로 새 `issuedInboundSigning` 을 발급하는 것을 확인 (주석 "매 setupChannel 마다 새 inbound-signing 자료 발급 … 재사용하지 않는다").
- `codebase/backend/src/modules/triggers/triggers.service.ts:987-993` — `if (result.issuedInboundSigning) { await this.secrets.rotate(inboundSigningRef, …) }` 가 조건 없이(모든 provider 공용 `setupChatChannel` 내부에서) 실행됨을 확인. 이 함수는 `create()`(:442)와 `update()`(:539) 양쪽에서 `chatChannel` 키가 있으면 호출된다 — 즉 **일반 `chatChannel` PATCH 도 telegram 의 inboundSigning 을 매번 재발급·재저장한다**는 target 의 전제는 코드로 확인된다.
- `spec/5-system/15-chat-channel.md` §5.4.1.1(라인 384-407)·R-CC-21(라인 734-780), `spec/data-flow/14-chat-channel.md` §1.3 라인 151 — target 인용대로 "PATCH 는 어떤 비밀도 쓰지 않는다"(R-CC-21) / "secret store 에 쓰지 않는다 — bot token·inbound signing 값은 요청 전후로 동일하다"(data-flow §1.3) 를 확인. 두 문장 모두 provider 구분 없이 서술되어 telegram 의 실제 동작과 직접 모순된다.

즉 target 의 핵심 진단("R-CC-21 의 blanket 서술이 telegram 에서 거짓")은 사실이며, carve-out 자체의 필요성과 D-A/D-B/D-C 의 논리("PATCH body 로 비밀이 유입되는가"라는 R-CC-21 의 원래 축과, telegram 의 "provider 와 합의해 서버가 발급" 축이 직교한다는 구분)는 R-CC-10/R-CC-21/§5.4.1.1 의 기존 결정과 상충하지 않는다. 문제는 **적용 범위(변경안 A~E)가 실제 blast radius 를 다 덮지 못한다**는 데 있다.

## 발견사항

- **[CRITICAL] `spec/2-navigation/2-trigger-list.md` §3 의 동일 blanket 문장이 변경안에서 누락됨**
  - target 위치: `## 변경안` 표 (A~E) 및 frontmatter `spec_impact` (`spec/5-system/15-chat-channel.md`, `spec/data-flow/14-chat-channel.md` 두 파일만 등재)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` §3 API, PATCH 본문 설명 문단 — "**`chatChannel` 이 실린 PATCH 는 저장된 비밀을 바꾸지 않는다** — bot token·inbound signing 값은 요청 전후로 동일하고 … 상세 [Chat Channel R-CC-21](../5-system/15-chat-channel.md#r-cc-21-patch-는-비밀을-쓰지-않는다--차단이-필드명-층에만-걸려-있었다)."
  - 상세: 이 문장은 target 이 거짓이라고 지목한 것과 **글자 그대로 동일한 blanket 주장**("bot token·inbound signing 값은 요청 전후로 동일")을 담고 있고, R-CC-21 anchor 로 직접 cross-link 돼 있다. target 의 변경안 A(15-chat-channel §5.4.1)·B(R-CC-21)·C(data-flow §1.3) 는 `5-system/`·`data-flow/` 두 영역만 고치므로, 적용 후에도 `2-navigation/2-trigger-list.md` 는 **옛 blanket 문장을 그대로 유지**한다. 결과적으로 "PATCH 가 telegram inboundSigning 을 쓰는가"라는 같은 질문에 대해 `5-system/15-chat-channel.md`(now: 두 축 한정, telegram 예외)와 `2-navigation/2-trigger-list.md`(여전히: provider 무관 무조건 미변경)가 서로 다른 답을 하게 된다. 이 파일은 API 계약을 소비하는 프론트/트리거 개발자가 실제로 참조하는 문서이므로, 방치 시 "PATCH 로 telegram 서명을 안전하게 편집할 수 있다"는 원래의 (틀린) 인식이 이 진입점을 통해 그대로 남는다. `spec_impact` 자체가 이 파일을 빠뜨린 것도 같은 결함의 증상이다.
  - 제안: 변경안에 **F: `2-navigation/2-trigger-list.md` §3 의 위 문장에 telegram carve-out cross-link 추가**(`spec_impact` 에도 파일 추가)를 신설. R-CC-21 anchor 텍스트가 바뀌지 않는 한 링크 자체는 안 깨지지만, 인접 산문("bot token·inbound signing 값은 요청 전후로 동일")은 D-A 결정과 직접 모순이므로 A/B 와 같은 타이밍에 고쳐야 한다.

- **[WARNING] 변경안 A 의 배치 위치가 bot-token 전용 섹션 — inboundSigning 서술의 SoT 가 두 곳으로 쪼개질 위험**
  - target 위치: `## 변경안` 표 A행 — "`15-chat-channel.md` §5.4.1 「`chatChannel` 이 실린 PATCH」 행 … 뒤에 telegram carve-out 한 문장 추가"
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4.1(라인 367-382, "Bot Token 변경 single-path 정책" — 표 자체는 bot token 만 다룸) vs §5.4.1.1(라인 384-407, "`inboundSigning` PATCH 정책 (slack / discord 한정 — v1 차단)" — inboundSigning 전용 섹션)
  - 상세: §5.4.1 의 "`chatChannel` 이 실린 PATCH" 행(라인 376)은 **bot token 에 대해서만** "바뀌지 않는다"고 말하며 이 진술 자체는 telegram 포함 3개 provider 모두에 여전히 참이다(telegram 도 chatChannel PATCH 로 bot token 이 바뀌지 않음 — 바뀌는 것은 inboundSigning 뿐). telegram carve-out 이 실제로 다루는 자원은 inboundSigning 이고, 그 전용 SoT 는 제목부터 "slack / discord 한정"이라고 스코프를 건 §5.4.1.1 이다. A 안대로 §5.4.1(bot-token 표)에 inboundSigning carve-out 문장을 끼워 넣으면, inboundSigning 의 provider 별 동작 서술이 §5.4.1.1(slack/discord 한정 표)과 §5.4.1(끼워넣은 telegram 문장) 두 곳에 흩어져 **단일 진실 원칙**이 흔들린다. §5.4.1.1 자체를 "provider 공통 inboundSigning 정책"으로 확장하거나(제목의 "slack/discord 한정" 갱신 포함), telegram 몫을 별도 소절(예: §5.4.1.2)로 분리하는 편이 이후 R-CC-21 carve-out 소절(B)과 하나의 앵커 아래 묶이기도 쉽다.
  - 제안: 실제 spec 반영 시 telegram inboundSigning 회전 서술의 정본 위치를 §5.4.1.1(제목 갱신 포함) 또는 신설 §5.4.1.2 로 확정하고, §5.4.1 에는 "bot token 은 변하지 않는다"는 기존 진술만 유지 (필요하면 §5.4.1.1 로의 forward-link 한 줄만 추가).

- **[INFO] R-CC-21 제목과 좁혀진 본문 스코프의 불일치**
  - target 위치: `## 변경안` B행 — "PATCH 는 어떤 비밀도 받지 않고, 어떤 비밀도 쓰지 않는다" 를 두 축 한정으로 명시
  - 충돌 대상: `spec/5-system/15-chat-channel.md` R-CC-21 제목 "### R-CC-21. PATCH 는 비밀을 쓰지 않는다 — 차단이 필드명 층에만 걸려 있었다" (라인 734)
  - 상세: 본문을 "bot token 축 + slack/discord inboundSigning 축" 두 축 한정으로 좁히면서 제목은 그대로 "PATCH 는 비밀을 쓰지 않는다"로 남기면, 제목만 읽는 독자(다른 spec 에서 anchor 링크만 타고 들어오는 경우 — 실제로 `2-trigger-list.md:176` 과 `data-flow/14-chat-channel.md:151` 이 이렇게 인용한다)에게는 여전히 blanket 규칙으로 읽힐 여지가 있다. anchor slug 는 헤더 텍스트에서 파생되므로 제목을 바꾸면 두 파일의 앵커 링크가 깨진다는 점도 함께 고려해야 한다(제목 유지 + 본문 상단에 "단, telegram 의 server-issued 축은 예외" caveat 한 줄을 굵게 앞세우는 절충 권장).
  - 제안: 제목은 유지하되 R-CC-21 본문 첫 문단 또는 "재검토 신호" 앞에 두 축 한정 caveat 를 눈에 띄게 배치. anchor 를 참조하는 3개 파일(15-chat-channel.md 자기 자신 2곳, data-flow 1곳, trigger-list 1곳) 목록을 커밋 시 함께 확인.

## 요약

target 의 핵심 사실 관계(telegram 의 `issuedInboundSigning` 이 모든 `chatChannel` PATCH 에서 무조건 재발급·재저장되고, 이는 R-CC-21/§5.4.1.1/data-flow §1.3 의 provider-무관 blanket 서술과 코드 차원에서 직접 모순된다는 것)는 adapter 코드·서비스 코드·spec 본문 3층 모두에서 확인됐고, carve-out의 논리(D-A/D-B/D-C)도 R-CC-10/R-CC-21의 기존 결정을 번복하지 않는다. 다만 변경안(A~E)과 `spec_impact` 가 `5-system/`·`data-flow/` 두 영역만 포함하고 있어, 정확히 같은 blanket 문장을 담고 있는 `spec/2-navigation/2-trigger-list.md` §3 이 수정 대상에서 빠졌다 — 이 draft 를 그대로 적용하면 세 영역 중 하나(trigger-list)만 옛 주장을 유지한 채 나머지 둘과 어긋나는, target 이 애초에 고치려던 것과 같은 종류의 모순이 다시 생긴다. 부수적으로 A안의 배치 위치(bot-token 전용 §5.4.1)가 inboundSigning 전용 SoT(§5.4.1.1)와 서술을 분산시킬 위험이 있어 실제 반영 시 위치 조정이 필요하다.

## 위험도

HIGH — CRITICAL 발견 1건(적용 범위 누락으로 인한 3파일 간 직접 모순 재발)이 실제 spec 반영 전 반드시 해소돼야 한다. 근본 진단과 결정 자체는 유효하므로 BLOCK 후 변경안에 F(trigger-list.md 동시 갱신) 를 추가하면 해소 가능한 수준.

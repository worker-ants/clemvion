# 신규 식별자 충돌 검토 — spec-draft-telegram-signing-carveout

## 검토 방법

target 은 새 요구사항 ID·DTO·엔드포인트·이벤트·ENV 를 **신설하지 않는다** — PR #1311(`df1962e25`)이
어제 남긴 "PATCH 는 비밀을 쓰지 않는다" 블랑켓 서술을 telegram(server-issued) 축에 한해 **좁히는**
정정 턴이다(변경안 A~H 전부 기존 자리 narrowing/anchor 갱신). 따라서 점검은 (1) 변경안이 실제로
*신규* 식별자를 만드는 지점이 있는지 확인하고, (2) 있다면 기존 사용처와 대조하는 순서로 진행했다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

### 확인한 항목 (충돌 없음, 근거만 기록)

- **§5.4.1.1 telegram 신규 표 행 (변경안 A③)** — `server-issued`/`provider-issued` 어휘는 이미
  `spec/conventions/secret-store.md:34,353,356,370`, `spec/conventions/chat-channel-adapter.md:289,352,358`,
  `spec/2-navigation/2-trigger-list.md:119,337,339`, `spec/5-system/15-chat-channel.md:201,203,243,386`
  가 telegram=server-issued / slack·discord=provider-issued 로 **동일한 의미로** 이미 사용 중이다.
  target 이 추가하는 telegram 행은 이 기존 어휘를 재사용할 뿐 새 용어를 도입하지 않는다 — 충돌 없음,
  오히려 draft 자신이 D-C 절에서 주장하는 "경계는 이미 그어져 있었다" 를 뒷받침한다.
- **§5.4.1.1 제목 앵커 변경 (변경안 A④)** — 제목이 `(slack / discord 한정 — v1 차단)` 에서 세
  provider 를 덮도록 바뀌면 GitHub 스타일 앵커 `#5411-inboundsigning-patch-정책-slack--discord-한정--v1-차단`
  도 바뀐다. 이 앵커를 인용하는 자리는 저장소 전체에서 정확히 **2곳**
  (`spec/5-system/15-chat-channel.md:380`, `:747`) — target 이 이미 "④ 앵커가 바뀌므로 인용 2곳을
  동시 갱신" 이라 적은 것과 실측이 일치한다. 누락된 제3의 인용처 없음.
- **Rationale ID 재사용** — `R-CC-21`(`15-chat-channel.md:734`), `R-CC-10`(`:612`),
  `CCH-AD-02`(`:54`), `R-12`(`2-trigger-list.md:333`) 는 전부 target 이 새로 부여하는 번호가
  아니라 기존 번호를 그대로 인용·좁히는 것이다. 저장소 전체 grep 으로 각 ID 가 다른 의미로
  이중 사용되는 자리 없음을 확인했다.
- **`ChatChannelUpdateConfigDto` (§"이 턴에 하지 않는 것")** — target 이 이번 spec 턴에서
  **채택하지 않고 구현 턴으로 명시적으로 미루는** 이름이다. 저장소 전체(`codebase/`, `spec/`)에
  이 식별자 사용 0건 — 충돌 없음. 기존 `Update<Entity>Dto` 접두 컨벤션(`update-trigger.dto.ts`
  `UpdateTriggerDto` 외 backend 전역 9+ 예)과도 결이 맞는다. 참고로 현재 존재하는 것은
  `ChatChannelConfigDto`(`chat-channel-config.dto.ts:162`, create/update 겸용) 뿐이며 `Patch` 접두
  클래스는 저장소에 0건이라는 target 의 주장과 일치한다.
- **plan 파일 경로** — `plan/in-progress/spec-draft-telegram-signing-carveout.md` 는
  `plan/complete/spec-edit-carveout.md`, `plan/complete/spec-sync-telegram-gaps.md` 와 이름이
  겹치지 않고 `spec-draft-<topic>.md` 컨벤션을 따른다. 신규 파일이 아니라(이미 존재) 경로 신설
  충돌도 해당 없음.
- **거부된 대안 속 미래 엔드포인트** — "기각한 대안" 표의 `POST .../rotate-inbound-signing` 은
  `15-chat-channel.md:403` 이 이미 v2 후보 (A) 로 적어 둔 이름과 같은 문자열이며, target 은 이를
  **채택이 아니라 기각**한다고 재확인할 뿐이다. 새 엔드포인트를 만들지 않으므로 API endpoint
  충돌 검토 대상이 아니다.

## 요약

target 은 신규 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV 변수·설정 키·파일 경로를
전혀 신설하지 않는다 — 어제 커밋이 넓혀 놓은 다섯 곳의 blanket 서술("PATCH 는 비밀을 쓰지 않는다")을
telegram(server-issued) 축에 한해 좁히고, 그 좁히기에 쓰는 어휘(`server-issued`/`provider-issued`,
`R-CC-21`/`R-CC-10`/`CCH-AD-02`/`R-12`)는 모두 기존 정본 문서에서 동일한 의미로 이미 쓰이고 있던
것을 재사용한다. 유일하게 새 식별자 후보로 언급된 `ChatChannelUpdateConfigDto` 는 이번 spec 턴의
결정 사안이 아니라고 명시적으로 선을 그었고, 저장소 검색상으로도 충돌이 없으며 기존 `Update<Entity>Dto`
컨벤션과 부합한다. §5.4.1.1 제목 변경에 따른 앵커 drift 도 target 이 스스로 인지하고 갱신 대상
2곳을 정확히 짚었음을 실측으로 확인했다. 신규 식별자 충돌 관점에서 이 target 은 위험이 없다.

## 위험도

NONE

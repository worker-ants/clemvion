# 신규 식별자 충돌 검토 — spec-draft-telegram-signing-carveout (4R)

## 검토 방법

target(`plan/in-progress/spec-draft-telegram-signing-carveout.md`)은 1R(`21_53_42`)·2R(`22_04_23`)·
3R(`22_14_27`)을 거치며 변경안이 A~E(5건) → A~G(7건) → A~H(8건) → **A1~A14 + B1~B2 + C1~C2(18건,
"자리 단위" 재열거)** 로 세분화됐다. 세 선행 라운드 모두 이 관점에서 위험도 **NONE** 을 냈으므로,
이번 라운드는 (1) 세분화가 실제로 *새* 식별자를 만드는 자리를 늘렸는지, (2) A1~A14 각 자리의
실제 소스 라인이 draft 의 인용과 일치하는지를 직접 열어 재확인했다.

확인한 실제 라인 (모두 draft 인용과 **정확히 일치**):

| draft 항목 | 인용 위치 | 실측 |
|---|---|---|
| A9 | `15-chat-channel.md:614` | `R-CC-10` 각주 — *"저장된 비밀을 아예 쓰지 않는다"* 확인 |
| A11 | `15-chat-channel.md:750` | *"어떤 비밀**도** 받지 않고, 어떤 비밀**도** 쓰지 않는다"* 확인 |
| A12 | `15-chat-channel.md:761` | *"D-2(경로가 비밀을 쓰지 않는다)"* 확인 |
| A13 | `15-chat-channel.md:767` | `#### 기각한 대안` 기존 소절(2행) 확인 — 새 H4 미신설 지시와 일치 |
| A14 | `15-chat-channel.md:776-778` | *"signing 축만 그 결정으로 대체된다"* 2분법 확인 |
| B1 | `2-navigation/2-trigger-list.md:176` | *"bot token·inbound signing 값은 요청 전후로 동일하고"* 확인 |
| B2 | `data-flow/14-chat-channel.md:151` | *"secret store 에 쓰지 않는다 … 값은 요청 전후로 동일하다"* 확인 |
| C1 | `spec-draft-nullable-notation-followups.md:1957` 부근 | D-1/D-2/D-3 요약 확인 |

모든 인용이 정확해 "자리를 놓쳤다"는 재발 패턴(1R~3R의 결함)이 이번 세분화에서는 발생하지 않았다.

## 관점별 확인

### 1. 요구사항 ID 충돌 — 해당 없음

A1~A14 어느 항목도 새 `R-CC-N`/`CCH-*` ID 를 발급하지 않는다. 전부 기존 ID(`R-CC-10`,
`R-CC-21`, `CCH-AD-02`, `R-12`)를 인용하거나 그 산문 서술 폭을 좁힌다. `D-A`/`D-B`/`D-B'`/`D-C`
결정 라벨도 이번에 `D-B'` 가 새로 추가됐지만, 이는 `D-B` 의 반론-대응 하위 변형(prime 표기)이라
독립 ID 를 신설하는 것이 아니고, 선행 체인의 `D-1`/`D-2`/`D-3`(다른 plan 문서에서 이미 확정)과도
문자 체계(`D-A…` vs `D-1…`)가 달라 겹치지 않는다 — 2R 이 이미 grep 0건으로 확인한 사실이 그대로
유지된다.

### 2. 엔티티/타입명 충돌 — 해당 없음 (self-resolved)

`ChatChannelPatchConfigDto`/`ChatChannelUpdateConfigDto` 는 draft 가 "이 턴에 하지 않는 것"으로
명시 보류하며, 저장소 전수 검색(`grep -rn` on `spec/`, `codebase/`, `plan/`) 결과 두 이름 모두
target 문서 자신 외 사용처 0건. `Update<Entity>Dto` 컨벤션과도 정합.

### 3. API endpoint 충돌 — 해당 없음

target 은 method+path 조합을 신설하지 않는다. "기각한 대안" 표의
`POST /api/triggers/:id/chat-channel/rotate-inbound-signing` 은 `15-chat-channel.md:403` 의 기존
v2 후보 (A) 를 재인용해 **기각**할 뿐이다.

### 4. 이벤트/메시지명 충돌 — 해당 없음

webhook·queue·SSE 이벤트명 신설 없음.

### 5. 환경변수·설정키 충돌 — 해당 없음

`issuedInboundSigning`(코드/스펙 양쪽에 이미 광범위하게 존재 — `telegram.adapter.ts:73,94`,
`triggers.service.ts:987~`, `secret-store.md:360-380`, `chat-channel-adapter.md:347,361,524`,
`telegram.md:58,219`, `slack.md:278,321`, `discord.md:300`, `data-flow/14-chat-channel.md:150-152`),
`inboundSigningRef`/`inboundSigningPlaintext`/`botTokenRef` 모두 §4.1 데이터 모델(`15-chat-channel.md:194-207`)
기존 필드. A8(§5.4.1.1 표의 telegram 행 신설)도 새 필드를 만드는 것이 아니라 기존 필드
(`issuedInboundSigning`, `setupChannel()`)로 새 표 **행**을 채우는 것 — 신규 설정 키 아님.

### 6. 파일 경로 충돌 — 해당 없음

- target 자신의 경로 `plan/in-progress/spec-draft-telegram-signing-carveout.md` 는 `spec-draft-*`
  컨벤션과 일치 (1R~3R 재확인).
- 신규 spec 파일 없음 — 기존 3파일(`15-chat-channel.md`/`2-trigger-list.md`/`data-flow/14-chat-channel.md`)
  + plan 문서 1곳(`spec-draft-nullable-notation-followups.md`) 본문만 수정.
- 체크리스트가 언급하는 `impl-chat-channel-patch-token.md` 는 저장소에 **아직 존재하지 않는다**
  (`find plan -iname "impl-*.md"` 결과 `impl-user-msg-early-surface.md` 등 3건뿐, 해당 파일명은
  없음). 다만 `impl-*.md` 는 이미 확립된 구현-plan 명명 컨벤션이므로, 이 언급은 **향후 developer
  턴에서 만들 파일에 대한 전방 참조**로 읽힌다 — 지금 존재하는 어떤 파일과도 이름이 겹치지 않고
  컨벤션도 어기지 않는다. 다른 plan 산출물(`spec-draft-chat-channel-patch-token.md`)이 이미
  `started:` 를 올바르게 쓰고 있어 "같은 결함" 이라는 서술의 대상이 **아직 만들어지지 않은
  파일**임도 일관된다. 신규 식별자 충돌 범주에는 해당하지 않는다 (참고용 관찰, 비차단).

## 요약

세 선행 라운드(1R/2R/3R)에서 이미 위험도 NONE 으로 판정된 target 이 이번 라운드에서 변경안을
"자리 단위" 로 5→7→8→18건으로 세분화했지만, 세분화된 A1~A14·B1~B2·C1~C2 전 항목을 실제 소스
라인(614/750/761/767/776-778/176/151/1957 등)과 대조한 결과 모두 **기존에 이미 존재하는 식별자·
필드·ID·엔드포인트 후보를 재인용해 그 서술 범위를 telegram 축 한정으로 좁히는 것**이며, 신규
요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 중 어느 것도 새로
발급하지 않는다. `D-B'` 라벨 추가와 §5.4.1.1 telegram 행 신설(A8)도 기존 어휘·필드의 재사용일
뿐 새 식별자가 아니다. 체크리스트가 언급하는 `impl-chat-channel-patch-token.md` 는 아직 만들어지지
않은 파일에 대한 전방 참조이며 확립된 `impl-*.md` 컨벤션과 부합해 충돌 소지가 없다. 신규 식별자
충돌 관점에서 이 target 은 4개 라운드 연속으로 위험이 없다.

## 위험도

NONE

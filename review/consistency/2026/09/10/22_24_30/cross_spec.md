# Cross-Spec 일관성 검토 — `spec-draft-telegram-signing-carveout.md`

## 검토 범위와 방법

target 은 `spec/5-system/15-chat-channel.md` (R-CC-21 · §5.4.1 · §5.4.1.1 · CCH-AD-02) ·
`spec/2-navigation/2-trigger-list.md:176` · `spec/data-flow/14-chat-channel.md:151` 세 정본 문서에
"PATCH 는 비밀을 쓰지 않는다" 라는 **blanket 문장**을 telegram server-issued 축 한정으로 좁히는
14+2+2 개 자리 단위 편집안이다. 번들이 예산 초과로 두 핵심 대상 파일(`15-chat-channel.md` ·
`data-flow/14-chat-channel.md`) 본문을 절단했으므로, 디스크에서 두 파일 전문 + `2-trigger-list.md`
관련 절 + `conventions/secret-store.md` §5.5 + `conventions/chat-channel-adapter.md` §1.1/§2.4 +
`providers/{telegram,slack,discord}.md` + `1-data-model.md` §2.8 + `conventions/audit-actions.md` +
`5-system/1-auth.md` §4.1 + `5-system/2-api-convention.md` 를 직접 열어 대조했다. 또한 실측 주장
검증을 위해 `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` 와
`codebase/backend/src/modules/triggers/triggers.service.ts` (현재 워크트리 + 형제 워크트리
`impl-chat-channel-patch-token-a17c4e` 양쪽)를 열었다.

## 발견사항

- **[WARNING]** 병렬 구현 턴(`impl-chat-channel-patch-token-a17c4e`)의 write-gate 설계가 telegram
  축을 명시적으로 배제하지 않는다 — 이 draft 의 D-A 결정이 코드에 도달할 보장이 약하다
  - target 위치: `## 결정` D-A (telegram `issuedInboundSigning` 은 `setupChannel()` 재호출의
    부수효과로 계속 갱신·저장된다) · 체크리스트 항목 *"`impl-chat-channel-patch-token.md` 의
    frontmatter 도 `created:` → `started:` (같은 결함)"*
  - 충돌 대상: `.claude/worktrees/impl-chat-channel-patch-token-a17c4e/plan/in-progress/impl-chat-channel-patch-token.md`
    (`df1962e25` 에서 이 target 과 같은 시각에 분기한 **별개 워크트리·별개 브랜치**, 아직 main 에
    머지 안 됨)의 `## 설계` D-2
  - 상세: 그 impl 문서의 D-2 는 *"`setupChatChannel` 에 비밀 쓰기 여부를 **인자로** 받는다. PATCH
    경로는 bot token rotate 와 provider-issued signing 저장을 **둘 다 건너뛴다**"* 라고만 적는다 —
    스킵 대상을 **두 축**(botToken rotate, provider-issued `inboundSigningPlaintext` 저장)으로만
    열거하고, `triggers.service.ts:987` 의 **세 번째 쓰기 지점**(`result.issuedInboundSigning` →
    `secrets.rotate`, telegram server-issued 축)은 언급하지 않는다. 그 impl 문서 자신도 *"발견한
    경계"* 절에서 이 gap 을 정확히 짚고 *"이 턴에서 고치지 않는다 — planner 턴으로 분리한다"* 고
    스스로 위임했다(체크리스트 마지막 항목: *"R-CC-21 산문 폭 정정을 planner 후속으로 등재"*). 즉
    이 draft(target)가 바로 그 위임을 받는 문서인데, target 의 실행 항목(A1~A14/B1~B2/C1~C2)은
    전부 **spec 산문 자리**만 다루고, 정작 그 impl 문서의 D-2 설계 문장 자체를 갱신하거나
    cross-link 로 명시 확인하는 항목이 없다. `setupChatChannel` 이 create/update 공유 함수이고
    (`triggers.service.ts:915,442,539` — 두 워크트리 동일 구조 확인), "비밀 쓰기 여부 boolean 인자"
    하나로 두 스킵 대상을 함께 게이팅하는 자연스러운 구현이라면, 같은 함수 안의 세 번째 쓰기
    지점(`result.issuedInboundSigning`)도 **같은 인자로 우발적으로 함께 게이팅될 위험**이 있다 —
    그러면 이 draft 가 막으려는 정확히 그 401 시나리오(telegram 신규 secret_token 은 등록되는데
    DB 는 옛 값)가 코드 차원에서 재현된다. 두 워크트리 모두 `구현` 체크박스가 아직 미완료라
    (`impl-chat-channel-patch-token-a17c4e/.../triggers.service.ts` 는 현재 target 워크트리와
    바이트 단위로 동일한 미수정 코드) 실측상 아직 사고는 나지 않았지만, **spec 갱신과 impl 완료의
    순서·연결 고리가 이 문서 안에 명시돼 있지 않다.**
  - 제안: 이 draft 의 체크리스트에 *"`impl-chat-channel-patch-token.md` D-2 의 write-gate 가
    `result.issuedInboundSigning` 경로(3번째 쓰기 지점)를 게이팅하지 않음을 구현 착수 전 확인"*
    항목을 명시적으로 추가하거나, 그 impl 문서의 D-2 문장 자체에 *"단, telegram 의
    `issuedInboundSigning` 재저장은 게이팅하지 않는다(SoT: telegram-signing-carveout D-A)"* 캐비아트를
    동반 추가한다. `impl-chat-channel-patch-token.md` 의 frontmatter 오탈자만 고치는 현재 범위로는
    이 연결이 문서 사이에서 암묵적으로만 존재한다.

## 검증되어 충돌 없음으로 확인된 항목 (참고)

- A1~A14/B1/B2 가 겨냥하는 blanket 문구(`R-CC-21`, §5.4.1 `:380`, data-flow `:151`,
  `2-trigger-list.md:176`)는 전수 grep(`저장된.*비밀`, `비밀.*쓰지`, `값이 바뀌는가`, `어떤 비밀`)
  결과 **정확히 그 3개 파일에만** 존재한다 — 5번째 은닉 자리 없음.
- `conventions/secret-store.md §5.5` · `conventions/chat-channel-adapter.md §2.4 SetupResult` 는
  이미 telegram(server-issued) vs slack/discord(provider-issued) 축을 어휘 그대로 구분해 두고
  있어, D-A/D-B 결정과 정합하고 컨벤션 문서 갱신 불요 판단이 실측과 맞는다.
- §5.4.1.1 제목·본문 앵커(`#5411-...`)를 외부에서 인용하는 파일은 없다(`2-trigger-list.md` ·
  `data-flow/14-chat-channel.md` · `providers/*.md` 전수 확인) — A5 의 제목 변경이 깨뜨릴 외부
  cross-link는 없고, target 이 스스로 지목한 내부 앵커 2곳(`:380`·`:747`) 동반 갱신 요구만 유효하다.
- A2/A6 이 "미확정, 캐비아트만" 으로 남기는 §5.4.1/§5.4.1.1 의 "트리거 활성화(`isActive:true`)
  PATCH" 행은 실측상 현재 코드(`triggers.service.ts:537-539`, `if (chatChannel) { ... }`)와도
  어긋난다 — `chatChannel` 키가 없는 순수 `{isActive:true}` PATCH 는 `setupChatChannel()`/
  `adapter.setupChannel()` 을 아예 호출하지 않는다. 이는 target 이 정확히 지목한 "자매 트래커의
  미해소 질문"(`plan/in-progress/spec-draft-nullable-notation-followups.md:2031-2036`, 이미 별도
  항목으로 등재됨)과 일치하므로 이 draft 가 지금 손대지 않는 판단은 타당하다.
- `chatChannelRotatedAt`/`chat_channel_token_v2` (grace 컬럼, `1-data-model.md:256`)는 bot token
  rotation 전용으로 명시돼 있어 telegram inbound-signing 축과 컬럼을 공유하지 않는다 — D-A 채택이
  이 컬럼의 의미를 침범하지 않는다.
- audit action 목록(`conventions/audit-actions.md`, `5-system/1-auth.md §4.1`)에 inbound-signing
  전용 액션이 없다는 D-B (c) 의 전제는 실측과 맞는다(신설 항목 없음, 우회 대상 자체 부재).

## 요약

target 이 제안하는 자리 단위 spec 편집(A1~A14·B1~B2·C1~C2)은 세 정본 문서·컨벤션 2종·provider
spec 3종·데이터 모델·감사 액션 목록을 직접 대조한 결과 **자기 완결적으로 정합**하며, 놓친 5번째
문서나 깨지는 외부 앵커도 발견되지 않았다. 다만 이 draft 의 존재 이유 자체가 *"병렬로 진행 중인
구현 턴(`impl-chat-channel-patch-token-a17c4e`)이 planner 에게 위임한 경계 질문에 답하는 것"*
인데, 정작 그 구현 턴의 D-2 write-gate 설계 문장으로 결론이 명시적으로 되먹임되지 않는다 —
"비밀 쓰기 여부" 단일 boolean 인자가 telegram 의 세 번째 쓰기 지점까지 우발적으로 게이팅할
위험을 이 문서가 닫지 않은 채 남긴다. spec 텍스트만 고치고 코드 구현이 그 경계를 놓치면, 이
draft 가 경고하는 401 전면 장애가 그대로 재현된다.

## 위험도

MEDIUM — spec-vs-spec 직접 모순은 없으나, 이 draft 의 목적을 무효화할 수 있는 cross-plan(구현
턴) 연결 고리 미비가 실측상 확인된 미해결 위험으로 남아 있다.

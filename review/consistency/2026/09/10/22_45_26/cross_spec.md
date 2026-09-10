# Cross-Spec 일관성 검토 — `spec/5-system` (chat-channel PATCH secret-write 게이팅, impl-prep)

## 검토 범위와 방법

target 은 `spec/5-system/15-chat-channel.md` (특히 §4.1 · §5.4.1 · §5.4.1.1 · R-CC-10 · R-CC-21 —
`chatChannel` PATCH 가 bot token / inbound signing 비밀을 쓰지 않도록 게이팅하는 정책, developer 의
`impl-chat-channel-patch-token` 착수 전 impl-prep 검토)다. 번들이 예산 초과로 관련 영역(2-navigation,
1-data-model, conventions, providers/*, data-flow)을 절단했으므로, 디스크에서 다음을 직접 열어
대조했다: `spec/2-navigation/2-trigger-list.md`(PATCH 계약·Chat Channel 카드), `spec/1-data-model.md`
§2.8 Trigger, `spec/conventions/secret-store.md`(전문), `spec/conventions/chat-channel-adapter.md`(전문),
`spec/conventions/audit-actions.md`, `spec/5-system/1-auth.md` §4.1, `spec/5-system/2-api-convention.md`
(RPC-style 예외), `spec/conventions/error-codes.md`(rename 이력), `spec/data-flow/14-chat-channel.md`,
`spec/4-nodes/7-trigger/providers/{telegram,slack,discord}.md`. 또한 이 target 이 오늘 이미 두 차례
(`review/consistency/2026/09/10/22_04_23`, `22_14_27`) 유사 관점으로 검토받은 이력이 있어, 그 산출물과
developer plan(`plan/in-progress/impl-chat-channel-patch-token.md`)을 대조해 이미 닫힌 항목의 재-flag
을 피했다.

## 발견사항

- **[WARNING]** `SecretResolver.store()` vs `.rotate()` — chat-channel 비밀 저장 API 호출을 가리키는
  용어가 4개 spec 파일에 걸쳐 canonical 인터페이스 계약과 반대로 적혀 있다
  - target 위치: `spec/5-system/15-chat-channel.md:200`(`botToken` JSONC 주석 — *"service 가
    SecretResolver.store 로 옮긴 뒤 strip"*), `:201`(`inboundSigningPlaintext` 주석 — *"service 가
    SecretResolver.store(inboundSigningRef, plaintext) → strip"*), `:373`(§5.4.1 표 1행 —
    *"SecretResolver.store() 로 저장 후 ref 로 교체"*), `:390`(§5.4.1.1 표 1행 — *"SecretResolver.store
    (inboundSigningRef, plaintext) 후 strip"*)
  - 충돌 대상: (1) `spec/conventions/secret-store.md` §2.1 — *"Trigger 생성(notification/chatChannel
    설정 포함) → `rotate(ref, workspaceId, plaintext)` **권장** — UPSERT 멱등성으로 setup 재시도
    안전(§5.5 예시 + `triggers.service.ts.setupChatChannel` 구현체 **모두 `rotate()` 사용**)"*, §2
    인터페이스 정의 — *"`store`: 이미 존재하면 **throw**(대신 rotate 사용)"* vs *"`rotate`: UPSERT
    의미"*, §5.4/§5.5 예시 코드(`this.secrets.rotate(ref, workspaceId, dto.chatChannel.botToken)`,
    `this.secrets.rotate(ref, workspaceId, result.issuedInboundSigning)`,
    `this.secrets.rotate(ref, workspaceId, dto.chatChannel.inboundSigningPlaintext)` — 셋 다
    `rotate`, `store` 아님). (2) target 자기 자신의 R-CC-21 (`15-chat-channel.md:764`) — 같은
    `setupChatChannel` 함수의 bot-token 쓰기를 실측하며 *"`secrets.rotate(botTokenRef, ws, cfg.botToken
    ?? '')` 를 **조건 없이** 실행"* 이라 적어 `.rotate()` 를 실제 호출 메서드로 확정한다. (3)
    `spec/conventions/chat-channel-adapter.md:354,359`(`SetupResult.issuedInboundSigning` JSDoc)와
    `spec/4-nodes/7-trigger/providers/telegram.md:58,219`, `spec/4-nodes/7-trigger/providers/slack.md:278`
    도 같은 `SecretResolver.store(...)` 표기를 반복해 총 4개 파일 9곳이 동일 오기를 공유한다.
  - 상세: `secret-store.md` 의 `SecretResolver` 인터페이스는 `store`/`rotate` 를 **의미가 다른 별개
    메서드**로 정의한다 — `store` 는 *"이미 존재하면 throw"*, `rotate` 는 *"UPSERT"*. `chatChannel`
    의 `setupChannel()` 은 CCH-AD-02 에 의해 **생성·활성화·`chatChannel` 이 실린 PATCH 세 갈래 모두에서
    반복 호출**되는 멱등 함수이고, telegram 의 `issuedInboundSigning` 은 §5.4.1.1 이 스스로
    *"`setupChannel()` 재호출마다 재발급·재저장"* 이라 명시한다 — 즉 이 코드경로는 **한 트리거 생애주기
    안에서 여러 번** 같은 ref 에 쓴다. 만약 실제 구현이 (5개 spec 파일이 반복 서술하는 대로) 문자
    그대로 `store()` 를 호출한다면, 두 번째 이후의 `setupChannel()` 재호출(활성화 PATCH·
    `chatChannel` PATCH·telegram 의 매 재등록)에서 `store()` 가 **throw** 해 setup 이 깨져야 한다.
    그런데 target 의 R-CC-21 은 정반대로 "무조건 `rotate()` 를 호출하고, 그 `rotate()` 에 빈 값 가드가
    없어 **빈 문자열로 조용히 회전**돼 버린다" 는 다른 실패 모드를 실측 근거로 제시한다 — 두 서술이
    같은 함수의 같은 호출을 두고 양립 불가능한 메서드를 지목한다. secret-store.md §2.1 이 명시적으로
    "구현체는 rotate() 를 쓴다" 고 선언하므로, 9곳의 `.store()` 표기가 **stale/오기**이고 secret-store.md
    +R-CC-21 쪽이 실측과 일치하는 쪽으로 보인다. 이 오기는 오늘 이미 두 차례(21:53:42
    convention_compliance, `plan/complete/spec-draft-telegram-signing-carveout.md:28`) 인용됐지만
    "이미 컨벤션에 정본화돼 있다" 는 결론을 내면서 인용문 자체는 `.store(...)` 를 그대로 옮기고
    서술은 `SecretResolver.rotate` 로 바꿔 적어(21:53:42 리포트 자체 20번째 줄) 불일치를 알아채지
    못하고 지나간 흔적이 있다.
  - 제안: 지금 이 turn(D-1/D-2/D-3, `TriggersService.setupChatChannel` 의 write-gate 리팩터)이 정확히
    이 코드경로를 만지므로, 구현 전/구현과 같은 커밋에서 실제 호출 메서드를 재확인하고(개발자의
    "착수 전 실측" 표 항목 2가 이미 `SecretResolver.rotate` 를 언급하므로 실측 자체는 맞는 방향으로
    보인다) 9곳의 `.store()` 표기를 `.rotate()` 로 일괄 정정하거나, 이 turn 범위 밖이면 최소한
    `plan/in-progress/impl-chat-channel-patch-token.md` 의 planner 후속 목록(현재 "R-CC-21 산문 폭
    정정" 한 항목만 있음)에 "`SecretResolver.store()` 오기 4-파일 9-자리 일괄 정정" 을 별도 항목으로
    추가해 이번 구현이 실제로 어떤 메서드를 호출/유지하는지와 spec 서술이 어긋나지 않게 한다.
    `spec/` 는 developer 소관이 아니므로 이 정정 자체는 planner 턴 대상이다.

## 검증되어 충돌 없음으로 확인된 항목 (참고)

- `spec/2-navigation/2-trigger-list.md` (§2.3.1 매트릭스 · §3 API 표 · `PATCH` 상세 캐비엇)는 R-CC-21 ·
  §5.4.1 · §5.4.1.1 의 telegram carve-out을 포함해 정확히 동기화돼 있다 — cross-link·차단 코드
  (`details.field='botTokenRef'`/`'inboundSigningPlaintext'`)·telegram 예외 문구 모두 일치.
- `spec/1-data-model.md` §2.8 Trigger 는 신규 컬럼 5개(`chat_channel_health/last_error/setup_at/
  token_v2/rotated_at`) + `hasBotToken` derived 필드 cross-link가 target §4.2/§5.4.2 서술과 정확히
  일치한다.
- `spec/conventions/audit-actions.md` §1/§3 의 `<resource>.<verb>` 구조(dot-prefix 필수·언더스코어
  구분자·과거분사)와 `trigger.chat_channel_bot_token_rotated`/`trigger.updated` 등재는 target
  §5.4.1 의 정당화 문단("`chat-channel` 은 감사 모델에 존재하지 않는 resource")과 정합한다.
- `spec/conventions/error-codes.md:174` 의 `WORKSPACE_REQUIRED`→`WORKSPACE_ID_REQUIRED` rename 이력은
  target R-CC-18 서술(경위·PR 번호·breaking 영향 0)과 정확히 일치한다.
- `spec/5-system/2-api-convention.md:75` 의 RPC-style sub-channel 예외 목록이
  `/api/triggers/:id/chat-channel/rotate-bot-token` 을 그대로 예시로 들어 target R7 의 URL 설계
  정당화와 일치한다.
- `spec/data-flow/14-chat-channel.md:150-151`(setup/PATCH 시퀀스 표)은 telegram carve-out을 포함해
  R-CC-21 최신 버전과 동기화돼 있다.
- 오늘 22:24:30 cross_spec 리뷰가 지적했던 "developer plan D-2 의 write-gate 가 telegram 의 3번째
  쓰기 지점(`result.issuedInboundSigning`)을 우발적으로 함께 게이팅할 위험"은
  `plan/in-progress/impl-chat-channel-patch-token.md` §설계 D-2 의 경고 박스("게이팅 대상은 두 곳뿐,
  세 번째 쓰기 지점은 무조건 유지")로 이미 명시적으로 해소돼 있다 — 재-flag 하지 않는다.

## 요약

target(`spec/5-system/15-chat-channel.md`)의 PATCH 비밀-쓰기 차단 정책(R-CC-10·§5.4.1·§5.4.1.1·
R-CC-21)은 데이터 모델(`1-data-model.md`)·API 계약 표면(`2-trigger-list.md`)·감사 액션 명명
(`audit-actions.md`)·에러 코드 rename 이력(`error-codes.md`)·data-flow 시퀀스·API 설계 컨벤션과 폭넓게
정합하며 오늘 이전 두 라운드가 이미 telegram carve-out 관련 위험을 닫아 두었다. 새로 발견된 유일한
쟁점은 `SecretResolver.store()` 대 `.rotate()` 메서드명 불일치로, target 파일 자체(§4.1 주석 2곳·
§5.4.1/§5.4.1.1 표 2곳)와 형제 provider/convention 문서 5곳이 반복 서술하는 메서드명이 그 인터페이스의
SoT(`secret-store.md`)와 target 자신의 R-CC-21 실측 서술이 지목하는 메서드명과 정면으로 다르다 — 지금
이 구현 turn 이 바로 그 호출 지점을 리팩터하므로 착수 전 재확인 가치가 있다.

## 위험도

MEDIUM

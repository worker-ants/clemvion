# Cross-Spec 일관성 검토 — `spec/5-system` (impl-prep, chat-channel PATCH bot-token)

## 컨텍스트

target 은 `spec/5-system/15-chat-channel.md` (특히 최근 커밋 `df1962e25` #1311 이 추가한 §5.4.1 개정 ·
§5.4.1.1 정합화 · 신설 `R-CC-21`)이며, 이 문서를 SoT 로 삼아 `plan/in-progress/impl-chat-channel-patch-token.md`
가 D-1/D-2/D-3 구현에 막 착수하려는 시점의 impl-prep 검토다. 해당 diff 는 이미 `/consistency-check --spec`
3라운드(C4/W9 → C1/W3 → C0/W0)를 통과했으므로, 본 검토는 그 라운드가 스코프에 넣지 않았던 **다른 spec
영역(provider 구체 스펙 · conventions)과의 교차 충돌**에 집중했다.

## 발견사항

- **[CRITICAL]** `chatChannel` 포함 PATCH 의 "inbound signing 불변" 서술이 Telegram 의 server-issued
  회전 동작과 직접 모순 — 문면대로 구현하면 Telegram inbound 인증이 깨진다
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 신설 행("`chatChannel` 이 실린 PATCH…
    **secret store 에 저장된 bot token 을 바꾸지 않는다**")과 `### R-CC-21`("PATCH 는 어떤 비밀도
    받지 않고, 어떤 비밀도 쓰지 않는다")
  - 충돌 대상:
    - `spec/data-flow/14-chat-channel.md` §1.3 신설 행(이 PR 의 변경 G) — "`chatChannel` 이 실린
      PATCH → `setupChannel()` 재호출로 provider 등록만 갱신. **secret store 에 쓰지 않는다** —
      bot token·**inbound signing 값은 요청 전후로 동일하다**." (provider 무관, 무조건 서술)
    - `spec/4-nodes/7-trigger/providers/telegram.md` §3.1 `setupChannel` 구체 — Telegram 은
      `setWebhook` 호출마다 `secret_token` 을 **새로 랜덤 생성**해 등록하고, plaintext 는
      `SetupResult.issuedInboundSigning` 로 매번 새로 노출된다(재사용 없음)
    - `spec/conventions/chat-channel-adapter.md` §2.4/§5.5(a) 및
      `codebase/backend/src/modules/triggers/triggers.service.ts:981-993` — `setupChatChannel`
      은 `adapter.setupChannel()` 이 반환한 `result.issuedInboundSigning` 이 있으면 **매 호출마다**
      `secrets.rotate(inboundSigningRef, …)` 로 **무조건 갱신**해 DB 를 Telegram 의 최신
      `secret_token` 과 동기화한다 — 이 쓰기는 "provider-issued(slack/discord)" 축(같은 함수
      954~969행, 사용자 입력 plaintext)과 **코드 주석 상 명시적으로 구분된 별도 블록**이다
  - 상세: §5.4.1 새 행과 §4.2 신설 행은 "`chatChannel` 이 실린 PATCH (uiMapping·rateLimit 등 편집)"
    에도 `setupChannel()` 을 재호출한다고 명시한다. 그런데 Telegram 어댑터는 `setupChannel()` 을
    호출할 때마다 새 `secret_token` 을 발급해 텔레그램 쪽에 등록하므로, 이 재호출은 **의도적으로
    Telegram 의 inbound-signing 값을 바꾼다** — "provider 등록만 갱신하고 비밀은 안 바뀐다" 는
    전제 자체가 Telegram 에서는 성립하지 않는다. 두 갈래 결과 모두 문제가 있다: (a) `R-CC-21`
    문구("어떤 비밀도 쓰지 않는다")를 문자 그대로 `setupChatChannel` 전체에 적용해 987~993행의
    무조건 쓰기까지 skip 하면, DB 에는 옛 `secret_token` 이 남고 Telegram 은 새 값으로 서명하므로
    **그 트리거의 향후 모든 inbound webhook 이 `X-Telegram-Bot-Api-Secret-Token` 불일치로 401** 이
    된다 — bot-token 이나 signing 자체와 무관한 PATCH(예: `rateLimitPerMinute` 변경) 한 번으로
    Telegram 챗봇이 영구히 응답 불능이 된다. (b) 반대로 987~993행을 그대로 두면(즉 코드베이스의
    "provider-issued(957~969행)" 와 "server-issued(987~993행)" 구분을 그대로 유지하면) Telegram 의
    inbound signing 값은 **PATCH 전후로 달라지므로**, `data-flow/14-chat-channel.md` §1.3 의
    "inbound signing 값은 요청 전후로 동일하다" 서술 자체가 Telegram 에 대해 **사실과 다르게** 된다.
  - `plan/in-progress/impl-chat-channel-patch-token.md` 의 "발견한 경계" 절이 이 위험의 절반
    (`telegram.adapter.ts` 의 재발급 동작 + PATCH 에서 저장 안 하면 서명검증이 깨진다는 점)을 이미
    스스로 찾아냈고, 두 canonical 표(§5.4.1 은 bot token, §5.4.1.1 은 제목상 "slack/discord 한정")는
    Telegram 의 server-issued 축을 건드리지 않는다고 결론 내려 **이 턴에서 고치지 않고 planner
    후속으로 미뤘다.** 그러나 그 판단은 plan 문서에만 있고, 정작 **모순되는 두 문장이 실려 있는
    spec 본문 자체**(`15-chat-channel.md` R-CC-21 의 "어떤 비밀도 쓰지 않는다" / `14-chat-channel.md`
    §1.3 의 "값은 요청 전후로 동일하다")는 그 narrow-scope 를 아직 반영하지 않았다 — 이 상태로 남으면
    (i) 이번 구현이 아니더라도 다음 사람이 R-CC-21 을 문자 그대로 읽고 987~993행까지 skip 하는
    회귀를 만들 수 있고, (ii) 지금 구현이 맞게 되더라도 `data-flow/14-chat-channel.md` 의 문장은
    구현 완료 시점에 거짓 서술로 남는다.
  - 제안: `spec/5-system/15-chat-channel.md` §5.4.1 신설 행과 `R-CC-21`, 그리고
    `spec/data-flow/14-chat-channel.md` §1.3 신설 행 세 곳 모두에 **"PATCH 가 쓰지 않는 비밀은 (1)
    `botToken`(rotate 대상)과 (2) `inboundSigningPlaintext`(slack/discord 사용자 입력) 두 축 한정이며,
    Telegram 의 server-issued `issuedInboundSigning` 은 `setupChannel()` 재호출의 자연스러운 부수효과로
    계속 갱신·저장된다"** 는 명시적 carve-out 을 추가할 것 — §5.4.1.1 의 "slack / discord 한정" 제목과
    동일한 패턴으로 Telegram 을 스코프 밖에 명시적으로 두면 두 문서의 "값이 안 바뀐다" 주장과
    실제 구현이 정합한다. 이 정정은 API 계약(누가 무엇을 쓰는지)에 해당해 developer 자기-반증형
    소정정 예외(조건 2 "예고·트리거 문장만")에 해당하지 않으므로 **planner 턴**이 필요하다 — 다만
    이번 impl-prep 턴에서 D-2 를 구현할 때는 `plan/in-progress/impl-chat-channel-patch-token.md` 가
    이미 정확히 식별한 코드 축(`triggers.service.ts:948-952`, `:957-969` 만 게이팅, `:981-993` 은
    무조건 유지)을 따라야 회귀가 생기지 않는다.

- **[WARNING]** `CCH-AD-02` 요구사항 문구가 `setupChannel()` 호출 조건을 "enable/생성" 으로만 한정 —
  §5.4.1 이 새로 명문화한 "chatChannel 포함 PATCH → setupChannel() 재호출" 트리거 조건을 포괄하지 않는다
  - target 위치: `spec/5-system/15-chat-channel.md` §3.1 `CCH-AD-02`("Trigger enable / 신규 생성 시
    어댑터의 `setupChannel()` 자동 호출")
  - 충돌 대상: 같은 문서 §5.4.1 신설 행("`chatChannel` 이 실린 PATCH … `setupChannel()` 재호출로
    provider 등록만 갱신") 및 §7 `R8`("같은 config 재호출 OK" 멱등성 전제)
  - 상세: `CCH-AD-02` 만 읽으면 `setupChannel()` 이 활성화·생성 시점에만 불린다고 오해하기 쉽다.
    실제로는 (i) 최초 생성, (ii) 활성화 PATCH, (iii) uiMapping/rateLimit 등 **비활성화·비회전** 편집
    PATCH 세 갈래 모두 `setupChannel()` 을 재호출한다 — `conventions/chat-channel-adapter.md` 의
    "같은 config 재호출 OK" 멱등성 설계로 뒷받침되긴 하지만, 요구사항 ID 표(§3.1)는 이 세 번째 갈래를
    요구사항 차원에서 명시하지 않는다.
  - 제안: `CCH-AD-02` 문구에 "및 `chatChannel` 필드가 포함된 일반 PATCH" 를 추가하거나, §5.4.1 로
    forward-link 를 남겨 두 서술의 스코프를 맞출 것. 기능적 충돌은 아니고 요구사항 완전성 갭이라
    WARNING 등급.

- **[INFO]** 근접 애너그램 에러 코드 `INVALID_BOT_TOKEN` vs `BOT_TOKEN_INVALID`
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4 응답 계약 표 (`INVALID_BOT_TOKEN`=컨트롤러
    입력 검증 실패, `BOT_TOKEN_INVALID`=`setupChannel` 의 provider 401/403)
  - 충돌 대상: 없음 — 이미 `triggers.controller.ts` / `triggers.service.ts` / `discord.adapter.ts` /
    `data-flow/14-chat-channel.md:155` 에 동일하게 구현·문서화돼 있어 실제 충돌은 없다.
  - 상세: 두 코드가 토큰 순서만 바뀐 거의 동일한 이름이라 client 구현자·리뷰어가 스캔 중 뒤바꿔
    읽을 여지가 있다. `spec/conventions/error-codes.md` §1 의 "의미 기반 명명" 원칙에는 어긋나지
    않지만(각자 의미가 다르므로), 가독성 관점의 사소한 리스크다.
  - 제안: 이 PR 스코프는 아님 — 후속 네이밍 정리 후보로만 기록. rename 은 `error-codes.md §2` 상
    breaking change 이므로 실제로 변경할 근거(운영상 혼동 사례)가 없으면 유지해도 무방.

## 요약

이번 PATCH-bot-token 개정(§5.4.1 · §5.4.1.1 · R-CC-21)은 데이터 모델·API 계약·RBAC·에러 코드
네이밍·계층 책임 측면에서 `1-data-model.md`, `1-auth.md`, `3-error-handling.md`, `14-external-interaction-api.md`,
`12-webhook.md`, `2-trigger-list.md` 와 폭넓게 교차 검증했으며 이미 --spec 라운드가 이 좁은 diff 를
3회 검증(최종 C0/W0)한 만큼 대체로 견고하다. 다만 provider 구체 스펙(`providers/telegram.md`)까지
넓혀 보면, "PATCH 는 비밀을 쓰지 않는다"는 새 불변식이 Telegram 의 server-issued inbound-signing
재발급 메커니즘과 정면으로 충돌하는 지점을 하나 새로 발견했다 — 두 문서(`15-chat-channel.md`
R-CC-21 / `data-flow/14-chat-channel.md` §1.3)의 문구를 그대로 구현하면 Telegram 채널이 첫 번째
무관한 PATCH 이후 영구히 응답 불능이 되거나, 반대로 문구 자체가 거짓 서술로 남는다. plan 문서가
이미 절반을 발견해 "planner 후속" 으로 미뤄 뒀지만, 모순 문장 자체는 아직 spec 본문에 남아 있어
CRITICAL 로 등재한다. 나머지 항목(CCH-AD-02 완전성, 에러 코드 네이밍)은 낮은 등급이다.

## 위험도

CRITICAL

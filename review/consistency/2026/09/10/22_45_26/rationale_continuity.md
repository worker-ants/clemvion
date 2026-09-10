# Rationale 연속성 검토 — spec/5-system (chat-channel-patch-token, --impl-prep)

## 검토 범위 및 방법

target 은 `spec/5-system/15-chat-channel.md` 전문 + 관련 spec(1-auth.md 등) + 그 외 다수 spec 의
`## Rationale` 발췌 번들이다. 예산 초과로 본문이 절단된 16개 파일 (`2-api-convention.md` ·
`3-error-handling.md` · `4-execution-engine.md` · `6-websocket-protocol.md` · `12-webhook.md` ·
`14-external-interaction-api.md` 등) 은 target 이 인용하는 핵심 근거(EIA §R10/§R17/EIA-RL-04/EIA-AU-08,
WS §4.1/§4.4 strip-only) 위주로 실제 파일(`Read`)을 열어 직접 대조했다. 아울러 이 task 의 직접
근거인 `plan/complete/spec-draft-chat-channel-patch-token.md`, `plan/complete/spec-draft-telegram-signing-carveout.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/impl-chat-channel-patch-token.md`
도 함께 열어 target 의 Rationale 서술이 실제 결정 이력과 맞는지 대조했다.

target 문서(`15-chat-channel.md`)는 이미 같은 날 두 차례의 `--spec` rationale_continuity 라운드
(`review/consistency/2026/09/10/22_04_23`, `22_14_27`)를 거쳐 R-CC-21 신설·§5.4.1/§5.4.1.1 정정·
telegram carve-out caveat 삽입까지 반영된 상태다. 이번 라운드는 그 결과물에 남은 잔여 갭을 찾는
데 집중했다.

## 발견사항

### [INFO] `impl-chat-channel-patch-token.md` 의 "R-CC-21 산문 폭 정정" TODO 가 이미 해소된 것으로 보인다

- target 위치: `spec/5-system/15-chat-channel.md` R-CC-21 상단 캐비앗
  (`> ⚠️ 이 항목의 「비밀」은 두 축 한정이다 (2026-09-10 정정).`)
- 과거 결정 출처: `plan/in-progress/impl-chat-channel-patch-token.md` §"발견한 경계 — R-CC-21
  산문이 구현보다 넓다 (planner 위임)"
- 상세: 그 plan 항목은 *"R-CC-21 의 제목/산문 `PATCH 는 어떤 비밀도 받지 않고, 어떤 비밀도 쓰지
  않는다` 를 문자 그대로 읽으면 telegram 의 server-issued `issuedInboundSigning` 재저장(매
  `setupChannel` 호출마다 발생 — 건너뛰면 인입 전부 401)까지 막는 것으로 오독될 수 있다"* 는
  우려를 planner 후속 turn 으로 넘기며 체크리스트에 미체크 항목으로 남겨 두었다. 그런데 target
  의 R-CC-21 은 이미 그 우려를 정확히 겨냥한 caveat 블록(telegram 축 제외 명시 + "제목이 넓은
  이유는 인입 앵커 유지 때문"이라는 설명)을 갖고 있고, §5.4.1.1 telegram 행·재검토 신호 표
  (bot token / slack-discord signing / telegram signing 3축 분리)까지 일관되게 정리돼 있다. 즉
  plan 이 미해결로 기록한 항목이 spec 쪽에서는 이미 반영된 상태로 읽힌다.
- 제안: `plan/in-progress/impl-chat-channel-patch-token.md` 체크리스트의 "R-CC-21 산문 폭 정정을
  planner 후속으로 등재" 항목을 재확인해, target 의 현재 caveat 로 충분한지(재확인 후 체크) 아니면
  추가로 원하는 문구 조정이 남아 있는지 명시할 것. plan 이 이미 해소된 우려를 미해결로 들고 있으면
  다음 세션이 중복 planner 턴을 발생시킬 수 있다.

### [INFO] CCH-AD-02 의 "3 갈래 모두 필수" 단정이 §5.4.1 표 2행의 "미확정" 상태를 가리지 않는지 재확인 권장

- target 위치: `spec/5-system/15-chat-channel.md` §3.1 `CCH-AD-02` 행 (
  "Trigger enable / 신규 생성 및 `chatChannel` 이 실린 일반 PATCH 시 ... 세 갈래 모두 §5.4.1 가
  SoT — 멱등 재호출 전제는 §7 `R8`" · 우선순위 **필수**)
- 과거 결정 출처: 같은 문서 §5.4.1 표 2행의 인라인 각주 (`**(2026-09-10 — 이 재호출이 실제로
  일어나는지 미확정. `update()` 가 `if (chatChannel)` 로 게이트돼 있어 순수 `isActive` 토글이 이
  행을 안 탈 수 있다 — 확인 중`) 및 §7 `R8` ("`setupChannel()` 호출 시 동일 `triggerId` 의 기존
  entry 가 있으면 overwrite (멱등성)" — 이 전제는 *호출된다는 것*을 가정한다).
- 상세: CCH-AD-02 는 "Trigger enable" 분기를 다른 두 분기(신규 생성 / chatChannel PATCH)와 동일한
  **필수** 등급으로 묶어 §5.4.1 을 SoT 로 인용하는데, 그 SoT 자신의 2행은 "이 재호출이 실제로
  일어나는지 미확정"이라고 적어 CCH-AD-02 가 딛고 선 전제 중 하나(활성화 시 재호출)가 구현과 맞는지
  아직 검증되지 않았다고 선언한다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  "§5.4.1 표 2행이 구현과 어긋날 수 있다" 항목이 이 갭을 이미 추적 중이고, `spec-draft-chat-channel-patch-token.md`
  는 그 불확실성 때문에 해당 행을 D-2 의 선례로 인용하지 않았다고 명시하고 있어 — 침묵된 번복은
  아니고 투명하게 열린 질문으로 남아 있다. 다만 CCH-AD-02 자체의 "필수" 등급 서술은 그 불확실성을
  본문에서 언급하지 않아, §5.4.1 을 직접 안 열어본 독자는 CCH-AD-02 의 3 갈래가 모두 이미 검증된
  요구사항이라고 오독할 수 있다.
- 제안: 조사가 끝나기 전까지는 CCH-AD-02 행에 "(활성화 브랜치는 §5.4.1 표 2행 미확정 참고)" 정도의
  1줄 포인터를 추가하거나, 조사가 이미 이번 PR 범위에 포함된다면 착수 전에 먼저 확정해 CCH-AD-02 와
  §5.4.1 표 2행의 등급을 일치시킬 것. (이 자체가 R-CC-21 이 고친 것과 같은 형태의 결함 — "선언된
  정책과 실제 동작이 다른 층에 있다" — 로 번질 수 있는 지점이라 착수 전 정리가 저렴하다.)

## 그 외 대조 완료 항목 (문제 없음)

- R-CC-10 (bot token single-path) ↔ `spec/2-navigation/2-trigger-list.md` R-2/R-14(hmacSecret,
  폐기)/R-12: 인용 방식이 "자원 성격 대조"로 명시돼 있어 R-2 폐기와 무관하게 유효함을 스스로 밝힘.
  일관.
- R-CC-21 (PATCH 는 비밀을 쓰지 않는다) ↔ §5.4.1/§5.4.1.1 본문 표 ↔
  `plan/in-progress/impl-chat-channel-patch-token.md` 의 D-1/D-2/D-3 설계: 세 자리(문서-Rationale·
  문서-본문표·구현계획)가 "botToken·slack/discord `inboundSigningPlaintext` 2축만 차단, telegram
  server-issued 축은 무조건 유지"로 정확히 일치.
- R8 (per-trigger listener 멱등성) ↔ EIA §R10 (WebsocketService 단일 sink 확장, Chat Channel
  adapter 를 형제 listener 로 명시): EIA 원문 확인 결과 일치.
- CCH-MP-01/CCH-MP-06 의 마스킹 캐비앗 ↔ EIA §R17 ("내부 WS·Chat Channel 도 마스킹됨 — 수용된
  trade-off" 불릿) ↔ WS §4.4 strip-only 결정(`llmCalls`): EIA/WS 원문 확인 결과 인용 정확.
- R-CC-19 (rate-limit skip) ↔ R9 (lifecycle 큐잉 vs 즉시 안내): "직교 사안"이라는 관계 서술이 두
  항목 모두에서 상호 참조로 일관되게 유지됨 — 한쪽만 고쳐 두고 다른 쪽이 낡는 형태 없음.
- `chat_channel_token_v2` (ref 저장) ↔ `notification_secret_v2` (평문 저장) 의 비대칭 ↔
  `spec/1-data-model.md` §"User 민감 컬럼 방어" Rationale (`select: false` 금지 원칙, "값을 읽는다"
  분류): `1-data-model.md` 가 이미 "chat_channel_token_v2 는 reference 라 등급이 다르다"로 명시적
  분기 처리하고 있어, `notification_secret_v2` 에 적용한 원칙을 `chat_channel_token_v2` 에 잘못
  유추 적용할 위험이 선제적으로 차단돼 있음.
- R-CC-18 (`400 WORKSPACE_ID_REQUIRED`, 공용 데코레이터 통일) ↔ §5.4 에러 표: 일치.

## 요약

target 의 핵심(§5.4/§5.4.1/§5.4.1.1/R-CC-10/R-CC-21)은 이미 같은 날 두 차례의 rationale_continuity
라운드를 거쳐 "기각된 대안 재도입"·"원칙 위반"·"무근거 번복" 클래스의 결함이 발견 즉시 caveat·표
분리·재검토 신호 표로 정정된 상태이며, 이번 라운드에서 그 정정들을 원본 spec(EIA/WS)과 대조해도
어긋남을 찾지 못했다. 남은 것은 CRITICAL/WARNING 급이 아니라 (1) 이미 spec 에서 해소된 우려가
구현 plan 의 체크리스트에는 아직 미해결로 남아 있는 plan-spec 동기화 갭, (2) CCH-AD-02 의 "필수"
단정이 §5.4.1 자신이 인정한 미확정 상태를 본문에서 직접 언급하지 않아 생기는 가독성 격차, 두 건의
INFO 뿐이다. 구현 착수를 막을 이유는 없으나 두 항목 모두 착수 직후 5분 내로 정리 가능하다.

## 위험도

LOW

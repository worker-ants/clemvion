# 신규 식별자 충돌 검토 — `spec-draft-chat-channel-conventions.md`

## 발견사항

- **[CRITICAL]** 결정 라벨 `D-1`/`D-2` 가 같은 파일 안에서 **이미 다른 의미로** 쓰이고 있다
  - target 신규 식별자: draft `## 결정` 절의 `D-1`(details 객체에 `code` 생략 금지) · `D-2`(swagger.md 명명 규칙) · `D-3`(멱등 각주) · `D-4`(3축 표 갱신)
  - 기존 사용처: `spec/5-system/15-chat-channel.md:797-798` — *"D-1(필드를 받지 않는다)과 D-2(경로가 그 두 비밀을 쓰지 않는다)를 함께 결정한다"* (R-CC-21 의 하위 결정 라벨). 이 라벨은 plan 텍스트에 그치지 않고 **코드베이스 전역에 10곳 이상 인용**되어 있다 — `triggers.service.ts:514,585,629,674,690`, `update-trigger.dto.ts:102`, `chat-channel-config.dto.ts:350`, `triggers.service.spec.ts:1630,1659,1686`, `trigger-dto-validation.spec.ts:765` 모두 `R-CC-21 / D-1` 또는 `R-CC-21 / D-2` 형태로 참조한다.
  - 상세: target 이 다루는 세 규약(§5.3 `code` 필수화 · swagger 명명 · 멱등 각주)은 R-CC-21(PATCH 가 비밀을 쓰지 않는다)과 **완전히 다른 주제**인데, 결정 라벨을 처음부터 다시 `D-1`~`D-4` 로 붙였다. 게다가 target 의 D-4 가 편집을 예고하는 자리(`15-chat-channel.md §5.4.1`)는 기존 `D-1`/`D-2` 가 정의된 §5.4.1 인접 절(§5.4~§5.4.2, R-CC-21 rationale)과 **같은 파일·같은 섹션 군**이다. 이후 이 draft 가 spec 본문에 흡수되거나, PR 리뷰·`git log -S`·`grep D-1` 로 두 결정 이력을 추적하는 사람은 "D-1" 하나로 서로 다른 두 결정(비밀-미수신 정책 vs code 생략 금지)을 혼동하게 된다.
  - 제안: target 의 결정 라벨을 `D-1..D-4` 대신 이 PR 의 주제를 반영한 별도 네임스페이스로 바꾼다 (예: 이미 있는 변경안 코드 `A1/B1/C1/D1` 을 결정 절에서도 그대로 재사용하거나, `CV-1..CV-4`/`N-1..N-4` 처럼 R-CC 계열과 겹치지 않는 접두를 쓴다). 최소한 spec 본문에 흡수될 때는 `R-CC-21 / D-1` 표기와 절대 겹치지 않는 표기를 쓸 것.

- **[CRITICAL]** `details` 객체에 `code` 를 항상 실으라는 신규 규칙(D-1)이 같은 파일의 "확정 설계" 문구와 정면 충돌하고, 실측 인벤토리가 실제 사이트의 상당수를 누락했다
  - target 신규 식별자/규칙: *"`2-api-convention.md §5.3` 객체 행에 `code` 는 생략하지 않는다를 명문화한다. 필드 검증 사유의 기본값은 파이프와 같은 `INVALID_FIELD`"* (D-1) 및 이를 `15-chat-channel.md §5.4.1` 3축 표에 "계약값"으로 반영(D-4).
  - 기존 사용처: `spec/5-system/15-chat-channel.md:380-383` — *"`details.field` 의 SoT 는 단일하지 않다 — **그것이 확정 설계다 (2026-09-11)**."* 및 `:408-410` — *"`details[].code` 는 두 항목 모두 **서비스 가드 갈래**라 싣지 않는다(위 §5.4.1 의 두-갈래 서술 참조)."* (§5.4.1.2, `chatChannel` 필드 존재성·`provider` 불변성 두 사이트를 가리킴). 이 문구는 바로 직전에 머지된 커밋(f947b49f4, 오늘 날짜 2026-09-11)이 신설한 것으로, target 이 "왜 이 턴인가"에서 스스로 인용하는 그 직전 턴의 산출물이다.
  - 상세: target 의 D-1 은 "필드 검증 사유를 담는 객체는 항상 `code` 를 실어야 한다"는 **전역 규칙**을 세우면서 대상 사이트를 11곳(`triggers.service.ts` 9곳 + `workspaces.service.ts` 2곳)으로 실측했다고 적는다. 그러나 실제 `triggers.service.ts` 에는 `details: { field: … }` 형태의 object-shape 사이트가 **13곳** 있다(`grep -c` 실측) — target 의 9곳 목록(`type`·`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`inboundSigningPlaintext`×4·`authConfigId`)에서 빠진 4곳은 `botToken`(`:702`, `assertPatchCarriesNoSecrets`) · `inboundSigningPlaintext`(`:710`, 같은 함수) · **`chatChannel`(`:733`, `assertChatChannelAlreadySetUp`)** · **`provider`(`:744`, 같은 함수)** 다. 뒤 두 곳이 바로 위 "확정 설계" 문구가 명시적으로 "code 를 싣지 않는다"고 선언한 그 두 사이트다. 즉 D-1 을 문자 그대로 적용하면(이 네 곳도 "필드 검증 사유"이므로 D-1 의 적용 대상에서 배제할 근거가 없다) `15-chat-channel.md §5.4.1.2` 의 방금 확정된 문장이 즉시 stale/모순이 되는데, target 의 변경안(A1/B1/C1/D1)에는 §5.4.1.2 를 갱신하는 항목이 없다 — D4 는 "§5.4.1 의 3축 표"(§5.4.1·§5.4.1.1 의 bot-token/inboundSigning rotation 표)만 겨냥하고 §5.4.1.2 는 스코프 밖이다. 결과적으로 이 draft 가 그대로 머지되면 같은 파일 안에 "`code` 는 생략하지 않는다"(§5.3, 새 규칙)와 "이 두 사이트는 서비스 가드 갈래라 code 를 싣지 않는다"(§5.4.1.2, 확정 설계로 못박힌 기존 문장)가 **동시에 SoT 로 공존**하게 된다.
  - 제안: D-1/D-4 범위에 `15-chat-channel.md §5.4.1.2` 를 명시적으로 포함하거나(그 경우 "확정 설계" 문장·"싣지 않는다" 서술을 함께 정정), 반대로 그 두 사이트(`chatChannel`/`provider`)를 D-1 규칙의 **의도적 예외**로 변경안에 명문화한다. 어느 쪽이든 실측 표를 13(+2)곳 기준으로 재작성해 "11개 엔드포인트" 산정(배열 통일을 기각하는 근거로 쓰인 숫자)도 재검증할 것 — 현재 "11자리 중 9자리" 표현도 표의 합계(9+2=11, 전부 없음)와 산수가 맞지 않는다.

## 요약

target 이 새로 도입하는 네 결정 중 `code`-필수화(D-1)와 `Update` 접두 범위(D-2) 자체는 기존 spec/코드 관례와 이름이 겹치지 않고, D-2/D-3 은 순수 추가(swagger.md 에 없던 절 신설, chat-channel-adapter.md 각주 추가)라 충돌이 없다. 그러나 결정 라벨 `D-1`/`D-2` 는 **바로 그 파일**(`15-chat-channel.md`)에서 R-CC-21 의 하위 결정으로 이미 확립되어 코드베이스 10여 곳에 인용되는 식별자와 정면으로 겹치고, D-1 의 "code 생략 금지" 규칙은 같은 파일에서 어제 "확정 설계"로 선언된 "두 사이트는 code 를 싣지 않는다"는 문장과 실질적으로 모순되며, 그 실측 대상 인벤토리(11곳)도 실제 사이트 수(15곳, chatChannel/provider 포함)를 과소 집계했다. 두 문제 모두 이 draft 가 머지되기 전에 정리하지 않으면 뒤따르는 developer PR(배선 담당)이 서로 다른 두 SoT 문장 중 무엇을 따라야 하는지 판단할 수 없게 된다.

## 위험도

CRITICAL

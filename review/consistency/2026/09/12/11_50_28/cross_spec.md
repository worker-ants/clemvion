# Cross-Spec 일관성 검토 — setupChannel 실패 분류 (transport → 원인)

## 검토 범위

target: `plan/in-progress/spec-draft-setup-error-classification.md` (spec draft, `--spec` 모드).
`spec_impact` 선언: `spec/5-system/15-chat-channel.md`(§5.4 에러 표 두 행) ·
`spec/conventions/chat-channel-adapter.md`(신규 §1.1.2). 두 파일 모두 실제 저장소에서 전문을
읽어 대조했다(번들 파일은 `15-chat-channel.md` 를 예산 초과로 통째로 생략했다 — 알려진
`--spec` 모드 갭). `spec/5-system/3-error-handling.md`·`2-api-convention.md`·
`2-navigation/2-trigger-list.md`·`data-flow/14-chat-channel.md`·
`4-nodes/7-trigger/providers/{discord,slack,telegram}.md` 를 grep + 직접 열람으로 교차 대조했다.

## 발견사항

- **[CRITICAL]** `spec_impact` 목록 누락 — 같은 discriminant("401/403")를 서술하는 다른 세 자리가 개정 후 §5.4 와 직접 모순한다
  - target 위치: target 문서 `spec_impact` frontmatter(파일 2건만 등재) + 편집 계획 (1)
    `15-chat-channel.md §5.4` 두 행 교체
  - 충돌 대상 (편집 대상에서 빠진 세 자리, 전부 §5.4 를 SoT 로 인용):
    - `spec/5-system/15-chat-channel.md:203` (§4.1 `Trigger.config.chatChannel` 데이터 모델 절 —
      **같은 파일, 다른 섹션**): *"잘못된 토큰은 `setupChannel` 의 외부 API 401/403 에서
      `BOT_TOKEN_INVALID` 로 드러난다"*
    - `spec/2-navigation/2-trigger-list.md:120`: *"서버는 형식을 검증하지 않는다 — 잘못된 토큰은
      `setupChannel` 의 외부 provider API 401/403 에서 400 `BOT_TOKEN_INVALID` 로 드러난다"*
      (§5.4 를 "회전 실패 분기" SoT 로 명시 인용)
    - `spec/data-flow/14-chat-channel.md:161`: *"회전 실패 분기: `setupChannel` 의 외부 API
      401/403 은 `BOT_TOKEN_INVALID` 400, 그 외는 `CHAT_CHANNEL_SETUP_FAILED` 로 변환
      ([Spec Chat Channel §5.4] 에러 표)"*
  - 상세: target 의 (1)은 §5.4 두 행을 *"provider 가 401/403 · `{ok:false,error}` · `verify_key`
    불일치 중 무엇으로 알리든 같은 분류"* 라는 **원인-기반** 서술로 바꾸고, (2)는 그 판별을
    adapter 의 message-prefix **선언**으로 옮긴다 — 즉 "401/403 에서 드러난다" 라는 낡은
    **transport-기반** 서술 자체가 이번 턴이 고치려는 결함의 근원이다(target 의 "실측" 절:
    Slack 은 HTTP 200 + `invalid_auth`, Discord 는 status 자체가 없음 — **둘 다 401/403 이
    아니다**). 그런데 위 세 자리는 §5.4 를 인용하면서 정확히 그 낡은 문장("401/403 에서
    드러난다")을 **자기 본문에 복제**해 두었다. §5.4 만 고치면:
    1. `15-chat-channel.md` 는 **같은 문서 안에서** §4.1(구 서술)과 §5.4(신 서술)이 즉시
       모순한다 — 어느 쪽이 SoT 인지 §4.1 자신도 §5.4 를 가리키지 않아 독자가 판단할
       근거가 없다.
    2. `2-trigger-list.md`·`data-flow/14-chat-channel.md` 는 §5.4 를 "SoT" 로 명시 인용하면서
       그 SoT 가 이미 바뀐 뒤에도 옛 서술을 그대로 들고 있어 **인용이 인용 대상과 어긋나는**
       상태가 된다.
    3. 더 나쁘게, 이 세 자리에 남는 서술은 이번 PR 의 **실질 동기인 Slack 케이스**를 놓치는
       바로 그 문장이다 — 재-drift 가 아니라 "고쳤다고 선언한 결함이 문서 3곳에 그대로
       남는" 상태다.
  - 제안: `spec_impact` 에 `spec/2-navigation/2-trigger-list.md`·`spec/data-flow/14-chat-channel.md`
    를 추가하고, 이 두 파일 + `15-chat-channel.md:203`(§4.1) 세 자리를 (1)과 같은 원인-기반
    서술로 동시 개정하거나(중복 서술을 없애고 "§5.4 참조"만 남기는 편이 향후 drift 방지에
    낫다), 최소한 "401/403" 특정을 지우고 "자격 증명 거부(§5.4 참조)" 로 완화한다.
    체크리스트의 (1) 항목도 "두 행 교체"에서 "세 자리 동기화"로 확장할 것.

- **[INFO]** chat-channel rotate 에러 코드가 `3-error-handling.md` 중앙 카탈로그에 미등재 (기존 갭, target 범위 밖)
  - target 위치: 해당 없음 (target 은 `3-error-handling.md` 를 건드리지 않음)
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1 Overview — *"정의·트리거 조건의 상세 SoT 가
    도메인 spec 에 있는 코드는... 본 §1 에는 공용 카탈로그 가시성을 위해 등재만 한다"* (webhook
    §1.7·EIA §1.6·KB §1.8·workspace 직접추가 §1.9·트리거 endpointPath §1.10·AuthConfig binding
    §1.11 이 모두 이 패턴을 따른다)
  - 상세: `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`/`INVALID_BOT_TOKEN`/
    `CHAT_CHANNEL_NOT_CONFIGURED` 등 rotate-bot-token 에러 코드 그룹은 다른 모든 도메인과
    달리 `3-error-handling.md` §1 에 **등재된 자리가 전혀 없다**(grep 0건). target 이 이 코드들의
    분류 사유를 정확히 다시 쓰는 시점이라, 같은 턴에 §1.12 신설로 등재하면 이 저장소의 확립된
    관례("등재되지 않은 코드는 소비자가 존재를 알 방법이 없다", API 규약 §5.3)와 정합해진다 —
    다만 이 갭은 target 이 만든 것이 아니라 이전부터 있었으므로 **차단 사유는 아니다**.
  - 제안: 이번 턴이나 별도 후속 항목으로 `3-error-handling.md §1.12`(가칭) 신설을 고려.
    필수는 아님.

- **[INFO]** `502` 상태 코드가 `2-api-convention.md §6 HTTP 상태 코드` 표에 부재 (기존 갭, target 무관)
  - target 위치: 해당 없음 — target 은 502 상태 자체를 바꾸지 않는다(코드 `CHAT_CHANNEL_SETUP_FAILED`
    의 사유 서술만 바꾼다)
  - 충돌 대상: `spec/5-system/2-api-convention.md §6`(200~503 나열, 502 없음) vs
    `15-chat-channel.md §5.4`·`3-error-handling.md`·`4-execution-engine.md`·`4-integration.md`
    가 각각 502 를 사용
  - 상세: 여러 도메인 spec 이 502 를 실제로 발행하는데 API 규약의 canonical HTTP 상태 코드
    표에는 502 행이 없다 — 이 draft 의 핵심 대상(§5.4 502 행)이 바로 그 미등재 상태 코드를
    쓰고 있어 인접성이 있지만, target 이 만든 결함이 아니고 이번 턴의 논지(원인 분류)와도
    무관하다.
  - 제안: 차단 아님. 별도 정리 항목으로만 기록.

## 요약

target 의 핵심 결정(discriminant 를 transport 신호에서 provider 선언으로 옮기는 것) 자체는
`3-error-handling.md`·`2-api-convention.md`·`chat-channel-adapter.md` §2.4(`SetupResult`)·
provider 문서(discord.md 의 verify_key 불일치 서술)와 **정합**하며, 새로 발급하는 `R-CC-23`·
`R-CCA-9` ID 도 저장소 전체에서 grep 0건으로 충돌이 없다. 유일하지만 실질적인 문제는
**`spec_impact` 목록이 좁다**는 것이다 — §5.4 를 "SoT" 로 명시 인용하는 자리가 최소 세 곳
(같은 파일 §4.1 포함) 더 있고, 그중 두 곳은 정확히 이번 PR 이 반증한 옛 서술("401/403 에서
드러난다")을 그대로 복제해 두고 있어, §5.4 만 고치고 착지하면 문서가 **자기 자신과 모순**하는
상태로 남는다. 이 하나만 넓히면(3곳 동기화) 나머지는 채택 가능한 수준이다.

## 위험도

HIGH

# Rationale 연속성 검토 — `impl-setup-error-code` (--impl-prep, scope=spec/5-system/)

## 검증 방법

target 은 `plan/in-progress/impl-setup-error-code.md`(developer 구현 계획, `spec_impact: none`)이며,
이 계획이 근거로 삼는 `spec/5-system/15-chat-channel.md` §5.4·R-CC-23·`spec/conventions/chat-channel-adapter.md`
§1.1.2·R-CCA-9·`spec/5-system/2-api-convention.md` §6·`spec/5-system/4-execution-engine.md` C-1
을 저장소에서 직접 Read 해 계획의 각 설계 판단((a)~(e), 작업 5건, 캐너리 뒤집기)을 대조했다. 이
결정들은 직전 커밋(`8964a7114`, `#1323`)에서 `--spec` 3회(11_50_28 BLOCK:YES → 12_05_58 →
12_22_24 BLOCK:NO)를 거쳐 이미 rationale-continuity 검증을 통과한 것들이므로, 본 검토는 (1) 그
결정들이 실제로 committed spec 에 반영됐는지, (2) developer 계획이 그 결정에서 다시 이탈하지
않는지에 집중했다.

## 발견사항

- **[INFO]** fallback 제거 판정 후속 항목과의 연결이 계획 문서에 없다
  - target 위치: `plan/in-progress/impl-setup-error-code.md` `## 계약 요약` 4번째 불릿("401/403
    fallback 은 **한시적 예외**로 유지") 및 `## 체크리스트`
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md` §1.1.2 "**제거 조건**: v1 provider
    3종(telegram·slack·discord)이 모두 `code` 를 부착하면 이 fallback 은 삭제 후보다. 조건만
    적고 추적하지 않으면 한시적 예외가 영구 예외가 되므로, 그 판정을 별 후속 항목으로 추적한다."
  - 상세: 이 계획의 작업 2~4(slack/discord/telegram adapter 3종에 `code` 부착)가 완료되면 위
    제거-조건이 **바로 이 PR 로 충족**된다. 그 판정은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:2812-2816`
    에 별도 항목("CCA §1.1.2 의 401/403 fallback 제거 판정", 착수 신호 = "「setupChannel 실패
    분류」 항목의 developer 후속 2~4 완료")으로 등재돼 있어 **추적 자체는 이미 존재**한다 —
    Rationale 위반은 아니다. 다만 `impl-setup-error-code.md` 본문·체크리스트 어디에도 그 트래커
    항목을 가리키는 cross-link 가 없어, 이 PR 이 착수 신호를 충족시켰다는 사실이 두 plan 문서
    사이에서 자동으로 연결되지 않는다 — "이미 등재됨" 을 신뢰하려면 인용 가능해야 한다는 이
    저장소의 반복 교훈과 같은 종류의 위험이다.
  - 제안: `impl-setup-error-code.md` 체크리스트에 "완료 시 `spec-draft-nullable-notation-followups.md`
    의 fallback 제거 판정 항목 착수 신호 충족 — 그 항목에 완료 링크 남기기" 한 줄을 추가한다.

- **[INFO]** Slack 자격 증명 거부 열거 5값이 spec 의 개방형 서술("...")을 코드 상수로 확정한다
  - target 위치: `plan/in-progress/impl-setup-error-code.md` `## 설계 판단` (c)
  - 과거 결정 출처: `spec/4-nodes/7-trigger/providers/slack.md` §3.1 — `'invalid_auth' | 'not_authed'
    | 'account_inactive' | 'token_revoked' | ...`(마지막이 개방형 `...`)
  - 상세: 계획은 `token_expired` 를 다섯 번째 값으로 추가해 닫힌 열거로 확정한다. spec 이 남겨
    둔 "..." 를 구현이 처음으로 구체화하는 것이라 과거 결정을 뒤집는 것은 아니고, 계획 자신도
    "이 저장소 안에서 실측할 방법이 없다 — 출처를 주석에 적는다" 고 위험을 인지하고 있어 이미
    스스로 방어책을 뒀다. 다만 이 확정이 spec 원문에는 아직 반영되지 않아, 다음 사람이
    `slack.md` 를 SoT 로 읽고 "token_expired 근거가 어디 있는가" 를 다시 물을 여지가 있다.
  - 제안: 조치 불요에 가깝다 — 후속으로 `slack.md` §3.1 의 "..." 를 실제 확정 5값으로 정정하는
    작은 spec 후속(developer 자기-반증형 소정정 대상은 아님, API 계약이라 planner 턴)을 트래커에
    남겨두면 다음 재조사를 막는다.

## 정합성이 확인된 부분 (재작업 불필요)

- **기각된 대안 미재도입**: 계획의 설계 판단 (b)는 `code` 를 **`Error` 프로퍼티**로 붙인다 —
  `R-CCA-9` 가 기각한 두 대안(① 호출자가 `message` 에서 status 숫자를 파싱 · ② adapter 가
  `message` 에 `'BOT_TOKEN_INVALID:'` 접두를 붙임) 중 어느 쪽도 재도입하지 않는다. 오히려 작업
  3번("discord.adapter.ts: message 접두 → `code` 교체")은 R-CCA-9 가 기각한 접두 관행을 정확히
  제거하는 방향이다.
- **원칙 준수 — "message 원문 미노출"**: 작업 1번의 "`details.reason` 제거"와 설계 판단 (a)의
  "원문은 호출자가 로그로만 남긴다"는 `15-chat-channel.md` §5.4 의 새 각주("실패 응답 본문에는
  provider 원문을 싣지 않는다 … [`4-execution-engine.md §7.5.2`]의 보안 게이트와 동일 이유")를
  그대로 구현한다.
- **"0-dependency" invariant 보존**: `chat-channel-input-rules.ts` 는 spec frontmatter/본문에
  "순수 함수 … DI 없음 — 외부 의존 0"(`15-chat-channel.md:544`, `#1319` T1 의 이동 근거)로 명시된
  invariant 를 갖는데, 계획은 이를 명시적으로 인지하고(설계 판단 (a)) logger 를 호출자
  (`TriggersService.rotateBotToken`)에 남겨 이 함수를 순수하게 유지한다 — invariant 우회가 아니라
  존중이다.
- **502 도입 범위**: 계획 작업 5(`@ApiBadGatewayResponse`)·설계 판단 (e)(필터 502 실측)는
  `2-api-convention.md §6`·`swagger.md §2-4` 에 이미 신설된 502 행과 정확히 대응한다. 저장소 내
  502 사용 0건이었던 상태에서 신설된 표를 실제로 채우는 턴이라는 커밋 서사와 일치한다.
- **`4-execution-engine.md` C-1 축과의 비충돌**: C-1 은 "우리 인프라 장애는 503"(외부 제3자
  API 실패의 502 사용은 R-CC-23 스코프)으로 이미 각주가 갈려 있어, 계획이 `setupChannel`(외부
  provider 호출)에 502 를 쓰는 것은 C-1 이 기각한 대안의 재도입이 아니다 — 애초에 다른 축이다.
  계획 문서 자체는 이 구분을 재서술하지 않지만 SoT(spec)를 그대로 따르겠다고 선언했으므로 문제
  없다.
- **스코프 정확성**: `translateSetupChannelError` 의 유일한 호출부(`triggers.service.ts` 의
  `rotateBotToken`, `adapter.setupChannel` 호출 직후)는 §5.4 가 명시적으로 범위를 두는
  "Bot Token Rotation API" 그 자체다. 별도 호출부(`chat-channel-binder.service.ts:195`, 트리거
  생성/PATCH 경로)는 이 변환기를 쓰지 않으며 계획도 이를 건드리지 않는다 — §5.4 스코프를 넘는
  확장(scope creep)이 없다.
- **한시적 예외의 정직한 유지**: "401/403 fallback 은 한시적 예외로 유지"는 CCA §1.1.2 가 이미
  "code 가 아직 없는 경로가 조용히 502 로 빠지는 것보다 400 을 주는 편이 낫다"로 정당화해 둔
  그대로이며, 계획이 임의로 이 예외를 영구화하거나 확대하지 않는다(위 INFO 1 참고 — 제거 판정
  자체는 이미 별도 트래커가 추적).

## 요약

`impl-setup-error-code.md` 는 직전 planner 턴(`#1323`)이 3회의 `--spec` 검증(마지막 라운드
rationale-continuity LOW)을 거쳐 확정한 R-CC-23/R-CCA-9 결정을 코드로 옮기는 계획이며, 그 결정이
명시적으로 기각한 두 대안(status-in-message 파싱·message 접두)을 재도입하지 않고, "message 원문
미노출"·"chat-channel-input-rules.ts 0-dependency"·"§5.4 스코프(rotate-bot-token 한정)" 등 이미
박혀 있는 원칙·invariant 를 그대로 존중한다. 결정 번복 없이 새 Rationale 을 요구하는 지점도 없다.
찾아낸 두 항목은 모두 INFO 급 보완 제안(기존 별도 트래커와의 cross-link 누락, spec 의 개방형
열거를 구현이 닫힌 값으로 확정하는 부분의 spec 후속 필요성)이며 착수를 막을 사유가 아니다.

## 위험도

LOW

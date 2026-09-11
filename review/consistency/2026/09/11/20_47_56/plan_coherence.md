# Plan 정합성 검토 — `spec-draft-chat-channel-binder-drift.md` (v2, 3→7곳 확장판)

## 검토 범위

- Target: `plan/in-progress/spec-draft-chat-channel-binder-drift.md` — T1(`#1319`)/T2(`#1320`) 심볼
  이동 후 SoT drift 정정. ① `code:` glob 3개 ② §7 5파일 ③ 귀속 **7곳**(직전 판본의 "3곳"을
  자기 반증 후 확장).
- 대조 대상: `plan/in-progress/**` 전체(bundle, 61개 파일은 예산 초과로 생략) 중
  `chat-channel`/`triggers`/`TriggersService`/이동 심볼명으로 grep 히트한 전 파일을 직접 `Read`.
  특히 `spec-draft-nullable-notation-followups.md`(2,900+ 줄, target 과 **동일 4~7개 spec 파일**을
  `spec_impact` 로 공유)를 정독.
- 실측: 현재 `spec/5-system/15-chat-channel.md`(frontmatter `code:`, §7, `R-CC-*` 번호 최댓값),
  `spec/data-flow/14-chat-channel.md` §0/§1.3, `spec/4-nodes/7-trigger/providers/{slack,discord,telegram}.md`
  해당 행을 직접 열어 target 의 "편집 대상 원문" 인용과 줄 단위 대조. `review_guard._glob_to_regex`
  wildcard 상한(`_MAX_GLOB_WILDCARDS = 6`)과 `spec-impl-evidence.md R-1` 원문도 실측.

## 발견사항

이번 판본(3→7곳 확장)에서 새로 생긴 CRITICAL/WARNING 급 불일치는 발견하지 못했다. 직전 세션
(`review/consistency/2026/09/11/20_33_26`)이 지적한 WARNING 3건·INFO 1건(slack/discord 귀속 ·
§1.3 헤더 자기모순 · 경로 축약 표기 · telegram.md caller)을 이번 판본이 (e)(f)(d)(g)로 전부
흡수했음을 실측으로 확인했다 — 아래는 INFO 수준 잔여 사항이다.

- **[INFO]** co-located 완료 주석 추가가 여전히 "계획"에만 있고 실행 전이다
  - target 위치: 체크리스트 `"트래커 항목 3건 종결 … + co-located 항목에 해소 주석 (`--spec` INFO 5)"`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2233-2235` — `[x]`
    로 닫힌 "spec 10곳이 `store()` 라 적는데 실제 호출은 `rotate()`" 항목 안에 co-located 된
    별개 하위 지적("신규 검증 분기 2건이 §5.4.1 표와 `2-trigger-list.md` PATCH 에러 표에
    미등재")
  - 상세: 재실측 결과 이 지적은 이미 실질 해소돼 있다(`15-chat-channel.md` §5.4.1.2, 커밋
    `f947b49f4`) — line 번호도 직전 세션 지적과 동일(2233-2235, drift 없음). target 은 이를
    인지하고 체크리스트에 "co-located 항목에 해소 주석" 을 넣어뒀으나, 이 체크박스도 `[ ]`
    미완료다. 실행이 빠지면 트래커 재실측 낭비가 남는다는 지적 자체는 여전히 유효하나,
    target 문서 자체의 정합성 문제는 아니다(이미 인지·계획됨).
  - 제안: target 실행 시 이 체크박스를 실제로 수행할 것 — 새로운 조치 요구는 아님, 직전 지적의
    이행 확인용 재기록.

## 정합성이 확인된 부분 (참고)

- **`spec-draft-nullable-notation-followups.md` 와의 스코프 중복은 충돌이 아니라 target 이
  스스로 그 트래커의 열린 항목을 닫는 턴이다.** 그 트래커의 `spec_impact` 는 target 과
  **거의 동일한 파일 집합**(`15-chat-channel.md`·`secret-store.md`·`chat-channel-adapter.md`·
  `data-flow/14-chat-channel.md`·`slack.md`·`discord.md`)을 갖고 있고, 그 안에 "`setupChatChannel`
  귀속 표기 3곳이 T2 이동으로 낡는다"(:2335)·"`slack.md`·`discord.md` 의
  `assertInboundSigningPlaintextByProvider` 귀속 표기가 부정확해졌다"(:2703)·"`code:` 에
  `triggers/**` glob 넣으면 재발이 막히지만 스코프 트레이드오프는 planner 판단"(:2224-2227)
  세 항목이 **미해결(`[ ]`)** 로 열려 있다. target 의 체크리스트 "트래커 항목 3건 종결" 이 바로
  이 세 항목을 가리키며, target 의 처방(narrow glob 3개, 호출자/정의처 분리 서술)이 그 트래커가
  제시한 처방 방향과 **정확히 일치**한다 — 일방적 결정 우회가 아니라 그 트래커가 명시적으로
  planner 턴에 위임한 결정을 이행하는 것이다.
- **`code:` glob 폭 결정은 트래커가 열어 둔 "planner 판단"을 실측으로 집행** —
  `codebase/backend/src/modules/triggers/**` 를 넣으면 27개(무관 17개 포함)가 걸리고, target 이
  채택한 좁은 glob 3줄은 10개(차집합 0)만 잡는다는 수치를 `find`/`ls` 로 재현 확인. wildcard
  개수(각 1개, 총 3개)도 가드 상한 `_MAX_GLOB_WILDCARDS = 6` 을 실측했고 target 의 "상한에
  한참 못 미친다"는 서술과 일치한다.
- **7곳 귀속 표기의 "편집 대상 원문" 인용이 현재 spec 본문과 줄 단위로 일치** — (a) secret-store.md
  §2.1, (c)(d) data-flow/14-chat-channel.md §0/§1.3(현재 파일의 148/150-152행과 target 인용이
  정확히 일치), (e)(f) slack.md:275·discord.md:297 의 `TriggersService.assertInboundSigningPlaintextByProvider`
  (아직 정정 전 상태로 실재), (g) telegram.md:58 의 `caller (TriggersService)` 모두 직접 열어
  대조했고 drift 없음. "비대상"으로 분류한 `2-trigger-list.md:155`·`15-chat-channel.md:432`·
  `discord.md:76` 의 접두 없는 함수명 인용도 실측대로 접두가 없어 target 의 분류가 정확하다.
- **`R-CC-22` 번호·`R-CC-14` 결번 서술 정확** — `grep '^### R-CC-' 15-chat-channel.md` 로 현재
  최댓값이 `R-CC-21`이고 `R-CC-14` 가 목록에 없음을 확인. 다른 in-progress plan 이 `R-CC-22` 를
  선점하고 있지 않다는 것도 전수 grep 으로 확인(target 문서 자신만 이 번호를 언급).
  `spec-impl-evidence.md R-1` cross-ref 인용("넓은 트리 글롭으로 가드만 통과시키는 것은 아무것도
  가리키지 않는 것과 같다")도 원문과 정확히 일치.
- **pending_plans/§7 chat-channel 블록 비접촉 정당** — `15-chat-channel.md` frontmatter
  `pending_plans:` 가 가리키는 3개 backlog plan(`chat-channel-discord-gateway.md`·
  `chat-channel-slack-socket-mode.md`·`chat-channel-visual-ssr-png.md`)을 직접 열어 전부
  `status: backlog`/미착수이고 v2 범위(Gateway/Socket Mode/SSR PNG)임을 재확인 — target 의
  T1/T2 triggers 내부 구조 재배치와 무관해 건드리지 않는 것이 타당하다. §7 의 `chat-channel/`
  블록(어댑터 계층)도 이번 이동 대상 밖이라는 target 의 "안 하는 것" 서술과 일치.
  `node-cancellation-residual-signal-propagation.md`·
  `spec-update-node-cancellation-shutdown-classification.md` 의 chat-channel 관련 항목은
  이미 종결(`N/A` 처분, `spec-draft-node-cancellation-chat-channel-correction.md`)돼 있어
  target 과 무관.
- **선행 조건 완비** — target 이 전제하는 T1(`#1319`)·T2(`#1320`) 이동은
  `plan/complete/impl-chat-channel-binder.md`·`plan/complete/impl-chat-channel-binder-t2.md` 로
  이미 완료돼 있고, target 이 인용하는 실제 소스 파일 10개가 저장소에 실재함을 확인 — 아직
  오지 않은 코드를 전제로 spec 을 쓰는 상황이 아니다.
- **다른 developer-scope 후속 항목과의 경계도 유지** — `rotate-bot-token` OpenAPI 데코레이터·
  `getAppBaseUrl()` 통합·`TriggersService:` 로그 리터럴·`chat-channel-binder.service.ts`/
  `chat-channel-input-rules.ts` 구조 정리·동시 PATCH lost-update 는 전부
  `spec-draft-nullable-notation-followups.md` 에 developer 권한 항목으로 열려 있고, target 의
  "안 하는 것" 목록이 이 경계와 어긋나지 않는다(코드 사안은 developer, 이 턴은 spec 귀속 정정만).

## 요약

Target 은 `spec-draft-nullable-notation-followups.md` 트래커가 명시적으로 열어 둔 세 결정
(`code:` glob 폭 · `setupChatChannel` 귀속 · `slack`/`discord` 귀속)을 정본 매처·직접 파일 대조로
실측해 정확히 집행하는 턴이며, 3→7곳으로 확장된 이번 판본도 직전 `--spec` 세션이 지적한
WARNING/INFO 전항목을 흡수해 새로운 불일치를 만들지 않았다. 유일한 잔여 사항은 이미 인지·
체크리스트에 반영된 co-located 완료 주석의 미실행(INFO)뿐이며, target 자체의 정합성을 해치지
않는다.

## 위험도

LOW

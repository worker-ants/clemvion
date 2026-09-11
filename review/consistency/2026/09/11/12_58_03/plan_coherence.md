# Plan 정합성 검토 — `details[].code` 배선 PR (`impl-details-code-c8f31a`)

## 검토 범위 요약

target 스코프(`spec/5-system/`)의 실제 델타는 0(코드 전용 PR). 실질 target 은
`origin/main...HEAD` diff 10개 파일 / 829줄 — `password.util.ts`·`chat-channel-config.dto.ts`·
`chat-channel-rejection-messages.const.ts`(신규)·`triggers.service.ts` 등, `plan/in-progress/`
소유 문서는 `impl-details-code-wiring.md`(신규, owner: developer)와
`spec-draft-nullable-notation-followups.md`(owner: planner, 기존 문서에 78줄 추가)다. 커밋
이력(`0710021f0`~`a81e9bdf9`, 4라운드 `/ai-review` + 3회 `--impl-done`류 게이트)을 plan 본문과
대조했다.

## 발견사항

- **[WARNING]** `spec-draft-nullable-notation-followups.md` 의 선행 항목 4개가 이번 PR 로
  실제 해소됐는데 체크 표시가 그대로 `[ ]` 다
  - target 위치: 이번 PR 커밋 전체(`0710021f0` A/B/C/D, `0fb691248`, `9fcce3f47`) — 코드는
    `codebase/backend/src/modules/triggers/triggers.service.ts`·`dto/chat-channel-config.dto.ts`·
    `chat-channel-rejection-messages.const.ts`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    - `:2219` `ChatChannelConfigDto.botToken 이 swagger 로 minLength:1 을 약속하는데 validator 가
      없다` → 이 PR 의 `@MinLength(1)` 추가(항목 C)로 **해소됨**
    - `:2224` `DTO @IsEmpty() 메시지와 서비스 가드 메시지가 5필드 모두 리터럴 복붙이다` → 이 PR 의
      `chat-channel-rejection-messages.const.ts` 상수화(항목 D)로 **해소됨**
    - `:2237` `서비스 가드가 details[].code 를 안 싣는다 — 파이프는 싣는다` → 이 PR 의 15자리
      배선(항목 A)으로 **해소됨** (이 항목 자체가 "남은 것 = 15곳 배선 (developer)" 라고 이미
      developer 를 지목해 뒀던 자리)
    - `:2278` `chat-channel-config.dto.ts 의 swagger.md:315 줄-번호 인용이 stale 해졌다` → 이 PR 의
      절 참조 전환(항목 B)으로 **해소됨**
  - 상세: 4개 항목 모두 `owner: developer` 로 지목돼 있었고 이번 PR 이 정확히 그 처방대로
    구현했다. 그런데 같은 세션이 `spec-draft-nullable-notation-followups.md` 를 **직접 편집해
    78줄을 추가**했음에도(4라운드 커밋 `9fcce3f47` "durable 트래커 등재 5건") 위 4개 선행 항목은
    체크되지 않고 새 항목만 추가됐다. `impl-details-code-wiring.md` 자신의 체크리스트(`:148-152`)
    도 *"트래커 … 앵커 문구로 지목: […] → 배선 완료 체크"* 를 여전히 미체크(`[ ]`)로 남겨 이
    간극을 스스로 인지하고 있다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 위 4개 항목을 `[x]` 로
    전환하고 완료 각주를 붙일 것. 개발자 plan 이 명시한 종결 순서(코드 커밋 → 리뷰 →
    `--impl-done` → **리뷰-only 커밋**)를 따른다면 이 갱신은 이번 `--impl-done` 통과 직후의
    커밋에서 이뤄져야 한다 — 이 리포트가 그 시점 이전에 실행됐다면 지금 시점 기준으로는
    간극이 실재하므로 등재하되, CRITICAL 로 올릴 사안은 아니다(내용 손실이 아니라 표시 지연).

- **[WARNING]** `impl-details-code-wiring.md` 의 라운드 이력이 실제 git 커밋 이력보다 뒤처져
  있다 — "3라운드 종결" 이후 실행된 4라운드가 plan 본문에 없다
  - target 위치: `plan/in-progress/impl-details-code-wiring.md` (파일 전체 268줄, 마지막
    섹션이 `## 3라운드 리뷰 처분 (…) — 종결` 로 끝난다)
  - 관련 plan: 동일 문서의 `## 정지 규칙` 절 — *"최대 3라운드. 4라운드가 필요해지면 멈추고
    사용자에게 보고한다."*
  - 상세: 실제로는 4라운드(`review/code/2026/09/11/12_41_25`)가 실행됐고 커밋
    `9fcce3f47`("리뷰 인용 규약 위반 2건 정정 + authConfigId 미해결 판정 앵커 주석")과
    `a81e9bdf9`("4라운드 종결")이 이를 기록한다. `9fcce3f47` 커밋 본문은 3라운드 상한 초과
    사유(자기 자신이 그 턴에 넣은 인용 규약 위반을 그대로 머지하는 것이 상한 준수보다 나쁘다)를
    투명하게 적고 있어 **판단 자체는 합리적**이지만, 그 판단과 결과가 **plan 문서 본문에는
    반영되지 않았다** — `impl-details-code-wiring.md` 를 단독으로 읽으면 "3라운드에서 정확히
    멈췄다" 로 읽힌다. 이 plan 이 `plan/complete/` 로 이동하면 "정지 규칙을 넘긴 결정과 그
    근거"가 git log 에만 남고 plan 이력에서는 사라진다(`--impl-done` `review/consistency/…/12_18_21`
    checker 가 이미 지적한 "durable 트래커 등재" 필요성과 같은 클래스의 위험).
  - 제안: `impl-details-code-wiring.md` 에 `## 4라운드 리뷰 처분 (…) — 종결` 섹션을 추가해 실제
    라운드 수·초과 사유·수렴 궤적(R1 5개→R2 2개→R3 2개→R4 2개, CRITICAL 0 유지)을 옮겨 적을 것.

- **[INFO]** `impl-details-code-wiring.md` 가 예고한 신규 트래커 등재 1건이
  `spec-draft-nullable-notation-followups.md` 에 아직 없다
  - target 위치: `plan/in-progress/impl-details-code-wiring.md:153-155` (체크리스트,
    `[ ]` 미완료 상태로 정직하게 표시돼 있음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 대응 항목 부재
    확인(`grep` 전수 — "무자격"·"BOT_TOKEN_INVALID"·"형식 검증" 키워드가 이 파일에 0건)
  - 상세: *"`2-trigger-list.md` 의 `botToken` 형식 정규식이 provider 무자격(planner) ·
    provider별 형식 검증 미구현"* 항목은 developer plan 에만 있고, 4라운드 커밋이 함께 이관한
    "durable 트래커 등재 5건" 목록에도 빠져 있다. `impl-details-code-wiring.md` 는
    `spec_impact: none` 이라 언젠가 `plan/complete/` 로 이동할 텐데, 그때까지 이 항목이
    `spec-draft-nullable-notation-followups.md` 로 옮겨지지 않으면 planner 대상 항목이 유실된다.
  - 제안: 위 리뷰-only 커밋에서 이 항목도 함께 이관할 것. CRITICAL/WARNING 은 아니다 — developer
    plan 자신이 미완료로 정직하게 표시해 뒀고 아직 `complete/` 이동 전이라 유실이 확정된 것은
    아니다.

## 확인했으나 문제 없다고 판단한 항목 (근거 기록)

- **`authConfigId` 자리에 `code: ErrorCode.INVALID_FIELD` 를 추가한 것**(§5.3 "둘을 겹쳐 쓰지
  않는다" 와의 긴장)은 사전에 존재하던 "결정 필요" 항목을 우회한 것이 아니라, 이 PR 자신이
  3라운드 리뷰 중 발견해 **그 자리에서 새로 만든 미결 사안**이다. 코드에 판정 미해결 주석을
  남기고 `spec-draft-nullable-notation-followups.md:2336` 에 planner 결정 대기 항목으로 등재했으며,
  두 관련 spec 파일(`2-api-convention.md`·`15-chat-channel.md`)이 이미 그 문서의 `spec_impact`
  목록에 있다. 일방적 결정 우회로 보지 않는다.
- `botToken` `@MinLength(1)` 추가나 `details[].code` 15자리 배선이 다른 in-progress
  plan(`chat-channel-discord-gateway.md`·`chat-channel-slack-socket-mode.md`·
  `chat-channel-visual-ssr-png.md` 등)의 전제나 `details` 응답 형태 가정과 충돌하는지 확인했으나
  해당 문서들에 관련 언급이 없어 충돌 없음.
- `TriggersService` 모듈 경계 추출("E")을 별 PR 로 미룬 것은 별도의 경쟁 plan 이 존재하지 않아
  중복·충돌 위험이 없다.

## 요약

코드 diff 자체는 자신이 참조하는 두 plan 문서(`impl-details-code-wiring.md`,
`spec-draft-nullable-notation-followups.md`)와 내용상 매우 촘촘하게 대조돼 있고, 새로 발견한
미결 사안(§5.3 `authConfigId` 판정, `15-chat-channel.md` stale 서술)은 일방적으로 결정하지 않고
정확히 등재해 두었다 — "미해결 결정과의 충돌" 관점에서는 CRITICAL 사안이 없다. 다만 "후속 항목
누락" 관점에서는 실측 가능한 간극이 있다: 이번 PR 이 실제로 완료한 4개 선행 항목(§C/D/A/B)이
`spec-draft-nullable-notation-followups.md` 에서 여전히 미체크 상태이고, `impl-details-code-wiring.md`
자체의 라운드 이력도 실제 4라운드 git 이력보다 한 라운드 뒤처져 있다. 둘 다 개발자가 선언한
"코드 커밋 → 리뷰 → `--impl-done` → 리뷰-only 커밋" 순서상 다음 커밋에서 닫힐 것으로 보이는
성격의 간극이라 CRITICAL 로 올리지 않았지만, 그 커밋이 실제로 이 네 체크박스와 라운드 이력
갱신을 포함하는지는 별도로 확인이 필요하다.

## 위험도

LOW

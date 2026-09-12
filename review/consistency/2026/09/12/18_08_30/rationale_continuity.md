# Rationale 연속성 검토 — spec/5-system/ (--impl-done, chat-channel-rules-cleanup)

대상: `origin/main...HEAD` diff 14개 파일 (`codebase/backend/src/modules/triggers/**` 리팩터 +
`repo-guards/__tests__/dto-class-name-collision*` 신설). scope(`spec/5-system/`) 델타는 0개 —
이 브랜치는 spec 을 바꾸지 않았다(`spec_impact: none`, 순수 코드 리팩터). 대조군은
`spec/5-system/15-chat-channel.md` `## Rationale` (R1~R9, R-K, R-CC-10~23), `spec/2-navigation/
2-trigger-list.md`(R-12 등), `plan/in-progress/chat-channel-rules-cleanup.md`, 그리고 선행
`review/consistency/2026/09/12/15_53_35/rationale_continuity.md`(--impl-prep 라운드, WARNING 1건)다.

## 발견사항

없음 — CRITICAL·WARNING 급 발견 없음.

## 확인했으나 문제 없음 (근거만 기록)

- **선행 --impl-prep WARNING(신규 DTO 파일이 R-CC-22 glob 밖으로 나갈 위험)이 실제로 한 번
  재현됐다가, 코드 자체에 새 Rationale 를 남기며 정정됐다** — 3(결정의 무근거 번복) 관점에서
  **모범적으로 통과**하는 사례라 상세히 남긴다.
  - 신규 파일 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 의 헤더 주석이
    스스로 이력을 적는다: 첫 판본은 `dto/chat-channel-*.dto.ts` glob(R-CC-22)에 맞추려 평평한
    `dto/` 에 뒀는데, `swagger.md §5-1`(`dto/responses/*-response.dto.ts` 규약)을 어겨
    `review/code/2026/09/12/16_39_18` requirement WARNING 이 잡았다. **"규약이 자리를 정하고
    glob 은 그 자리를 덮도록 고치는 도구"** 라는 이유를 명시하며 `dto/responses/` 로 옮겼다 —
    결정을 뒤집으면서 **그 자리에 새 근거를 함께 적은** 경우다.
  - 실측 확인: `review_guard._glob_to_regex("codebase/backend/src/modules/triggers/dto/
    chat-channel-*.dto.ts")` 는 `*` 가 `/` 를 안 넘어 `dto/responses/chat-channel-rotate-bot-
    token-response.dto.ts` 에 **매치하지 않는다**(직접 컴파일해 확인). 즉 15-chat-channel.md
    자신의 narrow glob 은 이 파일을 못 본다 — R-CC-22 가 막으려던 실패 형태(신규 파일이
    `code:` 밖으로 나가 `--impl-done` 술어가 발동하지 않음)가 **형태상 재현**됐다.
  - 그런데 spec-link 판정 자체는 깨지지 않았다: `spec/2-navigation/2-trigger-list.md` 의
    (이 PR 이 건드리지 않은, 기존) `codebase/backend/src/modules/triggers/dto/**` 광역 glob 이
    같은 자리를 덮는다(직접 컴파일해 매치 확인) — 게이트는 지금 정상 작동한다.
  - **이 사실은 developer 가 스스로 인지·기록했다**: `plan/in-progress/
    spec-draft-nullable-notation-followups.md:3082-3095` 에 "`15-chat-channel.md` 의 `code:`
    glob 이 `dto/responses/` 를 못 잡는다" 항목을 **planner 처분**(`glob 을
    dto/**/chat-channel-*.dto.ts 로 넓힌다`)으로 신규 등재했고, "지금 spec-link 판정이 깨진
    상태는 아니다 — `2-trigger-list.md` 의 `dto/**` 가 그 자리를 덮는다" 라고 안전망의 정체까지
    적었다. R-CC-22 본문은 아직 이 갱신 전이라(이 PR 이 spec 을 안 건드리므로) "narrow glob 3개가
    10개를 정확히 덮는다"는 측정치가 실제로는 11번째 파일에서 타 spec 의 광역 glob 에 의존하는
    상태로 **한 걸음 벗어났지만**, 이는 **결정 번복이 아니라 새로 생긴 파일에 대한 알려진·등재된
    갭**이고 정정 주체(planner)와 처분(glob 확장)이 이미 못박혀 있다 — CRITICAL/WARNING 으로
    올릴 사유 없음.
- `throwInvalidField`/`hasField`/`rejectBlockedField` 헬퍼 추출과 11개 호출부 치환은 **응답
  형태·에러 코드·검증 순서를 바꾸지 않는 순수 구조 리팩터**다(실측: 뮤테이션 4종 RED 26·36·2·8건,
  `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/
  `assertInboundSigningPlaintextByProvider` 어디도 새 결정을 내리지 않는다) — R-CC-21(PATCH 는
  `botToken`·`inboundSigningPlaintext` 를 안 받는다)과 R-12(provider 변경 금지, `2-trigger-list.md`)
  둘 다 그대로 유지된다.
- `incoming.provider &&` falsy-guard 를 "도달 불가로 실측했지만 남긴다" 는 설계 판단은 R-CC-21 을
  번복하지 않는다 — 오히려 DTO 층 우회 호출자에게 거짓 메시지를 주지 않기 위해 **기존 결론을
  실제 도달 경로까지 정직하게 넓히는 것**이고, `dto/trigger-dto-validation.spec.ts` 에 그 DTO 층
  강제(`provider` 필수 상속)를 고정하는 신규 테스트가 함께 들어와 "도달 불가" 주장이 vacuous 하지
  않다.
- `chat-channel-rejection-messages.const.ts`/`dto/chat-channel-config.dto.ts` 의 stale
  `TriggersService` 귀속 주석 정정은 `#1319`/`#1320` 의 실제 이동 이력과 일치하는 사실 정정이며
  새 결정이 아니다.
- R-CC-23(`setupChannel` 실패는 원인으로 분류, 502 도입)은 이 PR 이전 커밋(`8964a7114`→
  `e4e259530`)에서 이미 완결됐고, 이번 diff 는 그 코드를 건드리지 않는다 — 번복·재도입 없음.
- 신규 `repo-guards/__tests__/dto-class-name-collision*`(AST 기반 정적 가드)는 라운드 1에서
  developer 자신이 만든 CRITICAL(동명 클래스로 swagger 스키마 덮어쓰기)의 재발 방지책이며,
  기존 Rationale 이 다루는 어떤 기각된 대안도 재도입하지 않는다(정규식 대신 AST 채택은 이
  저장소의 기존 "정적 가드: blind 정규식 vs 정밀 파서" 관례와 정합 — `swagger.md`/형제 가드
  패턴 계승).

## 요약

이번 diff 는 `spec/5-system/`(및 관련 `2-navigation/2-trigger-list.md`)의 어떤 Rationale 도
기각한 대안을 재도입하거나 합의 원칙을 위반하지 않는다. 유일하게 흥미로운 지점(R-CC-22 narrow
glob 이 신규 `dto/responses/` 파일을 못 잡는 재발 형태)은 developer 가 스스로 실측하고, 코드
주석과 트래커 양쪽에 **번복 사유(규약이 자리를 정하고 glob 은 도구)를 함께 남긴 채** planner
처분 항목으로 등재해 두었다 — 결정을 뒤집을 때 새 근거를 동반해야 한다는 원칙(§3)을 정확히
지킨 사례다. 6라운드 `/ai-review` 가 이미 CRITICAL 0 · WARNING 0(라운드 6 조치 후)으로
수렴했고, 이번 검토에서도 새로운 Rationale 위반은 발견되지 않았다.

## 위험도
NONE

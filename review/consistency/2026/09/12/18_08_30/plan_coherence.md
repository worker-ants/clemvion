# Plan 정합성 검토 — `spec/5-system/` (--impl-done)

## 검토 범위

- Target: `spec/5-system/` (diff-base `origin/main`, scope 델타 0 — 이 PR 은 spec 을 바꾸지
  않는다. `plan/in-progress/chat-channel-rules-cleanup.md` frontmatter 의 `spec_impact: none` 과
  일치)
- 실제 구현 diff: `codebase/backend/src/modules/triggers/chat-channel-input-rules.{ts,spec.ts}` ·
  `chat-channel-rejection-messages.const.ts` · `dto/chat-channel-config.dto.ts` ·
  `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` · `triggers.controller.ts` ·
  `triggers.service.ts` · `dto/trigger-dto-validation.spec.ts` · `triggers.service.spec.ts` ·
  신규 `repo-guards/__tests__/dto-class-name-collision*`
- 대조한 소유 plan: `plan/in-progress/chat-channel-rules-cleanup.md` (developer, 이번 diff 의
  작업 plan)
- 대조한 상위 트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md` (owner:
  planner/developer 혼재, `chat-channel-input-rules.ts` 구조 정리 6건 · spec 잔여 보강 5건 ·
  `rotateBotToken` swagger 잔여 항목 소유)
- 대조한 인접 backlog plan: `chat-channel-discord-gateway.md` · `chat-channel-slack-socket-mode.md` ·
  `chat-channel-visual-ssr-png.md` (모두 status: backlog) — 이번 diff 가 건드리는 식별자·구조에
  대한 참조 없음(grep 0건)
- 직전 라운드: `review/consistency/2026/09/12/15_53_35/plan_coherence.md` (`--impl-prep`, 위험도
  NONE) — 그 보고서가 "완료 시점에 확인 필요" 로 남긴 항목(아래 발견사항 1)을 본 라운드에서 재확인

## 발견사항

- **[INFO]** 직전 `--impl-prep` 라운드가 유보한 확인 사항 — "짝 트래커 항목이 열린 채로
  유지되는가" 는 **그대로 충족**됨
  - target 위치: 없음(코드 전용 변경, target spec 델타 0)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` L2973 (`15-chat-channel.md §7` 파일
    트리 wording, planner 소유, 여전히 `[ ]`) vs L2981 (`chat-channel-input-rules.ts` 구조 정리
    6건, developer 소유, 본 PR 로 `[x]` 종결)
  - 상세: `chat-channel-rules-cleanup.md` 설계 판단 (2)에서 예고한 대로 파일 분리는 하지 않고
    헤더 주석만 넓혔다(`chat-channel-input-rules.ts` 상단 diff 확인). 짝을 이루는 planner 항목
    (§7 파일 트리 wording)은 이번 diff 가 손대지 않았고 트래커에도 `[ ]` 로 열려 있다 —
    developer 축이 planner 소관 결정(파일 분리·§7 문서 수정)을 선취하지 않았다.
  - 제안: 없음 — 다음 planner 턴에서 L2973 처리 시 이번 판단(파일 미분리)을 입력으로 반영.

- **[INFO]** 소유 plan(`chat-channel-rules-cleanup.md`) 자체 체크리스트가 실제 완료 상태보다
  뒤처져 있다
  - target 위치: 없음(plan 자체 문서 위생)
  - 관련 plan: `chat-channel-rules-cleanup.md` §체크리스트 — `1~4`·`5`·`6`·`run-test-all.sh`·
    `/ai-review` + `--impl-done`·`트래커 항목 종결`·`plan/complete/ 이동` 이 전부 `[ ]` 로 남아
    있음
  - 상세: 그러나 같은 문서의 §실측 기록·§정지 규칙 보정 섹션과 `git log`(`e07521a27`·
    `d8ad68b25`·`18b0c6aa6`·`3c9f4dd12`·`01f03524c`·`f978f8d77`·`e59141866`, `review/code/2026/09/12/*`
    6라운드)는 작업 1~6 이 모두 반영되고 `/ai-review` 가 이미 라운드 6까지 진행됐음을 보여준다.
    상위 트래커(`spec-draft-nullable-notation-followups.md`)도 관련 세 항목을 이미
    `[x]` + "2026-09-12 종결" 로 표시했다. 즉 **실제 작업·상위 트래커는 최신인데 소유 plan
    자신의 체크리스트만 초기 상태로 남아 있다** — `plan/complete/` 이동 직전 체크박스 동기화가
    필요하다는 기존 교훈(체크와 이동은 한 동작)과 같은 패턴.
  - 제안: `plan/complete/` 로 이동하기 전에 이 체크리스트를 실제 상태로 갱신할 것. 다른 plan 과의
    충돌은 아니므로 CRITICAL/WARNING 은 아님.

- **[INFO]** 미확정으로 남아 있는 두 트래커 항목(트리거 활성화 재호출 여부)은 이번 diff 범위 밖
  - target 위치: `spec/5-system/15-chat-channel.md` L379, L433 ("이 재호출이 실제로 일어나는지
    미확정 — 확인 중")
  - 관련 plan: `spec-draft-nullable-notation-followups.md` 「§5.4.1 표 2행이 구현과 어긋날 수
    있다」 항목, 여전히 미해결(`- [ ]`)
  - 상세: 이번 diff 는 `chat-channel-input-rules.ts` 의 검증 헬퍼 추출과 `triggers.service.ts`
    의 `botIdentity` 반환 타입 정정(1곳, `NonNullable<ChatChannelConfig['botIdentity']>`)만
    바꾼다 — `update()` 의 `if (chatChannel)` 게이팅이나 `setupChannel()` 재호출 경로는
    diff 에 없다(`git diff origin/main -- triggers.service.ts` 확인, 변경 5줄 전부 타입 주석).
    따라서 이 미확정 사실에 대해 새로운 주장을 하거나 우회하지 않는다.
  - 제안: 없음.

- **[INFO]** 신규로 등재된 harness 갭("사전 naming 게이트가 예고한 이름만 본다")은 기존
  harness 트래커와 중복되지 않음
  - target 위치: 없음(harness 프로세스 항목)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` L3041 (신규, `[x]` 처방 완료) vs
    `harness-review-gate-followups.md` (naming_collision 관련 기존 항목들은 checker 예산/3분할
    문제이며 "구현 중 태어난 식별자" 사각지대는 별개 결함 클래스, grep 대조로 중복 없음 확인)
  - 상세: 새 가드(`repo-guards/__tests__/dto-class-name-collision*`)가 코드로 고정됐고 별도
    트래커 파일과 충돌하지 않는다.
  - 제안: 없음.

## 요약

이번 `--impl-done` 대상 diff(`chat-channel-rules-cleanup`)는 `spec/5-system/` 을 전혀 변경하지
않으며(`spec_impact: none` 과 실측 델타 0 이 일치), 상위 트래커
(`spec-draft-nullable-notation-followups.md`)의 developer 소유 세 항목(구조 정리 6건·spec
잔여 보강 5건·swagger 문서화)을 정확히 마감했다. planner 소관으로 명시적으로 유보한 파일-분리
결정은 이번 PR 이 선취하지 않고 짝 트래커 항목(§7 wording)에 그대로 남겨 두었으며, target 이
여전히 미확정으로 표시한 트리거 활성화 재호출 경로는 diff 범위 밖이라 영향이 없다. Discord
Gateway·Slack Socket Mode·SSR PNG 세 backlog plan 의 미해결 사용자 결정 항목도 이번 diff 가
참조하지 않는다. 유일한 지적은 소유 plan 자신의 체크리스트가 실제 완료 상태(상위 트래커·
git log·6라운드 리뷰로 확인됨)를 아직 반영하지 않는다는 plan 위생 이슈이며, 이는 다른 plan 과의
충돌이 아니라 `plan/complete/` 이동 전 동기화가 필요한 자체 문서 상태다.

## 위험도

NONE

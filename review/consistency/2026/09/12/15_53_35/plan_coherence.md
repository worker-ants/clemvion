# Plan 정합성 검토 — `spec/5-system/15-chat-channel.md` (--impl-prep)

## 검토 범위

- Target: `spec/5-system/15-chat-channel.md` (frontmatter `pending_plans`: discord-gateway ·
  slack-socket-mode · visual-ssr-png)
- 착수 예정 작업: `plan/in-progress/chat-channel-rules-cleanup.md` (developer, `chat-channel-input-rules.{ts,spec.ts}`
  구조 정리 + swagger 문서화, `spec_impact: none`)
- 대조한 트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md` (owner: planner,
  `spec_impact` 에 본 target 포함) — 프롬프트 번들에서는 예산 초과로 절단되어 `Read` 로 직접 열어 대조함
- 대조한 backlog plan: `chat-channel-discord-gateway.md` · `chat-channel-slack-socket-mode.md` ·
  `chat-channel-visual-ssr-png.md` (모두 `status: backlog`, 사용자 결정 대기)

## 발견사항

- **[INFO]** `chat-channel-rules-cleanup.md` 의 작업 범위가 트래커 항목과 1:1로 정확히 대응함
  - target 위치: `spec/5-system/15-chat-channel.md` §7 파일 트리 · R-CC-23 (`§5.4 Bot Token Rotation API`)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` 의 세 developer 항목 — 「`chat-channel-input-rules.ts`
    구조 정리 6건」(L2972) · 「`chat-channel-input-rules.spec.ts` 잔여 보강 5건」(L2987) ·
    「`rotateBotToken` 의 swagger 응답 문서화 잔여 — 404 와 200 봉투」(L2920)
  - 상세: `chat-channel-rules-cleanup.md`「작업」표 1~6행이 위 세 트래커 항목의 하위 항목과 정확히
    일치한다. 특히 (c) "절단 길이 256 매직 넘버"를 "소멸"로 재판정한 것은 코드 실측(`grep 256` 0건)과
    R-CC-23("응답 본문에서 provider 원문 echo 를 중단한다")의 결과가 서로 들어맞는다 — 직접
    `chat-channel-input-rules.ts` 를 확인해 `256` 리터럴이 실제로 없음을 재확인했다.
  - 제안: 없음. 착수해도 무방.

- **[INFO]** `§7` 파일 트리 wording 불일치는 developer 축이 의도적으로 미해결로 남기고 planner 로
  넘긴 상태 — 계획대로 진행 중
  - target 위치: `spec/5-system/15-chat-channel.md` §7 파일 트리, `chat-channel-input-rules.ts # 입력
    검증·변환 순수 함수 (R-CC-21 정본...)` 서술
  - 관련 plan: `spec-draft-nullable-notation-followups.md` L2964-2970 (planner 항목, "그 파일은
    `translateSetupChannelError`(출력측 에러 변환)도 담는데 §7 서술은 '입력 검증·변환 순수 함수'다")
  - 상세: `chat-channel-rules-cleanup.md` 설계 판단 (2)가 "이번 턴에는 헤더 주석만 넓히고 파일을
    쪼개지 않는다 — 분리는 planner 항목이 §7 을 손볼 때 같이 결정한다"고 명시해, 이 spec 서술
    불일치를 **일방적으로 해소하지 않고** 페어링된 planner 항목에 그대로 남겨둔다. 결정 권한 밖의
    항목(파일 분리 여부, §7 문서 수정)을 developer 가 대신 확정하지 않는 점에서 미해결 결정 우회가
    아니다.
  - 제안: 향후 planner 턴에서 L2964 항목을 처리할 때 이 developer 턴의 판단(파일을 안 쪼갠다)을
    입력으로 반영. `chat-channel-rules-cleanup.md` 체크리스트의 "트래커 항목 종결"이 L2972 항목만
    닫고 L2964(짝 항목, planner 소유)는 열어 둔 채로 유지되는지 완료 시점에 확인 필요.

- **[INFO]** target 이 참조하는 backlog plan 세 건과 충돌 없음
  - target 위치: CCH-MP-04(§3.3, SSR PNG v2) · R-CC-13(Discord v1 CCH-MP-01 부분 유예) · CCH-AD-01(provider
    카탈로그)
  - 관련 plan: `chat-channel-discord-gateway.md`(backlog, R-D-3 번복은 사용자 결정 필요) ·
    `chat-channel-slack-socket-mode.md`(backlog, R-S-3 번복은 사용자 결정 필요) ·
    `chat-channel-visual-ssr-png.md`(backlog, SSR 라이브러리 선정만 잔존 결정)
  - 상세: target 문서는 이 세 항목 모두를 "v2/후속" 으로만 서술하고 v1 동작을 그것에 의존시키지
    않는다(Discord v1 부분 유예를 provider spec 쪽 Rationale 로 위임, SSR PNG 는 v1 fallback 이
    독립 동작). 즉 target 이 backlog plan 의 미해결 결정(SSR 라이브러리 선정, Gateway/Socket Mode
    도입 여부)을 선취해 확정하지 않았다.
  - 제안: 없음.

- **[INFO]** target 자신이 이미 두 건의 미해결 사실을 plan 참조로 정확히 표시 중
  - target 위치: §5.4.1 표 "트리거 활성화" 행(L404, L458) — "이 재호출이 실제로 일어나는지 미확정 —
    확인 중" 문구가 `spec-draft-nullable-notation-followups.md` 의 「§5.4.1 표 2행이 구현과 어긋날
    수 있다」(L2153, 미체크)를 직접 인용
  - 관련 plan: 위 트래커 항목, 현재도 미해결(`- [ ]`)
  - 상세: target 이 결론을 내리지 않고 열린 질문으로 정확히 표시하고 있어 문제 없음. 다만 이 항목은
    이번 developer 턴(`chat-channel-rules-cleanup.md`)의 범위 밖이므로 이번 PR 로 해소되지 않는다는
    점만 확인.
  - 제안: 없음 — 별도 조사 턴 필요 시 그 트래커 항목에서 진행.

- **[INFO]** 같은 트래커 안의 planner 전용 잔여 항목(§3.x 절 번호 중복 · rate-limit 카탈로그 행 누락 ·
  slack.md 열거값 확정)은 이번 developer 턴과 무관, 영향 없음
  - target 위치: `## 3. 처리 흐름`(§3.1~3.3) vs `### 3. 요구사항`(§3.1~3.6) 절 번호 중복 /
    `2-api-convention.md §7` CCH-NF-03 미등재 / `providers/slack.md §3.1` 개방형 열거
  - 관련 plan: `spec-draft-nullable-notation-followups.md` L2959(WARNING 3) · L2953(WARNING 2) ·
    L2939(INFO 2), 모두 `--impl-prep 12_54_15`(같은 날 이전 실행)에서 planner 축으로 등재, 미체크
  - 상세: `chat-channel-rules-cleanup.md` 는 이 세 항목이 걸린 문서·표를 건드리지 않는다
    (`spec_impact: none`, 코드 레벨 리팩터만). 새로 만들거나 무효화하는 후속 항목 없음.
  - 제안: 없음 — 별도 planner 턴에서 처리될 사안.

## 요약

이번 --impl-prep 대상 `chat-channel-rules-cleanup.md`(developer, `chat-channel-input-rules.{ts,spec.ts}`
구조 정리)는 `spec-draft-nullable-notation-followups.md` 트래커의 developer 태그 항목 세 건과 정확히
1:1 대응하며, 미해결 결정을 우회하거나 선행 plan 을 무시하는 지점이 없다. 파일 분리(§7 wording
불일치의 근본 해소) 같은 planner 소관 결정은 명시적으로 유보해 짝 트래커 항목에 남겨두었고,
"256 매직 넘버 소멸" 재판정도 실측(코드 grep)과 target 문서의 R-CC-23 서술이 서로 일치함을
확인했다. Discord Gateway/Slack Socket Mode/SSR PNG 세 backlog plan 의 미해결 결정도 target 이
선취하지 않고 v2 로 정확히 위임하고 있다. 같은 트래커 안에 남아 있는 planner 전용 항목(§3.x 절 번호
중복, rate-limit 카탈로그 행 누락, slack 열거값 확정)은 이번 작업의 diff 범위 밖이라 영향이 없다.

## 위험도

NONE

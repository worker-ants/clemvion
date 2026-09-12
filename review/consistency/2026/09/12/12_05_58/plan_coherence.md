# Plan 정합성 검토 — `spec-draft-setup-error-classification.md` (2회차)

## 발견사항

- **[WARNING]** 결정 (5)의 문서 축약이, 다른 plan 이 "정답 텍스트"로 인용 중인 문장을 무효화한다 — botToken 형식검증 잔여 항목(developer 갈래)이 갱신 안 됨
  - target 위치: `## 결정` (5) "복제된 3곳은 문장을 지우고 §5.4 로 보낸다" 및 결함③ 표의
    `spec/2-navigation/2-trigger-list.md` 행 (편집 대상 원문 ⓔ)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2697-2722`
    "`botToken` provider 별 형식 검증이 문서에만 있고 코드에 없다" 항목의 **"developer 갈래는
    존속한다"** 단락 (`:2720-2722`)
  - 상세: 그 백로그 항목은 이미 **planner 갈래를 닫으며** `2-trigger-list.md §2.3.1` 문장을
    *"서버는 형식을 검증하지 않는다 — 잘못된 토큰은 `setupChannel` 의 외부 provider API
    **401/403** 에서 `BOT_TOKEN_INVALID` 로 드러난다"* 로 확정해 두고, 남은 **developer 갈래**
    (실측: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram{,.en}.mdx:67,130`
    및 `56,117` · `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts:212,221` 4곳)를
    *"spec 과 **같은 사실**을 말하므로 반드시 짝으로 처리돼야 한다"* 고 명시한다 — 즉 developer 가
    이 4곳을 고칠 때 **그 401/403 문장을 정답으로 베낀다.**
    target 은 바로 그 문장(2-trigger-list.md 의 "401/403 에서 드러난다")을 **결함③의 복제 사례로
    지목**해 §5.4 링크로 축약·삭제한다 — 그리고 §5.4 자체의 내용도 "401/403" 한정에서 "신호
    방식 무관(provider 자격 증명 거부 전반)"으로 바뀐다(결정 (1)·결함①). 4개 MDX/i18n 파일 중
    `telegram.mdx:130`·`telegram.en.mdx:117` 은 **이미 "502 CHAT_CHANNEL_SETUP_FAILED"도
    같은 줄에 인용**하고 있어, developer 가 이 항목에 착수하는 시점에 "정답"으로 참조할 spec
    문장 자체가 이번 target 반영 전/후로 내용이 달라진다. 문서만 보고 그대로 "401/403" 으로
    맞추면 target 결함①이 지적한 것과 **같은 클래스의 오류(2/3 provider 에서 성립하지 않는
    서술)**를 developer 트랙 문서에 새로 심는 결과가 된다.
  - 제안: target 의 "구현 위임" 또는 "안 하는 것" 절에 한 줄 추가 — *"`spec-draft-nullable-notation-followups.md`
    의 `botToken` 형식검증 잔여(developer 갈래, MDX·i18n 4곳)가 인용할 정답 문장은 이제 §5.4 의
    원인-기반 서술(신호 방식 무관)이지 "401/403" 이 아니다. 그 항목 착수 시 본 결정을 먼저 반영할
    것."* 이 문구를 그 백로그 항목(`:2720-2722`) 옆에도 남기면 이상적이다.

- **[INFO]** `3-error-handling.md §1` 중앙 카탈로그 미등재 결함이 실행 가능한 백로그 항목 없이
  프로즈로만 유예됨
  - target 위치: `## 안 하는 것` 세 번째 항목 ("`3-error-handling.md §1` 중앙 카탈로그에
    chat-channel rotate 코드군 등재")
  - 관련 plan: 해당 없음 — `plan/in-progress/**` 어디에도 `BOT_TOKEN_INVALID`·
    `CHAT_CHANNEL_SETUP_FAILED` 의 중앙 카탈로그 등재를 추적하는 항목이 없다(실측, grep 0건)
  - 상세: target 은 *"트래커에 남긴다"* 라 적지만 실제로 그 대상이 되는 `plan/in-progress/` 파일이
    없다 — 이 draft 가 `plan/complete/` 로 이동하면(체크리스트 마지막 항목) 그 유예 근거를 담은
    유일한 문서가 완료함으로 봉인된다. 같은 클래스의 기존 갭들(`AUTH_CONFIG_NOT_FOUND` 등,
    `spec-draft-nullable-notation-followups.md:2627`)은 최소한 `spec-draft-nullable-notation-followups.md`
    라는 살아있는 트래커에 남아 있다는 점과 대비된다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 또는 새 항목에 "chat-channel
    rotate 코드군(`BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED`)이 `3-error-handling.md §1`
    중앙 카탈로그에 미등재" 한 줄을 등재하거나, `plan/complete/` 이동 커밋 메시지에 이 갭의
    후속 위치를 명시할 것.

## 요약

1회차에서 제기된 CRITICAL(spec_impact 3곳 누락·복제)과 WARNING 4건(message-prefix 원칙 위반·
frontmatter worktree 표기·502 미실증·인접 백로그 (d) 교차참조 누락)은 이번 target 에서 모두
실측 가능한 방식으로 반영됐다 — spec_impact 5개 파일 등재, 결정(2)의 typed `code` 전환,
frontmatter 정정, 결정(4)의 502 행 신설과 §결함②의 실측 확인, 그리고 구현위임 항목5 가
`spec-draft-nullable-notation-followups.md` 의 (d) 항목만(관련 없는 (e)는 별 함수 소관이라
제외한 것이 맞다) 정확히 교차 참조한다. `R-CC-23`/`R-CCA-9` 번호도 실측(각 최대 22/8)과 일치하고
다른 in-progress plan 과 충돌하지 않으며, 트래커 재기술 대상 worktree 부재 근거도 체크리스트에
선제적으로 기록됐다. 다만 새로 발견된 것은, target 결정(5)가 `2-trigger-list.md` 의 "401/403
에서 드러난다" 문장을 §5.4 링크로 축약하면서, 바로 그 문장을 "정답"으로 인용해 아직 미착수인
`spec-draft-nullable-notation-followups.md` 의 developer 갈래 백로그(MDX·i18n 4곳 수정)를
갱신하지 않은 점이다 — 그 백로그가 실측대로 실행되면 이번 target 이 결함①로 반증한 것과 같은
"401/403 한정" 서술을 문서에 새로 심을 위험이 있다(WARNING). 중앙 에러 카탈로그 미등재 유예는
추적 항목 없이 프로즈로만 남아 있어 완료 이동 후 유실 위험이 있다(INFO).

## 위험도

LOW

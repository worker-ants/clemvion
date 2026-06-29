# Plan 정합성 검토 — `spec/4-nodes/7-trigger/providers/slack.md`

검토 모드: spec draft (--spec)
대상 plan: `plan/in-progress/spec-sync-slack-gaps.md` (target `pending_plans` 명시), `chat-channel-slack-socket-mode.md`, `chat-channel-visual-ssr-png.md`

## 발견사항

- **[INFO]** slack-gaps plan item 1 잔여(file MIME 검증)와 target 서술 정합 — 추적 메모만 권장
  - target 위치: §4.1 `file_shared` 행 ("잔여(Planned): form `file` 필드의 MIME 검증은 … `formState` v1 한계(PR-E)에 종속")
  - 관련 plan: `spec-sync-slack-gaps.md` "미구현 항목" 첫 박스 ("`file_shared` → `files.info` 보강 → `submit_form`" — 잔여: form `file` 필드 MIME 검증, `formState.fieldsCatalog` v1 한계(PR-E)에 블록)
  - 상세: target 이 미해결 잔여를 일방 해소 처리하지 않고 "Planned + PR-E 종속" 으로 정확히 표기 — 충돌 없음. 다만 plan item 1 박스가 여전히 `[ ]` 미체크인데, target 은 핵심 경로(file_upload→form 값→submit_form)를 "구현됨" 으로 단정한다. plan 의 audit 노트(2026-06-14)도 동일하게 "핵심 경로 구현됨, 잔여는 MIME 검증뿐" 으로 정렬되어 있어 실질 충돌은 없다.
  - 제안: 정합. 잔여 MIME 검증이 PR-E(다단계 폼 fieldsCatalog) 완료 시점에 plan item 1 을 닫고 target §4.1/§5.3 의 "Planned" 표기를 제거하면 됨. 현 시점 변경 불필요.

- **[INFO]** R-S-3 (Webhook-mode only) 미해결 v2 결정과 target 정합
  - target 위치: §1 ("v1 = Webhook-mode only … Socket Mode 는 v2 옵션 (Rationale R-S-3)"), Rationale R-S-3
  - 관련 plan: `chat-channel-slack-socket-mode.md` "진입 조건 (사용자 결정 필요)" — R-S-3 기각 번복 정당화가 미해결 결정으로 남아 있음
  - 상세: socket-mode plan 은 R-S-3 의 결정 번복을 사용자 결정 대기 항목으로 둔다. target 은 Socket Mode 를 v2 로 유예한 채 결정을 일방적으로 번복하지 않으며, plan 이 가정하는 spec 진입점(§3 Socket Mode path 추가, `slackMode?` config)을 미리 도입하지도 않았다. 정합.
  - 제안: 변경 불필요. socket-mode plan 진입 시 target §3 + R-S-3 갱신 예정임이 plan 산출물 범위에 이미 기재됨.

- **[INFO]** §5.4 v2 SSR PNG 격상과 visual-ssr-png plan 정합
  - target 위치: §5.4 ("v1 = mrkdwn 텍스트/monospace 표현 … v2 SSR PNG 격상 예정", `photo` v2 = "satori SVG → PNG `files.uploadV2`")
  - 관련 plan: `chat-channel-visual-ssr-png.md` — Out of Scope 에 "다른 chat channel provider (Slack/KakaoTalk) 의 PNG 발송: 첫 SSR 인프라 도입 후 별 plan. 본 plan 은 Telegram 한정", 결정 항목 #1(SSR 라이브러리 선정)은 사용자 escalate 대기
  - 상세: target 이 `photo` v2 를 "예정" 으로만 표기하고 SSR 라이브러리·인프라를 확정하지 않아 plan 의 미해결 결정(#1)을 우회하지 않는다. visual-ssr-png plan 이 Slack PNG 를 명시적으로 Out of Scope(별 plan) 로 두었고, target 은 이를 v2 future 로만 기술 — 충돌 없음. `auto` v2 가 "text (변경 없음)" 으로 차트/표 정밀도 유지하는 점도 plan 결정 항목 #2(fallback 정책, text 우선) 와 일치.
  - 제안: 변경 불필요. Slack PNG 격상은 별 plan 으로 분리될 후속 항목 — target frontmatter `pending_plans` 에 visual-ssr-png 가 없지만, plan 이 Slack 을 Out-of-scope 로 명시했으므로 누락이 아님.

## 요약
Target spec 은 자신을 `partial` 로 두고 `pending_plans` 로 `spec-sync-slack-gaps.md` 만 가리키는데, 본문이 그 plan 의 미해결 잔여(form file MIME 검증, PR-E 종속)를 일방적으로 해소하지 않고 "Planned" 로 정확히 표기한다. v2 유예 사안(R-S-3 Webhook-only, §5.4 SSR PNG 격상)도 각각 socket-mode·visual-ssr-png plan 의 사용자 결정 대기 항목을 우회하지 않고 future 로만 기술하며, 두 plan 의 spec 진입점을 선반영하지도 않았다. 세 plan 모두와 정합하며 미해결 결정 우회·선행 미해소·후속 누락 어디에도 해당하지 않는다.

## 위험도
NONE

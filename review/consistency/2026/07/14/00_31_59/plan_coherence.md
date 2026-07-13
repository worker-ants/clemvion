# Plan 정합성 검토 — spec/5-system/15-chat-channel.md (--impl-done)

## 조사 방법 메모

payload 의 "진행 중 plan 문서 모음" 에는 diff 가 명시적으로 3회 인용하는
`plan/in-progress/eia-command-waiting-surface-guard.md` 가 **누락**돼 있었다(포함된 5개 문서는
`ai-agent-tool-connection-rewrite.md` / `cafe24-backlog-residual.md` /
`chat-channel-discord-gateway.md` / `chat-channel-slack-socket-mode.md` /
`chat-channel-visual-ssr-png.md` 뿐). diff 주석이 "F-2 (plan eia-command-waiting-surface-guard)"
를 코드 3곳에서 직접 지목하므로, payload 인용이 아니라 워킹트리의 실제 plan 파일
(`plan/in-progress/eia-command-waiting-surface-guard.md`)을 절대경로로 직접 Read 해 대조했다.
아울러 `git -C <worktree> diff origin/main...HEAD -- spec/5-system/15-chat-channel.md` 로
target spec 문서 자체의 실제 변경분(별도 커밋 `2aaa85580`, 코드 diff 스코프 밖이라 payload 에는
안 보임)도 직접 확인했다.

## 발견사항

- **[WARNING]** F-2 완료분이 추적 plan 문서에 반영되지 않음
  - target 위치: `spec/5-system/15-chat-channel.md` §4.1 `languageHints.surfaceMismatch` 표 등재 +
    §4.1.1 default 문구 서술 (커밋 `2aaa85580`), 및 `codebase/backend/src/modules/hooks/hooks.service.ts`
    의 `sendSurfaceMismatchNotice` 구현(커밋 `e041a4d01`, `a7f1cefd2`)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` §"후속 항목 (본 PR 범위 밖)" →
    F-2 ("채팅 채널 표면 불일치 입력의 graceful 안내 (form 및 buttons)")
  - 상세: 현재 브랜치(`git log origin/main..HEAD`)의 3개 커밋
    (`2aaa85580` spec/유저가이드 등재, `e041a4d01` best-effort 안내 발송 구현,
    `a7f1cefd2` ai-review WARNING fix)이 plan 이 명시한 F-2 요구사항 — "`languageHints` 신규 키
    (`surfaceMismatch`)를 `spec/5-system/15-chat-channel.md` §4.1 표에 등재하고 best-effort 안내를
    발송" — 를 정확히 그대로 이행했다(키 이름·lookup 순서(override→locale default→ko fallback)·
    swallow-on-failure 정책·CCH-ERR-04 "silently swallow 금지" 근거까지 plan 서술과 1:1 대응).
    그런데 `git diff origin/main...HEAD -- plan/in-progress/eia-command-waiting-surface-guard.md`
    가 **빈 diff** — plan 문서 자체는 이 브랜치에서 전혀 건드리지 않아, F-2 절이 여전히 "본 PR
    범위 밖" 미해결 후속 항목으로 서술돼 있다. `.claude/docs/plan-lifecycle.md` 의 push gate
    (`plan_guard.py`)는 "코드를 바꿨으면 관련 plan 을 갱신하거나 완료 시 `complete/` 로 이동"을
    같은 브랜치 diff 상에서 요구하므로, 이 상태로는 plan 추적이 실제 구현 상태와 어긋난 채
    남아 있다 (F-1/F-3 는 여전히 미해결이라 `complete/` 이동 대상은 아니지만, F-2 절만이라도
    완료 표시가 필요).
  - 제안: `plan/in-progress/eia-command-waiting-surface-guard.md` 의 F-2 절을, 이 plan 문서의
    기존 "spec 동기 (S-1) — **완료**" 절과 같은 패턴으로 "F-2 — **완료** (커밋 `2aaa85580` /
    `e041a4d01` / `a7f1cefd2`)" 로 갱신하고, 실제 반영 내용(구현 위치·spec 위치·발송 실패 swallow
    정책)을 짧게 기록할 것. F-1·F-3 는 여전히 미해결이라 plan 문서를 `plan/complete/` 로 옮기지는
    말 것.

## 요약

target(`spec/5-system/15-chat-channel.md`)과 그에 딸린 코드 변경은 `plan/in-progress/`
어디의 미해결 결정과도 충돌하지 않고, `eia-command-waiting-surface-guard.md` 가 F-2 로 명시한
요구사항(신규 `languageHints.surfaceMismatch` 키 등재 + best-effort 안내 발송, swallow-on-failure)을
문구·정책 모두 정확히 이행했다. 다만 payload 의 plan 목록에는 이 plan 파일 자체가 빠져 있었고,
실제 워킹트리를 직접 확인한 결과 그 plan 문서가 이 완료분을 전혀 반영하지 않은 채(diff 없음)
F-2 를 여전히 "본 PR 범위 밖" 미해결 항목으로 서술하고 있다 — 구현·spec 은 최신인데 plan 추적만
stale 한 전형적인 갱신 누락이다. CRITICAL 급 결정 충돌이나 선행 plan 미해소는 발견되지 않았다.

## 위험도
LOW

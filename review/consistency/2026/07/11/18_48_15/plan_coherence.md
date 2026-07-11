# Plan 정합성 검토 결과 — `spec/7-channel-web-chat/`

검토 모드: 구현 완료 후 검토 (--impl-done). diff-base=origin/main. 실제 diff(HEAD 워크트리, 절대경로로 재확인)는
`spec/7-channel-web-chat/1-widget-app.md` 1줄(§3.1 "토큰 만료/서버 타임아웃" 행, commit `924212b1b`) +
`codebase/channel-web-chat/src/lib/widget-state.ts`·`src/widget/use-widget.ts`(single-flight coalesce + 확립세션
`cancel`, commit `e577f1b69`/`7541c07f8`)로 확인됨. 프롬프트에 첨부된 `plan/in-progress/{ai-agent-tool-connection-rewrite,
cafe24-backlog-residual,chat-channel-discord-gateway,chat-channel-slack-socket-mode,chat-channel-visual-ssr-png}.md`
5건은 target(`spec/7-channel-web-chat/`)과 내용 교집합이 없다(`chat-channel-*`는 Telegram/Slack/Discord 봇 어댑터로
별개 제품 영역 — "channel" 문자열 매칭에 의한 오선정으로 추정). 실제로 target 과 직결된 plan 은 이 5건이 아니라
`plan/in-progress/spec-draft-webchat-execution-residuals.md`(본 worktree 의 실제 owner plan, frontmatter
`worktree: llm-usage-doc-alignment-01d7a4`)·`spec-sync-external-interaction-api-gaps.md`·
`spec-draft-pr874-deferred-docs.md`이며, 이들은 절대경로로 직접 읽어 대조했다.

## 발견사항

- **[WARNING]** `1-widget-app.md` §3.1 "토큰 만료/서버 타임아웃" 행(이번 branch 의 diff, commit `924212b1b`)이
  아직 미구현인 백엔드 backstop 을 기정사실로 서술
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md:88` — "per_execution 만료(재로드 시 refresh
    실패)→`401`; **idle-wait backstop 회수(EIA-RL-07) 후 재로드 상태조회→`200 status:cancelled`**." (frontmatter
    `status: implemented`, "(Planned)" 등 유보 마커 없음). 같은 파일 §R9(`1-widget-app.md:221`)·`3-auth-session.md:127`
    도 동일하게 EIA-RL-07 을 유보 없이 서술.
  - 관련 plan: `plan/in-progress/spec-draft-webchat-execution-residuals.md` §체크리스트 — "**PR-2(백엔드) idle-wait
    reaper(EIA-RL-07) — 미착수(별 세션/PR)**"(line 298). `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    도 동일 항목을 `[~]` "결정 완료, **구현 developer 위임**"(미착수)으로 병행 추적(line 23).
  - 상세: 이 행이 서술하는 시나리오는 두 개의 아직 안 끝난 선행조건에 의존한다. (1) **백엔드 reaper 자체가 코드에
    없다** — `codebase/backend/src` 전수에 `WEBCHAT_IDLE_TIMEOUT`/idle-wait reaper 관련 식별자가 0건(직접 grep
    확인, HEAD 워크트리). governing plan 이 "PR-2 미착수(별 세션/PR)"라고 명시한 것과 일치 — 즉 오늘 시점에
    방치된 익명 위젯 execution 은 실제로는 `cancelled` 로 전이되지 않고 `waiting_for_input` 로 무기한 남는다.
    (2) **위젯 클라이언트의 재로드 REST 분기도 같은 target 영역 내 자기서술상 미구현**이다 —
    `3-auth-session.md:62` 는 "아래 2단계의 **200+종료·404·복구불가 401 REST 분기**와 `401 → 낙관적 refresh 1회`
    는 여전히 **미구현(Planned)**" 이라고 명시하며, 대신 종료 감지는 SSE terminal 이벤트(5분 버퍼 replay)로만
    이뤄진다고 적는다. idle-wait timeout 은 정의상 수십 분~시간 단위로 발동하므로 5분 SSE 버퍼가 만료된 뒤
    재로드하는 경우가 전형적인데, 이 경우 위젯은 REST 분기 미구현으로 "200 status:cancelled" 를 인지하는 코드
    경로가 없다. 즉 `1-widget-app.md:88` 의 서술은 (a) 서버 mechanism 부재 + (b) 클라이언트 소비 로직 부재라는
    두 미해결 선행조건을 전제로 하면서도 아무 유보 표시가 없다 — 같은 target 영역의 다른 자리(`3-auth-session.md:62`,
    `4-security.md` §4 "동시 ≤3 캡: 현 시점 비목표" 류)는 미구현 사실을 "(Planned)"/"비목표"로 명시하는 관례를
    따르는 것과 대비된다.
  - 제안: `1-widget-app.md:88` 행에 "(EIA-RL-07 백엔드 reaper·위젯 REST 분기 모두 PR-2 대기 — 현재는 SSE
    terminal 5분 버퍼 내 replay 로만 종료 감지)" 같은 유보 문구를 추가하거나, PR-2(백엔드)·위젯 REST 분기 PR 이
    실제로 랜딩된 뒤에 이 행을 현재 형태로 확정한다. governing plan 자체가 "결정 lock, 구현은 별도 PR"이라는
    의도적 SDD 순서를 취하고 있으므로 spec 문구 자체를 되돌릴 필요는 없으나, `status: implemented` 프런트매터
    아래에서 유보 마커 없이 미구현 동작을 사실처럼 서술하는 것은 spec-coverage 감사·후속 개발자에게 오탐/오신뢰를
    유발할 수 있다.

- **[INFO]** 백로그 plan 의 완료 항목이 실제 구현 완료를 반영하지 못해 stale
  - target 위치: (참고) `codebase/channel-web-chat/src/widget/use-widget.ts` `newChat()` — 이번 branch 의 diff 로
    single-flight coalesce(A) + 확립세션 best-effort `cancel`(B-1) 이 실제로 구현·머지됨(commit `e577f1b69`/`7541c07f8`).
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:22` — "**host `resetSession` booting 중
    중복 webhook 가드**" 항목이 여전히 `[~]` "결정 완료 … **구현은 별도 channel-web-chat developer 세션**"으로
    표기돼 아직 미착수인 것처럼 읽힌다.
  - 상세: 이 항목이 가리키는 구현(위젯 single-flight coalesce)은 governing plan
    `spec-draft-webchat-execution-residuals.md:297`(PR-1 체크박스 `[x]`, `/ai-review` Critical 0 까지 완료)이
    이미 완료로 기록했고, 코드도 이번 branch 에 실재한다. 다만 이 백로그 파일은 별도 문서라 갱신되지 않았다.
    target(spec) 자체에는 영향이 없으나(§R9 는 이미 coalesce 를 정확히 서술), 후속 작업자가 이 백로그 항목만
    보고 "아직 위젯 코드가 없다"고 오판할 여지가 있다.
  - 제안: `spec-sync-external-interaction-api-gaps.md:22` 를 `[~]`(위젯 부분 완료, EIA-RL-07 백엔드만 잔여) 또는
    두 서브 항목으로 분리해 갱신. 낮은 우선순위 — governing plan 이 이미 정확하므로 차단 사유 아님.

## 요약

target(`spec/7-channel-web-chat/`) 자체에 대한 이번 branch 의 실제 변경분은 매우 작다(spec 1줄 정밀화 + 위젯
single-flight coalesce 코드). 이 변경들은 governing plan `spec-draft-webchat-execution-residuals.md`(본 worktree
소유 plan)의 결정·체크리스트와 정확히 일치하며 미해결 결정을 우회하는 지점은 없다. 다만 이번에 정밀화된
`1-widget-app.md §3.1` "토큰 만료/서버 타임아웃" 행은 governing plan 이 "PR-2(백엔드 EIA-RL-07 reaper) 미착수"로
명시적으로 남겨둔 선행조건과 "위젯 자신도 재로드 REST 분기 미구현(Planned)"이라는 인접 자기서술을, 유보 표시 없이
기정사실처럼 서술한다 — 정합성 위반이라기보다는 SDD 관례상 "결정 lock 후 spec 선기술"을 택한 결과이지만,
`status: implemented` 프런트매터·유보 마커 부재 조합이 spec-coverage 류 감사나 후속 개발자에게 오신뢰를 만들 수
있어 WARNING 으로 남긴다. 부가적으로 별도 백로그 plan(`spec-sync-external-interaction-api-gaps.md`)의 한 항목이
실제 완료된 구현을 아직 반영하지 못해 stale 상태다(INFO, 차단 사유 아님). 프롬프트에 첨부됐던 5개 plan(`chat-channel-*`
3건·`cafe24-backlog-residual`·`ai-agent-tool-connection-rewrite`)은 target 과 무관해 검토 대상에서 제외했다.

## 위험도

LOW

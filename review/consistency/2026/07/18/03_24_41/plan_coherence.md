# Plan 정합성 검토 — spec/7-channel-web-chat/

검토 모드: --impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main
대상 worktree(SoT): `/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4`

## 사전 확인 (diff 범위 재확인)

`git fetch origin main` 후 `origin/main` HEAD(`29aa918a6`)와 `git merge-base origin/main HEAD`가
정확히 일치함을 확인했다 — main 이 이 세션 이후 전진하지 않아 페이로드 오염(이 plan 자신이
`17_36_57`/`17_48_20` 라운드에서 실제로 겪은 2-dot vs 3-dot 이슈) 위험이 없다. 3-dot 기준
`git diff $(git merge-base origin/main HEAD)..HEAD` 로 실제 target 변경분을 직접 확인:

- **spec 변경**: `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:` 4줄 추가뿐(host-bridge.ts·
  use-widget.ts 증거 링크 + `§3(재전송)` 주석). 본문(정책·계약 서술)은 `origin/main` 과 동일.
- **코드 변경**: `codebase/channel-web-chat/src/lib/widget-state.ts`(+31/-16)·
  `src/widget/use-widget.ts`(+297/-31)·두 테스트 파일(대규모 신규 회귀 테스트). 두 파일 모두
  대상 spec 의 `code:`(1-widget-app.md `channel-web-chat/**` 와일드카드, 2-sdk.md 명시 경로, 3-auth-session.md
  명시 경로)가 이미 커버 — 이번 diff 로 새로 드러난 `code:` staleness 는 없음.
- **plan 변경**: `plan/in-progress/webchat-boot-single-flight.md`(+439, 본 작업 진행기록) ·
  신설 `webchat-command-failure-is-not-termination.md`(+69) · 신설 `webchat-usewidget-extraction.md`(+56).

핵심 코드 식별자(`beginBootAttempt`·`isAttemptStale`·`cannotApplyConfig`·`sessionEstablished`·
`establishConfig`·`bootGenRef`)를 워크트리 절대경로로 직접 grep 해 plan 서술과 실제 구현이
일치함을 확인했다(hallucination 없음). plan 이 인용하는 커밋(`7cfbf2557`·`cffee0d28`·`77805bd32`·
`94b66b212`·`0020f9106`·`262ef8e5b`·`2b4f198c1`)도 전부 `git log` 로 실존 확인.

## 발견사항

- **[WARNING]** apiBase 재전송-토큰 바인딩 부재가 project-planner/developer 어느 트랙에도 등록되지 않은 채 developer plan 산문 이월로만 존재
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md:109`(§R6 — sessionStorage 저장소 선택 rationale, apiBase 바인딩 미언급) · `spec/7-channel-web-chat/0-architecture.md:91`(`<api-base>` 는 `boot.apiBase` 로 **런타임 주입** — 재전송 시 값이 바뀔 수 있음을 서술하나 그 함의는 다루지 않음)
  - 관련 plan: `plan/in-progress/webchat-boot-single-flight.md:294` "이월 추가 (2026-07-17 18_39_11)" 섹션 1번째 항목
  - 상세: `session-store.ts` 의 `PersistedSession`(`executionId`/`token`/`expiresAt`/`endpoints` 4필드, 코드로 직접 확인)은 **발급 시점 `apiBase` 를 기록하지 않는다**. `wc:boot` 재전송(§3(재전송))으로 `apiBase` 가 바뀌면, 옛 `apiBase` 로 발급된 세션 토큰이 새 `apiBase` 엔드포인트로 전송될 수 있다 — target spec 은 이 함의를 어디에도 명문화하지 않았고(§R6 은 저장 위치·수명만 다룸), 이 gap 을 추적하는 plan/in-progress 항목도 없다(`grep -rn "apiBase" plan/in-progress/` 결과 0건). 이 자체는 이번 PR 이 만든 gap 이 아니다(재전송 시 복원하던 종전에도 동일 — plan 자신이 명시). 다만 **같은 "이월 (18_39_11)" 묶음의 형제 항목 2개(`ERROR→ended` 결정 필요, `useEiaSession` 분리)는 정확히 이 이유로 이미 별도 plan/in-progress 파일로 분리됐고**, 그 판단 근거("산문으로만 두면 본 plan 완료 이동 시 함께 묻힌다")는 이 항목에도 동일하게 적용된다. 직전 `plan_coherence`(`19_46_54`, `review/consistency/2026/07/17/19_46_54/plan_coherence.md`)는 이 항목을 "급하지 않음" INFO 로 낮게 매겼으나, 그 시점 이후 (a) 형제 항목이 실제로 2건 분리됐고(선례 확립) (b) 본 plan 의 실행 체크리스트가 전항목 `[x]` 로 완료에 근접했다(plan-lifecycle §2 는 "미해결 follow-up 이 하나라도 있으면 in-progress" 라 지금 당장 `complete/` 이동이 막히긴 하나, 체크리스트 완료로 이동 유혹이 커진 시점이라는 뜻이다) — 두 정황 변화로 재평가컨대 지금 시점엔 INFO 보다 WARNING 이 맞다고 판단한다.
  - 제안: (a) 보안 관련 항목이므로 별도 `plan/in-progress/` 항목(세션-origin 바인딩 설계, developer 또는 project-planner 트랙 — 세션 스키마 확장이라 후자에 가까움)으로 승격하거나, (b) 최소한 `3-auth-session.md §R6` 에 "구현 상태" 각주로 이 gap 을 명문화해 spec-impl-evidence 의 "빈 약속 방치" 리스크를 낮출 것. `AI_MESSAGE` 의 `ended` 가드 부재(같은 섹션 2번째 항목)는 "실패 사례 확인 시 확대" 조건부 관찰 항목이라 성격이 달라 이번엔 에스컬레이션 대상에서 제외했다(A-6 와 동일한 관찰→확인→조치 패턴이 이미 이 plan 안에서 검증됨).

- **[INFO]** 자매 plan(`spec-sync-external-interaction-api-gaps.md`) 의 `useEiaSession` 분리 전제 노트가 이번 축 변경으로 stale 해졌는데 상호참조가 없음
  - target 위치: `spec/7-channel-web-chat/2-sdk.md:8-9`(신규 `code:` 증거가 가리키는 `bootGenRef` 축 신설 구현)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:44` · `plan/in-progress/webchat-usewidget-extraction.md`
  - 상세: `spec-sync-external-interaction-api-gaps.md:44` 는 "`useEiaSession` 분리는 **가드가 하나로 정리된 지금 상태**에서 하는 편이 안전하다"고 적어뒀다(`worldGenRef` 단일화 직후 시점의 노트). 본 PR 은 `bootGenRef` 를 의도적으로 신설해 그 전제(축 1개)를 축 2개로 되돌렸다 — `webchat-boot-single-flight.md` 자신의 Rationale 이 이를 정확히 인지하고 "A-0 에서 토큰 캡슐화를 채택하면 호출부가 보는 축은 다시 1개가 되어 그 노트의 전제가 복원된다"고 설명하며, 신설된 `webchat-usewidget-extraction.md` 도 이 축 문제를 "선행 판단" 항목으로 이미 정확히 계승했다 — 즉 **실질적인 정보 손실은 없다.** 다만 `spec-sync-external-interaction-api-gaps.md:44` 자체는 갱신되지 않았고 신설 plan 으로의 상호참조도 없어, 이 오래된 plan 만 단독으로 읽는 미래 독자에게는 축이 여전히 1개라는 오래된 전제가 그대로 보인다. 부수적으로 같은 계열 문제로, `webchat-command-failure-is-not-termination.md:60` 이 "`plan/complete/` 로 이동할 [`webchat-boot-single-flight.md`](./webchat-boot-single-flight.md)"라는 상대링크로 형제 plan 을 가리키는데, 그 이동이 실제로 일어나면(둘 다 `plan/in-progress/` 라 지금은 유효) 상대경로가 깨진다(`plan/complete/webchat-boot-single-flight.md` 로 옮겨가므로).
  - 제안: `spec-sync-external-interaction-api-gaps.md:44` 에 "축 전제는 `bootGenRef` 신설로 변경됨 → `webchat-usewidget-extraction.md` 참조" 한 줄 상호참조 추가 권장(급하지 않음). `webchat-boot-single-flight.md` 가 실제로 `complete/` 로 이동하는 PR 에서 `webchat-command-failure-is-not-termination.md:60` 의 링크 경로도 함께 정정할 것(플레인 텍스트 언급으로 바꾸거나 `../complete/` 프리픽스로).

## 확인했으나 문제 없음 (참고)

- **"비-410 명령 실패는 종료인가" 미해결 결정**: `webchat-command-failure-is-not-termination.md`(owner: project-planner, `(unstarted)`) 로 이미 분리돼 있고, target spec(`1-widget-app.md §2` Form 행 · `3-auth-session.md §3.1-3`)은 이 PR 에서 **전혀 변경되지 않아** 그 미해결 결정을 일방적으로 우회하는 서술이 없다. 코드도 실측 확인 결과(`widget-state.ts:190-191`) 여전히 `ERROR → phase:"ended"` 로, plan 이 서술한 현황과 정확히 일치한다. 이 항목은 직전 `19_46_54` 리뷰의 WARNING 제안 (a)를 정확히 이행한 사례다.
- **§3(재전송) "마지막 wc:boot 적용"**: target 은 이 PR 이전부터 이미 이 동작을 확정해 뒀고(spec 본문 미변경), 이번 diff 는 구현 갭만 메웠다 — spec 측의 신규/일방적 결정이 아니다.
- **spec-sync-external-interaction-api-gaps.md 의 web-chat 관련 `[x]` 항목**(single-flight coalesce·idle-wait reaper·replay_unavailable 소비 배선)은 모두 target 의 "구현 상태" 콜아웃과 정합했다.
- **`webchat-usewidget-extraction.md`**: 이전 ai-review(`02_25_54`/`03_04_45`)가 요구한 두 항목(짝 게이트 구조적 강제 검토, stale "391" 테스트 카운트 정정)이 정확히 반영돼 있음을 확인.

## 요약

이번 diff 의 target 변경분은 `2-sdk.md` frontmatter `code:` 4줄 추가뿐이며 spec 본문(정책·계약)은 origin/main
과 동일하다. `webchat-boot-single-flight.md` 의 실행 체크리스트는 전항목 `[x]`고, 이 plan 계열이 스스로
반복 학습한 "산문 이월은 plan 완료 이동 시 묻힌다"는 교훈을 이번 라운드에서도 두 건(비-410 실패 결정,
`useEiaSession` 분리)에 실제로 적용해 별도 plan/in-progress 파일로 승격했다 — 미해결 결정을 target 이
우회하거나, target 이 가정하는 선행 조건이 미해소인 채 방치된 사례는 발견하지 못했다(CRITICAL 없음).
유일한 실질 이슈는 같은 "이월" 묶음에 남아있던 apiBase-토큰 바인딩 항목이 형제 항목들과 달리 아직
분리되지 않은 것으로, 직전 리뷰(`19_46_54`)가 낮게 매긴 우선순위를 이번엔 완료 근접·선례 확립을
근거로 WARNING 으로 재평가했다 — 다만 이는 이번 PR 이 만든 결함이 아니라 plan 관리 완결성의 문제이며,
plan-lifecycle 규칙상 이 항목이 남아있는 한 `webchat-boot-single-flight.md` 는 어차피 `in-progress/` 에
머물러야 하므로 당장 유실 위험은 없다. 부가적으로 신·구 plan 간 상호참조 갱신 누락(INFO) 1건을 남긴다.

## 위험도

LOW

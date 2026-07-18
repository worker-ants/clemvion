# Plan 정합성 검토 — spec/7-channel-web-chat/

검토 모드: --impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main
대상 worktree(SoT): `/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4`

## 사전 확인 사항 (payload 한계)

prompt_file 의 "진행 중 plan 문서 모음"은 크기 제한으로 잘려 `plan/in-progress/webchat-boot-single-flight.md`
자체를 포함하지 않았다(포함된 5개는 `ai-agent-tool-connection-rewrite`·`cafe24-backlog-residual`·
`chat-channel-{discord-gateway,slack-socket-mode,visual-ssr-png}` 뿐이며 전부 본 target 과 무관). 이 diff 의
실제 작업 plan 은 누락된 파일이므로, worktree 절대경로로 **직접 Read** 했다(payload 미신뢰, 디스크 fresh 확인 —
`webchat-boot-single-flight.md` mtime 2026-07-17 19:32, 리뷰 시각 19:46:54 보다 이전이라 최신 상태).

`git diff $(git merge-base origin/main HEAD)..HEAD` 로 실제 target 변경분을 확인한 결과, 이번 diff 가 건드린
spec 파일은 `spec/7-channel-web-chat/2-sdk.md` **frontmatter `code:` 4줄 추가**(host-bridge.ts·use-widget.ts
증거 링크 + `§110` 주석)뿐이다 — spec 본문(정책·계약 서술)은 origin/main 과 동일. 아래 분석은 이 좁은 diff 와,
plan 이 여전히 열어둔 산문 이월 항목을 대상으로 한다.

## 사용자 지시 검증 — false positive 여부

`webchat-boot-single-flight.md` 를 직접 읽어 아래 두 건이 **실제로 해소·정정 완료**되었음을 확인했다(git 대조 완료,
오탐 아님):

- **A-6 되돌림**: "진행 기록 — A-6 완료" 절(180행)에서 한 번 구현됐던 `RESTORED`/`BOOTED` `ended` 가드가, "후속
  (18_39_11 처리) §1"(306행)에서 **명시적으로 되돌려졌다**(순변경 0, CHANGELOG 에서도 제외 확인 — 아래 diff 로 실측).
  근본 원인(비-410 명령 실패에 `teardownSession()` 호출)과 그 되돌림 근거(`3-auth-session.md §3.1-3` 의 정리
  조건 열거에 "그 외 명령 실패" 가 없음)까지 상세히 기록됨.
- **"duplicate getStatus 수렴, low severity" 판단 철회**: "이월 추가 (18_39_11 side_effect·maintainability)"
  절(300행)에서 취소선 + "**(이 판단은 틀렸다. 처리 완료 — 아래 §후속 참조)**" 로 명시 정정되고, "후속 (18_39_11
  처리) §2"(331행)에서 CRITICAL 로 재분류돼 fix 완료(회귀 테스트 포함)됨을 확인.

`git diff` 로 CHANGELOG.md 도 대조 — 현재 diff 의 Unreleased 항목은 supersede(§110)·재전송 방해 제거·대체 시도
화면 미변경만 서술하고 A-6(되돌려진 teardownSession 확대)은 포함하지 않아 plan 의 "CHANGELOG 에서도 뺐다" 서술과
일치한다. **두 건 모두 미해결로 오탐 보고하지 않음.**

## 발견사항

- **[WARNING]** "비-410 명령 실패 = 대화 종료" 미해결 결정이 project-planner 트랙 없이 developer plan 산문으로만 존재
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md:47`(Form 행 "실패 시 `error.details` 표시·재제출")
    · `spec/7-channel-web-chat/3-auth-session.md:78`(§3.1-3 storage 정리 조건 열거 — "그 외 명령 실패" 미포함)
  - 관련 plan: `plan/in-progress/webchat-boot-single-flight.md:354-357` "이월 (신규)" 섹션 1번째 항목
  - 상세: 위젯의 `ERROR` action 은 여전히 비-410 명령 실패(5xx·409·네트워크 순단 포함, form 검증 실패 포함)를
    전부 `phase: "ended"` 로 처리한다. 이는 target 이 §2 에서 약속하는 "실패 시 error.details 표시·재제출"과,
    §3.1-3 이 열거하는 storage 정리(=사실상 종료 확정) 트리거 목록(종료 수신·복원 시 200+terminal/404/복구불가
    401·410 Gone)에 "그 외 명령 실패"가 없다는 것과 정합하지 않는다. plan 은 이 gap 을 **"제품 결정이 필요하다
    (비-410 실패는 종료인가) → project-planner 트랙"** 이라고 스스로 명시했으나, 그 결정 항목이 실제
    project-planner 소유의 별도 plan/in-progress 문서나 기존 추적 문서(`spec-sync-external-interaction-api-gaps.md`
    류)에 등록되지 않았다 — `owner: developer` 인 본 plan 파일 맨 끝 자유 서술로만 존재한다. 이 gap 자체는 이번
    PR 이 만든 것이 아니다(A-6 되돌림으로 "storage 파괴에 의한 영구 소실"이 "일시적 화면 전환"으로 완화됐을
    뿐이라고 plan 스스로 인정). 다만 **본 plan 파일 자신이 몇 절 앞(115행, A-6)에서 "이 이월은 어느 plan 에도
    없어 유실 위험이다"라고 지적했던 바로 그 실패 패턴**이 이번엔 plan 종결 시점에 재발할 소지가 있다 — plan
    은 미해결 항목이 남아있는 한 `in-progress/` 에 남으므로 당장 유실되진 않으나(`plan-lifecycle.md §2` 기준
    충족), owner 불일치(developer 플랜에 project-planner 전용 결정 항목이 얹힘)로 인해 향후 이 plan 이 다른
    이유로 종결·이관될 때 spec 결정 항목만 누락될 위험이 있다.
  - 제안: (a) 이 항목을 project-planner owner 의 신규 `plan/in-progress/` 항목으로 분리 등록하거나
    `spec-sync-external-interaction-api-gaps.md` 류 추적 문서에 편입해 "비-410 명령 실패 = 대화 종료인가"
    결정과 그에 따른 `1-widget-app.md §2`·`3-auth-session.md §3.1-3` 명문화를 명시적으로 추적할 것.
    (b) 결정 전까지는 두 target 위치에 이 gap 을 가리키는 캐주얼 각주(추적 링크 포함)를 남겨
    spec-impl-evidence 의 "빈 약속 방치" 리스크를 낮출 것.

- **[INFO]** `§NNN` 행-번호 clause-id 관행의 구조적 취약성 — 이미 인지·기록됨, 현재 drift 없음
  - target 위치: `spec/7-channel-web-chat/2-sdk.md:6`(frontmatter 주석 `§110`) 및 `codebase/channel-web-chat/src/widget/use-widget.ts`·`use-widget-eager-start.test.ts` 전역의 `§110` 참조 20여 곳
  - 관련 plan: `plan/in-progress/webchat-boot-single-flight.md:357` "이월 (신규)" 섹션 2번째 항목
  - 상세: `§110` 은 정식 spec 섹션 번호(`## 1.`~`## 5.` 체계)가 아니라 `2-sdk.md` 의 **110번째 줄**을 가리키는
    비공식 clause-id 다(`spec/conventions/` 에 문서화된 관행 아님, 이번 grep 으로 확인). 본 PR 에서 frontmatter
    에 4줄을 추가하며 대상 문단이 실제로 106→110 으로 밀렸고, 코드 주석·테스트 39곳을 수기 정정했다(plan
    351행). 재검증 결과 현재 저장소에는 stale `§106` 잔존이 0건이고, `§110` 참조는 실제 110번째 줄(`wc:boot`
    재전송 문단)과 정확히 일치한다 — **지금 시점 drift 없음**. 다만 이 line-number 앵커는 향후 같은 파일에
    문단이 추가/삭제될 때마다 똑같이 깨질 수 있는 구조적 취약점이며, plan 은 이를 project-planner 트랙(정식
    앵커 규약 도입)으로 이미 올바르게 분류해뒀다. 별도 조치 불요 — 추적 상태만 확인.

- **[INFO]** 그 외 저-우선순위 이월 2건 — 별도 트랙 필요하나 target 과 직접 충돌 없음
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md`(세션 storage 모델), `1-widget-app.md §2`(AI 메시지 표시)
  - 관련 plan: `plan/in-progress/webchat-boot-single-flight.md:294-295` "이월 추가 (2026-07-17 18_39_11)" 섹션
  - 상세: (1) 재전송으로 `apiBase` 가 바뀌면 옛 세션 토큰이 새 `apiBase` 로 전송될 수 있음(`session-store` 가
    발급 origin 미기록) — security WARNING, "별도 트랙" 표기. (2) `AI_MESSAGE` 의 `ended` 가드 부재 — "실패
    사례 확인 시 확대" 조건부 보류. 둘 다 target 문서가 현재 반증되는 claim 을 하고 있지는 않다(3-auth-session.md
    는 apiBase-토큰 바인딩을 애초에 약속하지 않음) — 즉 **활성 충돌은 아니다**. 다만 위 WARNING 항목과 같은
    "project-planner/developer 트랙 미등록 산문 이월" 패턴이라 함께 정리 대상으로 언급.
  - 제안: 위 WARNING 항목 정리 시 같이 별도 plan 항목으로 승격 검토(급하지 않음).

## 요약

이번 diff 의 target 변경분은 `2-sdk.md` frontmatter `code:` 4줄 추가뿐이며, plan(`webchat-boot-single-flight.md`)의
실행 체크리스트(A-0~A-6·B-1·spec frontmatter 확인)는 전부 `[x]` 완료 상태다. 사용자가 지목한 두 항목(A-6 되돌림,
"duplicate getStatus low severity" 판단 철회)은 plan 에 이미 명시적으로 재확인·정정 기록이 남아 있어 **미해결로
오탐 보고하지 않았다**(git diff 로 CHANGELOG 순변경까지 교차 확인). plan/in-progress 내 다른 문서 중
`spec-sync-external-interaction-api-gaps.md` 가 target 과 가장 밀접히 겹치며(single-flight coalesce·idle-wait
reaper·replay_unavailable 소비 배선), 그 항목들은 모두 target 의 "구현 상태" 서술과 정합했다. 유일한 실질
WARNING 은 plan 이 스스로 "project-planner 트랙"으로 지정한 미해결 제품 결정(비-410 명령 실패의 종료 처리 여부)이
실제로는 developer 소유 plan 파일의 산문 이월로만 존재해, target 의 기존 Form/storage-정리 서술과 미정합 상태가
추적 없이 방치될 위험이 있다는 점이다 — 이 gap 자체는 이번 PR 이전부터 있었고 이번 PR 이 악화시키지 않았다
(오히려 A-6 되돌림으로 피해 범위를 축소했다).

## 위험도

LOW

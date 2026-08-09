STATUS=success plan_coherence complete — target=spec/7-channel-web-chat/, diff=dompurify patch bump only, WARNING 2 · INFO 3
===REPORT_MARKDOWN_BELOW===
# Plan 정합성 검토 — target: `spec/7-channel-web-chat/`

## 사전 확인 — 프롬프트 번들 신뢰도

이번 세션의 실제 diff(`spec/7-channel-web-chat` 관련 코드 영역)는 `codebase/channel-web-chat/package.json`·
`codebase/frontend/package.json` 의 `dompurify` patch bump(3.4.12→3.4.13) 뿐이었다(`ci-required-check-skip-jobs`
plan 의 "부수 — 새로 도는 audit 이 main 취약점 2건을 드러냈다" 절 참고 — 본 PR 목적과 무관하게 required-check 활성화로
새로 돈 audit 게이트가 잡은 사전 존재 취약점 해소). widget/SDK/auth-session 로직 자체의 diff 는 없다.

프롬프트의 `## 진행 중 plan 문서 모음` 은 예산 초과로 **60개 plan 파일을 생략**했는데, 그 안에
`spec/7-channel-web-chat/` 와 가장 밀접한 5개가 전부 포함돼 있었다(`spec-update-webchat-evidence-pointers.md`·
`webchat-usewidget-extraction.md`·`webchat-command-failure-is-not-termination.md`·
`webchat-boot-apibase-scheme-validation.md`·`webchat-spec-rationale-followup.md`). 프롬프트 지시("생략을 부재의
근거로 삼지 말 것")에 따라 워크트리에서 절대경로로 직접 Read 해 아래 발견사항을 확보했다. 이 누락 자체도
아래 INFO 로 별도 기록한다 — `harness-consistency-summary-downgrade-rule.md` 가 추적 중인 "scope 산정" 결함
계열의 재발 사례로 보인다(그 plan 의 우선순위 계층 0~3 로직은 "target 번들"에는 적용됐지만 "plan/in-progress
문서 모음" 섹션에는 아직 적용되지 않은 것으로 보임).

## 발견사항

- **[WARNING]** `2-sdk.md`/`3-auth-session.md` 의 `code:` 증거 포인터가 실제 구현 위치와 어긋난 채 미해소
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:` (§3 재전송 계약 주석이 달린
    `codebase/channel-web-chat/src/widget/use-widget.ts` 항목), `3-auth-session.md` frontmatter `code:`
  - 관련 plan: `plan/in-progress/spec-update-webchat-evidence-pointers.md` (project-planner 트랙, 미착수),
    `plan/in-progress/webchat-usewidget-extraction.md` §"spec 증거 포인터 drift — planner 위임"
  - 상세: `webchat-usewidget-extraction` 1차 slice(완료, 2026-07-24)에서 §3(재전송) 계약의 실제 정본
    (`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale`)이 `use-widget.ts` → 신설
    `use-session-generations.ts` 로 이동했다. 그런데 `2-sdk.md` `code:` 는 여전히 `use-widget.ts` 만 가리키고
    "이 문서가 그 계약의 SoT" 라는 인라인 주석도 그대로다. `spec-code-paths` 검사는 "1개 이상 매치"만 보므로
    CI 는 이 drift 를 통과시킨다(발견 plan 자체가 명시). `spec-update-webchat-evidence-pointers.md` 가 이미
    수정 제안을 냈지만 "다음 slice(나머지 `applyConfig`/`start`/`teardownSession` 이관)를 기다릴지" 가
    **미해결 결정**으로 남아 체크박스 전부 미완료 상태다.
  - 제안: `project-planner` 가 (a) 지금 바로 `code:` 를 `use-session-generations.ts` 로 갱신할지, (b) 남은
    slice 완료까지 대기(그 사이 문서가 잘못된 파일을 가리키는 비용 감수)할지 결정. 이 결정 자체가
    `spec-update-webchat-evidence-pointers.md` §"결정이 필요한 지점" 의 내용과 동일하므로 새로 만들 필요는
    없고, 그 plan 을 해소하면 된다.

- **[WARNING]** 비-410 명령 실패 시 target 이 약속한 "재제출/복원" 이 실제로 깨지는 gap — 결정 미착수
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 화면 구조 표 "Form" 행("실패 시
    `error.details[...]` 표시·재제출"), `3-auth-session.md` §3.1-3 "storage 정리 책임" 조건 열거
    (SSE terminal · 200+terminal 복원 · 404 · 복구불가 401 · 명령 410 — **비-410 명령 실패는 미열거**)
  - 관련 plan: `plan/in-progress/webchat-command-failure-is-not-termination.md` (owner: project-planner,
    상태: 미착수, "결정이 먼저 필요하고 spec 변경을 수반")
  - 상세: `sendCommand` 가 비-410 실패(5xx·409 STATE_MISMATCH·form 4xx·네트워크 순단)를 받으면 `ERROR` →
    `phase: "ended"` 로 전이해, target 이 Form 행에서 약속한 "재제출" 표면이 사라지고 대화가 조기 종료된다.
    한때 이 gap 을 반대 방향(모든 에러=종료로 보고 `teardownSession` 추가)으로 메운 시도가 살아있는 대화의
    영구 유실을 냈다가 되돌려진 이력이 있다(`ai-review 18_39_11` CRITICAL). 이후 `project-planner` 트랙
    결정(A: 일시적 실패로 취급 / B: spec 에 종료 조건 명문화 / C: 오류 종류별 분기)이 필요하다고 티켓화
    됐으나 아직 미착수다. target 문서 자체는 이 결정 이전 상태(A 방향 약속)를 그대로 유지하고 있어, "target
    이 가정하는 사전 조건(Form 재제출 가능·복원)이 plan 에서 아직 해결되지 않은" 상태다.
  - 제안: 이 결정을 새로 요구하는 것이 아니라 — 이미 `webchat-command-failure-is-not-termination.md` 로
    적절히 티켓화·추적 중이므로 — `project-planner`/사용자 턴에서 A/B/C 택1 후 `1-widget-app.md` §2·
    `3-auth-session.md` §3.1-3 반영을 재확인해 달라고 안내. 신규 plan 생성 불필요.

- **[INFO]** P3 후속 2건도 예산 초과로 이번 세션 번들에서 누락(저위험, 참고용)
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` §boot, `4-security.md`(§1 위협 표) — 두 plan 이 각각
    다룸
  - 관련 plan: `plan/in-progress/webchat-boot-apibase-scheme-validation.md`(P3, `wc:boot` 경로 `apiBase`
    스킴 검증 비대칭 — 설계결정 미착수, "활성 결함 아님"), `plan/in-progress/webchat-spec-rationale-followup.md`
    (P3, `## Rationale` 문서화 갭 — 코드·동작 영향 없음, planner 트랙)
  - 상세: 둘 다 우선순위 P3 이고 원 티켓 스스로 "비차단"·"활성 결함 아님" 으로 명시했다. 오늘 diff 와도
    무관. 다만 이번 세션 번들에서 관련 plan 파일이 전부 빠져 있었다는 사실은 위 "사전 확인" 절의 메타 문제와
    같은 뿌리라 함께 기록한다.
  - 제안: 별도 조치 불요. 다음 관련 PR 에서 정상적으로 다뤄질 항목.

- **[INFO]** `plan/in-progress` 번들의 target-관련 우선순위 로직 부재 (harness 메타)
  - target 위치: 해당 없음(harness/orchestrator 자체)
  - 관련 plan: `plan/in-progress/harness-consistency-summary-downgrade-rule.md` §"관련 관측 — `--impl-done`
    scope 가 실제 diff 와 무관한 번들을 싣는다"
  - 상세: 그 plan 이 이미 추적 중인 "target 번들(spec 폴더 dump)" 예산/우선순위 문제는 계층 0~3
    (`prioritize_bundle_files`)로 해소됐다고 기록돼 있으나, 이번 세션에서는 **`## 진행 중 plan 문서 모음`**
    (plan/in-progress 전체 bundle) 쪽에서 같은 증상이 재현됐다 — target 이름(`webchat`)과 문자열이 겹치는
    5개 plan 이 전부 예산 밖으로 밀렸다. 이 섹션에는 아직 target-매칭 우선순위가 적용되지 않는 것으로
    보인다(제목/경로에 target 폴더명·slug 포함 여부로 계층을 올리는 로직이 없는 듯).
  - 제안: 새 plan 항목을 만들기보다 `harness-consistency-summary-downgrade-rule.md`(이미 이 결함군을
    추적 중, 담당 developer 트랙)의 다음 라운드에서 "plan/in-progress 문서 모음도 같은 우선순위 계층을
    적용하는지" 재확인해 달라고 인계.

- **[INFO]** `ci-required-check-skip-jobs.md` Rationale 이 `--frozen-lockfile` required-check 요구를
  잘못된 plan 에 귀속(동작 영향 없음, 문서 정확도만)
  - target 위치: 해당 없음 (target=`spec/7-channel-web-chat/` 과 무관 — plan-간 상호 참조 오류)
  - 관련 plan: `plan/in-progress/ci-required-check-skip-jobs.md` §Rationale "왜 2개만 전환하나" —
    "`deps-peer-gating-and-eslint10` 의 `--frozen-lockfile`" 이라고 서술
  - 상세: 실측 결과 `deps-peer-gating-and-eslint10.md` 는 `--frozen-lockfile`/required-check 를 전혀
    언급하지 않는다(grep 0건). `--frozen-lockfile` required-check 승격 요구는 실제로는
    `deps-guard-hardening.md` §"남은 수동 조치"에 있고, 그 절이 스스로 "`pnpm-migration-followups.md`
    의 `deps-security-checks` 와 한 번에 같이 처리하는 것이 맞다" 고 명시해 정확히 그 두 plan 이 이번 PR
    이 다룬 2개 required-check 의 근거다. `deps-peer-gating-and-eslint10.md` 는 무관한 별개 관심사
    (`--strict-peer-dependencies`, eslint 9→10)다. target(spec/7-channel-web-chat) 과는 무관하지만, 이
    diff 의 유일한 실질 변경(dompurify bump)이 바로 이 plan 문서 안에서 설명되고 있어 plan 문서 정확성
    문제로 겸사겸사 기록한다.
  - 제안: `ci-required-check-skip-jobs.md` §Rationale 한 줄만 `deps-peer-gating-and-eslint10` →
    `deps-guard-hardening` 로 정정. 동작 영향 없음, 후속 PR 에서 처리해도 무방.

## 요약

이번 세션에서 target(`spec/7-channel-web-chat/`)에 영향을 준 실 diff 는 `dompurify` patch bump 뿐이며,
이는 required-check 활성화 과정에서 드러난 사전 존재 취약점(GHSA-55q2-fjhq-7xh7) 해소이고 채널-web-chat
spec 의 "exact pin" 정책(§SDK sanitize 경로)과도 정합해 그 자체로는 정합성 문제가 없다. 다만 orchestrator
가 이 target 을 대상으로 plan/in-progress 전체를 함께 번들링하는 과정에서 채널-web-chat 과 가장 밀접한
5개 plan 파일이 예산 초과로 통째로 빠졌고, 워크트리에서 직접 열람한 결과 그중 2건은 실제로 미해결
상태다 — (1) SDK spec 의 `code:` 증거 포인터가 옛 구현 위치를 가리키는 drift, (2) 위젯이 비-410 명령
실패 시 target 이 약속한 "재제출/복원" 을 지키지 못하는 gap 에 대한 제품 결정(A/B/C) 미착수. 둘 다
새로 발견된 문제가 아니라 이미 전용 plan 문서로 적절히 티켓화돼 project-planner/사용자 턴을 기다리는
중이며, 오늘 diff 와는 인과관계가 없다. 부수적으로 plan-간 상호 참조 오류(required-check 귀속 plan
오기재) 1건과, plan/in-progress 번들링 자체의 target-매칭 우선순위 부재라는 harness 메타 이슈를
함께 기록했다.

## 위험도
LOW

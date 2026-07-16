# Plan 정합성 검토 — spec/2-navigation/ (--impl-done)

검토 대상: `spec/2-navigation/` (diff-base `origin/main`)
관련 plan: `plan/in-progress/user-guide-routing-loop-fix.md`(본 구현, checklist 1-10 완료·11=본 검토), `plan/in-progress/spec-update-catch-all-terminal-contract.md`(project-planner 위임 draft, 신규)

> 주의: 본 세션의 payload(`_prompts/plan_coherence.md`) "Target 문서" 절에는 `spec/2-navigation/0-dashboard.md` · `1-workflow-list.md` · `10-auth-flow.md` · `11-error-empty-states.md` · `13-user-guide.md` · `14-execution-history.md` · `15-system-status.md` 만 포함되고, 이번 변경의 실제 진앙인 `_layout.md`(§2.2 각주) 와 `9-user-profile.md`(§3) 는 **본문 전체가 빠져 있다**(다른 문서에서 링크로만 언급됨). 아래 분석은 이 gap 을 메우기 위해 두 파일을 작업 디렉토리에서 직접 절대경로로 읽어 확인했다. orchestrator 는 다음 회차 payload 조립 시 `_layout.md`/`9-user-profile.md` 를 Target 문서에 포함하는 것을 권장(안 그러면 두 파일이 담당하는 catch-all 라우팅 계약 자체가 자동검토 사각지대가 된다).

## 발견사항

- **[INFO]** catch-all terminal 계약의 spec 반영이 아직 project-planner 처리 전 — 정상 추적 중, 머지 후 방치 위험만 주의
  - target 위치: `spec/2-navigation/_layout.md:85` (각주 "구 무-slug 경로로 진입하면 `(main)/[...rest]` catch-all 이 활성 slug 로 흡수한다"), `spec/2-navigation/9-user-profile.md:155` (§3 "구 무-slug 경로·알림 딥링크·`/`는 ... catch-all 이 활성 slug 로 흡수한다(query/hash 보존)")
  - 관련 plan: `plan/in-progress/spec-update-catch-all-terminal-contract.md`(신규, project-planner 위임 대기, 체크리스트 전항목 미체크) / `plan/in-progress/user-guide-routing-loop-fix.md` checklist #10(완료: draft 작성) → #11(본 검토)
  - 상세: `git diff origin/main..HEAD -- codebase/frontend/src/app/'(main)'/'[...rest]'/` 로 실측 확인한 코드는 `rest[0]==="w"` 인 경로를 흡수하지 않고 **terminal** 처리한다 — `/w/<slug>` 단독은 대시보드로 forward, 그 외(`/w/<slug>/docs` 등)는 `notFound()`. 반면 target spec 두 곳은 여전히 "catch-all 이 (모든 구 경로를) 활성 slug 로 흡수한다"는 절대 문언만 서술하고, 신설된 종결(terminal) 규칙은 언급하지 않는다. `git diff --stat origin/main..HEAD -- spec/2-navigation/` 확인 결과 이번 diff 는 spec 파일을 전혀 건드리지 않았으므로 이 gap 은 그대로 남아 있다.
  - 이 gap 자체는 **미해결 결정 우회가 아니다** — 기존 spec 문언이 새 동작으로 반증되는 것이 아니라(흡수 대상 경로는 여전히 흡수됨, `rest[0]!=="w"` 케이스), 서술이 새 terminal 분기를 다루지 않는 **불완전** 상태다. 동일 쟁점은 선행 세션(`review/consistency/2026/07/17/00_32_57/SUMMARY.md` 4행, INFO#4)에서 이미 식별돼 "spec 보강 draft 작성 + project-planner 위임"으로 처리 방향이 합의됐고, 오늘 그 draft(`spec-update-catch-all-terminal-contract.md`)가 실제로 작성 완료됐다(routing-loop-fix checklist #10 체크). 즉 **정상적으로 추적되는 상태**이며 본 PR 을 막을 사유는 아니다.
  - 다만 draft 자체의 체크리스트(project-planner 검토 → `/consistency-check --spec` → spec 본문 반영 → `plan/complete/` 이동)는 전부 미착수다. `9-user-profile.md` frontmatter 는 이미 `pending_plans: [spec-sync-user-profile-gaps.md]` 를 갖고 있지만 신규 `spec-update-catch-all-terminal-contract.md` 는 등재돼 있지 않다(다만 `spec-impl-evidence.md` §3 의 `pending_plans` 의무는 `status: partial`+구현 갭 추적용이지, 본 건처럼 "구현이 spec 문언보다 앞선" 역방향 드리프트에는 강제 규약이 없어 이것이 컨벤션 위반은 아니다).
  - 제안: (1) 본 PR(`user-guide-routing-loop-fix.md`)은 예정대로 진행 — checklist #11 은 BLOCK 사유 없음. (2) `spec-update-catch-all-terminal-contract.md` 가 project-planner 에게 신속히 픽업되도록 후속 확인(머지 후 방치되면 `_layout.md:85`/`9-user-profile.md:155` 의 "흡수만 한다" 문언이 재차 오독돼 이번과 같은 무한루프 클래스가 재발할 소지 — draft 본문이 이미 이 위험을 명시).

## 교차 확인 (충돌 없음 확인용, 발견사항 아님)

- `plan/in-progress/` 전체를 `catch-all`/`[...rest]`/`/w/<slug>` 키워드로 스캔 — 라우팅 관련 언급은 `user-guide-routing-loop-fix.md`·`spec-update-catch-all-terminal-contract.md`·`spec-sync-user-profile-gaps.md`(워크스페이스 슬러그 라우팅 phase 1, 이미 `[x]` 완료 표기) 뿐. `node-output-redesign/*.md` 의 "catch-all" 언급은 에러 핸들링 패턴(무관한 동음이의).
- `spec-sync-user-profile-gaps.md`(9-user-profile.md 의 기존 `pending_plans`)의 미해결 항목(아바타 업로드·알림 일일요약·in_app 뮤팅)은 라우팅과 무관 — 충돌 없음.
- `1-workflow-list.md` 의 `pending_plans: spec-sync-workflow-list-gaps.md` 도 태그/정렬/폴더 필터 범위이며 라우팅 언급 없음 — 충돌 없음.
- `ai-agent-tool-connection-rewrite.md`(미해결 "사용자 합의 필요" 결정 다수 보유)는 AI Agent 도구 연결 도메인이라 `spec/2-navigation/` 과 영역이 겹치지 않음 — 충돌 대상 아님.
- 코드 실측(`(main)/[...rest]/page.tsx` 전문 Read): 구현이 plan(`user-guide-routing-loop-fix.md` §결정)이 서술한 종결 규칙과 정확히 일치 — `workspacePrefixed && !workspaceRootSlug` 시 render 단계 `notFound()`, `workspaceRootSlug` 존재 시 `/dashboard` forward, query/hash 보존.

## 요약

이번 diff 는 spec 파일을 건드리지 않고 코드(`(main)/[...rest]/page.tsx`, `sidebar.tsx`)만 변경했다. 그 코드 변경으로 catch-all 의 실제 계약이 spec 두 문서(`_layout.md:85`, `9-user-profile.md:155`)의 "흡수만 한다" 서술보다 넓어졌으나(신규 terminal/`notFound()` 분기), 이는 기존 spec 문언을 반증하는 미해결 결정 우회가 아니라 아직 project-planner 가 처리하지 않은 **후속 spec 보강**(`spec-update-catch-all-terminal-contract.md`, 오늘 신규 작성)으로 이미 정식 추적되고 있다. 다른 in-progress plan 과의 충돌·선행조건 미해소는 발견되지 않았다. 유일한 잔여 사항은 그 draft plan 이 project-planner 에게 인계돼 실제 spec 본문에 반영되는 것 — 본 PR 자체를 막을 사유는 아니다.

## 위험도

LOW

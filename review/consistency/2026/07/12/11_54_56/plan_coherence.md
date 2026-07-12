### 발견사항

- **[WARNING]** `3-auth-session.md` §3.1 의 미구현 "후속 결정" 항목이 어떤 plan 에도 등재되지 않음
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1 상단 blockquote ("⚠ v1 구현 현황(부분)") — "**200+종료·404·복구불가 401 REST 분기와 `401 → 낙관적 refresh 1회` 는 여전히 미구현(Planned)** ... 이 REST 오류 분기·낙관적 refresh 완전 구현은 **후속 결정으로 남긴다**"
  - 관련 plan: 없음 (`plan/in-progress/` 전체를 `auth-session`/`refresh-token`/`낙관적` 으로 검색해도 매칭 파일 없음 — `marketplace-and-plugin-sdk.md`/`eia-context-schema-followups.md` 의 매칭은 무관 문맥의 오탐)
  - 상세: target 문서가 스스로 "미구현(Planned)" + "후속 결정으로 남긴다"고 명시했는데, 그 후속을 책임지는 `plan/in-progress/*.md` 파일이 존재하지 않는다. frontmatter 도 `status: implemented`(code: 4개 파일 매치)로 남아 있어 `spec-impl-evidence` 컨벤션의 `partial`+`pending_plans:` 요건과 어긋난다 — 같은 spec 영역의 자매 문서(`spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`)는 정확히 이 패턴(일부 구현 + 후속 plan 존재)을 `status: partial` + `pending_plans:` 로 정직하게 반영하고 있어 대비된다. 결과적으로 이 갭은 어떤 build-time 가드(`spec-status-lifecycle.test.ts`)로도 추적되지 않는 "영구 누락형 약속"이 될 위험이 있다.
  - 제안: (a) `project-planner` 가 이 401 처리/REST 오류 분기 구현을 담당할 `plan/in-progress/*.md` 를 신설하고 `3-auth-session.md` frontmatter 를 `status: partial` + `pending_plans:` 로 갱신하거나, (b) 이미 우선순위가 낮아 무기한 defer 라면 target 본문에서 "후속 결정으로 남긴다"는 확정형 서술 대신 명시적 비목표(예: "v1 비목표, 필요해지면 별도 plan") 로 정정해 "존재하지 않는 후속" 인상을 없앤다.

- **[WARNING]** carousel 잘림 배너 후속 plan 이 spec frontmatter 에 cross-reference 되지 않음
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 메시지 리스트 행 + `## Rationale` R8 — "*(현재 table 배너 한정 — carousel 은 잘림 배너 자체가 미구현이라 별도 후속으로 추적한다.)*"
  - 관련 plan: `plan/in-progress/webchat-widget-presentation-followups.md` (해당 카루셀 배너 미구현 항목을 정확히 추적 중 — "카루셀 잘림 배너 미구현" 체크박스 open, "착수 조건: `project-planner` 가 `1-widget-app.md §2` 에 표시 계약을 먼저 정의")
  - 상세: 플랜 자체는 target 이 서술하는 갭과 **정확히 일치**하고 내용상 충돌은 없다(오히려 target 이 "총 개수 노출" 결정을 이미 §2/R8 에 반영해 plan 의 착수 조건 중 절반을 충족시켰다 — PR #921 이 관측됨). 다만 이 plan 이 `spec/7-channel-web-chat/1-widget-app.md` 의 `pending_plans:` 에 등재돼 있지 않고, frontmatter 는 여전히 `status: implemented`(code: 매치 有, pending_plans 無)다. 같은 저장소의 `15-chat-channel.md`(`status: partial` + `pending_plans: [...chat-channel-visual-ssr-png.md, ...]`)가 "v1 은 구현되고 v2 격상은 별도 plan" 패턴을 정확히 이 형태로 반영하는 선례가 있어, 본 문서만 예외로 남아 있다.
  - 제안: `1-widget-app.md` frontmatter 를 `status: partial` + `pending_plans: [plan/in-progress/webchat-widget-presentation-followups.md]` 로 갱신(project-planner). carousel 배너가 구현되면 plan 이 `complete/` 로 이동하는 시점에 `status: implemented` 로 재승격.

- **[INFO]** `spec-draft-pr874-deferred-docs.md` 체크리스트가 완료된 작업을 미완료로 표시
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` `### R7. 헤더 세션 컨트롤 — booting 게이팅 + graceful/cancel 분기` (파일에 실존, `git log` 상 commit `52f46f95f` / PR #899 로 이미 병합됨)
  - 관련 plan: `plan/in-progress/spec-draft-pr874-deferred-docs.md`
  - 상세: 이 plan 의 변경안 (1)(2)(3) 은 모두 실제로 반영됐고 체크리스트도 `- [x] (1) 1-widget-app.md R7 반영` 등으로 표시돼 있으나, 말미의 `- [ ] doc-guard (spec-link-integrity) 통과` / `- [ ] commit + PR` 두 항목은 여전히 미체크다. 그러나 git 이력상 커밋·PR 은 이미 완료됐다(`52f46f95f`, "(#899)"). 이는 target 과의 직접 충돌은 아니지만, plan 이 `plan/in-progress/` 에 남아 있고 체크박스가 실제 상태를 반영하지 못해(memory: "plan 체크박스 = 실제 상태") 향후 세션이 "아직 진행 중"으로 오판할 위험이 있다.
  - 제안: developer/planner 가 두 체크박스를 사후 확인·체크하고 `plan/complete/` 로 이동.

### 요약
target(`spec/7-channel-web-chat`)이 참조하는 EIA 관련 in-progress plan(예: `spec-sync-external-interaction-api-gaps.md` 의 EIA-RL-07 idle-wait reaper·single-flight coalesce·`execution.replay_unavailable` 위젯 미소비 항목, `eia-command-waiting-surface-guard.md` 의 명령↔표면 매트릭스)은 target 본문의 서술과 정확히 일치하며 충돌·미해결 결정 우회는 발견되지 않았다. 다만 target 문서 자신이 "미구현(Planned)"/"별도 후속으로 추적"이라고 명시한 두 갭 — `3-auth-session.md` 의 401 재로드 REST 오류 분기(어떤 plan 도 없음)와 `1-widget-app.md` 의 카루셀 잘림 배너(plan 은 존재하나 frontmatter 미연결) — 는 프로젝트의 `spec-impl-evidence` 컨벤션(같은 영역 자매 문서 `14-external-interaction-api.md`/`15-chat-channel.md` 가 이미 실천 중인 `status: partial` + `pending_plans:` 패턴)을 따르지 않아 추적성이 끊겨 있다. 기능적 충돌이 아니라 plan↔spec 연결 누락이므로 CRITICAL 은 아니지만, 두 건 모두 실제 근거가 확인된 반복 가능한 패턴이라 WARNING 으로 등재한다.

### 위험도
MEDIUM

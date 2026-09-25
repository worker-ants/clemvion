# Plan 정합성 검토 — `plan/in-progress/spec-draft-workspace-path-guard-role-census.md`

## 발견사항

- **[WARNING]** 이 draft 를 촉발한 `/ai-review` 5라운드(`18_19_47`)가 상위 plan 의 라운드 추적표·정지 규칙에 아직 반영되지 않음
  - target 위치: 본문 서두("`/ai-review` 5라운드(`review/code/2026/09/25/18_19_47` documentation WARNING)가 CHANGELOG 의 같은 수치를 짚었고") 및 Rationale 전체
  - 관련 plan: `plan/in-progress/workspace-path-guard-impl.md` §체크리스트 `/ai-review` 항목 — 정지 규칙은 "Critical 0 · Warning 0 · 그 라운드 codebase 수정 0건" 인데 라운드 표는 4라운드(`17_47_18`, C0·W8 → 두 번째 planner 턴)까지만 기록돼 있고 5라운드 행이 없음. 같은 항목의 두 planner 턴 기록(`spec-draft-workspace-path-guard-followup.md`, `spec-draft-workspace-path-guard-oracle-census.md`)과 같은 방식으로 이 draft(`role-census`)도 "세 번째 planner 턴"으로 등재되어야 짝이 맞음
  - 상세: 실측 확인 결과 `review/code/2026/09/25/18_19_47/SUMMARY.md` 는 Critical 0·**Warning 3**이다 — #1 `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` reflection 골격 중복(유지보수성), #2 Swagger `FORBIDDEN_*_ROUTE` 상수가 `workspace-roles.ts` 의 `.code` 를 파생하지 않는 SoT drift(문서화), #3 CHANGELOG 수치 오차(문서화 — 이 target 이 다루는 문제와 동일 계열). target 은 #3 계열(스펙 Rationale 수치)만 처리하고, #1·#2 는 target 에도 `workspace-path-guard-impl.md` 체크리스트에도 언급이 없다. `git status` 상 `CHANGELOG.md` 는 이미 수정(M)돼 #3 을 처리했지만, 상위 plan 문서가 5라운드 자체를 아직 기록하지 않아 "정지 규칙 충족 여부"(Warning 0 인가)를 plan 만 보고는 판단할 수 없다. 즉 이 draft 는 5라운드의 존재를 전제로 쓰였는데, 5라운드를 추적해야 할 plan 은 아직 그 라운드를 모른다.
  - 제안: `workspace-path-guard-impl.md` 의 `/ai-review` 라운드 표에 5라운드(`18_19_47`, C0·W3) 행을 추가하고, W1·W2 처리(수정 또는 defer 근거)를 기록한 뒤, 체크리스트에 이 draft 를 "세 번째 planner 턴"으로 등재할 것. target 자신의 스코프(수치 정정)는 좁게 유지해도 무방하나, W1·W2 를 방치한 채 이 라운드를 "닫힌 라운드"로 취급하면 정지 규칙이 우회된다.

## 요약

target 문서는 같은 PR 의 결정 turn(§Rationale «가드 거부의 오류 코드»)이 남긴 실측값 오류를 정정하는 좁은 범위의 spec draft로, 실제 결정(«적용 범위는 전역이다», 규칙 (나))은 건드리지 않는다고 명시하며 그 경계를 지킨다. `plan/in-progress/workspace-path-guard-impl.md`·`nestjs-v12-coordinated-upgrade.md` 등 다른 in-progress plan 과 직접 충돌하는 "결정 필요" 항목은 없고, CHANGELOG 수치(63/17/4/4, 합 88)도 이미 정합하게 반영돼 있으며, 인용한 spec 원문("전 (1)", "전 (2)")도 현재 저장소 상태와 일치해 선행 조건 미해소 문제는 없다. 다만 이 draft를 촉발한 `/ai-review` 5라운드가 상위 구현 plan의 라운드 추적표·정지 규칙에 아직 반영되지 않아, 같은 라운드가 함께 낸 다른 Warning(reflection 중복, Swagger 상수 SoT drift)이 plan 상 추적 누락 상태로 남아 있다 — 후속 항목 등재가 필요하다.

## 위험도
LOW

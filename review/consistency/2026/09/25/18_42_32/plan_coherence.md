# Plan 정합성 검토

## 검토 범위·방법

target(spec 번들: `2-navigation/6-config.md`·`2-navigation/9-user-profile.md`·`5-system/1-auth.md`
전문 + `2-api-convention.md`·`3-error-handling.md`·`13-replay-rerun.md`·`error-codes.md`·`swagger.md`·
`data-flow/12-workspace.md` 는 예산 절단)와, 프롬프트에 번들된 `plan/in-progress/**`(다수 예산 절단)를
대조했다. 절단된 항목은 워크트리 절대경로로 직접 열어 확인했다:
`plan/in-progress/workspace-path-guard-impl.md`(전문) · `auth-guard-reflection-hardening.md`(전문) ·
`spec-sync-auth-gaps.md`(전문) · `spec-sync-user-profile-gaps.md`(전문) ·
`spec-draft-nullable-notation-followups.md`(관련 절 `L4980-5019`) · `nestjs-v12-coordinated-upgrade.md`
(번들에 전문 포함). 또한 `git diff origin/main...HEAD -- codebase/` 로 실제 변경 파일 30개를 확인했다.

이 diff 는 `workspace-path-guard-impl.md`(같은 PR 의 구현 plan, `spec_impact` 에 target 9개 spec 전부
등재)가 **소유**하는 작업이다 — 그 plan 은 3회의 planner 턴(spec 반영), 5라운드 `/ai-review` 수렴,
`--impl-prep`/두 차례 `--spec` 게이트를 이미 거쳤고 체크리스트가 `--impl-done`·트래커 종료 직전
단계에 있다.

## 발견사항

- **[INFO]** 후속 plan 세 곳의 forward-reference — `plan/complete/workspace-path-guard-impl.md`
  - target 위치: 없음 (plan 상호참조)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L4980, L4985, L4998 이
    `plan/complete/workspace-path-guard-impl.md` 를 이미 완료 경로로 인용
  - 상세: 인용 대상 `workspace-path-guard-impl.md` 는 현재 `plan/in-progress/`에 있고
    `status: in-progress`이며 체크리스트 마지막 두 항목(`--impl-done`·"트래커 항목 닫기")이
    아직 미체크다. 세 개의 다른 plan 문서가 이를 이미 `complete/` 경로로 링크해 두어, 이 PR 이
    머지되고 `complete/` 로 옮겨지기 전까지는 그 링크가 가리키는 파일이 `in-progress/`에 있다.
  - 제안: 이 plan 문서 자체의 체크리스트 순서(TEST WORKFLOW 재수행 → `--impl-done` → 트래커
    닫기 → `complete/` 이동)를 따르면 자동 해소된다 — 지금 별도 조치 불요. `--impl-done` 통과
    후 `complete/` 이동을 빠뜨리지 않을 것(이 저장소가 과거 이 이동을 누락한 전례가 있음,
    `auth-guard-reflection-hardening.md` §부수 참조).

- **[INFO]** `param-uuid-pipe` 가드 모집단 변경이 문서화된 대로 반영됐는지는 코드로만 확인 가능
  - target 위치: `workspace-path-guard-impl.md` §구현 중 결정 "`param-uuid-pipe` 가드도
    `@WorkspaceParam` 을 모집단에 넣는다"
  - 관련 plan: 같은 문서
  - 상세: diff 에 `repo-guards/__tests__/param-uuid-pipe-guard.ts`(53줄 변경) ·
    `param-uuid-pipe.spec.ts`(21줄 변경) · `fixtures/param-uuid-pipe/sample.controller.ts`(신규)가
    있어 plan 서술과 형태가 일치한다. 다른 checker(코드/뮤테이션 검증)가 실측을 담당하는 영역이라
    plan 정합성 관점에서는 결정 자체의 존재와 diff 파일 목록의 일치만 확인했고 충돌은 없다.

다른 관점(미해결 결정 충돌, 선행 plan 미해소, 후속 항목 누락)에서는 CRITICAL/WARNING 급 항목을
찾지 못했다. 구체적으로 확인한 사항:

- **미해결 결정과의 충돌** — 없음. target 이 `9-user-profile.md §3`·`1-auth.md §부트 캐너리(b)`에
  새로 보탠 "2026-09-25" 각주는 `workspace-path-guard-impl.md` W1·W2 항목이 요구한 그대로의
  형태(반대쪽 각주·기존 기각 근거 유지)로 반영돼 있다. `auth-guard-reflection-hardening.md`
  §1(b)가 "opt-in 마커 재기각"을 확정한 결정을 target 이 뒤집지 않고, 오히려 그 결정에 대한
  좁은 예외(`@WorkspaceParam` = 값 바인딩 자체)로 논거를 대며 각주를 보탰다 — 번복이 아니라
  정합한 확장.
- **선행 plan 미해소** — `nestjs-v12-coordinated-upgrade.md` §C 는 이 PR 이 reflection 판별자를
  하나 더한다는 사실을 전제로 기준값(캐너리 142/15, 3스위트 89통과, MB RED 11·MB2 RED 25)을
  이미 갱신해 두었고, `workspace-path-guard-impl.md` 체크리스트도 "부트 캐너리 기준값 재실측 —
  `nestjs-v12-coordinated-upgrade.md` §C 갱신"을 완료로 체크했다. 두 plan 의 숫자가 일치해
  선행 plan 이 이 변경을 이미 반영한 상태다.
- **후속 항목 누락** — 이 PR 이 의도적으로 범위를 좁힌 세 갈래(나머지 `@ApiForbiddenResponse`
  ~120곳 · reflection 골격 중복(W1)·403 설명 리터럴(W2) · `req.user.workspaceId` 직접 참조
  라우트의 정적 가드 부재)는 전부 `spec-draft-nullable-notation-followups.md`(L4985-5019)에
  개별 항목으로 이미 등재돼 있다 — 후속 누락이 아니라 등재까지 완료된 상태다.

## 요약

이 PR 의 구현 plan(`workspace-path-guard-impl.md`)은 3회의 planner 턴으로 target spec 9개 문서를
그때그때 갱신해 왔고, 관련된 다른 in-progress plan(`nestjs-v12-coordinated-upgrade.md`,
`auth-guard-reflection-hardening.md`, `spec-draft-nullable-notation-followups.md`,
`spec-sync-auth-gaps.md`, `spec-sync-user-profile-gaps.md`) 과 대조한 결과 미해결 결정을 우회하거나
선행 조건을 무시하거나 후속 항목을 누락한 지점을 찾지 못했다. 유일하게 남는 것은 아직 `in-progress`
상태인 이 plan 자체를 다른 세 plan 문서가 이미 `complete/` 경로로 선-인용한 forward-reference 이며,
이는 plan 자신의 남은 체크리스트(TEST WORKFLOW 재수행 → `--impl-done` → `complete/` 이동)가
정상 진행되면 자동 해소되는 성격이라 별도 조치가 시급하지 않다.

## 위험도

NONE

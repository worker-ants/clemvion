# Plan 정합성 검토 — forbidden-desc-codes (--impl-done)

## 발견사항

- **[WARNING]** `integration-personal-owner-followup.md` 가 아직 존재하지 않는 `plan/complete/forbidden-desc-codes.md` 를 가리킨다
  - target 위치: 본 PR 커밋(`dd01f8382`)이 `plan/in-progress/integration-personal-owner-followup.md` 의 "Viewer 가 자기 personal 을 만들고 …" 항목에 보탠 문장 — "(서비스가 같은 이름의 코드를 내는 자리와 구별할 수 없어서다 — `plan/complete/forbidden-desc-codes.md`)."
  - 관련 plan: `plan/in-progress/forbidden-desc-codes.md` (본 PR 의 구현 plan 자신)
  - 상세: 이 새 포인터는 `forbidden-desc-codes.md` 가 이미 `plan/complete/` 로 이동한 것을 전제로 경로를 적었다. 그러나 실측 결과 그 파일은 현재도 `plan/in-progress/forbidden-desc-codes.md` 에 있고(`plan/complete/forbidden-desc-codes.md` 는 `ls` 로 확인 시 미존재), 그 자신의 체크리스트도 `[ ] --impl-done` · `[ ] 트래커 항목 닫기` 두 항목이 아직 미완이라 이번 PR 안에서 바로 `complete/` 로 옮겨지는 것도 보장돼 있지 않다. `plan-lifecycle.md` §3 "인입 참조" 원칙(이동하는 문서의 인입 참조는 이동과 동시에 갱신)의 반대 방향 — **아직 이동하지 않은 문서를 이동한 것처럼 인용**한 경우다. 이 참조는 마크다운 링크가 아니라 인라인 코드(`` `plan/complete/...` ``)라 `findBrokenPlanLinks` 류 가드가 잡지 못하는 사각지대이기도 하다.
  - 제안: (a) 지금 경로를 `plan/in-progress/forbidden-desc-codes.md` 로 정정하거나, (b) `forbidden-desc-codes.md` 의 남은 두 체크리스트(`--impl-done` · 트래커 항목 닫기)를 마치고 실제로 `plan/complete/` 로 옮기는 마무리 커밋에서 이 인용도 함께 `plan/complete/forbidden-desc-codes.md` 로 맞는지 재확인한다. 어느 쪽이든 이번 PR 종료 전에 실제 파일 위치와 인용 경로가 일치하는지 한 번 더 봐야 한다.

## 그 외 확인 사항 (충돌 없음)

- **미해결 결정 우회 여부**: `integration-personal-owner-followup.md` 의 "Viewer 가 자기 personal 을 만들고 …" 항목(라우트 `@Roles('editor')` → `viewer` 강등 여부, planner 결정 대기)에 대해 본 PR 은 그 결정을 일방적으로 내리지 않았다. 오히려 "검토 경고 처리" 표에서 그 항목을 명시적으로 인지하고("integrations 4곳의 `@Roles('editor')` 자체가 결정 대기") "순서를 바꾸지 않는다 — 지금 역할에 맞는 설명이 옳다"고 처분한 뒤, 결정이 나중에 내려질 때를 대비한 경고 문장만 그 plan 에 보탰다. 결정 자체를 앞지르지 않는 올바른 처리다.
- **선행 plan 미해소 여부**: 이 PR 이 전제하는 `NOT_A_MEMBER`/`ROLE_REQUIRED` 코드 체계·"가드 거부의 오류 코드" 결정은 이미 `spec/data-flow/12-workspace.md`(2026-09-25, 별 PR)에 반영되어 있고 관련 plan(`workspace-path-guard-impl.md` 계열)도 완료 상태다. `auth-guard-reflection-hardening.md`(같은 reflection 계열 — `RolesGuard`/`@WorkspaceId` 소비 판정)도 메모이제이션 1건만 defer 상태로 열려 있을 뿐 본 PR 이 재사용하는 판정 규칙과 충돌하지 않는다.
- **후속 항목 반영 여부**: 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 (1) 이 PR 이 닫으려는 기존 항목(«기존 `@ApiForbiddenResponse` 설명 ~120곳…», 아직 `[ ]` — `forbidden-desc-codes.md` 체크리스트의 "[ ] 트래커 항목 닫기"와 정합)과 (2) 이 PR 이 신설한 새 항목(«§3 길이 규약 표가 응답 데코레이터 `description` 을 분류하지 않는다», planner 소관으로 정확히 등재됨)이 모두 반영되어 있다. `spec/conventions/swagger.md` 에 새로 추가된 마크다운 링크는 모두 한 줄 안에 있어 `spec-link-integrity` 의 멀티라인 링크 사각지대(`harness-review-gate-followups.md` 기록)를 재유발하지 않는다.

## 요약

Plan 정합성 관점에서 본 PR(`forbidden-desc-codes`)은 미해결 결정을 우회하지 않았고(오히려 `integration-personal-owner-followup.md` 의 대기 중인 Viewer 강등 결정을 존중해 순서를 바꾸지 않았다), 전제하는 선행 결정(가드 거부 오류 코드 체계)도 이미 해소된 상태이며, 트래커·후속 plan 갱신도 대체로 잘 반영됐다. 유일한 흠은 이번 PR 커밋이 다른 in-progress plan(`integration-personal-owner-followup.md`)에 남긴 포인터가 아직 일어나지 않은 `plan/complete/forbidden-desc-codes.md` 이동을 전제로 쓰였다는 점으로, 자동 가드가 못 잡는 사각지대라 수동 확인이 필요하다.

## 위험도
LOW

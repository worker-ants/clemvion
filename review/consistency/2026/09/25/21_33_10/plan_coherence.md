### 발견사항

- **[INFO]** 후속 tracker 체크박스 종결 계획이 빠짐
  - target 위치: `plan/in-progress/spec-draft-integration-personal-owner.md` "## 동반 산출물 (같은 커밋)" 절 (라인 154-157)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5760` — "**personal-scope 통합의 «본인 것만» 소유자 검증이 코드에 없다**" 항목, 현재 `[ ]` 미해결
  - 상세: target 문서 서문(라인 33-35)이 이 tracker 항목의 "planner 몫" 임을 명시하지만, "동반 산출물" 절은 신설 followup plan(`integration-personal-owner-followup.md`) 생성만 적고, 원 tracker 항목을 해소 표기(`[x]` + 포인터)로 되돌리는 작업은 어디에도 적혀 있지 않다. 이 tracker 파일은 동일 패턴("**완료 (날짜, PR/plan)**" 포인터)을 5760 라인 주변에서 반복적으로 쓰고 있어(예: 바로 위 rotate 항목, 아래 entity-tester 항목), 관례상 이 항목도 착지 시점에 같은 방식으로 닫혀야 한다. 지금 상태로 머지되면 tracker 는 이미 해소된 항목을 계속 미해결로 보여주게 되고, 다음 스윕(예: nullable-notation-followups 자체 정리 라운드)이 같은 결함을 중복 재발견할 수 있다.
  - 제안: target 의 "동반 산출물" 절(또는 착지 커밋 계획)에 "`spec-draft-nullable-notation-followups.md:5760` 항목을 `[x]` + 이 plan/커밋 포인터로 갱신" 을 한 항목 추가.

- **[INFO]** `pending_plans` 참조 파일의 존재 가드 — 생성 순서 의존
  - target 위치: `plan/in-progress/spec-draft-integration-personal-owner.md` 라인 69-75 (frontmatter 변경안 `pending_plans:`), 라인 100, 156-157
  - 관련 plan: 신설 예정 `plan/in-progress/integration-personal-owner-followup.md` (현재 저장소에 미존재 — 확인됨)
  - 상세: `spec/conventions/spec-impl-evidence.md` 의 `spec-pending-plan-existence.test.ts` 가드는 `pending_plans:` 의 모든 경로가 `plan/in-progress/` 또는 `plan/complete/` 에 실존할 것을 요구한다. target 이 제안하는 `4-integration.md` frontmatter 변경(`pending_plans: [integration-personal-owner-followup.md]`)이 followup plan 파일 생성보다 먼저 커밋되면 이 가드가 즉시 깨진다. target 문서 자체가 "동반 산출물(같은 커밋)" 으로 명시했으므로 설계는 맞지만, 실제 착지 시 두 파일이 같은 커밋에 함께 들어가는지 확인이 필요하다.
  - 제안: 착지 커밋에서 `4-integration.md` frontmatter 갱신과 `integration-personal-owner-followup.md` 신설을 같은 커밋(또는 최소한 같은 PR 내 가드 통과 시점)에 포함시킬 것.

- **[INFO]** developer 구현 plan 미생성 — 선행 조건이 아니라 예정된 다음 단계
  - target 위치: `plan/in-progress/spec-draft-integration-personal-owner.md` 라인 34
  - 관련 plan: `plan/in-progress/integration-personal-owner.md` (현재 저장소에 미존재 — 확인됨)
  - 상세: target 은 "구현은 같은 PR 의 developer plan `plan/in-progress/integration-personal-owner.md` 가 한다" 고 전제하는데 그 plan 파일이 아직 없다. 다만 `#1399` 선례(`5ba95e4b8`/`bcc0402bb`)를 확인한 결과, 그 PR 도 "spec 커밋(직접 `spec/` 편집) → 별도 커밋으로 developer plan 파일 생성(`--impl-prep`) → 구현 커밋" 순서였다 — 즉 지금 시점(spec draft 를 `--spec` 으로 점검하는 단계)에 developer plan 이 없는 것은 선례와 일치하는 정상 순서이며 미해소된 선행조건이 아니다.
  - 제안: 별도 조치 불요. 다음 턴에서 developer plan 생성 시 이 draft 의 (A)(B)(C) 전문을 참조로 남길 것(선례 관행).

미해결 결정 충돌 관점에서는, 이 target 이 해소하려는 tracker 항목(`spec-draft-nullable-notation-followups.md:5760`)이 "범위를 먼저 정해야 한다" 고만 적어 두었을 뿐 구체적 해법을 선결하지 않았으므로, target 의 3가지 사용자 결정(범위/404/Admin RBAC)이 그 항목과 충돌하지 않는다. `plan/in-progress/` 전체(약 68개, 인접 auth·workspace·cafe24·RBAC 관련 plan 포함)를 grep 한 결과 Personal 통합 소유권·404 존재 은닉·Organization Admin 권한에 대해 다른 방향으로 이미 결정을 내린 plan 은 없었다. `auth-guard-reflection-hardening.md`(RolesGuard reflection 경화)는 `spec_impact: none` 이고 워크스페이스 경로 파라미터 가드에 국한돼 이 target 과 표면이 겹치지 않는다. `spec/data-flow/12-workspace.md` 의 "경로 파라미터 워크스페이스도 가드가 본다" 선례는 이미 `#1399` 로 merge 되어 있어 참조 시점 문제도 없다.

### 요약
`plan/in-progress/spec-draft-integration-personal-owner.md` 는 이미 merge 된 `#1399` 선례를 따르는 정상적인 spec-draft 단계 문서이며, 참조하는 tracker 항목(`spec-draft-nullable-notation-followups.md:5760`)의 미해결 결정("범위를 먼저 정해야 한다")과 충돌 없이 그 결정을 채워 넣는다. 전체 `plan/in-progress/` 를 훑어도 이 draft 와 반대 방향으로 이미 확정된 RBAC/오류코드/스코프 결정은 없었고, 선행 plan 미해소나 후속 항목 무효화도 발견되지 않았다. 다만 원 tracker 체크박스를 착지 시 명시적으로 닫는 계획이 target 문서에 빠져 있어(INFO), 착지 커밋 계획에 한 줄 추가가 권장되며, `pending_plans` 참조 파일(`integration-personal-owner-followup.md`)이 frontmatter 변경과 같은 커밋에 실제로 함께 들어가는지 확인이 필요하다(INFO, 이미 target 의 "동반 산출물" 설계와 일치).

### 위험도
LOW

# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 확보 완료)

## 전체 위험도
**LOW** — WARNING 1건(확립된 TOCTOU 락 패턴 이탈, 이미 절차적으로 완결·planner 백로그 등재 확인됨) 외 신규 충돌 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `removeMember()` owner 보호의 TOCTOU 방지가 이 도메인에서 확립된 비관적 락 패턴을 벗어난 네 번째 메커니즘(조건부 원자 `DELETE ... WHERE role != 'owner'` + `affected` 판별)을 채택했는데, spec 형제 서술 대비 비대칭 — `data-flow/12-workspace.md`가 `leaveWorkspace`/`deleteWorkspace`/`transferOwnership` 세 메커니즘은 명문화하면서 이 네 번째는 미기술 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()`; 대응 spec `spec/5-system/1-auth.md` §3.2 각주(†) | `spec/data-flow/12-workspace.md` §1.6 형제 3행(`leaveWorkspace`/`deleteWorkspace`/`transferOwnership` — 각각 `pessimistic_write` 명시) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 등재 확인됨 — 신규 조치 불요. 다음 planner 턴에서 `data-flow/12-workspace.md:141` 인근에 "owner 보호는 조건부 DELETE + affected-count 판별" 각주 추가 시 해소 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance | `CANNOT_REMOVE_OWNER`(및 자매 코드) 가 `3-error-handling.md` §1 중앙 에러 카탈로그 미등재 | `spec/5-system/3-error-handling.md` §1 / `spec/5-system/1-auth.md` §3.2 각주 | 리포지토리 초기 이관 이전부터 있던 기존 갭이며 문서 자체 Rationale 이 "workspace role/membership 코드 별도 pass" 로 이미 defer. 이번 PR 책임 범위 밖 — planner 백로그 등재 확인됨(신규 조치 불요) |
| 2 | cross_spec | `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스가 각주 삽입으로 GFM 표가 두 조각 렌더링 | `spec/5-system/1-auth.md` 366~391행 | 이번 diff 와 무관한 기존 포맷 결함, 이미 트래커 등재됨 — 신규 조치 불요 |
| 3 | rationale_continuity | 개발자 본인이 남긴 "기각된 대안"(#1373) 주석을 실측으로 정정 — 코드 주석은 spec 이 아니므로 developer 직접 수정 가능, 오도하는 옛 사유가 남지 않음 | `workspaces.service.ts` `removeMember()` 위 주석 | 확인만, 조치 불요 |
| 4 | plan_coherence | plan 체크리스트(`member-owner-toctou.md`)가 이미 수렴한 3라운드 `/ai-review`·CHANGELOG 정정·본 `--impl-done` 결과를 아직 미반영(`[ ]`) | `plan/in-progress/member-owner-toctou.md` §체크리스트 | 본 결과(BLOCK: NO) 수령 후 같은/후속 커밋에서 체크박스 3건 체크 + 트래커(L4917) 해소 + `plan/complete/` 이동 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/5-system` 델타 0, 순수 구현 강화. `data-flow/12-workspace.md` 미문서화 비대칭 외 데이터모델·API계약·요구사항ID·상태전이·RBAC 신규 충돌 없음 |
| rationale_continuity | LOW | 확립된 TOCTOU 비관적 락 패턴 이탈 WARNING 1건이나 (1) `--impl-prep`에서 선지적, (2) plan 이 계량적 손실로 대안 기각 근거 명시, (3) 코드 주석이 §8 선례와의 구조적 차이 기록, (4) planner 백로그 등재 완료 — "무근거 번복"의 반대 사례 |
| convention_compliance | NONE | 신규 명명·출력포맷·문서구조·API문서·금지항목 위반 없음. `CANNOT_REMOVE_OWNER` 카탈로그 갭은 기존 backlog |
| plan_coherence | NONE | 미해결 결정 충돌 없음, 선행 plan 전부 해소, `--impl-prep` 후속 항목 전부 트래커 등재 확인. plan 체크리스트 미갱신만 부기 사항 |
| naming_collision | NONE | 신규 식별자 `throwCannotRemoveOwner`·`VACUITY_GUARD_MS` 둘 다 유일, 기존 명명 관례 준수, 신규 API/이벤트/env/config 없음 |

## 권장 조치사항
1. (BLOCK 아님, 완결 확인용) 본 `--impl-done` 결과(BLOCK: NO) 수령 후 같은/후속 커밋에서 `plan/in-progress/member-owner-toctou.md` 체크리스트 3건 체크 + `spec-draft-nullable-notation-followups.md` L4917 트래커 해소 + `plan/complete/` 로 이동.
2. 다음 planner 턴에서 `spec/data-flow/12-workspace.md:141` 인근에 `removeMember` owner 보호 메커니즘(조건부 원자 DELETE + affected-count 판별) 각주 추가 — 이미 백로그 등재됨, 이번 PR 을 막을 사유 아님.
3. `CANNOT_REMOVE_OWNER` 등 workspace role/membership 에러 코드를 `3-error-handling.md` §1 카탈로그에 등재하는 별도 pass — 기존 defer 항목, 이번 PR 스코프 밖.
# Rationale 연속성 검토 — spec/5-system/ (--impl-done, 5회차)

## 검토 개요

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 자체의 파일 델타: **0** — 실측 `git diff origin/main...HEAD --stat -- spec/`
  출력 없음. `plan/in-progress/spec-followups-batch-b.md` 가 `spec_impact: none` 을 스스로 실측
  근거와 함께 명시하고 있고(상위 트래커 값을 그대로 옮긴 오기를 정정한 이력 포함), 이는 순수
  developer/harness 배치이므로 정상 — CRITICAL 근거 아님.
- 본 라운드는 **동일 diff 에 대한 5번째 연속 검토**다(`12_21_11`→NONE, `13_22_38`→LOW,
  `13_34_30`→LOW, `14_01_57`→NONE). 직전 라운드(`14_01_57`, 14:01) 이후 신규 커밋 2건
  (`d80583700`, `ead63d797`, 코드 리뷰 fix 라운드 2·3 반영)을 추가로 확인했다 — 실측
  (`git show --name-only`)상 두 커밋이 건드린 `codebase/**` 파일은 `source-scan.ts`(AST
  walker 죽은 분기 제거)와 `endpoint-path-conflict-wrap*`/`user-entity-exposure-guard.ts`/
  `*-fixtures.ts`/`oauth-config-mock.ts` 뿐이며, 전부 harness 테스트 유틸·가드 내부 리팩터라
  product 동작이나 spec 계약을 바꾸지 않는다.

## 항목별 대조 (신규 확인분)

### W1 제거(`enclosingScopeName` 죽은 분기) — Rationale 접점 없음

`source-scan.ts` 내부 AST 워커의 미관측 분기를 리뷰 뮤테이션으로 확인 후 삭제. `spec/5-system/`
어떤 Rationale 도 이 내부 구현 알고리즘을 규정하지 않는다. **대상 외.**

### W2 defer(안전한 `User` 투영을 공용 상수로 승격하지 않음) — data-model.md Rationale 과 정합

리뷰가 제안한 "`CREATOR_PROJECTION` 통합"을 developer 가 **명시 실측**(4곳 중 값이 겹치는 것은
2곳뿐, 그 2곳도 서로 다른 계약에 묶여 있음)으로 거부하고, `plan/in-progress/spec-draft-nullable-
notation-followups.md`(789행)에 재개 신호("같은 값에 묶인 자리가 셋째로 생기거나 두 계약이
수렴하면")까지 명시해 등재했다. 이는 `spec/1-data-model.md` Rationale "User 민감 컬럼 방어…
(2026-09-06)"이 채택한 "응답 경계 투영 + 검출 2축" 원칙과 충돌하지 않는다 — 오히려 `listMembers`
가 이미 `user-entity-exposure-guard` 보호 범위에 들어갔으므로(B-4), 이 defer 가 걱정하는 "다음
사람이 더 넓은 투영을 손으로 적는다"는 실패 모드를 그 가드가 대신 막는다는 근거도 논증했다.
**결정 번복이 아니라 근거를 갖춘 defer — Rationale 원칙 위반 없음.**

## 기존 라운드 항목 재확인 (변경 없음)

- `WorkspacesService.listMembers` 쿼리 레벨 `select` 투영, 트리거 `endpointPath` 409
  응답 형태(§1.10/§5.3), `http-exception.filter.ts` → `isPostgresUniqueViolation` 전환,
  `WorkflowVersionDetail` → `…Projection` 개명 — 4개 항목 모두 선행 4라운드에서 이미 전수
  대조됐고 이번 라운드까지 코드가 실질적으로 변하지 않았다(신규 diff 는 harness 파일에 한정).
  재확인 결과 결론 동일: 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 없음.

## 발견사항

- **[INFO]** (선행 3라운드 반복 지적, 이번 라운드는 신규 조치 불요) 쿼리 범위 DB-레벨 `select`
  투영 패턴이 `spec/1-data-model.md` Rationale 표에 아직 정식 등재되지 않음
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts`(`listMembers`)
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → "`User` 민감 컬럼 방어를
    `select: false` 가 아니라 응답 경계에 둔 이유 (2026-09-06)" 결정표
  - 상세: `12_21_11`·`13_22_38`·`13_34_30` 세 라운드가 동일하게 지적한 문서 정합 갭이다.
    이번 라운드에 재확인한 결과, **이미 `plan/in-progress/spec-draft-nullable-notation-
    followups.md` 749행에 planner 담당 오픈 항목으로 정식 등재돼 있다**("`select` 투영을
    `1-data-model.md ## Rationale` 에 정식 등재" — 4번째 행 또는 채택 행 하위 각주로,
    `WorkflowVersionsService.findOne`·`WorkspacesService.listMembers` 두 사례 인용 예정).
    즉 이 INFO 는 **누락된 발견이 아니라 이미 계획된 후속 작업**이며, developer 턴인 이 배치가
    직접 처리할 항목이 아니다(spec 쓰기 권한은 project-planner 소관).
  - 제안: 추가 조치 불요 — 다음 project-planner 턴에서 749행 항목을 처리하면 해소된다. 이
    checker 가 반복 지적하는 것을 막으려면 후속 라운드에서는 "이미 tracker 749행에 등재됨"
    상태만 재확인하고 새 INFO 로 재기표하지 않는 것을 권장.

## 요약

5번째 연속 검토에서도 결론은 변하지 않는다 — 이 배치(B-1~B-8 및 후속 코드리뷰 fix 2라운드)는
`spec/5-system/` 본문을 건드리지 않는 순수 developer/harness 정리이며, 관련 spec
(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·교차 인용된 `1-data-model.md`·
`2-trigger-list.md`)의 기존 `## Rationale` 이 확정한 결정·원칙 중 어느 것도 기각된 대안으로
되돌리거나, 원칙을 위반하거나, 새 근거 없이 번복하지 않는다. 직전 라운드 이후 추가된 두 커밋도
harness 내부 리팩터(죽은 분기 제거)와 근거를 갖춘 defer(공용 상수 미승격, 재개 신호 명시)뿐이라
결론에 영향을 주지 않는다. 유일한 잔여 사항(쿼리 범위 `select` 투영의 Rationale 표 미등재)은
이미 planner 후속 트래커에 등재돼 있어 이 라운드가 새로 열 항목이 아니다.

## 위험도

NONE

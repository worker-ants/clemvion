# Rationale 연속성 검토 — `remove-member-order-coverage`

## 대상 요약

target 은 `plan/in-progress/remove-member-order-coverage.md` — `workspaces.service.ts`
`removeMember()` 의 이미 확정된 판정 순서(멤버십 → 대상 존재 → self 위임 → admin →
대상 owner 여부)에 대해 아직 커버되지 않은 두 인접 쌍(대상 존재→admin, 요청자 role
1회 조회)을 unit 테스트로 고정하는 작업이다(`spec_impact: none`). 프로덕션 코드의
판정 순서 자체는 바꾸지 않으며, 뮤턴트(M-a/M-b/M-b2)는 새 테스트의 민감도를
검증하는 임시 조작(`cp` 복원)일 뿐 채택되는 변경이 아니다.

이 순서는 직전 완료 PR `plan/complete/member-auth-order.md` 가 확정한 것이고, 그 PR
자신이 `--impl-prep`(`review/consistency/2026/09/24/10_22_24`) 의 `rationale_continuity`
WARNING 1(기각된 opt-in/수동-체크 계열 재도입 우려)을 §B-2 에서 3단으로 반박한 뒤 채택됐으며,
`--impl-done`(`11_50_40`)도 Critical 0·Warning 0 으로 닫았다. 현재 코드
(`codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember` 본문
및 그 위 docstring)를 직접 읽어 위 순서와 일치함을 확인했다.

## 발견사항

- **[INFO]** 순서를 시스템 invariant 로 오인하지 않도록 명시한 서술은 유지할 가치가 있다
  - target 위치: `plan/in-progress/remove-member-order-coverage.md` §A-1
  - 과거 결정 출처: `plan/complete/member-auth-order.md` §B (admin 판정을 owner 판정
    앞으로 옮긴 근거), `spec/data-flow/12-workspace.md` §1.6 행(`DELETE
    /api/workspaces/:id/members/:memberId` — "owner 는 제거 불가")
  - 상세: target 문서는 스스로 "이 테스트가 고정하는 것은 «문서화된 순서» 이지 보안
    불변이 아니다"(§A-1)라고 정확히 짚었다. 이는 이 저장소가 반복적으로 요구해 온 원칙
    — "결정을 뒤집을 때는 Rationale/docstring 을 함께 갱신하라"(과거 Trigger `hmacSecret`
    R-2, `assertMembership` 도입 이력 등에서 반복) — 를 사전에 충족하는 방향으로 적혀
    있다. 실제 결함은 아니며, 이 서술 습관을 다음 세션이 참고할 수 있게 그대로 유지할
    것을 제안한다.
  - 제안: 조치 불필요. 향후 순서를 403 계열로 바꾸는 편집이 있을 경우, 이 테스트와
    `removeMember` docstring · `plan/complete/member-auth-order.md` 인용을 함께 갱신하라는
    §A-1 의 안내를 그대로 따르면 된다.

이 외에 CRITICAL/WARNING 급 발견 없음:

- **기각된 대안의 재도입 없음** — target 이 도입하는 것은 순수 테스트(unit assertion)이며,
  `spec/data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관"이
  기각한 "라우트별 opt-in 수동 체크 확산" 패턴과 무관하다. `removeMember` 내부의 단일
  메서드 판정 순서는 그 결정의 적용 범위(`handlerConsumesWorkspaceId` 로 정의된 모집단)
  밖이라는 점도 직전 PR §B-2 가 이미 실측·반박했고, 이번 target 은 그 결론을 재론하지 않고
  그대로 이어받는다.
- **합의된 원칙 위반 없음** — `spec/data-flow/12-workspace.md` §1.6 표("owner 는 제거
  불가", "본인 제거는 자가 탈퇴로 위임")와 `spec/5-system/1-auth.md:377`("Admin 의 멤버
  삭제는 대상이 Owner 인 경우 거부된다")가 규정하는 결과 계약은 target 이 고정하려는
  테스트로도 그대로 유지된다 — 코드를 열어 확인한 실제 판정 순서(`requesterRole` 조회 →
  `throwNotAMember` → `findOne` → `throwMemberNotFound` → self 위임 → `throwAdminRequired`
  → `throwCannotRemoveOwner`)와 target 표의 다섯 단계 서술이 정확히 일치한다.
- **결정의 무근거 번복 없음** — target 은 기존 순서를 바꾸지 않는다. 오히려 그 순서를
  테스트로 "닫는" 마무리 작업이며, `/ai-review` 가 두 라운드(`11_10_45`→`11_37_06`)
  연속 지적한 INFO 를 해소하는 정당한 후속(수렴 예외 (a)~(d)로 이미 트래커에 등재된 항목의
  이행)이다.
- **암묵적 가정 충돌 없음** — 요청자 role 을 1회만 읽는다는 성능/일관성 가정(같은 쿼리
  중복 방지, `member-auth-order.md` §B "조회를 두 번 돌리지 않는다")을 테스트로 강제하는
  것은 그 가정을 우회하는 것이 아니라 그대로 보존·검증하는 것이다.

## 요약

target 은 신규 설계 결정이 아니라, 직전에 이미 Rationale 근거와 함께 확정·리뷰를 통과한
`removeMember` 판정 순서에 대한 잔여 테스트 커버리지 두 칸을 채우는 마무리 작업이다.
코드를 대조한 결과 실제 구현 순서와 target 문서의 서술이 일치하고, target 자신이 "이
테스트는 문서화된 순서를 고정할 뿐 보안 불변이 아니다"라고 명시해 향후 의도적 순서 변경
시 Rationale/테스트 동반 갱신 원칙을 스스로 예고해 두었다. 기각된 대안의 재도입, 원칙
위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE

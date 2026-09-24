# Rationale 연속성 검토 — `remove-member-order-coverage` (--impl-done)

## 대상 요약

target 은 `spec/2-navigation/` scope 의 --impl-done 검토이나, 이 scope 의 spec 델타는 0개다.
실제 diff 는 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 1개 파일
48줄 — `removeMember()` 의 이미 확정된 판정 순서(멤버십 → 대상 존재 → self 위임 → admin →
대상 owner 여부)에서 아직 커버되지 않았던 두 인접 쌍(대상 존재→admin, 요청자 role 1회 조회)을
unit 테스트로 고정하는 순수 테스트 추가다. 프로덕션 코드(`workspaces.service.ts`)는 이 diff 에서
바뀌지 않는다 — 직전 완료 PR(`plan/complete/member-auth-order.md`, 커밋 `33caa750c`)이 이미
그 순서를 구현·리뷰 완료해 둔 상태다.

절대경로 워킹트리에서 직접 확인:

- `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` 본문 —
  `getMemberRole` → `throwNotAMember` → `findOne` → `throwMemberNotFound` → self 위임
  (`leaveWorkspace`) → `throwAdminRequired`(ADMIN_ROLES 미포함) → `throwCannotRemoveOwner`
  순서가 머리 주석("판정 순서: 멤버십 → 대상 존재 → self 위임 → admin → 대상이 owner 인가")과
  정확히 일치.
- 신규 테스트 두 건은 이 순서 중 "대상 존재 → admin"(비-admin 이 없는 대상을 지목 →
  `MEMBER_NOT_FOUND`, `ADMIN_REQUIRED` 아님)과 "요청자 role 1회 조회"(`findOne` 요청자-모양
  호출이 정확히 1건)를 단언 — 둘 다 이미 구현된 동작을 사후에 고정할 뿐 새 설계를 도입하지
  않는다.

## 기각·합의 원칙 대조

- **기각된 대안의 재도입 없음** — `spec/data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서
  — `@Roles()` 와 무관"이 기각한 것은 "73개 라우트에 `@Roles('viewer')` 부착"이라는 **가드-레벨
  opt-in 확산 패턴**이다. target 은 그 결정의 적용 범위(`@WorkspaceId()` 소비 라우트 모집단, 이
  핸들러는 `@Param('id')` 라 범위 밖) 밖에서 이미 33caa750c 가 재배치한 **서비스 내부 단일 메서드
  판정 순서**에 대한 테스트일 뿐이며, 그 재배치 자체의 정당성은 직전 --impl-prep(`10_22_24`)
  WARNING 1 → §B-2 3단 반박 → --impl-done(`11_50_40`) Critical 0·Warning 0 으로 이미 닫혔다.
  이번 diff 는 그 결론을 재론하지 않고 그대로 이어받는다 — 재도입이 아니라 사후 커버리지다.
- **합의된 원칙 위반 없음** — `spec/data-flow/12-workspace.md` §1.6 표("owner 는 제거 불가",
  "본인 제거는 자가 탈퇴로 위임")·`spec/5-system/1-auth.md §3.2` 정정 노트("Admin 이 멤버 삭제
  가능")가 규정하는 **결과 계약**은 신규 테스트로도 그대로 유지된다. `listMembers` 가
  `assertMembership` 만 요구한다는 신규 테스트 주석의 전제도 코드 확인 결과 정확하다
  (`listMembers` 첫 줄 `await this.assertMembership(...)`).
- **결정의 무근거 번복 없음** — target 은 순서를 바꾸지 않는다. `/ai-review` 두 라운드
  (`11_10_45`→`11_37_06`)가 연속 지적한 INFO(대상 부재 vs admin 판정 순서 커버리지 갭)를
  해소하는 트래커 등재 후속이다.
- **암묵적 가정 충돌 없음** — "요청자 role 을 두 번 조회하지 않는다"는 `member-auth-order.md`
  §B 의 성능/일관성 근거를 그대로 보존·검증할 뿐 우회하지 않는다.

## 발견사항

- **[INFO]** "이것은 보안 불변이 아니라 문서화된 순서다" 라는 자기-한정 서술은 유지할 가치가 있다
  - target 위치: 신규 테스트 docstring(`workspaces.service.spec.ts`, "대상이 없으면..." 테스트
    블록) 및 `plan/in-progress/remove-member-order-coverage.md` §A-1
  - 과거 결정 출처: `plan/complete/member-auth-order.md` §B(admin 판정을 owner 판정 앞으로 옮긴
    근거), `spec/data-flow/12-workspace.md` §1.6
  - 상세: 신규 테스트는 스스로 "이 블록이 막는 것은 403 이 아니라 둘이 조용히 갈라지는 것"이라고
    명시하고, 형제 `updateMemberRole`(assertAdmin 이 첫 줄이라 같은 입력에 403)과의 의도적
    비대칭을 인지한 채 "그쪽에 맞추기로 한다면 `removeMember` 머리 주석의 판정 순서와 이 블록을
    **함께** 바꿀 것"이라고 미리 적어 두었다. 이는 이 저장소가 반복 요구해 온 원칙 —
    "결정을 뒤집을 때는 Rationale/docstring 을 함께 갱신하라" — 을 사전에 충족하는 방향이다.
    실결함은 아니다.
  - 제안: 조치 불필요. 향후 두 형제 메서드의 응답을 403 계열로 통일하는 편집이 있다면, 이
    안내를 따라 테스트·머리 주석을 동반 갱신하면 된다.
- **[INFO]** spec 문서 3곳의 stale 전제는 이미 추적 중 — 이번 diff 가 악화시키지 않음
  - target 위치: (참고, target 범위 밖) `spec/5-system/3-error-handling.md:46,49`,
    `spec/5-system/1-auth.md:551`
  - 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md` (W4·W5 로
    33caa750c 커밋 메시지가 등재한 항목 — "셋 다 `removeMember` 가 `assertAdmin` 을 호출한다는
    전제로 쓰인 서술")
  - 상세: 세 spec 서술은 `removeMember` 가 `assertAdmin()` 을 직접 호출한다고 전제하지만,
    33caa750c 이후 실제로는 `throwAdminRequired()` 를 인라인으로 던진다(결론 — "Admin 이상만
    제거 가능" — 은 여전히 참, 근거로 든 호출 경로만 stale). 이는 developer 권한 밖(spec/ 은
    developer 쓰기 금지, 자기-반증형 소정정 조건 1도 미충족 — developer 자신이 쓴 문장이 아님)
    이라 이미 project-planner 백로그로 정확히 이관돼 있다. 이번 test-only diff 는 그 서술을
    참조하거나 강화하지 않으므로 이 diff 자체가 원인이 아니며, 새로 발견된 것도 아니다(이미
    추적 중인 항목의 재확인).
  - 제안: 조치 불필요(developer 스코프 밖). project-planner 가 백로그 항목을 처리할 때
    `removeMember` 의 실제 판정 순서(멤버십 → 대상 존재 → self 위임 → admin → owner)를 반영해
    세 서술을 갱신하면 된다.

CRITICAL/WARNING 급 발견 없음.

## 요약

target 은 신규 설계 결정이 아니라, 직전 PR(`member-auth-order`, 커밋 `33caa750c`)이 이미
Rationale 근거(§B-2 3단 반박, `12-workspace.md` §"멤버십 검증은 가드 1곳에서" 적용 범위 밖 논증)
와 함께 확정·`--impl-prep`/`--impl-done` 양쪽 게이트를 Critical 0·Warning 0 으로 통과한
`removeMember` 판정 순서에 대해, 남은 테스트 커버리지 두 칸을 마저 채우는 순수 unit 테스트
추가다. 워킹트리 코드를 직접 대조한 결과 신규 테스트의 단언과 실제 구현 순서가 정확히 일치하고,
target 스스로 "문서화된 순서이지 보안 불변이 아니다"라는 한정을 명시해 향후 의도적 순서 변경 시
Rationale·테스트 동반 갱신 원칙을 예고해 두었다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거
번복, 암묵적 invariant 우회 중 어느 것도 발견되지 않았다. spec 3곳의 서술 stale 은 이미
project-planner 백로그로 올바르게 이관돼 있으며 이번 diff 의 원인도, 새 발견도 아니다.

## 위험도

NONE

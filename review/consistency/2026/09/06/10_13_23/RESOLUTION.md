# RESOLUTION — `review/consistency/2026/09/06/10_13_23`

**원 결과**: BLOCK: NO · Critical 0 · WARNING 3 · 위험도 MEDIUM
**처분**: developer 권한 안의 2건은 수정 · 권한 밖 2건은 planner 후속으로 등재

## WARNING 1 (4/5 checker 독립 보고) — 신규 가드 2건이 `code:` 밖

**정본 게이트에 직접 물어 확인했다.** checker 는 `fnmatch` 로 판정했다고 적었는데, 나는
그것을 재구현하지 않고 `review_guard._spec_linked_changes(repo_root, changed)` 를 그대로
호출했다 — 신규 4파일 중 **0건**이 spec-linked 다. 지적이 맞다.

의미: **이 가드들을 약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가 물지 않는다.**
래칫에 fixture 가 없어 술어가 죽어도 그린이었던 것과 같은 등급의 사각지대다.

**이 브랜치에서 고칠 수 없다** — `spec/` 쓰기는 planner 몫이다. 대신 두 가지를 했다:

1. `plan` 에 planner 항목으로 등재 (§5.4 「검증 층」 **두 행** + 두 문서 `code:`).
   검증자가 이제 셋이므로 *"정확히 두 검증자"* 로 읽히는 인접 서술도 함께 보라고 적었다.
2. **완료 노트에서 그 항목을 가리키게 했다.** checker 가 짚은 대로, 완료만 표시하고 후속을
   안 적으면 draft 종결 조건(`## 후속` 체크박스 전부 닫힘)이 조용히 거짓이 된다.

plan_coherence 가 *"하루 전 자매 항목이 이미 겪은 패턴의 재발"* 이라고 적었는데 그 판단이
맞다 — `response-contract.ts` 를 두 문서 **양쪽**에 등재한 그 건이다. 등재 문구에 그
선례와 "한쪽만 하면 사각지대가 남는다" 는 실측을 함께 남겼다.

## WARNING 2 — `User` 7컬럼 노출 금지가 spec 에 없다

지금 그 불변식의 SoT 는 **코드뿐**(`USER_SECRET_KEYS`)이다. Trigger·AuthConfig 계열은
`secret-store.md §1.1` 이 규범을 세웠는데 `User` 에는 대응 절이 없다.

**planner 후속으로 등재.** 결정 근거(전수 열거 수치·기각한 두 대안·채택 이유)를 `plan`·
`CHANGELOG` 에서 해당 문서의 `## Rationale` 로 옮기는 것도 같은 항목에 묶었다 (INFO#1).

## WARNING 3 — e2e 케이스 레터 `F.` 중복 → **수정**

`workspace-rbac.e2e-spec.ts` 에 `F.` 가 둘이 됐다(기존 *sole owner 는 leave 불가*). 이
레터 체계를 `plan/complete/**` 가 추적 포인터로 인용하므로 실제 혼동 표면이다.

전수로 세어 미사용 레터를 골랐다 — 파일의 마지막 레터는 `I.` 이고(`S.` 는 별개 계열),
신규 케이스를 **`J.`** 로 바꿨다.

## INFO 2 — `joinedAt` JSDoc 이 도달 불가 시나리오를 근거로 들었다 → **수정**

내가 *"아직 수락 전이면 `null`"* 이라고 적었는데 **실측이 반증**했다: `workspace_member`
행을 만드는 자리 **네 곳이 전부** `joinedAt: new Date()` 로 즉시 채운다. 수락 전 초대는
이 테이블이 아니라 `WorkspaceInvitation` 에 산다.

`nullable` 선언 자체는 유지한다 — **스키마가 그렇다**. 다만 근거를 *"스키마를 따른 것이지
현행 코드의 도달 가능한 상태가 아니다"* 로 바꾸고 실측을 함께 적었다. 거짓 근거는 다음
사람의 판단 기준을 바꾼다.

## INFO 3 — §5.4 스윕 카운트

수치를 갱신하지 않았다. 그 항목 자신이 *"숫자를 지금 갱신하면 또 낡는다"* 고 적어 두었으므로,
**배선이 하나 늘었다는 사실**과 *"다음에 열 때 그 시점 실측치로 다시 센다"* 만 완료 노트에
남겼다.

## 검증

`plan`·주석·테스트 이름만 바뀌었다 (동작 변경 0). 아래 전 단계를 다시 돌린다.

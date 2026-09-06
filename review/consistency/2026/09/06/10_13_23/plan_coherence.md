# Plan 정합성 검토 — target: `spec/5-system/` (impl-done)

## 전제 확인

- `spec/5-system/**` 자체의 파일 델타는 0 (정상 — 이번 브랜치는 코드 전용 PR). 실제 diff 8파일/681줄은
  `codebase/backend/src/repo-guards/__tests__/{user-entity-exposure-guard.ts,user-entity-exposure.spec.ts,fixtures/user-relation-load.fixture.ts}`,
  `codebase/backend/src/shared/testing/{user-secret-absence.ts,user-secret-absence.spec.ts}`,
  `codebase/backend/test/{audit-logs.e2e-spec.ts,workspace-rbac.e2e-spec.ts}`,
  `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`,
  `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` (HEAD 워킹트리 실측).
- 핵심 변경: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 체크박스
  **"`User` 엔티티에 컬럼 수준 방어를 둘지 결정"** 을 `[ ]` → `[x]` 로 닫고, 전수 열거(민감
  7컬럼을 읽는 19곳·공유 로더·`relations:['user']` 3곳) 후 `select:false`/전역
  `ClassSerializerInterceptor` 둘 다 기각하고 **제3의 길**(구조 가드 + 이름 기반 부재 단언, "검출이지
  방어가 아니다")을 택했다는 완료 노트를 덧붙였다.

## 발견사항

- **[WARNING]** 신규 검증자 2건이 §5.4 "검증 층" 표와 `code:` 글롭에 미등재
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 "검증 층" (라인 224-243, 특히
    228~235 의 2행짜리 검증자 표)과 동 파일 frontmatter `code:` 글롭(라인 3-16). 이번 diff 는
    이 파일을 전혀 건드리지 않았다 — 그런데 아래 근거상 건드렸어야 한다.
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    "`User` 엔티티에 컬럼 수준 방어를 둘지 결정" 항목(방금 `[x]` 로 닫힘). 같은 plan 파일
    바로 아래(라인 ~389-409)에 **하루 전(2026-09-05) 완료된 자매 항목**이 이미 이 정확한
    패턴을 겪었다: 신규 검증자 `response-contract.ts` 를 만들었을 때 `2-api-convention.md
    §5.4` 와 `swagger.md §5-1` **양쪽 모두**에 등재해야 했고("한쪽만 하면 사각지대가
    남는다"), `code:` frontmatter 등재까지 확인해야 진짜 "등재"라는 점("문서에 '등재
    완료'라고 적는 것만으로는 등재가 아니다")까지 그 항목 스스로 기록해 두었다.
  - 상세: 이번에 신설된 `user-entity-exposure-guard.ts`(구조 축 — `relations:[…'user'…]`/
    `leftJoinAndSelect` AST 카운트)와 `user-secret-absence.ts`(이름 축 — 응답 본문 깊이
    훑어 7컬럼 이름 부재 단언)는 스스로의 JSDoc 에서 `response-contract.ts`(선언↔선언 아님,
    값↔선언)와의 차이를 "선언과 무관하다"로 명시하며, §5.4 표의 `response-contract.ts` 행이
    적어 둔 "못 보는 것 — 배선되지 않은 엔드포인트" 라는 정확히 그 빈틈을 메우려고 만들어졌다.
    즉 이 둘은 §5.4 가 이미 공식화한 "검증 층" 프레임의 **세 번째·네 번째 축**인데, 그 표에는
    행이 추가되지 않았다. 기계적으로도 확인했다 — repo 전체 spec `code:` 글롭을 대상으로
    `fnmatch` 로 대조한 결과 다음 4개 신규 파일 모두 **어느 spec 의 `code:` 글롭에도 매치되지
    않는다**: `repo-guards/__tests__/user-entity-exposure-guard.ts`,
    `repo-guards/__tests__/user-entity-exposure.spec.ts`,
    `shared/testing/user-secret-absence.ts`, `shared/testing/user-secret-absence.spec.ts`.
    `review_guard.py::_spec_linked_changes()`(push 게이트가 "spec-linked 파일이 바뀌었는데
    최신 `--impl-done` 리포트가 없다"를 판정하는 실제 코드)는 이 글롭 매치에만 의존하므로,
    앞으로 이 두 가드 파일이 바뀌어도 게이트는 "spec 문서화된 표면"으로 인식하지 못하고
    재검토를 트리거하지 않는다 — 자매 항목이 하루 전에 이미 겪고 고친 바로 그 사각지대다.
  - 제안: `spec/5-system/2-api-convention.md` frontmatter `code:` 에
    `codebase/backend/src/repo-guards/__tests__/user-entity-exposure*.ts` ·
    `codebase/backend/src/shared/testing/user-secret-absence*.ts` 를 추가하고, §5.4 "검증 층"
    표에 두 행(구조 축/이름 축)을 보태 "못 보는 것" 열도 서로 채우는 planner 턴이 필요하다.
    (부수적으로 `spec/conventions/swagger.md §5-1`·`spec/conventions/secret-store.md §1.1` 도
    같은 축을 논하므로 등재 대상 후보다.) `developer` 는 spec 을 직접 못 고치므로, 이 완료
    노트에 **다음 planner 턴을 위한 새 체크박스**를 남겨야 이 draft 의 "종결 조건 = `## 후속`
    체크박스 전부 닫힘" 이 조용히 거짓이 되지 않는다.

- **[INFO]** §5.4 drift 배치 2단계 스윕 카운트가 이번 diff 로 1개 더 stale
  - target 위치: 없음(같은 plan 파일 내부 정합성 이슈).
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4 drift 배치 —
    2단계" 항목의 "스윕 1차 (2026-09-05) — 4 → 18개 DTO" 기록.
  - 상세: 이번 diff 가 `workspace-rbac.e2e-spec.ts` 에 `assertMatchesContract(rows[0], await
    contractForDto(WorkspaceMemberDto))` 를 새로 배선해 §5.4 실응답-대조 커버리지가 18→19
    DTO 로 늘었다. 이 항목은 이전에 "스윕 1차" 라운드를 명시적으로 날짜 찍어 기록하는 관행을
    세워 두었는데(4→18), 이번 19번째 배선은 그 라운드 기록에 반영되지 않았다. 이 항목 자체가
    "개수는 `## 후속` 의 미체크 체크박스가 단일 진실" 이라 경고해 둔 만큼, 카운트 자체보다
    "배선된 DTO 목록"(표)이 실제보다 1개 적게 보이는 것이 다음에 이 항목을 여는 사람의
    판단을 왜곡할 수 있다.
  - 제안: 심각하지 않음 — 다음에 이 항목을 열 때(스윕 2차 착수 시) 실측치로 다시 세면 자연히
    해소된다. 지금 당장 갱신할 필요는 없으나, "곁가지 성과"로 적은 `joinedAt` 발견 옆에 "이
    배선이 §5.4 스윕 카운트에도 +1"이라는 한 줄을 남겨 두면 다음 사람이 18을 그대로 믿지
    않는다.

## 검토하였으나 문제 없음으로 판정한 지점 (근거 기록)

- **결정 자체의 정당성**: 체크박스가 요구한 선행 조건("민감 7컬럼을 읽는 자리 전수 열거")은
  실제로 먼저 수행됐다(19곳/46곳/3곳 표) — "착수 시 먼저 잴 것" 지시를 건너뛰지 않았다.
- **`select:false`/전역 `ClassSerializerInterceptor` 기각과 제3의 길 선택**은 `spec/
  conventions/secret-store.md §1.1`("컬럼 수준(`select: false`)은 그 컬럼을 읽는 내부 경로가
  조용히 오작동하므로 쓰지 않는다")이 이미 다른 필드(Trigger/AuthConfig 비밀)에 대해 세워 둔
  동일 논거와 일치한다 — 자기모순 없음. 다만 secret-store.md §1.1 은 "엔티티를 그대로 반환하는
  경로에서는 응답 경계에서 지운다"고 쓰는데, 이번 선택은 "검출만 하고 막지 않는다"고 명시한다.
  그러나 §1.1 이 실제로 인용하는 두 시행 축(§5.4 응답-계약 검증·swagger §5-1) 자체도 런타임
  스트립이 아니라 **e2e 단언(=검출)** 이므로, 이번 선택은 이 저장소의 기존 시행 철학과 같은
  종류다 — 이 축은 CRITICAL 로 볼 근거가 아니라 위 WARNING(등재 누락)으로 흡수된다.
- **민감 컬럼 목록 일치**: `USER_SECRET_KEYS` 7개는 `spec/1-data-model.md` User 엔티티 표(§2.1,
  password_hash/email_verify_token/email_change_token/password_reset_token/
  two_factor_secret/totp_recovery_codes/webauthn_recovery_codes)와 1:1 대응한다. drift 없음.
  이 표 자신의 frontmatter `code:` 는 엔티티 파일 글롭이라 이번 신규 테스트/가드 파일과는
  무관 — 등재 대상이 아니다(위 WARNING 은 `2-api-convention.md` 를 겨눈다).
  `plan/in-progress/spec-sync-auth-gaps.md`(`1-auth.md` 의 `pending_plans`) 등 다른
  in-progress 문서를 grep 했으나 `User` 컬럼 방어·`select:false`·`ClassSerializerInterceptor`
  관련 미해결 결정과의 충돌은 없다.
- **`WorkspaceMemberDto.joinedAt` 신규 선언**은 §5.4 "기본형"(상시 존재 + `nullable: true`)
  규칙을 그대로 따른다. 이 필드가 속한 워크스페이스 멤버 표면 문서(`spec/2-navigation/**`)는
  이번 검토의 target 범위(`spec/5-system/`) 밖이라 별도 스코프의 몫으로 남긴다(정합성 위반이
  아니라 스코프 경계).

## 요약

이번 브랜치는 `spec/5-system/**` 문서를 건드리지 않는 순수 코드 PR 이고, 유일한 plan 변경은
`spec-draft-nullable-notation-followups.md` 의 "User 컬럼 방어" 체크박스를 닫은 것이다. 그
결정 자체(전수 열거 → 제3의 길 채택)는 선행 조건을 충족했고 기존 secret-store 규약의 논거와도
일치해 미해결 결정을 우회하지 않는다. 다만 이 완료가 신설한 두 검증자(`user-entity-exposure-
guard.ts`, `user-secret-absence.ts`)는 §5.4 "검증 층" 프레임의 세 번째 축인데도 `spec/5-system/
2-api-convention.md` 의 표·`code:` 글롭 어디에도 등재되지 않았다 — 바로 그 plan 파일이 하루 전
자매 항목에서 겪고 명문화해 둔 "한쪽만 등재하면 사각지대가 남는다" 패턴이 이번엔 아예
등재되지 않은 채 재발했다. 이는 다음 planner 턴이 처리해야 할 명확한 후속 항목이며, 지금
등재하지 않으면 이 가드 파일들이 나중에 바뀌어도 push 게이트가 spec 재검토를 트리거하지
못한다(실측: `_spec_linked_changes()` 글롭 매치 0/4). 그 외 §5.4 drift 스윕 카운트 1건의 경미한
stale 은 다음 라운드에서 자연 해소되는 수준이다.

## 위험도

MEDIUM

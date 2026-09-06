# Plan 정합성 검토

## 발견사항

- **[WARNING]** 새 후속 항목이 스스로 진단한 3축 중 1축(JSDoc 인용 축)의 등재를 누락
  - target 위치: 이번 PR 의 실제 변경 — `codebase/backend/src/shared/testing/user-secret-absence.ts`, `codebase/.../__tests__/user-entity-exposure-guard.ts`, `codebase/.../__tests__/dto-jsdoc-citation-guard.ts` (모두 신규, 어떤 spec `code:` 에도 미등재)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 375~402행, 이번 PR 이 방금 추가한 항목 **"신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재"**
  - 상세:
    - 이 항목의 진단 문단(378~382행)은 **3개** 가드 파일을 명시적으로 나열한다 — `user-entity-exposure-guard.ts`(구조 축) · `user-secret-absence.ts`(이름 축) · `dto-jsdoc-citation-guard.ts`(JSDoc 인용 축). 셋 다 `review_guard._spec_linked_changes()` 가 spec-linked 로 못 본다고 실측까지 적었다.
    - 그런데 제목은 **"2축"**이고, 처방 문장(391~392행)도 *"§5.4 「검증 층」 소절에 **두 행**(구조 축 / 이름 축)을 더하고"* 라고만 적어 **JSDoc 인용 축의 등재 행위를 어디에도 지시하지 않는다.** 파일 전체를 grep 해도 `dto-jsdoc-citation-guard.ts` 를 어떤 spec 의 `code:` 에 넣으라는 지시는 이 항목 외 어디에도 없다(같은 파일 내 다른 두 항목·`review-citations.md`·`spec-draft-api-convention-verifier-registration.md` 모두 미언급 — 전수 grep 확인).
    - 같은 "2축 vs 실제 3개" 오표기가 이번 PR 이 함께 쓴 `CHANGELOG.md`("Unreleased — `User` 엔티티에 마지막 방어선을 세운다 (검출 2축)" 제목 아래 실제로는 3개 불릿을 나열)에도 나타난다 — 우연한 오탈자가 아니라 이 PR 전체에서 "2축" 표기가 굳어진 것으로 보인다.
    - 결과적으로 이 항목을 문자 그대로 집행하는 planner 는 §5.4 「검증 층」·`code:` 에 구조 축·이름 축만 등재하고 끝낼 것이고, 이 항목이 방금 지적한 위험(*"이 가드들을 약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가 안 문다"*)이 JSDoc 인용 축에 대해서만 그대로 남는다. `dto-jsdoc-citation-guard.ts` 가 지키는 규칙(DTO JSDoc 리뷰 인용 금지)의 실제 소유 문서는 `review-citations.md §3` 로 보이는데, 그 문서의 현재 `code:`(`roles.guard.spec.ts`, `sanitize-loader-error.ts`)에도 이 신규 가드는 없다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 항목을 갱신해 (a) 제목의 "2축"을 실제 개수로 정정하거나 개수를 언급하지 않는 형태로 바꾸고, (b) 처방 문장에 `dto-jsdoc-citation-guard.ts` 의 등재 대상 문서(§5.4 인지 `review-citations.md` 인지 명시)를 추가한다. `CHANGELOG.md` 제목도 같은 이유로 정정 대상이다.

- **[INFO]** 이번 follow-up 이 참조하는 "두 검증자" 문구의 근원 plan 이 완료 후에도 `in-progress` 로 남아 있음
  - target 위치: (참고) `plan/in-progress/spec-draft-nullable-notation-followups.md` 394~399행 — *"두 검증자"* 라고 못 박은 문장 2건을 정정 대상으로 지목
  - 관련 plan: `plan/in-progress/spec-draft-api-convention-verifier-registration.md` (frontmatter `status: in-progress`, 이번 PR 은 이 파일을 건드리지 않음)
  - 상세: 이 plan 이 등재하려던 "§5.4 검증자 2종 등재 + 역할 경계 명문화" 작업은 이미 `origin/main` 에 커밋 `983fd0ade`(PR #1289, "docs(spec): §5.4 검증자를 양쪽 규약에 등재하고 두 검증자의 경계를 적는다")로 병합되어 있다(`git merge-base HEAD origin/main` 이 그 커밋을 포함). 즉 이 plan 문서는 실질적으로 완료됐지만 `plan/complete/` 로 이동되지 않은 채 `plan/in-progress/`에 남아 있다. 이번 PR 이 만든 새 항목이 바로 그 plan 이 등재한 "두 검증자" 문구를 다시 손봐야 한다고 지적하므로, 다음에 그 새 항목을 집행하는 사람은 먼저 이 낡은 plan 을 닫아야 두 plan 이 같은 문서를 놓고 어긋난 상태로 남지 않는다.
  - 제안: 이번 PR 의 책임은 아니므로 차단 사유는 아니다. 다음에 §5.4 재등재 항목을 집행하는 planner 턴에서 `spec-draft-api-convention-verifier-registration.md` 를 `plan/complete/` 로 함께 이동할 것을 권고.

## 요약

이번 PR(코드 전용, `spec/5-system/` 델타 0)은 `User` 엔티티 민감 컬럼 노출 방어 결정을 실측 기반으로 완결하고, 그 과정에서 필요한 후속 작업(§5.4 재등재·규약 문장화)을 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 성실히 이월했다는 점에서 절차 자체는 건전하다. 다만 새로 추가한 첫 번째 후속 항목이 스스로 진단한 3개 미등재 가드 중 1개(JSDoc 인용 축)를 처방에서 빠뜨려, 다음 집행자가 문자 그대로 따르면 "가드 약화가 게이트에 안 걸린다"는 지적된 위험이 그 축에 대해 그대로 재발할 소지가 있다. 기존 plan 이 남긴 미해결 결정과의 정면 충돌이나 다른 plan 의 후속 항목을 무효화하는 변경은 발견되지 않았다.

## 위험도
LOW

# 요구사항(Requirement) 리뷰 — `removeMember` owner 보호 가드 TOCTOU 수정 (3라운드)

## 검증 방법

`codebase/backend/src/modules/workspaces/workspaces.service.ts`(전체, `removeMember`/
`throwCannotRemoveOwner`/`assertAdmin`/`transferOwnership`), `workspaces.service.spec.ts`
(`removeMember — 동시 제거` describe 블록 전체, `wireFindOne` 헬퍼), `test/member-remove-concurrency.e2e-spec.ts`
(신규 `it` 블록), `test/helpers/concurrency.ts`, `test/integration-rotate-concurrency.e2e-spec.ts`,
`CHANGELOG.md`, `plan/in-progress/member-owner-toctou.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`,
`spec/data-flow/12-workspace.md` §1.6/§1.10, `spec/5-system/3-error-handling.md` §1.9,
`codebase/backend/src/common/guards/roles.guard.ts`, `codebase/backend/src/common/decorators/workspace.decorator.ts`,
`codebase/backend/src/modules/workspaces/workspaces.controller.ts` 를 `Read`/`Grep` 으로 직접 확인.
이 라운드(`09_10_41`)는 1·2라운드(`08_09_57`, `08_46_47`) 리뷰가 이미 Critical 0 · Warning 6+2 를
찾아 전부 조치(`06aa6d5e1`, `24f7a1ddf`)한 뒤의 상태를 재검증하는 3차 fresh 리뷰다 — 두 선행
리포트(`review/code/2026/09/24/08_09_57/requirement.md`, `.../08_46_47/requirement.md`)를 먼저
읽어 이미 답이 난 항목을 재추적하지 않고, 2라운드 fix(중복 단위 테스트 제거)가 커버리지를
축내지 않았는지에 집중해 독립적으로 재확인했다. 저장소에 뮤테이션 없음(`git status --short` 는
세션 산출물 디렉터리(`review/code/2026/09/24/09_10_41/`)만 표시 — 내가 만들지 않은 기존
untracked 항목이며 이 리뷰 세션의 출력 대상이다).

## 발견사항

- **[INFO]** 권한 검사 순서 오라클 — `removeMember()` 의 이른 owner 가드
  (`if (member.role === 'owner') this.throwCannotRemoveOwner();`)가 `assertAdmin()` 보다
  먼저 실행돼, 임의 인증 사용자(비-멤버 포함)가 대상의 owner 여부를 간접 추론할 수 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()`
    내 `if (member.role === 'owner') this.throwCannotRemoveOwner();` (early guard, `assertAdmin` 호출 앞).
  - 상세: `RolesGuard.canActivate`(`codebase/backend/src/common/guards/roles.guard.ts`)는
    `needsRoleCheck` 가 거짓이고 `handlerConsumesWorkspaceId` 가 거짓이면 `return true` 로
    단락한다. `workspaces.controller.ts` 의 `removeMember` 핸들러는 `@Roles()` 도 `@WorkspaceId()`
    도 쓰지 않고 순수 `@Param('id')` 만 쓰므로(직접 확인) `handlerConsumesWorkspaceId` 가 거짓이라
    가드 층에서 멤버십 검사가 전혀 돌지 않는다 — 서비스 계층 진입 시점엔 requester 가 해당
    워크스페이스 멤버인지조차 검증되지 않은 상태다. 이 상태에서 이른 owner 가드가
    `assertAdmin` 보다 먼저 평가되므로, 워크스페이스와 무관한 인증 사용자도 이 엔드포인트를
    호출해 응답 코드(`CANNOT_REMOVE_OWNER` vs 다른 코드)만으로 대상이 owner 인지 추론할 수
    있다. **이 diff 가 만든 문제는 아니다** — 순서 자체는 이번 변경 전부터 있었고
    (`throwCannotRemoveOwner()` 추출은 리터럴을 헬퍼로 옮겼을 뿐 순서를 바꾸지 않음), CHANGELOG
    최상단 항목("남는 것")과 `plan/in-progress/member-owner-toctou.md` §F 가 정확한 블라스트
    반경("임의 인증 사용자")으로 이미 정정·등재했다. 별도 트래커 항목이라 이 PR 의 계약
    (owner 삭제 방지)과 다르다.
  - 제안: 조치 불요 — 이미 별도 트래커 항목. 재-flag 방지를 위한 확인 기록.

- **[INFO]** `spec fidelity` — `spec/data-flow/12-workspace.md` §1.6 (`DELETE
  /api/workspaces/:id/members/:memberId`: "owner 는 제거 불가")는 형제 셋(`:188` `deleteWorkspace`,
  `:189` `leaveWorkspace`, `transferOwnership`)과 달리 이 경로의 동시성 메커니즘(원자적
  `DELETE … role: Not('owner')` + `affected===0` 재조회 분기)을 명시하지 않는다. 결과 수준
  서술("owner 는 제거 불가")은 구현과 여전히 일치하므로 spec 이 코드에 반증된 것은 아니고,
  메커니즘 레벨 서술의 부재는 처음부터 spec 의 공백이다.
  - 위치: `spec/data-flow/12-workspace.md` §1.6 표 `DELETE /api/workspaces/:id/members/:memberId` 행.
  - 상세: developer 스스로 이 갭을 인지해 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 planner 후속 항목("`removeMember` 의 owner 보호 메커니즘을 `data-flow/12-workspace.md` 에
    명문화", 2026-09-24 등재, `--impl-prep 07_29_15` `rationale_continuity` WARNING 유래)으로 이미
    등재했다 — 신규 발견이 아니라 기존에 정확히 추적된 항목의 재확인.
  - 제안: SPEC-DRIFT 로 분류하지 않는다(spec 문언이 틀린 것이 아니라 메커니즘 레벨에서 침묵할
    뿐) — 이미 planner 트래커에 등재됐으므로 이 리뷰가 추가로 요구할 조치 없음.

- **[INFO]** `CANNOT_REMOVE_OWNER` 가 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md` §1)에
  미등재. 형제 코드 `CANNOT_ASSIGN_OWNER` 는 §1.9 에 등재돼 있는데(`3-error-handling.md:226`)
  `CANNOT_REMOVE_OWNER`·`OWNER_ROLE_PROTECTED`·`SOLE_OWNER_CANNOT_LEAVE` 는 등재가 없다(§1.9
  Rationale 이 "그 외 workspace role/membership 관리 코드는 별도 pass" 로 스스로 유예를 인지,
  `3-error-handling.md:660`). 이번 PR 이 만든 갭이 아니고 이미 `spec-draft-nullable-notation-followups.md`
  에 planner 항목으로 등재됐다(중복 지적 아님).

## 기능 완전성 / 엣지 케이스 / 반환값 재확인

- `affected===0` 의 두 원인(행 소멸 / owner 승격)을 무락 재조회 1회로 정확히 가르는 로직
  (`workspaces.service.ts:859-873`)은 4개 단위 테스트(정상 삭제 · 진 쪽 404(행 소멸) ·
  DELETE 시점 승격 403 · 이양 연쇄(강등 후에도 403)) + e2e 재진입 1종으로 전 분기가 고정돼
  있다. `wireFindOne` 헬퍼의 `targetOnReread` 3번째 인자(`undefined`/`null`/`{role:'owner'}`/
  `{role:'admin'}`)가 각 시나리오를 정확히 흉내낸다 — JSDoc 서술과 카운터 로직(`targetReads`)
  일치를 직접 대조했다.
- 2라운드 fix(`24f7a1ddf`, "1라운드 fix 가 만든 중복 단위 테스트를 지운다")로 남은 스펙 파일에는
  "진 쪽은 404" 블록이 하나만 존재함을 확인했다(중복 없음) — 삭제된 블록이 커버하던 유일한
  관측("존재하든 말든 403" 으로 줄이는 편집 방지)은 남은 블록이 여전히 낸다는 `RESOLUTION.md` 의
  뮤턴트 재측정(`if (still) → if (true)`, 1/1 죽음)과 일치, 실제 커버리지 손실 없음을 직접 확인.
- `affected` 명시 비교(`=== 0`, `it.each([[undefined],[null]])`)가 드라이버 미보고 케이스를
  정상 삭제로 정확히 처리 — `!affected` 로 완화하는 회귀를 막는 대조군 테스트가 여전히 유효.
- 자가 제거(`member.userId === requesterId`)는 owner 가드보다 먼저 `leaveWorkspace` 로 위임돼
  이 PR 의 수정 대상 경로를 완전히 우회한다 — 단위 테스트로 고정(`memberRepo.delete` 미호출 확인).
- `assertAdmin` 미충족 시 `ADMIN_REQUIRED` + `delete` 미호출 — 단위 테스트로 고정, 코드
  (`assertAdmin`, `workspaces.service.ts:898-909`)의 실제 에러 코드와 일치.
- e2e 재진입 테스트(`member-remove-concurrency.e2e-spec.ts`)는 `raceUnderHeldLock` 이 다루는
  "요청 둘의 겹침" 과 다른 "요청 하나 + 락 안 UPDATE" 축이라 직접 `Promise.race` +
  `VACUITY_GUARD_MS` 로 공허성 가드를 건다 — Postgres 의 실제 EvalPlanQual 재평가 전제(같은
  행에 대한 `pessimistic_write` + 커밋)를 `transferOwnership()` 실제 구현(`:745-767` 부근
  `findOne(..., lock: pessimistic_write)`)과 대조해 성립함을 확인했다.
- `Not('owner')` 가 TypeORM `delete()` 안에서 `_type`/`_value` 로 저장되고 `.type`/`.value`
  getter 가 그대로 반환함을 확인, deep-equality 로 검증 불가한 이유로 `.type`/`.value` 를 직접
  단언하는 방식이 타당함을 재확인(`sessions.service.spec.ts` 선례와 동일 패턴).

## TODO/FIXME/HACK/XXX

diff 대상 파일(`workspaces.service.ts`, `workspaces.service.spec.ts`, `member-remove-concurrency.e2e-spec.ts`,
`concurrency.ts`, `integration-rotate-concurrency.e2e-spec.ts`) 전수 grep — 없음.

## CHANGELOG / plan 서술과 코드 일치 여부

- `CHANGELOG.md` 최상단 신규 항목의 기술적 주장(원자적 `DELETE` 술어, EvalPlanQual 재평가,
  재조회가 존재 여부만 본다는 것, 이른 가드는 backstop 이 아니라 흔한 경우 조기 차단용이라는
  것, "남는 것" 의 권한 검사 순서 오라클·블라스트 반경 정정)을 코드(`workspaces.service.ts`)와
  줄 단위로 대조 — 전부 일치.
- `#1373` 항목의 "남는 것" 문단에 대한 취소선 정정(`~~owner 승격 TOCTOU(실측 재현)~~` +
  "2026-09-24 해소됐다" 각주)이 실제로 이번 PR 이 그 사안을 닫았다는 사실과 일치 — 인접 서술
  ("`workspaces.controller.ts` 만 204 대신 200" 문제)은 손대지 않고 그대로 남겨 스코프를
  정확히 좁혔다.
- `plan/in-progress/member-owner-toctou.md` 의 체크리스트(§체크리스트)는 이 라운드가 "3라운드 —
  2라운드 fix 가 코드를 바꿨으므로 fresh 리뷰가 필요하다" 로 정확히 예견한 상태이고,
  `spec_impact: none` 은 bare 값으로 Gate C 형식에 부합한다.

## 요약

`removeMember()` owner 보호 가드의 TOCTOU(무락 `findOne` 위의 조기 가드가 동시
`transferOwnership` 에 뚫리는 결함)를, 새 락을 들이지 않고 `DELETE` 문 자체에 `role: Not('owner')`
술어를 넣어 Postgres READ COMMITTED EvalPlanQual 재평가에 기대는 방식으로 닫는다는 의도가
코드에 정확히 구현돼 있다. 0-행 판정의 두 원인(행 소멸/owner 승격)을 가르는 재조회 로직은
"존재 여부만 본다"는 제3 상태 교정(1라운드 W3)이 반영된 형태이고, 그로 인해 발생했던 무효
mock 단위 테스트(2라운드 W1)도 뮤턴트 재측정으로 스스로 발견·정리했다 — 이번 3라운드에서
그 정리로 인한 커버리지 손실이 없음을 독립적으로 재확인했다. 모든 코드 경로(정상 삭제·
행 소멸 404·owner 승격 403·이양 연쇄 403·admin 미충족 403·자가 위임)가 명시적으로 종결되고
반환값이 정의돼 있으며, TODO/FIXME 류 미완성 표식은 없다. Spec 본문(`data-flow/12-workspace.md`
§1.6, `1-auth.md` §3.2)과 결과 수준에서 불일치가 없고(SPEC-DRIFT 아님), 메커니즘 미기술·에러
코드 카탈로그 미등재는 개발자 스스로 인지해 이미 planner 트래커에 등재한 기존 공백이라 이
PR 을 막을 사유가 아니다. 유일한 지속 이슈(권한 검사 순서 오라클)도 이 diff 이전부터 존재했고
정확한 블라스트 반경으로 트래커에 분리 등재돼 있다. 새로 발견된 Critical/Warning 급 결함 없음.

## 위험도

NONE

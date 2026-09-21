# 요구사항(Requirement) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정 (3차 라운드)

## 검토 방법

이번 라운드 diff(`origin/main...HEAD`, 41개 파일)는 핵심 애플리케이션 코드 3개
(`workspaces.service.ts`, `workspaces.service.spec.ts`,
`member-remove-concurrency.e2e-spec.ts`) + plan 2개 + 이전 두 라운드의 리뷰/consistency-check
산출물(`review/code/.../12_57_05/**`, `review/code/.../13_28_12/**`,
`review/consistency/.../12_23_48/**`) 커밋으로 구성된다. 실제 코드는 `Read`로 워킹트리
원본을 직접 열어 diff와 대조 확인했고, 저장소에는 아무것도 쓰지 않았다(`git status --short`
결과 이 세션 산출 디렉터리만 untracked로 확인).

직전 두 라운드(`12_57_05`, `13_28_12`)가 이미 기능 완전성·엣지 케이스·spec fidelity를
매우 촘촘히 다뤘으므로, 이번 리뷰는 (1) 그 라운드들의 지적이 실제로 해소됐는지 코드로
재검증하고 (2) `13_28_12` 이후 새로 추가된 diff(커밋 `6f1113a70`, 문서/plan 정정)에 신규
결함이 있는지에 집중했다.

## 발견사항

- **[INFO]** 직전 라운드 requirement WARNING(권한 없는 요청자 거부 테스트 부재)이 실제로
  해소됨 — 재확인, 신규 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` —
    `describe('removeMember — 동시 제거', ...)` 안 `it('admin/owner 가 아니면 ADMIN_REQUIRED 로
    거부하고 delete 를 타지 않는다', ...)`
  - 상세: `wireFindOne`을 요청자 멤버십(`{ id: 'mem-req', role: 'editor' }`)까지 오버라이드할
    수 있게 확장하고, `ADMIN_REQUIRED` 거부 + `memberRepo.delete` 미호출을 단언한다. 검사
    순서(트래커에 등재된 별개 결함)에 결합하지 않고 "권한 없으면 delete를 타지 않는다"는
    불변만 본다는 점을 JSDoc으로 명시해 향후 순서 변경 리팩터에도 테스트가 계속 유효하도록
    설계했다. 실제 구현(`assertAdmin` 호출, `:815` 부근)과 정확히 일치.
  - 제안: 없음(양호).

- **[INFO]** `throwMemberNotFound(): never` 헬퍼 도입 후에도 TypeScript 제어 흐름 분석이
  `member`를 올바르게 non-null로 좁히며, `if (!member) this.throwMemberNotFound();`
  단문 형태가 두 호출부(`updateMemberRole`, `removeMember`)에서 동일하게 동작함을 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:310`,
    `:803`(`removeMember` 대상 조회 직후)
  - 상세: `never` 반환 함수를 조건문 단일 statement로 호출하는 이 패턴은 TS 제어 흐름
    분석이 지원하는 형태이고, RESOLUTION.md가 기록한 백엔드 타입체크 ratchet 통과와
    일치한다. 별도 결함 없음.
  - 제안: 없음.

- **[INFO]** `6f1113a70`(이번 라운드 신규 diff, 직전 라운드 documentation WARNING/scope INFO
  대응)의 실측 정정 내용을 코드로 재검증 — 정확함
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` JSDoc(파일 상단,
    "형제들을 그대로 베끼면 틀리는 자리" 절), `plan/in-progress/member-dup-remove.md`,
    `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: "성공 코드가 라우트별이 아니라 컨트롤러별로 갈린다"는 주장을 직접 grep으로
    재확인했다 — `workflows`/`triggers`/`schedules`/`integrations` 컨트롤러는 각각
    `@HttpCode(HttpStatus.NO_CONTENT)`가 정확히 1개씩 있고, `workspaces.controller.ts`는
    0개이며 `{ ok: true }` 응답이 5곳(파일 전체) 존재한다. 이 diff는 코드를 고치지 않고
    주석/plan의 잘못된 서술만 취소선으로 남기며 정정했다(자기-반증형 소정정과 유사한 패턴이나
    대상이 `spec/`가 아니라 `plan/`이라 developer 권한 범위 안).
  - 제안: 없음 — 실측이 정확함을 확인.

- **[INFO]** (재확인) `spec/5-system/2-api-convention.md §6` "204=삭제 성공" 표와
  `workspaces.controller.ts`의 `removeMember`(및 형제 4곳)가 200 `{ok:true}`를 반환하는
  불일치는 **이번 PR이 만든 것이 아니라 기존(수 개월 전 커밋 `11c37e75d` 계열)부터 있던
  사전 존재 상태**이며, 이미 이번 세션이 `plan/in-progress/spec-draft-nullable-notation-followups.md`에
  planner 소유 항목으로 신규 등재했다(커밋 `6f1113a70`)
  - 위치: `spec/5-system/2-api-convention.md:344`(`| 204 | No Content | 삭제 성공 |`) vs
    `codebase/backend/src/modules/workspaces/workspaces.controller.ts` `removeMember()`
    (`return { data: { ok: true } };`)
  - 상세: `git log -p -S "ok: true" -- .../workspaces.controller.ts`로 확인한 결과 이 응답
    패턴은 이번 PR 훨씬 이전 커밋에서 도입된 기존 설계이고, `removeMember()`의 동시성 수정과
    무관하다. 신규 등재 항목(WARNING 4, `followups.md` 4816~4825행 부근)이 "§3 멱등성 각주
    작업과 함께 처리"하도록 이미 스코프를 지정해 뒀다.
  - 제안: 새 조치 불요 — planner 턴에서 트래커 실행 시 함께 닫힐 항목. 재-flag 불필요.

- **[INFO]** `DELETE` 멱등성 표(§3) SPEC-DRIFT — 1차 라운드(`12_57_05/requirement.md`)가
  이미 식별·등재한 사안의 재확인, 신규 아님
  - 위치: `spec/5-system/2-api-convention.md §3`(`DELETE | 리소스 삭제 | O`) vs
    `workspaces.service.ts:834-838`(`if (affected === 0) this.throwMemberNotFound();`)
  - 상세: 동시 `DELETE` 두 건 중 패자가 이제 `404`를 받아 "멱등 O" 서술과 어긋난다. 코드는
    형제 5건(#1369~#1372)이 이미 검증한 의도적 패턴의 6번째 적용이라 옳고, spec 각주가
    아직 반영되지 않은 것으로 — SPEC-DRIFT 판정에 이견 없음. 이미 `spec-draft-nullable-notation-followups.md`에
    등재돼 있어 재등재 불필요.
  - 제안: 코드 유지. spec 반영은 planner 턴 대상(이미 트래커에 있음).

## 기능 완전성 · 엣지 케이스 · 반환값 (직접 재검증)

- 정상(admin이 타인 제거) → `delete` affected=1 → 감사(`mode:'removed'`) → `void`: 코드·유닛
  테스트(`removeMember — 동시 제거` describe 첫 `it`) 일치.
- 대상 없음 → `MEMBER_NOT_FOUND` 404, `delete` 미호출: 일치, 테스트로 커버.
- owner 대상 → `CANNOT_REMOVE_OWNER` 403, `delete` 미호출: 일치, 테스트로 커버.
- 비-admin 요청자 → `ADMIN_REQUIRED` 403, `delete` 미호출: 이번 라운드에서 신규 테스트로
  커버됨(직전 라운드 WARNING 해소 확인).
- 자기 자신 → `leaveWorkspace`로 위임, 이 경로의 `delete` 미호출: 코드·유닛·e2e(자가 탈퇴
  갈래) 모두 일치. `leaveWorkspace()`가 실제로 `manager.transaction` + `pessimistic_write`로
  재조회함을 소스에서 직접 확인(`:652-664` 부근) — plan의 반복 주장이 코드와 일치.
  자가 탈퇴 e2e는 진 쪽을 `403 NOT_A_MEMBER`로 정확히 단언(`member-remove-concurrency.e2e-spec.ts:189-190`).
- 동시 제거 두 건 → 승자 200, 패자 404 `MEMBER_NOT_FOUND`, 감사 1건(`mode:'removed'`로
  필터): 구현·유닛 대조군(`it.each([[undefined],[null]])`)·e2e(공허성 가드 포함, 결정적
  DB 행 락 기반) 모두 일치. `affected`가 `null`/`undefined`일 때 정상 삭제로 처리하는
  명시 비교(`=== 0`) 규율도 대조군으로 방어됨.
- TODO/FIXME/HACK/XXX: `workspaces.service.ts`·`workspaces.service.spec.ts`·
  `member-remove-concurrency.e2e-spec.ts` 3개 파일 전체 grep 결과 0건.
- 함수명·JSDoc·구현 일치: `removeMember()` JSDoc의 "동시성 보장" 문장이 실제 구현(무락
  조회 → 원자적 DELETE → `affected===0` 판정)과 정확히 부합. `throwMemberNotFound()`
  JSDoc이 재사용하지 않는 예외 자리(`transferOwnership`)까지 명시해 문서-구현 괴리가 없다.
- 데이터 유효성: `workspaceId`/`memberId`는 컨트롤러의 `ParseUUIDPipe`로 UUID 형식이
  사전 검증됨(`workspaces.controller.ts:369-370`).
- 비즈니스 로직: 에러 코드(`MEMBER_NOT_FOUND`/`CANNOT_REMOVE_OWNER`/`ADMIN_REQUIRED`/
  `NOT_A_MEMBER`) 전부 기존 정의 재사용, 신규 코드 없음 — `spec/conventions/error-codes.md`와
  충돌 소지 자체가 없다. 감사 액션(`member.removed`, `mode` 필드로 자가탈퇴와 구분)도
  기존 규약 그대로.

## 이미 처분된 항목 (재-flag 안 함)

- owner 승격 TOCTOU(`member.role === 'owner'` 무락 판정과 원자적 `DELETE` 사이의 창):
  developer가 재진입 기법으로 실측 재현(`status=200, rows_remaining=0`)했고, 트래커에
  후보 처방과 함께 등재, 3라운드 연속 "이번 PR 스코프 밖"으로 처분됨. 판별자 오염 회피
  논리가 타당해 이번 라운드도 동일 결론.
- `removeMember()` 권한 검사 순서(존재/owner 오라클) 문제: 1차 라운드 security WARNING,
  이미 plan에 등재·유예.
- `9-user-profile.md §6.1`/`data-flow/12-workspace.md §1.6`의 "동시 삭제 → 두 번째 404"
  서술 부재: consistency-check(`12_23_48`) 3개 checker 교차 확인 + 1차 requirement 리뷰
  INFO로 이미 등재.

## 요약

3차 라운드 diff의 실질 내용은 (a) 직전 두 라운드가 지적한 항목들이 실제로 코드/테스트로
해소됐음을 재확인하는 것과 (b) 라운드 2의 사소한 문서 오류("형제 다섯은 전부 204")를
실측으로 정정하고 관련 신규 spec 불일치(§6, 사전 존재·이번 PR 무관)를 트래커에 등재하는
것이다. `removeMember()`의 핵심 로직(무락 조회 → 원자적 `DELETE` → `affected===0` 명시
판정)은 모든 분기(정상/대상없음/owner/비-admin/자가탈퇴/동시경합/null·undefined 대조군)에
대해 구현·단위테스트·e2e가 line-level로 일치하며, 반환값·에러코드·감사 로그 모두 기존
계약을 정확히 따른다. TODO/FIXME류 미완성 표식 없음. 새로 발견된 차단 사유는 없으며,
남아 있는 두 spec 불일치(§3 DELETE 멱등성 SPEC-DRIFT, §6 204→200 사전 존재 위반)는 모두
이미 코드가 아닌 spec 쪽 트래커 항목으로 정확히 귀속돼 있어 이번 PR을 막을 사유가 아니다.

## 위험도

NONE

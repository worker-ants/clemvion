# 요구사항(Requirement) 리뷰 — removeMember 판정 순서 커버리지

## 검증 방법

diff 는 3개 실질 파일(`CHANGELOG.md`, `workspaces.service.spec.ts`, 신규 plan
`plan/in-progress/remove-member-order-coverage.md`) + 선행 `/consistency-check --impl-prep`
산출물(`review/consistency/2026/09/24/22_01_45/**`, 이미 커밋됨, 이번 리뷰 대상 아님)로
구성된다. **`codebase/**` 에서 실제로 바뀐 파일은 `workspaces.service.spec.ts` 하나뿐**이고
(`git diff --stat origin/main...HEAD -- codebase/` 로 확인, 48줄 추가·삭제 0), 프로덕션
코드(`workspaces.service.ts`)는 이번 PR 에서 손대지 않았다 — 테스트 커버리지 추가 전용 PR 이다.

주장을 실측으로 검증했다:

1. `node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/modules/workspaces/` 로
   `src/modules/workspaces/` 전체를 직접 돌려 **6 스위트 · 139 테스트 전부 통과**를 확인했다
   (CHANGELOG·plan 의 "139건" 주장과 일치).
2. 뮤턴트 M-a(대상 null 검사를 admin 판정 뒤로 이동 + self 비교를 `member?.userId` 로 변경)를
   **저장소 밖 scratch 에 원본을 `cp` 로 백업한 뒤** `workspaces.service.ts` 에 직접 적용해
   재실행했다. 결과는 plan §B 의 표와 **정확히 일치**했다 — `139 중 1건만 RED`(새 테스트
   "비-admin 이 없는 대상을 지목하면 ADMIN_REQUIRED 가 아니라 MEMBER_NOT_FOUND 다"),
   `Received code: "ADMIN_REQUIRED"` vs `Expected: "MEMBER_NOT_FOUND"`, 나머지 138건은
   그대로 통과. 검증 직후 `cp` 로 원본을 복원했고 `git status --short` 로 저장소가 깨끗함을
   확인했다(뮤테이션 규약 §1~§3 준수. M-b·M-b2 는 방법론이 M-a 와 동일하고 이미 M-a 가 정확히
   재현됐으므로 재실행하지 않았다).

## 발견사항

- **[INFO]** 이 PR 이 닫는 정확한 대상은 이미 다른 항목으로 등재돼 있고 그 서술과 완전히 일치한다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커 항목 "`removeMember`
    판정 순서 커버리지의 비대칭 두 칸", developer 소유)
  - 상세: 트래커가 미리 적어 둔 두 칸(① 대상 부재-vs-admin 상대 순서, ② 요청자 role 1회 조회
    회귀 테스트 부재)이 이번 PR 이 추가한 두 테스트와 정확히 대응한다. 같은 트래커의 인접 항목
    "`removeMember` 리팩터로 낡은 spec 서술 세 줄"(planner 소유, `3-error-handling.md:46,49`·
    `1-auth.md:551` 이 더 이상 존재하지 않는 `assertAdmin()` 호출을 인용)은 이번 PR 범위 밖의
    별도 SPEC-DRIFT 이며, 이미 planner 소유로 등재돼 있고 developer 가 손댈 수 없는 이유(자기
    반증형 소정정 조건 1 불충족)까지 트래커에 명시돼 있다 — 재지적 불필요.
  - 제안: 조치 불요. 참고용으로만 기록.

- **[INFO]** spec 본문(`spec/data-flow/12-workspace.md` §1.6)은 `DELETE
  /api/workspaces/:id/members/:memberId` 를 "owner/admin 권한, owner 는 제거 불가, 본인 제거는
  자가 탈퇴로 위임"까지만 서술하고, 멤버십→대상 존재→self→admin→owner 의 **판정 순서
  line-level** 은 spec 에 없다(서비스 docstring 에만 있음). 이 PR 은 spec 을 변경하지 않고
  `spec_impact: none` 이 정확하다 — 코드 동작 변경이 없는 순수 테스트 추가이므로 spec 과의
  불일치 여지도 없다.
  - 위치: `spec/data-flow/12-workspace.md:154` 부근 §1.6 표
  - 상세: 회색지대(spec 침묵)이며 CRITICAL 대상 아님.
  - 제안: 조치 불요.

## 요약

`WorkspacesService.removeMember` 판정 순서(멤버십 → 대상 존재 → self 위임 → admin → owner) 중
비어 있던 두 조합("대상 존재 → admin" 순서, "요청자 role 1회 조회")을 테스트로 메우는
순수 테스트-only PR 이다. 프로덕션 코드 변경이 없어 회귀 위험이 낮고, 새 두 테스트는 실제
`removeMember` 구현(라인 814~906)의 판정 순서·에러 코드·조회 패턴과 정확히 대응한다.
`wireFindOne` 헬퍼가 `where.id`/`where.userId` 로 대상·요청자 조회를 구분하는 방식도
`getMemberRole`(`where: { workspaceId, userId }`)·대상 `findOne`(`where: { id, workspaceId }`)
의 실제 쿼리 모양과 일치해 mock 이 유효하다. 신규 테스트 2건을 포함해 `src/modules/workspaces/`
전체 139건이 통과함을 직접 실행으로 확인했고, plan 이 주장한 뮤턴트 M-a 의 판별력(139 중 1건만
RED, 정확한 code 값)도 저장소 밖 백업 후 실제 뮤테이션으로 재현해 정확히 일치함을 확인했다.
CHANGELOG·plan 문서의 서술(순서·에러 코드·측정 방법·수치)도 실제 코드·테스트 산출물과
line-level 로 부합한다. TODO/FIXME 류 미완성 표식 없음. 관련 spec 문서(`12-workspace.md` §1.6)는
판정 순서를 그 수준까지 규정하지 않아 spec 불일치 소지가 없으며, 인접한 진짜 SPEC-DRIFT(오래된
`assertAdmin()` 인용)는 이미 별도 planner 소유 트래커 항목으로 정확히 분리·등재돼 있어 이 PR 이
다시 지적할 필요가 없다. CRITICAL/WARNING 없음.

## 위험도
NONE

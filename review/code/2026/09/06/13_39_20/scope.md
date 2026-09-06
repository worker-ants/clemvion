# 변경 범위(Scope) 리뷰

## 개요

`git diff --stat origin/main...HEAD` 기준 167개 파일, +14408/-15줄. 이 중 `review/**`(약 145개)·
`plan/**`(2개)는 이 저장소가 채택한 "다회 fix→리뷰 루프를 매 라운드 커밋" 관례(`review/code/**`,
`review/consistency/**` 는 git-tracked 산출물)의 결과물이고, 실제 애플리케이션/테스트 코드
변경은 아래 20개 파일(+2214/-15줄)로 좁혀진다.

```
CHANGELOG.md
codebase/backend/src/modules/workflow-versions/workflow-versions.service.{ts,spec.ts}
codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts
codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts
codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts
codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/jsdoc-citation.fixture.ts
codebase/backend/src/repo-guards/__tests__/fixtures/user-eager-relation.fixture.ts
codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts
codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts
codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts
codebase/backend/src/shared/testing/user-secret-absence.{ts,spec.ts}
codebase/backend/test/audit-logs.e2e-spec.ts
codebase/backend/test/workflow-crud.e2e-spec.ts
codebase/backend/test/workspace-rbac.e2e-spec.ts
plan/in-progress/spec-draft-nullable-notation-followups.md
plan/in-progress/spec-draft-review-citations-enforcement.md
spec/conventions/review-citations.md
spec/conventions/spec-impl-evidence.md
```

이 branch(`claude/user-entity-column-defense`)의 목적은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
등재 항목 "`User` 엔티티에 컬럼 수준 방어를 둘지 결정" 해소다. 최종 산출물은 등재문이 예상한
`select:false` / 전역 `ClassSerializerInterceptor` 대신 **검출 3축**(구조 스캔·이름 스캔·
DTO JSDoc 인용 스캔)을 택했는데, 이는 CHANGELOG·plan 완료 노트에 전수 열거 수치(19곳 공유
깔때기·46개 호출지점 등)와 함께 근거가 명시돼 있어 임의 확장이 아니라 실측에 근거한 방향
전환으로 판단된다. 20개 파일 전부가 이 단일 목적 또는 그 작업 도중 발견된 직접 파생 결함에
대응하며, 무관한 모듈·설정·포맷팅 전용 변경은 발견되지 않았다.

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` 이 `User` 전 컬럼을 무방비로 반환하던 것을
  같은 branch 에서 발견해 수정 — 원 작업 범위를 기술적으로 벗어나지만 그 작업이 낳은 직접
  파생 결함
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    (`findOne` 메서드, `CREATOR_PROJECTION`/`ProjectedCreator`/`WorkflowVersionDetail` 신설)
  - 상세: "User 컬럼 방어" 를 위해 관계 이름이 아니라 **타입**으로 다시 전수 열거하는 과정에서
    찾아낸 살아있는 유출이며, CHANGELOG("🔴 그 열거가 한 칸 좁았다")·plan 완료 노트·커밋
    메시지 세 곳에서 investigative artifact 로 투명하게 disclose 돼 있다. 자매 e2e
    (`workflow-crud.e2e-spec.ts` 케이스 `H.`)까지 함께 추가됐다. 범위 판단상 문제는 없으나,
    "User 컬럼 노출 **검출** 가드 신설" 이라는 원 표제와 별개로 "실제 취약점 **수정**" 이 같은
    diff 에 섞여 있다는 점은 리뷰 시 두 관심사를 구분해서 봐야 함을 기록.
  - 제안: 조치 불요(이미 충분히 disclose 됨).

- **[INFO]** `dto-jsdoc-citation-guard` 서브시스템(파일 3종 + `review-citations.md`/
  `spec-impl-evidence.md` 정정)은 "User 컬럼 노출 방어" 와는 결이 다른 별개 관심사(주석-인용
  규약 시행)이며, 전체 실질 diff(2214줄) 중 약 470줄(21%)을 차지
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`,
    `dto-jsdoc-citation.spec.ts`, `fixtures/dto/responses/jsdoc-citation.fixture.ts`,
    `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`
  - 상세: 이 서브시스템은 "User 엔티티 컬럼 노출" 이 아니라 "리뷰 산출물 경로 인용이 공개
    OpenAPI description 으로 새는 것" 을 막는다 — 별도 axis 다. 다만 같은 작업을 하는
    도중 실제로 3회 반복 관찰된 위반(각 라운드에서 사람이 직접 발견)을 계기로 신설됐고,
    자체 plan 트래커(`spec-draft-review-citations-enforcement.md`)로 분리 관리되며, spec
    문서 정정은 developer 셀프-정정 예외를 쓰지 않고 별도 "planner 턴" 을 열어 `--spec`
    consistency-check(BLOCK:NO, Critical 0)를 통과한 뒤 반영됐다(`CLAUDE.md` §자기-반증형
    소정정 요건 미충족 사유가 커밋 메시지에 명시됨). 통제되고 disclose 된 확장이라 판단해
    INFO 로 낮춘다.
  - 제안: 조치 불요. 다만 향후 유사 상황에서는 "발견된 부수 결함을 같은 branch/PR 안에서
    별도 서브시스템으로 완결" 하는 패턴이 반복되면 별도 PR 분리 여부를 사용자에게 확인하는
    것도 고려할 만하다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가 — 핵심 목표(User 컬럼 방어) 밖의 곁가지
  이지만 세 곳에서 투명하게 disclose
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: 신규 e2e(`workspace-rbac.e2e-spec.ts` 케이스 `J.`)가 `assertMatchesContract` 를
    처음 배선하면서 실응답에는 있지만 DTO 에 미선언이던 `joinedAt` 이 드러나 추가된 것.
    `WorkspacesService.listMembers` 가 실제로 `joinedAt: m.joinedAt` 을 싣는 것을 확인했고,
    CHANGELOG(`곁가지` 절)·DTO 필드 주석·plan 완료 노트 세 군데 모두 이 파생 발견을 명시.
  - 제안: 조치 불요(이미 투명하게 문서화됨).

- **[INFO]** `workspace-rbac.e2e-spec.ts` 파일 헤더 주석의 spec 절 참조 정정(§1.3→§3)은
  이번 작업 목적과 무관한 drive-by 수정이나 disclose 됨
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:22`(게이트 기준, 파일 헤더 JSDoc)
  - 상세: `git log -S`로 확인한 결과 이 정정은 커밋 `4529812c6` 메시지에 "e2e 헤더가 RBAC 를
    `1-auth.md §1.3` 이라 적었는데 실측하면 `§1.3`은 '셀프 호스팅 추가 인증(미구현)'이고
    RBAC는 `§3` — checker는 'diff 밖'이라 했지만 이 브랜치가 이미 그 파일을 편집한다"로 명시
    disclose 됐다. 이미 편집 중인 파일의 인접 오류를 고친 최소 규모(1줄) drive-by 정정이라
    리스크는 낮다.
  - 제안: 조치 불요.

- **[INFO]** 이전 라운드(`review/code/2026/09/06/10_13_22`)의 scope.md 가 지적한 e2e 테스트
  라벨 충돌(`F.` 중복)은 이번 diff 에서 이미 해소됨
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:602` — 신규 케이스가 `J.` 로
    재명명돼 있고, `grep -n "it('[A-Z]\."` 로 전수 확인한 결과 A~J·S 라벨이 모두 유일함.
  - 상세: 회귀 없음 확인 차 기록.

## 요약

실질 코드/문서 변경은 20개 파일로, 전부 "User 엔티티 컬럼 수준 노출 방어(검출 3축)"라는
단일 과제 또는 그 과제 수행 중 직접 파생된 결함(워크플로우 버전 조회 유출, DTO 계약 갭,
문서 참조 오류, 규약 문서 자기모순)에 대응한다. 무관한 모듈·설정 파일·순수 포맷팅·불필요한
임포트 변경은 발견되지 않았고, 각 파생/곁가지 항목은 CHANGELOG·plan·커밋 메시지·소스 주석
중 최소 하나 이상에서 투명하게 disclose 돼 있다. 유일하게 주목할 점은 `dto-jsdoc-citation`
서브시스템이 원 목적과는 다른 axis(주석-인용 규약)를 다루며 실질 diff 의 약 5분의 1을
차지한다는 것인데, 이 역시 통제된 절차(별도 plan 트래커, planner 턴, `--spec`
consistency-check)를 거쳐 반영됐으므로 scope 리스크로 격상하지 않았다. `review/**`,
`plan/**` 산출물의 대량 커밋은 이 저장소의 명시적 리뷰-루프 관례이며 범위 이탈이 아니다.

## 위험도

LOW

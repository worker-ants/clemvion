# 요구사항(Requirement) 리뷰

## 검토 범위 요약

이 커밋은 순수 **주석/docstring/plan 문서 정정**이다. 4개 파일 모두 실행 코드(정규식·함수
바디·`export` 시그니처)는 변경되지 않았고, `uuid.ts` 의 `UUID_PATTERN`/`UUID_SHAPE_PATTERN`,
`isValidUuid`/`isUuidShaped` 함수 바디, `uuid.spec.ts` 의 `it`/`expect` 블록은 diff hunk 상
문맥(context)으로만 등장하며 실제 변경분은 각 파일의 주석 문단뿐이다. `git show --stat` 로도
"4 files changed, 39 insertions(+), 8 deletions(-)" 만 확인되어 로직 변경이 없음을 재확인했다.

## 사실관계 검증 (커밋이 주장하는 반증 내용을 코드로 재확인)

정정의 근거가 되는 세 가지 주장을 소스에서 직접 대조했다:

1. `system-status.controller.ts` 에 `@Roles()`/`@WorkspaceId()` 가 없다 — 확인됨(파일 전문
   확인, `@Controller('system-status')` + `@Get('overview')` 뿐).
2. `RolesGuard.canActivate` 가 `resolveRequestWorkspaceContext` 호출 **이전에** `return true`
   한다 — `codebase/backend/src/common/guards/roles.guard.ts:114-119` 의
   `if (!needsRoleCheck && !handlerConsumesWorkspaceId(...)) return true;` 가
   `resolveRequestWorkspaceContext` 호출(라인 123-127)보다 앞서 실행됨을 확인.
3. `isUuidShaped` 의 프로덕션 호출부가 `workspace-context.util.ts:74` 한 곳뿐이라는 주장 —
   `grep -rn "isUuidShaped" src --include="*.ts"` 로 프로덕션 코드 내 유일 호출부임을 확인.
4. `roles.guard.spec.ts` 의 nil UUID 사용(`NIL_WS`, 라인 290)이 `GlobalRouteTarget`(전역
   라우트, `@Roles()`/`@WorkspaceId()` 미부착) 케이스에서만 쓰였음을 확인 — "이 경계의
   방어선으로 세면 안 된다" 는 서술과 부합.
5. "단축이 헤더 파싱보다 먼저다" 테스트(`roles.guard.spec.ts:333`)가 실제로 존재하고 형식이
   깨진 헤더(`'not-a-uuid'`)로 단축 순서를 고정함을 확인.

다섯 주장 모두 코드와 일치했다 — 이번 정정이 반증된 주장을 실제로 대체하는 정확한 서술임을
확인했다.

## Spec fidelity (관점 9)

관련 spec: [`spec/data-flow/12-workspace.md`](../../../../../spec/data-flow/12-workspace.md)
`### X-Workspace-Id 헤더 vs :id 경로 파라미터` 절(2026-08-09 자 "캐너리 지목 정정" 인용문,
라인 403-408). 이 spec 문단은 이미 `#1112`(`602f677cd`, 2026-08-09 머지)에서 동일한 반증
내용으로 갱신돼 있다 — "그 e2e 는 이 술어에 닿지 않는다", "진짜 캐너리는 두 단위 테스트다" 로
동일 문장 구조. 본 커밋이 `codebase/` 3곳(+plan 1곳)의 주석을 이 spec 문단과 **line-level 로
합치**시킨 것으로, spec 이 이미 옳고 코드/plan 이 뒤늦게 따라잡는 정상적 "코드가 spec 을
따라잡음" 케이스다. SPEC-DRIFT 아님(반대로 spec 이 이미 앞서 있었고 코드가 밀린 상태였음).

`plan/in-progress/spec-draft-auth-invariants-sync.md` (다른 worktree 소유, planner 턴 산출물)
도 동일한 반증 내용을 이미 담고 있어 정합성 있음(본 diff 범위 밖이라 대조만 함).

## 발견사항

- **[INFO]** 본 worktree(`backend-hygiene-followups-02092f`)에 대응하는
  `plan/in-progress/backend-hygiene-followups*.md` 가 보이지 않는다.
  - 위치: 저장소 `plan/in-progress/` 디렉터리 (해당 파일 부재)
  - 상세: `CLAUDE.md` 관례상 진행 중 작업은 `plan/in-progress/<name>.md` 에 worktree 를 명시해
    추적한다. 이번 커밋은 다른 worktree 소유 plan(`auth-guard-reflection-hardening.md`,
    `worktree: auth-guard-reflection-hardening-9c31f2`)의 §3 항목을 정정하는 형태로만
    기록됐고, 본 worktree 자체의 작업 추적 항목은 diff 에 없다. 커밋 메시지에 근거가 충분히
    남아 있어 추적성 손실은 크지 않으나, 반복되는 소규모 hygiene 커밋이 plan 없이 쌓이면
    "미룬 항목을 잃을 뻔" 패턴(저장소가 과거 겪은 문제)이 재발할 수 있다.
  - 제안: 크리티컬하지 않음. 필요 시 이런 소규모 정정 커밋들을 묶는 상위 plan 항목이 있는지
    확인.

## 요약

이번 diff 는 기능 코드 변경이 전혀 없는 순수 문서/주석 정정이다. 반증 대상이 된 원 주장
("`isValidUuid` 로 조이면 `system-status.e2e-spec.ts` 의 nil-UUID 프로브가 깨진다")과 새로
기재된 대체 주장(진짜 캐너리는 `uuid.spec.ts`/`workspace-context.util.spec.ts` 단위테스트 둘,
`isUuidShaped` 프로덕션 호출부는 `workspace-context.util.ts:74` 한 곳, `roles.guard.spec.ts`
의 nil UUID 는 전역 라우트 케이스라 방어선이 아님) 을 코드베이스에서 직접 재현·확인한 결과
전부 사실과 일치했다. 이미 정정된 spec(`12-workspace.md`, `#1112`)과도 line-level 로
합치하며, 결정(느슨한 술어 `isUuidShaped`)·근거(403→400 뒤바뀜 방지)는 그대로 유지돼 회귀
없음. 기능 완전성·엣지케이스·에러 시나리오·반환값 등 다른 관점은 이 diff 의 범위(주석) 밖이라
해당 없음(N/A). Critical/Warning 없음.

## 위험도

NONE

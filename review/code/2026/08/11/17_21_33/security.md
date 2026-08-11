# 보안(Security) 리뷰

## 컨텍스트

이 PR 은 `auth-workspace-membership-guard`(P0 cross-tenant fix)의 **문서 후속**이다. 16개
컨트롤러에 `@ApiForbiddenResponse` 51건을 추가하고, `spec/` 3곳(권한 서술·앵커)을 갱신했다.
런타임 코드 변경은 주장하지 않는다.

## 확인 절차 및 근거

1. `codebase/backend/src/common/guards/roles.guard.ts` 를 직접 읽고, `RolesGuard.canActivate`
   로직을 추적했다: `@Roles()` 가 없어도 핸들러가 `@WorkspaceId()` 를 소비하면
   (`handlerConsumesWorkspaceId`) 멤버십 조회(`getMemberRole`)가 항상 수행되고, 비멤버면
   `return false`(Nest 기본 `ForbiddenException` → 403)로 차단된다. `app.module.ts` 에서
   `RolesGuard` 가 `APP_GUARD` 전역 등록(JwtAuthGuard 다음 순서)임도 확인했다.
   → **이번에 문서화된 51건은 실제로 403 을 낼 수 있다.** "안 나는 에러를 난다고 문서화"한
   사례는 발견하지 못했다.
2. `git show HEAD -- codebase/backend`(제거 라인) 를 전수 확인 — 삭제 라인 **0건**, 추가
   라인은 전부 `ApiForbiddenResponse` 관련(데코레이터 51 + import 6)이었다. `@Roles`·`@Public`·
   guard 로직에 손댄 흔적은 없다. spec 3파일(§1 권한 서술, §3 앵커)도 서술/링크 편집뿐이다.
3. `spec/3-workflow-editor/3-execution.md`/`node-cancellation.md` 의 "`/stop` 은 Editor+,
   viewer 는 403" 서술을 실제 코드와 대조했다 — `executions.controller.ts` 의 `stop` 핸들러에
   `@Roles('editor')` 존재, FE `editor-toolbar.tsx:493` 의
   `{canEdit && isCancellable && executionId && (...Stop 버튼...)}` 로 viewer 에게 버튼 자체가
   숨는다. 서술과 구현이 일치한다.

## 발견사항

- **[WARNING]** `@Roles()` 가 있는데 `@ApiForbiddenResponse` 가 전혀 없는 라우트가 남아있다 —
  이 PR 이 정의한 "대상 51건"(= `@Roles()` **와** `@ApiForbiddenResponse` **둘 다** 없는
  라우트)의 계산식이 `@Roles()` 존재를 "이미 문서화됨"의 대용치로 썼는데, 실제로는 아니다.
  이 프로젝트 자체 컨벤션(`spec/conventions/swagger.md` §5-4: `"@Roles(...)` 가 붙었거나
  `@WorkspaceId()` 를 소비하는 엔드포인트는 `@ApiForbiddenResponse` 도 추가"`)에도 어긋난다.
  - 위치:
    - `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:103-107`
      (`create`), `:115-119`(`update`), `:128-133`(`remove`), `:141-154`(`sendMessage`) —
      전부 `@Roles('editor')` 이나 `@ApiForbiddenResponse`·`@ApiUnauthorizedResponse` 둘 다 부재
    - `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts:60-71`
      (`listScopes`), `:87-99`(`listMemories`) — `@Roles('viewer')`(=사실상 멤버십만 요구)이나
      `@ApiForbiddenResponse` 부재
  - 상세: 위 6개 핸들러 모두 `RolesGuard` 에 의해 실제로 403 을 낼 수 있다(역할 부족 또는
    비멤버). 이 PR 의 스캐너(데코레이터 블록 파서)는 "`@Roles()` 존재" 를 배제 조건으로 써서
    이 부류를 대상에서 원천 제외했으므로, 커밋 메시지의 "재스캔 잔여 0건"은 **자신이 정의한
    좁은 target 집합 안에서는** 맞지만, §5-4 컨벤션이 요구하는 전체 범위 기준으로는 잔여가
    남아있다. 보안 동작 자체(403 이 실제로 나는지)에는 영향이 없고 문서 완결성 문제다.
  - 제안: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` §2 스캐너 정의를
    "`@ApiForbiddenResponse` 없음"(= `@Roles()` 유무 무관) 기준으로 재실행해 잔여 건수를
    다시 산정하고 후속 항목으로 등재할 것을 권한다. (참고: 같은 plan 이 이미
    `workflow-assistant.controller.ts` 의 401 누락 3건은 별도 후속으로 등재해 두었으나, 위
    4건의 403/401 동시 누락과 `agent-memory.controller.ts` 2건은 등재되어 있지 않다.)

- **[INFO]** `workflow-assistant.controller.ts` 는 컨트롤러 전체에 `ApiUnauthorizedResponse`
  import 자체가 없다(파일 상단 import 목록 확인). 이번 PR 이 추가한 3곳
  (`list`/`latest`/`findOne`)도 403 만 있고 401 은 없는데, 이는 plan 에 "후속(§5-4 는 401 도
  요구)"으로 이미 명시적으로 등재되어 있어 새 발견은 아니다 — 위 WARNING 항목의 4건과 함께
  한 번에 정리하면 중복 편집을 줄일 수 있다는 점만 참고로 남긴다.

## 요약

이 PR 은 스스로 주장한 범위(런타임 미변경, 51건 `@ApiForbiddenResponse` 부착) 안에서는
정확하다 — `RolesGuard` 전역 가드 로직을 직접 추적한 결과 새로 문서화된 51건은 실제로 403 을
낼 수 있고, 코드 diff 는 순수 추가(삭제 라인 0)로 `@Roles`/`@Public`/guard 변경은 없으며, spec 의
"viewer 는 403" 서술도 백엔드 `@Roles('editor')` + 프런트 `canEdit` 가드와 일치한다. 다만 이
PR 이 사용한 "대상" 정의(= `@Roles()` **없고** `@ApiForbiddenResponse` **없는** 라우트)가
프로젝트 자체 컨벤션(§5-4)보다 좁아, `@Roles()` 는 있지만 `@ApiForbiddenResponse` 가 없는
6개 핸들러(실제로 403 을 낼 수 있음)가 이번에도 문서화되지 못한 채 남았다. 보안 동작 자체를
저해하는 결함은 아니며 문서 완결성 갭이다.

## 위험도

LOW
STATUS: OK

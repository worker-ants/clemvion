STATUS=success requirement review complete — 0 critical, 1 warning, 3 info

===REPORT_MARKDOWN_BELOW===

# 요구사항(Requirement) Review — auth-guard-reflection-hardening (재검토, 15_20_33)

## 검증 방법

이 브랜치는 이미 두 차례의 `/ai-review`(14_36_39, WARNING 6건 전부 수정·뮤테이션 실증)와 두 차례의
`/consistency-check`(14_01_15 `--impl-prep`, 15_09_04 `--impl-done`, 둘 다 BLOCK:NO)를 거친 상태다.
본 리뷰는 그 위에서 (a) 실제 소스를 직접 `Read` 해 claim 을 재검증하고, (b) 관련 spec 본문과
line-level 대조하고, (c) 테스트를 직접 실행해 기능 완전성을 재확인했다.

- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`(+spec)·
  `common/utils/uuid.ts`(+spec)·`common/utils/workspace-context.util.ts`(+spec)·
  `common/guards/roles.guard.ts`·`common/guards/roles.guard.spec.ts`·
  `common/decorators/workspace.decorator.ts`·`workspace.decorator.spec.ts`·`main.ts`·
  `app.module.ts` 전문을 직접 열어 대조.
- `npx jest`로 변경 5개 spec 파일 재실행 → **74/74 PASS**.
- `@nestjs/core` 실제 타입 정의(`DiscoveryService.getControllers(): InstanceWrapper[]`,
  `InstanceWrapper.metatype: Type<T> | Function | null`, `MetadataScanner.getAllMethodNames(prototype: object | null): string[]`)를
  node_modules 에서 직접 열어 캐너리의 API 사용이 실제 시그니처와 정확히 일치함을 확인.
- `spec/5-system/3-error-handling.md`(§1.3 `VALIDATION_ERROR`/`WORKSPACE_ID_REQUIRED` 카탈로그),
  `spec/5-system/2-api-convention.md`(§5.3 "400=`VALIDATION_ERROR`" 기본값 표),
  `common/filters/http-exception.filter.ts`(`getCodeFromStatus`, `23505` 만 매핑하고 `22P02` 는
  안 잡는 것 확인)를 대조해 CHANGELOG·코드 주석의 spec 인용이 사실과 일치함을 재확인.
- `plan/in-progress/auth-guard-reflection-hardening.md` 전문·`CHANGELOG.md`·
  `plan/complete/spec-draft-workspace-header-membership-invariant.md`(이동 diff)를 직접 대조해
  이전 라운드가 지적한 WARNING(stale 링크·plan worktree 필드)이 실제로 고쳐졌는지 재확인.
- `git log -S`/`git show`로 `roles.guard.spec.ts`의 신규 `expectValidationError` 헬퍼가 정확히
  어느 커밋에서 도입됐는지 추적(아래 발견사항 1).

## 확인된 사항 (이전 라운드 fix 가 실제로 반영됨)

- `CHANGELOG.md:47` 의 stale plan 경로(`plan/in-progress/auth-workspace-membership-guard.md`)가
  `plan/complete/auth-workspace-membership-guard.md` 로 정정돼 있다 (documentation.md WARNING 반영 확인).
- `plan/in-progress/auth-guard-reflection-hardening.md` frontmatter `worktree:` 가
  `auth-guard-reflection-hardening-9c31f2` 로 정확히 채워져 있다.
- `workspace-context.util.spec.ts`(W4 지적 대상)의 `it.each` 블록은 캡처-재던지기 패턴으로
  교체돼 있다 — `workspace.decorator.spec.ts` 의 `expectWorkspaceIdRequired` 와 동일 패턴.
- `roles.guard.spec.ts` 에 `RolesGuard`(전역 `APP_GUARD`) 레벨에서 400 전파를 검증하는 3건
  (`@WorkspaceId()` 라우트 · `@Roles()` 라우트 · "403 이 아니라 400") 과, "형식이 깨진 헤더여도
  전역 라우트는 400 을 내지 않는다"(non-nil malformed 값으로 early-return vs 검증-통과를 구분하는
  테스트)가 추가돼 있다 — W5·W6 이 지적한 갭이 실제로 메워졌다.
- `resolveRequestWorkspaceContext`(`workspace-context.util.ts:69-85`)의 헤더 형식 검증
  (`isUuidShaped`)·에러 코드(`VALIDATION_ERROR`)·throw 위치(공용 헬퍼 1곳) 모두 plan §3(W4)의
  결정과 정확히 일치하고, `spec/5-system/2-api-convention.md §5.3`("400=`VALIDATION_ERROR`")와
  `3-error-handling.md §1.3`(기존 `WORKSPACE_ID_REQUIRED` 정의 — "헤더·클레임 **둘 다 없음**")을
  침범하지 않는다(신규 코드가 아니라 기존 400 기본값을 재사용, 트리거 조건도 명확히 분리됨).
- `handlerConsumesWorkspaceId`(`workspace.decorator.ts:61-80`)와
  `countWorkspaceIdConsumingRoutes`(`workspace-reflection-canary.ts:66-84`)의 `(controllerClass,
  handler)` 시그니처가 정확히 일치하고, 캐너리가 판별 로직을 재구현하지 않고 그대로 재사용한다는
  주석 그대로다.
- `DiscoveryModule` 추가(`app.module.ts:81`)·`assertWorkspaceIdReflectionWorks(app)` 호출
  위치(`main.ts:168`, `app` 생성 직후·body parser 등록 이전)가 실측과 일치한다.

## 발견사항

- **[WARNING]** 신규 `roles.guard.spec.ts` 의 `expectValidationError` 헬퍼가, **같은 커밋(`d40f75fbd`)이
  다른 두 파일에서 명시적으로 기각한 "이중 호출 assert" 패턴을 그대로 재도입**한다
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts:358-371` (`expectValidationError` 함수 정의)
  - 상세: 이 함수는 `guard.canActivate(ctx)` 를 **두 번** 호출한다 — 한 번은
    `expect(...).rejects.toThrow(BadRequestException)` 용, 또 한 번은 `buildGuard('owner').guard.canActivate(ctx)`
    로 다시 실행해 `catch` 로 에러를 잡아 `getResponse()` 의 `code` 를 단언하는 용도다. 그런데 바로
    이 함수가 처음 추가된 커밋(`d40f75fbd`, ai-review 2차 W5/W6 수정 커밋)이 **동시에**
    `workspace-context.util.spec.ts`(W4 지적 대상)를 "캡처-재던지기" 패턴으로 고치면서 정확히
    "동일 인자로 `toThrow` 1회 + `getResponse()` 1회 — 첫 단언이 실패하면 두 번째가 조용히
    건너뛰어진다" 는 이유로 이중 호출을 명시적으로 기각해 뒀다(`workspace-context.util.spec.ts:110-113`,
    `workspace.decorator.spec.ts:44-45` 동일 주석). `roles.guard.spec.ts` 만 이 결정을 놓쳤다 —
    `RESOLUTION.md`(`review/code/2026/08/09/14_36_39/RESOLUTION.md` W4 항목)는 "캡처-재던지기로
    통일" 이라고 기록하지만 실제로는 같은 라운드에 신설된 이 헬퍼까지는 통일되지 않았다. 이
    함수가 호출하는 `RolesGuard.canActivate` 는 부수효과가 없는(스테이트리스, `buildGuard('owner')`
    가 매번 새 mock 을 만듦) 순수 판정이라 **현재로선 테스트 결과 자체가 틀리게 나올 위험은
    낮다**(74/74 PASS 로 직접 확인) — 그래서 CRITICAL 이 아니라 WARNING. 다만 향후 이 헬퍼에
    상태를 갖는 mock(예: `getMemberRole` 호출 카운트 검증)이 섞이면 두 번째 호출이 첫 번째와
    다른 mock 인스턴스를 쓰고 있다는 사실이 조용한 assertion 누락으로 이어질 수 있고, "이 PR 이
    스스로 세운 표준을 스스로 어긴" 자기모순이 다음 리더에게 "이 저장소의 표준이 무엇인지" 혼란을
    준다(과거 세션이 이미 "다른 파일에서 근거까지 남기며 회피한 패턴을 무근거로 재도입" 이라는
    같은 클래스의 지적을 한 바 있음).
  - 제안: `expectValidationError` 를 `workspace.decorator.spec.ts` 의 `expectWorkspaceIdRequired` 와
    동일한 캡처-재던지기 1회 호출 패턴으로 교체(`try/catch` 로 에러를 잡아 `throw err` 후
    `expect(() => {...}).toThrow(...)` + `caught` 로 `getResponse()` 단언). guard 인스턴스도
    1회만 생성하면 된다.

- **[INFO]** `resolveRequestWorkspaceContext` 의 신규 400 분기가 `spec/5-system/3-error-handling.md
  §1.3` 에어 카탈로그에 별도 행으로 등재돼 있지 않음 — 이미 5개월 전부터 이어진 selement, 이번
  라운드의 새 발견 아님
  - 위치: `spec/5-system/3-error-handling.md` §1.3 (`WORKSPACE_ID_REQUIRED` 행만 존재, "헤더 present
    but malformed" 케이스는 카탈로그에 없음). 코드: `common/utils/workspace-context.util.ts:74-79`
  - 상세: 이미 두 consistency-check 라운드(`review/consistency/2026/08/09/14_01_15/plan_coherence.md`,
    `15_09_04/cross_spec.md`)가 동일 갭을 WARNING 으로 등재했고, 코드 자체는 spec 이 정한 **기본값**
    (`VALIDATION_ERROR`, `2-api-convention.md §5.3`)을 정확히 재사용했으므로 spec 위반(코드가 틀림)이
    아니라 **spec 카탈로그 표의 누락**(incompleteness)이다. `spec_impact: none` 유지가 정확한 이유도
    plan §3 에 근거와 함께 기록돼 있다. developer worktree 는 `spec/` write 권한이 없어 이 PR 범위
    밖으로 넘겨진 것도 규약대로다(`plan/in-progress/auth-guard-reflection-hardening.md` "후속" 절에
    이미 등재). 반영 방향은 코드 되돌리기가 아니라 spec 갱신(3-error-handling.md §1.3 에 "헤더
    present-but-malformed → `VALIDATION_ERROR`(400)" 행 추가)이므로 SPEC-DRIFT 성격에 가깝지만,
    등재·후속 추적이 이미 완료돼 있어 재차 지적할 필요는 낮다 — 확인 차원으로만 기록.
  - 제안: 조치 불요(이미 plan §후속에 등재, planner 턴 대기). 재차 등재하지 말 것.

- **[INFO]** `assertWorkspaceIdReflectionWorks` 의 fail-closed 보장이 Node 의 암묵적
  `unhandledRejection` 기본 동작(`void bootstrap()`)에 의존 — 이미 security.md/side_effect.md(14_36_39)가
  지적한 동일 항목, 새 발견 아님
  - 위치: `codebase/backend/src/main.ts:168`(호출부), `:239`(`void bootstrap();`)
  - 상세: 캐너리가 throw 하면 `bootstrap()` 의 반환 Promise 가 reject 되고, `.catch()`/
    `unhandledRejection` 핸들러가 코드베이스 어디에도 없어(재확인: grep 0건) Node 기본 정책(프로세스
    종료)에 암묵적으로 의존한다. 지금은 의도대로 fail-closed 로 동작하고(e2e 로 실증) `package.json`
    `engines.node >=24` 로 이 가정이 실제로 성립함을 확인했으나, 이 계약이 코드에 명시적으로
    강제(`process.exit(1)`)되어 있지 않다. 재확인 목적으로만 기록 — 두 차례 리뷰가 이미 같은
    결론(조치 불요, 알려진 한계로 문서화됨)에 도달했다.
  - 제안: 조치 불요. 이미 두 차례 리뷰가 동일 결론.

- **[INFO]** `spec/5-system/1-auth.md`/`3-error-handling.md` frontmatter `code:` evidence 글로브가
  이번에 강화한 정확한 표면(`common/decorators/*.ts`·`common/utils/workspace-context.util.ts`·
  `uuid.ts`)을 포함하지 않음 — 이미 두 consistency-check 라운드가 WARNING 으로 등재하고 plan
  §후속에 반영된 항목, 재확인만
  - 위치: `spec/5-system/1-auth.md` frontmatter `code:`(`common/guards/*.ts` 만 존재)
  - 상세: 빌드 가드(`spec-code-paths.test.ts`)는 `common/guards/*.ts` 로 이미 충족돼 CI 미차단이라
    실질 위험은 낮다. `plan/in-progress/auth-guard-reflection-hardening.md` "후속" 절에 이미
    명시적으로 등재돼 있어 추적 누락은 아니다.
  - 제안: 조치 불요, 이미 추적 중.

## 요약

핵심 기능(부트타임 reflection 캐너리 fail-closed·`X-Workspace-Id` UUID 형식 검증 400화)은 plan
W1/W3/W4 가 정의한 요구사항과 코드·테스트가 line-level 로 정확히 일치하며, 이전 두 라운드가 지적한
WARNING(stale CHANGELOG 링크·plan worktree 필드 미기입·가드 레벨 테스트 부재·vacuous 테스트)이 모두
실제로 수정되고 테스트로 고정된 것을 직접 실행(74/74 PASS)·직접 코드 대조로 재확인했다. spec 인용
(에러 코드 기본값·SQLSTATE 매핑·NestJS Discovery API 시그니처)도 전부 실측과 일치해 허구 인용이 없다.
유일한 새 발견은 같은 fix 커밋 안에서 스스로 기각한 "이중 호출 assert" 안티패턴이 다른 신규 테스트
헬퍼(`roles.guard.spec.ts`)에는 적용되지 않은 자기모순(WARNING, 기능 결함 아님 — 74/74 GREEN 확인)
이며, 나머지는 이미 등재·추적 중인 항목의 재확인(INFO)이다. 착수/머지를 막을 CRITICAL 은 없다.

## 위험도

LOW

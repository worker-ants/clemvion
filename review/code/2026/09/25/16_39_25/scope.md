# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 가드 거부에 코드를 싣는 변경(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)이 경로 파라미터 워크스페이스 15곳뿐 아니라 `@Roles()`가 붙은 모든 기존 라우트(재실행 `reRun`·`getChain`, `POST /api/workflows` 등)의 403 응답 본문에 영향을 준다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts`(`assertMember`·`canActivate`) · `codebase/backend/src/modules/executions/executions.controller.ts`(`@ApiForbiddenResponse` 갱신) · `codebase/backend/test/workspace-rbac.e2e-spec.ts`
  - 상세: 1라운드(`review/code/2026/09/25/16_03_32`)에서 이미 동일 관측(W1/INFO)으로 지적됐고, `plan/in-progress/workspace-path-guard-impl.md` "구현 요구 3"·`roles.guard.ts` docstring·`spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드"가 "새 경로에만 코드를 붙이면 같은 실패가 경로에 따라 다른 본문을 낸다"는 근거로 전 경로 통일을 명시적으로 정당화했고, RESOLUTION.md 에서 "이미 announce 됨 — 변경 없음"으로 처분됐다. 재조치 대상 아님.
  - 제안: 조치 불요(1라운드에서 이미 처분). 기록으로만 남김.

- **[INFO]** `workspaces.controller.ts`의 다수 엔드포인트(`update`·`updateSettings`·`remove`·`addMember`·`updateMember`·초대 4곳)에 종전에 없던 `@Roles('admin')`/`@Roles('owner')`가 새로 부착되고, 신규 저장소 정적 가드 `workspace-param-binding`(2 파일 + fixture)이 함께 들어온다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` · `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts`(신규) · `.../workspace-param-binding.spec.ts`(신규) · `.../fixtures/workspace-param-binding/sample.controller.ts`(신규)
  - 상세: 1라운드에서 동일하게 지적·검토됐다. `plan/in-progress/workspace-path-guard-impl.md` "구현 요구 2"(15곳 역할 배분 Admin 8/Owner 2/멤버 4/전환 1을 사전 명시)·"구현 요구 4"(저장소 가드 신설을 사전 명시)와 정확히 대응되고, `workspace-roles-attachment.spec.ts`가 15곳 전체를 reflection 회귀로 고정한다. 종전엔 가드가 경로 워크스페이스를 인식 못 해 `@Roles()`를 붙여도 헤더/토큰 워크스페이스로 오판정됐으므로 붙이지 않았던 것 — 이번 fix 의 핵심 산출물이지 부가 확장이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 역할 서열 단일화(`common/constants/workspace-roles.ts` 신설) · `ADMIN_ROLES` 두 곳(`workspaces.service.ts`/`workspace-invitations.service.ts`) 통합 · `workspaces.controller.ts`의 `@ApiForbiddenResponse` 설명 문자열 8곳 모듈 상수화 — 이번 diff(2라운드)에서 새로 눈에 띄는 변경이다.
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts`(신규) · `codebase/backend/src/common/constants/workspace-roles.spec.ts`(신규) · `codebase/backend/src/modules/workspaces/workspaces.service.ts` · `workspace-invitations.service.ts` · `workspaces.controller.ts`
  - 상세: 언뜻 "이 작업과 무관한 리팩토링"으로 보일 수 있으나, `git log`로 확인하면 커밋 `37ee970a2`가 1라운드 SUMMARY(`16_03_32`)의 W4(역할 서열 이원화)·W5(설명 문자열 중복) 지적에 대한 직접 조치이고 RESOLUTION.md 에 "고침"으로 기록·처분돼 있다. 동작 불변(뮤턴트 R1~R3 KILLED로 검증됨, plan §체크리스트)이라 새로운 기능이나 무관한 정리가 아니라 같은 PR 내 리뷰 사이클의 정상적인 fix 반영이다.
  - 제안: 조치 불요.

- **[INFO]** `codebase/backend/test/workspace-path-guard.e2e-spec.ts`의 `transferOwnership` 성공 응답 단언이 `200`에서 `201`로 바뀌었다.
  - 위치: `codebase/backend/test/workspace-path-guard.e2e-spec.ts`(`'경로 워크스페이스의 owner 는 헤더가 viewer 인 워크스페이스를 가리켜도 이양할 수 있다'` 테스트)
  - 상세: 커밋 `8d732756f`에서 실측(라우트에 `@HttpCode`가 없어 Nest 기본값 201)에 맞춰 정정한 것이고, OpenAPI 문서가 여전히 200을 광고하는 기존 불일치는 고치지 않고 트래커 후속으로 등재했다고 커밋 메시지·테스트 주석에 명시돼 있다. 이번 PR 이 새로 만든 결함이 아니라 이번 PR 이 처음으로 그 라우트를 e2e 로 왕복시키며 발견·기록한 기존 불일치이며, 범위를 벗어나 직접 고치지 않고 트래킹만 한 점도 적절하다.
  - 제안: 조치 불요.

## 요약

25개 파일에 걸친 대규모 diff이지만 1라운드(`16_03_32`, Critical 0 · Warning 8) 이후의 변화분은 그 SUMMARY/RESOLUTION.md 에 기록된 조치(W2~W6, INFO 6, INFO 9)와 정확히 대응되는 커밋(`37ee970a2`, `8d732756f`)이었고, 나머지 대부분은 1라운드 scope 리뷰가 이미 `plan/in-progress/workspace-path-guard-impl.md` "구현 요구 1~8" 전체와 대조를 마친 항목의 재등장이다. 이번 라운드에서 다시 대조해도 스코프를 벗어난 리팩토링·무관한 파일 수정·포맷팅 전용 변경·불필요한 주석/임포트 정리·의도치 않은 설정 변경은 발견되지 않았다. 가드 거부 코드의 전 라우트 확산, 신규 정적 가드 추가, 다수 엔드포인트 `@Roles()` 신규 부착, 역할 서열 단일화, 트랜스퍼 응답 코드 정정은 모두 plan에 사전 명시되거나 1라운드 리뷰에서 처분된 "계획된 결합"이라 스코프 이탈로 보지 않는다. 대형 파일(`roles.guard.spec.ts`, `auth.controller.ts`, `workspace-invitations.service.ts`, `workspaces.controller.ts`, `workspaces.service.spec.ts`, `workspaces.service.ts`, `workspace-rbac.e2e-spec.ts`)은 프롬프트 크기 제한으로 전체 파일 컨텍스트가 실리지 않아 diff hunk와 관련 커밋(`git show`)으로 교차 확인했으며, 노출된 범위 안에서는 추가 확인이 필요한 이상 징후가 없었다.

## 위험도

NONE

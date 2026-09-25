# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 가드 거부에 코드를 싣는 변경(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)이 경로 파라미터 워크스페이스 15곳뿐 아니라 **`@Roles()`가 붙은 모든 기존 라우트**(재실행, chain, edges, nodes 등)의 응답 본문에 영향을 준다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (`assertMember` 메서드, `RolesGuard.canActivate`) · `codebase/backend/src/modules/executions/executions.controller.ts` (`reRun`·`getChain`의 `@ApiForbiddenResponse`) · `codebase/backend/test/workspace-rbac.e2e-spec.ts`(예: `viewer create → 403 EDITOR_REQUIRED` 케이스)
  - 상세: "경로 파라미터 워크스페이스 가드" 라는 작업명만 보면 범위가 그 15곳 라우트로 좁게 읽히지만, 실제 diff는 `RolesGuard`가 `false`를 반환하던 모든 거부 경로를 `ForbiddenException` + 코드로 바꿔, 헤더/토큰 컨텍스트 라우트(예: `executions.reRun`, `POST /api/workflows`)의 403 응답 본문도 함께 바뀐다. 다만 이 결합은 우발적 확장이 아니라 `plan/in-progress/workspace-path-guard-impl.md`의 "구현 요구 3"에 "새 경로에만 코드를 붙이면 같은 실패가 경로에 따라 다른 본문을 내므로 전 경로를 함께 바꿨다"로 명시적으로 설계·정당화되어 있고, `roles.guard.ts` docstring·`spec/data-flow/12-workspace.md` §Rationale에도 같은 근거가 기록되어 있다. 즉 스코프 밖 변경이 아니라 계획된 결합이지만, 이 PR을 소비하는 다음 사람(FE 등)이 "경로 가드만 바뀐 줄 알았는데 기존 라우트의 403 본문도 바뀌었다"고 오인하지 않도록 인지해 둘 필요가 있다.
  - 제안: 별도 조치 불요(이미 plan·spec·CHANGELOG에 명시). 리뷰 기록으로만 남김.

- **[INFO]** 새 저장소 정적 가드 `workspace-param-binding`(신규 파일 2개 + fixture 1개)이 함께 추가되어, 기능 구현(데코레이터+가드) 외에 CI 강제 메커니즘까지 이 diff에 포함된다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts`(신규) · `codebase/backend/src/repo-guards/__tests__/workspace-param-binding.spec.ts`(신규) · `codebase/backend/src/repo-guards/__tests__/fixtures/workspace-param-binding/sample.controller.ts`(신규)
  - 상세: 기능적으로는 `@WorkspaceParam`과 `RolesGuard` 인식만으로 요구사항을 만족할 수 있어, 이 정적 가드는 "미래의 회귀를 막는" 부가 안전장치에 가깝다. 다만 `plan/in-progress/workspace-path-guard-impl.md` "구현 요구 4"에 처음부터 요구사항으로 명시돼 있고, 같은 디렉터리의 기존 자매 가드(`param-uuid-pipe-guard.ts`)와 동일한 패턴·컨벤션을 따르므로 이 저장소의 기존 관례에 부합한다. Over-engineering이라기보다 "평범한 `@Param`으로 워크스페이스를 받으면 가드가 못 알아본다"는 이번 보안 변경의 직접적 실패 모드를 막는 대응 조치로, scope 내로 판단된다.
  - 제안: 조치 불요. 향후 리뷰에서 "요청받지 않은 기능 추가"로 재지적되지 않도록 근거만 남김.

- **[INFO]** `codebase/backend/src/modules/workspaces/workspaces.controller.ts`의 다수 엔드포인트(`update`·`updateSettings`·`addMember`·`updateMember`·초대 4곳)에 종전에 없던 `@Roles('admin')`/`@Roles('owner')` 데코레이터가 새로 부착된다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (예: `update` 메서드 앞 `+  @Roles('admin')`, `remove` 메서드 앞 `+  @Roles('owner')`)
  - 상세: 데코레이터 자체가 새로 생기는 것이라 언뜻 "요청 이상의 확장"으로 보일 수 있으나, `plan/in-progress/workspace-path-guard-impl.md` "구현 요구 2"에 정확히 이 15곳의 역할 배분(Admin 8 / Owner 2 / 멤버 4 / 전환 1)이 사전에 명시돼 있고, `workspace-roles-attachment.spec.ts`가 그 15곳 전체를 reflection으로 고정하는 회귀 테스트까지 갖췄다. 종전에는 가드가 경로 워크스페이스를 인식하지 못해 `@Roles()`를 붙여도 잘못된(헤더/토큰) 워크스페이스에 대해 판정했으므로 붙이지 않았던 것이고, 이번 변경으로 가드가 경로 값을 올바르게 볼 수 있게 되어 비로소 안전하게 붙인 것 — 기능 확장이 아니라 이번 fix의 핵심 산출물이다.
  - 제안: 조치 불요.

## 요약

22개 파일에 걸친 대규모 diff이지만, 각 파일의 변경 내용을 `plan/in-progress/workspace-path-guard-impl.md`의 "구현 요구 1~8" 및 뮤턴트 표(M1~M17)와 대조한 결과 전부 그 요구 항목 중 하나에 정확히 대응되며, 스펙(`spec/data-flow/12-workspace.md` §Rationale)·CHANGELOG·`--impl-prep` 경고 처리표까지 일관되게 연결되어 있다. 요청 범위를 벗어난 리팩토링, 무관한 파일 수정, 포맷팅 전용 변경, 불필요한 주석/임포트 정리, 의도치 않은 설정 변경은 발견되지 않았다. 다만 (1) 가드 거부 코드 부여가 경로 워크스페이스 라우트를 넘어 `@Roles()` 전 라우트의 응답 본문에 영향을 주는 점, (2) 신규 정적 분석 가드(`workspace-param-binding`) 추가, (3) 다수 엔드포인트에 새 `@Roles()` 부착은 각각 스코프가 넓어 보일 수 있으나 세 가지 모두 plan에 사전 명시되고 근거·테스트가 갖춰진 "계획된 결합"이라 스코프 이탈로 보지 않는다. 일부 대형 파일(`roles.guard.spec.ts`, `auth.controller.ts`, `workspaces.service.spec.ts`, `workspaces.service.ts`, `workspace-rbac.e2e-spec.ts`, `workspaces.controller.ts`)은 프롬프트 크기 제한으로 전체 파일 컨텍스트가 실리지 않아 diff hunk만으로 판단했으나, 노출된 hunk들은 모두 좁고 목적이 분명해 추가 확인이 필요한 이상 징후는 없었다.

## 위험도

NONE

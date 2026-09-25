# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[WARNING]** 워크스페이스 RBAC 흐름 강화(경로 파라미터 `@WorkspaceParam` 도입 + `@Roles()` 전면 부착 + `switchWorkspace` 의 header/path 판정 기준 명확화)가 "인증·권한·세션 흐름 변경" trigger 에 매칭되는데, 대응하는 유저 가이드 페이지 갱신이 변경 set 에 없음
  - 변경 파일: `codebase/backend/src/modules/auth/auth.controller.ts`, `codebase/backend/src/modules/auth/auth.service.ts`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts`, `codebase/backend/src/modules/workspaces/workspaces.service.ts`, `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts`, `codebase/backend/src/common/constants/workspace-roles.ts`(신규), `codebase/backend/src/common/decorators/workspace.decorator.ts`, `codebase/backend/src/common/guards/roles.guard.ts`
  - 매트릭스 항목: `auth-session-flow-change` — targets: `"codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"` (PROJECT.md 176행 동일 셀, 209행 "자주 누락" 목록에 이 정확한 패턴이 별도로 명시: "인증·권한·세션 흐름 변경 vs 워크스페이스 가이드(`07-workspace-and-team/`) 미갱신 — 흐름 변경 + 가이드 갱신 + e2e 가 한 묶음")
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` + `.en.mdx` — 변경 set 에 `codebase/frontend/**` 파일이 전혀 없음(28개 변경 파일 전부 `codebase/backend/**`)
  - 상세: e2e 쪽은 `codebase/backend/test/workspace-path-guard.e2e-spec.ts` · `workspace-rbac.e2e-spec.ts` · `workspace-delete-concurrency.e2e-spec.ts` 3건이 신설되어 매트릭스 요구의 절반(e2e)은 충족됨. 다만 가이드 페이지 쪽은 이번 diff 에 전혀 없음. `workspaces-and-members.mdx` 를 직접 대조한 결과, 문서의 역할표(Owner/Admin/Editor/Viewer 권한 요약)는 이번 PR 이 추가한 `@Roles('admin')`/`@Roles('owner')` 강제와 내용상 모순되지는 않음(라우트별 서비스 계층 검증은 이미 존재했고, 이번 변경은 가드 계층에도 같은 요구를 얹는 defense-in-depth + `switchWorkspace` 의 header/path 우선순위 명확화로 보임) — 즉 **문서 텍스트 자체가 사실과 어긋나지는 않은 것으로 보임**. 그러나 이 판단은 PR 작성자가 명시적으로 "가이드 변경 불요" 를 확인·기록한 것이 아니라 본 리뷰어가 사후 추론한 것이며, PROJECT.md 가 이 정확한 조합(인증 흐름 변경 + 07-workspace-and-team 미갱신)을 반복 누락 패턴으로 못박아 둔 만큼 절차적으로는 이번 PR 도 그 규약의 대상임
  - 제안: (a) 실제로 문서 갱신이 불필요하다고 판단되면 PR 본문에 그 근거(예: "역할 매트릭스·권한 요약 불변, switchWorkspace 의 X-Workspace-Id 정책은 애초에 사용자 가이드에 미노출된 내부 API 계약이라 변경 없음")를 명시해 다음 리뷰어/독자가 재차 조사하지 않게 할 것. (b) 혹은 `workspaces-and-members.mdx`/`.en.mdx` 에 "워크스페이스 전환은 항상 사이드바에서 선택한 워크스페이스 기준으로 검증된다"는 식의 한 줄이라도 보강해 절차 규약을 형식적으로도 만족시킬 것

## 요약

매트릭스 `rows[]` 21개 중 이번 변경 set(전부 `codebase/backend/**`, 28개 파일: auth/workspaces 컨트롤러·서비스, 공용 role 상수·데코레이터·가드, repo-guards 정적분석 테스트, e2e 3건)에 실제로 매칭되는 trigger 는 `auth-session-flow-change`(인증·권한·세션 흐름 변경) 1건이며, 그 target 중 e2e 는 충족(신규 e2e 3건)됐으나 `07-workspace-and-team/` 가이드 페이지 동반 갱신은 diff 에 없음 — 다만 직접 대조한 결과 현재 문서 텍스트가 이번 변경으로 사실과 어긋나게 되지는 않은 것으로 보여 실질적 stale 위험은 낮음. 그 외 trigger(신규 노드/i18n/섹션 디렉토리/표현식 언어/warningCode 등)에는 매칭되는 변경이 없음(frontend·docs·i18n·packages 파일이 changeset 에 전혀 없음).

## 위험도

LOW

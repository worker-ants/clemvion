# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 프론트엔드 주석이 이번 PR 이 제거한 백엔드 심볼(`ROLE_HIERARCHY`)을 여전히 가리킨다 — 오래된 주석
  - 위치: `codebase/frontend/src/components/auth/role-gate.tsx:11` (`// Backend \`roles.guard.ts\` 의 ROLE_HIERARCHY 와 반드시 동일한 순서를 유지해야 한다.`)
  - 상세: 이번 PR(파일 4·11, `codebase/backend/src/common/guards/roles.guard.ts`)은 `roles.guard.ts` 안에 있던 `ROLE_HIERARCHY` 상수를 **삭제**하고 `codebase/backend/src/common/constants/workspace-roles.ts` 의 `WORKSPACE_ROLE_LEVEL`(+ `workspaceRoleLevel()`)로 옮겼다 — 서열의 단일 SoT 를 만드는 것이 이 PR 의 핵심 목적 중 하나다(`workspace-roles.ts` 파일 헤더 docstring 참조). 그런데 프론트의 `role-gate.tsx`(같은 서열을 미러링하는 `ROLE_LEVEL` 상수)의 주석은 여전히 "Backend `roles.guard.ts` 의 `ROLE_HIERARCHY`" 를 SoT 로 지목한다 — 그 심볼은 이제 그 파일에 존재하지 않는다. 저장소 전체 grep 결과 `ROLE_HIERARCHY` 를 참조하는 살아있는 코드는 이 한 줄뿐이다(나머지는 전부 `plan/`·`spec/`·`review/` 의 과거 기록). 다음에 역할 서열을 바꾸는 사람이 이 주석만 보고 이미 없어진 `roles.guard.ts` 의 `ROLE_HIERARCHY` 를 찾다가 시간을 쓸 수 있다.
  - 제안: 주석을 새 SoT 로 갱신 — 예: `// Backend `common/constants/workspace-roles.ts` 의 WORKSPACE_ROLE_LEVEL 과 반드시 동일한 순서를 유지해야 한다.` 이 파일은 이번 PR 의 28개 변경 파일 목록 밖(frontend)이라 이번 diff 가 직접 건드리진 않았지만, 이번 PR 이 그 참조 대상을 없앤 당사자이므로 같은 PR 에서 함께 고치는 것이 자연스럽다.

## 요약

이번 PR 의 문서화 수준은 이례적으로 높다 — 신규·변경 함수·클래스 전부에 JSDoc 이 있고, 설계 근거는 `spec/data-flow/12-workspace.md` §Rationale("경로 파라미터 워크스페이스도 가드가 본다" · "가드 거부의 오류 코드")로 정확히 교차 참조되며, 그 spec 섹션·anchor 를 직접 열어 대조한 결과 인용이 전부 실재하고 정확했다. 기존 주석이 이번 변경으로 틀리게 된 자리는 취소선(`~~...~~`) + "(2026-09-25 정정)" 표기로 원문을 보존한 채 정정하는 저장소 관례를 일관되게 따랐고(`workspaces.service.ts`, `workspaces.service.spec.ts`, `workspace-rbac.e2e-spec.ts` 등), `param-uuid-pipe-guard.ts` 의 실측 수치(136 = `@Param` 121 + `@WorkspaceParam` 15)는 CHANGELOG · spec · 가드 주석 · 신규 e2e 스펙 넷이 모두 같은 숫자로 일치했다. `CHANGELOG.md` 에도 "거부 코드" 와 "CI 가드 신설" 을 별개 `## Unreleased` 항목 두 개로 정확히 분리해 추가했고, `spec/conventions/swagger.md` §5-4 체크리스트와 `spec/conventions/error-codes.md` §3 예외 레지스트리도 `@WorkspaceParam` · `admin_required` 변경 내용을 이미 반영하고 있어 문서-구현 드리프트가 거의 없다. 유일하게 찾은 결함은 이번 PR 의 변경 대상 밖(frontend)에 있는 오래된 주석 하나로, `roles.guard.ts` 에서 제거된 `ROLE_HIERARCHY` 를 여전히 SoT 로 지목한다.

## 위험도

LOW

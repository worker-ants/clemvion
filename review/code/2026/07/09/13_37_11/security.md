# 보안(Security) Review

## 발견사항

- **[INFO]** 에디터 로더의 API 에러 메시지를 그대로 사용자에게 노출
  - 위치: `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx:539-542` (`setError(err instanceof Error ? err.message : ...)`, `<p>{error}</p>` 렌더)
  - 상세: `workflowsApi.get/getNodes/getEdges` 호출 실패 시 `err.message` 를 가공 없이 화면에 렌더한다. Axios 에러 메시지는 보통 `Request failed with status code 404` 류의 일반 문자열이라 즉각적인 민감정보 노출 위험은 낮지만, 백엔드가 상세 스택/URL 을 메시지에 포함하는 케이스가 생기면 그대로 반영된다. 이 파일은 phase 1 `(editor)/workflows/[id]/editor-loader.tsx` 를 슬러그 경로로 그대로 이동한 것으로 보이며 이번 diff 에서 새로 도입된 로직은 아니다(에러 처리 로직 자체는 불변).
  - 제안: 별도 대응 불요(기존 패턴 유지) — 다만 향후 에러 표면을 다룰 때는 `translate(...)` 고정 문구로 통일하고 `err.message` 는 로깅에만 남기는 방향을 고려.

- **[INFO]** FE slug 게이트는 인가 경계가 아님 — 설계상 의도이며 정확히 문서화됨
  - 위치: `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx` (신규 공용 컴포넌트), `codebase/frontend/src/app/(editor)/w/[slug]/layout.tsx`
  - 상세: `WorkspaceSlugGate` 는 URL `slug` 를 클라이언트가 이미 보유한 `GET /workspaces` 목록(사용자 소속 워크스페이스만 포함)과 매칭해 reconcile/redirect 한다. 비멤버·무효 slug 는 `resolveFallbackWorkspace` 로 default 워크스페이스에 리다이렉트될 뿐이며, 실제 데이터 접근 인가는 여전히 backend `X-Workspace-Id` 헤더 → 토큰 클레임 → `RolesGuard` 가 강제한다(주석에 명시). URL 조작만으로 비멤버 워크스페이스 데이터에 접근할 수는 없다 — `workspaces.find(w => w.slug === slug)` 가 비멤버 워크스페이스에 대해 항상 `null` 이기 때문. 설계·문서화가 정확해 별도 조치 불요.
  - 제안: 없음(정보성 확인).

- **[INFO]** `buildEditorHref`/`buildWorkspaceHref` 는 기존 open-redirect 방어(`toSafeInternalPath`)를 그대로 재사용
  - 위치: `codebase/frontend/src/lib/workspace/href.ts` (신규 `buildEditorHref`), `codebase/frontend/src/lib/workspace/safe-path.ts` (변경 없음, 기존 로직 재사용 확인)
  - 상세: `buildEditorHref(slug, workflowId)` 는 `buildWorkspaceHref(slug, `/workflows/${workflowId}`)` 를 호출하고, 후자는 `toSafeInternalPath` 로 protocol-relative(`//host`, `\\host`) 및 제어문자 우회를 정규화한다. `workflowId` 자체는 별도 화이트리스트 검증 없이 문자열 보간되지만, 이는 기존 `buildExecutionHref` 와 동일한 패턴이며 `workflowId` 는 Next.js 단일 경로 세그먼트(`[id]`)에서 오거나 백엔드 응답의 `workflow.id` 값이라 실질적으로 신뢰할 수 있는 소스다. 새 회귀는 없음.
  - 제안: 없음(회귀 없음 확인 목적의 기록).

- **[INFO]** `no-raw-editor-href.test.ts` / `no-raw-execution-href.test.ts` 가드는 소스 텍스트 스캔 기반 방어이며 문자열 연결(`"/workflows/" + id`) 형태는 탐지하지 못함을 스스로 문서화
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-editor-href.test.ts:1936` (`"문자열 연결(알려진 미탐지)"` 케이스)
  - 상세: 이 한계는 broken-link(잘못된 workspace 링크로 인한 wrong-workspace 컨텍스트 노출) 방어의 완결성에 관한 것이지 직접적인 인젝션/인증 취약점은 아니다. 이미 알려진 제약으로 테스트에 명시돼 있어 은폐된 리스크는 아니다.
  - 제안: 향후 ESLint AST 기반 규칙으로 보강 여지가 있으나 이번 변경 범위에서 필수는 아님.

## 요약

이번 변경은 프런트엔드 라우팅(에디터 캔버스를 `/w/<slug>/workflows/<id>` 로 편입)에 국한된 리팩터링으로, 서버 인가 모델(`X-Workspace-Id` 헤더 → 토큰 클레임 → `RolesGuard`)은 명시적으로 불변이며 코드·주석에서도 "FE 라우팅 SoT ≠ backend 인가 SoT" 원칙이 일관되게 유지된다. 신규 `WorkspaceSlugGate`/`buildEditorHref` 는 기존 open-redirect 방어(`toSafeInternalPath`)와 워크스페이스 멤버십 필터링을 그대로 재사용해 새로운 인젝션·인가 우회·시크릿 노출 벡터를 도입하지 않는다. 유일하게 언급할 만한 항목은 에디터 로더의 원본 에러 메시지 노출이나, 이는 기존 코드 이동일 뿐 이번 diff 로 신규 도입된 로직이 아니며 위험도도 낮다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 안전하지 않은 암호화·해시, 의존성 취약점 관련 이슈는 발견되지 않았다.

## 위험도
NONE

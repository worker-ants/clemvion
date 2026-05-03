### 발견사항

---

**[WARNING] `setRole` 헬퍼 함수 3개 테스트 파일에 완전 중복**
- 위치: `schedules-page.test.tsx`, `triggers-page.test.tsx`, `editor-toolbar-rbac.test.tsx` (모두 동일 함수 본문)
- 상세: workspace store 를 특정 role로 세팅하는 `setRole` 함수가 세 파일에 글자 하나 차이 없이 중복. `WorkspaceRole` 타입 구조나 store shape 가 바뀌면 세 곳을 동시에 수정해야 함.
- 제안: `frontend/src/test-utils/workspace.ts` 같은 공유 헬퍼 파일로 추출, `{ id: 'ws-1', name: 'Test', type: 'team', slug: 'team-1' }` 픽스처 상수도 함께 정의.

---

**[WARNING] `createWrapper` 함수도 중복**
- 위치: `schedules-page.test.tsx`, `triggers-page.test.tsx` (동일 구현)
- 상세: `QueryClient` + `QueryClientProvider` 래퍼 팩토리가 두 파일에 identical하게 반복. 이미 프로젝트에 존재한다면 기존 util 을 재사용해야 함.
- 제안: `setRole` 과 같은 공유 test-utils 파일로 이전.

---

**[WARNING] `document.querySelector` 를 직접 사용 — testing-library anti-pattern**
- 위치: `schedules-page.test.tsx:158, 176`
  ```tsx
  document.querySelector('button[title*="Edit" i]')
  ```
- 상세: `screen.getByTitle` / `screen.queryByTitle` 를 쓰지 않고 raw DOM API를 사용. cleanup 후 이전 DOM 참조가 남을 위험이 있고, testing-library의 권장 방식인 접근성 기반 쿼리에서 벗어남.
- 제안: `screen.getByTitle(/edit/i)` 또는 `data-testid` 속성을 버튼에 추가해 `screen.getByTestId` 사용.

---

**[WARNING] More 메뉴 트리거를 배열 마지막 위치로 찾는 취약한 셀렉터**
- 위치: `editor-toolbar-rbac.test.tsx:106,116`
  ```tsx
  const moreTrigger = buttons[buttons.length - 1];
  ```
- 상세: 툴바에 버튼이 추가되면 인덱스가 바뀌어 테스트가 의도치 않게 다른 버튼을 클릭하게 됨. 주석(`마지막 ghost icon 버튼이 More 트리거`)이 취약성을 인정하면서도 수정하지 않았음.
- 제안: `EditorToolbar` 의 More 버튼에 `aria-label="More options"` 또는 `data-testid="more-menu-trigger"` 추가 후 `screen.getByRole('button', { name: /more options/i })` 로 쿼리.

---

**[INFO] `'editor'` 역할 문자열 백엔드 전역에 하드코딩**
- 위치: `auth-configs.controller.ts:83,100,138,159`, `folders.controller.ts:73,95,116`
- 상세: `@Roles('editor')` 데코레이터가 여러 컨트롤러에 반복. 역할 이름이 변경되거나 계층이 추가될 때 일괄 검색·치환 필요.
- 제안: `roles.guard.ts` 또는 공유 상수 파일에 `export const ROLE = { EDITOR: 'editor', ADMIN: 'admin' } as const` 정의 후 `@Roles(ROLE.EDITOR)` 사용. (단, 스펙에서 문자열이 DB 저장 값이라면 의도적인 설계일 수 있으므로 팀 합의 필요)

---

**[INFO] `?? undefined` no-op 패턴이 잔존**
- 위치: `execution-engine.service.ts:1514`
  ```typescript
  const structuredConfig = structured?.config ?? undefined;
  ```
- 상세: `null → undefined` 정규화 의도는 이해되지만, `?? undefined` 는 독자에게 "이게 왜 필요하지?" 라는 의문을 유발함. 전형적인 `?? undefined` 는 타입 narrowing 목적이지만 타입 캐스트가 제거된 현재 코드에서는 의도가 더 불명확해짐.
- 제안: `null` 을 `undefined` 로 정규화해야 한다면 `structured?.config ?? undefined` 유지하되 한 줄 주석으로 이유를 명시, 또는 그 차이가 실제로 중요하지 않다면 `structured?.config` 로 단순화.

---

**[INFO] 백엔드 두 스펙 파일이 완전히 동일한 구조**
- 위치: `auth-configs.controller.spec.ts`, `folders.controller.spec.ts`
- 상세: Reflector 기반 `@Roles` 메타데이터 검증 패턴이 완전히 동일. 컨트롤러가 늘어날수록 같은 보일러플레이트가 계속 복제됨.
- 제안: `testRolesMetadata(ControllerClass, writeMethods, readMethods)` 형태의 공유 헬퍼를 backend test-utils 에 정의해 재사용.

---

**[INFO] TSX 주석이 WHAT 을 설명**
- 위치: `editor-toolbar.tsx:222, 283`
  ```tsx
  {/* Center: editable name (Viewer 는 read-only 텍스트) */}
  {/* Save (Editor+) */}
  ```
- 상세: 코드 자체(`canEdit ? <Input> : <span>`, `<RoleGate minRole="editor">`)가 이미 의도를 표현하므로 주석이 중복 서술. CLAUDE.md 지침상 WHAT 주석은 지양.
- 제안: 두 주석 모두 제거.

---

### 요약

이번 변경은 RBAC 가드를 백엔드(두 컨트롤러)와 프론트엔드(세 페이지/컴포넌트)에 균일하게 적용했으며 전체적인 구조와 패턴 일관성은 양호하다. 주요 유지보수 리스크는 `setRole` / `createWrapper` 테스트 헬퍼의 3중 중복과, More 메뉴를 버튼 배열 마지막 인덱스로 찾는 취약한 셀렉터이며, 이 두 지점은 향후 리팩터링 시 테스트 깨짐의 무음 원인이 될 수 있다. 나머지는 낮은 심각도의 정보성 사항으로 전체 위험도는 낮다.

### 위험도
**LOW**
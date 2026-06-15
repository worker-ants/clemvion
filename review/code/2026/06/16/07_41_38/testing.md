### 발견사항

- **[WARNING]** `AuthConfigEditDialog` 컴포넌트 자체에 대한 단위 테스트 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/auth-config-edit-dialog.tsx` (신규, 테스트 없음)
  - 상세: `AuthConfigEditDialog` 는 `typeDisabled={true}` · `showPassword={false}` 를 `AuthConfigFormFields` 에 전달해 편집 모드의 보안 invariant 를 강제한다. 이 prop 전달 계약이 컴포넌트 단독 테스트 없이 page.tsx 통합 경로(`authentication-form.test.tsx` L208: `expect(screen.getByLabelText("Type")).toBeDisabled()`)로만 간접 검증된다. prop 기본값 변경이나 전달 실수가 단위 테스트에서 즉각 감지되지 않는다.
  - 제안: `auth-config-edit-dialog.test.tsx` 를 추가해 최소 (1) `typeDisabled` 전달 시 type select disabled, (2) `showPassword=false` 전달 시 password 필드 미렌더를 직접 어설션한다.

- **[WARNING]** `AuthConfigCreateForm` 컴포넌트 자체에 대한 단위 테스트 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/auth-config-create-form.tsx` (신규, 테스트 없음)
  - 상세: `AuthConfigCreateForm` 은 `generatedKey` 표시(1회 노출) 분기를 담당한다. `authentication-form.test.tsx` L132–157 과 `generated-key-autoclear.test.tsx` 가 page.tsx 통합 경로로 generatedKey UI 를 검증하나, 컴포넌트 prop 수준에서 `generatedKey=null` 분기(폼 렌더) vs `generatedKey=string` 분기(1회 노출 UI + Done 버튼)를 격리해 검증하는 테스트가 없다.
  - 제안: `auth-config-create-form.test.tsx` 를 추가해 `generatedKey` 유/무 분기 렌더링 및 "Done" 버튼 동작을 단위 수준에서 검증한다.

- **[WARNING]** `AuthConfigFormFields` 의 capability props 조합 단위 테스트 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx` (신규, 테스트 없음)
  - 상세: `AuthConfigFormFields` 는 `showPassword`, `typeDisabled`, `showTypeLockedHint` 세 capability prop 으로 create/edit 분기를 처리하는 공유 폼 컴포넌트다. 편집 시 비밀값 미노출(`showPassword=false`)·type 변경 차단(`typeDisabled=true`) 이 spec R-2 의 핵심 invariant 임에도 컴포넌트 단독 단위 테스트가 없다. `showPassword=false` 일 때 password 필드가 DOM 에 존재하지 않음을 직접 어설션하는 케이스가 없다.
  - 제안: `auth-config-form-fields.test.tsx` 추가. 최소 케이스: (1) `showPassword=false` → password 입력 미렌더, (2) `typeDisabled=true` → type select disabled, (3) `showTypeLockedHint=true` → hint 텍스트 렌더.

- **[INFO]** `usage-drawer.test.tsx` mock 응답 구조가 `authentication-form.test.tsx` 와 불일치
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx` L95–98
  - 상세: `usage-drawer.test.tsx` 는 getMock 이 `/auth-configs` 에 대해 `{ data: [CONFIG] }` 를 반환하나, `authentication-form.test.tsx` L66 에서는 동일 URL 에 `{ data: { data: [] } }` 구조를 사용한다. 두 테스트가 서로 다른 응답 구조를 mock 하고 있어, 실제 apiClient 계층의 응답 구조가 어느 쪽인지 불명확하다. `{ data: { data: [...] } }` 가 실제 구조라면 `usage-drawer.test.tsx` 의 mock 은 실제 파싱 경로를 검증하지 못하는 false-positive 가 될 수 있다.
  - 제안: 두 테스트 파일의 getMock 반환 구조를 통일하거나, apiClient 응답 파싱 경로(`response.data.data` vs `response.data`)를 확인해 mock 구조를 실제와 일치시킨다.

- **[INFO]** `useAuthConfigForm` 에서 `mode=null` 상태의 `setGeneratedKey` 후 `close()` 경로 미검증
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx`
  - 상세: regenerate 완료 후 `form.mode===null` 상태에서 `setGeneratedKey(secret)` 가 호출되는 경로가 핵심 invariant 로 문서화되어 있으나, `use-auth-config-form.test.tsx` 는 이 케이스를 검증하지 않는다. 현재 L71 에서는 `openEdit → setGeneratedKey → close` 순서만 테스트한다.
  - 제안: `mode=null` 상태에서 `setGeneratedKey("secret")` 호출 후 값 확인 및 `close()` 시 null 복귀 케이스를 추가한다.

- **[INFO]** `pickPlaintextSecret` 테스트에서 빈 문자열 값 경계 케이스 미포함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/__tests__/auth-config-types.test.ts` L9–36
  - 상세: `pickPlaintextSecret({ key: "" })` 처럼 필드가 존재하되 빈 문자열인 경우의 동작(`""` 반환 vs null 반환)을 테스트하지 않는다. API 가 빈 secret 을 반환할 가능성은 낮지만 경계값이다. 현재 구현은 `typeof v === "string"` 체크만 하므로 `""` 를 반환한다.
  - 제안: `pickPlaintextSecret({ key: "" })` 케이스를 추가하거나, 빈 문자열을 null 로 처리해야 하는지 요구사항을 명확히 한다.

- **[INFO]** `validateAuthConfigForm` 에 name 빈값 케이스 단위 테스트 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/__tests__/auth-config-form.test.ts` L221–259
  - 상세: `validateAuthConfigForm` 테스트는 header 이름·IP 검증 케이스만 다루며, name 빈값 검증을 직접 어설션하지 않는다. name 검증이 `validateAuthConfigForm` 내에서 이루어지지 않고 `validateAndProceed` 에서만 이루어진다면 함수 책임 분리가 명확하지 않다.
  - 제안: `validateAuthConfigForm(state({ name: "" }))` 케이스를 추가하거나 name 검증이 어느 레이어에 있는지 주석으로 명확히 한다.

### 요약

이번 God Component 분리 리팩터링은 `pickPlaintextSecret` 순수 함수·`useAuthConfigForm` 훅·form 유틸리티(auth-config-form.ts)·30초 autoclear·usage drawer 에 대해 체계적인 단위·통합 테스트를 갖추고 있으며 분리 전과 동등한 커버리지를 유지한다. 그러나 신규 추출된 UI 컴포넌트 3개(`AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`)에 대한 직접 단위 테스트가 부재해, 이 컴포넌트들이 담당하는 보안 invariant prop(`showPassword=false`, `typeDisabled=true`)이 컴포넌트 경계에서 올바르게 동작함을 격리 검증할 수 없다. 현재 page.tsx 통합 테스트가 대부분의 동작을 간접 커버하지만, 컴포넌트 분리의 이점(독립 테스트 가능성)이 테스트 구조에 반영되지 않은 상태다. 또한 `usage-drawer.test.tsx` 와 `authentication-form.test.tsx` 간 mock 응답 구조 불일치는 어느 한쪽이 실제 API 파싱 경로와 다른 구조를 검증할 가능성을 시사한다.

### 위험도

MEDIUM

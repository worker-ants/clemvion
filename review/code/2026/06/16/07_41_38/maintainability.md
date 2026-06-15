### 발견사항

- **[WARNING]** `page.tsx` 컴포넌트가 여전히 과도한 책임을 보유함
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` (전체 745줄)
  - 상세: God Component 분리로 form 상태 관련 useState 11개를 훅으로 이전한 것은 개선이나, page.tsx 자체는 여전히 745줄이다. useMutation 6개 정의(create/update/toggle/regenerate/delete/reveal), confirm 다이얼로그 4개(regenerate/reveal/revealedSecret/delete)의 인라인 JSX, usage drawer, 테이블 렌더링까지 단일 컴포넌트에 공존한다. 이번 리팩터링에서 form 다이얼로그(AuthConfigCreateForm, AuthConfigEditDialog)만 추출됐고 나머지 인라인 다이얼로그들(regenerate confirm, reveal confirm, revealedSecret display, delete confirm)은 여전히 page.tsx 본문 안에 남아있어 단일 책임 원칙을 부분 이행에 그친다.
  - 제안: regenerate confirm, reveal confirm, delete confirm, revealedSecret display 도 별도 컴포넌트로 추출하거나, 최소한 mutation 정의를 전용 훅(`useAuthConfigMutations`)으로 분리해 page.tsx 의 책임을 레이아웃·조합만으로 줄이는 것을 후속 PR 에서 검토한다.

- **[WARNING]** `page.tsx` line 263 — "Add Auth Method" 버튼에 `isAdmin` 가드 없음 (패턴 비일관성)
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L263 (`<Button onClick={form.openCreate}>`)
  - 상세: Reveal 버튼(L519 `{isAdmin && ...}`)·Edit 버튼(L529 `{isAdmin && ...}`)에는 isAdmin 가드가 있으나, "Add Auth Method" 생성 버튼·Regenerate 버튼(L541)·Delete 버튼(L549)에는 가드가 없다. 같은 파일 안에서 RBAC 가드 적용 패턴이 일관되지 않아 향후 버튼 추가 시 실수 유발 가능성이 높다.
  - 제안: `{isAdmin && <Button onClick={form.openCreate}>...</Button>}` 패턴으로 통일한다. Regenerate·Delete 버튼도 동일 패턴 적용.

- **[INFO]** `use-auth-config-form.ts` — `close()` 의 수동 필드 열거 초기화 방식
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` L83–95
  - 상세: `close()` 함수가 8개 필드를 명시적으로 나열하여 리셋한다. 훅 주석이 "close 가 초기화 담당" 설계를 명시하고 있어 의도는 명확하나, 폼에 새 필드가 추가될 때 `close()` 내 리셋을 빠뜨리면 상태 오염이 발생할 위험이 있다.
  - 제안: 초기값 객체 상수를 정의하고 `close()` 에서 일괄 리셋하는 패턴을 고려한다.

- **[INFO]** `use-auth-config-form.ts` — 9개 개별 setter가 인터페이스에 모두 노출됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` L34–51 (`UseAuthConfigForm` 인터페이스)
  - 상세: `setName`, `setType`, `setHmacHeader`, `setHmacAlgorithm`, `setApiKeyHeader`, `setIpWhitelist`, `setUsername`, `setPassword`, `setGeneratedKey` 등 9개의 개별 setter가 public 인터페이스로 노출된다. `AuthConfigFormFields` 컴포넌트가 `form` 객체를 통째로 받아 setter를 직접 호출하는 구조여서 폼 상태 변경 경로가 분산되어 있다.
  - 제안: 현 단계에서는 React 관용 패턴으로 허용 가능하다. 필드 수가 더 늘어나면 react-hook-form 등 도입을 검토한다.

- **[INFO]** `auth-config-form-fields.tsx` — `select` 엘리먼트의 인라인 Tailwind 클래스 중복
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx` L46–51, L86–93
  - 상세: `select` 엘리먼트가 `"flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"` 클래스를 두 곳에 복붙하고 있다. `Input` 처럼 재사용 가능한 `Select` UI 컴포넌트가 없어서 스타일이 분산된다.
  - 제안: 공용 `Select` UI 컴포넌트 도입 또는 클래스를 상수로 추출한다. 현 PR 범위 밖이므로 후속 개선 항목.

- **[INFO]** `page.tsx` — confirm 다이얼로그 4개의 backdrop+카드 구조 반복
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L287–422
  - 상세: regenerate confirm (L287), reveal confirm (L315), revealedSecret display (L361), delete confirm (L396) 네 블록이 모두 `fixed inset-0 z-50 flex items-center justify-center bg-black/50` backdrop 과 카드 컨테이너 패턴을 공유하나 각각 별도 JSX 블록으로 반복된다.
  - 제안: 공용 `ConfirmDialog` 컴포넌트 추출을 후속 PR 에서 검토한다.

### 요약

이번 변경(God Component → useAuthConfigForm 훅 + AuthConfigCreateForm/AuthConfigEditDialog/AuthConfigFormFields/auth-config-types.ts 추출)은 유지보수성을 명확하게 향상시킨다. 타입·상수·헬퍼 함수의 단일 SoT 구성, capability prop(typeDisabled/showPassword)을 통한 create/edit 역할의 선언적 분리, 폼 상태의 훅 통합 모두 긍정적이며 코드 의도가 이전보다 훨씬 명확해졌다. 주된 유지보수성 우려는 두 가지다. 첫째, `page.tsx` 자체가 여전히 745줄 규모로 mutation 6개·인라인 confirm 다이얼로그 4개·usage drawer·테이블을 한 파일에서 관리하며 God Component 분리가 form 흐름에만 적용된 점이다. 둘째, RBAC `isAdmin` 가드가 Reveal·Edit에만 적용되고 Add/Regenerate/Delete 버튼에는 빠져있어 같은 파일 안에서 패턴이 불일치하며, 새 버튼 추가 시 가드 누락 실수를 유발할 수 있다. 나머지 발견사항은 후속 개선 대상이거나 현재 규모에서 허용 가능한 수준이다.

### 위험도

LOW

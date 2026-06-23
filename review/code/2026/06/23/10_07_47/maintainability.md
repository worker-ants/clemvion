# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 6: create-web-chat-dialog.tsx

- **[WARNING]** `createMut` 변수명이 목적을 축약해 불명확
  - 위치: line 1383 `const createMut = useCreateWebChat();`
  - 상세: `createMut`은 `createMutation` 또는 `createWebChatMutation`으로 써야 의도가 더 명확하다. 같은 파일에서 `workflows`(풀네임)와 병치될 때 일관성이 떨어진다.
  - 제안: `const createWebChatMutation = useCreateWebChat();`

- **[WARNING]** 타입 단언이 누락된 반환 타입으로 인해 캐스팅 필요
  - 위치: line 1398 `const id = (created as { id?: string } | undefined)?.id;`
  - 상세: `useCreateWebChat`의 `mutationFn`이 `return data`로 `unknown`에 가까운 타입을 반환하기 때문에 호출측에서 `as { id?: string }` 캐스팅이 강제된다. 반환 타입을 명시하면 이 캐스팅이 불필요해진다.
  - 제안: `use-web-chat.ts`의 `mutationFn` 반환 타입을 `Promise<{ id: string }>` 등으로 구체화.

### 파일 11: use-web-chat.ts

- **[WARNING]** `limit: 100` 매직 넘버가 두 곳에 반복 하드코딩
  - 위치: line 2216 `params: { type: "webhook", limit: 100 }`, line 2246 `params: { limit: 100 }`
  - 상세: 페이지 제한값 100이 `useWebChatInstances`와 `useWorkflowOptions` 두 곳에 별도로 하드코딩되어 있다. 규모가 커질 경우 각각 별도로 수정해야 한다.
  - 제안: `const MAX_LIST_LIMIT = 100;` 상수로 추출하거나, 공통 API params 상수로 관리.

- **[INFO]** `useWorkflowOptions`의 응답 정규화 로직이 다른 훅과 패턴 불일치
  - 위치: line 2247 `const list = (res.data?.data ?? res.data ?? []) as Array<...>;`
  - 상세: `useWebChatInstances`는 `normalizePagedResponse`를 사용하지만 `useWorkflowOptions`는 `res.data?.data ?? res.data ?? []` 인라인 패턴을 쓴다. 코드베이스에 이미 `normalizePagedResponse` 추상화가 있으므로 일관성이 깨진다.
  - 제안: `useWorkflowOptions`도 `normalizePagedResponse`를 사용하거나, 동일한 인라인 패턴을 유지한다면 이유를 주석으로 남긴다.

- **[INFO]** `useCreateWebChat`에서 `onSuccess` 내 `void` 처리 패턴
  - 위치: line 2271 `void queryClient.invalidateQueries(...)`
  - 상세: `void` 처리 자체는 올바르나, 코드베이스 내 다른 mutation 핸들러가 일관되게 사용하는지 검토가 필요하다. 이 패턴이 일관성 있게 사용된다면 INFO 수준이다.
  - 제안: 코드베이스 전반의 `onSuccess` 패턴과 일치시킨다.

### 파일 10: use-appearance-draft.ts

- **[WARNING]** 렌더 중 `setState` 호출 패턴이 미래 유지보수자에게 혼란 유발 가능
  - 위치: lines 2023–2027
  ```
  const [loadedId, setLoadedId] = useState(instanceId);
  if (loadedId !== instanceId) {
    setLoadedId(instanceId);
    setDraftState(readDraft(instanceId));
  }
  ```
  - 상세: React의 "storing information from previous renders" 패턴을 정확히 구현했고 주석도 있지만, 이 패턴은 `key` prop 리마운트 대안보다 코드 이해 비용이 높다. 실제로 `WebChatDetail`에 이미 `key={selected.id}`가 붙어 있으므로(`page.tsx` line 440), `useAppearanceDraft`가 인스턴스 ID 변경을 스스로 감지하는 복잡도가 중복될 수 있다. 두 방어 레이어가 모두 필요한지 검토 주석이 없어 유지보수 시 혼란 가능.
  - 제안: `key` 기반 리마운트로 충분하다면 `useAppearanceDraft` 내 ID 감지 로직을 제거해 단순화. 혹은 두 레이어가 모두 필요한 이유를 주석으로 명시.

- **[INFO]** `KEY_PREFIX` 상수가 모듈 최상단에 있으나 export 되지 않아 테스트에서 localStorage 키를 직접 확인하기 어려움
  - 위치: line 2005 `const KEY_PREFIX = "clemvion:web-chat:appearance:";`
  - 상세: 테스트에서 localStorage 직접 검증이 필요할 경우 키를 hardcode해야 한다.
  - 제안: `export const APPEARANCE_DRAFT_KEY_PREFIX = "clemvion:web-chat:appearance:";`로 export 추가.

### 파일 20: snippet.ts

- **[INFO]** `buildBootConfig` 함수 내 필드 추가 패턴이 혼재
  - 위치: lines 3665–3678
  - 상세: `appearance`, `welcome`, `launcher`는 사전 계산 후 `config`에 추가하고, `headerTitle`과 `disclaimer`는 함수 중간에 인라인으로 clean/추가한다. 패턴이 일관되지 않아 유사한 필드를 나중에 추가할 때 어떤 방식을 따라야 할지 불명확하다.
  - 제안: 모든 선택 필드를 동일한 패턴(사전 계산 또는 인라인)으로 통일.

- **[INFO]** `cleanString` 함수의 내부 변수 `t`가 의미 없는 단일 문자명
  - 위치: line 3627 `const t = v?.trim();`
  - 상세: `trimmed`로 쓰면 의도가 명확하다.
  - 제안: `const trimmed = v?.trim(); return trimmed || undefined;`

### 파일 5: appearance-builder.tsx

- **[INFO]** `textarea`가 프로젝트 UI 컴포넌트(`Input`, `NativeSelect`) 없이 raw HTML 태그로 직접 사용
  - 위치: lines 1185–1190
  - 상세: 다른 입력 필드는 `@/components/ui/Input`을 사용하는데, `suggestions` 필드만 raw `<textarea>`를 사용한다. 공통 스타일 토큰(`border-[hsl(var(--input))]` 등)을 수동으로 복사해 붙여놓아 추후 디자인 시스템 변경 시 이 컴포넌트만 누락될 수 있다.
  - 제안: `@/components/ui/Textarea` 컴포넌트가 있다면 사용. 없다면 textarea 전용 UI 컴포넌트를 추가하거나, 일관성 이유를 주석으로 남긴다.

### 파일 2: page.tsx

- **[INFO]** `createButton` JSX 변수가 두 곳(header, EmptyState)에서 재사용되어 ref 동일성 문제 가능
  - 위치: lines 384–391, 413, 417
  - 상세: JSX를 변수로 공유하는 것은 `key` 없이 두 위치에 동일 React 요소가 렌더되어 reconciliation 문제가 발생할 수 있다. 실제로 두 위치가 동시에 렌더되지는 않지만(`!isLoading && instances.length === 0`이 `true`일 때만 EmptyState 렌더), 로딩 중 헤더에는 보이는 상황이 있어 조건이 겹치는 경우가 생길 수 있다.
  - 제안: `createButton`을 변수 대신 컴포넌트 함수나 인라인 JSX로 분리, 또는 두 위치의 렌더 조건을 명확하게 주석으로 설명.

### 파일 1: web-chat-page.test.tsx

- **[INFO]** `fireEvent`가 import되었으나 테스트에서 사용되지 않음
  - 위치: line 57 `import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";`
  - 상세: 미사용 import는 코드 노이즈로 어떤 테스트가 실제로 사용자 상호작용을 테스트하는지 혼동을 준다.
  - 제안: `fireEvent` import 제거.

- **[INFO]** `beforeEach`에서 `cleanup()`을 수동 호출
  - 위치: line 144
  - 상세: `@testing-library/react`는 vitest + jsdom 환경에서 afterEach에 자동 cleanup을 등록한다. `beforeEach`에서의 수동 `cleanup()`은 불필요한 중복일 수 있으며, 추후 설정 변경 시 혼란을 줄 수 있다.
  - 제안: vitest setup에서 `@testing-library/react/pure` 사용 여부 확인 후, 자동 cleanup 설정이 되어 있다면 수동 `cleanup()` 제거.

---

## 요약

전체적으로 코드 구조와 책임 분리가 명확하며, 의도를 설명하는 주석이 적절히 제공된다. 신규 `web-chat` 도메인이 기존 컴포넌트·훅·i18n 패턴을 일관되게 따르고 있어 코드베이스 통합도가 높다. 주요 유지보수성 위험은 세 가지다: `use-web-chat.ts`의 `limit: 100` 매직 넘버 중복과 응답 정규화 패턴 불일치, `create-web-chat-dialog.tsx`에서 `mutationFn` 반환 타입 미명시로 인한 강제 캐스팅, `appearance-builder.tsx`에서 raw `<textarea>` 사용으로 인한 디자인 시스템 드리프트 위험. `use-appearance-draft.ts`의 렌더 중 setState 패턴은 React 권장 패턴이지만 `key` 리마운트와 중복될 수 있어 명시적 주석 또는 단순화가 필요하다.

## 위험도

LOW

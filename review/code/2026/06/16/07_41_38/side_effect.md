### 발견사항

- **[WARNING]** "Add Auth Method" 버튼 — isAdmin 가드 누락으로 모든 역할에 `openCreate` 노출
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 263
  - 상세: `<Button onClick={form.openCreate}>` 가 `isAdmin` 조건 없이 렌더된다. Reveal·Edit 버튼(line 518–539)은 `{isAdmin && ...}` 가드로 감싸져 있으나 "Add Auth Method" 버튼만 빠졌다. Editor/Viewer 역할 사용자가 버튼을 클릭하면 `openCreate` 가 `useAuthConfigForm.mode` 를 `"create"` 로 전환하고 `AuthConfigCreateForm` 이 렌더된다. 제출 시 백엔드 `@Roles('admin')` 에서 403 이 반환된다. 이는 God Component 분리로 `openCreate` 가 독립 핸들러(`UseAuthConfigForm` 인터페이스의 공개 메서드)로 분리됨에 따라 부작용 가시화된 시그니처 노출이다.
  - 제안: `<Button onClick={form.openCreate}>...</Button>` 를 `{isAdmin && <Button onClick={form.openCreate}>...</Button>}` 로 감싸 Reveal·Edit 와 동일 패턴 적용.

- **[WARNING]** Regenerate 버튼 — isAdmin 가드 누락 (pre-existing, 이번 diff 이전부터 존재)
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 540–548
  - 상세: Regenerate 버튼(`onClick={() => setRegenerateTarget(config.id)}`)이 `isAdmin` 없이 모든 역할에 노출된다. 이번 diff 는 해당 코드를 변경하지 않았으나, God Component 분리 리팩터링으로 page.tsx 가 재구조화됨에 따라 이 누락이 명시적으로 드러난다. 백엔드가 차단하더라도 Editor/Viewer 가 버튼을 볼 수 있어 403 혼란이 발생한다.
  - 제안: Regenerate 버튼 래퍼에 `{isAdmin && (...)}` 가드 추가.

- **[INFO]** `pickPlaintextSecret` — 로컬 함수에서 export 함수로 승격
  - 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` line 58
  - 상세: 이전에 `page.tsx` 내부 로컬 함수였던 `pickPlaintextSecret` 이 `auth-config-types.ts` 에서 `export` 로 공개됐다. 모듈 공개 범위가 확장됐으나 현재 `authentication/` 밖 사용처는 없다. 테스트 가능성이 향상되는 긍정적 변화이며 즉각적 부작용은 없다.
  - 제안: 별도 조치 불필요.

- **[INFO]** `UseAuthConfigForm` 인터페이스 — 공개 계약 신규 도입으로 3개 컴포넌트가 결합
  - 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` line 24–58
  - 상세: `UseAuthConfigForm` 인터페이스가 export 됨으로써 `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields` 세 컴포넌트가 이 계약에 의존한다. 기존 God Component 의 암묵적 내부 결합을 명시적 인터페이스로 대체한 개선이다. 향후 훅에서 상태를 추가/제거 시 세 컴포넌트 모두 영향을 받는다는 의도된 시그니처 결합이다.
  - 제안: 별도 조치 불필요. 시그니처 변경 시 세 컴포넌트를 함께 수정해야 한다는 점 유의.

- **[INFO]** `regenerateMutation.onSuccess` — `form.setGeneratedKey` 호출 시 `form.mode === null`
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 194–196
  - 상세: regenerate 완료 후 `form.setGeneratedKey(secret)` 를 호출하지만 이 시점 `form.mode` 는 null(다이얼로그 닫힘)이다. `AuthConfigCreateForm` 은 `form.mode === "create"` 일 때만 렌더되므로 `generatedKey` 가 설정되더라도 UI 에 표시되지 않는다. 이는 기존 `page.tsx` 에서도 동일한 동작이었으므로 이번 변경이 도입한 회귀가 아니다.
  - 제안: 별도 조치 불필요. regenerate 후 key 표시 UX 를 개선하려면 별도 후속 작업 필요.

- **[INFO]** `openCreate` — 초기화 없이 mode 만 전환하는 의도적 설계
  - 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` line 97–99
  - 상세: `openCreate()` 는 `setMode("create")` 만 수행하며 폼 상태를 초기화하지 않는다. 초기화는 `close()` 가 담당하는 설계(코드 주석으로 명시). `openEdit()` 는 내부에서 모든 상태를 완전히 덮어쓰므로 `openCreate()` → `openEdit()` 순으로 호출돼도 오염이 없다. 의도된 부작용이다.
  - 제안: 별도 조치 불필요. 주석이 이미 설계 의도를 명시하고 있다.

### 요약

이번 변경은 `authentication/page.tsx` God Component 를 `useAuthConfigForm` 훅·`AuthConfigCreateForm`·`AuthConfigEditDialog`·`AuthConfigFormFields`·`auth-config-types.ts` 로 분리한 순수 구조 리팩터링이다. 전역 변수 도입, 파일시스템 부작용, 의도치 않은 네트워크 호출, 이벤트 바인딩 변경은 없다. `pickPlaintextSecret` export 승격과 `UseAuthConfigForm` 인터페이스 공개는 의도된 설계 개선으로 즉각적 부작용이 없다. 핵심 부작용 리스크는 "Add Auth Method" 버튼의 `isAdmin` 가드 누락으로, Editor/Viewer 역할이 create 폼을 열 수 있어 백엔드 403 혼란을 유발한다. Regenerate 버튼의 동일한 누락은 pre-existing 이슈다. 나머지 발견사항은 모두 설계 의도 범위 내에 있다.

### 위험도

MEDIUM

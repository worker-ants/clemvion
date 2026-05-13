### 발견사항

---

#### 중복 코드

- **[WARNING]** `axiosMessage` 함수가 3곳에 복사되어 있음
  - 위치: `change-password/page.tsx:25-30`, `profile-info-card.tsx:38-43`, `profile-preferences-card.tsx:29-34`
  - 상세: 완전히 동일한 구현이 세 파일에 존재. 한 곳만 수정해도 나머지 두 곳은 방치되는 전형적인 DRY 위반
  - 제안: `@/lib/api/utils` 또는 `@/lib/errors` 같은 공유 모듈로 추출

---

#### 타입 선언 위치

- **[WARNING]** `type FormValues`가 컴포넌트 함수 본문 안에 선언되어 있음
  - 위치: `change-password/page.tsx` — `ChangePasswordPageInner` 내부 `const schema = useMemo(...)` 아래
  - 상세: TypeScript 타입은 런타임에 지워지므로 동작에는 문제가 없지만, 타입이 훅 내부에 묻혀 있어 외부에서 재사용하거나 찾기 어렵고 관례를 벗어남
  - 제안: `schema` 정의를 컴포넌트 밖으로 꺼내거나(i18n 의존이 없는 기본 스키마 구조만 분리), 최소한 `type FormValues`는 모듈 상단으로 이동

---

#### 테스트의 취약한 버튼 선택

- **[WARNING]** 인덱스 기반 버튼 탐색이 두 테스트 파일에 존재
  - 위치: `profile-info-card.test.tsx:98`, `profile-preferences-card.test.tsx:113`
  - 상세: `screen.getAllByRole("button", { name: /저장|save/i })[1]` — DOM 순서에 의존. ConfirmDiffDialog와 카드의 버튼 배치가 바뀌면 `[1]`이 엉뚱한 버튼을 가리킴. `??` 폴백도 이 취약성을 가리는 방어 코드
  - 제안: ConfirmDiffDialog의 저장 버튼에 `data-testid="confirm-diff-save"`를 추가하고 `getByTestId`로 명확하게 선택

---

#### useMemo에서 ESLint 억제

- **[WARNING]** `profile-preferences-card.tsx`의 `diff` useMemo에 `// eslint-disable-next-line react-hooks/exhaustive-deps` 존재
  - 위치: `profile-preferences-card.tsx:132`
  - 상세: `themeLabel`과 `localeLabel`이 매 렌더마다 새로 생성되는 인라인 함수이므로 deps에 포함하면 useMemo가 무용해지는 딜레마를 ESLint 억제로 회피. 규칙을 끄면 deps 누락 오류를 나중에 조용히 놓칠 수 있음
  - 제안: `themeLabel`/`localeLabel`을 컴포넌트 외부 순수 함수로 추출하거나 `useCallback`으로 안정화하면 ESLint 억제 없이 해결됨

---

#### 테스트 폼 입력 반복

- **[INFO]** `change-password.test.tsx`에서 같은 `fireEvent.change` 호출 패턴이 3개 테스트에 반복됨
  - 위치: `change-password.test.tsx:46-55`, `68-77`, `87-96`
  - 상세: 현재 파일 크기에서는 허용 범위이지만 필드가 늘어나면 유지비가 상승
  - 제안: `fillForm(currentPw, newPw, confirmPw)` 같은 헬퍼로 한 번만 정의

---

#### 미사용 import

- **[INFO]** `import type React from "react"`가 `profile-info-card.test.tsx`에 있으나 파일 내에서 직접 참조되지 않음
  - 위치: `profile-info-card.test.tsx:4`
  - 제안: 제거

---

#### `patch.theme` 진실값 검사

- **[INFO]** `profile-preferences-card.tsx`의 `onSuccess`에서 `if (patch.theme)`와 `if (patch.locale)` 로 키 존재를 확인
  - 위치: `profile-preferences-card.tsx:67-68`
  - 상세: `"light"`, `"dark"`, `"ko"`, `"en"` 값은 모두 truthy여서 실제 버그는 없지만, 의도는 "키가 포함되어 있는가"이므로 `'theme' in patch` 가 의미를 더 정확히 표현
  - 제안: `if ('theme' in patch) setThemeStore(patch.theme!)` 패턴 사용

---

### 요약

전체적으로 컴포넌트 분리(InfoCard · PreferencesCard · ConfirmDiffDialog · ChangePasswordPage)와 readonly-first 패턴 적용은 유지보수성 측면에서 이전 단일 page.tsx 대비 크게 개선된 구조다. 그러나 `axiosMessage` 유틸이 세 파일에 그대로 복사된 것이 가장 분명한 유지보수 부채이며, 이 함수의 동작이 바뀌어야 할 때 세 곳을 모두 찾아야 한다. 테스트에서 인덱스 기반 버튼 선택과 ESLint 억제 주석도 시간이 지나면 조용한 오류로 이어질 수 있으므로 함께 정비하면 코드 베이스의 안정성이 한 단계 높아진다.

### 위험도

**LOW**
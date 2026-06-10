# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx`

- **[INFO]** `kb && kb.embeddingDimension == null` 이중 조건 — 단순화 가능
  - 위치: 라인 628 (`{kb && kb.embeddingDimension == null && (`)
  - 상세: 이미 JSX 내부에서 `kb` 존재 여부를 전제하는 다른 블록들이 동일 패턴(`{kb && ...}`)으로 반복된다. 이 자체는 페이지 수준 패턴이므로 허용 범위이나, `kb.embeddingDimension == null`를 `!kb.embeddingDimension`으로 쓰지 않고 `== null`를 선택한 것은 `0`(유효한 dimension)을 falsy 처리하지 않으려는 의도적 선택이다. 주석이나 린트 suppress 없이도 의도가 충분히 전달된다.
  - 제안: 현행 유지 적절. 단, 파일 내 다른 동일 패턴(`kb?.embeddingDimension != null` in 라인 619)과 형태가 혼재(`!=` vs `==`)한다 — 일관성을 위해 둘 중 하나로 통일하는 것을 고려할 수 있다.

- **[INFO]** 대형 단일 컴포넌트 함수 — 기존 설계 범위
  - 위치: `KnowledgeBaseDetailPage` 전체 (약 500+ 라인)
  - 상세: 이번 변경(+10줄 import + 배너 블록)은 이 기존 패턴 안에 자연스럽게 삽입되었다. 배너를 별도 컴포넌트(`UnsearchableBanner`)로 분리한 설계 덕분에 페이지 파일의 복잡도 증가는 최소화되었다.
  - 제안: 신규 추가 부분 자체의 크기는 적절하다. 대형 컴포넌트 분리는 별도 리팩토링 범위로 다루어야 하며 이번 PR 범위 밖이다.

---

### 파일 2: `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx`

- **[INFO]** 하드코딩된 영문 텍스트 assertion
  - 위치: 라인 1106, 1122, 1136, 1138 (`screen.getByText("Re-embedding required · not searchable")` 등)
  - 상세: 테스트가 `beforeEach`에서 `useLocaleStore.setState({ locale: "en" })`로 영문 로케일을 명시 설정하므로 영문 문자열을 직접 사용하는 것은 의도적이고 일관된 패턴이다. 테스트 설정과 assertion이 명확히 대응된다.
  - 제안: 현행 유지 적절.

- **[INFO]** `setRole` 헬퍼 함수 스코프
  - 위치: 라인 1081–1089
  - 상세: `setRole`은 파일 최상단 describe 블록 밖에 선언되어 있다. 테스트 파일 전역에서 쓰이는 단일 헬퍼이므로 현재 위치가 자연스럽다. 코드베이스 내 유사 테스트 파일들의 패턴과 일치한다.
  - 제안: 현행 유지 적절.

- **[INFO]** 4개 테스트 케이스의 커버리지 범위
  - 위치: 전체 describe 블록
  - 상세: idle+editor CTA / idle+viewer 텍스트만 / in_progress / X 버튼 없음 — 4종은 컴포넌트의 모든 분기를 충분히 커버한다. `pending=true` 상태(버튼 disabled + 스피너 아이콘)에 대한 명시 케이스는 없으나, 이는 presentational 상태이며 RoleGate 테스트와 기존 Button 컴포넌트 테스트에서 이미 커버된다.
  - 제안: 현행 유지 적절. `pending` prop 케이스를 추가하면 더 완전하지만 필수 수준은 아니다.

---

### 파일 3: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`

- **[INFO]** `inProgress` 파생 변수 — 가독성 양호
  - 위치: 라인 29
  - 상세: `const inProgress = reembedStatus === "in_progress"`는 JSX 내 반복 조건을 단순화한다. 컴포넌트 전체에서 4회 사용되므로 추출 효과가 명확하다.
  - 제안: 현행 유지 적절.

- **[INFO]** 인라인 Tailwind 클래스 문자열 길이
  - 위치: 라인 35–38
  - 상세: `inProgress` 분기의 테마 클래스 문자열 두 개(`border-[hsl(...)]...`)가 상당히 길다. 현재 코드베이스 전반에서 동일 패턴(인라인 HSL 테마 클래스)이 표준으로 사용되므로 일관성 측면에서 문제없다. 다만 두 분기 클래스를 객체 map으로 표현하면 가독성이 개선될 수 있다.
  - 제안: 선택적 개선. 예시:
    ```ts
    const variantClass = inProgress
      ? "border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
      : "border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]";
    ```
    현재 구조는 이미 이 패턴이므로 실질적 변경 불필요.

- **[INFO]** `Props` 인터페이스 네이밍
  - 위치: 라인 8
  - 상세: `Props`라는 이름은 generic하지만, 이 파일이 단일 export 컴포넌트인 경우 코드베이스 내 표준 패턴과 일치한다. `UnsearchableBannerProps`로 명명하면 외부 re-export 시 명확해지나, 현재 파일이 단일 컴포넌트이므로 문제없다.
  - 제안: 현행 유지 적절.

- **[INFO]** JSDoc 주석 품질 — 우수
  - 위치: 라인 17–26
  - 상세: spec 참조(`§2.4.1·R-3`), 비즈니스 로직 근거(`409 거부`), 접근성 설계 의도(`auto-dismiss`)를 모두 기재한 점이 유지보수성을 높인다.
  - 제안: 현행 유지.

---

### 파일 4 & 5: i18n 딕셔너리 (en/ko)

- **[INFO]** en/ko 키 동기 — 완전 일치
  - 위치: 두 파일 모두 `reembedNow`, `unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc` 추가
  - 상세: 두 로케일 파일에 동일한 3개 키가 동시에 추가되어 parity가 유지된다. 테스트에서 i18n parity 체크가 포함되어 있음이 plan에서 확인된다.
  - 제안: 현행 유지 적절.

- **[INFO]** 기존 키와의 네이밍 일관성
  - 위치: `reembedNow` vs 기존 `kbReembedAll`, `reembedStarted`, `reembedTooltip`
  - 상세: 기존 키는 `reembed`(소문자 연속) 형태를 사용하는데, 신규 키 `reembedNow`도 동일 패턴을 따른다. `kbReembedAll`은 KB 수준 액션 prefix `kb`를 붙이는 반면 `reembedNow`는 컴포넌트 레벨 CTA라 prefix 없이 사용한 것은 의도적이고 합리적이다.
  - 제안: 현행 유지 적절.

---

### 파일 6: `plan/in-progress/kb-model-change-reembed-followup.md`

- **[INFO]** 구현 내용: 리뷰 대상 외
  - 위치: 전체 파일
  - 상세: 태스크 추적 문서로 코드 유지보수성 관점의 지적 대상이 아니다.

---

## 요약

이번 변경은 `UnsearchableBanner` 컴포넌트를 명확한 단일 책임(presentational 배너)으로 분리하고, props 계약·JSDoc·타입 정의가 모두 완비된 상태로 추가되었다. 새 컴포넌트는 76줄로 간결하며, 복잡도 분기(idle/in_progress, role gate)가 명확한 지역 변수(`inProgress`)와 조건부 렌더링으로 표현되어 가독성이 높다. `page.tsx` 배선은 기존 패턴을 그대로 따르고 새 코드를 최소한으로 삽입하였다. i18n 키는 en/ko 동기가 유지되고 기존 네이밍 컨벤션과 일치한다. 전반적으로 유지보수성 관점에서 지적할 Critical 또는 Warning 수준의 문제가 없는 깔끔한 구현이다.

## 위험도

NONE

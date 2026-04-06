## 발견사항

- **[WARNING]** 암묵적 Continue 버튼 자동 추가
  - 위치: `hasOnlyLinkButtons` 로직 (line 73), JSX render (lines 141–150)
  - 상세: 링크 타입 버튼만 있을 경우 `Continue` 버튼을 자동으로 추가하는 로직이 포함되어 있음. 이 동작이 스펙에 명시되어 있지 않다면 범위 초과 기능에 해당함. 또한 `buttons`가 비어 있을 경우 `every()`는 `true`를 반환하므로, 버튼이 없는 상태에서도 Continue 버튼이 표시될 수 있음.
  - 제안: 스펙에 해당 동작이 정의되어 있는지 확인. 없다면 이 로직을 제거하거나 props로 명시적 제어를 위임할 것.

- **[WARNING]** `useEffect` dependency에 `remaining` 포함으로 인한 매초 interval 재생성
  - 위치: `useEffect` (lines 58–68), deps: `[remaining, clicked]`
  - 상세: `remaining`이 deps에 포함되어 있어 카운트다운이 진행될 때마다 이전 interval을 clear하고 새 interval을 생성함. 기능은 동작하지만 불필요한 재등록이 반복됨. 이는 scope 문제가 아니라 구현 버그이지만, 신규 파일 내에서 발생하므로 기록함.
  - 제안: deps를 `[]`로 변경하고 초기 `timeout` 값을 ref로 캡처하여 단일 interval 또는 setTimeout 재귀 패턴으로 교체.

- **[INFO]** 클릭 후 타임스탬프 표시
  - 위치: clicked state render (lines 92–100)
  - 상세: 버튼 클릭 후 클릭 시각(`toLocaleTimeString()`)을 표시함. 스펙에 정의된 UX 동작인지 확인이 필요한 추가 디테일.
  - 제안: 스펙 확인 후 불필요하다면 제거.

- **[INFO]** `Button` 컴포넌트와 `<button>` 혼용
  - 위치: lines 124–138 (`<button>`), lines 140–150 (`<Button>`)
  - 상세: 일반 버튼은 raw `<button>` 태그, Continue 버튼은 UI 컴포넌트 `Button`을 사용해 일관성이 없음. 스타일 컨트롤 의도가 있는 것으로 보이나 범위 내 의도적 선택인지 확인 필요.
  - 제안: 일관성 확보를 위해 스타일 props를 통해 동일 컴포넌트 사용 고려.

---

## 요약

`button-bar.tsx`는 신규 파일로, 전반적으로 프레젠테이션 노드 버튼 기능의 목적에 부합하는 구현임. 그러나 링크 전용 버튼 구성 시 암묵적으로 Continue 버튼을 추가하는 `hasOnlyLinkButtons` 로직이 스펙에 명시되지 않은 동작일 경우 범위 초과에 해당하며, 이를 검증이 필요한 주요 항목으로 식별함. `useEffect` dependency 문제는 구현 버그로 신규 코드 내에서 처음 도입된 결함임.

## 위험도

**LOW** — 기능 동작에는 이상 없으나, 암묵적 Continue 버튼과 interval 재생성 버그는 사전 검토 권장.
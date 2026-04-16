## 동시성 코드 리뷰

### 발견사항

- **[INFO]** `CollapsibleSection`의 토글 상태 업데이트 패턴
  - 위치: `schema-form.tsx` — `CollapsibleSection` 컴포넌트
  - 상세: `onClick={() => setExpanded(!expanded)}` 는 클로저를 통해 현재 `expanded` 값을 캡처합니다. React 18 Concurrent Mode에서 배치 업데이트가 발생할 경우, 이미 오래된(stale) 값을 기반으로 토글할 수 있습니다.
  - 제안: 함수형 업데이트 패턴 사용
    ```tsx
    onClick={() => setExpanded(prev => !prev)}
    ```

- **[INFO]** 배열 업데이트 핸들러의 Stale Closure
  - 위치: `widgets.tsx` — `FieldArrayWidget` (`add`, `remove`, `update`), `button-list-editor.tsx` — `moveButton`, `table-grid-widget.tsx` — `emit`
  - 상세: 각 핸들러가 props로 받은 `items` / `buttons` / `data`를 클로저로 캡처합니다. 동일 렌더 사이클 내에서 여러 핸들러가 연속 호출되면(예: `remove` → `update` 빠른 연속 클릭), 두 번째 호출이 첫 번째 변경 이전의 오래된 배열을 기반으로 동작할 수 있습니다. 실제로 UI 상호작용은 단발성이므로 영향 범위는 제한적입니다.
  - 제안: 부모 컴포넌트가 functional updater 패턴을 사용하는 경우 `onChange`를 `setState(prev => ...)` 형태로 연결하거나, 고빈도 연속 조작이 예상되는 경우 `useReducer`로 교체 검토

- **[INFO]** `clearFields` 로직에서 `delete` 사용
  - 위치: `schema-form.tsx` — `update` 함수
  - 상세: `const updated = { ...value, [key]: next }` 후 `delete updated[f]`를 실행합니다. 스프레드 복사 후의 돌연변이(mutation)이므로 원본 `value`를 훼손하지는 않아 안전합니다. 다만 불변성 관례를 일관되게 유지하려면 `delete` 보다 선언적 접근이 권장됩니다.
  - 제안:
    ```tsx
    const cleared = Object.fromEntries(
      Object.entries(updated).filter(([k]) => !ui.clearFields!.includes(k))
    );
    onChange(cleared);
    ```

---

### 요약

이번 변경 코드는 순수 UI 설정 폼 레이어(스키마 메타데이터, React 위젯 컴포넌트)로 구성되어 있으며, 멀티스레딩·공유 메모리·비동기 경쟁 조건 등 전통적 의미의 동시성 문제는 존재하지 않습니다. 주목할 사항은 React 18 Concurrent Mode 환경에서의 **Stale Closure 패턴**으로, 현재 구조(controlled component + props-driven)에서 실제 오류로 이어질 가능성은 낮지만, `setExpanded(!expanded)` 토글 패턴만큼은 `setExpanded(prev => !prev)`로 즉시 교정하는 것이 바람직합니다.

### 위험도

**LOW**
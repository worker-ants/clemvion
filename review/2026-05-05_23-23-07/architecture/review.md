### 발견사항

- **[INFO]** `cron-to-visual.ts` 유틸 분리 — 단일 책임 원칙 준수
  - 위치: `frontend/src/lib/utils/cron-to-visual.ts`
  - 상세: cron 파싱/빌드 로직을 독립 모듈로 분리한 것은 적절하다. `page.tsx`에 인라인으로 있던 `buildCronFromVisual`이 추출되어 순수 함수 단위로 테스트 가능해졌다.

- **[WARNING]** `SchedulesPage` 컴포넌트의 폼 상태가 과도하게 비대해지는 추세
  - 위치: `page.tsx:460–480` (form state 선언부)
  - 상세: `formName`, `formWorkflowId`, `formCron`, `formVisualState`, `formTimezone`, `formParameterValuesJson`, `parameterValuesError`, `cronTab`, `editTarget`, `showDialog`, `deleteTarget`, `viewMode` — 단일 컴포넌트에 12개의 상태가 집중되어 있다. 이번 PR에서 `formVisualState`가 하나 더 추가되었다. 다이얼로그 로직이 계속 `SchedulesPage` 안에서 성장하면 SRP 위반이 심화된다.
  - 제안: 다이얼로그 상태를 `useScheduleDialogForm()` 커스텀 훅으로 분리하거나, 다이얼로그를 별도 컴포넌트(`ScheduleFormDialog`)로 추출하는 것을 고려할 것. 현 PR 범위에서는 수용 가능하나 다음 기능 추가 전에 분리를 권장한다.

- **[WARNING]** `cronCannotRepresent` 계산이 렌더 사이클마다 `parseCronToVisualOrNull`를 재호출
  - 위치: `page.tsx:863–866`
  - 상세: `<VisualCronEditor cronCannotRepresent={formCron.trim() !== "" && parseCronToVisualOrNull(formCron) === null}>`에서 렌더마다 파서를 실행한다. `handleCronInputChange`에서 이미 파싱 결과가 있으므로, 이 정보를 별도 상태(`formCronCannotRepresent: boolean`)나 `useMemo`로 캐싱하면 중복 호출을 제거할 수 있다.
  - 제안:
    ```ts
    const cronCannotRepresent = useMemo(
      () => formCron.trim() !== "" && parseCronToVisualOrNull(formCron) === null,
      [formCron],
    );
    ```

- **[INFO]** `VisualCronEditor`의 controlled 패턴 전환 — 설계 방향 올바름
  - 위치: `page.tsx:159–320`
  - 상세: `VisualCronEditor`가 uncontrolled(자체 state)에서 controlled(`state` prop)로 전환되어, 부모가 단일 진실 원천(single source of truth)을 보유하게 되었다. 탭 전환 시 state 손실 문제의 근본 원인을 올바른 계층에서 해결했다.

- **[INFO]** `parseCronToVisualOrNull`의 방어적 분기 구조 — 명시적이지만 확장성 제한
  - 위치: `cron-to-visual.ts:60–130`
  - 상세: 5개 패턴을 순서대로 if 분기로 처리한다. 현재 패턴 수에서는 문제없지만, 새 패턴 추가 시 함수 내부를 수정해야 하므로 OCP(개방-폐쇄)에 약하다. 다만 현재 스펙이 "6개 패턴만 지원"으로 명시적으로 고정되어 있으므로 과도한 추상화를 피한 합리적 선택이다.

- **[INFO]** `handleSetCronTab`의 사이드 이펙트가 탭 전환 핸들러에 노출
  - 위치: `page.tsx:693–697`
  - 상세: 탭 전환이 단순 UI 상태 변경을 넘어 `formCron` 값을 변경하는 사이드 이펙트를 포함한다. 동작 자체는 스펙과 일치하지만, 함수명(`handleSetCronTab`)이 이 부수 효과를 암시하지 않는다.
  - 제안: 함수명을 `handleCronTabChange`로 유지하되, 주석(이미 존재)으로 충분히 설명되어 있어 현 수준은 수용 가능하다.

---

### 요약

이번 변경의 핵심 아키텍처 결정 — cron 변환 로직의 `lib/utils` 모듈 추출, `VisualCronEditor` state의 부모 lift, 단방향 데이터 흐름 확립 — 은 모두 올바른 방향이다. `SchedulesPage`의 폼 상태 팽창이 유일한 구조적 우려 사항이나, 이는 이번 PR이 만든 문제가 아니라 기존 설계에서 누적된 것이며 현재 규모에서는 기능적 문제를 일으키지 않는다. `cronCannotRepresent`의 중복 파싱은 성능보다 가독성 차원의 개선점이다. 전반적으로 레이어 책임이 명확하고 순환 의존성이 없으며 테스트 커버리지도 충분하다.

### 위험도

**LOW**
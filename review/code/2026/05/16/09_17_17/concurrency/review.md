# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[WARNING]** 렌더 중 `setState` 호출로 인한 이중 렌더 및 무한 루프 잠재 위험
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`, 추가된 `Cafe24Config` 함수 본문 — `objectsEqual` 비교 후 `setFieldRows` / `setLastPropagated` 를 렌더 함수 최상위 레벨에서 직접 호출하는 블록 (diff 기준 +358~+364)
  - 상세: React 공식 문서가 소개하는 "이전 렌더 값 저장(store information from previous renders)" 패턴을 채용했으나, 이 패턴은 `objectsEqual` 비교가 항상 안정적으로 `true` 로 수렴해야만 무한 루프를 피할 수 있다. 현재 `objectsEqual`은 키 개수 + `String(v)` 일치를 검사하므로 외부에서 `config.fields` 가 동일 내용의 새 참조로 계속 내려오면 `lastPropagated` 업데이트 → 다음 렌더 → 다시 비교 → 동일해서 멈춤 순서로 1회 여분 렌더가 발생한다. 더 위험한 경우는 부모가 `onChange` 콜백 안에서 state 를 직접 변형하거나 `config.fields` 를 매 렌더마다 새 객체(`{}`)로 내려주는 패턴을 취할 때다. 그 경우 `objectsEqual` 이 매번 `false` 를 반환해 `setLastPropagated` → 렌더 → 다시 비교 → 또 `false` 루프가 발생하고, React 는 단일 렌더 사이클 내 무한 업데이트를 감지해 `Too many re-renders` 오류를 던진다. 현재 테스트 환경(`ControlledCafe24`)은 `useState`로 config 를 관리하므로 이 문제가 드러나지 않지만, 부모 컴포넌트가 매 렌더마다 새 객체를 props 로 전달하는 방식으로 변경되면 즉시 터진다.
  - 제안: 렌더 중 `setState` 대신 `useEffect`(의존성: `config.fields`) 로 외부 변경을 감지하고 동기화한다. `objectsEqual` 비교는 `useEffect` 내부에서 수행해 렌더 함수 본문의 사이드 이펙트를 제거한다. 예시:
    ```tsx
    useEffect(() => {
      const externalFields =
        config.fields && typeof config.fields === "object" && !Array.isArray(config.fields)
          ? (config.fields as Record<string, unknown>)
          : {};
      if (!objectsEqual(externalFields, lastPropagated)) {
        const nextRows = normalizeCafe24Fields(externalFields);
        setFieldRows(nextRows);
        setLastPropagated(fieldRowsToObject(nextRows));
      }
    }, [config.fields]); // eslint-disable-line react-hooks/exhaustive-deps
    ```
    단, `useEffect` 방식은 외부 변경 후 한 프레임 뒤에 동기화되므로 잠깐의 stale 렌더가 발생할 수 있다. 완전한 해결책은 "derived state 를 state 에 두지 말고 렌더 시 계산" 또는 `key` prop 을 이용한 컴포넌트 재마운트다(commit 메시지가 언급한 `SettingsTab` keying 이 이미 노드 전환 케이스를 처리하고 있으므로, `config.fields` 외부 리셋이 실제 발생 빈도가 낮다면 `useEffect` 전환으로 충분하다).

- **[INFO]** `handleFieldRowsChange` 내 두 개의 연속 `setState` 호출 — 배치 보장 여부
  - 위치: `integration-configs.tsx`, `handleFieldRowsChange` 함수 (+366~+373)
  - 상세: `setFieldRows(items)`와 `setLastPropagated(obj)`가 같은 이벤트 핸들러 내에서 연속 호출된다. React 18 이상의 자동 배치(automatic batching) 환경에서는 두 호출이 단일 렌더로 합산되므로 문제없다. React 17 이하 또는 비동기 컨텍스트(setTimeout, Promise 콜백 내)에서는 두 번 렌더될 수 있으나, 현재 프로젝트가 Next.js 기반이고 이 핸들러는 동기 이벤트 핸들러로 사용되므로 실질적 위험은 낮다.
  - 제안: 두 상태를 하나의 객체로 합쳐 단일 `useState`로 관리하면 배치 여부에 무관하게 항상 원자적 업데이트가 보장된다. `const [editorState, setEditorState] = useState({ rows: [...], lastPropagated: {...} })` 형태.

## 요약

변경 대상은 순수 React 클라이언트 컴포넌트로, 멀티스레드 경쟁 조건·데드락·커넥션 풀 등 서버 사이드 동시성 이슈는 존재하지 않는다. 동시성 관점에서 실질적 위험은 React 렌더 함수 본문에서 `setState`를 조건부로 직접 호출하는 "derived-state 재동기화" 패턴에 집중된다. 현재 테스트 환경과 부모 컴포넌트 구조상 무한 루프가 즉시 발생하지는 않지만, 부모가 매 렌더마다 새 참조를 전달하는 구조로 바뀌면 `Too many re-renders` 오류로 이어질 수 있다. `useEffect` 또는 상태 통합으로 전환해 렌더 함수의 사이드 이펙트를 제거하는 것을 권장한다.

## 위험도

LOW

### 발견사항

---

**[WARNING]** `LANG_DISPLAY` 객체를 매 호출마다 재생성
- 위치: `node-config-summary.ts` — `codeSummary` 함수 내부
- 상세: `const LANG_DISPLAY: Record<string, string> = { javascript: "JavaScript" }` 가 함수 내부에 선언되어 있어 `codeSummary` 호출 시마다 새 객체가 힙에 할당됩니다. 캔버스에 코드 노드가 다수 존재하거나 리렌더가 빈번할 경우 GC 압박이 누적됩니다.
- 제안: 모듈 최상단 상수로 추출
  ```ts
  const LANG_DISPLAY: Record<string, string> = { javascript: "JavaScript" };
  ```

---

**[WARNING]** `summary` 객체 참조 변경에 의한 두 번째 `useMemo` 불필요 재실행
- 위치: `custom-node.tsx` `:38-43`
- 상세: 첫 번째 `useMemo`는 `data.config` 변경 시 새 객체를 반환합니다. `WARNING` 싱글턴을 제외한 모든 결과는 매번 새 참조이므로, 내용이 동일해도 두 번째 `useMemo([summary])`가 함께 실행됩니다. `truncateSummary`가 경량 함수이므로 영향이 제한적이지만, 노드 수가 많을 때 렌더 당 중복 호출이 발생합니다.
- 제안: 의존성을 텍스트 원시값으로 변경
  ```ts
  const { display: displayText, isTruncated } = useMemo(
    () => (summary ? truncateSummary(summary.text) : { display: "", isTruncated: false }),
    [summary?.text],
  );
  ```

---

**[INFO]** `split("\n")` 으로 배열 생성 후 `.length` / `[0]` 만 사용
- 위치: `node-config-summary.ts` — `codeSummary`, `templateSummary`, `databaseQuerySummary`
- 상세: 줄 수 계산을 위해 전체 문자열을 분할한 배열을 생성하지만 실제로는 `.length` 또는 첫 번째 원소만 사용합니다. 코드·템플릿이 길어질수록 불필요한 메모리 할당이 커집니다.
- 제안:
  ```ts
  // 줄 수 계산
  const lineCount = 1 + (code.match(/\n/g)?.length ?? 0);
  
  // 첫 줄 추출
  const firstLine = query.slice(0, query.indexOf("\n") === -1 ? query.length : query.indexOf("\n"));
  ```

---

**[INFO]** `statusStyles` IIFE — 미메모이제이션
- 위치: `custom-node.tsx` `:45-57`
- 상세: 매 렌더마다 IIFE가 실행됩니다. `nodeStatus`가 변경될 때만 재계산이 필요하므로 `useMemo`로 감싸는 것이 의도에 부합합니다. 단순 switch이므로 체감 영향은 낮습니다.
- 제안:
  ```ts
  const statusStyles = useMemo(() => {
    if (!nodeStatus) return "";
    switch (nodeStatus.status) { ... }
  }, [nodeStatus]);
  ```

---

**[INFO]** `useStore(zoom)` — 노드 수 증가 시 선택자 평가 비용
- 위치: `custom-node.tsx` `:36`
- 상세: `useStore((s) => s.transform[2] >= 0.5)` 는 pan/zoom 이벤트마다 마운트된 모든 노드에서 선택자가 평가됩니다. 반환값이 boolean이므로 0.5 임계값 교차 시에만 리렌더가 발생하는 것은 올바르지만, 노드가 수백 개일 경우 고빈도 이벤트(마우스 드래그) 중 선택자 평가 자체가 누적됩니다. ReactFlow 권장 패턴이므로 현재 규모에서는 허용 수준입니다.
- 제안: 노드 수가 크게 증가할 경우 캔버스 레벨에서 zoom 상태를 계산해 context 또는 prop으로 전달하는 방식을 고려할 수 있습니다.

---

### 요약

전반적으로 `useMemo` 적용과 `WARNING` 싱글턴 재사용 등 성능을 의식한 설계가 적용되어 있습니다. 주요 개선 포인트는 두 가지입니다: `codeSummary` 내 `LANG_DISPLAY` 객체의 불필요한 반복 할당(모듈 상수로 이동하면 즉시 해결), 그리고 두 번째 `useMemo`의 의존성을 객체 참조 대신 원시 텍스트로 교체하여 노드 수 증가 시의 렌더 비용 절감. `split("\n")` 패턴은 현재 규모에서 체감 영향은 낮지만 코드·템플릿 콘텐츠가 커질 수 있으므로 개선을 권장합니다.

### 위험도

**LOW**
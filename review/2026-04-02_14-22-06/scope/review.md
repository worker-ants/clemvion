## 발견사항

### [WARNING] `handleMouseUp`의 stale closure로 인한 localStorage 저장값 오류
- **위치**: `run-results-drawer.tsx` `handleMouseUp` 내 `localStorage.setItem`
- **상세**: `useEffect`의 의존성 배열에 `panelHeight`가 포함되어 있어 드래그 중 매 렌더마다 핸들러가 재등록된다. 그러나 `mouseup` 이벤트 발생 시점과 마지막 `useEffect` 재실행 시점 사이에 타이밍 갭이 존재하여, 저장되는 값이 최종 드래그 위치보다 한 스텝 이전 값일 수 있다.
- **제안**: `panelHeight` 대신 ref를 사용하거나, `startHeight.current + 누적 diff`를 별도 ref로 추적하여 mouseup 시점에 ref 값을 저장할 것.

```ts
// 현재: 스테일할 수 있는 panelHeight 클로저 사용
localStorage.setItem(STORAGE_KEY, String(panelHeight));

// 개선안
const currentHeightRef = useRef(panelHeight);
// handleMouseMove에서: currentHeightRef.current = newHeight
// handleMouseUp에서: localStorage.setItem(STORAGE_KEY, String(currentHeightRef.current))
```

---

### [INFO] `PRESENTATION_TYPES` Set이 `result-detail.tsx`에 모듈 레벨로 재정의
- **위치**: `result-detail.tsx` 상단
- **상세**: `use-execution-events.ts`에서 제거된 `PRESENTATION_TYPES`가 `result-detail.tsx`에 별도로 정의됨. 이 자체가 범위 위반은 아니지만, 향후 중복이 생길 경우를 대비해 `node-definitions` 또는 공통 상수 파일로 이동을 고려할 수 있음.
- **제안**: 현재 변경 범위 내에서는 허용 가능. 단, 추후 리팩토링 시 단일 출처 정의 권장.

---

### [INFO] `handleMouseDown` useCallback이 `panelHeight` 의존성으로 드래그 중 과도한 재생성
- **위치**: `run-results-drawer.tsx` `handleMouseDown` 및 리사이즈 `useEffect`
- **상세**: `panelHeight`가 변경될 때마다 `handleMouseDown`이 재생성되고, 이로 인해 `mousemove`/`mouseup` 리스너가 매번 재등록됨. 드래그 중에는 수십~수백 번 발생할 수 있음.
- **제안**: `startHeight.current`를 ref로 관리하면 `handleMouseDown`에서 `panelHeight` 의존성을 제거할 수 있어 불필요한 재등록을 방지할 수 있음.

---

## 요약

변경 범위는 전체적으로 잘 정의되어 있다. 모든 수정이 "Run Results Drawer를 전체 노드 타임라인 + 2-column 레이아웃으로 전환"이라는 단일 목표에 집중되어 있으며, 관련 없는 파일이나 코드 영역에 대한 무관한 수정은 발견되지 않는다. 백엔드의 `nodeType`/`nodeLabel` 이벤트 페이로드 추가, REST polling의 `node` relation 조인, 프론트엔드 스토어 확장, WS 이벤트 핸들러 분리, 새 컴포넌트 분리(`ResultTimeline`, `ResultDetail`, `DynamicFormUI`, 렌더러들), 스펙 업데이트가 모두 일관성 있게 연동된다. 단, 리사이즈 핸들러의 stale closure 버그는 기능 결함으로 수정이 권장된다.

## 위험도

**LOW**
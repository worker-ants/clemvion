# RESOLUTION — 2026-05-03 ai-review (3D 그래프) 조치 내역

리뷰 보고서 `SUMMARY.md` 의 Warning 16건 + Info 12건 중 Warning 전부와 정리 가치가 큰 Info 다수를 처리했다. dependency / supply-chain 항목 (Info #5–#7, #10) 은 본 변경 범위 밖이라 별도 작업으로 미룬다.

## Warning 조치

| # | 리뷰 항목 | 조치 | 위치 |
|---|----------|------|------|
| 1 | `nodeThreeObject` 등 인라인 콜백으로 ResizeObserver 시 WebGL 텍스처 재생성 | 모든 콜백을 `useCallback(()=>{},[])` 으로, color/opacity/limit 등은 모듈 스코프 상수로 추출 | `graph-3d-renderer.tsx` |
| 2 | SpriteText / material `dispose()` 누락으로 WebGL 메모리 누수 | `spritesRef` 로 마운트 동안 생성된 sprite 추적, `useEffect` cleanup 에서 `material.map.dispose()` + `material.dispose()` | `graph-3d-renderer.tsx` |
| 3 | `isError` 미소비 → API 실패 시 "데이터 없음" 화면으로 폴스루 | `useQuery` 의 `isError` 분기 추가, 전용 `graphVizLoadFailed` 메시지. 테스트도 `mockRejectedValue` 케이스 추가 | `graph-visualization.tsx`, `__tests__/graph-visualization.test.tsx` |
| 4 | 노드 라벨 Y 오프셋 고정값 → 큰 노드에서 라벨이 sphere 안에 파묻힘 | `nodeVisualRadius(mentionCount) + LABEL_BASE_OFFSET` 로 nodeVal 공식과 동기화. 단위 테스트에서 √9·2+6=12 검증 | `graph-3d-renderer.tsx`, `__tests__/graph-3d-renderer.test.tsx` |
| 5 | `ResizeObserver` mock 이 `afterEach` 미복원 → 후속 테스트 누출 | `originalResizeObserver` 백업 + `afterEach` 복원 | `__tests__/graph-visualization.test.tsx` |
| 6 | `Graph3DRenderer` 내부 로직 테스트 전무 | `graph-3d-renderer.test.tsx` 신설 — DOMPurify 적용 / type→color / nodeVal 공식 / 라벨 Y 위치 / onEngineStop → zoomToFit / onNodeClick → cameraPosition / unmount 시 dispose / props 전달 / smoke 9개 케이스. `vi.hoisted` 로 SpriteText / 카메라 spy mock | `__tests__/graph-3d-renderer.test.tsx` |
| 7 | limit 변경 인터랙션 (NativeSelect → 새 API 호출) 테스트 누락 | `fireEvent.change` 후 `getGraphVisualization` 가 새 limit 으로 재호출되는지 검증 | `__tests__/graph-visualization.test.tsx` |
| 8 | `TYPE_COLOR` 두 파일 중복 → legend ↔ 노드 색상 조용한 불일치 위험 | `graph-constants.ts` 모듈로 추출 후 양쪽이 import | `graph-constants.ts` 신설 |
| 9 | 매직 넘버 10개 이상 산재 | `CAMERA_TRANSITION_MS`, `LABEL_BASE_OFFSET`, `NODE_BASE_SIZE`, `ZOOM_TO_FIT_DURATION_MS`, `CAMERA_FOCUS_DISTANCE` 등 named constant 추출 | `graph-constants.ts`, `graph-3d-renderer.tsx` |
| 10 | `"#0b0d12"` 배경색 두 파일 중복 | `GRAPH_BG_COLOR` 상수 단일화 | `graph-constants.ts` |
| 11 | 9줄 JSDoc 블록이 CLAUDE.md "one short line max" 위반 | 한 줄로 축약 | `graph-3d-renderer.tsx` |
| 12 | API 응답 데이터 (`label`, `predicate`) 가 sprite text / linkLabel 경로 렌더 시 XSS 가능 | `DOMPurify.sanitize()` 를 `useMemo` 단계에서 적용 (마운트마다 한 번). 단위 테스트로 sanitize 호출 검증 | `graph-3d-renderer.tsx`, `__tests__/graph-3d-renderer.test.tsx` |
| 13 | `three: ^0.184.0` minor 자동 허용 (0.x semver 에선 minor 가 breaking 빈번) | `~0.184.0` 으로 patch 단위만 허용 | `package.json` |
| 14 | `zoomToFit` 1200ms 고정 타이머 → 대규모 그래프 수렴 전 호출 | `onEngineStop` 콜백으로 시뮬레이션 수렴 직후 한 번만 호출 | `graph-3d-renderer.tsx` |
| 15 | "Loading 3D graph…", "드래그로 회전…" i18n 미적용 | `graphVizLoading3d`, `graphVizControlsHint`, `graphVizLoadFailed` 키 추가 (ko/en) | `lib/i18n/dict/{ko,en}.ts`, `graph-visualization.tsx` |
| 16 | `@xyflow/react` CSS import 제거 영향 가능성 | `workflow-canvas.tsx:12` 가 자체적으로 동일 CSS import 보유 — 워크플로 에디터 영향 없음 확인. no action | n/a |

## Info 조치 (선별)

| # | 리뷰 항목 | 조치 |
|---|----------|------|
| 1 | `VIEWPORT_HEIGHT=600` 디자인 결정 주석 | `graph-constants.ts` 의 상수에 JSDoc 추가 |
| 2 | `fgRef.current` stale closure 가능성 | useCallback 으로 옮긴 결과 자연 해소 (콜백 내부에서 `fgRef.current?.zoomToFit()` 직접 read) |
| 8 | `Graph3DLink` 에 `edge.id` 누락 | `id?: string` optional 필드 보존 |
| 9 | `VIEWPORT_HEIGHT` 근거 주석 | `graph-constants.ts` 에 일괄 |
| 11 | `width===0` 구간 null 렌더 명시적 검증 | `withholds 3D mount until ResizeObserver reports a width` spec 추가 (ResizeObserver no-op stub) |

## 보류 / Not Applicable

| # | 항목 | 사유 |
|---|------|------|
| Info #3 | ResizeObserver cleanup 후 state update 가능성 | React 18 자동 무시 + 단순 단발 effect 라 방어 패턴 불요 |
| Info #4 | ResizeObserver debounce | Warning #1 fix 로 리렌더 비용 대폭 감소, 추가 debounce 불요 |
| Info #5–#7 | preact 전이 의존성, tween 두 버전, WASM 바이너리 등 supply-chain | 본 변경 범위 밖. 별도 의존성 audit / bundle analyzer 작업으로 별도 처리 |
| Info #10 | README WebGL 요건 추가 | 본 변경 범위 밖. 별도 docs 갱신으로 처리 |
| Info #12 | `next/dynamic` mock 명시 | 현재 vitest 동작상 즉시 resolve 가 안정적이고 모든 테스트 통과 — 추가 mock 보일러플레이트 부재가 유리 |

## 검증

- `frontend npx eslint` — clean (auto-fix 없음)
- `frontend npx vitest run` — 98 files / 1075 tests pass (이전 1063 + 12 추가)
- `frontend npm run build` — clean (TypeScript / webpack)

## 관련 파일

- `frontend/src/components/knowledge-base/graph-constants.ts` (신규)
- `frontend/src/components/knowledge-base/graph-3d-renderer.tsx`
- `frontend/src/components/knowledge-base/graph-visualization.tsx`
- `frontend/src/components/knowledge-base/__tests__/graph-3d-renderer.test.tsx` (신규)
- `frontend/src/components/knowledge-base/__tests__/graph-visualization.test.tsx`
- `frontend/src/lib/i18n/dict/{ko,en}.ts`
- `frontend/package.json` (three semver 변경)

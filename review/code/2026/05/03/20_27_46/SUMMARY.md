파일 쓰기 권한이 필요합니다. 허용해 주시면 저장하겠습니다. 아래는 통합 보고서 내용입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 런타임 성능(WebGL 텍스처 재생성)과 요구사항 미충족(API 에러 UI, 라벨 위치 오버랩)이 실사용에서 드러날 수 있으며, 테스트 격리 누락이 CI 안정성을 위협한다.

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `nodeThreeObject` 등 핵심 콜백이 `useCallback` 없이 인라인 정의 → ResizeObserver 발동마다 최대 200개 SpriteText 텍스처 소각·재생성 (GPU 과부하) | `graph-3d-renderer.tsx` JSX inline callbacks | `useCallback(()=>{},[])` 또는 모듈 스코프 상수 함수로 선언 |
| 2 | Performance / Side Effect | Three.js `SpriteText` canvas texture 가 unmount 시 `dispose()` 없이 누적 → WebGL 메모리 누수 | `graph-3d-renderer.tsx` unmount 핸들러 없음 | `useEffect` cleanup에서 scene objects dispose 호출 |
| 3 | Requirement / Testing | `isError` 미소비 → API 실패 시 "데이터 없음" 화면으로 폴스루. 검출 테스트도 없음 | `graph-visualization.tsx:57–68` | `isError` 분기 추가 + `mockRejectedValue` 에러 케이스 테스트 |
| 4 | Requirement | 노드 라벨 Y 오프셋 고정값(`8`) → `mentionCount` 가 큰 노드(반지름 ~22) 내부에 라벨 파묻힘 | `graph-3d-renderer.tsx:106` | `Math.sqrt(Math.max(n.mentionCount,1))*2 + 6` 으로 nodeVal 공식과 동기화 |
| 5 | Testing | `beforeEach`에서 교체한 전역 `ResizeObserver` mock을 `afterEach`에서 미복원 → 후속 테스트 파일에 mock 누출 | `graph-visualization.test.tsx:31–56` | `afterEach`에서 `originalResizeObserver` 복원 |
| 6 | Testing | `Graph3DRenderer` 내부 로직(카메라 수식, zoomToFit 타이머, sprite 생성)에 대한 테스트 전무 | `graph-3d-renderer.tsx` 전체 | `graph-3d-renderer.test.tsx` 별도 생성, `vi.useFakeTimers()` 활용 |
| 7 | Testing | limit 변경 인터랙션(NativeSelect onChange → 새 API 호출) 테스트 누락 | `graph-visualization.tsx:44–48` | `userEvent.selectOptions` 후 `getGraphVisualization` 재호출 여부 검증 |
| 8 | Maintainability / Architecture | `TYPE_COLOR` 상수가 두 파일에 중복 정의 → 한 쪽만 변경 시 legend ↔ 노드 색상 조용한 불일치 | `graph-visualization.tsx:16–23`, `graph-3d-renderer.tsx:18–26` | `graph-constants.ts` 공유 모듈로 추출 |
| 9 | Maintainability | 매직 넘버 10개 이상 산재 (`1200`, `400`, `60`, `8`, `4`, `0.4`, `5`). sprite Y 오프셋 `8`은 `nodeRelSize`·`nodeVal`과 암묵적 연동 | `graph-3d-renderer.tsx:91–153` | `CAMERA_ZOOM_SETTLE_MS`, `LABEL_Y_OFFSET`, `NODE_BASE_SIZE` 등 named constant 추출 |
| 10 | Maintainability | `"#0b0d12"` 배경색이 두 파일에 각각 하드코딩 | `graph-visualization.tsx:106`, `graph-3d-renderer.tsx:99` | 공유 상수 파일에 `GRAPH_BG_COLOR` 추출 |
| 11 | Documentation | 9줄 JSDoc 블록이 CLAUDE.md 규약("one short line max") 위반 | `graph-3d-renderer.tsx:49–60` | 핵심 한 줄만 남기고 나머지는 PR 설명 또는 spec으로 이동 |
| 12 | Security | API 응답 데이터(`l.predicate`, `n.label`)가 `linkLabel` 등 DOM 경로 렌더 시 XSS 가능. `dompurify` 이미 의존성에 있음 | `graph-3d-renderer.tsx:88`, `:105` | `DOMPurify.sanitize()` 적용 후 전달 |
| 13 | Dependency | `three`의 `^` semver → minor 버전 breaking change 자동 허용. Three.js는 0.x 체계에서 minor 간 API 변경 빈번 | `package.json: "three": "^0.184.0"` | `"~0.184.0"` 으로 patch 단위만 허용 |
| 14 | Performance | `zoomToFit` 1200ms 고정 타이머 → 대규모 그래프 수렴 전 호출, 소규모 불필요 지연 | `graph-3d-renderer.tsx:93–97` | `onEngineStop` 콜백으로 시뮬레이션 수렴 직후 호출 |
| 15 | Maintainability / i18n | `"Loading 3D graph…"`, `"드래그로 회전…"` 두 문자열만 i18n 미적용 | `graph-visualization.tsx:31`, `:131` | i18n 키 추가 후 `t()` 교체 |
| 16 | Side Effect | `@xyflow/react` CSS import 제거 → 다른 React Flow 컴포넌트의 유일한 진입점이었을 경우 스타일 파괴 | `graph-visualization.tsx` (제거된 import) | 워크플로우 에디터 등 다른 사용처에 CSS import 존재 여부 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `VIEWPORT_HEIGHT = 600` 고정 — width는 반응형이나 height는 비대칭 | `graph-visualization.tsx:45` | 고정 스펙이면 주석 명시 |
| 2 | Concurrency | `fgRef.current` effect 시점 캡처 후 1200ms 타이머 내 사용 → stale closure 가능성 (실질 위험 낮음) | `graph-3d-renderer.tsx:100–108` | 타이머 콜백 내에서 `fgRef.current?.zoomToFit()` 직접 읽도록 수정 |
| 3 | Concurrency | `ResizeObserver` cleanup 후 state update 가능 (React 18 자동 무시) | `graph-visualization.tsx:55–64` | 현재 안전. 방어 필요 시 `active` 플래그 패턴 |
| 4 | Performance | `ResizeObserver` 콜백에 debounce 없어 창 리사이즈 중 연속 리렌더 (WARNING #1 수정 시 대폭 감소) | `graph-visualization.tsx:56–64` | `requestAnimationFrame` 기반 단발성 flush (선택 사항) |
| 5 | Dependency | `float-tooltip` → `preact@10.29.1` 전이 의존성 — React 프로젝트에 두 번째 UI 런타임 포함 | `package-lock.json` | 번들 분석으로 실제 포함 여부 확인 |
| 6 | Dependency | `@tweenjs/tween.js` 두 버전 공존 (25.0.0 / 23.1.3) — 프로덕션에는 v25만 사용, 무해 | `package-lock.json` | 조치 불필요 |
| 7 | Security | 전이 의존성 19개 추가, `@dimforge/rapier3d-compat` (WASM 바이너리) 포함 | `package-lock.json` | CI `npm audit` 추가, bundle analyzer로 WASM 프로덕션 포함 여부 확인 |
| 8 | API Contract | `Graph3DLink`에 `edge.id` 필드 누락 (현재 무해, 향후 엣지 하이라이트 기능 추가 시 재발굴 필요) | `graph-3d-renderer.tsx:36–41` | `id?: string` 옵셔널 필드 보존 고려 |
| 9 | Documentation | `VIEWPORT_HEIGHT = 600` 도출 근거 미기록 | `graph-visualization.tsx:37` | 한 줄 주석 추가 |
| 10 | Documentation | README에 WebGL 지원 브라우저 필요 조건 미기재 | README.md | 요구사항 섹션에 WebGL 요건 추가 |
| 11 | Testing | `width === 0` 구간 null 렌더 동작 명시적 검증 없음 | `graph-visualization.tsx:112` | 의도적 케이스 명시적 테스트 추가 고려 |
| 12 | Testing | `next/dynamic` mock이 vitest 비공식 동작에 의존 | `graph-visualization.test.tsx:7–28` | `next/dynamic` 명시적 mock 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Performance | MEDIUM | `nodeThreeObject` useCallback 누락으로 ResizeObserver 시 WebGL 텍스처 전체 재생성 |
| Requirement | MEDIUM | API 에러 UI 폴스루, 노드 라벨 고정 오프셋 대형 노드 겹침 |
| Testing | MEDIUM | `graph-3d-renderer` 테스트 전무, ResizeObserver mock 복원 누락, 에러/limit 케이스 미검증 |
| Security | LOW | API 응답 데이터 XSS 가능성, WASM 전이 의존성 supply-chain 위험 |
| Architecture | LOW | `TYPE_COLOR` 이중 정의, `width===0` 빈 프레임 |
| Maintainability | LOW | `TYPE_COLOR`·배경색 중복, 매직 넘버 10개+, i18n 미적용 2곳, JSDoc 규약 위반 |
| Side Effect | LOW | SpriteText WebGL 메모리 미해제, `@xyflow/react` CSS 제거 영향 확인 필요 |
| Dependency | LOW | `three` `^` semver breaking change 허용, Preact 전이 의존성 이질성 |
| Concurrency | LOW | stale closure(fgRef 캡처) — 실질 위험 낮음 |
| API Contract | LOW | `edge.id` 누락(현재 무해), `limit` 파라미터 spec 미문서화 |
| Documentation | LOW | JSDoc 규약 위반, 매직 넘버 미기록, README WebGL 요건 누락 |
| Scope | NONE | 모든 변경이 목적 범위 내 |
| Database | NONE | 해당 없음 — 순수 프론트엔드 변경 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 변경 범위가 프론트엔드 레이어에 한정, DB/ORM/마이그레이션 코드 없음 |
| Scope | 6개 파일 모두 3D 전환 목적에 귀속. lockfile `dev` 플래그 변경은 npm resolution 자동 부작용 |

---

## 권장 조치사항

### 즉시 조치 (기능 정확성·안정성)
1. **`useCallback` 적용** — `nodeThreeObject`, `nodeColor`, `nodeVal`, `linkColor`, `linkWidth`, `linkLabel` 콜백을 `useCallback(()=>{},[])` 또는 모듈 스코프 상수로 선언해 ResizeObserver 시 WebGL 텍스처 재생성 루프 차단
2. **API 에러 UI 추가** — `graph-visualization.tsx`에 `isError` 분기 추가 및 에러 케이스 테스트 작성
3. **노드 라벨 위치 동적화** — `sprite.position.set(0, Math.sqrt(Math.max(n.mentionCount,1))*2 + 6, 0)` 으로 nodeVal 공식과 동기화
4. **ResizeObserver mock 복원** — `graph-visualization.test.tsx`에 `afterEach` 복원 로직 추가

### 단기 조치 (유지보수·품질)
5. **`TYPE_COLOR` + 배경색 공유 상수 추출** — `graph-constants.ts`로 단일화
6. **매직 넘버 named constant 추출** — `CAMERA_ZOOM_SETTLE_MS`, `LABEL_Y_OFFSET`, `NODE_BASE_SIZE` 등
7. **`onEngineStop` 기반 `zoomToFit`** — 하드코딩 1200ms 타이머 교체
8. **WebGL dispose** — `useEffect` cleanup에서 Three.js 리소스 해제
9. **`@xyflow/react` CSS import 확인** — 워크플로우 에디터 등 다른 사용처에 CSS import 존재 여부 검증

### 선택 조치 (품질·보안 강화)
10. **`DOMPurify.sanitize()` 적용** — `linkLabel`, `nodeThreeObject` 레이블에 적용
11. **`three` semver 제한** — `"^0.184.0"` → `"~0.184.0"`
12. **i18n 키 추가** — `"Loading 3D graph…"`, `"드래그로 회전…"` 두 문자열 `t()` 교체
13. **`graph-3d-renderer.test.tsx` 작성** — `vi.useFakeTimers()` + SpriteText mock으로 카메라 로직 커버
14. **CI `npm audit` 추가** + bundle analyzer로 WASM 전이 의존성 프로덕션 포함 여부 확인
15. **JSDoc 블록 정리** — `graph-3d-renderer.tsx:49–60` 한 줄로 축약
16. **README WebGL 요건 추가**
파일 쓰기 권한이 없어 직접 결과를 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 핵심 UX 로직(`use-edge-highlighting.ts`) 테스트 전무, hover 이벤트가 전역 Zustand 스토어를 통해 전체 구독자 리렌더를 유발하는 성능 폭풍, 의존성 레이어 역전이 복합적으로 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Dependency | `lib/stores/editor-store.ts`가 `components/editor/canvas/edge-utils.ts`를 직접 import — 상태 관리 레이어가 프레젠테이션 레이어에 의존하는 레이어 역전 | `editor-store.ts:8` | `edge-utils.ts`를 `lib/utils/edge-utils.ts`로 이동 |
| 2 | Testing / Requirement | `use-edge-highlighting.ts` 핵심 UX 로직(hover 우선순위, `isFocusActive`, className 토글, `hoveredEdgeNodes` 산출)에 대한 테스트 전무 | `use-edge-highlighting.ts` 전체 | `renderHook`으로 우선순위·포커스 해제·클래스 제거 시나리오 최소 4케이스 커버 |
| 3 | Requirement | `findSmartPath` A* 경로탐색에 try/catch 없음 — 라이브러리 내부 예외 시 캔버스 전체 크래시 | `edge-pathfinding.ts`, `findSmartPath` | try/catch 추가 후 null 반환(베지어 폴백) |
| 4 | Performance | `hoveredNodeId`/`hoveredEdgeId`를 전역 Zustand 스토어에 저장 — 마우스 이동마다 스토어 전체 구독자 리렌더 폭풍 | `editor-store.ts:20–21` | 훅 내부 `useRef`/`useState` 또는 별도 `useUIStore` slice로 분리 |
| 5 | Performance | `getConnectedEdgeIds`가 hover 변경마다 전체 엣지 O(E) 선형 탐색 반복 | `use-edge-highlighting.ts:28`, `edge-utils.ts:71–78` | `nodeId → Set<edgeId>` 역방향 인덱스를 useMemo로 사전 계산, O(1) 조회 |
| 6 | Testing | `editor-store.test.ts`에 `hoveredNodeId`/`hoveredEdgeId` initialState 누락, `onConnect` 연동 및 `setWorkflow` hover 초기화 미검증 | `editor-store.test.ts` | 신규 필드 추가 및 관련 시나리오 테스트 작성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency / Requirement | `editor-loader.tsx` `useEffect` cleanup 부재 — `workflowId` 변경 시 이전 비동기 로딩이 취소되지 않아 race condition | `editor-loader.tsx`, `load()` | `cancelled` 플래그 또는 `AbortController` 도입 |
| 2 | Security | 동적 `<style>` 태그에서 API 유래 노드 ID를 CSS 선택자에 이스케이프 없이 보간 — CSS Injection 취약점 | `workflow-canvas.tsx:422–431` | `CSS.escape(id)` 적용 또는 `data-glow` 속성 + 정적 CSS로 전환 |
| 3 | Security | API 응답 노드/엣지 ID에 형식 검증 없이 스토어 저장 및 CSS 컨텍스트 사용 | `editor-loader.tsx:32–36` | Zod 스키마 검증 또는 UUID 패턴 검증 레이어 추가 |
| 4 | Architecture / Scope | `arrow-*-bright` 마커 4종이 일반 마커와 동일한 색상 — 미완성 구현 | `custom-edge.tsx`, `EdgeMarkerDefs` | 실제 구분 색상 적용하거나 `-bright` 구분 제거하고 단일 패턴으로 통일 |
| 5 | Architecture / Maintainability | `resolvePortType`이 `ai_agent` 노드 타입을 인라인 하드코딩 (OCP 위반) | `edge-utils.ts:37–48` | `NodeDefinition.outputs`에 `portType` 필드 표준화 |
| 6 | Architecture / Scope | `getMarkerIdForPortType`가 export·테스트 대상이나 프로덕션 코드 미사용 (dead export) | `edge-utils.ts:58–65` | `custom-edge.tsx`에서 활용하거나 함수 및 테스트 제거 |
| 7 | Performance / Side Effect | 동적 `<style>` 태그 삽입/제거가 엣지 hover마다 브라우저 전체 CSSOM 재계산 강제 | `workflow-canvas.tsx:422–429` | `data-glow` 속성 + 정적 CSS 규칙으로 대체 |
| 8 | Dependency | `pathfinding@0.4.18` — 10년 이상 미유지 패키지를 프로덕션 번들 `dependencies`에 배치 | `frontend/package.json` | 경량 커스텀 A* 구현(~80줄)으로 대체 또는 dynamic import |
| 9 | Requirement | `wouldIntersectNode`에서 `midOffsetX = 0`, `midOffsetY = 0` 고정으로 직선 보간만 수행 — 베지어 곡선 교차 감지 불가 | `edge-pathfinding.ts`, `wouldIntersectNode` | dead variable 제거 및 주석 수정 |
| 10 | Requirement | `hoveredEdgeId`에 미존재 엣지 ID 설정 시 `isFocusActive=true`로 모든 엣지 dim 처리 | `use-edge-highlighting.ts:28–32` | `hoveredEdgeId`가 실제 존재하는 엣지인지 확인 후 Set 구성 |
| 11 | Testing | `enrichEdgesWithPortData`가 단일 happy path만 테스트 — `ai_agent` 시스템 포트, 컨테이너 포트, 폴백 미검증 | `edge-utils.test.ts:100–138` | 누락 케이스 테스트 추가 |
| 12 | Side Effect | `setWorkflow` 호출 시 `hoveredNodeId`/`hoveredEdgeId` 미초기화 — 워크플로우 전환 후 이전 hover 상태 잔존 | `editor-store.ts`, `setWorkflow` | `setWorkflow` 내에 두 필드 null 초기화 추가 |
| 13 | Side Effect | `enrichEdgesWithPortData`가 기존 `edge.data`를 완전히 교체 — 미인식 필드 손실 위험 | `edge-utils.ts:98–109` | `{ ...(edge.data ?? {}), ...newData }` 패턴으로 기존 data 보존 |
| 14 | Side Effect / Performance | 전역 CSS `.react-flow__edge path` transition 추가로 모든 엣지 즉각 피드백이 150ms 지연으로 변경 | `globals.css:68–70` | `[data-edge-focus-active]` 조건부 규칙으로 범위 한정 |
| 15 | Maintainability | `className` 문자열에서 `.replace("edge-highlighted", "")` 사용 — 유사 이름 클래스에 오동작 가능 | `use-edge-highlighting.ts:44,51` | `Set<string>` 기반 클래스 관리 또는 `clsx` 활용 |
| 16 | Maintainability | `isError` 분기가 `portColor`와 동일한 값 반환 — 중복 분기 | `custom-edge.tsx:44–51` | `isError` 분기 제거 후 단순화 |
| 17 | Performance | `edge-flow` 무한 CSS 애니메이션에 `will-change` 없어 GPU 가속 미적용 | `globals.css:97–110` | `will-change: stroke-dashoffset` 조건부 추가 또는 `transform` 기반 구현 |
| 18 | Concurrency | `nodeRectsSelector`가 매 호출마다 `.map()`으로 새 배열 생성 — 불필요한 전체 엣지 리렌더 | `custom-edge.tsx`, `useStore(nodeRectsSelector)` | `shallow` 비교 적용 |
| 19 | Maintainability | `switch`문과 `Record` 패턴이 동일 파일 내 혼용 | `edge-utils.ts` | `Record` 패턴으로 통일 |
| 20 | Testing | `formatLabel` 순수 함수가 export되지 않아 테스트 불가 — 6개 분기 미검증 | `custom-edge.tsx:18–31` | `edge-utils.ts`로 이동 후 export 및 테스트 추가 |
| 21 | Testing | `editor-loader.tsx` 비동기 로딩 로직 테스트 없음 | `editor-loader.tsx` | `workflowsApi` mock 후 컴포넌트 테스트 작성 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `isFocusActive`가 `enhancedEdges` useMemo 의존성에 중복 포함 | `use-edge-highlighting.ts:55` | 의존성 배열에서 `isFocusActive` 제거 |
| 2 | Security | API 에러 메시지를 UI에 직접 표시 — 내부 정보 노출 가능 | `editor-loader.tsx:68–70` | 제네릭 메시지 표시, 상세 에러는 콘솔 로깅 |
| 3 | Documentation | Catmull-Rom tension 주석(`0.5`)과 실제 값(`6`) 불일치 | `edge-pathfinding.ts`, `pointsToSvgPath` | 주석을 실제 값에 맞게 수정 또는 `CATMULL_ROM_TENSION` 상수로 명명 |
| 4 | Documentation | `wouldIntersectNode`의 항상 0인 변수에 "베지어 근사" 주석 부착 — 이중 오류 | `edge-pathfinding.ts` | 변수 및 주석 제거 후 선형 보간 명시 |
| 5 | Documentation | "Bright markers" 주석이 실제 색상 차이 없음을 숨김 | `custom-edge.tsx` | 예약 기능임을 명시하거나 단일 마커 세트로 통합 |
| 6 | Documentation | `hoveredNodeId`/`hoveredEdgeId` 필드에 목적 설명 없음 | `editor-store.ts:20–21` | 인라인 주석 추가 |
| 7 | Documentation | 동적 `<style>` 블록 선택 이유 미기록 | `workflow-canvas.tsx` | React Flow per-node style API 부재를 이유로 주석 명시 |
| 8 | Scope | 레거시 마커 `arrow`, `arrow-selected` 실제 참조 여부 미확인 | `custom-edge.tsx` | grep 후 참조 없으면 제거 |
| 9 | Maintainability | `buildEdgeData` 반환 타입이 `Record<string, unknown>` | `edge-utils.ts:70–77` | 명시적 `EdgeData` 인터페이스 정의 |
| 10 | Maintainability | `0.12`(dim opacity), `150ms`, `2.5`/`1.5`(strokeWidth) 등 매직 넘버 산재 | `globals.css`, `custom-edge.tsx` | CSS 변수 및 TypeScript 상수로 추출 |
| 11 | Testing | `resolvePortType` — `"emit"` 핸들 및 알 수 없는 노드 타입 폴백 테스트 누락 | `edge-utils.test.ts` | 경계값 케이스 테스트 추가 |
| 12 | Testing | `getConnectedEdgeIds` — 동일 노드 source·target 양방향 케이스 미검증 | `edge-utils.test.ts:82–112` | 양방향 관계 케이스 추가 |
| 13 | Documentation | README에 포트 타입 색상 규칙 및 hover 하이라이팅 동작 미반영 | 프로젝트 README | 에디터 캔버스 UX 섹션에 기술 |
| 14 | Performance | `markerId` 문자열 템플릿이 매 렌더마다 새 문자열 생성 | `custom-edge.tsx:55–57` | `buildEdgeData`에서 사전 계산 후 `edge.data`에 저장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Performance | **HIGH** | 전역 hover 상태가 마우스 이동마다 전체 구독자 리렌더 유발, O(E) 탐색 반복, CSSOM 재계산 |
| Testing | **HIGH** | `use-edge-highlighting.ts` 테스트 전무, `editor-store.test.ts` 신규 상태 미반영 |
| Architecture | **MEDIUM** | 스토어→컴포넌트 레이어 역전, transient UI 상태 글로벌 스토어 오염, 동적 CSS 안티패턴 |
| Dependency | **MEDIUM** | 레이어 역전(동일), `pathfinding@0.4.18` 10년 이상 미유지 프로덕션 의존성 |
| Requirement | **MEDIUM** | `use-edge-highlighting.ts` 테스트 부재, A* 에러 처리 없음, bright 마커 미완성, race condition |
| Maintainability | **MEDIUM** | dead export, 중복 분기, 취약한 className 조작, 하드코딩된 노드 타입 |
| Side Effect | **MEDIUM** | 전역 hover 상태 리렌더, `setWorkflow` 미초기화, 전역 CSS transition 범위 과다 |
| Concurrency | **MEDIUM** | race condition(워크플로우 전환), `nodeRectsSelector` 참조 불안정 |
| Security | **LOW** | CSS Injection 패턴(UUID 환경 실 위험 낮음), API 데이터 미검증, 에러 메시지 노출 |
| Scope | **LOW** | `-bright` 마커 미완성, dead export, 레거시 마커 잔존 |
| Documentation | **LOW** | tension 주석 불일치, dead export 오해 유발, README 미갱신 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| **API Contract** | 순수 프론트엔드 렌더링 변경으로 API 요청/응답 구조 무변경 |
| **Database** | DB 쿼리·스키마·트랜잭션과 무관한 클라이언트 상태 관리 변경 |

---

## 권장 조치사항

1. **[즉시] `edge-utils.ts`를 `lib/` 레이어로 이동** — 레이어 역전 해소 및 이후 아키텍처 개선의 선행 조건
2. **[즉시] `use-edge-highlighting.ts` 테스트 작성** — `renderHook` 활용, 우선순위·포커스·클래스 제거 시나리오
3. **[즉시] `hoveredNodeId`/`hoveredEdgeId`를 글로벌 스토어에서 분리** — 전체 리렌더 폭풍 차단
4. **[즉시] CSS Injection 패턴 수정** — `CSS.escape()` 적용 또는 `data-glow` 기반 정적 CSS로 전환
5. **[즉시] `findSmartPath` 에러 처리 추가** — try/catch + null 반환(베지어 폴백)
6. **[즉시] `setWorkflow`에 hover 상태 초기화 추가** — 워크플로우 전환 시 stale 상태 방지
7. **[단기] `editor-loader.tsx` race condition 수정** — `cancelled` 플래그로 cleanup 구현
8. **[단기] `getConnectedEdgeIds` O(1) 인덱스 구축** — `nodeId → Set<edgeId>` 역방향 Map
9. **[단기] `enrichEdgesWithPortData` 기존 data 보존** — spread 병합 패턴 적용
10. **[단기] `editor-store.test.ts` 보완** — 신규 필드 및 관련 시나리오 커버
11. **[단기] 동적 `<style>` 태그를 `data-glow` + 정적 CSS로 교체** — CSSOM 재계산 비용 제거 및 보안 개선
12. **[중기] `pathfinding@0.4.18` 대체** — 경량 커스텀 A* 또는 dynamic import
13. **[중기] `-bright` 마커 정리** — 실제 색상 차이 적용 또는 단일 세트로 통합
14. **[중기] `resolvePortType` OCP 개선** — `NodeDefinition.outputs`에 `portType` 표준화
15. **[중기] `formatLabel` export 및 테스트 추가** — `edge-utils.ts`로 이동
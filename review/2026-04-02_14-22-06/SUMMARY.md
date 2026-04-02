파일 쓰기 권한을 요청 중입니다. 권한을 허용해 주시면 SUMMARY.md를 저장하겠습니다.

그 전에 통합 보고서 내용을 먼저 확인하실 수 있도록 아래에 정리해 드립니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 신규 UI 컴포넌트 전체 테스트 누락, 드래그 리사이즈의 stale closure 버그, Form 노드의 `waiting_for_input` 상태 미반영 등 복수의 실제 동작 결함이 존재함

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 버그 (다수 중복) | **`handleMouseUp` stale closure — localStorage에 잘못된 높이 저장** `panelHeight`가 `useEffect` 의존성에 포함되어 드래그 중 매 setState마다 이벤트 리스너 재등록/해제 반복. `mouseup` 시 저장되는 값이 최신 높이가 아닐 수 있음 | `run-results-drawer.tsx:68–91` | `currentHeightRef = useRef(panelHeight)` 추가, `handleMouseMove`에서 ref 동기화, `useEffect` 의존성에서 `panelHeight` 제거 |
| 2 | 버그 | **`document.body.style` — unmount 시 cleanup 누락** 드래그 도중 컴포넌트 unmount 시 `cursor`, `userSelect` 스타일 영구 오염 | `run-results-drawer.tsx` `handleMouseDown`/`handleMouseUp` | `useEffect` cleanup에서 `isDragging.current` 확인 후 body style 강제 복원 |
| 3 | 기능 누락 | **Form 노드 `waiting_for_input` 상태가 타임라인에 반영되지 않음 (스펙 §10.5)** `pauseForForm()`만 호출되고 `NodeResult.status`가 `"waiting_for_input"`으로 갱신되지 않아 ⏸ 아이콘 미표시 | `use-execution-events.ts` `handleWaitingForInput` | `updateNodeStatus(nodeId, { status: "waiting_for_input" })` + `addNodeResult(...)` 호출 추가 |
| 4 | 테스트 누락 | **신규 UI 컴포넌트 5개 전체 테스트 없음** `ResultTimeline`, `ResultDetail`, `DynamicFormUI`, `GenericRenderer`, `PresentationContent` 핵심 분기 미검증 | `result-timeline.tsx`, `result-detail.tsx`, `dynamic-form-ui.tsx`, `renderers/*.tsx` | RTL 테스트 추가. `DynamicFormUI` 필드 타입별, `ResultDetail` 분기별, XSS sanitization 경로 우선 |
| 5 | 테스트 누락 | **`waiting_for_input` 타임라인 상태 전환 테스트 누락** WARNING #3 버그와 직결 | `use-execution-events.test.ts` | `execution.waiting_for_input` 핸들러 테스트에 `nodeResults` 상태 검증 추가 |
| 6 | 동시성 | **WS 이벤트 순서 역전 시 status 덮어쓰기 버그** `node.completed`가 `node.started`보다 먼저 도착하면 `running`이 완료 후 덮어써짐 | `use-execution-events.ts` `handleNodeStarted`/`handleNodeCompleted` | `STATUS_PRIORITY` 맵 추가: 기존 priority ≥ 신규 priority이면 status 유지 |
| 7 | 보안 | **localStorage 값 상한 검증 누락** `Infinity` 등 비정상 값 유입 가능 | `run-results-drawer.tsx` `getStoredHeight()` | `parsed <= window.innerHeight * MAX_HEIGHT_RATIO` 조건 추가 |
| 8 | 보안 | **WebSocket 수신 데이터 입력 검증 없음** `nodeType`, `nodeLabel`에 길이/형식 검증 없이 저장소 저장 | `use-execution-events.ts` `handleNode*` | `typeof` + 길이 제한 검증 추가 |
| 9 | 보안 | **DOMPurify 허용 태그 미명시** | `presentation-renderers.tsx` `ChartContent`, `TemplateContent` | `ALLOWED_TAGS`, `ALLOWED_ATTR` 명시 |
| 10 | 보안 | **`CATEGORY_COLORS` prototype pollution 잠재 위험** | `result-detail.tsx`, `result-timeline.tsx` | `Object.hasOwn()` 체크 또는 `Object.create(null)` 사용 |
| 11 | 중복 정의 | **`formatDuration` 함수가 3개 파일에 중복** | `result-detail.tsx`, `result-timeline.tsx`, `renderers/generic-renderer.tsx` | `run-results/utils.ts`로 추출 |
| 12 | 중복 정의 | **`PRESENTATION_TYPES` Set이 `result-detail.tsx`에 재정의** | `result-detail.tsx:16–23` | `nodeCategory === "presentation"` 조건으로 대체 또는 `node-definitions.ts` 단일 export |
| 13 | WS 계약 | **WS 이벤트 페이로드 계약 암묵적 — 사실상 breaking change** 이전 서버와 연결 시 모든 노드가 `"unknown"` 카테고리로 표시 | `execution-engine.service.ts`, `use-execution-events.ts` | `shared/types/ws-events.ts` 인터페이스 정의 및 프로토콜 변경 문서화 |
| 14 | API 계약 | **`NodeExecutionData.node.label` nullable 불일치** 타입은 `string`이나 백엔드에서 `?? node.type` fallback 사용 | `executions.ts:15` | `label: string \| null`로 수정 |
| 15 | DB | **`relations: ['node']` — NodeExecution 엔티티 관계 정의 미확인** 미정의 시 런타임 오류 | `executions.service.ts:40` | `@ManyToOne(() => Node)` 데코레이터 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | 성능 | `ResultTimeline` auto-select `useEffect` 불필요한 재실행 위험 | `result-timeline.tsx:56–60` |
| 2 | 성능 | WS `outputData` 대용량 전송 위험 | `execution-engine.service.ts` NODE_COMPLETED |
| 3 | 성능 | 4곳에 반복되는 페이로드 패턴 → 헬퍼 추출 권장 | `execution-engine.service.ts:504,548,583,645` |
| 4 | 아키텍처 | `getCategoryForType`가 인프라 레이어에서 UI 도메인 지식 직접 호출 | `use-execution-events.ts:40–42` |
| 5 | 아키텍처 | `ResultDetail` 렌더링 분기 JSX 산재 → 팩토리 함수 분리 권장 | `result-detail.tsx:130–140` |
| 6 | 아키텍처 | `node` optional로 인한 방어 코드 산재 → required 승격 가능 | `executions.ts:15` |
| 7 | DB | `node_executions.node_id` 인덱스 확인 필요 | `NodeExecution` 엔티티 마이그레이션 |
| 8 | 보안 | `executions.service.ts` node relation 데이터 노출 범위 확대 → 컬럼 명시 필요 | `executions.service.ts` `findById()` |
| 9 | 테스트 | `unknown` 카테고리 fallback 테스트 없음 | `use-execution-events.test.ts` |
| 10 | 테스트 | REST polling `node` 필드 없는 케이스 테스트 없음 | `use-execution-events.ts:252` |
| 11 | 테스트 | 백엔드 `nodeType`/`nodeLabel` 페이로드 검증 테스트 없음 | `execution-engine.service.ts` |
| 12 | 테스트 | `relations: ['node']` 호출 인자 검증 테스트 없음 | `executions.service.ts:40` |
| 13 | UX | 선택된 타임라인 항목으로 자동 스크롤 미구현 | `result-timeline.tsx` |
| 14 | 문서 | 스펙 §10.9, §10.12 미구현 항목 미표시 | `spec/3-workflow-editor/3-execution.md` |
| 15 | 문서 | `getCategoryForType` 함수 설명 없음 | `use-execution-events.ts:40–42` |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | Form `waiting_for_input` 타임라인 미반영, 드래그 리스너 재등록 |
| performance | MEDIUM | 드래그 중 이벤트 리스너 반복 재등록 |
| concurrency | MEDIUM | stale closure 버그, WS 이벤트 순서 역전 시 status 덮어쓰기 |
| testing | MEDIUM | 신규 UI 컴포넌트 5개 테스트 전무 |
| side_effect | LOW~MEDIUM | body style cleanup 누락, stale closure, auto-select 재실행 위험 |
| security | LOW | localStorage 상한 없음, WS 입력 검증 없음, DOMPurify 미명시 |
| architecture | LOW | WS 페이로드 암묵적 계약, PRESENTATION_TYPES 중복, 레이어 책임 혼재 |
| maintainability | LOW | formatDuration 3중복, PRESENTATION_TYPES 중복 |
| api_contract | LOW | WS breaking change 미문서화, label nullable 불일치 |
| documentation | LOW | 스펙 미구현 미표시, 주석 부족 |
| database | LOW | relations JOIN 성능, node_id 인덱스 확인 |
| dependency | LOW | TypeORM node relation 정의 확인 필요 |
| scope | LOW | 변경 범위 일관성 양호 |

---

## 권장 조치사항

1. **[즉시]** Form 노드 `waiting_for_input` 타임라인 상태 미반영 수정 (스펙 §10.5)
2. **[즉시]** `handleMouseUp` stale closure 수정 + unmount 시 `document.body.style` cleanup 추가
3. **[즉시]** 신규 UI 컴포넌트 5개 RTL 테스트 작성
4. **[즉시]** `waiting_for_input` 이벤트 테스트 추가
5. **[권장]** WS 이벤트 순서 역전 방어 (`STATUS_PRIORITY` 비교 로직)
6. **[권장]** 보안 입력 검증 강화 (WS 길이/형식, localStorage 상한, DOMPurify 허용 태그)
7. **[권장]** `formatDuration` 공통 유틸 추출 및 `PRESENTATION_TYPES` 단일 소스화
8. **[권장]** 스펙 §10.9, §10.12에 Phase 2 예정 표시 추가
9. **[선택]** DB 응답 컬럼 명시적 제한 (`select: { node: { id, type, label } }`)
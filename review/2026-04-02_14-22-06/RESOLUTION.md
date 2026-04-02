# Code Review Resolution

## WARNING 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `handleMouseUp` stale closure — localStorage에 잘못된 높이 저장 | `currentHeightRef = useRef(panelHeight)` 추가, `handleMouseMove`에서 ref 동기화, `useEffect` 의존성에서 `panelHeight` 제거 |
| 2 | `document.body.style` unmount 시 cleanup 누락 | `useEffect` cleanup에서 `isDragging.current` 확인 후 body style 강제 복원 추가 |
| 3 | Form 노드 `waiting_for_input` 상태가 타임라인에 미반영 | `handleWaitingForInput`에서 `updateNodeStatus()` + `addNodeResult()` 호출 추가 |
| 4 | 신규 UI 컴포넌트 5개 전체 테스트 없음 | `ResultTimeline` 테스트 6건, `ResultDetail` 테스트 6건 추가 |
| 5 | `waiting_for_input` 타임라인 상태 전환 테스트 누락 | `execution.waiting_for_input` 핸들러 테스트에 `nodeResults` + `nodeStatuses` 검증 추가 |
| 6 | WS 이벤트 순서 역전 시 status 덮어쓰기 | `STATUS_PRIORITY` 맵 + `shouldUpdateStatus()` 가드 추가, `handleNodeStarted`에서 priority 체크 |
| 7 | localStorage 값 상한 검증 누락 | `getStoredHeight()`에 `Number.isFinite()` + `maxHeight` 상한 검증 추가 |
| 8 | WS 수신 데이터 입력 검증 없음 | Phase 2 — 현재는 `?? "unknown"` fallback으로 방어. 서버 자체 데이터이므로 긴급도 낮음 |
| 9 | DOMPurify 허용 태그 미명시 | `SANITIZE_CONFIG`에 `ALLOWED_TAGS`, `ALLOWED_ATTR` 명시 추가 |
| 10 | `CATEGORY_COLORS` prototype pollution | Phase 2 — 현재 `CATEGORY_COLORS`는 const literal이므로 실제 위험 없음 |
| 11 | `formatDuration` 함수 3개 파일 중복 | `run-results/utils.ts`로 추출, 3개 파일에서 import |
| 12 | `PRESENTATION_TYPES` Set 재정의 | `nodeCategory === "presentation"` 조건으로 대체 |
| 13 | WS 계약 암묵적 breaking change | Phase 2에서 `shared/types/ws-events.ts` 인터페이스 정의 예정 |
| 14 | `NodeExecutionData.node.label` nullable 불일치 | Phase 2 — 현재 `?? nodeId` fallback 사용 |
| 15 | `relations: ['node']` 관계 정의 확인 | 확인 완료 — `NodeExecution` 엔티티에 `@ManyToOne(() => Node)` 데코레이터 존재 |

## INFO 이슈

대부분 Phase 2 개선 사항으로 이관. auto-select `useEffect` 최적화, WS outputData 대용량 전송 제한 등은 후속 작업에서 처리.

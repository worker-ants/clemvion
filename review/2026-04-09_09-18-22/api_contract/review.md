### 발견사항

---

**[WARNING] Carousel 버튼 포트 출력 형식에서 `clickedBy` 필드 제거 — Breaking Change**
- 위치: `spec/4-nodes/6-presentation-nodes.md` — 버튼 포트 출력 형식 섹션
- 상세: 기존 출력 형식에는 `"clickedBy": "user-uuid"` 필드가 있었으나, 이번 변경으로 해당 필드가 제거되고 `"selectedItem"` 필드로 대체됨. 이 포트 출력을 소비하는 다운스트림 노드(Code, Template, AI Agent Tool 등)가 `clickedBy`에 의존하고 있다면 런타임에 조용히 깨질 수 있음.
- 제안: `clickedBy`를 유지하되 `selectedItem`을 추가(non-breaking)하거나, 스키마 버전 분리 또는 마이그레이션 가이드를 스펙에 명시

---

**[WARNING] API 응답 래핑 불일치 — 실제 계약과 스펙 간 괴리**
- 위치: `spec/2-navigation/6-execution-history.md` §5 + 리뷰 파일들(maintainability, side_effect, security)
- 상세: 스펙은 `{ data: [...], pagination: {...} }` 형태를 명시하나, 실제 구현(`[executionId]/page.tsx`, `executions/page.tsx`)에서 `(data as any).data ?? data` 패턴이 반복 등장함. 이는 API가 때로 응답을 `{ data: T }` 래핑, 때로 `T` 직접 반환한다는 의미로, 스펙에 정의된 계약이 실제 런타임과 불일치함.
- 제안: 백엔드 응답 형식을 스펙대로 통일하거나, API 클라이언트 레이어(axios interceptor 또는 `executionsApi`)에서 한 곳에서만 정규화 처리

---

**[WARNING] 이전/다음 실행 탐색 전용 엔드포인트 미정의**
- 위치: `spec/2-navigation/6-execution-history.md` §5, §3.6
- 상세: §3.6에서 "같은 워크플로우의 시간 순서 기준으로 이전/다음 실행으로 이동"을 요구사항으로 명시하나, §5 API 엔드포인트 목록에 adjacent 전용 API가 없음. 프런트엔드는 이를 `limit: 100`으로 전체 목록을 가져와 클라이언트에서 탐색하는 방식으로 우회하고 있어, 100건 초과 시 기능이 깨짐.
- 제안: `GET /api/executions/:id/adjacent` 또는 `GET /api/executions/workflow/:workflowId?cursor=:id&limit=1` 형태의 커서 기반 API를 스펙에 추가

---

**[WARNING] `waiting_for_input` 상태가 필터 API에는 유효하나 UI에서 누락**
- 위치: `spec/2-navigation/6-execution-history.md` §2.3, requirement 리뷰
- 상세: 스펙 §2.3에서 `waiting_for_input` 필터를 명시하고 API의 `status` 파라미터로도 유효하나, 구현된 `FILTER_BUTTONS` 배열에 해당 항목이 없음. API 계약상 유효한 파라미터가 UI에서 노출되지 않아 사용자 접근 불가.
- 제안: `{ label: "Waiting", value: "waiting_for_input" }` 항목을 필터 버튼에 추가하여 스펙과 일치시킴

---

**[INFO] `buttonConfig.buttonItemMap` 필드가 WS 이벤트 페이로드에 추가 — 기존 소비자 영향 확인 필요**
- 위치: `spec/4-nodes/6-presentation-nodes.md` §1.3 Blocking Mode 2번 항목
- 상세: `execution.waiting_for_input` WebSocket 이벤트의 `buttonConfig`에 `buttonItemMap` 필드가 추가됨. Additive change이므로 기존 소비자가 이 필드를 무시하면 호환성은 유지되나, 스펙에 WS 이벤트 페이로드 전체 스키마가 명시되어 있지 않아 소비자가 인지하기 어려움.
- 제안: WS 이벤트 페이로드 스키마를 스펙에 명시하고 `buttonItemMap`의 타입(`Record<string, number>`)과 의미를 문서화

---

**[INFO] `NodeExecution.error` 필드가 skipped 상태에도 설정됨 — 기존 클라이언트 타입 정의 영향**
- 위치: `spec/5-system/3-error-handling.md` — Skip Node 정책
- 상세: 기존에는 `status: "skipped"` 노드의 `error` 필드가 null이라고 가정할 수 있었으나, 이번 변경으로 에러 정보가 보존됨. 프런트엔드 타입 정의(`NodeExecution.error`)가 `null | ErrorObject`로 이미 정의되어 있다면 무해하나, `null`로 단정하는 코드가 있다면 런타임 오류 가능.
- 제안: 프런트엔드 `NodeExecution` 타입에서 `error` 필드가 `null | ErrorObject`로 명시되어 있는지 확인

---

### 요약

이번 변경에서 가장 중요한 API 계약 이슈는 Carousel 버튼 포트 출력 형식에서 `clickedBy` 필드 제거로, 해당 필드를 소비하는 다운스트림 노드가 존재할 경우 Silent Breaking Change가 된다. 또한 실제 API 응답이 스펙에 정의된 형식과 다르게 래핑되어 오는 불일치 패턴(`data.data ?? data`)이 여러 리뷰어에 의해 독립적으로 확인되었으며, 이는 API 계약이 실제 구현과 괴리되어 있음을 시사한다. 이전/다음 실행 탐색 API가 스펙에 정의되지 않은 채 100건 제한 우회로 구현된 것도 계약 공백으로, 조기에 엔드포인트를 정의하는 것이 바람직하다.

### 위험도

**MEDIUM**
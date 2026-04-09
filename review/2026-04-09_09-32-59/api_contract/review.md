### 발견사항

---

**[WARNING] Carousel 버튼 포트 출력에서 `clickedBy` 필드 제거 — Breaking Change**
- 위치: `spec/4-nodes/6-presentation-nodes.md` §1.3 버튼 포트 출력 형식
- 상세: 기존 `"clickedBy": "user-uuid"` 필드가 `"selectedItem": { ... }`으로 교체됨. 이 필드를 소비하는 다운스트림 노드나 클라이언트가 있다면 런타임 오류 또는 undefined 접근이 발생함.
- 제안: 기존 필드를 유지(deprecated 표시)하거나, 스펙에 migration guide를 명시. 실행 엔진 버전 업 시 기존 저장된 `interaction_data` 스키마와의 호환성도 검토 필요.

---

**[WARNING] API 응답 래핑 불일치 — `data.data ?? data` 패턴**
- 위치: 여러 review 파일 공통 지적 (`[executionId]/page.tsx:109`, `executions/page.tsx:143`)
- 상세: 프론트엔드가 `(data as any).data ?? data`로 응답을 정규화하는 코드가 반복 등장. 이는 `GET /api/executions/:id`와 `GET /api/executions/workflow/:workflowId`가 응답을 `{ data: T }` 또는 `T` 두 가지 형태로 반환할 수 있음을 의미. API 계약이 확정되어 있지 않은 상태.
- 제안: API Convention(`spec/5-system/2-api-convention.md`)에 따른 단일 응답 구조(예: 항상 `{ data: T }` 또는 항상 plain `T`)로 통일하고, axios interceptor 또는 API 클라이언트 레이어에서 정규화.

---

**[INFO] `GET /api/executions/workflow/:workflowId`의 adjacent 탐색 한계가 API 계약에 미반영**
- 위치: `spec/2-navigation/6-execution-history.md` §3.6, §5
- 상세: 이전/다음 실행 네비게이션은 현재 `limit: 100`으로 전체 목록을 클라이언트에서 탐색하는 방식. API 스펙에는 이 한계(100건 초과 시 네비게이션 불가)가 명시되어 있지 않으며, 향후 `/executions/:id/adjacent` 엔드포인트 추가 시 기존 클라이언트 코드와의 계약 변경이 필요.
- 제안: 스펙 §3.6에 현재 구현 한계를 명시하거나, 처음부터 cursor 기반 API를 설계.

---

**[INFO] `buttonConfig.buttonItemMap` 신규 필드 — 하위 호환 AddOnly**
- 위치: `spec/4-nodes/6-presentation-nodes.md` §1.3 Blocking Mode 2단계
- 상세: 기존 `buttonConfig`에 `buttonItemMap` 필드가 추가됨. 이 필드를 읽지 않는 기존 클라이언트는 무시하므로 하위 호환성은 유지됨. 단, `NodeExecution.output_data` 스키마 변경이므로 저장된 기존 실행 데이터의 `buttonConfig`에는 해당 필드가 없음을 소비 측이 인지해야 함.
- 제안: 스펙에 optional 표시 및 하위 호환 명시 (`buttonItemMap?: Record<string, number>`).

---

### 요약

API 계약 관점에서 가장 중요한 이슈는 Carousel 노드의 버튼 포트 출력에서 `clickedBy` 필드가 삭제되는 breaking change다. 이 필드를 참조하는 다운스트림 노드가 있을 경우 런타임 오류가 발생한다. 두 번째로 `GET /api/executions` 계열 API가 응답을 `{ data: T }` 또는 `T`로 비일관되게 반환하는 패턴이 여러 리뷰어에 의해 독립적으로 발견되었으며, 이는 프론트엔드에서 `eslint-disable`과 `any` 캐스팅이 반복되는 근본 원인이다. 나머지 변경사항(스펙 문서 추가, `buttonItemMap` 필드 추가, `_selectedPort` 메타데이터 처리 명문화)은 모두 additive하여 기존 계약을 위반하지 않는다.

### 위험도

**MEDIUM**
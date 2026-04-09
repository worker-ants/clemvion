### 발견사항

---

**[WARNING] `spec/4-nodes/6-presentation-nodes.md`: 출력 형식에서 `clickedBy` 필드 제거**
- 위치: 버튼 포트 출력 형식 (~L109)
- 상세: 기존 `"clickedBy": "user-uuid"` 필드가 `"selectedItem": { ... }`으로 교체됨. 이 스펙을 참조하여 구현된 백엔드 핸들러나 프론트엔드 코드가 `clickedBy`를 읽고 있다면 런타임에 `undefined`가 반환되어 조용히 깨질 수 있음
- 제안: 기존 구현 코드에서 `clickedBy` 참조 여부를 grep으로 확인하고, 필요 시 마이그레이션 가이드 명시

---

**[WARNING] `spec/4-nodes/6-presentation-nodes.md`: Blocking Mode 활성화 조건 변경**
- 위치: §1.3 실행 로직 6번 항목
- 상세: 기존 조건 "글로벌 `buttons`가 비어있지 않은 경우" → "글로벌 `buttons` 또는 아이템 버튼이 하나라도 있는 경우"로 확장됨. `buttons: []`이지만 `itemButtons`가 설정된 기존 워크플로우가 이 스펙 기준으로 재실행되면 예상치 못하게 Blocking Mode로 진입할 수 있음
- 제안: 기존 저장된 워크플로우 데이터에서 `itemButtons`가 설정된 캐러셀 노드가 없는지 확인. 없다면 안전. 있다면 기존 실행이 달라질 수 있음을 경고

---

**[WARNING] `spec/4-nodes/6-presentation-nodes.md`: Dynamic 모드 데이터 소스 처리 변경**
- 위치: §1.3 실행 로직 3-1항
- 상세: 기존 "입력 데이터에서 배열 추출(최상위가 배열이 아닌 경우 배열 필드 자동 탐색)" → "`source` 표현식이 설정되어 있으면 resolve된 결과 사용, 미설정 시 입력 데이터 직접 사용(하위호환)"으로 변경. 기존 워크플로우에서 `source` 미설정 시 입력 데이터를 직접 사용하는 경로는 유지되지만, "배열 필드 자동 탐색" 로직이 사라져 최상위가 배열이 아닌 기존 입력이 깨질 수 있음
- 제안: 하위호환 경로에서 "배열 필드 자동 탐색" 동작 유지 여부를 명시적으로 결정하고 스펙에 기술

---

**[WARNING] `side_effect/review.md`: `currentIndex === -1` 시 잘못된 prev/next 반환**
- 위치: `[executionId]/page.tsx:137-143`
- 상세: 이미 리뷰에서 지적됨. `items[-1 + 1]` = `items[0]`이 반환되는 것은 실제 부작용임. 사용자가 prev 버튼 클릭 시 전혀 다른 실행으로 이동하는 **데이터 오염 부작용**이 발생
- 제안: `if (currentIndex === -1) return { prev: null, next: null };` 즉시 적용

---

**[WARNING] `testing/review.md` + `side_effect/review.md`: `vi.clearAllMocks()` 모듈 레벨 mock 소실**
- 위치: `execution-detail-page.test.tsx`, `execution-list-page.test.tsx` `beforeEach`
- 상세: `vi.clearAllMocks()`가 모듈 레벨 `mockResolvedValue` 구현을 제거함. 이는 **테스트 실행 순서에 따라 결과가 달라지는 비결정적 부작용**으로, CI 환경에서 플레이키 테스트를 유발. 두 리뷰 모두 독립적으로 이를 발견함
- 제안: `beforeEach` 내에서 mock 구현을 명시적으로 재설정

---

**[INFO] `spec/2-navigation/0-dashboard.md`: 대시보드 행 클릭 동작 변경**
- 위치: §5 최근 실행 이력 테이블 동작
- 상세: 기존 "성공 → 실행 상세 뷰, 실패 → 디버그 뷰(실패 노드 하이라이트)" → 단일 경로 `/workflows/:workflowId/executions/:executionId`로 통합. 디버그 뷰로의 별도 라우팅 코드가 있다면 dead code가 됨
- 제안: 대시보드 컴포넌트에서 `status === "failed"` 분기 라우팅 코드 제거 여부 확인

---

**[INFO] `spec/5-system/3-error-handling.md`: Skip Node 시 `error` 필드 보존 추가**
- 위치: §3.1 정책별 동작 - Skip Node 분기
- 상세: `NodeExecution.error = { message: "..." }` 보존이 명시됨. 기존 Skip Node 구현이 `error` 필드를 null로 두고 있다면 마이그레이션이 필요. 실행 내역 UI가 skipped 상태에서 `error` 필드를 렌더링하지 않도록 처리되어 있는지 확인 필요
- 제안: 실행 상세 페이지에서 `status === "skipped"` + `error` 존재 시 UI 표시 여부를 스펙에 명시

---

### 요약

이번 변경사항의 핵심 부작용 위험은 **스펙 변경으로 인한 기존 구현과의 불일치**에 집중된다. Presentation 노드 스펙에서 출력 포맷의 `clickedBy` 제거, Blocking Mode 활성화 조건 확장, Dynamic 모드 배열 탐색 로직 변경은 기존 저장된 워크플로우 및 실행 이력 처리 코드에 조용한 파괴를 일으킬 수 있다. 구현 코드 레벨에서는 `adjacentQuery`의 `currentIndex === -1` 처리 누락이 실제 잘못된 페이지 이동을 유발하는 가장 즉각적인 부작용이며, `vi.clearAllMocks()` 패턴은 CI 비결정성 부작용을 유발한다.

### 위험도

**MEDIUM**
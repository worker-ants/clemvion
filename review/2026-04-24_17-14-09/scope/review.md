## 발견사항

### **[INFO]** `CandidateLookupService` 의 중복 slice
- **위치**: `candidate-lookup.service.ts` — `lookupIntegrations`, `lookupLlmConfigs`, `lookupKnowledgeBases` 내부
- **상세**: 쿼리 DTO에 `limit: MAX_CANDIDATES`를 이미 전달해 DB에서 최대 20개만 가져오는데, `result.data.slice(0, MAX_CANDIDATES)`를 다시 호출한다. 중복이지만 방어적 코드라 런타임 영향은 없다.
- **제안**: DB limit 과 slice 중 하나만 유지하거나, 주석으로 "서비스가 limit을 무시할 경우 보호용" 임을 명시.

### **[INFO]** `evaluateReviewGuard`에서 모든 노드 후보 사전 조회
- **위치**: `workflow-assistant-stream.service.ts:1301~1320`
- **상세**: 리뷰 가드 실행 시 캔버스의 **모든** non-trigger 노드에 대해 `Promise.all`로 후보 조회를 병렬 수행한다. 대형 워크플로에서 노드 수가 많으면 N개의 DB 쿼리가 동시에 발생한다. 현재 스펙(ED-AI-39) 범위 내 설계이나 향후 성능 병목 가능성이 있다.
- **제안**: 당장 수정 필요는 없으나, 후속 이슈로 "PENDING_USER_CONFIG_UNMENTIONED 관련 노드만 lazy 조회" 최적화를 트래킹할 것.

### **[INFO]** `assistant-message.tsx` 컴포넌트·주석 순서 역전
- **위치**: `assistant-message.tsx:144~153`
- **상세**: `<CandidatePickers />` 렌더 후에 해당 컴포넌트를 설명하는 JSX 주석이 따라온다. 관례적으로 주석은 해당 블록 위에 위치하는 것이 가독성에 유리하다.
- **제안**: 주석을 `<CandidatePickers />` 위로 이동. 기능상 영향 없음.

---

## 요약

20개 파일 전체가 **ED-AI-39 (in-message candidate picker)** 스펙 구현에 직접 귀속된다. 백엔드의 `CandidateLookupService` 신규 추가, `detectPendingUserConfig`의 `candidates` 필드 확장, `review-workflow`의 가드 완화, 3개 노드 스키마의 `integrationServiceType` 힌트 주입, 프런트엔드의 `CandidatePicker` 컴포넌트·스토어 액션·i18n 키 추가까지 모두 스펙 경계 안에 있다. 의도와 무관한 리팩토링, 불필요한 파일 수정, 과도한 기능 추가는 발견되지 않는다. 위 세 가지는 모두 코드 품질 차원의 소견이며 범위 위반은 아니다.

## 위험도

**NONE**
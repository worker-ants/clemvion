### 발견사항

- **[INFO]** `workflow-view.spec.ts` 신규 파일 추가
  - 위치: `backend/src/modules/workflow-assistant/tools/workflow-view.spec.ts` (전체 파일)
  - 상세: 기존 spec 파일에 케이스를 추가하는 대신 독립 spec 파일을 신규 생성. `toWorkflowView`는 이전에 전용 테스트가 없었으므로 이 추가는 적절하며, 3개 케이스 모두 `width/height` 패스스루 동작을 검증하는 기능 범위 내 테스트임.
  - 제안: 현 상태 유지 — 단위 테스트 커버리지 확보는 범위 이탈이 아닌 품질 강화.

### 요약

10개 파일의 모든 변경사항이 "React Flow 측정값(`width`/`height`)을 프론트엔드에서 백엔드로 전달해 LLM 레이아웃 계산에 활용한다"는 단일 기능 목표에 직결된다. 데이터 흐름(`AssistantPanel` 스냅샷 빌드 → DTO → `toShadowSnapshot` → `ShadowNode` 인터페이스 → `toWorkflowView` → 시스템 프롬프트 JSON) 전 계층이 일관되게 수정되었고, 기능과 무관한 리팩토링·포맷팅 변경·불필요한 임포트·의도 이상의 확장은 발견되지 않았다. `ShadowWorkflow.addNode`에 `width/height` 세터가 없는 것도 "AI가 방금 추가한 노드는 측정값 없음" 정책을 의도적으로 유지한 것으로 스펙과 일치한다.

### 위험도

**NONE**
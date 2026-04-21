### 발견사항

- **[INFO]** `width`/`height` 필드 추가 — 완전한 하위 호환성 유지
  - 위치: `assistant-message-request.dto.ts` L56–70
  - 상세: `@IsOptional()` 데코레이터로 선언되어 기존 클라이언트는 필드 누락 상태로 계속 동작 가능. Breaking change 없음.
  - 제안: 이상 없음.

- **[INFO]** 범위 검증 없음 (`@Min`/`@Max` 미적용)
  - 위치: `assistant-message-request.dto.ts` L60, L68
  - 상세: `@IsNumber()`만 적용되어 음수 또는 비정상적으로 큰 값(예: `width: -999`, `width: 999999`)이 허용됨. 이 값은 DB에 저장되지 않고 LLM 시스템 프롬프트에만 주입되므로 실질적 피해는 제한적이나, 프롬프트 인젝션 방어 측면에서 아쉬움이 있음.
  - 제안: `@Min(0) @Max(10000)` 정도의 범위 검증 추가 권장 (물리적으로 합리적인 캔버스 픽셀 범위).

- **[INFO]** 프론트엔드 타입 캐스팅 방식
  - 위치: `assistant-panel.tsx` L102–107
  - 상세: React Flow v12 `n.measured` 접근에 `as { measured?: ... }` 타입 어서션 사용. React Flow 버전이 변경되면 조용히 `undefined`를 반환해 폴백 동작으로 전환됨. 런타임 오류는 발생하지 않고 서버에서 250×80 폴백을 적용하므로 계약상 문제 없음.
  - 제안: 이상 없음 (방어적 설계가 이미 적용됨).

- **[INFO]** `null` 대신 필드 누락 방식의 직렬화
  - 위치: `workflow-view.ts` L52–53, `workflow-assistant-stream.service.ts` L744–745
  - 상세: `...(typeof n.width === 'number' ? { width: n.width } : {})` 패턴으로 미측정 노드는 `"width": null` 없이 필드 자체를 생략. OpenAPI 스키마(`ApiPropertyOptional`)와 일치하고 프롬프트 토큰 절약에도 유리한 올바른 선택.
  - 제안: 이상 없음.

- **[INFO]** 스펙 문서(`4-ai-assistant.md`) 동기화 확인
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md` L259–263, L395
  - 상세: 요청 본문 인터페이스와 레이아웃 지침 섹션이 구현과 일치하도록 갱신됨. 계약 문서와 구현 간 정합성 양호.
  - 제안: 이상 없음.

---

### 요약

이번 변경은 `AssistantWorkflowNodeDto`에 `width?`·`height?` 선택 필드를 추가해 React Flow의 렌더링 측정값을 LLM 레이아웃 힌트로 전달하는 API 계약 확장이다. 모든 신규 필드는 `@IsOptional()`로 선언되어 기존 클라이언트 호환성을 완전히 유지하며, 프론트엔드·DTO·ShadowNode·WorkflowView·시스템 프롬프트까지 데이터 흐름 전체가 일관된 방식(측정 전이면 필드 자체 누락)으로 구현되어 있다. 스펙 문서도 동기화되었고 단위 테스트가 측정/비측정 혼합 시나리오를 명시적으로 검증한다. 유일한 소규모 개선점은 `@Min(0)` 등의 범위 검증 추가인데, 이 필드가 DB가 아닌 LLM 프롬프트에만 사용된다는 점에서 보안 위험은 낮다.

### 위험도

**LOW**
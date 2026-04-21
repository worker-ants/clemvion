## 부작용 코드 리뷰

### 발견사항

- **[INFO]** `ShadowWorkflow.addNode`가 `width`/`height`를 설정하지 않음
  - 위치: `shadow-workflow.ts` — `addNode` 메서드
  - 상세: LLM이 같은 턴에 추가한 노드는 shadow에 `width`/`height` 없이 생성됨. 의도된 동작이며 시스템 프롬프트의 fallback 안내(`250×80`)로 처리됨.
  - 제안: 이슈 없음. 현재 동작이 정확히 맞음.

- **[INFO]** 프론트엔드의 React Flow 버전 분기 타입 캐스팅
  - 위치: `assistant-panel.tsx:106-110`
  - 상세: `n as { measured?: ... }` 캐스팅이 TypeScript 컴파일 검사를 우회함. React Flow가 v12 → v13으로 업그레이드될 때 `measured` API가 변경되어도 컴파일 에러 없이 조용히 `undefined`로 폴백됨.
  - 제안: 향후 버전 업그레이드 시 이 분기 코드를 명시적으로 확인해야 한다는 주석이나 TODO가 있으면 유지보수에 도움됨. 현재 로직 자체는 안전하게 설계되어 있음.

- **[INFO]** `width`/`height`에 대한 입력값 범위 검증 없음
  - 위치: `assistant-message-request.dto.ts:56-68`
  - 상세: `@IsNumber()`만 있고 `@Min(1)` 같은 범위 제약이 없음. 음수나 비정상적으로 큰 값도 수락됨. 이 값들은 LLM 레이아웃 힌트로만 사용되어 비즈니스 로직에는 영향 없음.
  - 제안: 실용적 위험은 낮지만, `@IsPositive()` 또는 `@Min(1)` 추가를 고려할 수 있음.

- **[INFO]** 토큰 사용량 소폭 증가
  - 위치: `workflow-view.ts` — `toWorkflowView`, `system-prompt.ts`
  - 상세: 노드가 측정된 경우 스냅샷 JSON에 `"width": N, "height": N`이 추가됨. 최대 500개 노드 기준 최대 ~5KB 증가. 프롬프트 캐시 적중률에는 영향 없음(캐시 키가 변경되지 않음).
  - 제안: 허용 범위 내. 이슈 없음.

- **[INFO]** 세션 히스토리에 저장되지 않는 일시적 데이터
  - 위치: `workflow-assistant-stream.service.ts:742-744`
  - 상세: `width`/`height`는 `ShadowSnapshot` 초기화에만 사용되고 DB에 저장되지 않음. 기존 저장된 세션과 완전한 하위 호환성이 유지됨.
  - 제안: 이슈 없음.

---

### 요약

이번 변경은 React Flow의 실측 노드 크기(`width`/`height`)를 프론트엔드 → DTO → ShadowSnapshot → 시스템 프롬프트로 흘려 LLM의 레이아웃 계산 정확도를 높이는 기능이다. 모든 인터페이스 변경이 **옵션 필드 추가** 방식이어서 기존 클라이언트와 저장된 세션에 하위 호환성이 완전히 유지된다. `undefined`일 때 필드를 아예 누락하는 스프레드 패턴(`typeof n.width === 'number' ? { width: n.width } : {}`)이 일관되게 적용되어 프롬프트 JSON 오염이 방지된다. 의도하지 않은 전역 상태 변경, 파일시스템 접근, 외부 네트워크 호출, 이벤트 변경 등의 부작용은 존재하지 않는다. React Flow 버전 분기 캐스팅과 범위 미검증 정도가 낮은 수준의 유지보수 리스크로 남는다.

### 위험도

**LOW**
### 발견사항

- **[INFO]** 템플릿 노드 출력 응답 구조 유지 확인
  - 위치: `template.handler.ts`
  - 상세: 리팩토링 전후 모두 `{ type: 'template', format: string, content: string }` 구조를 반환하므로 클라이언트 API 계약은 유지됨
  - 제안: 해당 없음

- **[WARNING]** 템플릿 표현식 미해석 시 동작 변경 (잠재적 breaking change)
  - 위치: `execution-engine.service.ts:530-568`, `expression-exclusions.ts`
  - 상세: 기존 핸들러의 자체 파서는 미정의 변수를 빈 문자열(`''`)로 처리했음. 이제 표현식 엔진이 처리하므로, 미정의 참조(`{{ nonExistent.field }}`)는 예외를 발생시킬 수 있음. 기존 워크플로우 데이터에 `{{ simple_var }}` 형태의 표현식이 저장되어 있다면, 엔진이 `$` prefix 없는 변수를 root-level spreading 방식으로 처리하는지 여부에 따라 기존 동작과 달라질 수 있음
  - 제안: 마이그레이션 가이드 또는 기존 워크플로우 데이터 호환성 검증 필요. 최소한 표현식 에러 시 fallback(빈 문자열 처리) 정책을 명시적으로 문서화해야 함

- **[INFO]** WebSocket 이벤트 계약 변경 없음
  - 위치: `websocket.gateway.spec.ts`
  - 상세: 타입 캐스팅 수정(`jest.Mock`)만 이루어졌으며 WebSocket 이벤트 스키마나 핸들러 인터페이스에 변경 없음

### 요약

이번 변경은 HTTP API 엔드포인트나 WebSocket 이벤트 스키마에 직접적인 변경을 가하지 않으며, 템플릿 노드의 출력 구조(`{ type, format, content }`)도 그대로 유지된다. 다만 `expression-exclusions.ts`에서 `template` 제외 항목을 삭제하고 실행 엔진이 직접 표현식을 처리하게 되면서, 기존에 자체 파서가 암묵적으로 처리하던 미정의 변수의 에러 동작이 달라질 수 있다. 이는 API 응답 구조 변경이 아닌 실행 동작의 변경이므로 직접적인 API contract 위반은 아니나, 이미 저장된 워크플로우 데이터와의 호환성 측면에서 주의가 필요하다.

### 위험도
LOW
### 발견사항

- **[WARNING]** `LLM_CONFIG_NOT_FOUND` 에러 응답 페이로드 구조 변경
  - 위치: `backend/src/modules/llm/llm.service.ts` — `resolveConfig` 메서드
  - 상세: `message` 필드가 영문 고정 문자열에서 한국어 동적 문자열로 변경됨. 동시에 `workspaceId` 필드가 에러 객체에 신규 추가됨.
    ```
    // Before
    { code: "LLM_CONFIG_NOT_FOUND", message: "No LLM config specified..." }
    // After  
    { code: "LLM_CONFIG_NOT_FOUND", message: "워크스페이스(ws-1) 에 기본 LLM...", workspaceId: "ws-1" }
    ```
  - 제안: `code` 필드는 변경되지 않았으므로 코드 기반 에러 핸들링 클라이언트는 영향 없음. 그러나 `message` 문자열을 파싱하거나 표시하는 외부 클라이언트(모바일, 서드파티 통합 등)가 있다면 language change + format change 가 breaking임. 공개 API라면 버전 분리 또는 `Accept-Language` 헤더 기반 분기를 권장함.

- **[INFO]** 실행 엔진 검증 동작 변경 — AI 노드 `INVALID_NODE_CONFIG` 조건부 억제
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` — 노드 실행 전 validation 블록
  - 상세: 기존에는 `handler.validate()` 가 오류를 반환하면 항상 `INVALID_NODE_CONFIG` 에러를 throw했으나, 이제 AI 3종 노드에서 `no-llm-provider` 오류가 발생하고 워크스페이스에 기본 LLM이 있으면 해당 오류를 무시하고 실행을 계속함. 실행 API(`POST /executions`)의 응답 코드·구조는 변하지 않지만, 이전에 실패했던 워크플로우가 이제 성공하는 동작 변화가 있음.
  - 제안: 의도된 개선이므로 문제없음. 다만 실행 결과를 모니터링하는 클라이언트가 "AI 노드 + LLM 미지정 → 항상 실패"를 가정하고 알림을 구성했다면 재검토 필요. Changelog에 명시 권장.

- **[INFO]** `workspaceId` 필드 신규 추가 — 하위 호환
  - 위치: `resolveConfig` 에러 응답
  - 상세: 기존 필드(`code`, `message`) 제거 없이 `workspaceId`만 추가되므로, 엄격하지 않은(lenient) JSON 역직렬화 클라이언트에는 영향 없음. 엄격한 스키마 검증(e.g. JSON Schema `additionalProperties: false`)을 사용하는 클라이언트만 영향받음.
  - 제안: 무관. 단, OpenAPI 스펙이 있다면 에러 스키마에 `workspaceId` 추가 필요.

---

### 요약

이번 변경사항에서 HTTP 엔드포인트 추가·삭제, 경로 변경, 요청 파라미터 변경은 없다. 핵심 API 계약 이슈는 `LLM_CONFIG_NOT_FOUND` 에러의 `message` 필드가 영문에서 한국어로 교체되고 포맷이 동적으로 바뀐 것으로, `code` 기반 에러 핸들링 클라이언트에는 무해하나 메시지 문자열에 의존하는 클라이언트가 있다면 breaking change에 해당한다. 실행 엔진의 검증 억제 로직은 외부 API 형태가 아닌 내부 동작 변경이며 의도된 UX 개선이다. 전반적으로 내부 서비스 간 계약 및 UI 레이어 개선이 중심이고 공개 API 계약의 위험도는 낮다.

### 위험도
LOW
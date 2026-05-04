### 발견사항

- **[WARNING]** `execution.ai_message` WebSocket 계약의 Breaking Change — 하위 호환성 미보장
  - 위치: `use-execution-events.ts` (handleAiMessage), 테스트 파일 2 (test title 변경)
  - 상세: `messages` 필드가 없는 `ai_message` 페이로드에 대해 기존에는 assistant 메시지 단건 append(fallback)로 처리했으나, 이번 변경 이후 **프로덕션에서 무음 드롭(silent drop)**으로 동작함. 배포 순서가 프론트→백 또는 백→프론트 비원자적으로 진행될 경우, 전환 기간 동안 AI 응답이 사용자에게 전혀 노출되지 않는 창(window)이 생김.
  - 제안: 배포 원자성 보장 또는 롤아웃 기간 동안 deprecation 로그를 `production` 환경에서도 유지하는 전환 기간 설정.

- **[WARNING]** 계약 파기 확인 수단이 주석 단언에만 의존
  - 위치: `use-execution-events.ts` L312 주석 `"must NOT carry the legacy flat fields requestPayload / responsePayload that no shipping frontend reads"`
  - 상세: `requestPayload` / `responsePayload` 최상위 필드 제거가 "어떤 배포된 클라이언트도 읽지 않는다"는 전제에 기반하지만, 이를 기술적으로 강제하는 수단이 없음. 백엔드 테스트(파일 1)가 `not.toHaveProperty('requestPayload')`로 방출 부재를 검증하나, 클라이언트(프론트) 측 수신 코드에는 이 필드가 여전히 타입 정의에 남아 있어(`llmCalls` 타입 내부) 혼동 소지가 있음.
  - 제안: 타입 정의에서도 제거된 필드를 삭제해 계약 불일치를 컴파일 타임에 드러내도록 수정.

- **[WARNING]** 프로덕션 환경에서 계약 위반 페이로드가 무음 처리됨
  - 위치: `use-execution-events.ts` L319–L327 (`process.env.NODE_ENV !== "production"` 분기)
  - 상세: `messages`가 없는 페이로드는 프로덕션에서 경고 없이 드롭됨. 백엔드 버그로 인해 잘못된 페이로드가 전송될 경우, 사용자는 AI 응답을 볼 수 없지만 에러 시그널이 전혀 없음. WebSocket 계약 위반 감지를 위한 모니터링/메트릭 연동이 없음.
  - 제안: 에러 추적 서비스(Sentry 등)에 계약 위반 이벤트를 프로덕션에서도 기록하도록 추가.

- **[INFO]** WebSocket 채널에 버전 관리 없음
  - 위치: `use-execution-events.ts` (`execution:${executionId}` 채널)
  - 상세: `execution.ai_message` 이벤트의 payload 스키마가 변경되었으나, 채널/이벤트명에 버전 정보가 없어 구형 클라이언트(캐시된 JS 번들 등)와의 혼용 시나리오에서 무언의 계약 파기가 발생할 수 있음.
  - 제안: 이벤트 페이로드에 `schemaVersion` 필드 추가 또는 채널 네임스페이스 버저닝 고려.

- **[INFO]** 백엔드 테스트의 계약 검증 범위가 emit 지점에 한정됨
  - 위치: `execution-engine.service.spec.ts` 신규 describe 블록
  - 상세: 백엔드 통합 테스트가 `emitExecutionEvent` 호출 인자 shape을 검증하는 것은 적절하나, 실제 WebSocket 직렬화 이후 클라이언트 수신 레이어까지의 E2E 계약 검증이 없음. `llmCalls` 내 `requestPayload`/`responsePayload`의 민감 정보(프롬프트 내용 등) 노출 범위도 이 계약에서 명시되지 않음.
  - 제안: 스펙 문서(`spec/5-system/6-websocket-protocol.md §4.4`)에 페이로드 필드 목록과 민감 데이터 취급 정책을 명시.

---

### 요약

이번 변경은 `execution.ai_message` WebSocket 이벤트 계약을 `messages` 배열 필수 포함 방향으로 강화하고, 레거시 flat 필드(`requestPayload`/`responsePayload`)를 공식 제거하는 작업이다. 백엔드-프론트엔드 양단이 동시에 변경되어 의도는 일관되나, **비원자적 배포 시 AI 응답 무음 소실** 위험과 **프로덕션 환경에서 계약 위반을 관측할 수단 부재**가 주된 API 계약 리스크다. 채널 버저닝이 없으므로 롤링 배포 환경에서는 구형 백엔드가 전송한 `messages`-없는 페이로드가 신형 프론트엔드에서 드롭되는 시나리오를 배포 계획 수립 시 명시적으로 고려해야 한다.

### 위험도

**MEDIUM**
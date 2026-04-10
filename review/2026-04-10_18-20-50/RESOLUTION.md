# 코드 리뷰 이슈 조치 내용

## Critical 발견사항

### #1. 서비스 레이어 SRP 위반 (아키텍처)
**조치**: `TransformInterceptor`에서 `'error' in data` 조건을 제거하여 모든 응답이 일관되게 `{ data: ... }`로 래핑되도록 수정. 서비스 레이어에서 HTTP 응답 봉투(`{ data: ... }`)를 직접 반환하던 코드를 제거하고, 도메인 객체만 반환하도록 복원.
- `backend/src/common/interceptors/transform.interceptor.ts` - `'error' in data` 체크 제거
- `backend/src/modules/llm/llm.service.ts` - `{ data: { success: ... } }` → `{ success: ... }`로 원복

### #2. 프론트엔드 이중 언래핑 패턴 (아키텍처)
**조치**: 인터셉터 수정으로 서버 응답이 일관되므로, `data?.data ?? data` 방어 코드 대신 `data.data`로 직접 접근하도록 변경.
- `frontend/src/lib/api/llm-configs.ts` - `data.data` 접근으로 단순화

## Warning 발견사항

### #1. continueExecution 비동기 처리
**조치**: `ExecutionEngineService.continueExecution()`은 `void` 반환(동기)이므로, `await`가 아닌 NestJS의 동기 예외 처리에 위임. 메서드 시그니처에서 불필요한 `async` 제거.
- `backend/src/modules/executions/executions.controller.ts`

### #2. LLM 에러 메시지 추상화 (보안)
**조치**: `LlmService.sanitizeErrorMessage()` 메서드 추가. 401, 403, 404, 429, timeout, ECONNREFUSED, ENOTFOUND 등 주요 에러 패턴을 사용자 친화적 메시지로 변환. 원본 에러는 서버 로그에만 기록.
- `backend/src/modules/llm/llm.service.ts`

### #3. OAuth state 토큰 서버 저장 (보안)
**조치 보류**: OAuth 기능 자체가 TODO 상태이며, 실제 구현 시 Redis/DB 기반 state 저장 및 콜백 검증을 함께 구현 필요. 별도 이슈로 추적.

### #4. OAuth 환경변수 미설정 검증 (보안)
**조치 완료**: `process.env[CLIENT_ID]` 미설정 시 `BadRequestException` throw로 변경. 빈 문자열 fallback 제거.
- `backend/src/modules/integrations/integrations.service.ts`

### #5. formData 검증 (보안)
**조치 보류**: `continueExecution`의 `formData`는 워크플로우별로 동적 스키마가 적용되므로, 정적 DTO 검증이 적합하지 않음. 실행 엔진 내부에서 노드별 스키마 기반 검증으로 처리 필요. 별도 이슈로 추적.

### #6-7. 동일 서비스/컨트롤러 내 응답 포맷 불일치 (일관성)
**조치**: `TransformInterceptor` 수정으로 모든 응답이 일관되게 `{ data: ... }`로 래핑됨. 서비스 레이어에서 래핑 책임 제거.

### #8. 프론트엔드 integrations 클라이언트 수정 누락 (부작용)
**조치**: 확인 결과 integrations 프론트엔드의 `testMutation`은 응답 body를 읽지 않고 `onSuccess`/`onError` 콜백만 사용하므로 수정 불필요.

### #9-11. 누락 테스트 (테스트)
**조치 완료**:
- `backend/src/modules/executions/executions.controller.spec.ts` - 신규 작성 (3 tests)
- `backend/src/modules/integrations/integrations.service.spec.ts` - 신규 작성 (4 tests)
- `backend/src/common/interceptors/transform.interceptor.spec.ts` - 신규 작성 (6 tests)
- `backend/src/modules/llm/llm.service.spec.ts` - 에러 메시지 추상화 관련 테스트 케이스 추가 (4 tests → 7 tests)

### #12. integrations testConnection TODO 미구현 (미구현)
**조치 보류**: 기존 TODO 상태 유지. 각 서비스 타입별 실제 연결 테스트 구현은 별도 작업으로 진행.

## 검증 결과
- Lint: 에러 0건 (기존 warning만 존재)
- TypeScript: backend/frontend 모두 통과
- 테스트: 52 suites, 665 tests 전체 통과

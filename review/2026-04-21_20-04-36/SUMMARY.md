# Code Review 통합 보고서

## 전체 위험도
**LOW** - 신규 테스트 파일로 직접적인 보안·런타임 위험은 없으나, abort 시뮬레이션 신뢰성, 조건부 guard 내 silent pass, 멀티턴/도구 경로 미검증 등 테스트 품질 개선 여지가 있음

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | abort 테스트가 `throw new Error('aborted')`로 예외를 발생시키는데, 실제 SDK AbortSignal은 `DOMException(AbortError)`를 던짐. `signal.aborted` 플래그 기반 검증인지 에러 메시지 파싱인지 불명확하여 구현 변경 시 테스트가 잘못 통과될 수 있음 | `yields done with finishReason="aborted"` 테스트 | 표준 `DOMException` with `AbortError` name 패턴 시뮬레이션 또는 `signal.aborted` 체크 방식 명시적 문서화 |
| 2 | Testing | `tool_call_delta`/`tool_call_end` id 검증이 `if (delta?.type === ... && end?.type === ...)` 가드 안에 위치하여, 타입 불일치 시 `expect`가 실행되지 않고 silent pass 발생 가능 | `tool_call_delta` 테스트 143–147줄 | 가드 전에 `expect(delta?.type).toBe('tool_call_delta')`를 먼저 assert하거나 타입 단언 후 접근 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Maintainability / Dependency | 에러 케이스 3곳(401, 429, abort)에서 SDK stub 패턴(`client.genAI = { getGenerativeModel: ... }`)이 인라인 중복. `makeClientWithStreamResult` 헬퍼가 있음에도 미사용 | 오류 시나리오 테스트 3개 | `makeClientWithRejectedStream(error: Error)` 헬퍼 추출로 중복 제거 |
| 2 | Architecture / Security / Dependency | `@ts-expect-error`로 `client.genAI` 내부 필드를 직접 overwrite. 필드명 변경 시 테스트가 조용히 깨지며, 프로덕션 코드의 `genAI`가 충분히 보호되지 않으면 외부 교체 벡터가 될 수 있음 | `makeClientWithStreamResult`, 각 인라인 stub | `GoogleClient` 생성자에 SDK 인스턴스 주입을 허용하도록 리팩토링 |
| 3 | Requirement / Testing | `role: 'system'` 메시지가 `startChat`의 `systemInstruction`으로 올바르게 변환되는지 검증 없음 | `describe('GoogleClient.stream')` 전체 | `role: 'system'` 메시지 포함 케이스에서 `startChat` 호출 인수 검증 테스트 추가 |
| 4 | Requirement / Testing | `role: 'assistant'` 메시지가 Gemini history의 `role: 'model'`로 변환되는지 검증 없음 | `describe('GoogleClient.stream')` 전체 | 멀티턴 user/assistant 교차 메시지에서 `startChat`의 `history` 파라미터 검증 테스트 추가 |
| 5 | Requirement / Testing | `role: 'tool'` 메시지(function response)가 Gemini `functionResponse` 파트로 변환되는지 검증 없음 | `describe('GoogleClient.stream')` 전체 | `role: 'tool'` 포함 멀티턴에서 `sendMessageStream` 호출 내용 검증 테스트 추가 |
| 6 | Requirement / Testing | `tools` 파라미터가 `getGenerativeModel`에 올바르게 전달되는지 검증 없음 | `describe('GoogleClient.stream')` 전체 | `tools` 배열 포함 요청에서 `getGenerativeModel` mock 호출 인수 검증 테스트 추가 |
| 7 | Testing | 단일 청크에 `functionCall`이 여러 개 포함된 경우(parallel tool calling) 이벤트 순서 미검증 | `tool_call_delta+tool_call_end` 테스트 | `parts: [{ functionCall: ... }, { functionCall: ... }]` 포함 청크 테스트 추가 |
| 8 | Maintainability | `'gemini-2.5-flash'` 모델 식별자가 모든 테스트 케이스에 하드코딩 반복 | 전체 파일 | 파일 상단 `const TEST_MODEL = 'gemini-2.5-flash'` 상수로 추출 |
| 9 | Security | `new GoogleClient('test-key', ...)` 패턴이 반복되어 API 키 하드코딩 습관 형성 위험 | 전체 파일 | `const TEST_API_KEY = 'test-key'` 상수 또는 `process.env.TEST_API_KEY ?? 'test-key'` 패턴으로 분리 |
| 10 | Testing | 중간 청크에 partial usage가 포함된 경우 마지막 청크 우선인지 누적인지 구현 동작 미검증 | 전체 spec | 중간 usage 포함 청크 시나리오 테스트 추가 |
| 11 | Testing | `asyncIter`가 `throw` 시나리오를 지원하지 않아 에러 케이스마다 inline iterator를 별도 작성 | `asyncIter` 함수 (4–15줄) | `throwAt` 옵션 파라미터 추가 또는 `errorIter` 헬퍼 분리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | `genAI` 필드 접근 수준 확인 필요, 에러 메시지 파싱 기반 분류 취약성, API 키 리터럴 패턴 |
| Maintainability | LOW | 에러 케이스 SDK stub 중복 3곳, 모델명 하드코딩 반복 |
| Requirement | LOW | system/assistant/tool 역할 변환, tools 파라미터 전달 검증 누락 |
| Testing | LOW | abort 시뮬레이션 신뢰성, silent pass 위험, 멀티턴·복수 tool call 미검증 |
| Architecture | LOW | `@ts-expect-error` 내부 필드 직접 조작, SDK 의존성 주입 구조 부재 |
| Dependency | NONE | 외부 의존성 추가 없음, `@ts-expect-error` 스텁 방식은 개선 여지 있음 |
| Concurrency | NONE | 비동기 처리 안전, abort 전파 경로 시뮬레이션 방식 차이는 INFO 수준 |
| Performance | NONE | 테스트 코드 특성상 무시 가능한 수준 |
| Documentation | NONE | 기존 주석 적절, 테스트 케이스명이 명세 역할 수행 |
| Side Effect | NONE | 전역 상태 변경·네트워크 호출 없음, 완전 격리 |
| Scope | NONE | 변경 범위 이탈 없음, 단일 목적에 집중 |
| API Contract | NONE | 해당 없음 (HTTP API 엔드포인트 무관) |
| Database | NONE | 해당 없음 (데이터베이스 무관) |

---

## 발견 없는 에이전트

- **API Contract** — HTTP API 엔드포인트/라우팅/인증 관련 요소 없음
- **Database** — 데이터베이스 관련 코드 없음
- **Scope** — 변경 범위 이탈 없음

---

## 권장 조치사항

1. **[WARNING] abort 테스트 신뢰성 강화** — `abort.abort()` 후 `throw new Error('aborted')` 패턴이 실제 SDK의 `DOMException(AbortError)` 동작을 정확히 시뮬레이션하는지 확인하고, `signal.aborted` 기반 분기 여부를 테스트에서 명시적으로 검증
2. **[WARNING] silent pass 제거** — `tool_call_delta`/`tool_call_end` id 검증을 조건부 guard 바깥으로 분리하여 타입 불일치 시 테스트가 명시적으로 실패하도록 수정
3. **[INFO] 에러 케이스 헬퍼 추출** — `makeClientWithRejectedStream(error: Error)` 헬퍼를 추가하여 3곳의 인라인 SDK stub 중복 제거
4. **[INFO] 멀티턴 메시지 변환 테스트 추가** — `system`/`assistant`/`tool` 역할 메시지가 Gemini `systemInstruction`/`history`/`functionResponse`로 올바르게 변환되는지 검증 (워크플로우 어시스턴트의 핵심 경로)
5. **[INFO] `GoogleClient` 의존성 주입 검토** — `genAI` 내부 필드를 생성자 주입으로 교체하면 `@ts-expect-error` 없이 타입 안전한 테스트 가능, 프로덕션 코드의 `private readonly` 선언 여부도 함께 확인
6. **[INFO] 상수 추출** — `'gemini-2.5-flash'`를 `TEST_MODEL` 상수로, `'test-key'`를 `TEST_API_KEY` 상수로 파일 상단에 추출
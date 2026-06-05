# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] `conversation_thread` 컬럼이 공개 API 응답 DTO 에 노출되지 않음 — 의도적 설계 확인
- 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (ExecutionDto, ExecutionDetailDto)
- 상세: `execution.entity.ts` 에 추가된 `conversationThread: ConversationThread | null` 컬럼이 API 응답 DTO(`ExecutionDto`, `ExecutionDetailDto`)에 포함되지 않는다. 이는 내부 엔진 복원 전용 필드로 외부에 노출할 의도가 없음을 의미하며, 기존 API 클라이언트에 어떠한 응답 형식 변화도 없다. 단, 의도적 제외임을 DTO 파일이나 entity 주석에 명시하면 향후 기여자의 오인 추가를 방지할 수 있다.
- 제안: `execution.entity.ts` 의 `conversationThread` 필드 주석에 "API 응답 DTO 에 포함하지 않음 — 내부 rehydration 전용" 한 줄을 추가.

### [INFO] `rehydrateConversationThread` 가 `unknown` 입력을 수용 — 외부 API 입력 경로는 없음
- 위치: `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts:992–1030`
- 상세: 함수가 `unknown` 타입 raw 를 받아 JSONB 역직렬화 결과를 정규화한다. 이 함수는 외부 HTTP 요청 처리 경로가 아닌 DB 컬럼 로드 경로에서만 호출되므로 API 요청 검증 관점 위험은 없다. JSONB 손상 케이스(turns 가 배열이 아닌 경우 등)에 graceful fallback 이 모두 구현되어 있다.
- 제안: 해당 없음.

## 요약

이번 변경(PR-A1)은 실행 엔진 내부의 durable park/resume 메커니즘 구현으로, 신규 `conversation_thread JSONB` 컬럼을 DB에 추가하고 엔진 내부에서 읽고 쓰는 경로만 포함한다. 모든 공개 API 엔드포인트(`/executions`, `/executions/:id` 등)의 응답 DTO는 변경되지 않았으며, 기존 HTTP 인터페이스(URL 설계, 요청 파라미터, 응답 스키마, 에러 응답, 상태 코드, 인증/인가, 페이지네이션)에 어떠한 변화도 없다. 마이그레이션은 nullable 컬럼 추가(ADD COLUMN ... NULL)로 기존 row 에 대해 완전 하위 호환이다. API 계약 관점에서 breaking change 또는 위험 요소는 없다.

## 위험도

NONE

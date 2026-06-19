# API 계약(API Contract) 리뷰 결과

## 발견사항

- **[INFO]** `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` 신규 추가 — 가산적(additive) 변경
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` +279
  - 상세: `WORKFLOW_FORBIDDEN_WORKSPACE` 에러 코드가 Sub-Workflow 노드의 error port 를 통해 API 응답(실행 결과 페이로드)에 노출된다. 기존 클라이언트가 알 수 없는 에러 코드를 관대하게(lenient) 처리한다면 하위 호환성에 문제 없음. 단, 클라이언트가 에러 코드 목록을 exhaustive하게 열거(enum/switch 기반 분기)하는 경우 `default` 브랜치로 폴백되므로 실질적인 breaking change 는 아니지만 예상치 못한 코드 노출이다.
  - 제안: 클라이언트(frontend, channel-web-chat SDK) 에서 에러 코드를 switch/enum 으로 처리하는 곳에 `WORKFLOW_FORBIDDEN_WORKSPACE` 케이스를 추가하고, API 문서(spec)에 신규 에러 코드를 기록할 것을 권장한다.

## 해당 없는 관점

다음 8개 점검 항목 중 이번 변경과 무관한 항목:

1. **하위 호환성**: 에러 코드 신규 추가는 가산적 변경(INFO 수준). breaking change 없음.
2. **버전 관리**: API 버전 변경 없음. 해당 없음.
3. **응답 형식**: HTTP 응답 구조 변경 없음. 내부 실행 엔진 결과 페이로드에 새 에러 코드가 추가되는 수준이며 스키마 구조 자체는 동일.
4. **에러 응답**: 에러 응답 형식 HTTP 상태 코드 변경 없음. 기존 Sub-Workflow 에러 포트 패턴 유지.
5. **요청 검증**: 요청 매개변수/바디 유효성 검증 변경 없음.
6. **URL/경로 설계**: URL 경로 변경 없음.
7. **페이지네이션**: 목록 API 변경 없음.
8. **인증/인가**: 인증/인가 레이어 변경 없음.

## 요약

이번 변경은 내부 실행 엔진의 generic `Error` 를 typed `WorkflowForbiddenWorkspaceError` 로 승격하고, 내부 AI 에이전트 핸들러의 로컬 타입을 공유 `LlmCallRecord` 로 정규화하며, 프론트엔드 내부 인터페이스를 `TurnDebugEntry` 에서 `TurnRagDelta` 로 rename 하는 내부 리팩토링이다. 외부 노출 REST API 엔드포인트, HTTP 응답 스키마, URL 경로, 인증/인가 레이어에 대한 변경은 없다. 유일한 API 계약 접점은 `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` 신규 추가인데, 이는 기존 에러 코드 집합에 코드를 추가하는 가산적 변경이며 기존 클라이언트가 `default` 폴백을 가지고 있는 한 하위 호환성을 깨지 않는다. 전반적으로 API 계약 위험은 매우 낮다.

## 위험도

LOW

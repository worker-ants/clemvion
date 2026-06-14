# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [WARNING] 신규 ErrorCode 2건 추가 — backend-labels.ts ERROR_KO 매핑 누락

- **변경 파일**: `codebase/backend/src/nodes/core/error-codes.ts`
- **매트릭스 항목**: `new-error-code` — "신규 errorCode 발행 (ErrorCode enum 추가)"
  - targets: "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)"
- **누락된 동반 갱신**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 테이블
- **신규 코드**:
  - `EXECUTION_INTERNAL_ERROR` — 비-typed 에러의 generic fallback errorCode (WS continuation ack)
  - `EXECUTION_MESSAGE_TOO_LONG` — 메시지 길이 초과 errorCode (WS continuation ack)
- **상세**:
  두 코드 모두 `ERROR_KO` 테이블에 등록되지 않았다. 매트릭스 `new-error-code` trigger 의 glob `codebase/backend/src/nodes/core/error-codes.ts` 에 정확히 매칭된다.

  완화 요인: 두 코드는 WebSocket continuation ack 경계 코드로, 노드 handler output 코드와 경로가 다르다.
  - `EXECUTION_INTERNAL_ERROR`: gateway 가 고정 fallback 문자열('Form submission failed')을 직접 ack 에 넣으므로 ERROR_KO 미등록 시에도 해당 고정 문자열이 노출된다. 단, frontend 가 errorCode 를 별도 렌더링하거나 토스트 메시지를 ERROR_KO 로 조회하는 경우 미번역 영문 코드가 그대로 노출될 수 있다.
  - `EXECUTION_MESSAGE_TOO_LONG`: MessageTooLongError.message 가 고정 영문('Message exceeds the maximum allowed length.')이며, gateway 는 이 영문 문자열을 그대로 ack 에 실어 보낸다. frontend 가 ERROR_KO[errorCode] 로 한국어를 조회한다면 미등록으로 영문이 노출된다.

  매트릭스 타겟 주석이 "후속 plan 에서 ERROR_KO 신설 검토" 로 즉각 차단이 아님을 명시하고 있으므로 WARNING 으로 분류. 단, PR 본문에 "사용자 가시 ko 노출 여부" 명시 의무는 매트릭스가 요구하는 즉각 동반 액션이다.

- **제안**:
  1. PR 본문에 두 errorCode(EXECUTION_INTERNAL_ERROR, EXECUTION_MESSAGE_TOO_LONG)가 사용자에게 한국어로 노출되는 경로를 명시한다 (frontend 가 ERROR_KO 로 조회하는지, 직접 message 필드를 표시하는지).
  2. frontend 가 errorCode 를 ERROR_KO 로 조회하는 경로가 있다면 같은 PR 또는 직후 plan 에서 아래 항목을 /Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts ERROR_KO 에 추가한다:
     - EXECUTION_INTERNAL_ERROR: 예) "요청을 처리하는 중 내부 오류가 발생했어요. 잠시 후 다시 시도해 주세요."
     - EXECUTION_MESSAGE_TOO_LONG: 예) "메시지가 최대 허용 길이를 초과했어요."
  3. backend-labels.test.ts P3-C-2 가드가 user-facing 코드를 강제하는 경우, 두 코드가 user-facing 대상에 포함되는지 확인하고 포함된다면 테스트 통과를 보장한다.

---

## 매칭되지 않은 항목 (영역 무관 확인)

나머지 변경 파일들은 다음 trigger 와의 매칭을 검토했다:

| 파일 | 검토한 trigger | 판정 |
|---|---|---|
| workflow-errors.ts / workflow-errors.spec.ts | new-node, node-schema-change, run-debug-flow-change, expression-language-change | 매칭 없음 — execution-engine 내부 typed error 리팩터 (사용자 가시 실행 흐름 동작 변경 없음) |
| execution-engine.service.ts / .spec.ts | run-debug-flow-change (semantic) | 무관 — 사용자 가시 실행·디버깅 흐름 변경이 아닌 에러 객체 타입 교체 (동작 동일, 에러 message 문자열만 고정화) |
| websocket.gateway.ts / .spec.ts | auth-session-flow-change | 무관 — 인증·세션 흐름 아님; continuation ack 에러 분기 내부 구현 변경 |

---

## 요약

매트릭스 총 19개 row 중 1개 trigger(new-error-code, glob 매칭)가 활성화됐다. codebase/backend/src/nodes/core/error-codes.ts 에 EXECUTION_INTERNAL_ERROR, EXECUTION_MESSAGE_TOO_LONG 2개 ErrorCode 가 신규 추가됐으나, codebase/frontend/src/lib/i18n/backend-labels.ts 의 ERROR_KO 테이블에 대응 한국어 매핑이 없다. 매트릭스가 즉각 차단이 아닌 "후속 plan 검토" 를 명시하고 있어 WARNING 1건으로 분류하나, PR 본문에 ko 노출 경로 명시 의무 이행이 필요하다.

## 위험도

WARNING

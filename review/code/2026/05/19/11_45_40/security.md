# 보안(Security) 리뷰 — execution-engine.service.ts

## 발견사항

### [INFO] `sanitizeLastErrorMessage` 크로스-모듈 임포트
- **위치**: diff line +35 (`import { sanitizeLastErrorMessage } from '../integrations/integration-oauth.service'`)
- **상세**: OAuth 전용 모듈에서 정의된 `sanitizeLastErrorMessage` 를 execution-engine 에서 직접 임포트한다. 현재 구현은 `Bearer`, `client_secret`, `access_token`, `refresh_token`, `id_token`, `api_key`, `password`, `passwd`, `pwd`, `secret`, `Authorization:` 헤더 패턴을 마스킹하며 LLM 오류 메시지에 적용되고 있어 보안 의도 자체는 적절하다. 다만 sanitizer 가 OAuth 서비스에 묶여 있어 패턴 업데이트 범위가 OAuth 리뷰 범위에만 주목될 위험이 있다. 기능적 취약점은 아니나, 장기적으로 공유 유틸리티로 분리하면 유지보수성과 보안 일관성이 향상된다.
- **제안**: `codebase/backend/src/shared/security/sanitize-error-message.ts` 등 공통 위치로 이동하고, OAuth 서비스와 execution-engine 모두 해당 모듈에서 임포트하도록 변경한다.

---

### [INFO] `extractAiTurnErrorPayload` — 비-Error 객체의 `JSON.stringify` 노출
- **위치**: diff lines +227~229 (`rawMessage = JSON.stringify(err)`)
- **상세**: `err` 가 `Error` 인스턴스도 string도 primitive도 아닌 경우(예: 커스텀 객체) `JSON.stringify(err)` 로 직렬화한다. 이 경우 객체 내 중첩된 민감 필드(예: 인증 토큰, 자격증명이 담긴 응답 객체)가 문자열로 변환된 뒤 뒤이어 `sanitizeLastErrorMessage` 를 통과한다. 현재 sanitize 패턴이 올바르게 적용되므로 실질적 노출은 차단되지만, sanitize 패턴 누락 시 원시 시크릿이 로그·DB에 저장될 수 있다. 패턴 커버리지가 완전하지 않을 경우의 잠재적 리스크다.
- **제안**: 비-Error throw 시 `JSON.stringify` 대신 타입·키만 요약하는 안전한 직렬화 함수를 사용하거나, 신뢰할 수 없는 객체에 대해서는 `'[non-Error throw: object]'` 같은 고정 문자열로 대체하여 sanitize 패턴 의존도를 낮춘다.

---

### [INFO] `handleAiTurnError` — `err.code` 무검증 전달
- **위치**: diff lines +231~242 (`code = explicitCode`)
- **상세**: `err.code` 를 `string` 타입 여부만 확인 후 그대로 `errorPayload.code` 로 전달한다. `err.code` 는 외부 라이브러리나 네트워크 응답에서 기원할 수 있으며, `LLM_RATE_LIMIT` / `AI_AGENT_TURN_FAILED` 같은 내부 enum 이 아닌 임의의 문자열이 그대로 WebSocket 이벤트(`NODE_FAILED` payload의 `error` 필드)를 통해 클라이언트에 전달된다. 현재 code 필드 자체가 민감 정보를 담을 가능성은 낮지만, 외부에서 주입된 코드 값이 프론트엔드 UI 분기나 로그 집계에 영향을 줄 수 있다.
- **제안**: 허용 code 목록(allowlist)을 정의하고, `err.code` 가 목록 외 값이면 fallback(`AI_AGENT_TURN_FAILED`)을 사용하도록 제한한다.

---

### [INFO] `finalizeAiNode` FAILED 분기 — `output` 데이터 클라이언트 전송
- **위치**: diff lines +333~348 (`this.eventEmitter.emitNode(..., { output: nodeExec.outputData, input: nodeExec.inputData, ... })`)
- **상세**: `NODE_FAILED` 이벤트에 `output: nodeExec.outputData` 와 `input: nodeExec.inputData` 가 포함된다. `outputData` 에는 sanitize 가 적용된 오류 페이로드가 담기지만, `inputData` 는 노드 입력 데이터(사용자 메시지, 워크플로우 변수 등)를 포함할 수 있다. COMPLETED 분기의 동일 이벤트에서도 같은 구조를 사용하므로 기존 동작과 일관성이 있으나, 민감 데이터가 inputData에 포함될 경우 WebSocket 구독자에게 노출된다. 이는 변경된 코드에서 새로 도입된 위험이 아니라 기존 패턴의 동일 적용이다.
- **제안**: `input` / `output` 필드를 이벤트에 포함하기 전, PII나 자격증명이 포함될 수 있는 필드에 대한 sanitize 정책이 있는지 확인한다. 기존 COMPLETED 이벤트와 동일 처리를 적용하고 있으므로 신규 취약점은 아니다.

---

### [INFO] `handleAiTurnError` — logger.error 에 sanitize 적용됨을 확인
- **위치**: diff lines +163~167
- **상세**: 로그 출력 시 `errorPayload.message` 를 사용하며, 이 값은 이미 `extractAiTurnErrorPayload` → `sanitizeLastErrorMessage` 를 거친 값이다. 민감 정보 로그 노출이 방지되어 있다.
- **제안**: 없음. 현재 구현 양호.

---

### [INFO] `_resumeState` strip — credential 내부 state 노출 차단
- **위치**: diff lines +183~187 (`const { _resumeState: _stripped, ...safe } = adapted`)
- **상세**: `_resumeState` 는 시스템 프롬프트, llmConfigId 등 내부 필드를 포함하여 클라이언트에 전달되지 않도록 strip 한다. 이 패턴이 error 경로에서도 정상적으로 적용되고 있다.
- **제안**: 없음. 현재 구현 양호.

---

## 요약

이번 변경은 AI Agent multi-turn 대화 중 핸들러 오류(LLM 429 등) 발생 시 노드/실행 상태를 FAILED 로 올바르게 전이하는 오류 처리 경로를 추가한다. 보안 관점에서 주요 위험을 방지하는 장치들이 적절히 배치되어 있다: `sanitizeLastErrorMessage` 로 토큰·시크릿 echo 차단, `_resumeState` DB/클라이언트 strip, 오류 메시지 길이 상한(200자) 적용. 중요한 취약점이나 하드코딩된 시크릿은 없다. 발견된 항목 모두 INFO 등급으로, 개선하면 보안 견고성이 높아지지만 즉각적 조치를 요하는 위험은 없다. `sanitizeLastErrorMessage` 의 크로스-모듈 의존과 비-Error throw 시 `JSON.stringify` 경로에서 패턴 누락 시 잠재적 시크릿 노출 가능성이 있어 장기적 개선이 권장된다.

## 위험도

LOW

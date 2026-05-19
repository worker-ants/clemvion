# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `finalStatus` 변수 선언부 인라인 주석 — 날짜 하드코딩 스타일
- 위치: diff 행 `+    // 2026-05-19 — spec/4-nodes/3-ai/1-ai-agent.md §7.9. handleAiMessageTurn`
- 상세: 날짜(2026-05-19)를 주석에 직접 박아 넣는 방식이 이 파일 전반에 걸쳐 사용되고 있다. 단기적으로는 변경 출처 추적이 가능하지만, 코드가 리팩터링·이동되면 날짜가 오해를 유발할 수 있다. 이 프로젝트는 이미 동일 패턴을 사용하는 기존 주석이 많아 일관성 문제는 없으나, 코드 자체가 git blame 으로 시점을 알 수 있으므로 날짜 반복은 인라인 주석보다 JSDoc `@since` 나 커밋 메시지에 두는 것이 더 명확하다.
- 제안: 필수 변경 사항은 아니며, 프로젝트 관행을 따르면 수용 가능하다. 향후 주석 규약 정비 시 날짜를 주석에서 제거하고 spec 참조 링크만 남기는 방향을 고려한다.

### [INFO] `handleAiTurnError` JSDoc — 복귀 흐름 설명은 충분하나 파라미터 태그 부재
- 위치: diff 행 `+  /**` (line ~2128, `handleAiTurnError` 메서드 JSDoc)
- 상세: 메서드 동작, 호출 조건, 사이드이펙트(cache 갱신, event emit, throw)를 상세히 설명하고 있다. 그러나 `@param` 태그가 없어 IDE 의 hover-doc 에서 파라미터 설명이 표시되지 않는다. `executionId`, `node`, `resumeState`, `nodeExec`, `err`, `handler` 각각의 역할 — 특히 `nodeExec` 가 `null` 일 수 있는 이유 — 이 파라미터 목록에서 명시적으로 나타나지 않는다.
- 제안: 기존 `finalizeAiNode` JSDoc 과 같은 수준으로 맞추기 위해 `@param nodeExec` 에 "null 허용 — conversation 진입 전 NodeExecution 생성이 실패한 경우"와 같이 nullable 이유를 명시하면 향후 유지보수에 유리하다. 필수는 아님.

### [INFO] `extractAiTurnErrorPayload` JSDoc — `details` sanitization 이중 직렬화 로직 설명 부족
- 위치: diff 행 `+  /**` (line ~2196, `extractAiTurnErrorPayload` 정적 메서드 JSDoc)
- 상세: `code` 추출 우선순위와 `message` sanitization 은 JSDoc 에 명확히 기술되어 있다. 그러나 `details` 처리에서 `JSON.stringify → sanitizeLastErrorMessage → JSON.parse` 의 이중 직렬화 경로는 JSDoc 에 언급이 없고, 인라인 주석도 없다. 이 패턴은 직관적이지 않아 (sanitize 함수가 문자열 치환을 하므로 JSON 구조를 파괴할 가능성 여부) 독자가 의도를 파악하기 어렵다.
- 제안: JSDoc 의 `details` 항목에 "JSON.stringify → token-sanitize → JSON.parse 경로로 details 내 secret echo 를 차단한다" 한 줄을 추가한다.

### [INFO] `finalizeAiNode` JSDoc 업데이트 — FAILED 분기 설명이 추가됐으나 `@param finalStatus` 누락
- 위치: diff 행 `+   * 2026-05-19 — `finalStatus` 추가 (spec §7.9)...`
- 상세: 기존 JSDoc 끝에 FAILED 분기 동작을 한 단락으로 보완한 점은 적절하다. 그러나 `finalizeAiNode` 의 파라미터 목록에 새로 추가된 `finalStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED'` 에 대한 `@param` 설명이 없다. 기존 파라미터들도 `@param` 이 없으므로 이 파일의 일반적 스타일과는 일치하지만, 기본값이 있는 선택적 파라미터임을 JSDoc 에서 명시하면 호출자가 "생략 시 기존 동작 유지"를 바로 알 수 있다.
- 제안: `@param [finalStatus='COMPLETED'] FAILED 시 NodeExecution·Execution 을 FAILED 로 전이. 생략 시 기존 COMPLETED 경로.` 형태로 보완한다. 필수는 아님.

### [INFO] `handleAiTurnError` 내부 인라인 주석 `WARN #6` 참조 — 대응 원본 주석 확인 필요
- 위치: diff 행 `+      // WARN #6 — `_resumeState` 는 DB 영속 페이로드에서 strip...`
- 상세: 기존 파일 전반에 걸쳐 `WARN #1`, `WARN #4`, `WARN #6` 등 번호 기반 WARNING 주석이 사용되고 있다. `WARN #6` 의 원본 정의가 `finalizeAiNode` 에 있는데, 새 `handleAiTurnError` 에서 동일 번호를 재사용하며 같은 의미를 cross-reference 하고 있다. 이 패턴은 기존 관행과 일치하므로 문제는 없으나, `WARN #6` 정의 위치(원본)와 사용 위치(신규 헬퍼)가 다른 함수로 분리됐음에도 로컬 주석이 간략하여 독자가 원본 맥락을 찾아야 한다.
- 제안: 기존 관행 유지로 충분하나, `// WARN #6 — (원본: finalizeAiNode 의 _resumeState strip 참조)` 식으로 원본 위치를 힌트로 남기면 더 친절하다.

### [WARNING] `sanitizeLastErrorMessage` cross-module import — 문서화 gap
- 위치: diff 행 `+import { sanitizeLastErrorMessage } from '../integrations/integration-oauth.service';`
- 상세: `sanitizeLastErrorMessage` 는 `integration-oauth.service.ts` 에서 export 되고 있으나, 함수명과 파일 위치 사이에 의미적 불일치가 있다. OAuth 서비스가 범용 sanitize 유틸리티를 export 하는 구조는 모듈 경계를 흐리며, 이를 사용하는 측(`execution-engine.service.ts`)에 주석이나 문서가 없으면 신규 개발자가 "왜 AI 오류 처리에서 OAuth 모듈을 import 하는가"를 이해하지 못한다. 현재 변경 diff 에는 이 import 에 대한 설명이 전혀 없다.
- 제안: import 행 위에 `// sanitizeLastErrorMessage 는 token/secret 문자열 치환 유틸리티로 integration-oauth.service 에 위치하나 범용 사용 가능 (TODO: shared util 로 이동 검토)` 형태의 짧은 주석을 추가한다. 중기적으로는 해당 함수를 `shared/utils/sanitize.ts` 로 이동하고 spec 또는 README 에 "cross-service sanitize 규약" 항목을 추가하는 것이 권장된다.

### [INFO] spec/4-nodes/3-ai/1-ai-agent.md §7.9 참조 — spec 문서 자체 업데이트 검토 필요
- 위치: 코드 전반의 `spec §7.9` 참조 주석
- 상세: 새로 추가된 FAILED 분기(`handleAiTurnError`, `finalizeAiNode` FAILED 경로, `finalStatus` 신호 전달) 는 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 를 근거로 구현됐다고 여러 주석에서 명시하고 있다. 그러나 이번 변경이 spec 에서 파생됐는지, 아니면 구현 후 spec 에 소급 반영이 필요한지가 변경 diff 만으로는 불명확하다. spec §7.9 가 이미 이 오류 경로를 기술하고 있지 않다면 spec 업데이트가 누락된 것이다.
- 제안: `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 가 `handleAiTurnError` 흐름, `finalStatus='FAILED'` 신호, `endMultiTurnConversation(state, 'error', errorPayload)` 호출 shape 을 포함하고 있는지 확인한다. 누락되어 있으면 spec 문서에 §7.9 의 오류 포트 흐름 다이어그램 또는 설명을 보완해야 한다.

### [INFO] CHANGELOG 업데이트 필요성
- 위치: 프로젝트 루트 또는 `plan/` 디렉토리
- 상세: 이번 변경은 AI Agent 노드가 LLM 429 / timeout 오류 발생 시 `WAITING_FOR_INPUT` 상태에 영구 잔류하던 회귀를 수정하는 중요한 버그픽스다. 사용자에게 노출되는 동작(frontend "실패" 표시 + 노드 "Waiting" 모순 해소)이 변경되므로 CHANGELOG 또는 `plan/complete/` 의 작업 문서에 이 수정을 기록해야 한다. 현재 변경 diff 에 CHANGELOG 또는 plan 문서 업데이트가 포함되어 있지 않다.
- 제안: `plan/in-progress/<task>.md` 또는 완료 후 `plan/complete/<task>.md` 에 "AI Agent FAILED 분기 — LLM 오류 시 WAITING_FOR_INPUT 영구 잔류 회귀 수정 (2026-05-19)" 항목을 추가한다.

### [INFO] `buildConversationConfigFromOutput` — 신규 `error` 포트 출력 shape 미반영
- 위치: `buildConversationConfigFromOutput` 함수 (기존 코드, 변경 없음)
- 상세: 이 함수는 `output.result.*` 를 읽어 WS 이벤트 `conversationConfig` 를 구성한다. 새로운 `error` 포트 종료 경로(`endMultiTurnConversation(state, 'error', errorPayload)`)는 `output.error` + 부분 `output.result.*` 를 병존시키는 shape 을 가진다(JSDoc 에서 언급됨). 그러나 `buildConversationConfigFromOutput` 의 JSDoc 에는 이 `error` 포트 shape 과의 관계 — "error 종료 시 이 함수가 호출되는가, 호출되지 않는가" — 가 언급되어 있지 않다. `handleAiTurnError` 에서는 `buildConversationConfigFromOutput` 을 호출하지 않으므로 실제 동작은 올바르지만, 문서상 gap 이 존재한다.
- 제안: `buildConversationConfigFromOutput` JSDoc 에 `@remarks error 포트 종료 경로(handleAiTurnError)에서는 이 함수가 호출되지 않는다. output.error shape 에 대한 conversationConfig 구성은 클라이언트 미지원.` 한 줄을 추가한다.

---

## 요약

이번 변경은 AI Agent 노드의 multi-turn 오류 처리를 보완하는 버그픽스로, 신규 메서드(`handleAiTurnError`, `extractAiTurnErrorPayload`)와 기존 메서드 확장(`finalizeAiNode`, `handleAiMessageTurn`)으로 구성된다. JSDoc 수준은 이 파일의 기존 관행에 부합하며 동작 근거와 spec 참조가 충실하게 기록되어 있다. 핵심 문서화 gap 은 두 가지다: (1) `sanitizeLastErrorMessage` 를 OAuth 서비스에서 cross-import 하는 이유에 대한 주석 부재 — 신규 개발자 혼란 유발 가능성이 있어 WARNING 수준으로 판단한다. (2) `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 와 `plan/` 문서에 이번 오류 경로 추가와 버그픽스가 반영되어 있는지 확인이 필요하다. 나머지 발견사항은 모두 INFO 수준으로 기능 동작에는 영향이 없다.

## 위험도

LOW

# 신규 식별자 충돌 검토 — naming_collision

대상: `spec/3-workflow-editor/` (impl-done, diff-base `origin/main`, target 워크트리
`assistant-mask-leak-e36aa6`). 실제 코드 diff 는 5개 backend 파일에 국한된다
(`mask-sensitive-fields.util.ts` / `.spec.ts`, `handler-output.adapter.spec.ts`,
`workflow-assistant/tools/explore-tools.service.ts` / `.spec.ts`). spec 쪽은
`spec/3-workflow-editor/4-ai-assistant.md` §4.1.1, `spec/5-system/14-external-interaction-api.md`,
`spec/2-navigation/_product-overview.md`, `spec/conventions/egress-masking.md` 4개 문서가
이미 코드와 일치하는 서술로 갱신돼 있다(이번 target 세션과 별도로 이미 커밋됨).

## 발견사항

- **[WARNING]** `redactAssistantFields` 가 기존 `redactStoredFieldsForResponse` 와 이름·shape·목적이 겹쳐 혼동 위험
  - target 신규 식별자: `redactAssistantFields` — `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:83`(신설, non-export). 시그니처 `(row: {inputData?, outputData?, error?}) => {inputData, outputData, error}`, 구현은 `deepRedactSecrets(maskSensitiveFields(v))` — **키 축 + 값 축 2겹**.
  - 기존 사용처: `codebase/backend/src/shared/utils/redact-stored-error.ts:97` 의 `redactStoredFieldsForResponse` (그리고 자매 `redactNodeExecutionRow:163`) — **동일한 파라미터/반환 shape** `{inputData, outputData, error}` 을 갖고, `executions.service.ts`(§1005, §1069)·`background-runs.service.ts`(§302) 의 REST 실행 응답에서 쓰인다. 단 구현은 `deepRedactSecrets` **한 겹뿐**(`maskSensitiveFields` 미적용).
  - 상세: 두 함수는 이름의 어휘("redact" + "…Fields…")·파라미터/반환 shape·대상 엔티티(Execution/NodeExecution 의 `inputData`/`outputData`/`error` 3필드)가 사실상 동일한데, 실제 보안 동작은 다르다 — `redactAssistantFields` 는 키-이름 매칭(`DEFAULT_SENSITIVE_KEYS`)까지 먼저 적용해 리스트에 있는 키는 무조건 `"***"` 로 뭉개고, `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 는 값-패턴(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`)만 본다. 이 저장소는 "자매" 헬퍼가 생길 때마다 JSDoc 으로 서로를 `{@link …}` 교차 인용하는 관례가 확립돼 있다(`redactNodeExecutionRow` docstring 이 `redactStoredFieldsForResponse` 를 명시 인용하는 것이 그 예). 그러나 `redactAssistantFields` 의 docstring·`spec/3-workflow-editor/4-ai-assistant.md` §4.1.1·`spec/conventions/egress-masking.md` 어디에도 `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 를 인용하지 않는다(grep 확인, 0건). 다음 사람이 "실행 3필드를 마스킹하는 함수"를 찾다가 둘 중 하나만 보고 재사용하면, 의도한 보안 수준(2겹 vs 1겹)이 조용히 바뀔 수 있다.
  - 제안: `redactAssistantFields` docstring 에 "자매는 `redactStoredFieldsForResponse`(REST 응답 경로) — 이쪽은 채팅에 원문 렌더되므로 키 축을 추가로 겹친다" 류의 교차 인용을 추가하거나, 함수명을 `redactAssistantExecutionFields` 처럼 더 구체화해 REST 쪽 헬퍼와 시각적으로 덜 겹치게 한다. (non-export 라 컴파일/런타임 충돌은 없음 — 순수 가독성·유지보수 리스크.)

- **[INFO]** 신규 `token` 계열 마스킹 키 8종은 기존 사용처와 충돌 없음 (검증 완료)
  - target 신규 식별자: `DEFAULT_SENSITIVE_KEYS` 에 추가된 `csrfToken`/`csrf_token`/`authToken`/`auth_token`/`sessionToken`/`session_token`/`idToken`/`id_token` (`mask-sensitive-fields.util.ts`).
  - 기존 사용처: `git grep` 로 backend 전역을 확인한 결과 이 8개 키 이름이 노드 config 필드·DTO·엔티티 컬럼으로 **다른 의미로** 쓰이는 곳은 없다. `csrfToken` 은 `websocket.service.ts`/`sanitize-error-message.ts` 의 `CREDENTIAL_KEY_PATTERN` 계열과 이미 같은 의미(자격증명)로 쓰이고 있어 정합적이다.
  - 상세: diff 자체의 주석이 이미 "정적 config 필드명 전수 grep → 충돌 0건" 실측을 남겼고(§`mask-sensitive-fields.util.ts` 신규 주석), 독립적으로 재확인해도 동일하다. 유일한 근접 후보는 `http-request.handler.ts` 의 `auth_token`(URL 쿼리파라미터 블랙리스트, 다른 목적) 이며 이 키는 `maskSensitiveFields` 대상 오브젝트 키가 아니라 별건이라 충돌이 아니다.
  - 제안: 조치 불요. 참고용으로 기록.

- **[INFO]** 요구사항 ID·API endpoint·이벤트명·파일 경로 축은 충돌 없음
  - `ED-AI-37`(민감 필드 마스킹) 은 이번 diff 로 신설된 ID 가 아니라 `spec/3-workflow-editor/_product-overview.md:237` · `4-ai-assistant.md:795` 에 기존부터 유일하게 정의돼 있고 본문(§4.1.1) 갱신과 1:1로 일치한다.
  - 이번 target 은 REST/SSE endpoint, webhook/queue/SSE 이벤트명, ENV 변수, 신규 spec 파일을 하나도 도입하지 않는다 — 기존 5개 코드 파일만 수정.
  - `plan/complete/assistant-mask-leak.md` · `plan/complete/spec-update-assistant-masking.md` 파일명은 기존 `plan/complete/` 하위 어떤 파일과도 겹치지 않으며, 인접 PR `masking-gate-consolidation.md` 와도 구분된다.

## 요약

이번 target 의 실질 diff 는 backend 5개 파일에 국한된 좁은 보안 패치(`token` 접두 계열 키 마스킹 확장 + workflow-assistant 실행 조회 도구에 `deepRedactSecrets` 값-패턴 마스킹 추가)이며, 관련 spec 4개 문서는 이미 코드와 일치하도록 갱신되어 있다. 요구사항 ID(`ED-AI-37`)·신규 마스킹 키 8종·파일 경로·API/이벤트 표면 모두 기존 사용처와 실질적 충돌이 없음을 확인했다. 유일하게 주목할 점은 신설된 비-export 헬퍼 `redactAssistantFields` 가 기존 `redactStoredFieldsForResponse`(및 `redactNodeExecutionRow`)와 이름·파라미터 shape·대상 필드가 겹치면서도 실제 마스킹 강도(2겹 vs 1겹)가 다르고, 이 저장소의 확립된 "자매 함수 상호 인용" 관례가 이 쌍에는 적용되지 않았다는 점이다 — 컴파일/런타임 충돌은 아니지만 향후 유지보수 시 혼동·오사용 소지가 있어 WARNING 으로 기록한다.

## 위험도

LOW

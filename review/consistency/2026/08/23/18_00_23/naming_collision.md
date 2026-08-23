# 신규 식별자 충돌 검토 — spec/3-workflow-editor/ (impl-done, diff-base=origin/main)

## 검토 범위 확인

`git diff origin/main...HEAD --stat` 로 실측한 변경 파일은 다음 9개뿐이다 (spec 4 + codebase 5):

- `spec/3-workflow-editor/4-ai-assistant.md` (§4.1.1 마스킹 규칙 문단 교체)
- `spec/5-system/14-external-interaction-api.md` (§R17 "잔여 ③" 캐비엇 해소 서술)
- `spec/conventions/egress-masking.md` (표 2행 소비처 갱신 + `code:` frontmatter 2개 추가)
- `spec/2-navigation/_product-overview.md` (EH-NAV-04 셀 문구 갱신)
- `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (+`.spec.ts`)
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts`
- `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` (+`.spec.ts`)

즉 본 PR 은 **새 엔티티·API endpoint·이벤트·spec 파일을 도입하지 않는다** — workflow-assistant 실행 조회 도구(`get_execution_details` 등)의 응답 마스킹 강도를 키 축(`DEFAULT_SENSITIVE_KEYS` token 계열 확장) + 값 축(`deepRedactSecrets` 중첩)으로 강화하는 보안 수정이다. 아래는 이 좁은 표면에서 새로 도입된 식별자만 대상으로 한 충돌 분석이다.

## 발견사항

- **[WARNING]** 이름이 닮았지만 보안 강도가 다른 두 "redact" 헬퍼가 같은 데이터 shape(`inputData`/`outputData`/`error`)를 다루면서 다른 파일에 산다
  - target 신규 식별자: `redactAssistantFields` (`codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:89`, non-exported 지역 함수)
  - 기존 사용처: `redactStoredFieldsForResponse` (`codebase/backend/src/shared/utils/redact-stored-error.ts:97`, exported, `executions.service.ts`·`background-runs.service.ts` 등 REST 응답 경로에서 소비)
  - 상세: 두 함수는 **동일한 3-필드 shape**(`inputData`/`outputData`/`error`)을 다루고 이름도 `redact...Fields...`로 패턴이 겹친다. 그러나 보안 강도가 다르다 — `redactStoredFieldsForResponse`는 값-패턴 한 겹(`deepRedactSecrets`)만 걸고, 신규 `redactAssistantFields`는 키 축(`maskSensitiveFields`)+값 축(`deepRedactSecrets`) 두 겹을 건다. target 문서(explore-tools.service.ts:79-83)가 이미 이 차이를 "자매 — 이름이 닮았지만 강도가 다르다" 로 명시적으로 문서화했고, "둘을 바꿔 쓰면 조용히 방어가 얕아진다" 고 경고한다는 점에서 저자가 위험을 인지하고 있다. 다만 이 인지가 코드 레벨의 이름 자체에는 반영되지 않아, 향후 유지보수자가 IDE 자동완성이나 grep 으로 두 함수 중 하나를 고를 때 실수로 얕은 쪽(`redactStoredFieldsForResponse`)을 workflow-assistant 표면에 재사용하거나 그 반대로 강한 쪽을 다른 표면에 끌어다 쓸 위험이 남는다.
  - 제안: 코드 변경까지 요구하지는 않으나(이미 문서화된 리스크이고 non-exported 라 실제 오용 표면은 좁음), 후속 변경 시 두 함수 이름에 강도를 드러내는 접미사(예: `redactAssistantFieldsDualLayer` 또는 `redactStoredFieldsForResponse` 쪽에 "value-pattern-only" 주석을 JSDoc 헤더에 한 줄 더 명시)를 고려. 현재 docstring 경고는 유지로 충분.

- **[INFO]** `redact*` 네이밍 공간이 이미 밀집해 있다 — 신규 함수가 그 공간을 한 칸 더 좁힌다
  - target 신규 식별자: `redactAssistantFields`
  - 기존 사용처: 동일 레포에 `redactConfig`(`tools/redact.ts`), `redactStoredFieldsForResponse`/`redactStoredErrorForResponse`/`redactStoredDataForResponse`/`redactNodeExecutionRow`(`shared/utils/redact-stored-error.ts`), `redactSecrets`/`redactSecretsInJsonString`(`shared/utils/sanitize-error-message.ts`), `redactThreadForPublic`/`redactTurnForPublic`(`shared/conversation-thread/thread-renderer.ts`), `redactTerminalError`(`shared/utils/terminal-error-payload.ts`), `redactMcpSecrets`(`modules/mcp/mcp-error-codes.ts`) 등 최소 10개 이상의 `redact*` 심볼이 이미 존재.
  - 상세: 정확한 이름 충돌(동일 식별자 재사용)은 없음 — grep 확인 결과 `redactAssistantFields` 는 유일한 이름이고 exported 되지 않아 실제 충돌 표면은 없다. 다만 도메인 전체가 "redact 접두 + 대상 명사" 패턴을 관행처럼 쓰고 있어 신규 독자가 어느 `redact*` 가 어떤 강도·어떤 표면을 담당하는지 파악하는 데 문서 의존도가 높다.
  - 제안: 코드 변경 불필요. `spec/conventions/egress-masking.md` §1 좌표계 표에 이미 소비처 심볼이 나열되어 있으므로, 향후 `redact*` 심볼이 더 늘어나면 그 표에 통합 인덱스(심볼 → 강도 → 소비처)를 유지하는 것을 권장.

- **DEFAULT_SENSITIVE_KEYS 확장 키(`csrfToken`/`csrf_token`/`authToken`/`auth_token`/`sessionToken`/`session_token`/`idToken`/`id_token`) 충돌 여부** — 확인 결과 충돌 없음(정보용, 등급 없음)
  - `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:58` 의 `auth_token` 리터럴은 URL 쿼리파라미터 마스킹 블랙리스트로 목적이 다르고, 완전 일치 대상은 이 한 건뿐임을 grep 으로 재확인했다(정확 일치 후보 0, `oauth_token_exchange_failed` 류는 부분 문자열이라 이 목록의 완전 일치 판정에 걸리지 않음). 이 분석은 target 문서 자체가 이미 상세히 수행·기록했고(explore-tools.service.ts:73-79 JSDoc), 별도 grep 으로 그 주장을 검증해 일치함을 확인했다. 노드 zod configSchema 쪽에도 이 8개 키가 실 config 필드명으로 정의된 곳은 없음(테스트 파일에서만 등장).

## 요약

이번 target 변경분(`spec/3-workflow-editor/4-ai-assistant.md` 등 spec 4건 + `explore-tools.service.ts` 등 codebase 5건)은 새 요구사항 ID·엔티티·API endpoint·이벤트명·spec 파일 경로를 전혀 신설하지 않는 좁은 스코프의 보안(마스킹 강화) 수정이다. 유일한 신규 코드 식별자는 non-exported 지역 함수 `redactAssistantFields` 하나이며, 정확한 이름 충돌은 없으나 동일 shape·유사 이름의 기존 `redactStoredFieldsForResponse`(강도가 더 약한 자매 함수)와의 혼동 가능성이 있어 WARNING 하나로 기록한다. target 문서 스스로 이 자매 관계와 강도 차이를 docstring 에 상세히 남겨 두었기 때문에 실질 위험은 낮다. `DEFAULT_SENSITIVE_KEYS` 에 추가된 8개 token 계열 키는 target 문서가 자체 수행한 grep 기반 충돌 분석(정확 일치 후보 1건, 목적 상이)을 독립적으로 재검증했고 실제 충돌 없음을 확인했다.

## 위험도

LOW

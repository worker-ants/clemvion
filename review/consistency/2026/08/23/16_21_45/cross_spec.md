# Cross-Spec 일관성 검토 — `plan/in-progress/spec-update-assistant-masking.md`

## 발견사항

- **[WARNING]** `spec/2-navigation/_product-overview.md` EH-NAV-04 "구현 상태" 주석이 target 반영 후 stale 해진다
  - target 위치: 「고칠 두 곳」— `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1, `spec/5-system/14-external-interaction-api.md` §R17 잔여③ (target 문서 §"고칠 두 곳")
  - 충돌 대상: `spec/2-navigation/_product-overview.md:265` (EH-NAV-04)
  - 상세: 이 행의 "구현 상태" 괄호가 `get_workflow_executions` / `get_execution_details` — `workflow-assistant/tools/explore-tools.service.ts` 를 지목하며 현재 메커니즘을 *"`maskSensitiveFields` 자동 마스킹"* 한 줄로만 서술한다(실측: `spec/2-navigation/_product-overview.md:265`). target 이 반영되면 실제 구현은 `deepRedactSecrets` 중첩(값-패턴 + `token` 계열 키-패턴)까지 포함하게 되는데, 이 파일은 target 의 「고칠 두 곳」목록(`3-workflow-editor/4-ai-assistant.md`, `5-system/14-external-interaction-api.md`) 밖이라 자동으로 갱신되지 않는다. 틀린 서술은 아니지만(마스킹 자체는 여전히 걸림) 실제로 닫힌 유출 경로(자유 텍스트 `Bearer …`, `token` 계열 접두형)를 과소 서술하게 된다.
  - 제안: target 작업 범위에 이 한 줄(EH-NAV-04 구현 상태 괄호) 동기화를 추가하거나, 후속 트래커에 명시적으로 남긴다.

- **[WARNING]** `maskSensitiveFields` 는 공유 함수 — §4.1.1 재작성 시 "이 도구에 한정된 변화"임을 명시하지 않으면 다른 소비처 문서와 혼동된다
  - target 위치: target 문서 §1 표 (`포맷: "****<last4>"/"****" → "***"`)
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md`(여러 곳, 예: 480/755/979/1114행), `spec/2-navigation/14-execution-history.md:469`, `spec/5-system/4-execution-engine.md`(193/203/1510행), `spec/conventions/node-output.md:219` — 모두 같은 이름의 `maskSensitiveFields` 를 인용
  - 상세: 코드 실측 결과(`codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:106`, `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts`) `maskSensitiveFields` 자체의 출력 포맷(`****<last4>`)은 **변경되지 않는다** — 포맷이 `***` 로 붕괴하는 것은 `explore-tools.service.ts` 가 로컬에서 `deepRedactSecrets(maskSensitiveFields(v))` 로 **중첩 합성**했기 때문이고(egress-masking.md §2 의 "이미 마커가 아니면 값-마스커가 덮어쓴다" 메커니즘), `ai-turn-executor.ts`·`handler-output.adapter.ts` 두 다른 소비처는 이 합성을 거치지 않으므로 그대로 `****<last4>` 를 낸다. 그런데 target 문서의 표는 "포맷 → `***`" 를 마치 `maskSensitiveFields` 자체의 속성 변경처럼 단순 서술한다. 이 서술이 §4.1.1 spec 본문에 그대로 옮겨지면, 같은 함수를 인용하는 위 네 문서의 독자가 "이제 어디서든 `***` 로 나간다" 라고 오독할 위험이 있다 — 실제로는 AI Agent 자격증명 strip(§1-ai-agent.md)과 Config 탭 boundary masking(§14-execution-history.md R-5)은 여전히 `****<last4>` 를 낸다.
  - 제안: §4.1.1 새 서술에 "이 포맷 변경은 `explore-tools.service.ts` 의 로컬 합성에 한정되며, `maskSensitiveFields` 자체의 전역 출력 포맷은 바뀌지 않는다"는 scoping 문장을 명시한다. (developer 코드의 `redactAssistantFields` JSDoc 이 이미 이 구분을 정확히 적어 두었으므로 그 표현을 그대로 spec 에 반영하면 된다.)

- **[INFO]** `DEFAULT_SENSITIVE_KEYS` 자체(키-이름 축)도 9→22개로 확장됐다 — 이 축은 `explore-tools.service.ts` 전용이 아니라 전역
  - target 위치: target 문서 §1 표 "매칭 키: 리터럴 9개 나열 → 값-패턴 층이 `token` 계열까지 덮음"
  - 충돌 대상: 없음(확인됨) — `spec/4-nodes/`, `spec/2-navigation/14-execution-history.md`, `spec/5-system/4-execution-engine.md` 등 어디에도 `maskSensitiveFields` 의 정확한 키 목록을 리터럴로 못박은 곳이 없고, node config 스키마 중 `csrfToken`/`authToken`/`sessionToken`/`idToken` 과 이름이 겹치는 필드도 없음(`spec/4-nodes/**` grep 결과 0건)
  - 상세: 코드 실측(`mask-sensitive-fields.util.ts`, 커밋 `3aaa4cd19`) 결과 `DEFAULT_SENSITIVE_KEYS` 자체도 `csrfToken`/`csrf_token`/`authToken`/`auth_token`/`sessionToken`/`session_token`/`idToken`/`id_token`/`api_key`/`apikey`/`passwd`/`client_secret` 등을 추가해 9→22개로 커졌다. 이 목록은 `maskSensitiveFields` 의 **기본 파라미터**라 `explore-tools.service.ts` 뿐 아니라 `ai-turn-executor.ts`·`handler-output.adapter.ts` 두 다른 소비처(AI Agent 자격증명 strip, 전체 노드 Config echo boundary)에도 **전역 적용**된다. target 의 「고칠 두 곳」범위 밖의 파급이지만, 마스킹을 더 촘촘하게 거는 방향이라 기존 spec 서술(모두 "credential 필드는 `maskSensitiveFields` 로 자동 마스킹된다" 정도의 일반 서술)과 직접 모순되지는 않는다. 현재 node config 스키마에 겹치는 비-자격증명 필드명도 없어 실질 회귀 위험은 낮다.
  - 제안: 조치 불필요(정보 제공용). 다만 향후 노드가 `csrfToken`/`sessionToken` 등과 겹치는 비-자격증명 config 필드를 도입하면 의도치 않게 마스킹될 수 있음을 유의.

- **[INFO]** `spec/1-data-model.md` §2.17.2 `AuthConfig` 마스킹 포맷(`***<last4>`)과의 명명 유사성 — 실제 충돌 아님
  - target 위치: target 문서 §1 표 "포맷 → `***`"
  - 충돌 대상: `spec/1-data-model.md:643` — "API 응답에서 `config.key`/`config.token`/`config.secret`/`config.password` 는 항상 `***<last4>` 형태로 마스킹한다"
  - 상세: 문자열이 `***` 로 시작해 유사해 보이지만 완전히 다른 파이프라인이다 — `AuthConfig.config` 필드 마스킹은 `spec/conventions/egress-masking.md` 가 명시적으로 "비대상"으로 카브아웃하며 SoT 는 `1-data-model.md §2.17.2` 라고 이미 선언했다(§4.1.1 이 다루는 `Execution`/`NodeExecution` 필드 마스킹과 별개 엔티티·별개 함수). target 변경은 이 영역을 건드리지 않는다.
  - 제안: 조치 불필요. 향후 문서 교차 참조 시 두 "마스킹" 이 다른 시스템임을 헷갈리지 않도록 주의만.

- **요구사항 ID 충돌**: 없음. `ED-AI-37` 은 `spec/3-workflow-editor/_product-overview.md:237` 과 `spec/3-workflow-editor/4-ai-assistant.md:789` 두 곳에서 동일 의미로만 쓰이며, `_product-overview.md` 의 서술("민감 필드는 서버가 자동 마스킹 후 반환")은 포맷·매칭키 세부를 못박지 않아 target 변경과 모순되지 않는다.
- **EIA §R17 "잔여③" flip 범위**: `spec/**` 전체에서 "잔여 ③"(원형숫자) 을 인용하는 곳은 `spec/5-system/14-external-interaction-api.md` 자기 자신뿐이다(같은 절의 "표면 번호는 아라비아 숫자" 각주가 유일한 인접 언급). 따라서 flip 이 다른 spec 파일의 동기화 누락을 유발하지는 않는다.
- **상태 전이·RBAC·계층 책임**: target 은 `Execution`/`NodeExecution` 의 상태 머신, 엔드포인트 계약(§5.1 method/path/응답 shape), 역할 게이팅(§5.1 `Role: editor 이상`)을 건드리지 않는다 — 오직 마스킹된 **값의 포맷**만 바꾸므로 이 세 관점에서는 충돌 없음.

## 요약

target 은 `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 과 `spec/5-system/14-external-interaction-api.md` §R17 잔여③ 두 곳을 원자적으로 갱신하는 계획이며, 실제 코드(커밋 `3aaa4cd19`)와 대조한 결과 두 파일 자체의 서술 방향은 코드와 정합적이다. 다만 (1) 같은 masking 도구를 참조하는 `spec/2-navigation/_product-overview.md` EH-NAV-04 의 구현 상태 주석이 「고칠 두 곳」밖에 있어 target 반영 후 정보가 과소해지고, (2) `maskSensitiveFields` 가 세 소비처(assistant 도구·AI Agent 노드·전체 Config echo boundary)에 공유되는 함수라 §4.1.1 새 서술이 "이 변화는 이 도구에 국한된다"는 scoping 을 명시하지 않으면 같은 함수를 인용하는 다른 spec 문서 독자가 전역 포맷 변경으로 오독할 위험이 있다. 둘 다 CRITICAL 급 직접 모순은 아니며 짧은 문구 추가로 해소 가능한 수준이다. 그 외 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점에서는 직접 충돌을 발견하지 못했다.

## 위험도

LOW

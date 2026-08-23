# 부작용(Side Effect) 리뷰 — assistant-mask-leak (재검토, 17_14_18)

## 전제

이 diff(`origin/main...HEAD`, 41개 파일)는 이전 side_effect 라운드(`16_46_56`)가 이미 리뷰한
코드(`redactAssistantFields` 신설, `DEFAULT_SENSITIVE_KEYS` 8개 확장)에 그 라운드의 WARNING #1
(`DEFAULT_SENSITIVE_KEYS` blast radius)을 반영한 `RESOLUTION.md`(커밋 `6ae84a1d7`)까지 포함한
최종 상태다. 실제 소스(`mask-sensitive-fields.util.ts`, `explore-tools.service.ts`,
`handler-output.adapter.ts`)를 직접 Read 하여 diff 와 대조했고, 이전 라운드가 못 본 파급 경로를
추가로 추적했다.

## 발견사항

- **[WARNING]** `DEFAULT_SENSITIVE_KEYS` blast-radius 측정이 **정적 스키마 필드명만** 보고
  **동적(사용자 정의) 필드명**은 구조적으로 못 본다 — HTTP Request/Send Email 노드의
  `headers`/`body` 는 정확히 그 사각지대다
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:31-38`
    (`csrfToken`/`csrf_token`/`authToken`/`auth_token`/`sessionToken`/`session_token`/
    `idToken`/`id_token` 8개, 주석 21-30행의 "blast radius 실측" 근거) →
    `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:36`
    (`maskSensitiveFields(r.config ?? {})`, 재귀 walk) → 소비 노드:
    `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:178-191`
    (`configEcho.headers = rawConfig.headers`, `configEcho.body = rawConfig.body`, 주석
    172-176행 "raw user input" — 사용자가 정의한 임의 키 그대로), 자매
    `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts:115`
    (`body: rawConfig.body`)
  - 상세: `mask-sensitive-fields.util.ts` 21-30행 주석은 "blast radius 를 실측했다"며
    `codebase/backend/src/nodes/**` 의 **코드에 선언된** config 필드명을 grep 해 충돌 0건을
    확인했다고 적는다. 그런데 `maskSensitiveFields` 는 **객체를 깊이 재귀** 하며 키 이름을
    **완전 일치**로 검사한다(`mask-sensitive-fields.util.ts:70`,
    `sensitiveKeys.has(k.toLowerCase())`) — 즉 `config.headers`/`config.body` 자체의 필드명이
    아니라 **그 객체 내부에 사용자가 임의로 넣은 키**까지 전부 검사 대상이다. HTTP Request
    노드의 `configEcho` 는 "raw user input 을 explicit enumeration 으로 echo" 한다고 스스로
    문서화하는데(`http-request.handler.ts:161-176`), 그 `headers`/`body` 값은 사용자가
    워크플로 UI 에서 자유롭게 입력한 JSON/헤더 구조이므로 **코드베이스 grep 으로는 원천적으로
    포착 불가능**하다. `id_token`(OIDC 표준 필드명), `csrfToken`/`authToken`/`session_token`
    (REST API 바디·헤더에서 흔한 관례)은 사용자가 외부 API 연동 시 그대로 쓸 개연성이 높은
    이름들이다. 실제로 이 저장소는 cafe24/makeshop OAuth 연동을 이미 갖고 있어
    (`codebase/backend/src/nodes/integration/{cafe24,makeshop}/*token*`), 사용자가 HTTP Request
    노드로 유사한 토큰 교환·전달을 구성할 때 이 8개 키 이름과 겹칠 실사용 시나리오가 낯설지
    않다. 겹치면 `config` echo 의 해당 값이 `****<last4>` 로 뭉개져 DB 저장·WS emit 되고,
    `handler-output.adapter.ts` 자체 주석(31-34행)이 명시하는 **표현식 echo**
    (`$node[...].config.*`) 로 다운스트림이 그 값을 읽는 경로가 있다면 마스킹된 값을 읽게 된다
    — plan 이 "값 축"에 대해서만 명시적으로 경계했던 "정상 워크플로를 깨뜨릴 수 있다" 리스크와
    **동일한 클래스**가 "키 축" 8개 확장에도 실재하는데, `RESOLUTION.md` 의 측정 방법론(정적
    코드 grep)은 이 경로를 원천적으로 검증할 수 없어 "0건"이 이 리스크를 닫지 못한다.
    (참고: 이전 라운드 `16_46_56/side_effect.md` 도 같은 리스크 클래스를 지적했으나 그
    측정·재반박도 정적 스키마 범위에 머물렀다 — 이번에 그 측정 자체의 사각지대를 특정했다.)
  - 제안: 마스킹 방향은 안전 쪽(과소→과다)이라 보안 사고는 아니지만, 기능 회귀 여부를 확인할
    필요가 있다. (a) `handler-output.adapter.ts` 의 `config` 가 실제로 다운스트림 표현식에서
    읽히는 실사용 사례가 있는지(프로덕션 워크플로 표본 또는 e2e) 확인하거나, (b) 확인이
    어렵다면 최소한 이 리스크가 "정적 grep 으로 닫히지 않는다"는 사실을 `mask-sensitive-fields.util.ts`
    주석과 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커에 명시적으로
    남겨 다음에 이 목록을 넓히는 사람이 "코드 grep 이면 충분하다"고 오판하지 않게 할 것.

- **[INFO]** `explore-tools.service.ts` 출력 포맷 변경(`****<last4>` → `***`)은 확인된 유일한
  소비 경로(LLM 도구 호출) 안에서 완결되고, 외부에 남은 포맷 의존이 없다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:83-98`
    (`redactAssistantFields`), 호출부 `:511`·`:529`. 소비처
    `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts:201`·`:210`
    (단순 위임, 포맷 무관)
  - 상세: `getExecutionDetails`/`getWorkflowExecutions` 를 호출하는 지점이
    `assistant-tool-router.service.ts` 하나뿐임을 grep 으로 재확인했고, 그 파일은 반환값을
    그대로 LLM 스트림에 전달할 뿐 포맷을 파싱·비교하지 않는다. 이 반환값은 DB 에 영속되거나
    별도 캐시에 저장되지 않는(read-only, 매 호출 재계산) 값이므로, 포맷을 `***` 로 통일한
    변경이 이 diff 밖의 다른 코드를 깨뜨릴 여지는 없다 — 인터페이스 변경이지만 blast radius 가
    스스로 닫혀 있다.
  - 제안: 없음(확인 목적의 기록).

- **[INFO]** `redactAssistantFields` 는 DB entity 원본을 변경하지 않는다 — copy-on-change 설계
  확인
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:83-98`,
    `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:54-77`(항상 새 객체 반환),
    `codebase/backend/src/shared/utils/sanitize-error-message.ts:275-312`(`deepRedactObject`,
    변경 없으면 같은 참조 반환)
  - 상세: `maskSensitiveFields` 가 매 호출마다 새 shallow copy 를 만들어 반환하므로,
    `deepRedactSecrets` 가 그 위에서 "copy-on-change" 로 동작해도 원본 `NodeExecution`/`Execution`
    엔티티의 `inputData`/`outputData`/`error` 는 변경되지 않는다. 두 레이어 합성이 예상치 못한
    mutation 을 만들지 않음을 코드 경로로 확인.
  - 제안: 없음.

- **[INFO]** `DEEP_REDACT_CACHE`(WeakMap, identity 키)가 이 신규 호출 경로에서 사실상 항상
  miss 다 — 성능상 무해하지만 의도한 캐싱 효과는 없다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:202`,`222-235` /
    호출부 `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:92`
  - 상세: `maskSensitiveFields` 가 매번 새 identity 의 객체를 반환하므로
    `deepRedactSecrets(maskSensitiveFields(v))` 에 들어가는 값은 항상 새 객체다 — depth-0 캐시가
    맞을 일이 없다. 버그도 메모리 누수(WeakMap)도 아니고 이전 라운드가 이미 같은 결론을
    냈으므로 재확인만 기록.
  - 제안: 없음.

- **[INFO]** `CREDENTIAL_KEY_PATTERN`(`[a-z0-9_-]*token` 서픽스 매치)의 기존에 알려진
  "accepted false positive"(예: `nextPageToken`)가 workflow-assistant 라는 **세 번째 소비처**로
  넓어졌다 — 새 결함이 아니라 기존 트레이드오프의 상속
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:107-113`
    (`CREDENTIAL_KEY_PATTERN` 주석 "Accepted false positive") →
    `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:92`(신규 겹침)
  - 상세: 이 정규식은 이 diff 이전부터 존재했고 결정도 이미 문서화돼 있다. 이번 변경은 그
    정규식을 새 표면에 연결할 뿐 정규식 자체를 바꾸지 않는다 — `nextPageToken`/`continuationToken`
    같은 필드가 LLM 도구 응답에서도 이제 `***` 로 과다 마스킹될 수 있다는 점만 상속된
    사실로 기록.
  - 제안: 없음(기존 결정 범위 안).

## 요약

핵심 신규 코드(`redactAssistantFields`)는 원본 엔티티를 변경하지 않고, 새 전역 변수·환경
변수·네트워크 호출·이벤트/콜백 변경이 없으며, 출력 포맷 변경(`***`)의 파급은 유일한 소비
경로(`assistant-tool-router.service.ts`) 안에서 닫혀 있음을 직접 확인했다. 다만 이전 라운드가
WARNING 으로 지적하고 `RESOLUTION.md` 가 "0건"으로 닫았다고 선언한 `DEFAULT_SENSITIVE_KEYS`
8개 확장의 blast radius 측정은 **정적 코드(node 스키마 필드명) grep** 에 한정돼 있어, 실제
위험 벡터인 **HTTP Request/Send Email 노드의 `headers`/`body` 안 사용자 정의 동적 키**(예:
`id_token`·`csrfToken`·`auth_token`)를 원천적으로 검증하지 못한다 — 이는 `handler-output.adapter.ts`
를 통해 이 PR 의 명목 범위(workflow-assistant) 밖 **전체 노드 실행 엔진의 `config` 영속·WS
emit·표현식 echo** 에 적용되는 공유 상수이므로, 측정 방법론의 사각지대를 재차 WARNING 으로
남긴다. 방향은 과다 마스킹(안전 쪽)이라 보안 사고는 아니지만, plan 이 "값 축"에 대해서만
명시적으로 인정한 "정상 워크플로를 깨뜨릴 수 있다" 리스크가 "키 축" 확장에도 원리적으로
동일하게 열려 있다.

## 위험도

MEDIUM

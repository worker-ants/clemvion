# Cross-Spec 일관성 검토 — `spec/4-nodes/4-integration/` (--impl-prep)

## 검토 대상 및 방법

검토 모드는 `--impl-prep spec/4-nodes/4-integration/` 이며, 트리거가 된 실제 작업은
`plan/in-progress/ssrf-catch-instanceof.md` (SSRF 가드 소비자 넷 — `http-request.handler.ts` /
`http-redirect.ts` / `database-query.handler.ts` / `database-connection-tester.ts`, 동반
`http-connection-tester.ts` — 의 `catch` 를 `instanceof SsrfBlockedError` 로 판정/비판정을
가르는 순수 코드 변경, `spec_impact: none`)이다.

전달된 `_prompts/cross_spec.md` 번들은 target(`spec/4-nodes/4-integration/*.md`)은 전문 포함이나,
`related_specs` 섹션은 컨텍스트 예산 초과로 **전량 절단**되어 있었다(기존 알려진 갭,
`feedback_consistency_spec_mode_budget`). 따라서 아래 교차 검토는 번들 대신 저장소의
`spec/2-navigation/4-integration.md`, `spec/5-system/4-execution-engine.md §10`,
`spec/5-system/3-error-handling.md §6` 을 직접 `Read`/`grep` 하여 수행했다.

## 발견사항

이번 변경은 spec 텍스트를 전혀 건드리지 않는 순수 catch-분류 코드 변경이며, 검토 결과 **기존
spec 각 영역 간 정의가 이미 서로 정합적이고, plan 이 의도하는 사후 동작이 그 기존 정의와 일치**함을
확인했다. CRITICAL/WARNING 급 충돌은 발견되지 않았다.

- **[INFO]** `INTEGRATION_CALL_FAILED` 의 신규 트리거 사례가 노드별 에러 코드 표에 열거되어 있지 않음
  - target 위치: 없음(코드 변경만, spec 미변경)
  - 관련 spec: `spec/4-nodes/4-integration/0-common.md` §4.2 (`INTEGRATION_CALL_FAILED` = "기타
    일반 예외(분류되지 않은 실패)… `toLogError` fallback", 일반적 정의) vs
    `spec/4-nodes/4-integration/2-database-query.md` §6.2 표의 `INTEGRATION_*` 행
    ("`INTEGRATION_CALL_FAILED`(integrationId 부재 — `requireEntity` `RESOURCE_NOT_FOUND` fallback)"
    — 이 한 가지 사례만 괄호로 예시)와 `1-http-request.md` §4.2 Usage 로깅 매트릭스(SSRF
    차단/전송실패/4xx-5xx/2xx 네 행만 존재, "기타 비-판정 실패" 행 없음)
  - 상세: plan 은 SSRF 가드가 **판정이 아닌** 오류(`SsrfBlockedError` 가 아닌 throw)를 던졌을 때
    `database-query.handler.ts` preflight 실패를 `IntegrationError('INTEGRATION_CALL_FAILED', …)`
    로 명시 승격하고, `http-request.handler.ts` 도 동일 코드로 귀결시킨다. 이는 0-common.md §4.2 의
    일반 정의(어떤 non-`IntegrationError` throw 든 fallback 코드는 `INTEGRATION_CALL_FAILED`)와
    **모순되지 않는다** — 오히려 그 일반 정의를 실제로 만족시키는 구현이다. 다만
    `2-database-query.md` §6.2 와 `1-http-request.md` §4.2 의 개별 표는 그 일반 정의의 "예시" 로
    한 가지 트리거(integrationId 부재)만 들고 있어, 구현 후에는 "SSRF 가드의 비-판정 예외"라는
    두 번째 트리거 사례가 두 표 어디에도 명시되지 않는 상태가 된다. 모순은 아니지만 완전성 갭이다.
  - 제안: 코드 변경 완료 후(`--impl-done` 시점) 두 표에 "SSRF 가드가 판정 아닌 오류를 던진 경우"를
    `INTEGRATION_CALL_FAILED`/승격 사례로 한 줄 추가하는 spec 갱신을 고려할 것. `spec_impact: none`
    은 유지 가능(기존 정의의 범위 안에서 예시를 보강하는 수준이라 계약 자체는 안 바뀜)이나, 완전성을
    위해 project-planner 턴에서 반영을 권장.

- **[INFO]** `IntegrationError` 승격 시 `{ cause: err }` 부착 여부는 별도 cross-cutting 규약 적용 대상
  - target 위치: 없음(코드 변경만)
  - 관련 spec: `spec/5-system/3-error-handling.md` §6 (catch 한 에러를 새 에러로 감쌀 때 `cause`
    부착 여부를 C1/C2 두 조건으로 판정, 하나라도 어긋나면 미부착 + `eslint-disable` 주석 의무)
  - 상세: plan 의 `database-query.handler.ts` "IntegrationError('INTEGRATION_CALL_FAILED', …) 로
    승격" 은 catch 한 비판정 오류를 새 에러로 감싸는 작업이라 이 규약의 적용 대상이다. plan 문서
    자체에는 `cause` 처리 여부가 명시돼 있지 않다. 충돌은 아니며, 구현 시 반드시 통과해야 할 기존
    cross-cutting 규약을 상기시키는 항목이다.
  - 제안: 구현 시 원본 `err` 가 C1(message 가 원본을 이미 포함)·C2(민감 속성 없음) 를 만족하는지
    확인 후 `cause` 부착 여부를 결정하고, 미부착이면 `eslint-disable-next-line preserve-caught-error
    -- <사유>` 주석을 남길 것.

## 검토한 정합성 항목 (충돌 없음 확인)

- **연결 테스트 no-throw 계약**: `database-connection-tester.ts`/`http-connection-tester.ts` 가
  "판정 아닌 오류도 던지지 않고 결과를 반환한다"는 plan 의 기대 동작은
  `spec/2-navigation/4-integration.md` 의 `IntegrationsService.dispatchTest` 테스터 계약("never
  throws + 메시지만 surface", `Cafe24ApiClient.pingConnection()` 선례와 동일 패턴, L1310)과 정확히
  일치한다.
- **`DB_HOST_BLOCKED` vs `DB_CONNECT_FAILED`, `HTTP_BLOCKED` vs `HTTP_CONNECT_FAILED` 코드 분리**:
  plan 이 목표로 하는 "판정=차단 코드 유지, 비판정=연결실패 코드" 분류는
  `spec/2-navigation/4-integration.md` §9 에러 코드 표(L1114·L1116·L1119·L1122)가 이미 동일하게
  정의한 노드-런타임과는 별개인 "연결 테스트 전용 namespace" 와 정합한다.
  `database-query.md`(§4 SSRF 가드, §6.2)· `1-http-request.md`(§4 step 8, §6) 의 노드 런타임
  `DB_HOST_BLOCKED`/`HTTP_BLOCKED` 정의와도 대칭적으로 일치한다.
  `spec/4-nodes/4-integration/2-database-query.md` 의 `DB_HOST_BLOCKED` 신설 Rationale(2026-06-12)이
  이미 이 세 코드 간 대칭을 명문화해 두었다.
  - **다른 세션의 최근 커밋도 이를 뒷받침**: `538f50e14`(컬럼 층 가드 테스트)· `22727e287`(연결
    테스트 결과 코드 상수화)· `ea27c21b3`(SSRF 가드 IPv4-mapped IPv6 커버리지 확장)이 이미 이
    코드-표 분리를 전제로 한 후속 작업이었다.
- **`IntegrationHandlerBase`/`resolveIntegration` 공통 계약**: `spec/5-system/4-execution-engine.md`
  §10.2 ("`resolveIntegration` 실패 시 `IntegrationError(code, message)` throw, `code` 는
  0-common.md §4.2 vocabulary") 는 plan 이 그대로 유지하겠다고 명시한 "자격증명 resolve 실패가
  이미 쓰는 같은 경로" 서술과 충돌하지 않는다.
- **`http-redirect.ts` 재검증**: `1-http-request.md` §4 step 8/9 ("매 홉 SSRF 재검증", 실패 시
  `HTTP_BLOCKED`; fetch reject 는 `HTTP_TRANSPORT_FAILED`)와 plan 의 "판정=사유 문자열 그대로,
  비판정=그대로 던져 호출자의 실패 경로(노드는 `HTTP_TRANSPORT_FAILED`, 테스터는
  `HTTP_CONNECT_FAILED`)로" 분기는 정합적이다.
- **데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC**: 이번 변경은 엔티티·엔드포인트·요구사항
  ID·상태 머신·권한 모델을 전혀 건드리지 않는 catch-분류 리팩터라 해당 네 관점에서는 검토 대상
  표면 자체가 없다.

## 요약

Target 은 `spec/4-nodes/4-integration/` 자체이며, 실제 트리거 작업은 SSRF 가드 소비자 4곳의 catch
를 `instanceof SsrfBlockedError` 로 판정/비판정으로 가르는 순수 코드 변경(`spec_impact: none`)이다.
검토 결과 이 변경이 의도하는 사후 동작(연결 테스터 no-throw 계약, `DB_HOST_BLOCKED`/`HTTP_BLOCKED`
대 `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED` 코드 분리, `resolveIntegration` 공통 계약)은 이미
`spec/4-nodes/4-integration/*.md` · `spec/2-navigation/4-integration.md` · `spec/5-system/4-execution-engine.md`
전반에 걸쳐 상호 정합적으로 문서화돼 있으며, 이번 코드 변경은 그 문서화된 계약과 현재 코드 사이의
갭을 메우는 방향이다. CRITICAL/WARNING 급 cross-spec 충돌은 없다. `INTEGRATION_CALL_FAILED` 신규
트리거 사례의 표 미열거, `{ cause: err }` 부착 규약 적용은 각각 INFO 로 기록했으며 구현/후속 spec
동기화 시 참고할 것을 권장한다.

## 위험도

LOW

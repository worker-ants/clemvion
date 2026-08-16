# 보안(Security) Review

## 컨텍스트

이번 changeset(145개 대상 파일)은 실질적으로 EIA 내부 REST/WS **읽기 경로**에서 `Execution.error`
/ `NodeExecution.error` 컬럼 값을 응답 직전 자격증명 값-패턴 마스킹하는 보안 하드닝(신규
`shared/utils/redact-stored-error.ts` + 소비처 4곳)과, 그 작업의 plan/spec/review 산출물
정리로 구성된다. 같은 diff 가 이미 이 세션에서 5라운드(`17_12_34`→`18_33_52`) 코드 리뷰를
거쳤고 security reviewer 는 매 라운드 위험도 **NONE** 을 유지했다(CWE-209/200 계열 정보노출을
닫는 방어적 수정, 신규 취약점 아님). 본 라운드에서는 그 결론을 그대로 받지 않고 현재 디스크
상태를 직접 열어 독립적으로 재검증했다.

## 재검증 방법

- `codebase/backend/src/shared/utils/redact-stored-error.ts` / `.spec.ts` 전문을 직접 읽음
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`(마스킹 위임 대상, 이번 diff
  범위 밖이지만 신뢰 경계) 전문을 읽고 `SECRET_LEAK_PATTERNS` 의 ReDoS 가능성(중첩 정량자)을
  직접 검사
- `codebase/backend/src/modules/executions/executions.controller.ts` 를 직접 읽고
  `GET /executions/:id` 의 `verifyOwnership` 호출(IDOR 가드, W-44)이 이번 diff 로 훼손되지
  않았음을 확인
- `codebase/backend/src/modules/executions/executions.service.ts` 의 마스킹 4개 소비처
  (`toResponseExecution`/`toExecutionDto`/`findById` 내부 `nodeExecutions` map/`stop`)를
  직접 읽고 형태·copy-on-change 를 확인
- `redact-stored-error.spec.ts` 의 캐너리 테스트(자격증명 없는 연결 문자열·평범한 메시지는
  무변화)가 실제로 존재하는지 확인

## 발견사항

- **[INFO]** 마스킹 유틸 설계 — 안전, 새 취약점 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28-34` (`redactStoredErrorForResponse`)
  - 상세: `null`/`undefined` 입력을 `null` 로 정규화하고, `deepRedactSecrets` 위임으로 형태를
    보존하며 입력을 변이하지 않는(복사본 반환) 순수 함수다. 예외를 던지지 않고, DB 원문은
    보존한다(egress-only). 단언은 함수 한 자리에 모아 두어(호출부 4곳에 캐스트가 흩어지는
    형태를 피함) 타입 안전성도 함께 챙긴다.
  - 제안: 조치 불필요.

- **[INFO]** 위임 대상 정규식(`SECRET_LEAK_PATTERNS`, `sanitize-error-message.ts`) — ReDoS
  표면 없음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:33-52` (이번 diff 범위
    밖의 기존 코드이나, 신규 마스킹 관문이 전적으로 의존하는 신뢰 경계라 함께 확인)
  - 상세: 6개 패턴 모두 중첩 정량자(예: `(a+)+`)가 없고, 문자 클래스 기반의 선형 매칭이다.
    lookbehind/lookahead 도 고정폭(`(?<=:\/\/)`, `(?=@)`)이라 backtracking 폭발 소지가 없다.
    입력은 DB 에 이미 저장된 짧은 에러 메시지/details 객체이며 외부에서 임의 길이 문자열이
    직접 이 마스킹을 거쳐 반복 실행되는 경로도 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `GET /api/executions/:id` 등 읽기 경로의 IDOR 가드는 이번 diff 로 훼손되지 않음
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` (이번 diff 미포함,
    직접 열어 확인) — `findOne` 이 `verifyOwnership(id, workspaceId)` 를 마스킹 적용 이전과
    동일하게 호출
  - 상세: CHANGELOG(파일 2, gate 8-9)가 명시하듯 이 엔드포인트는 `@Roles` 게이트가 없어
    워크스페이스 멤버 전원(viewer 포함)이 조회 가능한 것이 **의도된 기존 설계**이고, 이번
    PR 은 그 위에 값-마스킹만 추가한다. `verifyOwnership`/`verifyWorkflowOwnership` 호출 순서·
    존재 여부에 변화가 없어 workspace 간 IDOR 노출 표면을 넓히지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 마스킹 적용 지점의 "형제 필드 우회" 방지가 실제로 구현돼 있음
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:302`
    (`redactStoredErrorForResponse(row.error)`), `codebase/backend/src/modules/executions/executions.service.ts`
    의 `findById` 내부 `nodeExecutions` map(gate 638-644, 파일 8 — 프롬프트에는 diff 생략되어
    소스 직접 대조), `toResponseExecution`/`toExecutionDto`
  - 상세: `spec/1-data-model.md` §2.14(파일 140, gate 564)가 `Execution.error` 를 최초 failed
    `NodeExecution` 의 에러 정보 **복사**로 정의하므로, 상위 `Execution.error` 만 가리고
    `nodeExecutions[].error` 를 원문으로 두면 같은 응답 안에 같은 문자열이 병존해 방어가
    우회된다. 실측 결과 두 필드 모두 같은 관문(`redactStoredErrorForResponse`)을 통과하며,
    `background-runs` 의 body 노드 표면(파일 4)까지 동일하게 커버한다. 4곳 소비처가 단일
    유틸로 수렴해 "자매 중 하나만 마스킹" 재발 패턴을 구조적으로 차단한다.
  - 제안: 조치 불필요.

- **[INFO]** `redact-stored-error.spec.ts` 의 캐너리 테스트가 "보장의 경계"를 정확히 고정함
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:84-98`
  - 상세: 자격증명 없는 연결 문자열(`postgres://db.internal:5432/prod`)과 평범한 에러 메시지는
    무변화로 통과해야 한다는 보장을 테스트로 고정해, 향후 누군가 `SECRET_LEAK_PATTERNS` 를
    말없이 넓히면 이 자리가 RED 로 바뀌어 blast radius(다른 소비자 전부)를 그 시점에 강제로
    마주하게 한다. 방어적 설계로서 긍정적.
  - 제안: 조치 불필요.

- **[INFO]** `secret-store.md` 의 `Trigger.config.interaction.triggerToken` 평문 보관 예외 —
  근거가 자체 수정됨(신규 취약점 아님)
  - 위치: `spec/conventions/secret-store.md:42-50` (파일 145)
  - 상세: 이번 diff 는 새로 평문 보관을 도입하는 것이 아니라, 기존 예외(이미 트래커에 등재된
    기결정)의 근거 문장 하나(*"timing-safe 비교 때문에 평문이 필요"*)가 **성립하지 않는다**는
    이전 라운드 security INFO 지적을 받아 반례(해시 저장 + `crypto.timingSafeEqual` 로 동일한
    타이밍 안전성 확보 가능)를 명시하고, 실질 근거를 (c)(서버 발급 랜덤 hex·1회 노출·영향
    범위 국한)로 좁혔다. 해시 전환은 유효한 후속 개선으로 열어 두었다. 문서 정확성이
    개선됐을 뿐 코드 동작 변화는 없다.
  - 제안: 별도 후속(해시 저장 전환)은 이 PR 범위가 아니며 이미 문서에 후속으로 열려 있다.
    조치 불필요.

- **[INFO]** 의도적으로 남겨둔 마스킹 잔여 갭 — 전부 트래커에 등재된 기결정, 이번 diff 의
  결함 아님
  - 위치: `CHANGELOG.md:33-35`(파일 2, gate 33-35 — "잔여 갭(의도, 트래커 등재)")
  - 상세: WS `execution.node.*` **emit**, `inputData`/`outputData`, workflow-assistant LLM
    도구(`explore-tools.service.ts` 의 `maskSensitiveFields` 키-기반 마스킹만 적용해 값 안의
    `Bearer …` 를 통과시킴)는 이번 PR 이 닫지 않는다. `RESOLUTION.md`(파일 29, gate 21-39)가
    기록하듯, 값-패턴 마스킹을 workflow-assistant 표면에 합성 적용해 봤더니 기존 테스트가
    RED 였고(그 표면은 `****9876` 접미 힌트를 남기는 별도 UX 계약을 갖고 있음), 이를 조용히
    되돌리지 않고 정본 트래커에 결정 항목으로 등재했다 — 우회 대신 스코프를 정직하게 좁힌
    처리로 판단된다.
  - 제안: 조치 불필요(범위 밖, 이미 추적됨). 다음 PR 에서 workflow-assistant 표면의 마스킹
    우선순위(키-기반 vs 값-패턴, 또는 병존 방식)를 결정할 때 이 값-패턴 마스킹 적용 시도가
    RED 를 낸 사실을 참고하면 재작업을 줄일 수 있다.

## 요약

이번 changeset 은 신규 취약점을 도입하지 않는다 — 오히려 기존 CWE-209(부적절한 정보 노출) /
CWE-200(민감 정보 노출) 계열 결함(내부 REST 읽기 경로·WS `execution.snapshot` 이 자격증명
패턴이 섞인 에러 메시지를 워크스페이스 viewer 포함 전원에게 원문으로 반환하던 상태)을 닫는
방어적 수정이다. 마스킹 유틸(`redactStoredErrorForResponse`)은 null-safe·비변이·타입 보존
설계이고, `Execution.error` 와 그 복사본인 `nodeExecutions[].error`(형제 필드 우회 표면) 양쪽
모두에 4개 응답 소비처 + `background-runs` body 노드 표면까지 일관되게 적용된다. 위임 대상
정규식은 ReDoS 표면이 없고, 기존 IDOR 가드(`verifyOwnership`)·파라미터 바인딩 쿼리는 이번
diff 로 손대지 않아 훼손 여부가 없다. 하드코딩된 시크릿은 없다(테스트 픽스처의
`sk-live-abc123def456` 류는 합성 캐너리 값). 인증/인가 경로도 변경이 없으며, 뷰어 롤에게
읽기 경로가 열려 있는 것은 이번 PR 이전부터의 명시적 설계다. 남은 마스킹 갭(WS
`execution.node.*` emit · `inputData`/`outputData` · workflow-assistant 키-기반 마스킹)은
전부 이 PR 이 스스로 CHANGELOG·spec·정본 트래커에 등재한 범위 밖 항목이며, 하나(workflow-
assistant)는 실제로 처방을 시도했다가 테스트 회귀로 실측 반증되어 정직하게 되돌린 이력까지
문서화돼 있다. CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE

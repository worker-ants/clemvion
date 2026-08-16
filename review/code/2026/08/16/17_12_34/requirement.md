# 요구사항(Requirement) Review — EIA `Execution.error` 내부 읽기 경로 마스킹 (I1/D 집행)

## 스코프 요약

이번 변경의 핵심 기능 요구사항은 "`Execution.error`/`NodeExecution.error` 를 반환하는 **모든**
내부 읽기 표면에 `deepRedactSecrets` 기반 egress 마스킹을 적용해, 종결 emit 경로(#1177)와
읽기 경로 사이의 비대칭을 해소한다" 이다. 대상 코드:

- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규 유틸)
- `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (신규 유닛 테스트)
- `codebase/backend/src/modules/executions/executions.service.ts` (`findById`/`toExecutionDto`/
  `getChain`/`stop` 4곳 + `nodeExecutions[].error`)
- `codebase/backend/src/modules/executions/executions.service.spec.ts` (표면별 회귀 테스트)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (+spec) —
  자매 표면
- `spec/5-system/14-external-interaction-api.md` §R17, `spec/2-navigation/14-execution-history.md`
  R-5, `spec/5-system/6-websocket-protocol.md` `execution.snapshot` 행, `spec/4-nodes/1-logic/
  12-background.md` §8.2, `spec/conventions/secret-store.md` §1 — 대응 spec 갱신
- `plan/**`, `review/consistency/**` — plan lifecycle 이동 및 기존 --impl-prep 3라운드 산출물

## 발견사항

- **[WARNING]** "표면 전수" 주장이 실제로는 전수가 아니다 — `workflow-assistant` LLM 도구가
  같은 `Execution.error`/`NodeExecution.error` 를 **다른(더 약한) 마스킹 함수**로 내보낸다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:464`
    (`error: maskSensitiveFields(ne.error ?? null)`), `:484`
    (`error: maskSensitiveFields(e.error ?? null)`)
  - 상세: 이번 PR 의 plan(`plan/in-progress/eia-internal-rest-error-masking.md` "## 표면
    전수" 절)과 spec 갱신(`spec/5-system/14-external-interaction-api.md` §R17 "독립 반환 경로
    **4곳**")은 `Execution.error`/`NodeExecution.error` 를 읽어 응답하는 모든 지점을 실측
    전수했다고 명시적으로 주장한다 — REST 4곳 + WS `execution.snapshot`(재사용) +
    `background-runs` 자매 표면까지 잡아냈다. 그런데 `ExploreToolsService.toExecutionEnvelope`
    / `toNodeExecutionEnvelope` (LLM 도구 `get_workflow_executions`/`get_execution_details`,
    `tool-definitions.ts:170` 이 "error … are auto-masked for sensitive keys" 라고 LLM 에게
    명시 약속하는 바로 그 필드) 는 여전히 `maskSensitiveFields`
    (`common/utils/mask-sensitive-fields.util.ts`) 를 쓴다. 이 함수는 **키 이름**
    (`password`/`token`/`secret`/`authorization` 등) 이 일치할 때만 값을 통째로 마스킹하고,
    `message` 처럼 안전해 보이는 키 **안에 박힌** 자격증명 문자열 패턴(`Bearer sk-live-...`,
    `scheme://user:pass@host`)은 전혀 스캔하지 않는다 — 이번 PR 이 새로 도입한
    `redactStoredErrorForResponse`(`deepRedactSecrets` 위임, 정규식 패턴 매칭)가 정확히 겨냥하는
    케이스다. 즉 `error.message` 에 `Bearer sk-live-abc123def456` 같은 값이 들어 있으면
    REST/WS 표면은 이번 PR 로 `***` 처리되지만, AI 어시스턴트 도구 결과로는 원문 그대로
    LLM 컨텍스트에 실려 나간다(그리고 LLM 이 그 값을 진단 답변에 그대로 인용할 수 있다) — 제3자
    LLM provider 로 나가는 egress 라는 점에서 REST 응답보다 신뢰 경계가 오히려 더 넓다.
  - `spec_impact` 목록(`spec/5-system/14-external-interaction-api.md`,
    `spec/2-navigation/14-execution-history.md`, `spec/5-system/6-websocket-protocol.md`,
    `spec/4-nodes/1-logic/12-background.md`, `spec/conventions/secret-store.md`) 어디에도 이
    표면은 등재되지 않았고, 코드도 건드리지 않았다 — 이 PR 이전부터 있던 상태이지만, 이번 PR
    이 반복해서 자기 규율로 세운 "자매 넷 중 하나만 놓치는 것이 이 저장소의 반복 실패 형태"
    라는 원칙이 정확히 다섯 번째 자리에서 다시 재현됐다.
  - 제안: `redactStoredErrorForResponse` (또는 동등한 `deepRedactSecrets` 위임)를
    `explore-tools.service.ts` 의 `error` 필드에도 적용하거나, 최소한
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 류 정본 트래커에 신규 잔여
    항목으로 등재해 "범위 밖" 을 명시적으로 남긴다 (이번 plan 이 WS `execution.node.*` emit ·
    `inputData`/`outputData` 를 그렇게 처리한 것과 동일한 방식). 코드 수정은 developer 스코프,
    spec 캐비엇 추가는 필요 시 project-planner 턴.

- **[INFO]** `eia-internal-rest-error-masking.md` 자체 체크리스트와 그 안에서 참조하는 정본
  트래커 상태가 같은 diff 안에서 어긋난다
  - 위치: `plan/in-progress/eia-internal-rest-error-masking.md` "정본 트래커 **I1·D 닫기**"
    체크박스 (미체크 `[ ]`)
  - 상세: 같은 diff 의 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는 I1·D
    항목을 이미 `[x]`(완료)로 표시했는데, 이를 집행한 본 plan 자신의 "트래커 닫기" 체크박스는
    아직 `[ ]` 다. `status: in-progress` 라 완결 의무는 아니지만(Gate C 는 `complete/` 이동
    시점에만 강제), 트래커 쪽 실제 상태와 어긋난 채로 남아 있어 다음 세션이 "아직 안 닫혔다" 로
    오독할 여지가 있다.
  - 제안: `complete/` 이동 전에 체크박스를 실제 상태와 동기화(memory 교훈 "plan 체크박스 = 실제
    상태" 참조). 급하지 않음 — 코드 결함 아님.

## 기타 점검 결과 (문제 없음, 근거만 기록)

- **함수 시그니처·마스킹 관문 배선**: `stripPrivateRelations` → `toResponseExecution` 확장이
  `findById`(`:630`)·`getChain`(`:537`)·`stop`(`:768`, `stopInternal` 4개 반환 지점을 단일
  wrapper 로 감싸 다섯 번째 반환 누락 위험을 구조적으로 차단) 3곳의 공통 관문이고, `toExecutionDto`
  (`:888`, DTO 조립이라 엔티티 관문을 안 지남)에 독립 호출을 확인 — plan/spec 서술과 실코드가
  line-level 로 일치.
- **`nodeExecutions[].error` 형제 필드 우회 차단**: `spec/1-data-model.md:561` "복사" 정의와
  코드 주석·구현이 정확히 대응(`executions.service.ts:603-611`). `background-runs.service.ts:302`
  자매 표면도 동일 헬퍼 적용 확인.
- **캐시-안쪽 마스킹**: `findById` 의 `writeSnapshotCache`(`:639`)는 마스킹이 끝난 `snapshot` 을
  저장 — "캐시 우회 4곳 중 1곳" 재발을 피하는 설계이고, 대응 테스트(`①-b`, createQueryBuilder
  호출 1회 검증으로 캐시 히트 경로임을 실제로 확인)도 vacuous 하지 않음.
- **WS `execution.snapshot` 상속**: `websocket.gateway.ts:399` 가 `findById` 를 그대로 재사용 —
  별도 마스킹 배선 불필요, spec(`6-websocket-protocol.md:182`)도 이를 명시.
- **`deepRedactSecrets` 보장 경계 캐너리**: `redact-stored-error.spec.ts` 의 두 "잔여 갭" 캐너리
  (`postgres://db.internal:5432/prod` 통과, 평범한 메시지 무변화)를 `SECRET_LEAK_PATTERNS`
  (`sanitize-error-message.ts:33-52`)에 직접 대조 — userinfo 패턴은 `@` 존재를 전제하므로
  자격증명 없는 연결 문자열은 실제로 통과. 문서·테스트·구현 세 축이 일치.
- **null/undefined 정규화**: `err === null || err === undefined` 가드 + 테스트 확인. 입력 변이
  없음(`deepRedactSecrets` copy-on-change) 도 참조 비교 테스트로 고정.
- **spec fidelity**: `spec/5-system/14-external-interaction-api.md` §R17, `2-navigation/
  14-execution-history.md` R-5 스코프 캐비엇, `6-websocket-protocol.md` `execution.snapshot`
  행, `4-nodes/1-logic/12-background.md` §8.2, `conventions/secret-store.md` §1 `triggerToken`
  비대상 예외 — 5개 spec 문서 전부 코드 구현과 line-level 로 일치(함수명·표면 수·근거 인용
  모두 대조 확인). 이미 3라운드의 `--impl-prep`(`16_03_57`→`16_32_42`→`16_48_55`)이 CRITICAL
  2건을 잡아 정정했고, 이번 재검토에서 그 정정이 실제로 반영됐음을 직접 diff 로 재확인함
  (예: `redactExecutionErrorValue` 잔존 이름 제거, `NodeExecution.error` 격상 반영).
- **TODO/FIXME/HACK/XXX**: 코드 diff 전체에서 미검출.

## 요약

`Execution.error`/`NodeExecution.error` 내부 읽기 경로 마스킹이라는 이번 변경의 목표 자체는
코드·테스트·spec 세 축이 서로 line-level 로 정합하게 구현됐고, 캐시·다중 반환 지점·형제 필드
우회 같은 이 저장소가 반복적으로 겪어온 실패 형태에 대한 방어도 구체적 테스트로 뒷받침된다.
다만 이번 PR 이 스스로 세운 "표면 전수" 기준으로 저장소 전체를 다시 훑어보면, `Execution.error`
를 읽어 제3자(LLM)에게 넘기는 `workflow-assistant` 도구 표면이 여전히 패턴 기반이 아닌 키 이름
기반 마스킹만 쓰고 있어 이번 PR 이 REST/WS 에서 막은 것과 같은 종류의 credential 노출이
가능하다 — 이번 diff 가 만든 회귀는 아니지만, PR 자신의 "전수" 주장·spec 캐비엇 목록에서 빠진
실제 sibling 이므로 후속 항목으로 명시 등재할 것을 권고한다.

## 위험도

LOW — 이번 diff 자체의 CRITICAL 은 없음. WARNING 1건(사전 존재하던 sibling 표면 미포함)은
diff 범위 밖 코드에 대한 것이라 이 PR 을 막을 사유는 아니나, 이 PR 이 세운 "전수" 기준을
스스로 충족하지 못하므로 트래커 등재를 권고.

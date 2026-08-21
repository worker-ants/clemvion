# 요구사항(Requirement) 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 방법

`reject-masked-resubmission.ts`/`.spec.ts`, `trigger-parameter.types.ts`, `resolve-trigger-parameters.ts`,
호출부 2곳(`executions.service.ts`·`workflows.controller.ts`), `sanitize-error-message.ts`,
`http-exception.filter.ts` 를 전체 파일로 직접 `Read` 해 line-level 로 대조했다. 관련 spec 7개
문서(`14-external-interaction-api.md §R17`·`3-error-handling.md §1.7`·`13-replay-rerun.md §8.1/§10.2`·
`4-nodes/7-trigger/1-manual-trigger.md §6`·`1-data-model.md §2.13`·`3-workflow-editor/3-execution.md §2.2`·
`12-webhook.md §5.2`)도 저장소에서 직접 열어 확인했다. `git log`/`git show --stat` 로 이 diff 가 이전
라운드(`00_03_57`)가 잡은 CRITICAL(`boolean` 마커 우회)의 **수정 완료 상태**(커밋 `50f799efd`)임을
확인했고, 그 수정이 실제로 반영됐는지(raw 우선 검사) 코드로 재검증했다.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` §6 reason 표가 여전히 "resolve **직후**" 만 검사한다고 서술 — 실제
  구현은 raw(resolve **이전**)를 먼저 보고 resolve 이후에 한 번 더 본다. 이 두 단계 순서 자체가
  `00_03_57` CRITICAL(`boolean` 마커 완전 우회)의 수정 내용이다.
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:170` — `"값 leaf 가 egress 마스킹 마커... |
    masked_value_resubmitted | adapter resolveTriggerParameters **직후** (...)"` / 대응 코드:
    `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:55-69`
    (`resolveTriggerParametersRejectingMasked` — ① raw 검사 → `resolveTriggerParameters` 호출
    → ② resolve 후 검사)
  - 상세: 이 spec 행은 planner 턴(`3e96f4b44`/`871d3fcb0`, 2026-08-20)에서 작성됐고, 그 시점의
    설계는 "resolve 결과만 검사"였다. 그런데 이 설계는 developer 구현 중 무수정 프로브로
    반증됐다 — `coerceToType('***','boolean')` 이 `Boolean('***')` → `true` 로 캐스팅해 문자열이
    사라지므로, resolve **이후**에만 검사하면 `boolean` 타입 필드에서 마스킹 마커가 **완전
    우회**된다(`review/code/2026/08/21/00_03_57/RESOLUTION.md` CRITICAL 절). 수정 커밋
    `50f799efd`(`git show --stat`로 확인)는 코드(`reject-masked-resubmission.ts`)만 고쳤고
    `spec/5-system/14-external-interaction-api.md` 를 1줄 갱신했을 뿐, `1-manual-trigger.md:170`
    의 "직후" 문구는 손대지 않았다 — `developer` 는 `spec/` 이 read-only 라 이 줄을 고칠 권한이
    없다(CLAUDE.md 역할 경계). 그 결과 지금 spec 은 이미 반증된 "resolve 후에만 본다" 설계를
    유일한 검사 시점으로 서술해, 다음 사람이 이 문장만 보고 재구현하면 같은 CRITICAL 이
    재발할 수 있다. 코드는 옳고(테스트 `reject-masked-resubmission.spec.ts` "[캐너리] boolean
    필드의 마커도 거부한다 — coerce 가 문자열을 지우기 전에 본다" 로 고정) spec 서술만 낡았다
    — **코드 되돌리기가 아니라 spec 갱신이 정답**이다.
  - 제안: 코드 변경 불필요. `project-planner` 턴으로 `spec/4-nodes/7-trigger/1-manual-trigger.md:170`
    의 "adapter `resolveTriggerParameters` **직후**" 를 "adapter `resolveTriggerParameters` **전후**
    (raw 우선, resolve 후 재검사 — JSON 문자열로 인코딩된 object/array 대비)" 류로 정정하고,
    필요하면 `boolean` 타입에서 resolve-only 검사가 우회되는 이유를 각주로 남긴다(재발 방지).

- **[WARNING]** 같은 요청 안에서 마스킹 마커 오류와 **다른 필드의 무관한 구조 오류**(누락 필수값·
  coerce 실패)가 함께 발생하면, 마스킹 오류만 보고되고 나머지는 조용히 다음 라운드트립으로 미뤄진다
  — `details[]` 가 "필드별 전체 목록"이라는 기존 계약의 암묵적 기대를 부분적으로 깬다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:55-69`
    (`resolveTriggerParametersRejectingMasked` — ① `throwIfAny(...)` 가 `resolveTriggerParameters`
    호출 **전에** 즉시 throw 하므로, ①에서 하나라도 걸리면 `resolveTriggerParameters` 자체가
    실행되지 않는다)
  - 상세: 예를 들어 스키마가 `[{name:'a', type:'string', required:true}, {name:'b', type:'number'}]`
    이고 요청이 `{ b: '***' }` (a 는 아예 누락, b 는 마스킹 마커)라면, ① 단계에서 `b` 의 마스킹
    마커가 발견되는 즉시 `TriggerParameterValidationException([{field:'b', reason:'masked_value_resubmitted'}])`
    가 throw 되고 `resolveTriggerParameters(schema, rawSource)` 는 **호출조차 되지 않는다** —
    `a` 의 `missing_required` 오류는 이번 응답에 전혀 실리지 않는다. 종전 `resolveTriggerParameters`
    단독 호출 시에는 스키마 전 필드를 순회하며 오류를 **모아서** 한 번에 throw 했으므로(같은 파일
    `resolve-trigger-parameters.ts:117-145`), 사용자는 한 번의 400 으로 `a`·`b` 둘 다 알 수
    있었다. 새 가드는 마스킹 오류가 있으면 그 필드(들)만 보고하고 나머지 필드의 검증은 다음
    재제출까지 미룬다. `reject-masked-resubmission.spec.ts` "여러 필드가 걸리면 전부 돌려준다"
    테스트는 **같은 reason**(마스킹)이 여러 필드에 걸친 경우만 검증하며, 마스킹+비마스킹
    혼합 시나리오는 스펙에도 테스트에도 없다. 보안·정합성 문제는 아니고(각 오류가 결국 정확히
    보고되며 데이터 오염도 없음) 완전성/UX 관점의 엣지 케이스다.
  - 제안: 스코프 밖이면 조치 불요로 남겨도 되지만, 후속 개선 시 ① 단계를 `resolveTriggerParameters`
    래핑 **안에서** 병행 수집(마스킹 오류 + 구조 오류를 합쳐 한 번에 throw)하는 방향을 고려.
    최소한 `reject-masked-resubmission.ts` 최상단 docstring 에 이 캐비엇("마스킹 오류가 있으면
    같은 요청의 다른 구조 오류는 이번 응답에 실리지 않는다")을 한 줄 남기면 재지적을 예방.

- **[INFO]** 단일 노드 실행 엔드포인트(`POST /:id/nodes/:nodeId/execute`)는 `resolveTriggerParameters`
  계열을 아예 호출하지 않아 이번 가드의 적용 대상 밖이다 — 현재는 프런트가 이 자리에 값을 채우지
  않아 잠재 위험이지만, `body.input` 필드 자체는 이미 API 표면에 존재한다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:349-435`(`executeNode`,
    `executionInput = {...(body?.input ?? {}), __triggerSource:'manual'}`), DTO
    `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts`
  - 상세: `00_03_57` maintainability 리뷰가 이 엔드포인트를 "향후 세 번째 호출부가 생기면"으로
    가정법으로 언급했으나, 실측하면 이 엔드포인트는 **이미 존재**하고 `body.input`(수동 입력)을
    스키마 검증·마스킹 검사 없이 그대로 노드 입력에 흘려보낸다. 다만 이 경로는 Manual Trigger
    파라미터 스키마에 바인딩되지 않는 별개 메커니즘(단일 노드 테스트 입력)이고,
    `workflow-canvas.tsx` `handleRunThisNode` 는 현재 `previousExecutionId` 만 보내고 `input` 을
    채우지 않아 마스킹된 값이 실제로 왕복할 UI 경로가 없다. §R17 이 명시한 "Manual 실행 경로
    두 곳"이라는 스코프 서술과 상충하지는 않는다(이 엔드포인트는 트리거 파라미터 스키마 경로가
    아니므로).
  - 제안: 조치 불요. 다만 향후 이 엔드포인트에 "직전 노드 출력을 그대로 재사용" 같은 프런트
    UI 가 붙어 `NodeExecution.input_data`(egress 마스킹 대상, spec §R17)를 `body.input` 프리필로
    쓰게 되면, 그 시점에 같은 가드를 얹어야 한다는 점을 기억해 둘 필요.

## 요약

핵심 로직(`resolveTriggerParametersRejectingMasked`)은 이전 라운드(`00_03_57`)가 잡은 CRITICAL
(`boolean` 타입에서 마스킹 마커가 `Boolean('***') → true` 로 캐스팅돼 완전 우회)이 실제로 고쳐졌음을
코드·테스트로 직접 재검증했다 — raw 우선 검사 → resolve → resolve 후 재검사라는 2단계 순서가
정확히 구현돼 있고, 정확 일치 경계·깊이 상한 순서·`defaultValue` 과잉 차단 방지·`errors`→`details`
봉투 배선 교정까지 spec(EIA §R17, manual-trigger §6, replay-rerun §8.1/§10.2, error-handling §1.7,
webhook §5.2)과 line-level 로 일치한다. 남은 문제는 두 가지다: (1) `1-manual-trigger.md:170` 이
CRITICAL 수정 이전의 "resolve 후에만 검사" 설계를 여전히 서술하는 SPEC-DRIFT(코드는 옳고 spec
갱신 누락, developer 권한 밖이라 이번 PR 에서 못 고침) — 그대로 두면 다음 사람이 이 문장만 보고
검사 시점을 되돌릴 위험이 있다. (2) 마스킹 오류와 다른 필드의 무관한 구조 오류가 한 요청에
섞이면 이번 응답엔 마스킹 오류만 실리는 완전성 엣지 케이스(보안·정합성 문제는 아님). 셋째
(단일 노드 실행 엔드포인트가 이 가드를 타지 않음)는 현재 프런트 경로가 없어 INFO. CRITICAL 급
신규 결함은 없다.

## 위험도

LOW

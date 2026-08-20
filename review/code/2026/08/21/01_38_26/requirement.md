# 요구사항(Requirement) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (4차 라운드, 01_38_26)

## 검토 방법

이 diff 는 이전 3개 리뷰 라운드(`00_03_57` CRITICAL 1건 해소 → `00_39_27` WARNING 5건 해소 →
`01_15_47` WARNING 0/INFO 10건 중 3건 반영)의 산출물을 포함한 누적 브랜치 diff다. 프롬프트에
실린 각 라운드의 RESOLUTION/SUMMARY 를 먼저 읽어 이미 처분된 항목을 파악한 뒤, **실제 소스
(프롬프트가 아니라 워킹 디렉터리)를 직접 열어** 현재 코드·spec 상태를 독립적으로 재검증했다:

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (+`.spec.ts`, 21 tests)
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (reRun 호출부, `executions-rerun.service.spec.ts` 47 tests 중 관련분)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (execute 호출부, `workflows.controller.spec.ts`)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (export 승격)
- `codebase/backend/src/common/filters/http-exception.filter.ts` (`details` 소비 확인)
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` (래핑 대상 함수)
- `codebase/backend/src/modules/hooks/hooks.service.ts`, `schedule-runner.service.ts` (미변경 확인 — 스코프 경계)
- `codebase/frontend/src/lib/utils/masked-markers.ts`, `editor-toolbar.tsx` (프런트 미러 정합)
- spec: `4-nodes/7-trigger/1-manual-trigger.md §6/Rationale`, `5-system/3-error-handling.md`,
  `5-system/12-webhook.md`, `5-system/13-replay-rerun.md §8.1/§10.2`, `1-data-model.md`

`npx jest reject-masked-resubmission` (21/21 pass), `npx jest executions-rerun.service
workflows.controller.spec` (47/47 pass) 를 직접 재실행해 확인했다.

## 발견사항

- **[INFO]** 두 phase(raw 우선 검사 → resolve → resolve 후 재검사) 구조와 대상 키를
  raw 기준으로 제한하는 필터가 코드·테스트·spec 세 곳 모두에서 line-level 로 일치한다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:56-75`
    (`resolveTriggerParametersRejectingMasked`), `spec/4-nodes/7-trigger/1-manual-trigger.md:170`
    (§6 표 "adapter `resolveTriggerParameters` **전후 2단계**" 서술)
  - 상세: `00_03_57` 라운드가 잡은 CRITICAL(`boolean` 파라미터가 `Boolean('***')→true` 로 완전
    우회되던 결함)의 근본 수정이 그대로 남아 있다. `findMaskedResubmissions(schema, rawSource,
    rawSource)` → `throwIfAny` → `resolveTriggerParameters` → `findMaskedResubmissions(schema,
    rawSource, resolved)` → `throwIfAny` 순서이며, 두 호출 모두 대상 필드를
    `Object.prototype.hasOwnProperty.call(rawSource, def.name)` 로 필터링해 `defaultValue` 로만
    채워진 미접촉 필드는 검사 대상에서 제외한다(`reject-masked-resubmission.ts:124`). spec
    §6 표의 "raw(coerce 전) 우선 검사 → resolve → resolve 후 재검사" 문구, `## Rationale` 의
    "`masked_value_resubmitted` 검사 시점" 섹션과 정확히 대응한다.
  - 제안: 없음 (확인용).

- **[INFO]** 정확 일치(substring 아님) 판정과 `MAX_REDACT_DEPTH` 경계(치환 마커가 놓일 수
  있는 가장 깊은 자리) 순서(값 검사가 깊이 검사보다 먼저)가 코드·테스트·프런트 미러 세
  층에서 동일하다
  - 위치: `reject-masked-resubmission.ts:132-145` (`hasMaskedLeaf`), 대응 테스트
    `reject-masked-resubmission.spec.ts:174-201`(경계값 `MAX_REDACT_DEPTH`/`+1` 양쪽),
    프런트 미러 `codebase/frontend/src/lib/utils/masked-markers.ts:100`
  - 상세: `a***b`/`***bold***`/`postgres://***@db/prod` 같은 부분-포함 값이 통과함을
    캐너리로 고정했고(`spec.ts:155-166`), 깊이 상한 경계(`k===MAX_REDACT_DEPTH` 잡힘,
    `k+1` 안 잡힘)와 object↔array 혼합 중첩 보폭까지 테스트로 덮는다. 프런트
    `isMaskedMarker`/마커 3종 문자열 리터럴이 backend `VALUE_MASK_MARKER='***'`/
    `KEY_MASK_MARKER='[REDACTED]'`/`DEPTH_MASK_MARKER='[REDACTED_DEPTH]'` 와 정확히
    일치함을 grep 대조로 확인했다.
  - 제안: 없음 (확인용).

- **[INFO]** 에러 봉투 필드(`details` vs `errors`) 수정이 실제 소비 필터와 line-level 로
  일치한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:512`
    (`details: toTriggerParameterErrorDetails(err.errors)`),
    `codebase/backend/src/common/filters/http-exception.filter.ts:73`
    (`details = resp.details ?? nested?.details;` — `errors` 키는 어디서도 읽지 않음)
  - 상세: `executions-rerun.service.spec.ts` 신규 회귀 테스트("[회귀] 거부 응답이 details[]
    로 필드별 코드를 싣는다")가 `body.errors` 가 `undefined`, `body.details` 가
    `[{ field: 'apiKey', code: 'MASKED_VALUE_RESUBMITTED', ... }]` 임을 단언하며, 실제
    필터 코드를 직접 열어 `errors` 키가 어디에도 읽히지 않음을 확인했다 — 선존 버그
    수정 주장이 근거 있는 사실 서술이다.
  - 제안: 없음 (확인용).

- **[INFO]** 스코프 경계(Manual 실행 경로 한정, webhook/schedule 제외)가 실제 호출 그래프와
  일치한다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:183`,
    `codebase/backend/src/modules/schedules/schedule-runner.service.ts:78,88` — 둘 다
    감싸지 않은 `resolveTriggerParameters` 를 그대로 호출
  - 상세: `resolveTriggerParametersRejectingMasked` 를 import 하는 곳은
    `executions.service.ts`·`workflows.controller.ts` 둘뿐임을 grep 으로 전수 확인했다.
    spec `5-system/12-webhook.md:312`("webhook 런타임 경로에서는 둘 다 발생하지 않는다")과
    실제 코드가 일치한다.
  - 제안: 없음 (확인용).

- **[INFO]** 단일 노드 실행 엔드포인트(`POST /:id/nodes/:nodeId/execute`)는 이 가드 대상
  밖이며, 이는 구조적으로 타당하다(재-flag 아님, `01_15_47` 라운드가 이미 판정한 항목의
  재확인)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:349`
    (`executeNode`)
  - 상세: 이 엔드포인트는 Manual Trigger 파라미터 스키마(`resolveTriggerParameters` 계열)를
    전혀 거치지 않고 `body.input`(자유 형식 수동 입력)을 그대로 쓴다 — `Execution.inputData`
    마스킹 프리필 경로와 무관해 재제출 오염 시나리오 자체가 성립하지 않는다.
  - 제안: 없음 (확인용, 새 결함 아님).

## 요약

이번 diff 는 `Execution.inputData`/`formConfig` egress 마스킹 마커가 Manual 실행 경로
(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`)에서 그대로 재제출되는 것을
서버측 2층으로 거부하는 기능을 완전하게 구현한다. 4개 라운드(9명 이상의 독립 리뷰어)를 거치며
초판의 검사-시점 결함(CRITICAL, `boolean` 완전 우회)과 여러 WARNING(호출부 중복, `errors`→
`details` 선존 버그, spec 서술 stale 3~4곳, `isRecord` 중복 재구현)이 전부 실코드로 재검증
가능한 형태로 해소됐다. 이번 라운드에서 워킹 디렉터리의 실제 소스·spec·테스트를 프롬프트와
독립적으로 다시 열어 대조한 결과 새로운 CRITICAL/WARNING 은 발견되지 않았다 — 두 phase 검사
순서·정확 일치 경계·깊이 상한·에러 봉투 배선·스코프 경계(webhook/schedule 제외) 모두 구현·
테스트·spec 본문(§6 reason 표, error-handling §1.7, webhook §5.2, replay-rerun §8.1/§10.2,
data-model) 이 line-level 로 일치함을 확인했다. TODO/FIXME 류 미완성 마커도 없다. 대상 테스트
스위트(21 + 47건)를 직접 재실행해 GREEN 을 확인했다.

## 위험도

NONE

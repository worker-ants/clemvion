# 테스트(Testing) 리뷰

## 개요

이번 diff 의 코드 파일 4개(`trigger-parameter.types.ts`, `resolve-trigger-parameters.ts`,
`re-run.dto.ts`, `workflows.controller.ts`)는 `git diff origin/main...HEAD` 로 직접 대조한 결과
전부 주석·JSDoc·Swagger `description` 문자열만 바뀌었고 실행되는 문(statement)·조건식·반환값·
시그니처는 변화가 없다. 나머지 파일(plan 2건, 이전 라운드 `review/code/2026/08/22/19_25_39/**`
아티팩트, `review/consistency/2026/08/22/19_03_59/**` 아티팩트, spec frontmatter 1줄)은 코드가
아니라 프로세스 산출물·문서다.

동일 diff(코드 파일 1-4)를 대상으로 한 직전 라운드(`19_25_39`)의 testing 리뷰가 이미
"신규 테스트 불요, 회귀 유효, 위험도 NONE" 으로 판정했고, 이번 라운드는 그 사이 코드 파일에
추가 변경이 없었다(`resolve-trigger-parameters.ts` JSDoc 의 영/한 혼재를 전량 한국어로 통일한
W1 처분만 반영— 여전히 순수 문서 변경). 아래는 그 결론을 재검증한 결과다.

## 발견사항

- **[INFO]** 신규 테스트 불필요 — 재확인됨
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    (`REASON_TO_DETAIL`, 게이트 40-71), `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`
    (게이트 100-124), `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (게이트 18-26),
    `codebase/backend/src/modules/workflows/workflows.controller.ts` (게이트 320-322 catch 블록)
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src/modules/workflows/workflows.controller.ts`
    로 직접 대조해 확인 — 바뀐 3줄은 전부 `//` 주석 텍스트(영→한)뿐, `throw`/`code`/`details` 구성은
    바이트 단위로 동일. 새로 문서화된 4가지 `reason`→`code` 매핑, `MASKED_VALUE_RESUBMITTED` 거부
    배선, `details[]` 봉투 구성은 기존 spec 으로 이미 회귀 커버된다:
    - `resolve-trigger-parameters.spec.ts` — `toTriggerParameterErrorDetails` describe 블록에서
      `missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted` 4종 매핑 전부
      단언(라인 160-196).
    - `reject-masked-resubmission.spec.ts` — `masked_value_resubmitted` reason 생성 경로 단언
      (라인 39, 309).
    - `workflows.controller.spec.ts` — `response.code === 'INVALID_TRIGGER_PARAMETERS'`(라인 150,
      246), `details[0].code === 'MASKED_VALUE_RESUBMITTED'`(라인 154, 205) 를 단언 — 새로 한국어로
      옮긴 주석("`errors` 가 아니라 `details` 다")이 설명하는 바로 그 구조가 이미 테스트로 고정돼
      있음을 재확인.
  - 제안: 없음.

- **[INFO]** 이연된 테스트 갭 2건은 이번 diff 가 만든 새 갭이 아니라 트래커에 사유와 함께
  명시적으로 계류 중
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 의
    `findMaskedResubmissions`, `resolve-trigger-parameters.ts` 의 `throwIfAny` phase 경계
  - 상세: `plan/complete/masked-marker-cosmetic-followups.md` "함께 하지 않는 것" 절이 두 항목을
    명시적으로 이번 PR 범위 밖으로 뒀다 — 전자는 "세 번째 소비처가 생기면", 후자는 "보안 우회가
    아니라 UX 엣지라 긴급도 낮음" 이 착수 조건/근거로 문서화돼 있다. 둘 다 상위 함수 경유 간접
    커버는 있고(직접 단위 테스트만 부재), 이번 diff 는 그 함수들의 로직을 건드리지 않았으므로
    커버리지 상태에 변화가 없다.
  - 제안: 조치 불요(이미 트래킹됨).

- **[INFO]** `masked-reject-callers-guard` 오탐 위험은 AST 기반 캐너리로 이미 봉쇄 — 재확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts`,
    `masked-reject-callers-guard.ts`
  - 상세: base 함수 JSDoc 에 wrapper 함수명(`resolveTriggerParametersRejectingMasked`)이 처음
    등장해도, 가드가 `ts.createSourceFile` + identifier 노드 매칭이라 주석/문자열 텍스트는
    식별자로 취급되지 않는다. "블록 주석 속 예시"·"접두 겹침" 케이스를 겨냥한 캐너리가 이미 존재.
    plan 문서가 별도로 수행한 `cp` 백업 뮤테이션(2종, 둘 다 RED 확인 후 원복)은 이 자동 캐너리
    위에 얹은 중복 확인이라 결함은 아니지만, 향후 유사 diff 에서는 자동 캐너리 GREEN 만으로도
    충분하다는 점을 팀 지식으로 남길 만하다.
  - 제안: 조치 불요.

- **[INFO]** Swagger description 프로즈 ↔ 마커 상수 동기화 미검증 — 기존 한계, 신규 아님
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24`
  - 상세: description 이 마커 리터럴 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)을 하드코딩된
    프로즈로 나열하는데, 이 값과 `@workflow/masked-markers`(공유 패키지) 상수의 일치를 강제하는
    테스트는 없다. 저장소 전반의 문서-프로즈 공통 한계이며 `spec/.../egress-masking.md §3`("이
    문서는 기계가 지키지 않는다")이 이미 같은 클래스를 소유하고 있어 이번 PR 이 새로 만든 결함이
    아니다.
  - 제안: 이번 범위 조치 불요. 마커 리터럴이 바뀌는 PR 에서 grep 체크리스트 항목으로 인지.

- **[INFO]** `re-run.dto.ts` 는 DTO(데코레이터 전용)라 전용 spec 파일이 없지만, 그 필드가 실제로
  소비되는 지점은 다른 spec 으로 커버됨
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts`
  - 상세: `inputOverride`/`dryRun` 로직 동작은 `executions-rerun.service.spec.ts`,
    `executions.service.spec.ts`, `executions.controller.spec.ts` 에서 커버된다(grep 으로 확인).
    이번 diff 는 `description` 문자열만 바꿨으므로 이 커버리지에 영향 없음.
  - 제안: 없음.

- **[INFO]** plan/review 문서(파일 5-26)는 테스트 대상 아님
  - 위치: `plan/complete/masked-marker-cosmetic-followups.md`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
    `review/code/2026/08/22/19_25_39/**`, `review/consistency/2026/08/22/19_03_59/**`
  - 상세: 순수 프로세스 산출물(직전 라운드 리뷰 아티팩트·plan 갱신)이며 실행 코드가 아니다.
  - 제안: 없음.

## 요약

이번 diff(코드 4파일)는 실행 로직 변경이 0줄인 순수 문서화(JSDoc/Swagger description/인라인
주석 언어 통일) 커밋이며, `git diff origin/main...HEAD` 로 직접 대조해 재확인했다. 새로 문서화된
내용(4가지 `reason`→`code` 매핑, 마스킹 마커 거부 배선, `details[]` 봉투 형태)은 모두 기존 spec
(`resolve-trigger-parameters.spec.ts`, `reject-masked-resubmission.spec.ts`,
`workflows.controller.spec.ts`)이 이미 커버하며 이번 diff 이후에도 그대로 유효함을 라인 번호까지
재검증했다. 남은 갭(`findMaskedResubmissions`/`throwIfAny` 직접 단위 테스트 부재, Swagger 프로즈
↔ 마커 상수 동기화 미검증)은 전부 이 PR 이전부터 존재했고 트래커/plan 에 사유와 함께 명시적으로
계류 중이라 이번 PR 의 신규 결함이 아니다. 추가로 작성해야 할 테스트는 없다.

## 위험도

NONE

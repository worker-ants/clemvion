# 테스트(Testing) 리뷰

## 개요

이 PR 은 plan 문서(`plan/in-progress/masked-marker-cosmetic-followups.md`)에 명시된 대로
**실행 코드 로직 변경 0줄**인 코스메틱 4건이다:

1. `trigger-parameter.types.ts` — `REASON_TO_DETAIL` 4개 항목 중 미문서화된 3개에 JSDoc 추가
2. `resolve-trigger-parameters.ts` — `resolveTriggerParameters` 함수 JSDoc 에 wrapper 역참조 절 추가
3. `re-run.dto.ts` — `ReRunRequestDto.inputOverride` 의 Swagger `description` 문자열 확장
4. `workflows.controller.ts` — 인라인 주석을 영어 → 한국어로 통일 (내용 보존)

4개 파일 diff 를 직접 대조한 결과 `+`/`-` 라인은 전부 주석·JSDoc·문자열 리터럴(Swagger
description) 안에 있고, 실행되는 문(statement)·조건식·반환값에는 변화가 없음을 확인했다.

## 발견사항

- **[INFO]** 신규 테스트 불필요 — 확인됨
  - 위치: 파일 1 `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    (`REASON_TO_DETAIL` 블록, 게이트 40-68), 파일 2
    `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`
    (게이트 108-124), 파일 3 `codebase/backend/src/modules/executions/dto/re-run.dto.ts`
    (게이트 18-26), 파일 4 `codebase/backend/src/modules/workflows/workflows.controller.ts`
    (게이트 313-327 부근 catch 블록)
  - 상세: 네 곳 모두 순수 문서/주석/description 문자열 변경이며 조건 분기·반환값·throw 대상에
    변화가 없다. 해당 로직(4가지 `reason`→`code` 매핑, `MASKED_VALUE_RESUBMITTED` 배선,
    `details[]` 봉투 구성)은 이미 다음 기존 테스트로 커버되어 있고 이번 diff 이후에도 그대로
    유효하다(회귀 확인됨):
    - `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts`
      — `toTriggerParameterErrorDetails` describe 블록에서 `missing_required` /
      `coerce_failed` / `invalid_schema` 3종 매핑 전부 단언 (라인 160-196 부근).
    - `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts`
      — `masked_value_resubmitted` reason 생성 경로 단언 (라인 39, 309).
    - `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` — `execute()`
      엔드포인트가 마스킹 마커 재제출 시 400 + `INVALID_TRIGGER_PARAMETERS` +
      `details[0].code === 'MASKED_VALUE_RESUBMITTED'` 를 반환함을 단언 (라인 130, 150, 154,
      205), 그리고 `details[]` vs `errors` 봉투 형태를 단언하는 캐너리(라인 240 부근 주석 —
      새로 한국어로 옮긴 주석이 설명하는 바로 그 내용)도 존재.
  - 제안: 없음. 이 diff 자체에 대한 추가 테스트는 불필요하다고 판단.

- **[INFO]** 잠재적 회귀(가드 무력화) 위험이 기존 자동 캐너리로 이미 봉쇄됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts`
    (`[캐너리] 블록 주석 속 예시`, `[캐너리] wrapper 만 쓰는 소스를 base 사용으로 오인하지
    않는다`), 대응 가드 로직 `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    의 `importsBaseFn`
  - 상세: 이번 diff 는 `resolve-trigger-parameters.ts`(base 함수) 의 JSDoc 안에서 처음으로
    wrapper 함수명 `resolveTriggerParametersRejectingMasked` 를 언급한다. base 함수명
    `resolveTriggerParameters` 는 그 wrapper 이름의 접두 부분 문자열이므로, 만약
    `masked-reject-callers-guard.ts` 의 판정이 정규식/substring 기반이었다면 이 JSDoc 자체가
    "base 를 코드에서 사용" 으로 오탐되어 `masked-reject-callers.spec.ts` 의 "허용목록 밖에서
    base 함수를 직접 쓰지 않는다" 테스트가 RED 났을 수 있다. 실제로는 그 가드가 AST 파서
    (`ts.createSourceFile` + identifier 노드 매칭)로 전환되어 있어 주석/문자열 안의 텍스트는
    식별자로 취급되지 않으며, 정확히 이 형태(주석 속 이름, 접두 겹침)를 겨냥한 캐너리가 이미
    존재해 자동으로 안전함이 검증된다. plan 문서가 기록한 수동 뮤테이션 검증(`cp` 백업 →
    Manual 경로가 base 를 직접 호출하도록 변형 → RED 확인 → 원복)은 이 기존 자동 캐너리 위에
    얹은 중복 확인이라 해롭지는 않으나, 반복 재현이 필요할 때마다 수작업이라는 점은 유의미하다.
  - 제안: 조치 불필요. 향후 유사 diff(코드 주석에 마스킹 관련 함수명을 추가로 언급하는 경우)에서도
    별도 수동 뮤테이션 검증 없이 기존 캐너리 스위트(`masked-reject-callers.spec.ts`)의 CI 실행만
    신뢰해도 된다는 점을 팀 지식으로 남겨 둘 가치가 있음.

- **[INFO]** Swagger description 프로즈와 마커 상수의 동기화는 테스트로 강제되지 않음
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24`
  - 상세: 새 description 이 마스킹 마커 3종 리터럴(`***` / `[REDACTED]` / `[REDACTED_DEPTH]`)을
    하드코딩된 프로즈로 나열한다. `codebase/packages/masked-markers/src/index.ts` 의
    `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 와 대조한 결과 현재는 정확히
    일치한다. 그러나 이 일치를 강제하는 테스트(예: description 문자열이 `MASKED_MARKERS` 배열의
    각 원소를 포함하는지 확인하는 단위 테스트)는 없다 — 향후 마커 리터럴이 바뀌면 이 Swagger
    문서가 조용히 stale 해질 수 있다. 다만 이는 이 PR 이 만든 결함이 아니라 저장소 전반의 문서
    프로즈에 공통되는 한계이며, `re-run.dto.ts` 하나만의 문제로 보기 어렵다.
  - 제안: 심각도 낮음, 이번 PR 범위에서 조치 불필요. 마커 리터럴이 향후 바뀌는 PR 에서 이
    description 도 함께 갱신 대상으로 인지되도록 grep 체크리스트에 올려두는 정도로 충분.

- **[INFO]** plan 문서(파일 5·6)는 코드가 아니라 프로세스 산출물
  - 위치: `plan/in-progress/masked-marker-cosmetic-followups.md`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  - 상세: 체크리스트 상태와 실제 코드 diff(파일 1-4)를 대조한 결과, "코스메틱 4건 적용" 이라는
    체크가 실제 반영된 4개 코드 변경과 정확히 일치함을 확인했다. 테스트 대상 아님.

## 요약

이번 diff 4개 코드 파일은 전부 주석·JSDoc·Swagger description 문자열 변경으로, 실행 로직·조건
분기·반환값에 변화가 없다. 새로 문서화된 내용(4가지 reason→code 매핑, `MASKED_VALUE_RESUBMITTED`
거부 배선, `details[]` vs `errors` 봉투 형태)은 모두 기존 spec(`resolve-trigger-parameters.spec.ts`,
`reject-masked-resubmission.spec.ts`, `workflows.controller.spec.ts`)로 이미 커버되어 있어
회귀 테스트가 그대로 유효하다. 유일하게 실질적 위험이 있어 보였던 지점 — base 함수 JSDoc 에
wrapper 함수명을 처음 언급함으로써 `masked-reject-callers-guard` 가 오탐할 가능성 — 은 이미
AST 기반 판정 + 전용 캐너리 테스트(`masked-reject-callers.spec.ts` 의 "블록 주석 속 예시"·
"접두 겹침" 케이스)로 자동 봉쇄되어 있음을 코드 확인으로 검증했다. 이번 PR 에 대해 추가로
작성해야 할 테스트는 없다고 판단한다.

## 위험도

NONE

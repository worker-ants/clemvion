# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (누적 diff, 10라운드 처분 후)

## 검토 범위

실제 애플리케이션 코드(파일 1~16):
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts`
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/production-build-devdep-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` (신규)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` / `.spec.ts`
- `codebase/backend/tsconfig.build.json`

나머지(파일 17번대 이후)는 `plan/`·`review/`·`spec/` 산출물로 애플리케이션 코드가 아니라 이번
변경의 배경·근거·이력 기록이다. `CHANGELOG.md` 의 `## Unreleased` 헤더가 여러 개 쌓이는 형태는
저장소 기존 관례(항목마다 개별 헤더, `grep '^## '` 로 20건 이상 확인)와 일치해 이슈 아님.

이 changeset 은 이미 10라운드에 걸쳐 review→fix 를 반복한 결과물이다(`git log` 상 "라운드2"~
"라운드10 처분" 커밋 다수). 앞선 라운드의 maintainability WARNING(두 호출부의 `find+length+throw`
3줄 중복)은 이번 스냅샷에서 `resolveTriggerParametersRejectingMasked` 헬퍼로 이미 캡슐화돼
해소됐다 — `executions.service.ts`/`workflows.controller.ts` 양쪽 다 해당 함수 한 줄 호출로
축약돼 있음을 직접 확인했다.

## 발견사항

- **[INFO]** `REASON_TO_DETAIL` 맵에서 신규 항목만 JSDoc 설명이 달려 있고 기존 형제 3항목은
  무설명이다
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    (`REASON_TO_DETAIL` 상수, `masked_value_resubmitted` 항목)
  - 상세: `missing_required`/`coerce_failed`/`invalid_schema` 세 항목은 `{ code, message }`
    리터럴만 있고 별도 주석이 없는데, 이번에 추가된 `masked_value_resubmitted` 항목만 "왜
    `coerce_failed` 를 재사용하지 않는가" 를 설명하는 6줄짜리 doc comment 를 달고 있다.
    설명 자체는 타당하고(의미가 다른 코드를 재사용하면 다음 사람이 오분기한다는 근거),
    같은 객체 리터럴 안에서 항목별로 문서화 밀도가 크게 다르면 다음에 다섯 번째 reason 을
    추가하는 사람이 "이것도 이렇게 길게 설명해야 하나" 를 판단할 기준이 없다.
  - 제안: 강제할 사안은 아님. 스타일 정합을 원하면 세 형제 항목에도 한 줄짜리 근거를
    보태거나, 반대로 신규 항목의 설명을 함수 상단 docstring 으로 옮겨 리터럴 자체는
    형제들과 동일하게 간결히 유지하는 방법도 있다.

- **[INFO]** 신규 한국어 인라인 주석과 인접한 기존 영어 인라인 주석이 같은 `try/catch` 블록에
  공존한다 (이월 — 이번 diff 가 만든 문제 아님, 앞선 라운드에서 "조치 불요" 로 이미 triage됨)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute` 메서드
    내 `try` 진입 직전 신규 주석(3줄, 한국어) 바로 아래 `catch` 블록의 기존 주석("`details`
    so GlobalExceptionFilter surfaces the per-field breakdown ...", 영어, 미변경 컨텍스트 줄)
  - 상세: 이 저장소 최근 커밋 대부분은 근거 주석을 한국어로 쓰는 쪽으로 수렴하는 추세이고,
    본 diff 의 다른 신규 주석도 전부 한국어다. 같은 함수 안에서 언어가 갈리면 다음에 이
    블록을 여는 사람이 어느 언어로 이어써야 할지 헷갈릴 수 있다. 다만 해당 영어 줄 자체는
    이번 diff 가 건드리지 않은 기존 코드이고, 이미 이전 RESOLUTION(`01_15_47`)이 "이 diff 가
    만든 문제 아님(이월 INFO)" 로 명시적으로 조치 불요 처리했다.
  - 제안: 강제 아님. 다음에 이 블록을 편집할 기회가 있으면 함께 한국어로 통일 검토.

- **[INFO]** `ExecutionsService.reRun` 이 여전히 100줄 넘는 단일 메서드로 6가지 책임(404/권한
  체크·dry-run pre-flight·chain depth 체크·입력 해석·실행 트리거·audit 기록)을 순차 수행한다
  (이월 — 이번 diff 는 그 안에 분기 하나만 추가, 구조 자체는 PR 이전부터 있었고 앞선
  라운드에서 이미 "다음에 손댈 때" 로 defer 됨)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 메서드
    (신규 마스킹 검사 호출은 그 안의 입력 해석 분기, `resolveTriggerParametersRejectingMasked`
    호출부)
  - 상세: 이번 PR 은 기존 `resolveTriggerParameters` 호출을
    `resolveTriggerParametersRejectingMasked` 로 교체하고 `errors`→`details` 를 고친
    수준이라 메서드 길이 자체를 늘리지 않았지만, 계속 커지는 함수에 조건 분기가 누적되는
    기존 패턴은 그대로다.
  - 제안: 이번 PR 스코프에서 강제할 사안 아님(이미 `01_15_47` RESOLUTION 에서 "기존 구조,
    이번 변경은 분기 1개" 로 defer). 다음에 `reRun` 을 손댈 일이 생기면 입력 해석 블록을
    `resolveRerunInput(...)` 류 private 헬퍼로 추출하는 것을 고려.

## 요약

핵심 구현(`reject-masked-resubmission.ts`)은 함수 단위로 잘게 쪼개져 있고(각 함수 10~15줄
내외, 중첩 2단 이내), `MAX_REDACT_DEPTH` 상수를 재사용해 매직 넘버가 없으며, "왜 raw 를 먼저
보는가" "왜 두 phase 로 나뉘는가" 같은 비직관적 설계 결정에 근거 주석이 촘촘히 달려 있어
가독성이 높다. `trigger-parameter.types.ts` 의 신규 reason/code 추가도 기존 3항목과 동일한
네이밍 컨벤션(`snake_case` reason ↔ `UPPER_SNAKE_CASE` code)을 따른다. 앞선 라운드에서 지적된
호출부 중복(WARNING)은 `resolveTriggerParametersRejectingMasked` 헬퍼로 이미 캡슐화돼 해소됐고,
"어느 호출부가 base 를 직접 쓰면 안 되는가" 라는 규칙은 주석이 아니라 AST 기반 repo-guard
(`masked-reject-callers-guard.ts`)로 기계에 위임돼 있어 향후 세 번째 Manual 경로가 실수로
가드를 우회하는 것을 구조적으로 막는다. `MASKED_MARKERS` 를 `Set`→`readonly string[]` +
`Object.freeze` 로 교체한 것도 실제 런타임 불변성을 확보하고 캐너리 테스트로 고정돼 있다.
남은 지적은 전부 INFO 수준이며 그중 둘은 이번 diff 이전부터 있던 상태로 이미 앞선 리뷰
라운드에서 명시적으로 defer 처리된 항목이다. 새로 발견한 것은 `REASON_TO_DETAIL` 리터럴 안의
문서화 밀도 비대칭 하나뿐으로, 기능에 영향 없는 스타일 수준 지적이다.

## 위험도

LOW

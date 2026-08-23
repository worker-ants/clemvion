STATUS=success side_effect review complete
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — masking-gate-consolidation

## 검토 범위

- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/shared/utils/redact-stored-error.ts`
- (plan/spec/review 문서 4~14 는 코드가 아니므로 부작용 관점 대상에서 제외, 파일시스템 부작용 관점에서만 훑음)

## 분석 요약

이 변경은 `inputData`/`outputData`/`error` 세 컬럼을 응답 직전 마스킹하던 4개 호출부를
`redactStoredFieldsForResponse`(DTO 조립 3곳, 부재→`null` 정규화)와
`redactNodeExecutionRow`(`nodeExecutions[]` 행, copy-on-change 보존) 두 헬퍼로 통합한
순수 리팩터다. 모든 함수가 부수효과 없는 순수 변환 함수이고, DB/네트워크/환경변수/전역
상태에 접근하지 않는다.

## 발견사항

- **[INFO] 공개 API 표면 확장 — `redact-stored-error.ts` 신규 export 2개**
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:97` (`redactStoredFieldsForResponse`), `:144` (`redactNodeExecutionRow`)
  - 상세: 종전에 `executions.service.ts` 모듈 내부에만 있던 `maskIfPresent` 기반 로직이
    공유 유틸로 이동하며 `redactNodeExecutionRow<T extends {...}>` 가 제네릭 export 로
    승격됐다. 이 파일 docstring 이 `maskIfPresent` 자체엔 제네릭을 쓰지 않는 이유를
    명시적으로 남겨 뒀는데(`T` 를 `mask` 파라미터 타입에서 추론하면 반환 타입에
    `undefined` 가 섞이는 과거 빌드 실패), `redactNodeExecutionRow` 의 제네릭은 `row`
    (구체 엔티티)에서 `T` 를 추론하므로 같은 함정은 아니다 — `tsc --noEmit` 0건(ratchet
    199 baseline 일치, plan 기록)으로 실측 검증됐다. 다만 이제 다른 모듈도 이 두 함수를
    import 할 수 있어, 향후 재사용 시 계약(부재 처리 방식이 둘이 다름)을 헷갈리면 잘못된
    헬퍼를 고르는 회귀가 재발할 수 있다 — 다만 이는 이 파일 자체의 docstring 이 이미
    명시적으로 경고하고 있어(“왜 헬퍼가 둘인가” 표) 현재 diff 의 결함은 아니다.
  - 제안: 조치 불필요(설계 의도가 문서화됨). 향후 세 번째 소비처가 생기면 그 표를 갱신할
    것.

- **[INFO] 마스킹 필드 spread 순서 — 3개 호출부 전부 확인, 이상 없음**
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1005`
    (`toExecutionDto`), `:1069`(`toResponseExecution`),
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:302`
    (`toNodeExecutionDto`)
  - 상세: `...redactStoredFieldsForResponse(row)` 스프레드가 (a) 객체 리터럴의 마지막
    속성이거나(background-runs, toExecutionDto 는 이후 속성이 겹치지 않는 `executedBy`
    등뿐) (b) `...rest` **다음**에 위치해 원문을 덮는 순서(`toResponseExecution`)로,
    세 지점 모두 마스킹된 값이 원문에 덮이지 않고 최종적으로 노출되는 순서를 유지한다.
    통합 이전 개별 호출 3줄과 동일 순서·동일 로직이라 동작 회귀 없음.
  - 제안: 없음(검증 완료, 기록용).

- **[INFO] 함수 시그니처 변경 없음 — 기존 export 2개는 그대로 보존**
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28`
    (`redactStoredErrorForResponse`), `:66`(`redactStoredDataForResponse`)
  - 상세: 두 저수준 함수는 시그니처·구현 모두 무변경이며 여전히 export 돼 있다. 다만 실
    프로덕션 코드에서 이제 이 두 함수를 직접 import 하는 곳은 `redact-stored-error.ts`
    자신뿐이다(grep 확인, 3개 호출부 모두 신규 헬퍼로 이관 완료 — 반쪽만 이관돼 자매
    호출부가 옛 함수를 계속 쓰는 형태의 회귀는 없음). 하위호환은 깨지지 않았다.
  - 제안: 없음.

- **[INFO] 파일시스템 변경 — plan/review 산출물은 예상된 워크플로 결과물**
  - 위치: `plan/in-progress/masking-gate-consolidation.md`(신규),
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(수정),
    `spec/conventions/egress-masking.md`(수정),
    `review/consistency/2026/08/23/13_55_36/**`(신규 6개 파일)
  - 상세: 코드가 아닌 문서/트래커/consistency-check 산출물이며, `/consistency-check
    --impl-prep` 실행과 SDD 워크플로에 따른 예상된 부산물이다. 런타임 애플리케이션
    코드의 의도치 않은 파일시스템 부작용이 아니다.
  - 제안: 없음(조치 불요, 확인만).

CRITICAL/WARNING 급 부작용은 발견하지 못했다:
- 전역 변수 신설/변경 없음.
- 함수 시그니처 breaking change 없음(모두 additive).
- 환경 변수 읽기/쓰기 없음.
- 네트워크 호출 없음.
- 이벤트/콜백 발생 로직 변경 없음(WS emit·notification 호출부는 이 diff 가 건드리지
  않음).
- 캐시(`snapshotCache`)·트랜잭션·DB write 경로는 이 diff 의 변경 범위 밖이며 무변경.

## 요약

세 마스킹 컬럼을 4곳에서 2개 헬퍼로 합친 순수 리팩터로, 모든 변경이 부수효과 없는
데이터 변환 함수 내부에 갇혀 있다. spread 순서·copy-on-change 계약·기존 export 하위호환
을 직접 대조한 결과 실질적 동작 변화나 의도치 않은 부작용은 발견되지 않았다. 유일한
관찰 포인트는 `redactNodeExecutionRow` 가 제네릭 공개 API 로 승격돼 재사용 표면이
넓어졌다는 점이지만, 이는 설계 의도가 문서화돼 있고 타입체크로 실측 검증됐다.

## 위험도

NONE

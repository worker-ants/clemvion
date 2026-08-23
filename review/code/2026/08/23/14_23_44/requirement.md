# 요구사항(Requirement) 충족 리뷰 — masking-gate-consolidation

## 스코프

`inputData`·`outputData`·`error` 세 컬럼의 egress 마스킹 게이트 4개 호출부
(`toExecutionDto` · `toResponseExecution` · 노드 레벨 루프 · `background-runs.service.ts`)를
`redact-stored-error.ts` 의 신설 헬퍼 두 개(`redactStoredFieldsForResponse` ·
`redactNodeExecutionRow`)로 통합한 순수 리팩터. plan/review 산출물(파일 4~13)은 동작에
영향이 없는 문서/보고서라 요구사항 충족 관점에서는 코드 3파일(`background-runs.service.ts`,
`executions.service.ts`, `redact-stored-error.ts`)과 spec `spec/conventions/egress-masking.md`
정정을 중심으로 점검했다.

## 발견사항

- **[INFO]** `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 를 직접 겨눈 단위 테스트가
  `redact-stored-error.spec.ts` 에는 없다 (그 파일은 리프 함수 `redactStoredErrorForResponse`/
  `redactStoredDataForResponse` 만 테스트).
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (describe 블록 2개,
    신설 헬퍼용 describe 없음)
  - 상세: 두 신설 헬퍼는 `executions.service.spec.ts`/`background-runs.service.spec.ts` 의
    호출부-레벨 테스트로만 간접 검증된다. plan 이 기록한 뮤테이션 실측(M1 5 RED·M2 2 RED,
    `tsc` 선검증 통과)이 이 갭을 실질적으로 메우므로 차단 사유는 아니다 — 다만 향후 헬퍼
    자체의 필드 순서/매핑 버그(예: `inputData`↔`outputData` 스왑)가 호출부 fixture 구성에
    따라 우연히 가려질 잠재 위험은 남는다.
  - 제안: 후속으로 `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 를 직접 겨눈
    소단위 테스트(필드별 매핑·부재 처리·copy-on-change) 1~2개를 `redact-stored-error.spec.ts`
    에 추가하면 이 층위의 향후 회귀를 호출부와 독립적으로 잡을 수 있다. 이번 PR 을 막을
    사안은 아니다.

- **[정합 확인 — 문제 없음]** 신설 헬퍼 두 개의 코드가 spec `spec/5-system/14-external-interaction-api.md`
  §R17 "적용 범위는 총칭이 아니라 열거다"(표면 여섯·컬럼 둘)와 line-level 로 정확히 일치한다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1038`~`1045`
    (표면 1~6 JSDoc 표), `spec/5-system/14-external-interaction-api.md:1532`~`1536`
  - 상세: spec 이 열거한 6표면 — `findById`(1) · `getChain`(2) · `stop`(3) · `toExecutionDto`(4,
    목록) · `findById` 의 `nodeExecutions[]`(5) · `BackgroundRunsService.toNodeExecutionDto`(6,
    본문 노드) — 이 코드의 실제 호출 지점과 정확히 대응한다: 1~3 은 `toResponseExecution`
    한 관문(`redactStoredFieldsForResponse(rest)`, `executions.service.ts:1069`), 4 는
    `toExecutionDto` 가 직접 호출(`executions.service.ts:1005`), 5 는 `redactNodeExecutionRow(ne)`
    (`executions.service.ts:704`), 6 은 `BackgroundRunsService.toNodeExecutionDto` 가
    `redactStoredFieldsForResponse(row)` 호출(`background-runs.service.ts:302`). `error`→
    `redactStoredErrorForResponse`, `outputData`/`inputData`→`redactStoredDataForResponse`
    매핑도 정확히 일치. `inputData` 카브아웃 폐지(2026-08-20) 반영도 세 파일 전부에서 확인됨.
    직접 `redactStoredDataForResponse`/`redactStoredErrorForResponse` 를 부르는 잔존 호출부가
    코드베이스 전체에서 `redact-stored-error.ts` 내부(신설 헬퍼 자신) 외에는 없음을 grep 으로
    확인 — 4곳 통합이 누락 없이 완결됐다.
  - 발견 아님(참고 기록).

- **[정합 확인 — 문제 없음]** copy-on-change 계약과 엔티티 타입 제약(non-null Record)이 옮겨진
  이후에도 그대로 보존된다.
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:127`~`159`
    (`maskIfPresent`, `redactNodeExecutionRow`)
  - 상세: `NodeExecution`/`Execution` 엔티티의 `inputData`/`outputData`/`error` 가 모두
    `Record<string, unknown>`(non-null) 로 선언돼 있어 `redactNodeExecutionRow<T extends {...}>`
    의 제네릭 제약과 정확히 맞고, 세 컬럼 무변화 시 원본 참조를 그대로 반환하는 로직
    (`inputData === row.inputData && ... ? row : {...}`) 도 옛 인라인 구현과 동일하게 보존됐다.
    `executions.service.spec.ts` 의 "⑤-c 원본 참조 그대로" 테스트가 이 계약을 여전히 고정한다.
  - 발견 아님(참고 기록).

- **[정합 확인 — 문제 없음]** `spec/conventions/egress-masking.md §3` 의 stale 트리거 문구
  정정 내용이 실제 코드와 대조해 사실과 일치한다.
  - 위치: `spec/conventions/egress-masking.md:83`~`92`
  - 상세: 문서가 주장하는 "표 2행 소비처(`deepRedactSecrets`)는 신규 래퍼가 흡수하지 않고
    그 위에 선다"는 실제로 `redactStoredDataForResponse`(표 2행이 지목하는 함수) 가
    `redactStoredFieldsForResponse` 내부에서 그대로 호출되는 구조와 일치하며, "표 5행
    (`stripExternalOnlyFields`)은 이번 4개 게이트와 접점이 없다"는 주장도 grep 결과
    (`websocket.service.ts`/`interaction.service.ts` 만 그 함수를 호출) 와 일치한다.
  - 발견 아님(참고 기록).

- **[정합 확인 — 문제 없음]** TODO/FIXME/HACK/XXX 등 미완성 표식이 변경된 3개 코드 파일
  어디에도 없다. 모든 분기가 값을 반환하며 (에러 케이스는 명시적 예외를 던짐), 함수명·JSDoc
  과 실제 구현 사이의 괴리도 발견되지 않았다.

## 요약

`inputData`/`outputData`/`error` 세 컬럼 마스킹 게이트 4곳을 헬퍼 2개(`redactStoredFieldsForResponse`
· `redactNodeExecutionRow`)로 통합한 순수 리팩터로, 동작 변경 없이 EIA §R17 이 정본으로 규정한
6표면·2컬럼 좌표계와 line-level 로 정확히 일치한다. null/undefined 부재 처리, copy-on-change
참조 보존, 엔티티 non-null 타입과 헬퍼 시그니처의 정적 계약도 옛 인라인 구현과 동일하게 보존됐고
잔존 직접 호출부(구 리프 함수 단독 사용)도 없어 통합이 완결됐다. TODO/FIXME 없음, 모든 반환
경로가 적절한 값을 갖는다. 유일한 관찰 사항은 신설 헬퍼 자체를 직접 겨눈 단위 테스트가 없고
호출부-레벨 뮤테이션 테스트로만 간접 검증된다는 점인데, plan 이 기록한 뮤테이션 실측(M1 5 RED·
M2 2 RED, tsc 선검증 통과)이 이를 충분히 상쇄하므로 INFO 로만 남긴다. CRITICAL/WARNING 급
결함은 발견하지 못했다.

## 위험도

NONE

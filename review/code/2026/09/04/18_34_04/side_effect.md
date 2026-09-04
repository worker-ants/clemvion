# 부작용(Side Effect) 리뷰

## 검토 범위

- `CHANGELOG.md` — 신규 항목 추가(문서, 33줄)
- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — `workflowId` 쿼리 필드 제거
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — JSDoc 주석 정정(로직 변경 없음)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 체크리스트 갱신(문서)

## 발견사항

- **[WARNING]** 공개 REST 쿼리 파라미터 제거 — 미검증 외부 소비자는 200 → 400 으로 응답이 바뀐다
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (변경된 코드 블록, 게이트 1~15 부근 — `workflowId?: string | null` 필드·`@IsOptional()`·`@IsUUID()`·`@Transform` 데코레이터 삭제)
  - 상세: `QueryExecutionDto` 에서 `workflowId` 필드가 통째로 삭제됐다. 전역 `ValidationPipe` 가
    `forbidNonWhitelisted: true` 로 설정돼 있음을 `codebase/backend/src/common/pipes/validation.pipe.ts:31` 에서
    직접 확인했다 — 즉 이 필드를 쿼리스트링에 실어 보내던 클라이언트는 이번 배포부터 조용히
    무시되던 200 응답 대신 `400`(unknown property)을 받는다. 이것은 `codebase/`(런타임 동작)에
    영향을 주는 **공개 인터페이스 변경**이며, 리뷰 관점 4(시그니처 변경)·5(인터페이스 변경)에
    정확히 해당한다.
    다만 실측으로 교차검증한 결과 위험은 낮다:
    - `executions.service.ts` 의 `findByWorkflow` 는 `query` 에서 `{page, limit, sort, order, status}`
      만 구조분해하고 `workflowId` 를 읽지 않는다(`:750-757` 직접 확인) — 내부 소비자 없음.
    - frontend `ExecutionListParams`(`codebase/frontend/src/lib/api/executions.ts:87-93`)에도
      `workflowId` 필드가 없다 — FE 소비자 없음.
    - `test/workflow-execution.e2e-spec.ts` 의 관련 e2e(`B. GET .../workflow/:workflowId`)는
      이 쿼리 파라미터를 보내지 않는다 — 저장소 내 테스트 회귀 없음.
    - 저장소 내 OpenAPI 코드젠 소비자도 없음(grep 재확인, CHANGELOG 서술과 일치).
    남는 위험은 **저장소 밖 제3자 클라이언트**뿐이며, 이는 이번 diff 로 판단 가능한 범위를 벗어난다.
  - 제안: 이미 CHANGELOG·plan(`spec-draft-nullable-notation-followups.md` §후속)에 영향 분석과
    사용자 결정(옵션 A: 제거)이 상세히 기록돼 있어 별도 조치는 불필요해 보인다. 다만 이 변경이
    배포되는 시점에는 API 변경 로그/버전 고지 채널(있다면)에도 반영되는지 확인 권장.

- **[INFO]** JSDoc 전용 변경 — 실행 경로 영향 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`findSwaggerContractMismatches` 함수 위 주석 블록, 게이트 100~120)
  - 상세: diff 전체가 `/** ... */` 블록 내부 텍스트 교체이며, `readBooleanOption`·`hasTopLevelNull`·
    `findSwaggerContractMismatches` 등 실제 판정 로직(게이트 122~185)은 unchanged. 부작용 없음.

- **[INFO]** CHANGELOG.md / plan 문서 갱신 — 순수 문서, 부작용 없음
  - 위치: `CHANGELOG.md` (게이트 3~35, 신규 섹션), `plan/in-progress/spec-draft-nullable-notation-followups.md` (게이트 307~324, 376)
  - 상세: 마크다운 프로즈 추가·체크박스 상태 변경뿐이며 실행되는 코드가 아니다. 전역 상태·파일시스템·
    네트워크·환경변수에 영향을 줄 수 있는 요소 없음.

## 요약

이번 diff 는 사실상 하나의 실질 코드 변경(`QueryExecutionDto.workflowId` 필드 삭제)과 세 개의
문서/주석 변경으로 구성된다. 코드 변경은 전역 `forbidNonWhitelisted: true` 파이프 설정과 맞물려
**공개 REST 쿼리 파라미터를 제거하는 breaking 변경**이라는 점에서 부작용 관점의 유일한 실질
항목이지만, 내부 소비자(서비스 구조분해)·FE 소비자·e2e·OpenAPI 코드젠 소비자 부재를 직접
grep/코드 대조로 재확인했고, 영향 분석과 사용자 결정이 CHANGELOG·plan 문서에 이미 상세히
기록돼 있다. `swagger-dto-contract-guard.ts` 변경은 로직 변경 없는 주석 정정이고, 나머지 두
파일은 문서(CHANGELOG/plan)로 실행 부작용이 없다. 전역 변수·파일시스템·환경변수·네트워크
호출·이벤트/콜백 관련 부작용은 발견되지 않았다.

## 위험도

LOW

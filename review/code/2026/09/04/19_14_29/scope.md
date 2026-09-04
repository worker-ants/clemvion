# 변경 범위(Scope) 리뷰

## 개요

이번 diff(37개 파일)는 명확히 두 층으로 구성된다.

1. **핵심 구현(5파일)**: `CHANGELOG.md`, `codebase/backend/src/common/pipes/validation.pipe.spec.ts`,
   `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`,
   `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`,
   `plan/in-progress/spec-draft-nullable-notation-followups.md` — 단일 작업 "`GET
   /api/executions/workflow/:workflowId` 의 죽은 쿼리 파라미터 `workflowId` 제거"(plan 이 사용자
   결정으로 이미 확정한 "옵션 A: 제거")로 정확히 수렴한다.
2. **리뷰/일관성 산출물(32파일)**: `review/code/2026/09/04/18_34_04/**`(1차 `/ai-review` 결과 +
   `RESOLUTION.md`), `review/code/2026/09/04/18_56_22/**`(1차 조치 후 2차 `/ai-review` 결과 +
   `RESOLUTION.md`), `review/consistency/2026/09/04/18_51_26/**`(`/consistency-check` 결과) —
   `CLAUDE.md` "정보 저장 위치" 표가 규정한 `review/code/**`·`review/consistency/**` 표준 저장
   위치의 신규 파일(new file mode)이며, "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"
   조항에 따라 같은 PR 사이클에 함께 커밋되는 것이 정상 워크플로다.

## 점검 관점별 판정 (핵심 구현 5파일)

1. **의도 이상의 변경**: 없음. 실질 코드 변경은 `query-execution.dto.ts`에서 `workflowId` 필드 +
   `@IsOptional()`/`@IsUUID()`/`@Transform` 데코레이터 삭제 하나뿐이다. `status` 필드·부모 클래스는
   손대지 않았다. `validation.pipe.spec.ts`의 신규 테스트 2건은 1차 리뷰(`18_34_04` W2 "이 변경의
   요점인 200→400 동작을 고정하는 테스트가 없다")에 대한 직접 응답이고, `RESOLUTION.md`에 그 대응이
   명시돼 있다 — 같은 사이클 안에서 리뷰 지적을 수정하는 것은 프로젝트가 요구하는 표준 절차이지
   범위 이탈이 아니다.
2. **불필요한 리팩토링**: 없음.
3. **기능 확장**: 없음. 새 기능 추가 없이 죽은 필드 제거 + 회귀 테스트 추가뿐.
4. **무관한 수정**: 없음. `swagger-dto-contract-guard.ts`의 JSDoc 변경은 그 문서가 예시로 들던
   필드(`QueryExecutionDto.workflowId`)가 이번 diff 로 제거되면서 "`@Transform` 예외의 실사례가
   0건이 됐다"는 사실을 갱신하는 것으로, 제거 작업의 직접 파생 효과다.
5. **포맷팅 변경**: 없음. `import { IsOptional, IsIn, IsUUID } from 'class-validator'` →
   `import { IsOptional, IsIn }`, `import { Transform } from 'class-transformer'` 줄 전체 삭제는
   필드 삭제에 따른 필연적 정리이며 임의 재포맷팅 흔적은 없다.
6. **주석 변경**: `query-execution.dto.ts`에 신설된 클래스 JSDoc(제거 사유·근거·실측)은 이 저장소가
   `swagger-dto-contract-guard.ts` 등에서 이미 쓰는 "날짜+근거를 소스에 남기는" 관례와 일치하고,
   변경 자체(공개 필드 제거)의 근거를 남기는 것이므로 불필요한 주석이 아니다.
7. **임포트 변경**: `IsUUID`(class-validator), `Transform`(class-transformer) 제거는 삭제된 필드가
   쓰던 심볼이 파일 내 다른 곳에서 참조되지 않음(전체 파일 컨텍스트로 확인)에 따른 정당한 정리다.
8. **설정 변경**: 없음.

## 리뷰/일관성 산출물(32파일)에 대한 별도 판정

- 표본 확인(`api_contract.md`, `documentation.md`, `maintainability.md`, `requirement.md`,
  `security.md`, `side_effect.md`, `testing.md`, 각 라운드의 자체 `scope.md`, consistency 5개
  checker 파일, `meta.json`/`_retry_state.json`) 결과 전부 동일한 단일 작업("`workflowId` 죽은
  쿼리 파라미터 제거")만을 다룬다 — 다른 세션·다른 작업의 잔여물이 섞여 들어온 흔적은 없다.
  `18_34_04/meta.json`·`18_56_22/meta.json`의 `files` 목록도 핵심 4파일과 정확히 일치한다.
- `18_56_22/RESOLUTION.md`가 기록한 조치(테스트 언어를 기존 파일 컨벤션인 영어로 통일, 응답 바디
  `code` 단언 추가, JSDoc 의 ephemeral 리뷰 세션 ID 인용을 SoT 인 plan 문서 인용으로 교체)가 이번
  diff 최상단의 `validation.pipe.spec.ts` 최종 상태와 실제로 일치함을 대조 확인했다 — 두 리뷰
  라운드에서 지적된 사항이 조용히 누락되지 않고 최종 코드에 반영돼 있다.
- `18_34_04/scope.md`·`18_56_22/scope.md`(직전 두 라운드의 scope 리뷰 자체)도 이미 같은 결론(핵심
  변경은 단일 작업에 수렴, 산출물 동반 커밋은 정상 절차)에 도달해 있어 이번 판정과 정합한다.
- 32개 파일은 "산출물"이라 이 리뷰가 판단할 "요청 범위" 자체는 아니고, 프로세스의 부산물이다.

## 발견사항

- **[INFO]** 리뷰/일관성 산출물 32개 파일이 핵심 구현 5개 파일과 함께 한 커밋 diff 에 포함됨
  - 위치: `review/code/2026/09/04/18_34_04/*`, `review/code/2026/09/04/18_56_22/*`,
    `review/consistency/2026/09/04/18_51_26/*` (전체 신규 파일, 게이트 전체가 `+` 추가 줄)
  - 상세: 프로젝트 컨벤션상 정상 산출물 저장 위치이며 표준 워크플로 부산물이다. 표본 검증 결과
    전부 이번 작업(`workflowId` 제거)에 관한 내용만 담고 있어 다른 작업의 혼입은 없다. 파일
    수(32:5)만 보면 비대해 보이지만, 이는 리뷰-수정-재리뷰 2라운드 + consistency-check 1라운드를
    거친 정상 감사 이력이지 범위 이탈이 아니다.
  - 제안: 조치 불요. 참고 사항으로만 기록.

CRITICAL/WARNING 은 발견되지 않았다.

## 요약

이번 diff는 "`GET /api/executions/workflow/:workflowId`의 죽은 쿼리 파라미터 `workflowId` 제거"라는
단일 작업(plan 이 사용자 결정으로 이미 확정한 옵션 A)에 정확히 수렴한다. 핵심 코드 변경(DTO 필드·
임포트 삭제)은 요청 그 자체이고, 부수 변경(신규 회귀 테스트, 가드 JSDoc 갱신, CHANGELOG/plan 갱신)은
모두 같은 작업의 직접 파생물이거나 같은 PR 사이클 내 1·2차 리뷰 라운드 지적사항에 대한 명시적
수정으로, 프로젝트가 요구하는 정상 절차다. 요청 외 리팩토링·기능 확장·무관한 파일 수정·의미 없는
포맷팅·불필요한 주석·사용하지 않는 임포트·의도치 않은 설정 변경 어느 것도 발견되지 않았다. 함께
커밋된 32개 리뷰/일관성 산출물은 프로젝트 컨벤션이 규정하는 표준 저장 위치의 정상 부산물이며 내용도
동일 작업에 국한됨을 표본 확인했다.

## 위험도

NONE

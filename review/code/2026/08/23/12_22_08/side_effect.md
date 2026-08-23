# 부작용(Side Effect) Review — swagger-decisions

## 검토 범위 요약

13개 변경 파일 중 실질적 런타임/인터페이스 영향이 있는 곳은 파일 1
(`execute-workflow.dto.ts`)뿐이다. 나머지는 테스트 추가(파일 2), plan/tracker
문서(파일 3·4), 이미 생성돼 있던 `review/consistency/**` 감사 산출물의 신규 커밋
(파일 5~12), spec 문서 개정(파일 13)으로 전부 문서/테스트 성격이다.

## 발견사항

- **[INFO]** `ExecuteWorkflowDto.input` 에 `deprecated: true` 추가 — 공개 OpenAPI 스키마 표면 변경
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:66` (`전체 파일 컨텍스트` 게이트)
  - 상세: `@ApiPropertyOptional` 데코레이터에 `deprecated: true` 가 추가되어, 이 DTO 로 생성되는
    Swagger/OpenAPI 문서(`components.schemas.ExecuteWorkflowDto.properties.input`)에 `deprecated`
    플래그가 새로 노출된다. 이는 점검 관점 5번("인터페이스 변경")에 해당하는 **의도적** 공개 API
    문서 변경이다. 런타임 동작에는 영향이 없음을 같은 PR 의 캐너리 테스트로 확인했다 —
    `execute-workflow.dto.ts` 최상단 JSDoc(라인 1~29 부근)이 명시하듯 이 DTO 는 `@Body()` 파라미터
    타입이 아니라 `@ApiBody({ type })` 전용이라 `CustomValidationPipe` 를 전혀 거치지 않고
    (`workflows-execute-body.spec.ts:41-47` 캐너리 — `executeBodyParamType()` 은 여전히 `Object`),
    데코레이터 메타데이터만 바뀌었을 뿐 요청 처리 로직·시그니처는 그대로다. 다운스트림 영향은
    OpenAPI 문서를 소비하는 도구(SDK 코드 생성기, `/docs` UI 등)가 이 필드를 deprecated 로
    표시하는 것으로 한정되며, 이는 트래커(`spec-sync-external-interaction-api-gaps.md`)와
    `swagger-decisions.md` 에 기록된 사용자 결정을 정확히 집행한 것이다.
  - 제안: 없음 — 의도된 변경이고 회귀 방지 캐너리(`workflows-execute-body.spec.ts` 의
    `[결정] input 만 deprecated 로 표시된다`, `[캐너리] @Body() 파라미터는 DTO 로 타입되지 않는다`)가
    이미 이 경계(문서만 바뀌고 런타임은 안 바뀐다)를 고정하고 있다.

- **[INFO]** `description` 문자열 변경 — 마커 거부 안내 문구에 "신규 통합은 `parameterValues` 를
  쓴다" 한 문장 추가
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:63`
  - 상세: 순수 텍스트 문구 확장이며 스키마 타입·검증 규칙에는 영향이 없다. 부작용 없음.

- **[INFO]** 함수/메서드 시그니처 변경 없음 — `ExecuteWorkflowDto` 클래스의 필드 타입
  (`input?: Record<string, unknown>`)·개수·`ExecuteWorkflowDto` 를 참조하는
  `WorkflowsController.execute` 의 `@ApiBody({ type })` 배선 모두 무변경. 점검 관점 4번(시그니처
  변경)·8번(이벤트/콜백)에 해당하는 항목 없음.

- **[INFO]** 전역 변수·환경 변수·네트워크 호출 도입 없음 — 검토 대상 diff 전체(DTO, 테스트,
  plan 문서, spec 문서, 신규 review 산출물)에 전역 상태 변경, `process.env` 읽기/쓰기, 외부 서비스
  호출을 추가하는 코드가 없다.

- **[INFO]** `review/consistency/2026/08/23/11_59_11/**` 신규 파일 6개(`SUMMARY.md`,
  `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`,
  `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`) 커밋 — 파일시스템 부작용
  관점(3번)에서는 "예상치 못한 파일 생성"처럼 보일 수 있으나, 이 저장소 컨벤션상
  `/consistency-check` 산출물은 `review/**` 아래 정식으로 남기고 커밋하는 것이 표준 워크플로다
  (`CLAUDE.md` "정보 저장 위치" 표, memory `plan_checkbox_actual_state` — "review/ 는 gitignored
  아님"). 내용도 이번 DTO/문서 변경 자체에 대한 감사 기록이라 diff 범위와 정합적이다. 우려할
  부작용 아님 — 참고로만 남긴다.

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
  `plan/in-progress/swagger-decisions.md` — 체크박스 flip·결정 기록 추가는 순수 문서 편집이며
  코드 실행 경로에 영향 없음.

## 요약

이번 변경의 유일한 실질적 부작용은 `ExecuteWorkflowDto.input` 필드에 `deprecated: true` 를 얹어
공개 OpenAPI 스키마 표면을 바꾼 것이며, 이는 사용자가 명시적으로 결정하고 트래커·plan 문서에
근거를 남긴 **의도된** 인터페이스 변경이다. 런타임 요청 처리 경로(`@Body()` 파라미터, 검증
파이프)는 전혀 건드리지 않았고, 이를 지키는 캐너리 테스트가 같은 PR 에 포함돼 있다. 그 외
전역 상태·환경 변수·네트워크 호출·함수 시그니처·이벤트/콜백에 대한 의도치 않은 변경은 발견되지
않았다. 나머지 파일(테스트 추가, plan/tracker 문서, spec 문서, 신규 커밋된 review 감사 산출물)은
모두 문서·테스트 범주로 부작용 위험이 없다.

## 위험도

NONE

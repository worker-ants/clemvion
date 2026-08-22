STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 1 INFO

===REPORT_MARKDOWN_BELOW===

# 부작용(Side Effect) 리뷰 — `execute-body-dto` (`POST /workflows/:id/execute` OpenAPI 문서화)

## 조사 범위

리뷰 대상 5개 파일 중 실제 런타임 코드는 3개다: 신설 `execute-workflow.dto.ts`, 신설
`workflows-execute-body.spec.ts`, 그리고 기존 `workflows.controller.ts` 에 대한 `@ApiBody` 추가.
나머지 2개(`plan/in-progress/execute-body-openapi.md`, `spec-sync-external-interaction-api-gaps.md`)는
문서/체크리스트 갱신이라 부작용 표면이 없다. 프롬프트에 함께 포함된 파일 6~13
(`review/consistency/2026/08/22/23_46_23/*`)은 이전 `/consistency-check --impl-prep` 세션이 이미
`review/**` (프로젝트 지정 경로)에 남긴 리포트 산출물로, 이번 작업이 새로 만든 파일시스템 부작용이
아니라 프로젝트 규약이 지정한 정상 워크플로 산출물이다 — 별도 지적하지 않는다.

## 발견사항

- **[INFO]** `@ApiBody` 추가는 공개 OpenAPI 스키마(문서 표면)를 바꾼다 — 런타임 계약은 무변경
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:256` (`@ApiBody({ type: ExecuteWorkflowDto, required: false })`)
  - 상세: `SwaggerModule` 이 서빙하는 `/api/docs`·`swagger.json` 에 `POST /workflows/:id/execute` 의
    요청 본문 스키마가 새로 노출된다(이전에는 `@ApiBody` 부재로 스키마가 없었음). 이는 "인터페이스
    변경"(점검 관점 5)에 해당하지만, `@Body()` 파라미터 타입은 그대로 인라인 `{ input?, parameterValues? }`
    이고(`workflows.controller.ts:281-285`), 전역 `CustomValidationPipe`(`APP_PIPE` — `app.module.ts:202`)의
    `toValidate()` 는 metatype 이 `Object` 면 검증을 스킵하므로(`validation.pipe.ts`) 실제 요청 처리
    로직·거부 규칙은 한 글자도 바뀌지 않는다. `ExecuteWorkflowDto` 에 class-validator 데코레이터가
    없다는 점도 실측 확인(순수 `@ApiPropertyOptional` 만). 즉 이 변경의 유일한 실질 효과는 **문서
    표면**이며, 이는 PR 의 명시된 의도이고 `additionalProperties: true` 로 열어 뒀기 때문에 기존
    호환 클라이언트를 깨뜨리지 않는다.
  - 제안: 조치 불필요 — 의도된 문서 전용 변경이며 캐너리 테스트(`workflows-execute-body.spec.ts`)가
    "누군가 실수로 `@Body()` 파라미터 타입을 DTO 로 승격시키는" 실제 계약 축소 회귀를 잡는다. 참고로만
    남긴다.

## 점검 관점별 확인 결과 (이상 없음)

- **의도치 않은 상태 변경 / 전역 변수**: 신설 DTO 는 데코레이터만 가진 순수 데이터 클래스이고, 컨트롤러
  변경은 import 추가 + 메서드 데코레이터 1개 추가뿐이다. 모듈 로드 시점 부작용(top-level 부수 실행)
  없음.
- **파일시스템 부작용**: 런타임 코드 3개 파일 모두 파일 I/O 를 수행하지 않는다.
- **시그니처 변경**: `WorkflowsController.execute()` 의 실제 파라미터 타입(마지막 인자 `@Body()`)은
  변경되지 않았다 — 신설 테스트(`workflows-execute-body.spec.ts:32-38`)가 `design:paramtypes` 메타데이터로
  이를 직접 검증(`toBe(Object)` / `not.toBe(ExecuteWorkflowDto)`)한다. 이 캐너리를 실측으로 확인했다:
  `CustomValidationPipe.toValidate()` 는 `[String, Boolean, Number, Array, Object]` 를 제외 목록에
  두므로, 만약 파라미터 타입이 실수로 `ExecuteWorkflowDto` 로 바뀌면 검증이 진입해 여분 top-level
  키·심지어 빈 객체까지 400 으로 거부된다 — 테스트의 대조군(`it.each`)이 정확히 이 실패 모드를 고정한다.
  이번 diff 는 그 실수를 저지르지 않았다.
  - `WorkflowsController.executeNode()`, `create()`, `update()`, `saveCanvas()`, `importWorkflow()` 등
    나머지 메서드 시그니처도 이번 diff 로 건드리지 않았음을 전체 파일 컨텍스트로 확인.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 신설 DTO·컨트롤러 데코레이터·테스트 어느 쪽도 외부 서비스를 호출하지 않는다.
  테스트는 `new CustomValidationPipe()` 를 DI 컨테이너 없이 직접 인스턴스화하지만, 그 클래스 생성자는
  상태를 갖지 않는 `@Injectable()` 이라(필드 없음) 부트스트랩 부작용이 없다.
- **이벤트/콜백**: 이번 diff 는 이벤트 emit·콜백 등록 지점을 하나도 건드리지 않는다(`execute()` 본문의
  `executionEngineService.execute(...)` 호출부는 diff 밖).

## 요약

이번 변경은 `POST /workflows/:id/execute` 의 `@Body()` 파라미터 타입을 의도적으로 그대로 두고
`@ApiBody({ type: ExecuteWorkflowDto })` 로 OpenAPI 스키마만 추가하는 순수 문서화 작업이다. 신설
DTO 는 class-validator 데코레이터가 없는 데이터 홀더일 뿐이고, 전역 `CustomValidationPipe` 의
`Object` 제외 로직 덕분에 런타임 검증 경로는 변경 전후 동일함을 실측(`toValidate` 소스 + 캐너리
테스트)으로 확인했다. 전역 상태·파일시스템·환경변수·네트워크·이벤트 어느 축에서도 의도치 않은
부작용은 발견되지 않았다. 유일한 관찰은 공개 OpenAPI 스키마 표면이 추가된다는 점(INFO)이며, 이는
PR 이 명시적으로 의도한 변경이고 `additionalProperties: true` 로 기존 클라이언트 호환성을 보존한다.

## 위험도

NONE

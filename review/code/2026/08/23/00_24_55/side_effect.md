STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 1 INFO

===REPORT_MARKDOWN_BELOW===

# 부작용(Side Effect) 리뷰 — `execute-body-dto` (`POST /workflows/:id/execute` OpenAPI 문서화, 재검증 라운드)

## 조사 범위

프롬프트에 실린 26개 파일 중 런타임 코드는 3개뿐이다: 신설
`codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`, 신설
`codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts`, 기존
`codebase/backend/src/modules/workflows/workflows.controller.ts` 의 `@ApiBody` 데코레이터
추가. 나머지는 plan 문서(`plan/complete/execute-body-openapi.md`,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)와 이전 리뷰/consistency-check
세션(`00_07_27`, `23_46_23`)이 프로젝트 규약(`review/**`)에 따라 남긴 산출물이다 — 이번 작업이
새로 만든 임의 파일시스템 부작용이 아니라 정상 워크플로 산출물이므로 부작용 관점에서 별도
지적하지 않는다. 이 라운드(`00_24_55`)는 직전 라운드(`00_07_27`)의 W1(마커 규칙 description
누락)·W3(OpenAPI 노출 가드 부재) 지적을 반영한 재검증이다 — 컨트롤러/DTO 런타임 코드 자체는
전 라운드와 부작용 표면이 동일하다.

컨트롤러의 실제 `execute()` 시그니처를 직접 읽어 확인:

```ts
async execute(
  @Param('id', ParseUUIDPipe) id: string,
  @WorkspaceId() workspaceId: string,
  @CurrentUser() user: JwtPayload,
  @Res({ passthrough: true }) res: Response,
  @Body()
  body?: {
    input?: Record<string, unknown>;
    parameterValues?: Record<string, unknown>;
  },
)
```

`@Body()` 파라미터는 diff 이후에도 인라인 객체 타입 그대로다 — `ExecuteWorkflowDto` 는 오직
`@ApiBody({ type: ExecuteWorkflowDto, required: false })` 로만 참조된다.

## 발견사항

- **[INFO]** `@ApiBody` 추가는 공개 OpenAPI 스키마(문서 표면)를 넓힌다 — 런타임 계약은 무변경
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute()` 메서드에
    붙인 `@ApiBody({ type: ExecuteWorkflowDto, required: false })` (게이트 256)
  - 상세: `SwaggerModule` 이 서빙하는 문서(`/api/docs`·`swagger.json`)에 `POST
    /workflows/:id/execute` 요청 본문 스키마가 처음으로 노출된다 — 이전에는 `@ApiBody` 부재로
    스키마가 없었다. 이는 점검 관점 5("인터페이스 변경")에 해당하지만, 실제 파라미터 타입은
    바뀌지 않았고(`@Body() body?: { input?, parameterValues? }` 그대로) 전역
    `CustomValidationPipe.toValidate()` 는 metatype 이 `Object` 인 경우를 제외 목록에 두므로
    검증 로직·거부 규칙은 한 글자도 바뀌지 않는다. `ExecuteWorkflowDto` 자체도 class-validator
    데코레이터 없이 `@ApiPropertyOptional` 만 가진 순수 데이터 홀더다(직접 확인). 즉 이 변경의
    유일한 실질 효과는 문서 표면이며, `additionalProperties: true` 로 열려 있어 기존 호환
    클라이언트를 깨뜨리지 않는다. PR 의 명시된 의도이자 뮤테이션 테스트로 실측 검증됐다.
  - 제안: 조치 불필요 — 캐너리(`workflows-execute-body.spec.ts`)가 "누군가 실수로 `@Body()`
    파라미터 타입을 DTO 로 승격시키는" 실제 계약 축소 회귀와 "`@ApiBody` 가 형제
    `ExecuteNodeDto` 를 잘못 참조"하는 문서 표면 회귀를 모두 잡는다. 참고로만 남긴다.

## 점검 관점별 확인 결과 (이상 없음)

- **의도치 않은 상태 변경 / 전역 변수**: 신설 DTO(`ExecuteWorkflowDto`)는 데코레이터만 가진 순수
  데이터 클래스이고, 컨트롤러 변경은 import 1개 + 메서드 데코레이터 1개 추가뿐이다. 모듈 로드
  시점 부수 실행(top-level side effect) 없음. 전역 변수 신설·수정 없음.
- **파일시스템 부작용**: 런타임 코드 3개 파일(DTO·컨트롤러·spec) 모두 파일 I/O 를 수행하지
  않는다.
- **시그니처 변경**: `WorkflowsController.execute()` 의 실 파라미터 타입(마지막 인자 `@Body()`)은
  변경되지 않았음을 소스에서 직접 확인. 신설 스펙(`workflows-execute-body.spec.ts`)이
  `design:paramtypes` 메타데이터로 `toBe(Object)` / `not.toBe(ExecuteWorkflowDto)` 를 직접
  단언해 이 사실을 회귀 가드로 고정한다. 나머지 컨트롤러 메서드(`duplicate`, `create`, `update`
  등)의 시그니처도 이번 diff 로 건드리지 않았다.
- **인터페이스 변경**: 위 INFO 항목 참조 — OpenAPI 문서 표면만 확장, REST 계약(요청/응답 실제
  형태)은 무변경.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 신설 DTO·컨트롤러 데코레이터 어느 쪽도 외부 서비스를 호출하지 않는다.
  신설 spec 의 `beforeAll` 이 `Test.createTestingModule(...).compile()` 후 `app.init()` 을
  호출하지만 `app.listen()` 은 호출하지 않으므로 실제 소켓 바인딩(네트워크 리스닝)이 발생하지
  않는다 — `SwaggerModule.createDocument()` 로 문서 객체만 인메모리 생성 후 `finally` 블록에서
  `app.close()` 로 정리한다(예외 발생 시에도 누수 없음, 직접 확인).
- **이벤트/콜백**: 이번 diff 는 이벤트 emit·콜백 등록 지점을 하나도 건드리지 않는다
  (`execute()` 본문 내 `executionEngineService`/`resolveTriggerParametersRejectingMasked` 등
  호출부는 diff 밖).

## 부수 관찰 (비차단)

- `workflows-execute-body.spec.ts` 최상단의 `import 'reflect-metadata'` 는 전역 폴리필이지만,
  `@nestjs/core`/`@nestjs/common` 이 이미 자체적으로 `reflect-metadata` 를 로드하므로(자매 스펙
  `interact-ack-response.dto.spec.ts` 는 이 import 없이도 동일 패턴이 동작) 사실상 중복이다.
  다만 idempotent 한 폴리필 import 라 실행 시 부작용은 없다 — 정보 제공 목적으로만 기록, 조치
  불요.

## 요약

이번 diff 는 `POST /workflows/:id/execute` 의 `@Body()` 파라미터 타입을 의도적으로 그대로 두고
`@ApiBody({ type: ExecuteWorkflowDto, required: false })` 로 OpenAPI 스키마만 추가하는 순수
문서화 작업이며, 신설 스펙은 그 경계(런타임 무변경 + 문서 표면 정확성)를 캐너리·가드 테스트로
직접 고정한다. 컨트롤러 실제 시그니처를 소스에서 재확인한 결과 파라미터 타입·주입 순서 어느
것도 바뀌지 않았고, 테스트의 NestJS 앱 부트스트랩은 `listen()` 없이 `init()`/`close()` 로만
쓰여 네트워크·리소스 누수가 없다. 전역 상태·파일시스템·환경변수·네트워크·이벤트 어느 축에서도
의도치 않은 부작용은 발견되지 않았다. 유일한 관찰은 공개 OpenAPI 스키마 표면이 확장된다는
점(INFO)이며 이는 PR 이 명시적으로 의도한 변경이고 `additionalProperties: true` 로 기존
클라이언트 호환성을 보존한다. 직전 라운드(`00_07_27`)의 부작용 평가와 결론이 일치하며, 이번
라운드에서 추가된 W1/W3 반영분(description 문구 보강, OpenAPI 노출 가드 4건)도 부작용 표면을
새로 열지 않는다.

## 위험도

NONE

# 부작용(Side Effect) 리뷰 — canvas-save-typed (2R, 22_24_07)

## 발견사항

- **[INFO]** OpenAPI 로 광고하는 응답 스키마가 좁아진다(공개 인터페이스 변경이나 런타임 무영향으로 확인)
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` — `CanvasSaveResultDto.nodes`(80행) · `.edges`(85행), `@ApiProperty({ type: 'array', items: { type: 'object' } })` + `Record<string, unknown>[]` → `@ApiProperty({ type: () => [NodeDto] })`/`[EdgeDto]` + `NodeDto[]`/`EdgeDto[]`
  - 상세: `POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore` 의 OpenAPI 계약이 "타입 없는 열린 객체 배열"에서 "`NodeDto`/`EdgeDto` `$ref` 배열"로 좁아진다. 직접 확인한 결과 런타임 직렬화 경로는 바뀌지 않는다:
    1. 컨트롤러(`workflows.controller.ts` `saveCanvas`/`restoreVersion`)는 명시적 반환 타입 애너테이션 없이 서비스 반환값을 그대로 통과시킨다 — `CanvasSaveResultDto` 로 캐스팅/인스턴스화하지 않는다.
    2. `ApiOkWrappedResponse`(`codebase/backend/src/common/swagger/api-wrapped.ts`)는 `ApiExtraModels` + `ApiOkResponse({ schema })` 만 적용하는 순수 OpenAPI 문서 데코레이터이고, `NodeDto`/`EdgeDto` 는 `class-transformer` 의 `@Expose`/`@Exclude`/`@Type` 을 쓰지 않는다 — `ClassSerializerInterceptor` 도 이 응답 클래스 주석(`workflow-response.dto.ts:68-69`)이 명시하듯 걸리지 않는다. 따라서 `@ApiProperty` 시그니처 변경이 실제 바디 직렬화에 영향을 주지 않는다.
    3. `grep` 결과 `CanvasSaveResultDto` 참조자는 DTO 파일 자신·컨트롤러(데코레이터 인자)·신규 unit·e2e 뿐이다 — 다른 in-repo 소비자(frontend 등)가 이 타입을 가져다 쓰는 자리는 없다.
    4. `NodeDto`/`EdgeDto` 는 각각 자신의 엔티티만 import 하고 `workflows` 모듈을 참조하지 않아 순환 import 도 없다(단방향 `workflows/dto → nodes/dto`, `workflows/dto → edges/dto`).
  - 제안: 조치 불요. CHANGELOG(`CHANGELOG.md` Unreleased 항목)에 "서버는 원래 이 형태를 돌려주고 있었다 — 응답 자체는 그대로다" 로 이미 고지됨. 저장소 밖에서 이 OpenAPI 스키마로 codegen 클라이언트를 만드는 외부 소비자가 있다면 재생성이 필요할 수 있으나 breaking 은 아니다.

- **[INFO]** 신규 e2e "I. 버전 복원" 은 새 워크플로우 생성·저장·복원을 실 HTTP 호출로 수행하지만 새로운 부작용 패턴을 만들지 않는다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — `it('I. 버전 복원 → …')`
  - 상세: 이 테스트는 `uniqueName()` 으로 이름을 고유화해 기존 테스트 격리 관례를 따르고, raw DB `Client`(같은 파일 상단 `import { Client } from 'pg'`) 를 직접 열지 않으며 supertest HTTP 호출만 사용한다 — 자원 누수(미종료 커넥션)나 새 전역 상태 오염 경로가 없다.
  - 제안: 조치 불요.

- **[INFO]** 저장소 내 review 산출물(과거 라운드 22_05_52, consistency 21_38_44 전체)이 diff 에 포함되어 있으나 이는 프로젝트 관례(review 산출물은 커밋 대상)에 부합하는 파일 생성이며, 코드 실행에 영향을 주는 부작용은 아니다
  - 위치: `review/code/2026/09/26/22_05_52/**`, `review/consistency/2026/09/26/21_38_44/**` (신규 파일)
  - 상세: 이번 리뷰가 점검할 "예상치 못한 파일시스템 부작용"에는 해당하지 않는다 — 프로젝트 규약상 리뷰 산출물은 gitignore 되지 않고 그대로 커밋되는 것이 정상 흐름이다. `RESOLUTION.md` 가 판정 기준 커밋(`ce7d36183`)과 통합 전 `git status --short`/`git diff --stat HEAD` 클린 확인을 이미 기록했다.
  - 제안: 조치 불요.

- **[INFO]** 본 리뷰 세션은 저장소 파일을 뮤테이션하지 않았다(가드 결과)
  - 상세: 코드를 고쳐보는 검증 없이 `Read`/`Bash`(`grep`, `git status`)만 사용했다. 세션 종료 시점 `git status --short` 결과는 이 세션이 생성 중인 `review/code/2026/09/26/22_24_07/` 산출물 외 변경이 없다.

## 요약

핵심 변경은 `CanvasSaveResultDto.nodes`/`.edges` 의 OpenAPI 광고 타입을 열린 객체 배열에서 `NodeDto[]`/`EdgeDto[]` 참조로 좁히는 문서/계약 전용 변경이며, 컨트롤러가 서비스의 엔티티 반환값을 무변형으로 통과시키고 두 DTO 에 직렬화용 `class-transformer` 데코레이터가 없어 런타임 wire 바디에는 영향이 없다. `ApiOkWrappedResponse` 는 순수 Swagger 스키마 생성 데코레이터임을 소스 확인했고, `CanvasSaveResultDto` 의 다른 in-repo 소비자는 없어 시그니처/인터페이스 변경의 파급 범위도 작다. 신규 e2e(복원 엔드포인트의 첫 계약 대조)도 기존 테스트 격리 관례를 따르며 새로운 자원 누수·전역 상태 오염 경로를 만들지 않는다. 이번 라운드는 1R WARNING(e2e I 의 vacuous 원소 수 미고정)이 이미 `2ca8a7767` 로 조치되어 diff 에 반영돼 있음을 확인했다. 전역 변수, 환경 변수, 네트워크 외부 호출, 이벤트/콜백과 관련된 부작용은 관찰되지 않았다.

## 위험도

LOW

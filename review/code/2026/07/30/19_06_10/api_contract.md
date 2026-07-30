# API 계약(API Contract) 코드 리뷰 — 워크플로우 duplicate nodes/edges 복사 fix

대상: `POST /api/workflows/:id/duplicate` 엔드포인트 — `workflows.controller.ts`(Swagger
description 문자열만 변경) + `workflows.service.ts::duplicate()`(메타 row 단일 INSERT →
node/edge 포함 캔버스 전체를 트랜잭션으로 복제하는 재구현). 그 외 파일(CHANGELOG, ui-tour
MDX, plan/spec 문서, `review/**` 산출물)은 실행 코드가 아니거나 API 표면과 무관해 본 관점
대상에서 제외.

## 검토 방법

`workflows.controller.ts`(`duplicate` 핸들러 전체, 209-230행)와 `workflows.service.ts` 의
`duplicate()` 재구현 diff(`git diff origin/main...HEAD`)를 직접 읽고, 응답 DTO
(`workflow-response.dto.ts`)·e2e 응답 계약 검증(`workflow-crud.e2e-spec.ts` C 케이스)·엔티티
제약(unique 인덱스 유무)·API 버저닝 설정(`main.ts`)을 저장소에서 직접 대조했다.

## 발견사항

- **[INFO]** wire contract(라우트·메서드·상태코드·응답 스키마·인증)는 이번 diff 로 전혀
  바뀌지 않는다 — 변경은 `@ApiOperation.description` 문자열 갱신뿐
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:209-230`
    (`duplicate()` 핸들러 전체), 특히 `:215`(description 갱신 라인)
  - 상세: `@Post(':id/duplicate')`·`@HttpCode(HttpStatus.CREATED)`(201)·
    `@Roles('editor')`·`@ApiParam({name:'id', format:'uuid'})`·
    `@ApiCreatedWrappedResponse(WorkflowDto, ...)`·`@ApiUnauthorizedResponse`·
    `@ApiForbiddenResponse`·`@ApiNotFoundResponse` 전부 이전과 동일하다. 핸들러 시그니처
    (`id`/`workspaceId`/`user.sub`)와 `ParseUUIDPipe` 검증도 그대로다. 서비스 반환 타입도
    `Promise<Workflow>` 로 불변이며, `workflow-response.dto.ts:6-54` 의 `WorkflowDto` 필드
    집합(`id/workspaceId/name/description/isActive/tags/folderId/settings/
    currentVersion/createdBy/createdAt/updatedAt`)도 수정되지 않았다.
    `workflow-crud.e2e-spec.ts` C 케이스(226-333행)가 `dup.body.data.{id,name,isActive,
    currentVersion}` 를 이 스키마 그대로 검증해 실제로 계약이 깨지지 않았음을 실측
    확인한다. 즉 이 엔드포인트를 호출하는 기존 클라이언트(프론트엔드)는 코드 수정 없이
    계속 동작한다 — breaking change 없음. API 버저닝 스킴 자체가 이 저장소에 없음
    (`main.ts:186` `setGlobalPrefix('api')` 만 존재, `/v1/` 류 없음)도 확인했고, 이번
    변경은 그 컨벤션에 저촉되지 않는다(신규 버전 세그먼트가 필요한 breaking change가
    아니므로).
  - 제안: 조치 불필요. (기록 목적 — 하위 호환성 체크리스트 항목의 명시적 확인.)

- **[INFO]** `duplicate()` 응답 바디는 여전히 workflow 메타데이터만 담고, 새로 복제된
  node/edge 배열 자체는 노출하지 않는다
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:6-54`
    (`WorkflowDto`, nodes/edges 필드 없음) vs
    `codebase/backend/src/modules/workflows/workflows.controller.ts:218-220`
    (`@ApiCreatedWrappedResponse(WorkflowDto, {...})`)
  - 상세: 클라이언트가 복제 결과의 실제 캔버스(어떤 노드/엣지가 어떻게 재매핑됐는지)를
    확인하려면 이 응답만으로는 불가능하고, 별도 `GET /:id/export` 또는 캔버스 로드
    요청이 필요하다(e2e 도 정확히 이 패턴을 씀 — `workflow-crud.e2e-spec.ts:265-268`
    `dupExport` 호출). 다만 이는 `POST /api/workflows`(신규 생성) 응답도 동일하게 따르는
    기존 패턴이라 이번 diff 가 새로 만든 응답 형식 비일관성은 아니다.
  - 제안: 필수 아님. "복제"는 의미상 클라이언트가 결과 그래프를 바로 확인하고 싶어할
    가능성이 있는 액션이라는 점만 참고로 기록 — 응답을 확장하려면(예: `nodeCount`/
    `edgeCount` 요약 필드) 별도 논의 필요.

- **[INFO]** 과거의 결함(메타만 복제)에 의존해 별도로 캔버스를 수동 재구성하던 외부
  자동화가 있었다면, 이번 수정으로 "캔버스가 중복 생성"되는 부작용이 이론상 가능
  - 위치: `CHANGELOG.md:3-18`(신규 Unreleased 항목, 결함 서술)
  - 상세: 이 엔드포인트는 스캐폴딩 이래 "메타만 복제"하는 결함 상태였다는 것이 CHANGELOG
    에 명시돼 있다. 즉 지금까지 duplicate 호출 후 "캔버스가 비어 있으니 saveCanvas/
    importWorkflow 로 직접 다시 채우는" 우회 로직을 짜 둔 외부 클라이언트(자동화 스크립트,
    타사 통합)가 있었다면, 이번 fix 이후에는 duplicate 자체가 이미 완전한 캔버스를
    반환하므로 그 우회 로직이 캔버스를 이중으로 만들 수 있다. 내부 제품(공개 versioned
    API 가 아님)이고 결함이 "완전히 빈 워크플로우 생성"이라는 명백히 깨진 상태였다는 점,
    그리고 프론트엔드 diff 가 이번 changeset 에 전혀 없다는 점(`codebase/frontend/**` 무변경
    확인됨)에서 실제 발생 가능성은 낮다.
  - 제안: 조치 불필요 — breaking change 로 분류할 근거는 아니나(응답 스키마 불변, 문서화된
    버그 픽스), 향후 공개 API 화 시점에는 이런 "결함 의존 우회 코드" 리스크를 changelog
    이상의 채널(예: API deprecation notice)로 공지하는 절차를 고려할 수 있음.

## 점검 관점별 확인 내역 (문제 없음)

- **버전 관리**: API versioning 스킴 자체가 없음(`/api` 전역 prefix 만). 이번 diff 는 신규
  엔드포인트를 추가하지 않고 기존 엔드포인트의 내부 동작만 고쳐 버저닝 이슈 자체가 없음.
- **응답 형식**: `@ApiCreatedWrappedResponse(WorkflowDto, ...)` + 전역 `TransformInterceptor`
  래핑(`{ data: ... }`) 그대로 유지. e2e 로 실측 검증됨.
- **에러 응답**: `NotFoundException({code:'RESOURCE_NOT_FOUND', message:'Workflow not found'})`
  (기존 `findById()` 재사용), 401/403 Swagger 문서 및 실제 가드 불변. 신규 에러 코드 도입 없음.
- **요청 검증**: 요청 바디 없음(경로 파라미터 `id` 만, `ParseUUIDPipe` 로 UUID 형식 검증) —
  이번 diff 로 검증 대상 자체가 늘지 않았고 기존 검증도 그대로.
- **URL/경로 설계**: `POST /api/workflows/:id/duplicate` 는 신규 경로가 아니며, `:id/execute`
  등 기존 "행위 동사 하위 경로" 패턴과 일치.
- **페이지네이션**: 해당 없음 — 단일 리소스에 대한 액션 엔드포인트이며 목록 API 가 아님.
- **인증/인가**: `@Roles('editor')` 불변. `findById(id, workspaceId)` 로 워크스페이스 스코프
  확인 후에만 트랜잭션을 열어 IDOR/교차 테넌트 접근 경로가 없음(동일 결론을 security.md
  reviewer 도 별도로 확인).

## 요약

이번 changeset 이 건드리는 API 표면은 `POST /api/workflows/:id/duplicate` 단 하나이며, 실제
변경은 컨트롤러의 `@ApiOperation.description` 문자열 갱신뿐이다. 라우트·HTTP 메서드·상태
코드(201)·응답 DTO(`WorkflowDto`)·에러 응답(401/403/404)·인증/인가(`@Roles('editor')` +
workspace-scoped `findById`)·요청 검증(`ParseUUIDPipe`)은 전부 기존과 동일하며, e2e 테스트가
이 응답 스키마 불변을 직접 검증한다. 이 엔드포인트를 호출하는 기존 클라이언트(내부
프론트엔드)는 코드 수정 없이 계속 동작하므로 breaking change 가 없다. 서버 측 부수효과(응답이
아니라 DB 상태)는 "메타만 복제"에서 "노드·엣지 포함 캔버스 전체 복제"로 크게 바뀌었지만,
이는 CHANGELOG·Swagger description·spec·user-guide 문서 4곳에서 일관되게 명문화된 의도된
버그 픽스이지 API 계약 위반이 아니다. 발견된 3건은 모두 정보성(INFO) — wire contract 불변의
명시적 확인, 응답에 노드/엣지 미노출(기존 create() 패턴과 동일), 과거 결함 의존 우회 클라이언트
존재 시의 이론적 이중 생성 가능성(발생 가능성 낮음) — 이며 조치가 필요한 위반이나 CRITICAL/
WARNING 급 사안은 없다.

## 위험도

NONE

# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: `--impl-prep` (scope=`spec/2-navigation/`, 관련 작업: `plan/in-progress/integration-test-contract.md` —
`POST /api/integrations/:id/test` 의 MCP 전용 응답 필드 3종 선언 · 성공 경로 계약 검증 · HTTP 와이어 검증).

프롬프트 번들의 `spec/2-navigation/**` 18개 파일은 컨텍스트 예산 초과로 생략되어 있었으므로, 저장소에서
직접 `Read` 하여 검토했다. 특히 이번 plan 이 직접 건드리는 `4-integration.md`(§5.6 MCP·§9 API)를 전문
정독했고, 동일하게 큰 diff 를 가진 `2-trigger-list.md`(§3 API·§4 삭제 정책)를 발췌 검토했다. 나머지
파일은 frontmatter·구조(Rationale 절 존재 여부)만 전수 점검했다.

## 발견사항

- **[WARNING] `INTEGRATION_TEST_FAILED` 의 HTTP 상태 — 두 spec 문서가 다른 숫자를 광고한다**
  - target 위치: `spec/2-navigation/4-integration.md` §9.4 공통 응답 포맷, `INTEGRATION_TEST_FAILED (422)` 행
  - 위반 규약: `spec/conventions/swagger.md` §2-4 "광고한 성공 코드는 실제 성공 코드를 담는다"(에러 응답에도
    적용되는 일반 원칙) · `spec/conventions/error-codes.md` (에러 코드는 클라이언트와의 안정적 계약이므로
    의미-상태 짝이 문서 전역에서 일관돼야 함)
  - 상세: `4-integration.md` §9.4 는 `INTEGRATION_TEST_FAILED` 를 **422**로 문서화한다. 그런데
    (1) 같은 기능을 설명하는 자매 문서 `spec/5-system/11-mcp-client.md` §9 는 "`POST
    /api/integrations/:id/test` 후 갱신... 테스트 실패 시 `INTEGRATION_TEST_FAILED`
    (`BadRequestException`, **HTTP 400**) 를 던진다" 라고 명시하고,
    (2) 실제 구현도 400 이다 — `IntegrationsService.rotate()`
    (`codebase/backend/src/modules/integrations/integrations.service.ts:1251`)가
    `throw new BadRequestException({ code: 'INTEGRATION_TEST_FAILED', ... })` 로 던지며, 컨트롤러
    `@Post(':id/rotate')` 의 `@ApiBadRequestResponse({ description: '...연결 테스트 실패(`INTEGRATION_TEST_FAILED`)' })`
    도 400 을 광고한다(`integrations.controller.ts:546-548`). 저장소 전체에서 `INTEGRATION_TEST_FAILED` 를
    던지는 자리는 이 한 곳뿐이며 422 로 던지는 경로는 없다. 즉 `4-integration.md` §9.4 의 "422" 는 오기다.
    이 항목은 이번 plan 이 신설한 것이 아니라 `d1fa2a0d4`(과거 정리 커밋)부터 있던 기존 서술이지만, 이번
    plan 이 바로 이 엔드포인트 군의 응답 계약(`TestConnectionResultDto`)·와이어 테스트를 새로 작성하는
    시점이라 이 표를 참조할 개발자가 잘못된 상태 코드를 전제로 스웨거 데코레이터나 assertion 을 작성할
    위험이 있다.
  - 제안: `4-integration.md` §9.4 의 `INTEGRATION_TEST_FAILED (422)` 를 `(400)` 으로 정정하고, rotate 경로
    한정임을 명시(현재 §9.4 서술은 이 코드가 `:id/test`·`preview-test`·`rotate` 전반에 걸치는 것처럼 읽힌다 —
    실제로는 rotate 만 이 이름의 예외를 던지고, `:id/test`/`preview-test` 는 200 body 의 `success:false` 형태로
    실패를 표현한다). 정정은 spec 오류 수정이라 `project-planner` 소관이며, `spec_impact` 없이 developer 가
    바로 고치는 것은 CLAUDE.md 의 "자기-반증형 소정정" 5조건(그 문장을 developer 가 직접 쓴 것도 아니고,
    예고문도 아니므로) 에 해당하지 않는다.

- **[INFO] `:id/test` 응답 shape 을 가리키는 이름이 문서 관례와 다르다**
  - target 위치: `spec/2-navigation/4-integration.md` §9.1, `POST /api/integrations/:id/test` 행
  - 위반 규약: 없음(강제 규약 위반은 아님) — `spec/conventions/swagger.md` §5-1 의 "응답 DTO 는
    `dto/responses/*.dto.ts` 클래스로 노출한다" 관례와의 정합성 참고 사항
  - 상세: 같은 §9 표의 다른 행들(`Cafe24PrecheckResultDto`, `OperationCatalogDto`, `PreviewTestDto` 등)은
    실제 OpenAPI 스키마에 노출되는 **응답 DTO 클래스명**으로 shape 을 지칭하는데, `:id/test` 행만
    "`IntegrationTestResult` shape" 이라는 **서비스 내부 TS 인터페이스**(`integrations.service.ts:88`,
    swagger 에는 노출되지 않음) 이름으로 지칭한다. 실제 컨트롤러는 `@ApiOkWrappedResponse(TestConnectionResultDto, ...)`
    를 쓴다. 내부 계약(서비스 반환 타입)과 wire 계약(DTO)이 구조적으로 같아 실害는 없지만, 이 문서가
    다른 곳에서는 DTO 클래스명을 SoT 로 인용하는 관례를 따르는 만큼 이 행만 다른 레이어 이름을 쓰는 것은
    다음에 읽는 사람이 "`IntegrationTestResult` 를 swagger 스키마 이름으로" 오인할 소지가 있다.
  - 제안: 이번 plan 에서 이 절을 어차피 손대므로("`meta`" 문구 정정과 같은 자리), `TestConnectionResultDto`
    (swagger DTO)와 `IntegrationTestResult`(서비스 내부 반환 타입)를 병기하거나, DTO 이름으로 통일.

- **[INFO] `2-trigger-list.md` Rationale 번호가 문서 순서와 어긋난다**
  - target 위치: `spec/2-navigation/2-trigger-list.md` `## Rationale` 하위 — R-1, R-2, R-3, R-4, R-5, R-6, **R-8, R-7**, R-12, R-13, R-14, R-15, R-16, R-17
  - 위반 규약: 명시적 규약 없음(문서 구조 규약은 "Overview/본문/Rationale 3섹션"만 요구, 항목 번호 순서는
    규정하지 않음) — 가독성 제안
  - 상세: R-8 이 R-7 보다 앞서 배치되어 있고, R-9~R-11 은 아예 없이 R-12 로 건너뛴다(과거 항목이 옮겨지거나
    폐기되면서 번호만 남은 것으로 보인다 — 실제로 R-2 는 "폐기 — R-14 로 대체"로 명시돼 있어 이런 이력이
    있음을 스스로 인정한다). 규약 위반은 아니나 각주 링크(`[R-2](#r-2-...)`)를 눈으로 좇는 사람에게는
    혼란 소지가 있다.
  - 제안: 우선순위 낮음. 다음에 이 절을 손댈 때 참고.

## 규약 준수가 확인된 항목 (참고)

- **Frontmatter**: `spec/2-navigation/*.md` 18개 파일 전수 확인 — `id`/`status`/`code`(+`status: partial` 인
  파일의 `pending_plans`) 모두 `spec-impl-evidence.md` §2 스키마를 만족한다. `16-agent-memory.md` 의
  `id: nav-agent-memory` 는 `spec/5-system/17-agent-memory.md` 의 `agent-memory` 와 충돌 회피용으로,
  같은 컨벤션 §2.1 이 예시로 직접 드는 패턴이라 위반이 아니다.
- **문서 구조**: 18개 파일 모두 정확히 1개의 `## Rationale` 헤딩으로 끝난다(`_product-overview.md` 제외 —
  Overview 전용 인덱스 파일이라 정상). `4-integration.md` 는 별도 `## Overview` 헤딩이 없지만, 이는
  project-planner SKILL "다중 spec 파일을 가진 영역은 `_product-overview.md` 로 분리" 규칙에 따라 Overview
  내용이 `_product-overview.md §3.4`(앵커 실재 확인)로 옮겨진 정상 형태다.
  ([`.claude/skills/project-planner/SKILL.md`](../../../../../.claude/skills/project-planner/SKILL.md) §Spec 문서 구조)
- **에러 코드 명명**: `4-integration.md`·`2-trigger-list.md` 에 등장하는 코드(`INTEGRATION_*`, `OAUTH_*`,
  `CAFE24_*`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `VALIDATION_ERROR`, `INTERNAL_ERROR` 등) 전부
  `error-codes.md` §1 의 `UPPER_SNAKE_CASE` + 도메인 prefix 원칙을 따른다. 유일한 의미-불일치 이름
  `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 `error-codes.md` §3 예외 레지스트리에 등재되어 있고, 그 근거가
  `4-integration.md` 의 Rationale 항목으로 정확히 역참조된다(양방향 링크 확인).
- **부재 표현(`null` vs 키 생략)**: `2-trigger-list.md` §3 의 `TriggerDto.workflow` 키-생략 서술이
  `api-convention.md §5.4` 가 요구하는 "그 필드를 문서화하는 절에 사유 명시"를 모범적으로 지킨다
  (기준 (b) 명시 + 근거 문장). `4-integration.md` §5.6 의 MCP `capabilities`/`serverInfo`/`preview` 키-생략도
  기존 필드(신규 도입 아님)라 §5.4 의 소급 비적용 조항 대상이며, `serverInfo` 의 열린 맵(`additionalProperties`)
  선언도 swagger.md §1-4 의 "실제로 키가 열려 있는 경우"(SDK 가 `name`/`version` 밖의 키를 실을 수 있음, plan
  §1 방향에 명시)에 해당해 "번거로움" 사유의 금지 패턴이 아니다.
- **DTO 클래스명 유일성**: `TestConnectionResultDto`(integrations 모듈) vs `ModelTestConnectionResultDto`
  (model-config 모듈)로 이름이 분리되어 있어 swagger.md §5-1 의 클래스명 저장소 전역 유일성 요건과 충돌 없음.
- **PATCH DTO 명명**: 언급된 `UpdateTriggerDto` 류는 swagger.md §1-7 의 "top-level 요청 바디만 `Update` 접두"
  범위 규칙과 어긋나지 않는다.

## 요약

`spec/2-navigation/` 은 frontmatter·문서 3섹션 구조·에러 코드 명명·부재 표현 선언 등 핵심 정식 규약을
전반적으로 잘 지키고 있고, 특히 이번 plan 의 직접 대상인 `4-integration.md` §5.6/§9 는 인접 규약
(`swagger.md`, `error-codes.md`, `api-convention.md §5.4`)과의 교차 검증에서 대부분 정합했다. 다만
`4-integration.md` §9.4 의 `INTEGRATION_TEST_FAILED (422)` 는 실제 구현(400)·자매 spec
(`11-mcp-client.md §9`, 400)과 어긋나는 기존 오기이며, 이번 plan 이 바로 이 엔드포인트 군의 응답 계약을
새로 작성하는 시점이라 착수 전 정정을 권고한다(작은 규모의 spec 정정이므로 `--impl-prep` 자체를 막을
정도는 아니다). 그 외 발견은 INFO 수준의 표현 일관성 제안이다.

## 위험도

LOW

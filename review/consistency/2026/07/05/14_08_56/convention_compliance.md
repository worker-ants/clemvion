# 정식 규약 준수 검토 — `spec/2-navigation/` (--impl-prep)

검토 대상: `spec/2-navigation/` 전 영역 8개 스펙 문서(대시보드·워크플로우 목록·인증 플로우·에러/빈상태·유저가이드·실행내역·시스템상태·에이전트메모리 등, 프롬프트에 첨부된 발췌 기준). 다가올 구현 작업명("folder-depth-cycle-guard")에 근거해 `1-workflow-list.md` §3.1 폴더 API·데이터 모델·백엔드 `folders` 모듈의 명명/포맷/API 문서 규약 준수 여부를 집중 확인했다.

## 발견사항

### [WARNING] PRD 요구사항 배지(✅)와 상세 spec 의 "미구현 (Planned)" 표기 불일치 — NAV-WF-06

- target 위치: `spec/2-navigation/_product-overview.md` §3 요구사항 표, `NAV-WF-06` 행 ("폴더/태그 기반 워크플로우 정리" | 권장 | ✅)
- 위반 규약: 직접적인 명명 규약 위반은 아니지만, `spec/conventions/spec-impl-evidence.md` §3 의 `status` 라이프사이클 정신(spec 이 실제 구현 상태를 정직하게 반영해야 한다는 원칙 — `1-workflow-list.md` frontmatter 가 이미 `status: partial` + `pending_plans:` 로 이 원칙을 스스로 지키고 있음)과 어긋난다.
- 상세: `_product-overview.md` 는 `NAV-WF-06`(폴더/태그 정리)을 ✅(완료)로 표기하지만, 같은 영역의 상세 spec `1-workflow-list.md` §2.3·§3.1 은 "폴더 필터 UI 는 아직 미구현 (Planned)", "프론트엔드는 본 API(폴더 관리)를 아직 소비하지 않는다" 라고 명시한다. 즉 백엔드 API 만 구현되고 프론트 UI 는 없는 상태인데 PRD 요구사항 표는 완료로 표기한다. `1-workflow-list.md` 자체는 frontmatter `status: partial` 로 정직하게 강등되어 있어 문서 내부는 일관되지만, 상위 PRD 문서의 ✅ 배지가 그 강등을 반영하지 못해 두 문서 간 상태 불일치가 생긴다.
- 제안: `_product-overview.md` 의 `NAV-WF-06` 상태를 부분 구현 표기(예: "⚠️ 부분" 또는 각주로 "폴더 관리 API 만 구현, UI 는 `1-workflow-list.md` §2.3 pending_plans 참조")로 정정하거나, 요구사항을 "태그"와 "폴더"로 분리해 각각의 실제 완료 여부를 반영한다.

### [WARNING] `update()` 경로에 depth/cycle 가드 부재 — spec 이 약속한 제약이 이동(move) 시 미검증, PATCH 행 에러 코드 문서화도 POST 행과 비대칭

- target 위치: `spec/1-data-model.md §2.5 Folder` "제약 조건" ("중첩 깊이 제한: 최대 5단계"), `spec/2-navigation/1-workflow-list.md §3.1` (`PATCH /api/folders/:id` — "이름·부모·정렬 순서 부분 수정")
- 위반 규약: 데이터 모델 spec 이 Folder 엔티티 전체에 대해 선언한 불변식(중첩 깊이 ≤5)을, API spec 이 서술하는 `PATCH` 경로(부모 변경 가능)가 실제로 강제한다고 암묵 전제하지만 구현(`folders.service.ts`)은 `create()` 에서만 `getDepth` 검사를 수행하고 `update()` 는 검사를 전혀 하지 않는다. 또한 자기 자신/후손을 새 부모로 지정하는 **순환(cycle)** 케이스에 대한 어떤 가드도 없다(코드·spec 양쪽 모두 언급 없음). 이는 명명 규약 위반은 아니지만, "정식 규약 준수" 관점에서 spec 이 선언한 제약(§2.5)이 API 계층 전체(create+update)에 적용되는 것으로 읽히는데 구현과 spec 서술이 실제로는 create 경로 한정이라는 사실을 spec 이 명시하지 않아 spec-코드 정합성 gap 이 conventions 문서(spec-impl-evidence.md 의 "코드가 spec 이 약속한 surface 를 충족해야 한다" 원칙)와 충돌한다.
- 상세: `1-workflow-list.md §3.1` 표에서 바로 위 `POST /api/folders` 행은 "깊이 5 초과 시 400 `VALIDATION_ERROR`, 동일 부모 아래 이름 중복 시 409 `RESOURCE_CONFLICT`" 를 명시한다. 반면 바로 아래 `PATCH /api/folders/:id` 행은 "이름·부모·정렬 순서 부분 수정" 이라고만 적고 에러 코드를 전혀 언급하지 않는다 — 같은 표 안에서 형제 엔드포인트 간 문서화 수준이 비대칭이다. `parentId` 이동은 POST 의 신규 생성과 동일하게 깊이 제한·이름 중복·(신설 예정) 순환 위반을 모두 유발할 수 있는 write 경로이므로, 현재 서술은 구현 착수 전 시점 기준으로는 사실을 정확히 반영한다(현재 update 는 검증하지 않으므로 실패 케이스가 없는 게 맞음)는 점에서만 "거짓"은 아니다. 그러나 이 상태로 --impl-prep 를 통과시키면 (a) 신설할 에러 코드명, (b) 기존 `CYCLE_DETECTED`/`CONTAINER_CYCLE` 관례와의 레이어 구분이 spec 에 전혀 정의되지 않은 채 구현이 시작된다.
  - **명명 선례 검토**: 프로젝트에는 이미 그래프 순환을 다루는 두 개의 확립된 명명 선례가 있다 — 워크플로우 edge/컨테이너 계층의 `CONTAINER_CYCLE`(`spec/3-workflow-editor/0-canvas.md`, `spec/data-flow/11-workflow.md`)과 워크플로우 실행 그래프의 `CYCLE_DETECTED`(`spec/5-system/3-error-handling.md §1.4`, 엔진 레벨 `execution.failed.error.code`). Folder 계층(자기참조 `parent_id`, 별도 엔티티)은 이 두 선례 중 어느 쪽과도 다른 세 번째 자기참조 트리이므로, 관례를 그대로 재사용(`CYCLE_DETECTED` 오버로드)하면 §1.4 엔진 레벨 코드와 이름이 충돌해 클라이언트가 레이어를 혼동할 위험이 있고, `CONTAINER_CYCLE` 재사용은 워크플로우 컨테이너 도메인과 폴더 도메인을 이름으로 뒤섞는다. `error-codes.md` §1 의 "신규 코드는 처음부터 의미 정확한 이름을 부여해 후속 rename 압력을 만들지 않는다" 원칙에 따르면 코드 신설(예: `FOLDER_CYCLE`, `<DOMAIN>_<CONDITION>` prefix 패턴)이 적합하며, 기존 두 `*CYCLE*` 코드와 레이어가 다르다는 점을 `error-codes.md §3` 의 "레이어 주의" 각주 관례(예: `3-error-handling.md §4` 의 `EXECUTION_TIMEOUT` 동명 코드 각주)처럼 명시해 두는 것이 향후 혼동을 예방한다.
  - **무한 루프 위험 (구현 참고)**: `folders.service.ts` 의 `getDepth()`(라인 75-91)는 `parent_id` 체인을 `while (currentId)` 로 따라 올라가는 구조라, 순환이 이미 존재하는 상태에서 호출되면 종료하지 않는다. 지금은 `create()` 호출 시점에 신규 행이 아직 연결되지 않아 순환이 원천적으로 불가능하지만, `update()` 에 동일 로직을 재사용할 경우 순환 가드가 depth 계산보다 먼저(또는 최소 별도 방문-집합으로 안전하게) 수행되지 않으면 이 루프 자체가 무한 루프에 빠질 수 있다. 이는 conventions 직접 위반이 아니라 구현 설계 시 유의점이지만, spec 이 "가드 순서" 를 못박아 두면 구현자가 안전하게 만들 근거가 된다.
- 제안: project-planner 가 구현 착수 전 `1-data-model.md §2.5` 제약 조건에 "순환 참조 금지 — 자기 자신 또는 자손을 parent 로 지정 불가" 를 추가하고, `1-workflow-list.md §3.1` PATCH 행에 "부모 변경 시 깊이 재검증(400 `VALIDATION_ERROR`) 및 순환 참조 거부(400/409 `FOLDER_CYCLE` 류, 신규)" 를 명시한 뒤 `--impl-prep` 를 완료 처리한다. 신규 코드를 도입한다면 `error-codes.md` §1 의 의미 기반 명명(`FOLDER_*` 도메인 prefix)을 따르고, `CYCLE_DETECTED`/`CONTAINER_CYCLE` 과 레이어가 다름을 각주로 명시할 것. 아울러 spec Rationale 에 "구현은 순환 감지를 depth 계산보다 먼저 또는 안전하게(방문 집합) 수행해 무한 루프를 방지한다" 를 남겨 구현 설계 의도를 고정하는 것을 권장한다.

### [INFO] `GET /api/folders` 목록 응답이 `spec/5-system/2-api-convention.md §5.2` 의 두 공식 목록 형태 중 어디에도 명시적으로 속하지 않음

- target 위치: `spec/2-navigation/1-workflow-list.md §3.1` (`GET /api/folders`), 구현 `folders.controller.ts` (`ApiOkWrappedArrayResponse(FolderDto)`)
- 위반 규약: `spec/5-system/2-api-convention.md §5.2` 는 목록 응답을 (1) 페이지네이션 `{data:[], pagination}` 과 (2) 비-페이징 고정 컬렉션 `{data:{items:[]}}` 두 가지로만 문서화한다. 폴더 목록은 페이지네이션도 없고 `{data:{items}}` 형태도 아닌 **순수 배열** `{data:[...]}` (`ApiOkWrappedArrayResponse` / `wrapItemsSchema`) 를 쓴다.
- 상세: 이 자체는 folders 모듈만의 새 위반이 아니라 `dashboard`·`edges`·`executions`·`nodes`·`statistics`·`triggers`·`workflow-versions`·`workspaces` 등 다수 기존 모듈이 공유하는 기존 패턴이라(코드베이스 전반의 기성 관행), `1-workflow-list.md` 가 이 패턴을 새로 도입한 것은 아니다. 다만 `spec/5-system/2-api-convention.md §5.2` 문서 자체가 이 널리 쓰이는 세 번째 형태(순수 배열, pagination 없음)를 공식적으로 등재하지 않아 정식 규약 문서가 실제 코드 관행을 완전히 커버하지 못하는 상태다.
- 제안: 이번 target 문서(`1-workflow-list.md`) 수정은 불필요 — 대신 `spec/5-system/2-api-convention.md §5.2` 에 "고정 소규모 배열(페이지네이션 불필요, `items` 래핑도 불필요한 경우) → `{data:[...]}` bare-array" 카테고리를 3번째 공식 형태로 추가하도록 project-planner 에게 별도 후속 과제로 전달 권장.

### [INFO] `PATCH /api/folders/:id` Swagger 데코레이터 설명도 depth/cycle 실패 케이스를 아직 반영하지 않음

- target 위치: `codebase/backend/src/modules/folders/folders.controller.ts` `update()` — `@ApiBadRequestResponse({ description: '입력값 검증 실패' })`
- 위반 규약: 직접적 규약 위반은 아니다. `spec/conventions/swagger.md §2-4` 는 400 응답에 `@ApiBadRequestResponse` 사용을 요구할 뿐 세부 사유 열거를 강제하지 않으므로 현재 상태 자체는 규약 위반이 아니다. 다만 `create()` 의 동일 데코레이터 설명("입력값 검증 실패 또는 중첩 깊이 초과")과 대칭을 맞추면 문서 일관성이 좋아진다.
- 상세: `POST`(create) 는 depth 초과 케이스를 설명에 포함하지만 `PATCH`(update) 는 포함하지 않는다 — 현재 코드 동작(update 가 depth 를 검사하지 않음)과는 일치하지만, depth/cycle 가드가 추가되면 이 설명도 함께 갱신해야 함을 표시해 두는 것이 좋다.
- 제안: 향후 구현 시 `@ApiBadRequestResponse` 설명과 `@ApiConflictResponse` 등 관련 데코레이터를 depth/cycle 실패 케이스까지 포함하도록 함께 갱신할 것을 체크리스트에 추가.

## 명명/포맷/문서구조 규약 — 준수 확인된 항목 (참고)

아래는 위반이 아니라 검토 과정에서 확인한 **준수** 사항으로, 이번 구현 착수를 막을 요소가 없음을 뒷받침한다.

- **에러 코드**: `folders.service.ts` 가 발행하는 `RESOURCE_NOT_FOUND`(404) / `VALIDATION_ERROR`(400 depth 초과) 는 모두 `spec/conventions/error-codes.md` §1 의 시스템 전역 공용 코드(prefix 없음, UPPER_SNAKE_CASE)와 정확히 일치. `409 RESOURCE_CONFLICT`(unique violation)는 `GlobalExceptionFilter` 의 `23505` 매핑을 통해 발행되며 spec(`1-workflow-list.md §3.1`)의 서술("unique violation → 409 매핑, 전역 exception filter")과 일치.
- **DTO/Swagger 패턴**: `CreateFolderDto`/`UpdateFolderDto`/`FolderDto` 모두 `spec/conventions/swagger.md` §1(JSDoc + `@ApiProperty`/`@ApiPropertyOptional`)·§5-1(`dto/responses/*-response.dto.ts` 위치, entity 미노출)을 정확히 따름. Controller 는 `@ApiTags`/`@ApiBearerAuth('access-token')`/`ApiOkWrappedResponse`/`ApiCreatedWrappedResponse`/`ApiOkWrappedArrayResponse`/`@Roles('editor')` + `@ApiForbiddenResponse` 조합 등 §2·§5 컨트롤러 패턴을 정확히 따름.
- **API 엔드포인트 명명**: `/api/folders`, `/api/folders/:id` 는 `spec/5-system/2-api-convention.md §2.2`(복수형 명사·케밥 케이스·2단계 이내 중첩)를 준수.
- **문서 구조**: 검토한 8개 target 문서 모두 본문(numbered `##`) + `## Rationale` 2-섹션 구성을 따르며, 이는 기존 프로젝트 관행(비-PRD 기술 spec 은 Overview 섹션 생략 가능)과 합치한다. Frontmatter 는 전부 `id`/`status`/`code:` 를 갖추고, `status: partial` 인 `1-workflow-list.md` 는 `pending_plans:` 를 함께 명시해 `spec-impl-evidence.md` §2.1 의무를 충족.
- **파일 명명**: `spec/2-navigation/_layout.md`, `_product-overview.md` 의 언더스코어 prefix, 숫자 prefix 파일명(`0-dashboard.md` ~ `16-agent-memory.md`) 모두 CLAUDE.md 폴더 명명 컨벤션과 일치.

## 요약

검토 대상 `spec/2-navigation/` 문서군은 명명 규약·Swagger/DTO 규약·에러 코드 규약·문서 구조 규약을 전반적으로 잘 준수하고 있으며, 프론트/백엔드 코드(특히 `folders` 모듈)도 정식 규약(swagger.md, error-codes.md, api-convention.md)과 정합적이다. 다만 이번 "folder-depth-cycle-guard" 구현 착수를 앞두고 두 가지가 눈에 띈다 — (1) `_product-overview.md` 의 NAV-WF-06 완료(✅) 표기가 상세 spec 의 "Planned" 표기와 불일치하는 점(WARNING), (2) `spec/1-data-model.md` 가 선언한 "최대 중첩 깊이 5" 불변식이 현재 `create()` 경로에서만 강제되고 `update()`(부모 변경) 경로·순환 케이스는 spec·코드 양쪽에 검증 서술이 없으며, 신설할 에러 코드명이 기존 `CYCLE_DETECTED`(엔진 레벨)/`CONTAINER_CYCLE`(워크플로우 컨테이너) 명명 선례와 레이어 충돌 없이 정의돼야 하는 점(WARNING) — 이는 정식 규약 "위반"이라기보다 향후 구현이 신설할 에러 코드·API 설명이 `error-codes.md`/`swagger.md` 의 기존 규약을 그대로 따르도록 구현 전에 spec 을 먼저 갱신해 둘 필요가 있음을 시사한다. 그 외 `api-convention.md §5.2` 가 코드베이스 전반에서 흔한 "순수 배열 목록 응답" 형태를 공식 카탈로그에 아직 등재하지 않은 점은 INFO 수준의 문서 갭이며 이번 target 범위의 신규 위반은 아니다.

## 위험도

MEDIUM — CRITICAL 항목 없음. 구현 착수 자체를 차단할 위반은 발견되지 않았으나, depth/cycle 가드 신설 시 참조할 spec 서술(에러 코드명·레이어 구분·업데이트 API 설명)이 비어 있어 구현자가 임의로 명명·정책을 결정할 위험이 있고, 그 결과가 기존 `CYCLE_DETECTED`/`CONTAINER_CYCLE` 명명과 충돌하면 `error-codes.md` §2 가 금지하는 breaking rename 압력으로 이어질 수 있다. 구현 착수 전 project-planner 가 `1-workflow-list.md §3.1`(PATCH 행 + 신규 에러 코드명)과 `_product-overview.md`(NAV-WF-06)를 갱신하는 것을 권장.

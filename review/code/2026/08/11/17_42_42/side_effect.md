# 부작용(Side Effect) 리뷰 — 19개 컨트롤러 `@ApiForbiddenResponse` 64건 codemod

## 검증 방법

프롬프트 diff 를 전수로 읽은 뒤, 판정 근거를 실제 소스로 직접 검증했다:

- `@nestjs/swagger` 패키지 소스(`node_modules/@nestjs/swagger/dist/decorators/api-response.decorator.js`,
  `swagger-explorer.js`, `explorers/api-exclude-endpoint.explorer.js`)를 `Read` 로 직접 열어
  `ApiForbiddenResponse` 의 런타임 동작을 추적했다.
- `codebase/backend/src/main.ts` 에서 `SwaggerModule.createDocument()` 호출 위치·빈도를 확인했다.
- `git diff origin/main --stat -- codebase/` (실 워크트리, 읽기 전용)로 19파일 `+74/-2` 를 재확인하고,
  삭제 2줄이 어느 파일의 어떤 hunk 인지 직접 대조했다.
- `@UseInterceptors(FileInterceptor(...))` 를 쓰는 `knowledge-base.controller.ts::uploadDocument` 를
  `Read` 로 열어 데코레이터 중첩 여부를 눈으로 확인했다.
- 워크트리에서 `pnpm exec tsc --noEmit -p tsconfig.json` 을 직접 실행해 변경 19파일에 신규 타입
  오류가 없음을 재현했다(저장소 수정 없음, 읽기/빌드만 수행).
- import 중복 여부를 19파일 전수 `grep -c` 로 확인했다.

## 발견사항

- **[INFO]** `@ApiForbiddenResponse` 는 확인 결과 순수 Swagger 메타데이터 데코레이터이며 런타임 요청
  처리에 개입하지 않는다 — 소스로 직접 확인.
  - 위치: `node_modules/@nestjs/swagger/dist/decorators/api-response.decorator.js:9-33` (`ApiResponse`
    본체), `codebase/backend/src/main.ts:117-118` (`SwaggerModule.createDocument`/`.setup` 호출부)
  - 상세: `ApiForbiddenResponse(...)` 는 내부적으로 `ApiResponse({...})` 를 호출하고, 그 구현은
    `Reflect.defineMetadata(DECORATORS.API_RESPONSE, ..., descriptor.value)` 한 줄이 전부다 — guard·
    interceptor·pipe·exception filter 등록이 없다. 이 메타데이터 키(`API_RESPONSE`)를 읽는 곳은
    `swagger-explorer.js`/`explorers/api-response.explorer.js` 뿐이며, `RolesGuard`
    (`codebase/backend/src/common/guards/roles.guard.ts`)를 포함해 요청 파이프라인의 어떤 guard 도
    이 키를 참조하지 않는다(grep 0건). 게다가 `SwaggerModule.createDocument()` 는 `main.ts:117` 에서
    부트스트랩 시 **단 한 번** 호출되며 문서를 정적으로 `setup()` 한다 — 요청마다 재평가되는 코드
    경로가 아니다. 즉 64건의 추가는 프로세스 기동 시 `Reflect.defineMetadata` 호출 64회 증가와
    OpenAPI JSON 문서에 403 variant 가 추가되는 것 외에 어떤 런타임 부작용도 없다.
  - 제안: 없음 — PR 이 주장하는 "런타임 동작 변경 0" 은 소스 레벨로 확인되는 사실이다.

- **[INFO]** codemod 가 의도치 않은 곳을 건드리지 않았다 — 삭제 2줄은 정당한 주석 정정, 추가는
  전부 데코레이터/import 이며 다른 데코레이터 인자 안쪽에 삽입된 사례는 없다.
  - 위치: `git diff origin/main --stat -- codebase/` = `19 files changed, 74 insertions(+), 2
    deletions(-)`. 삭제 2줄은 `codebase/backend/src/modules/llm/llm-model-config.controller.ts:118-119`
    (구 주석 "역할 제한이 없어 `@ApiForbiddenResponse` 도 두지 않는다" 2줄 삭제 → 신규 4줄로 교체).
    가장 위험한 지점인 `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts:331-368`
    (`uploadDocument`, `@UseInterceptors(FileInterceptor('file', {...}))` 를 334-338줄에 보유)을 직접
    열어 확인 — 신규 `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 는 366번째 줄,
    `@UseInterceptors(...)` 블록 바깥의 최상위 데코레이터 체인에 정상적으로 놓여 있다.
  - 상세: plan(`plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` §"codemod 파서가
    데코레이터 인자 안쪽에 삽입했다")이 2차 codemod 첫 판에서 이 정확한 버그(`FileInterceptor(` 를
    메서드 시그니처로 오인해 데코레이터 인자 안에 삽입)를 자수하고 있는데, **커밋된 diff 에는 그
    흔적이 없다** — 즉 그 버그는 실제로 고쳐진 뒤 커밋됐다. 19파일 전수에 대해 `ApiForbiddenResponse,`
    import 라인이 파일당 정확히 1회씩만 존재함을 `grep -c` 로 확인해 중복 import 도 없다.
  - 제안: 없음 — 조치 불요.

- **[INFO]** `@ApiExcludeEndpoint()` 라우트 2건에 붙은 `@ApiForbiddenResponse` 는 부작용을 만들지
  않는다 — 소스 레벨에서 도달조차 하지 않는 inert 메타데이터다.
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:218-222`
    (`triggerStuckRecoveryForTest`), `:239-243`(`simulateExecutionRunRedeliveryForTest`) — 둘 다
    `@Roles('owner')` → `@ApiExcludeEndpoint()` → `@ApiForbiddenResponse(...)` 순.
    근거 소스: `node_modules/@nestjs/swagger/dist/swagger-explorer.js:88-93`.
  - 상세: `swagger-explorer.js` 의 `scanFromPrototype` 콜백은 각 메서드마다 먼저
    `exploreApiExcludeEndpointMetadata` 로 `API_EXCLUDE_ENDPOINT` 를 확인하고, `disable: true` 면
    `return;` 으로 **그 메서드의 나머지 메타데이터 수집을 전부 건너뛴다**(90-93줄) — `API_RESPONSE`
    resolver 는 아예 호출되지 않는다. 즉 이 두 라우트에 붙은 `@ApiForbiddenResponse` 는 생성되는
    OpenAPI 문서에 절대 나타나지 않고, 다른 어떤 런타임 경로도 읽지 않는다. "부작용"은 없으나 —
    엄밀히는 목적(문서화)도 달성하지 못하는 **무의미한 부착**이다. 이는 side-effect 관점에서는
    안전(harmless no-op)하고, 문서 완결성 관점의 사소한 낭비일 뿐이라 CRITICAL/WARNING 대상은
    아니다(그 판단은 documentation/api_contract 스코프).
  - 제안: 없음 — side-effect 관점에서 조치 불요.

- **[INFO]** import 추가는 순환 참조·번들 크기 부작용을 만들지 않는다.
  - 위치: 19개 파일 전수 (`ApiForbiddenResponse,` import 라인 1개씩 추가)
  - 상세: 19개 파일 모두 이미 `@nestjs/swagger` 모듈을 import 하고 있었고(같은 import 문에 named
    export 하나를 추가한 것뿐), 새 모듈 경로·새 패키지 의존성은 도입되지 않았다 — 모듈 그래프에
    새 edge 가 생기지 않으므로 순환 참조 가능성이 없다. 백엔드는 Node.js 서버 프로세스로
    tree-shaking 대상 프런트 번들이 아니며, `Reflect.defineMetadata` 호출 64회 추가는 기동 시간에
    무시할 수준이다(부트스트랩에서 이미 수백 개의 동종 데코레이터 호출이 존재).
  - 제안: 없음.

- **[INFO]** 독립 재현 — 변경 19개 컨트롤러 파일에 신규 타입 오류 0건, 삭제 라인은 주석 정정 2줄이
  전부.
  - 위치: 워크트리 루트에서 `pnpm exec tsc --noEmit -p codebase/backend/tsconfig.json` 실행 결과 —
    총 199개 `error TS`/309줄 출력이 나왔으나, 19개 변경 컨트롤러 파일명과 grep 대조 시 **일치 0건**.
    plan/RESOLUTION 이 이미 "origin/main 자체의 backend tsc 오류(309줄)는 선재" 라고 밝힌 수치와
    정확히 일치해 독립적으로 재확인됐다.
  - 상세: 이 결과는 다른 관점(testing 등)이 이전 라운드에 이미 낸 결론과 같지만, side-effect
    리뷰 관점에서 "코드가 빌드를 깨는 부작용"이 없음을 직접 재현해 재확인한 것이다.
  - 제안: 없음.

그 외 의도치 않은 상태 변경·전역 변수 도입·파일시스템 부작용(런타임)·함수/메서드 시그니처 변경·
환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백 변경은 diff 전수에서 발견되지 않았다. `review/**`·
`plan/in-progress/**.md` 변경은 이 작업 자체의 셀프 트래킹 문서로 CLAUDE.md 워크플로상 정상이며
런타임 부작용이 아니다.

## 요약

64건의 `@ApiForbiddenResponse` 부착은 `@nestjs/swagger` 소스를 직접 읽어 확인한 결과 순수
`Reflect.defineMetadata` 호출이고, 그 메타데이터는 부트스트랩 1회 실행되는 `SwaggerModule.
createDocument()` 만 읽으며 어떤 guard/interceptor/pipe 도 참조하지 않는다 — "런타임 동작 변경 0"
주장은 소스 레벨로 성립한다. codemod diff 는 `git diff --stat` 로 19파일 `+74/-2` 임을 재확인했고,
삭제 2줄은 이제는 모순되는 옛 주석을 바로잡은 것으로 정당하며, 최고 위험 지점(`@UseInterceptors
(FileInterceptor(...))` 를 쓰는 `uploadDocument`)을 직접 열어 데코레이터가 그 인자 안쪽이 아니라
바깥 최상위 체인에 올바르게 놓였음을 확인했다 — plan 이 자수한 1차 codemod 버그는 커밋에 남아있지
않다. `@ApiExcludeEndpoint()` 라우트 2건에 붙은 부착은 `swagger-explorer.js` 가 그 메서드의 메타데이터
수집 자체를 건너뛰므로 완전히 inert 하다(부작용 없음, 다만 목적 달성도 안 됨 — 문서화 스코프의
사소한 낭비). import 추가는 기존에 이미 import 되던 모듈의 named export 하나를 늘린 것뿐이라
순환 참조·번들 부작용이 없다. 백엔드 `tsc --noEmit` 을 직접 재현해 변경 파일에 신규 타입 오류가
없음도 확인했다. 억지로 만든 발견은 없으며, 부작용 관점에서 이 PR 은 스스로 주장한 범위를 정확히
지킨다.

## 위험도

NONE

STATUS: OK

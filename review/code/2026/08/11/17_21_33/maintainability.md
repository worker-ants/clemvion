# 유지보수성(Maintainability) Review

대상: `codebase/backend/src/modules/**/*.controller.ts` 16개 파일에 `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })` 51곳 신규 부착 (codemod) + `plan/`·`spec/` 문서 4개 동기화.

## 발견사항

- **[INFO]** 51곳 반복 부착은 DRY 위반이 아니라 이 저장소의 기존 관례를 그대로 따른 것 — 공용 데코레이터로 추출하지 않은 것이 옳다.
  - 위치: 16개 컨트롤러 전체 (예: `codebase/backend/src/modules/alerts/alerts.controller.ts:50`, `codebase/backend/src/modules/dashboard/dashboard.controller.ts:37,52,67`)
  - 상세: 실측 근거 3가지.
    1) 이 diff 이전에도 `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })` 은 이미 63곳에서 인라인으로 쓰이고 있었고(`grep -rc` 확인), `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 는 무려 156곳에서 100% 인라인이다. `applyDecorators` 를 쓰는 파일은 저장소 전체에서 `common/swagger/api-wrapped.ts` 단 하나뿐이다 — 즉 "단순 메타데이터 데코레이터를 인라인한다"는 것이 소급 적용된 임시방편이 아니라 이 저장소의 유일하고 일관된 관례다.
    2) `spec/conventions/swagger.md` §5-2 가 나열하는 "공용 래퍼 헬퍼"(`ApiOkWrappedResponse` 등)는 전부 `ApiExtraModels(Dto)` + `getSchemaPath(Dto)` 조합으로 **응답 바디 스키마를 DTO 타입에서 파생 생성**하는, 제네릭이 필요한 절차적 로직이다. 반면 `ApiForbiddenResponse({ description: '...' })` 는 이미 완결된 NestJS 데코레이터 호출이고, 복제되는 것은 로직이 아니라 문자열 리터럴 하나뿐이다 — 추출 대상의 "성격"이 다르다.
    3) `swagger.md §5-4` 체크리스트가 바로 이 문자열 선택 규칙("`@Roles()` 있으면 역할명, 없으면 '워크스페이스 멤버가 아님'")을 명문화하고 있다. 즉 이 반복의 SoT 는 이미 문서화돼 있으며, 이번 51곳은 그 문서화된 규칙을 정확히 따른다(51곳 전수 확인, 예외 0).
  - 제안: 없음 — 현재 관례를 유지하는 편이 옳다. 다만 향후 대규모 리팩터 기회가 생기면 `common/swagger` 에 `ApiWorkspaceForbidden()`/`ApiRoleForbidden(role)` 같은 얇은 래퍼를 추가해 지금 63+51=114곳에 흩어진 문자열 리터럴을 한 곳으로 모으는 것도 고려할 수 있다(오탈자 drift 사례가 실제로 1건 존재: `workspaces.controller.ts:286` 의 `'해당 워크스페이스 멤버가 아님'` — 이번 diff 밖의 기존 코드). 다만 이는 이번 PR의 책임이 아니고, 79개의 기존 인라인 부착·명문화된 §5-4 규칙과 정면으로 배치되는 선택이라 이번 스코프에서 강제할 근거가 없다.

- **[INFO]** codemod 가 신규 import 를 항상 리스트 맨 끝에 append 해, 일부 파일에서 기존 import 순서 관례(오름차순 HTTP status 혹은 알파벳)가 깨졌다 — 단 데코레이터 "사용" 위치는 전부 올바르다.
  - 위치:
    - `codebase/backend/src/modules/executions/background-runs/background-runs.controller.ts:10` — import 순서가 `ApiBadRequestResponse(400) → ApiUnauthorizedResponse(401) → ApiNotFoundResponse(404) → ApiForbiddenResponse(403)` 로, 403 이 404 뒤에 붙어 기존의 오름차순 status 순서를 깬다. 실제 데코레이터 사용 위치(`:47`)는 `@ApiUnauthorizedResponse` 와 `@ApiNotFoundResponse` 사이로 올바르다.
    - `codebase/backend/src/modules/notifications/notifications.controller.ts:20`, `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts:9` — 동일 패턴(401→404→403 import, 사용부는 401→403→404 로 정상).
    - `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:28` — import 목록이 원래 `ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiTags` 로 완전 알파벳순이었는데, `ApiForbiddenResponse` 가 맨 끝(`ApiTags` 뒤)에 붙어 알파벳순이 깨졌다.
  - 상세: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` §"drive-by 를 한 번 만들었다가 되돌렸다" 에 따르면, 최초 codemod 는 import 를 알파벳 재정렬했으나 "요청하지 않은 변경이 diff 를 부풀린다"는 이유로 폐기하고 append-only 로 재작성했다. 이는 의도된 트레이드오프이며, `eslint.config.mjs` 에 `sort-imports`/`import/order` 룰이 없어 lint 위반도 아니다. 코드모드 산출물과 사람이 손으로 쓴 주변 코드의 유일하게 구별 가능한 흔적이 이 import 순서다(데코레이터 부착 자체는 401→403→404 선례를 정확히 재현해 사람이 쓴 것과 구분 불가).
  - 제안: 조치 불요(트레이드오프가 이미 plan 에 근거와 함께 기록됨). 굳이 정리한다면 후속 PR 에서 파일 단위로 import 를 재정렬하되, diff 노이즈를 늘리므로 이번 PR 범위에 포함시키지 않는 것이 맞다.

- **[INFO]** (참고, 조치 불요) `model-config.controller.ts` 의 `findOne`, `workflow-assistant.controller.ts` 의 `list`/`latest`/`findOne` 3개 라우트는 애초에 `@ApiUnauthorizedResponse` 가 없어, 이번 diff 가 붙인 `@ApiForbiddenResponse` 가 통상적인 "401 데코레이터 직후" 위치가 아니라 각각 `@ApiOkWrappedResponse` 직후(`model-config.controller.ts:95`), 혹은 시그니처 직전(`workflow-assistant.controller.ts:58,77,94`)에 붙었다.
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts:95`, `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:58,77,94`
  - 상세: 이는 이번 diff 가 만든 결함이 아니라 이 파일들에 이미 있던 401 문서화 누락이며, `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` "## 후속" 섹션에 별도 티켓 대상으로 이미 등재돼 있다(이번 티켓은 403 전용으로 스코프를 명시적으로 좁혔다). 403 자체의 배치는 상태코드 오름차순 규칙과 상충하지 않는다.
  - 제안: 없음 — 이미 후속 항목으로 문서화됨.

## 요약

51곳의 `@ApiForbiddenResponse` 반복 부착은 겉보기엔 전형적인 DRY 위반처럼 보이지만, 실측 결과 이 저장소가 이미 확립한 관례(단순 메타데이터 데코레이터는 인라인, `common/swagger` 헬퍼는 스키마 생성 로직이 있는 데코레이터 전용)를 정확히 따른 것이고, 심지어 그 문자열 선택 규칙 자체가 `spec/conventions/swagger.md §5-4` 에 명문화돼 있어 SoT 는 이미 문서에 있다. 따라서 `@ApiWorkspaceForbidden()` 같은 공용 데코레이터로의 추출을 요구하는 것은 이번 diff 에 대한 정당한 지적이 아니다. codemod 산출물은 데코레이터 배치(401→403→404 오름차순, 기존 `nodes.controller.ts` 선례 재현)에서 사람이 쓴 코드와 구분되지 않을 정도로 정밀하고, plan 문서에 "drive-by 재정렬을 시도했다가 diff 노이즈 우려로 되돌렸다"는 근거까지 남겨 의도치 않은 변경 혼입을 스스로 경계했다. 유일하게 검증 가능한 흔적은 신규 import 가 항상 리스트 끝에 append 되어 일부 파일의 기존 알파벳/상태코드 순서를 깬 것인데, 이는 lint 로 강제되지 않는 순수 스타일 문제이고 diff 최소화를 택한 의도된 트레이드오프다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW

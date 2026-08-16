# API 계약(API Contract) 리뷰

## 범위 확인

이번 changeset 의 실질 API 표면 코드는 5개 backend 파일이다.

- `codebase/backend/src/modules/executions/executions.service.ts` — `ResponseExecution`/`ResponseNodeExecution` 타입 신설, `stop()`/`stopInternal()` 분리, `toResponseExecution`(구 `stripPrivateRelations`) 확장
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` — `toNodeExecutionDto` 의 `error` 필드 마스킹
- `codebase/backend/src/shared/utils/redact-stored-error.ts`(신규) — egress 마스킹 유틸
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` — Swagger JSDoc 갱신 (필드 타입·구조는 무변경)
- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` — Swagger JSDoc 갱신 (동일)

나머지(`.claude/docs/plan-lifecycle.md`, `CHANGELOG.md`, `plan/**`, `review/**`, `spec/**`)는 계획·리뷰·명세 문서다. 이 changeset 은 이미 `review/code/2026/08/16/17_12_34`·`17_35_49` 두 라운드의 `api_contract`/`maintainability`/`performance`/`testing` 리뷰를 거쳐 지적사항이 반영된 상태다(RESOLUTION.md 확인). 아래는 그 결과물에 대한 독립 재검증이다.

## 발견사항

- **[INFO]** 응답 스키마(키·타입)는 무변경, 값 내용만 마스킹됨 — 하위 호환성상 안전한 변경으로 판단
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:990-995`(`toResponseExecution`), `:946`(`toExecutionDto` 의 `error` 필드), `:643`(`findById` 내 `nodeExecutions[].error`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:302`(`toNodeExecutionDto`)
  - 상세: `GET /api/executions/:id` · `/chain` · `POST /:id/stop` · 목록 · `GET /executions/:id/background-runs/:id` · WS `execution.snapshot`(`findById` 재사용)이 반환하는 `error.message`/`error.details` 문자열 안의 자격증명 형태 부분문자열(`Bearer …`, `postgres://user:pw@…`)이 `***` 로 치환된다. DTO 선언(`execution-response.dto.ts:74`, `background-run-response.dto.ts:66-68`)은 이미 `error?: Record<string, unknown> | null` / `error: Record<string, unknown> | null` 이고 `redactStoredErrorForResponse`(`shared/utils/redact-stored-error.ts:57-63`)의 반환 타입도 정확히 이와 일치해 **구조 breaking change 는 없다**. 값 내용 변경이지만 spec 6곳(`1-data-model.md:564`, `2-navigation/14-execution-history.md:467`, `4-nodes/1-logic/12-background.md:246`, `5-system/14-external-interaction-api.md` §R17, `5-system/6-websocket-protocol.md:182`, `conventions/secret-store.md`)에 이미 정본 등재돼 있어 문서화 요건은 충족됐다.
  - 제안: 조치 불필요. 참고 기록.

- **[INFO]** `ResponseExecution`/`ResponseNodeExecution` 타입 신설이 무단 캐스트를 제거해 계약을 오히려 명확히 함 — 긍정 관찰
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:87-103`(타입 선언), `:817`(`stop`), `:990-995`(`toResponseExecution`)
  - 상세: 종전 `as Execution`/`as NodeExecution` 강제 캐스트가 `redactStoredErrorForResponse` 의 정직한 `| null` 반환을 지웠는데(`17_12_34`/`17_35_49` maintainability WARNING, 두 라운드 모두 조치됨), 이번 최종 상태는 무단 단언 없이 `error: Record<string, unknown> | null` 을 그대로 타입에 노출한다. `stop()` 의 반환 타입도 `Promise<Execution>` → `Promise<ResponseExecution>` 으로 좁아졌고, JSDoc(`:800-816`)이 "trigger/executor 는 애초에 로드되지 않아 응답에서 사라지는 필드가 없다"는 실측 근거를 남겨 하위 호환성 우려를 스스로 반증했다. `@ApiOkWrappedResponse(ExecutionDto, ...)`(controller) 대상 DTO 도 `trigger`/`executor` 를 애초에 선언하지 않아(`execution-response.dto.ts` 전체 확인) Swagger 계약과 실제 반환 타입 간 불일치가 없다.
  - 제안: 조치 불필요.

- **[INFO]** 응답이 여전히 "엔티티 spread" 패턴(strict DTO 직렬화 아님) — 기존 관행이며 이번 diff 가 도입/악화한 것이 아님
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:990-995`(`toResponseExecution` 이 `{ ...rest, error: ... }` 로 엔티티 필드를 그대로 spread), 대조: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:285-303`(`toNodeExecutionDto` 는 필드별로 명시 조립하는 strict 패턴)
  - 상세: `executions.service.ts` 계열은 컨트롤러 응답 시점에 `ClassSerializerInterceptor` 등으로 DTO 화이트리스트를 강제하지 않는 한, `ExecutionDto` 에 선언되지 않은 엔티티 컬럼이 있다면 함께 직렬화될 여지가 구조적으로 남는다. 다만 이는 `stripPrivateRelations`(구명) 시절부터 있던 기존 패턴이고 이번 PR 은 `error` 필드 마스킹만 얹었을 뿐 spread 자체를 새로 도입하지 않았다 — 직전 라운드 SUMMARY(`17_12_34`)도 이를 "이미 트래커 등재 범위 밖 항목"으로 명시했다. `background-runs` 쪽은 애초에 필드별 조립이라 이 우려에서 자유롭다.
  - 제안: 이번 PR 범위에서는 조치 불요. 다만 향후 `executions.service.ts` 응답 표면을 다룰 때는 `background-runs.service.ts` 의 strict DTO 조립 패턴을 참고할 가치가 있다(별건).

요청 검증(파라미터/바디 validation), URL/경로 설계, 페이지네이션(cursor·`NODE_EXECUTIONS_MAX_LIMIT=200` 등), 버전 관리, HTTP 상태 코드·에러 응답 "형식"(구조), 인증/인가(`@Roles`, `verifyOwnership`)는 이번 diff 범위에서 변경되지 않았다 — `stop()` 의 `@Roles('editor')`·`verifyOwnership` 호출 순서, `GET /:id` 계열의 `@Roles` 게이트 부재(기존 설계, spec R-5 캐비엇으로 이미 문서화)도 그대로다.

## 요약

이번 변경은 신규 엔드포인트·URL·요청 검증·페이지네이션·인가 로직을 건드리지 않는 순수 응답 값 마스킹이며, 이미 두 차례의 리뷰 라운드(`17_12_34`→`17_35_49`)를 거쳐 타입 안전성(무단 null-hiding 캐스트 제거)과 성능(copy-on-change) 문제까지 조치된 상태다. DTO 선언과 마스킹 함수의 반환 타입이 정확히 일치해 스키마 breaking change 는 없고, 4개 REST 반환 지점(`findById`/`getChain`/`stop`/`toExecutionDto`) + `background-runs` body 노드 + WS `execution.snapshot`(재사용 경유)을 단일 관문으로 묶어, 종전에 존재하던 채널 간 값 비일관(종결 emit 은 마스킹, 읽기 경로는 원문)을 해소했다는 점에서 계약 일관성이 오히려 개선됐다. 유일하게 남는 구조적 관찰은 `executions.service.ts` 응답이 여전히 엔티티 spread 패턴을 쓴다는 점인데, 이는 이 diff 가 새로 만든 문제가 아니라 이미 별도 트래커 범위 밖으로 확인된 기존 관행이다. API 계약 관점에서 CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

LOW — CRITICAL 0 · WARNING 0. INFO 3건은 전부 기록·참고 목적이며 조치 불요.

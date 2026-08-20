STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 코드 리뷰 — eia-inputdata-marker-guard

## 컨텍스트

이번 changeset 의 핵심은 `Execution.inputData` egress 마스킹 카브아웃 폐지다 — `GET
/executions/:id`(`toResponseExecution`) · `GET /executions`(목록, `toExecutionDto`) ·
`POST /executions/:id/rerun`(`stop()`/재실행 응답) 이 반환하는 `inputData` 필드가 이제
다른 필드(`error`/`outputData`/`nodeExecutions[].inputData`)와 같은 자격증명 값-패턴
마스킹 대상이 된다. 프런트 3개 재제출 소비처(폼 프리필·Re-run 모달·에디터 히스토리
로드)에는 마커 감지 가드가 새로 붙었다. 이 라운드(`16_25_35`)의 직전 커밋
(`e1607c737`)은 순수 리팩터(`isStructuredType()` 추출)·테스트 하드닝(ingestion 마커
보존 캐너리에 `inputData` 표면 추가)·spec/plan 문서 정정뿐이라 API 계약 표면 자체에는
변화가 없다. 신규 엔드포인트·URL·페이지네이션·인증/인가 변경은 없음.

동일 changeset 에 대한 API 계약 리뷰가 이미 3라운드(`14_44_08`, `15_59_17`, 그리고
`15_32_34`)에 걸쳐 수행됐고, 그때 지적된 두 항목은 이 라운드 시점에도 코드·트래커
상태가 그대로다 — 실측으로 재확인한 결과를 아래에 기록한다.

## 발견사항

- **[WARNING]** `Execution.inputData` 응답의 **내용 계약(semantic contract)**이 스키마 변경 없이 뒤집혔다 — 저장소 밖 소비자에게는 스키마상 감지 불가능한 breaking change (여전히 open)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:116-139`(`ResponseExecution` 타입, `inputData: Record<string, unknown> | null`), `:1010`(`toExecutionDto`, 목록 경로 `inputData: redactStoredDataForResponse(execution.inputData)`), `:1075`(`stop()`/rerun 응답 경로 `inputData: redactStoredDataForResponse(rest.inputData)`) — 응답 DTO: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:64-69`(`ExecutionDto.inputData`, `@ApiPropertyOptional({type:'object', additionalProperties:true, nullable:true})`)
  - 상세: `GET /executions/:id`·`GET /executions`(목록)·`POST /executions/:id/rerun` 이 반환하는 `inputData` 는 이번 PR 이전엔 자격증명 값이 있어도 DB 원문 그대로 나갔다(의도적 카브아웃 — Re-run 이 그 값을 재제출 소스로 썼기 때문). 이제 같은 필드가 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 로 마스킹된 값을 돌려준다. Swagger/OpenAPI 스키마 타입은 그대로 `object`(`additionalProperties: true, nullable: true`)라 **스키마 기반 클라이언트 생성이나 계약 테스트로는 이 변경을 전혀 감지할 수 없다** — 필드 존재·타입은 동일하고 런타임 *값의 의미*만 바뀐다. 이 저장소에는 REST API 버전 관리 축(`/v1/` prefix·`@Version` 데코레이터)이 없어 이런 내용 변경을 완충할 장치가 없다. 저장소 안 소비자(프런트 3곳)는 이 PR 이 동시에 마커 가드로 방어했지만, 이 엔드포인트를 직접 호출하는 저장소 밖 소비자(QA/운영 자동화, 감사 export 등, 존재 여부는 diff 범위 밖)는 스키마만으로는 이 변경을 알 수 없다.
  - 참고: 이 리스크는 PR 스스로 인지하고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:329`에 `[ ]` (미체크) 상태로 등재해 두었다 — 3개 리뷰 라운드(`14_44_08` WARNING, `15_59_17` WARNING)가 연속 지적했고 이번 라운드 시점에도 트래커 항목이 여전히 열려 있음을 실측 확인했다(체크박스 미체크). 이번 라운드가 새로 만든 결함은 아니며, CHANGELOG·spec(§R17)·Swagger jsdoc 은 사내 문서로서 정확히 갱신돼 있다.
  - 제안: 트래커 항목대로 이 REST 엔드포인트를 직접 소비하는 저장소 밖 클라이언트 존재 여부를 확인하고, 있다면 릴리스 공지에 "GET 응답의 `inputData` 는 이제 egress 마스킹되므로 재제출 전 실제 값 확인 필요"를 명시한다.

## 점검했으나 이상 없음 (참고)

- **요청 검증**: `POST /executions/:id/rerun`의 `inputOverride`(`executions.service.ts:493`, `resolveTriggerParameters(schema, dto.inputOverride ?? {})`)는 이번 라운드에서도 변경되지 않았고, 마스킹 마커 리터럴을 서버측에서 거부하는 로직은 여전히 없다 — 클라이언트 3곳(`dynamic-form-ui.tsx`/`rerun-modal.tsx`/`editor-toolbar.tsx`)의 UI 가드로만 방어된다. 이 갭은 이번 changeset 이 새로 만든 것이 아니고, `spec-sync-external-interaction-api-gaps.md:322`에 이미 등재돼 있으며 security 리뷰어가 "기밀성 침해 아님(자격증명 이미 제거된 상태) + 가드 범위는 UI 정상 흐름 방어로 명시(EIA §R17)"로 INFO 판정·defer 완료한 사안이라 이번 라운드에서 재차 WARNING 으로 올리지 않는다.
- **응답 형식 일관성**: `ExecutionDto.inputData`·`NodeExecutionSummaryDto.inputData`(`execution-response.dto.ts`)·`BackgroundRunNodeExecutionDto.inputData`(`background-run-response.dto.ts`) 세 곳의 Swagger JSDoc·`nullable: true` 스키마가 모두 동기화돼 있다(실측 재확인).
- **에러 응답·HTTP 상태 코드**: 이번 diff 는 신규/변경 에러 코드·상태 코드를 도입하지 않는다.
- **URL/경로·페이지네이션·인증/인가**: 신규 엔드포인트·라우트·`@Roles`/`@Throttle` 가드 변경 없음.
- **버전 관리**: 이 저장소에 API 버전 네임스페이스가 없다는 기존 관례와 일치하며 이번 변경이 그 관례를 깨지 않는다.
- **이번 라운드 신규 커밋(`e1607c737`)**: `isStructuredType()` 추출은 프런트 내부 리팩터, ingestion 마커 보존 캐너리에 `inputData` 표면 추가는 테스트 하드닝 — 둘 다 API 계약 표면에 영향 없음.

## 요약

이번 changeset 은 `Execution.inputData` 응답 필드의 *값 의미*를 "재제출 가능한 원문"에서 "표시 전용, egress 마스킹 대상"으로 전환한다 — 스키마 타입은 그대로라 계약 테스트로 감지되지 않는 실질적 breaking change 이며 API 버전 관리 축이 없어 완충 장치도 없다. 다만 이 리스크는 PR 스스로 트래커에 미해결 항목(`외부 소비자 확인`)으로 정확히 등재해 두었고, 저장소 안 모든 소비처는 동시에 가드됐으며, `POST /rerun`의 서버측 마커 미검증 갭도 별도 트래커 항목으로 이미 등재·팀 검토를 거쳐 defer 됐다 — 3개 리뷰 라운드에 걸쳐 반복 확인된 알려진 트레이드오프이지 이번 라운드가 새로 발견한 결함은 아니다. 이번 라운드의 신규 커밋(리팩터·테스트 하드닝·문서 정정)은 API 계약 표면을 추가로 건드리지 않는다.

## 위험도

LOW

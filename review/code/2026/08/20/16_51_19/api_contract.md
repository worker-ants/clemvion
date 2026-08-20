STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 코드 리뷰 — eia-inputdata-marker-guard (16_51_19)

## 컨텍스트

이번 changeset 의 핵심은 `Execution.inputData` egress 마스킹 카브아웃 폐지다 — `GET
/executions/:id`(`toResponseExecution`) · `GET /executions`(목록, `toExecutionDto`) ·
`GET /executions/:id/background-runs/:id`(`background-runs.service.ts`) 가 반환하는
`inputData` 필드가 이제 다른 필드(`error`/`outputData`/`nodeExecutions[].inputData`)와
같은 자격증명 값-패턴 마스킹 대상이 된다. 프런트 3개 재제출 소비처(폼 프리필·Re-run
모달·에디터 히스토리 로드)에는 마커 감지 가드가 붙었고, 그 판별기(`isMaskedMarker`/
`hasMaskedMarkerLeaf`)는 `dynamic-form-ui.tsx` 내부에서 `lib/utils/masked-markers.ts` 로
승격됐다. 신규 엔드포인트·URL·페이지네이션·인증/인가 변경은 없음.

동일 changeset(`Execution.inputData` 카브아웃 폐지)에 대한 API 계약 리뷰는 이미 2라운드
(`15_59_17`, `16_25_35`)에 걸쳐 수행됐고, 이번 라운드(`16_51_19`)의 직전 신규 커밋
(`6f1d4d41d`)은 프런트 `hasMaskedMarkerLeaf` 재귀 탐색에 깊이 상한(`MAX_MARKER_SCAN_DEPTH`,
backend `MAX_REDACT_DEPTH` 와 동일 값)을 추가하는 순수 방어적 하드닝으로, 백엔드
컨트롤러·DTO·라우트·인증 가드는 건드리지 않는다 — API 계약 표면에는 변화가 없다. 이전
2라운드가 지적한 두 항목의 코드·트래커 상태를 실측 재확인한 결과를 아래에 기록한다.

## 발견사항

- **[WARNING]** `Execution.inputData` 응답의 **내용 계약(semantic contract)**이 스키마 변경 없이 뒤집혔다 — 저장소 밖 소비자에게는 스키마상 감지 불가능한 breaking change (여전히 open, 3라운드 연속 지적)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`toExecutionDto` 목록 경로, `toResponseExecution` 단건/rerun 경로, 둘 다 `redactStoredDataForResponse(...)` 를 `inputData` 에 적용) · `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-60`(`ExecutionDto.inputData`) — 응답 스키마 타입은 그대로 `type:'object', additionalProperties:true, nullable:true` 유지
  - 상세: 이번 PR 이전엔 `Execution.inputData` 가 자격증명 값이 있어도 DB 원문 그대로 나갔다(의도적 카브아웃 — Re-run 이 그 값을 재제출 소스로 썼기 때문). 이제 같은 필드가 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 로 마스킹된 값을 돌려준다. OpenAPI/Swagger 스키마 상 타입·필수 여부는 동일하고 **런타임 값의 의미**만 바뀌므로, 스키마 기반 클라이언트 코드 생성이나 계약 테스트로는 이 변경을 전혀 감지할 수 없다. 이 저장소에는 REST API 버전 관리 축(`/v1/` prefix·`@Version` 데코레이터)이 없어 이런 내용 변경을 완충할 장치도 없다. 저장소 안 소비자(프런트 3곳)는 이 PR 이 동시에 마커 가드로 방어했지만, 이 엔드포인트를 직접 호출하는 저장소 밖 소비자(QA/운영 자동화, 감사 export 등)는 스키마만으로는 이 변경을 알 수 없다.
  - 참고: 이 리스크는 PR 스스로 인지하고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:329`에 `- [ ]` (미체크) 상태로 등재해 두었다 — 이번 라운드 시점에도 실측 확인상 여전히 미체크다. `14_44_08`·`15_59_17`·`16_25_35` 세 라운드가 연속 지적했고 매 라운드 판정(WARNING, defer 대상)이 일관됐다. 이번 라운드가 새로 만든 결함은 아니며, CHANGELOG·spec(§R17)·Swagger jsdoc 은 정확히 갱신돼 있다.
  - 제안: 트래커 항목대로 이 REST 엔드포인트를 직접 소비하는 저장소 밖 클라이언트 존재 여부를 확인하고, 있다면 릴리스 공지에 "GET 응답의 `inputData` 는 이제 egress 마스킹되므로 재제출 전 실제 값 확인 필요"를 명시한다. 이번 PR 을 막을 사안은 아니다.

## 점검했으나 이상 없음 (참고)

- **요청 검증**: `POST /executions/:id/rerun` 의 `inputOverride` 는 여전히 마스킹 마커 리터럴을 서버측에서 거부하지 않는다 — 클라이언트 3곳의 UI 가드로만 방어된다. 이 갭은 이번 changeset 이 새로 만든 것이 아니고 `spec-sync-external-interaction-api-gaps.md:322`에 이미 등재돼 있으며, security 리뷰어가 "기밀성 침해 아님(자격증명 이미 제거된 상태) + 가드 범위는 UI 정상 흐름 방어로 명시(EIA §R17)"로 INFO 판정·defer 완료한 사안이라 이번 라운드에서도 WARNING 으로 올리지 않는다.
- **응답 형식 일관성**: `ExecutionDto.inputData`·`NodeExecutionSummaryDto.inputData`(`execution-response.dto.ts`)·`BackgroundRunNodeExecutionDto.inputData`(`background-run-response.dto.ts`) 세 곳의 Swagger JSDoc·`nullable: true` 스키마가 모두 동기화돼 있다(실측 재확인). Execution 레벨·NodeExecution 레벨의 마스킹 정책이 이번 변경으로 통일되면서 REST·WS 간 flip-flop 우려(`6-websocket-protocol.md`)도 spec 상 해소됐다.
- **에러 응답·HTTP 상태 코드**: 이번 diff 는 신규/변경 에러 코드·상태 코드를 도입하지 않는다.
- **URL/경로·페이지네이션·인증/인가**: 신규 엔드포인트·라우트·`@Roles`/`@Throttle` 가드 변경 없음.
- **버전 관리**: 이 저장소에 API 버전 네임스페이스가 없다는 기존 관례와 일치하며 이번 변경이 그 관례를 깨지 않는다.
- **이번 라운드 신규 커밋(`6f1d4d41d`)**: 프런트 `hasMaskedMarkerLeaf` 재귀 탐색에 깊이 상한 추가(에디터 렌더 경로 방어). 백엔드 컨트롤러·DTO·라우트는 미변경 — API 계약 표면에 영향 없음.

## 요약

이번 changeset 은 `Execution.inputData` 응답 필드의 *값 의미*를 "재제출 가능한 원문"에서 "표시 전용, egress 마스킹 대상"으로 전환한다 — 스키마 타입은 그대로라 계약 테스트로 감지되지 않는 실질적 breaking change 이며 API 버전 관리 축이 없어 완충 장치도 없다. 이 리스크는 PR 스스로 트래커에 미해결 항목("외부 소비자 확인")으로 등재해 두었고, 저장소 안 모든 소비처는 동시에 가드됐으며, `POST /rerun`의 서버측 마커 미검증 갭도 별도 트래커 항목으로 이미 defer 됐다 — 3개 리뷰 라운드(`15_59_17`, `16_25_35`, 이번 `16_51_19`)에 걸쳐 반복 확인된 동일한 판정이며, 이번 라운드가 새로 발견한 결함은 없다. 이번 라운드의 유일한 신규 커밋(재귀 깊이 상한 하드닝)은 API 계약 표면을 건드리지 않는다.

## 위험도

LOW

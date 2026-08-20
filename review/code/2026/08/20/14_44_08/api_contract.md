STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 코드 리뷰 — eia-inputdata-marker-guard

## 발견사항

- **[WARNING]** `Execution.inputData` 응답 값의 의미가 반전됐다 — 스키마는 그대로지만 콘텐츠 계약이 깨지는 변경(하위 호환성)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `ResponseExecution` 타입 정의부(`Omit<Execution, 'error' | 'inputData' | 'outputData' | 'trigger' | 'executor'>`), `toResponseExecution`(1008번째 줄 `inputData: redactStoredDataForResponse(execution.inputData),`), `stop()`(1073번째 줄 `inputData: redactStoredDataForResponse(rest.inputData),`)
  - 상세: `GET /executions/:id`(`findById`) · `GET .../executions`(목록, `findByWorkflow`) · `GET /executions/:id/chain` · `POST /executions/:id/stop` 이 반환하는 `inputData` 필드가 이번 변경 전에는 DB 원문을 그대로 냈으나, 이제 자격증명으로 판별된 값-패턴을 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 로 치환해 반환한다. JSON 스키마 타입(`Record<string, unknown> | null`, `additionalProperties: true`)은 동일해 OpenAPI 계약상으로는 드러나지 않지만, **필드 값의 의미가 "재제출 가능한 원문" 에서 "표시 전용, 왕복 불가" 로 바뀐 실질적 breaking change** 다. 이 저장소는 REST 엔드포인트 버전 관리 체계(`/v1` 등)가 없어 스키마 버전 분리는 논외지만, 이 변경으로 영향을 받는 소비자는 patch 대상인 프런트 3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드)만이 아니다 — 이 REST 엔드포인트를 직접 호출하는 임의의 인증된 클라이언트(QA/운영 자동화 스크립트, 감사 로그 export 도구 등, 실제 존재 여부는 이 diff 범위 밖)는 `inputData` 값이 마스킹됐다는 사실을 스키마로는 알 수 없다. CHANGELOG·spec(§R17)·Swagger jsdoc 은 모두 갱신됐으나(사내 문서), 이는 자동으로 API 소비자에게 전달되지 않는다.
  - 제안: 이 REST 응답을 프런트 이외에 소비하는 내부 자동화/스크립트가 있는지 확인하고, 있다면 릴리스 노트/공지에 "GET 응답의 `inputData` 는 이제 egress 마스킹되므로 재제출 전 실제 값 확인 필요" 항목을 명시적으로 남긴다.

- **[WARNING]** `POST /executions/:id/re-run` 의 `inputOverride` 요청 바디에 마스킹 마커 리터럴을 거부하는 서버측 검증이 없음 (요청 검증 관점)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reRun()` 메서드, `parameters = resolveTriggerParameters(schema, dto.inputOverride ?? {});` 호출부(492번째 줄 부근)
  - 상세: 이번 PR 의 핵심 목적은 "마스킹된 값이 되돌아와 새 실행의 실제 입력이 되는" 왕복 오염을 막는 것인데, 그 가드는 **클라이언트 3곳**(`dynamic-form-ui.tsx`/`rerun-modal.tsx`/`editor-toolbar.tsx`)에만 심어졌다. 정작 이를 받는 `POST /executions/:id/re-run` 서버 로직은 `dto.inputOverride` 에 `'***'`/`[REDACTED]`/`[REDACTED_DEPTH]` 리터럴이 그대로 담겨 있어도 `resolveTriggerParameters` 가 타입·필수값만 검증하므로 그대로 통과시켜 새 실행의 입력으로 확정한다. 즉 `GET /executions/:id` 로 마스킹된 `inputData` 를 읽어 그대로 `inputOverride` 에 실어 재제출하는, 패치 대상이 아닌 임의의 API 호출(curl/스크립트/향후 다른 클라이언트 화면)은 이 PR 이 막으려던 "조용한 데이터 오염" 을 서버 계약 레벨에서 그대로 재현할 수 있다. 이 갭 자체는 새로운 지적이 아니라 직전 라운드(`review/code/2026/08/20/14_08_45/security.md` INFO-1, `RESOLUTION.md` "미반영 INFO … 1(서버측 재검증)은 설계 결정이라 별건")에서 이미 발견돼 의도적으로 보류됐다 — 여기서는 그 트레이드오프를 뒤집자는 게 아니라, **요청 검증** 축의 API 계약 관점에서 이 엔드포인트가 "GET 으로 받은 값을 그대로 재제출해도 서버가 걸러준다" 는 것을 보장하지 않는다는 사실을 기록한다.
  - 제안: 이미 팀이 인지·보류한 트레이드오프이므로 즉시 조치를 요구하진 않는다. 다만 defense-in-depth 로 `resolveTriggerParameters`(또는 `ReRunRequestDto` validation)에 "값이 알려진 마스킹 마커 리터럴과 정확히 일치하면 `INVALID_INPUT` 으로 거부" 하는 얕은 체크를 추가하는 안을 별도 트래커 항목으로 유지할 것을 권장.

## 점검했으나 이상 없음 (참고)

- **응답 형식 일관성**: `ExecutionDto.inputData`(`execution-response.dto.ts`) · `NodeExecutionSummaryDto.inputData`(같은 파일) · `BackgroundRunNodeExecutionDto.inputData`(`background-run-response.dto.ts`) 세 곳의 Swagger JSDoc 이 모두 "마스킹 대상이다 / 두 레벨이 같은 규칙" 로 정확히 동기화돼 있다(직전 라운드 CRITICAL "자매 표면 누락" 이 이번 changeset 에서 이미 해소됨, `review/code/2026/08/20/14_08_45/RESOLUTION.md` 참조 및 현재 소스 재확인).
- **HTTP 상태 코드·에러 응답**: 이번 diff 는 신규/변경 에러 코드나 상태 코드를 도입하지 않는다. `POST /executions/:id/re-run` 의 `400 INVALID_INPUT` 계약은 스키마 검증 실패 경로만 그대로 사용한다.
- **URL/경로·페이지네이션·인증/인가**: 신규 엔드포인트·라우트 변경 없음. 컨트롤러의 `@Roles`/`@Throttle` 가드는 이번 diff 대상이 아니다(`background-runs.controller.ts` 관련 주석은 기존 gate 없음을 재확인하는 코멘트 수정일 뿐, 실제 가드 변경 아님).
- **버전 관리**: 이 저장소에 REST API 버전 네임스페이스가 없다는 기존 관례와 일치하며 이번 변경이 그 관례를 깨지 않는다.

## 요약

이번 변경의 핵심은 `Execution.inputData` egress 마스킹 카브아웃을 폐지해 노드 레벨과 동일한 규칙으로 통일한 것이며, DTO Swagger 문서·CHANGELOG·spec(§R17)이 모두 동기화되어 있고 프런트 3개 재제출 소비처에 마커 가드를 심어 UI 경로의 데이터 오염을 막았다. API 계약 관점에서는 두 가지가 남는다 — (1) `inputData` 필드의 반환 *값의 의미*가 바뀌는 것은 스키마 타입에는 드러나지 않는 실질적 하위 호환성 이슈이고, (2) `POST /executions/:id/re-run` 은 마스킹 마커 리터럴이 `inputOverride` 로 그대로 들어와도 서버측에서 거르지 않아 UI 를 우회하면 이 PR 이 막으려던 오염이 API 레벨에서 재현될 수 있다(단, 이는 이미 팀이 인지하고 보류한 트레이드오프). 둘 다 이번 changeset 이 새로 만든 결함이 아니라 기존 설계의 알려진 경계이며, CRITICAL 로 볼 근거(무단 실행·기밀 노출·인증 우회)는 없다.

## 위험도

LOW

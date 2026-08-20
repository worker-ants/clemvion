STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 코드 리뷰 — eia-inputdata-marker-guard

## 컨텍스트

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃을 폐지한다 — 지금까지 `GET`
계열 응답(`ExecutionDto.inputData`, `toExecutionDto` 목록 경로, `toResponseExecution` 단건
경로, `ResponseExecution`/`ResponseNodeExecution` 타입)에서 원문으로 나가던
`Execution.inputData` 가 이제 다른 필드(`error`/`outputData`/`nodeExecutions[].inputData`)와
같은 자격증명 값-패턴 마스킹 대상이 된다. 대신 프런트 3개 소비처(폼 프리필·Re-run 모달·
에디터 히스토리 로드)가 마커를 감지해 프리필을 건너뛰거나 제출/실행을 막는 가드를 얻었다.
새 엔드포인트·URL·페이지네이션·인증/인가 변경은 없다.

## 발견사항

- **[WARNING]** 기존 응답 필드의 **내용 계약(semantic contract)** 이 스키마 변경 없이 뒤집혔다 — 저장소 밖 소비자에게는 무통보 breaking change
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1010` (`toExecutionDto`, 목록 경로), `:1075` (`toResponseExecution`, 단건/rerun 응답 경로), `:100-115` (`ResponseExecution` 타입 JSDoc) — 응답 DTO 문서: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:52-60`(`ExecutionDto.inputData`), `:177-181`(`NodeExecutionSummaryDto.inputData`)
  - 상세: `GET /executions/:id`, `GET /executions`(목록), `POST /executions/:id/rerun` 등 `ExecutionDto`/`ResponseExecution` 을 거치는 모든 읽기 표면에서, 지금까지 `Execution.inputData` 는 자격증명 값이 있어도 **원문 그대로** 나갔다(의도적 카브아웃 — Re-run 이 그 값을 재제출 소스로 쓰기 때문). 이번 diff 로 같은 필드가 이제 자격증명 패턴을 `***`/`[REDACTED]` 로 마스킹해 돌려준다. OpenAPI/Swagger 스키마 상 타입은 그대로 `object`(`additionalProperties: true`) 라 **스키마 기반 클라이언트 코드 생성이나 계약 테스트는 이 변경을 전혀 감지하지 못한다** — 필드 존재·타입은 동일하고 오직 *런타임 값의 내용*만 달라진다. 이 저장소는 API 버전 관리 체계가 없어(`/v1/` prefix·`@Version` 데코레이터 grep 0건) 이런 내용 변경을 완충할 버전 축이 아예 없다. 저장소 안 소비자(프런트 폼 프리필·Re-run 모달·에디터 히스토리 로드)는 이번 PR 이 동시에 마커 가드를 붙여 왕복 오염을 막았지만, 이 엔드포인트를 직접 호출하는 **저장소 밖** 소비자(QA/운영 자동화, 감사 export, 외부 통합 등)는 스키마만 봐서는 이 변경을 알 수 없고, 예전엔 원문이던 `inputData` 를 그대로 사용하는 로직이 있다면 이제 조용히 마스킹된 문자열을 받게 된다.
  - 참고: 이 리스크는 PR 스스로도 인지하고 있다 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md:329` 에 "`Execution.inputData` 응답 의미 반전의 외부 소비자 확인" 항목이 미체크(`[ ]`) 상태로 등재돼 있고, 직전 리뷰 라운드(`14_44_08`)의 `RESOLUTION.md` 도 이를 "이번 PR 을 막을 사안이 아니다" 로 트래커에만 넘긴 상태다. 즉 **알려져 있고 의도적으로 defer 된 갭**이며 이번 라운드에서 새로 발견한 결함은 아니다 — 다만 API 계약 관점에서는 여전히 열린 상태이므로 재확인 차 기재한다.
  - 제안: 트래커 항목대로 (1) 이 엔드포인트를 직접 소비하는 저장소 밖 클라이언트 존재 여부를 확인하고, (2) 있다면 릴리스 노트/CHANGELOG 를 "API breaking change" 로 명시 공지하며, (3) 가능하면 응답 DTO 설명(Swagger `description`, 이미 이번 diff 가 갱신함)에 더해 실제 API 문서(외부 공개용이 있다면)에도 동일 caveat 을 반영한다.

- **[INFO]** 요청 검증(`inputOverride`)은 여전히 서버가 아니라 클라이언트에서만 마스킹 마커를 거부한다 — 이번 PR 의 신규 결함은 아님
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `blockedByMaskedInput`(약 355행 부근)·`codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 의 `hasMaskedMarkerLeaf(parsed)` 체크(약 118행) — 서버측 `codebase/backend/src/modules/executions/dto/re-run.dto.ts`, `executions.controller.ts` 는 이번 diff 에 포함되지 않았음(실측: `git diff origin/main...HEAD --name-only` 목록에 없음)
  - 상세: 마스킹된 값이 재제출되는 왕복 오염을 막는 가드가 이번 PR 에서 전부 **프런트 UI 레이어**에만 추가됐다. `POST /executions/:id/rerun` 의 `inputOverride` 필드는 타입·필수값만 검증하고 리터럴 값이 마스킹 마커(`'***'` 등)와 정확히 일치하는지는 서버가 보지 않는다. 즉 UI 를 우회해 API 를 직접 호출하는 클라이언트(curl 등)는 여전히 마스킹 마커 문자열을 그대로 `inputOverride` 로 제출해 왕복 오염을 재현할 수 있다.
  - 참고: 이 갭은 이번 PR 이 만든 것이 아니라 이전부터 있던 것이고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322` 에 "`inputOverride` 서버측 마커 리터럴 거부" 로 이미 등재돼 있다. 직전 라운드에서 security reviewer 도 "기밀성 침해 아님(자격증명이 이미 제거된 상태) + 가드 범위는 UI 정상 흐름 방어로 명시(EIA §R17)" 근거로 INFO 판정하고 defer 했다. API 계약 관점에서는 "요청 검증" 축의 defense-in-depth 갭으로 남아 있음을 참고용으로만 기재한다 — 이번 changeset 을 막을 사안은 아니다.
  - 제안: (선택) `resolveTriggerParameters` 또는 `re-run.dto.ts` 레벨에서 값이 마스킹 마커와 정확히 일치하면 `400 INVALID_INPUT` 계열로 얕게 거부하는 방어를 트래커 항목대로 검토.

- **[INFO]** 응답 DTO 의 Swagger `description` 이 새 마스킹 정책에 맞춰 정확히 갱신됨 (긍정적)
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:52-60`, `:177-181`, `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:50-51`
  - 상세: `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData`/`BackgroundRunNodeExecutionDto.inputData` 세 곳 모두 "자격증명으로 판별된 값은 마스킹되어 반환된다(DB 원문과 다를 수 있음)" 로 정확히 갱신돼 있어, Swagger UI/OpenAPI 문서를 보는 API 소비자가 최소한 문서상으로는 이 변경을 확인할 수 있다. 위 WARNING 이 지적하는 것은 이 문서 갱신 자체가 아니라 "스키마 타입은 안 바뀌어 자동 생성 클라이언트/계약 테스트가 이걸 못 잡는다" 는 것이다.

## 요약

새 엔드포인트·URL 설계·페이지네이션·인증/인가 변경은 없고, 이번 changeset 의 API 계약상 핵심은 기존 `Execution.inputData` 응답 필드의 **내용 의미가 반전**된 것이다 — 스키마(타입)는 그대로라 자동 계약 검증으로는 감지되지 않는 breaking 성격의 변경이며, 이 프로젝트에는 API 버전 관리 체계 자체가 없어 완충 장치도 없다. 다만 이 리스크는 PR 스스로 트래커(`spec-sync-external-interaction-api-gaps.md`)에 미해결 항목으로 정확히 등재해 두었고, 저장소 안의 모든 소비처는 동시에 가드됐으며, Swagger 문서도 정확히 갱신됐다 — 즉 알려진·의도적으로 defer 된 갭이지 이번 라운드가 새로 발견한 결함은 아니다. 요청 검증 축의 서버측 마커 거부 부재도 마찬가지로 기존 갭이며 이번 PR 이 새로 만든 것이 아니다. 두 항목 모두 이미 별도 트래커 항목(각각 W5·W6)으로 등재돼 있어 이번 PR 을 막을 사안은 아니다.

## 위험도

LOW

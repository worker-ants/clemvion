STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`git diff origin/main...HEAD` (merge-base `82a967afb`) 기준, API 계약과 직결되는 부분을 중심으로
직접 열어 대조했다: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`,
`codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`,
`codebase/backend/src/modules/executions/executions.service.ts`(`toResponseExecution`/
`toExecutionDto`/`reRun` 입력 분기), `codebase/backend/src/modules/executions/background-runs/
background-runs.service.ts`, `codebase/backend/src/modules/executions/dto/re-run.dto.ts`(diff에는
없으나 영향 확인용으로 열람), `CHANGELOG.md`, `spec/5-system/14-external-interaction-api.md` §R17,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`. 이 changeset 은 이미 10라운드
(`14_08_45`~`18_03_37`)의 code/consistency 리뷰를 거쳐 CRITICAL 0 으로 수렴한 상태이며, 이번은
그 최종 결과(라운드10 fix 포함, `2c628f6ac`)에 대한 API 계약 관점 독립 확인이다.

이 PR 은 새 엔드포인트·URL·페이지네이션·인증/인가를 건드리지 않는다. 핵심은 기존
`GET /api/executions/:id` 등 REST 읽기 표면이 반환하는 `Execution.inputData` 필드의 **콘텐츠
시맨틱**을 "원문"에서 "마스킹됨"으로 반전시킨 것 — 스키마(타입)는 그대로라 OpenAPI 로는
드러나지 않는 **breaking 콘텐츠 계약 변경**이다.

## 발견사항

- **[WARNING]** `Execution.inputData` 응답 콘텐츠 계약이 버전 신호 없이 반전됐다 (breaking, 이미
  트래커에 등재된 사안 — 확인적 재기재)
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    (`ExecutionDto.inputData` JSDoc, gate 52~56행) · `codebase/backend/src/modules/executions/
    executions.service.ts` 의 `toResponseExecution`/`toExecutionDto` (`inputData:
    redactStoredDataForResponse(...)` 적용 지점, L1010·L1075) · `CHANGELOG.md` gate 3행(제목)
  - 상세: 종전에는 `Execution.inputData` 가 egress 마스킹의 **유일한 예외**로 문서화돼 있었고
    (`MASKED_INPUT_DATA_REASON`), 이번 PR 로 그 카브아웃이 닫혀 credential-like 패턴이 이제
    `'***'`/`'[REDACTED]'` 로 치환돼 나간다. `type: 'object', additionalProperties: true` 인
    OpenAPI 스키마 자체는 변하지 않아, 자동 생성 클라이언트/스키마 검증만으로는 이 변경이 전혀
    드러나지 않는다 — Swagger JSDoc 설명문(사람이 읽어야 함)에만 실려 있다. 이 저장소의 프런트
    3소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)는 이번 PR 로 함께 가드됐지만, 이
    엔드포인트를 **저장소 밖에서 직접 호출하는 소비자**(QA/운영 자동화, 감사 export, 서드파티
    통합 등)는 스키마 diff 로 이 반전을 알 방법이 없다. API 버전 관리(`/v1/` 등)나
    `Deprecation`/`Sunset` 헤더 같은 명시적 신호도 없다(이 프로젝트에 애초에 그런 버저닝
    메커니즘이 없다 — 이 PR 이 새로 만든 갭은 아니다).
  - 참고: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 342행에 **"`Execution.inputData`
    응답 의미 반전의 외부 소비자 확인"** 항목으로 이미 등재돼 있고, "존재 여부를 확인하고, 있으면
    릴리스 노트에 breaking 으로 공지" 로 조치 방향이 명문화돼 있다. CHANGELOG 자체도 이 PR 을
    "카브아웃을 닫았다" 는 표제로 명시해 최소한의 공지는 됐다.
  - 제안: 트래커 항목대로 실제 외부 소비자 존재 여부를 확인하고, 있다면 CHANGELOG 표제를
    "breaking" 태그로 명확히 표시하거나 별도 release-notes 채널에 공지한다. 장기적으로는 이런
    콘텐츠-레벨 계약 변경이 재발할 것을 대비해, `additionalProperties: true` 로 스키마가 뭉개지는
    필드에 한해 "이 필드는 egress 마스킹 대상" 같은 machine-readable 마커(예: OpenAPI
    `x-` extension)를 검토할 수 있다.

- **[WARNING]** `POST /executions/:id/re-run` 의 `inputOverride` 요청 검증이 마스킹 마커 리터럴을
  걸러내지 않는다 (pre-existing gap, 이미 트래커에 등재 — 확인적 재기재)
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`ReRunRequestDto.
    inputOverride` — `@IsObject()` 만 있고 값 내용 검증 없음, 이번 diff 로 변경되지 않은 파일) ·
    `codebase/backend/src/modules/executions/executions.service.ts` 의 `reRun` 메서드
    `useOriginal === false` 분기(`resolveTriggerParameters(schema, dto.inputOverride ?? {})`,
    타입·필수값만 검증)
  - 상세: 이 PR 이 만드는 UI 가드(Re-run 모달의 `blockedByMaskedInput`, 에디터 툴바의
    `hasMaskedMarkerLeaf`)는 프런트 렌더 경로에만 있다. `curl` 등으로 API 를 직접 호출해
    `inputOverride: { apiKey: "***" }` 를 실으면 `resolveTriggerParameters` 는 타입이 맞으면
    그대로 통과시켜, 리터럴 마스킹 마커가 새 Execution 의 **실제 입력값**으로 들어간다. 요청
    바디의 구조적 유효성(타입·필수값)은 검증되지만, 이 필드의 값이 "이미 마스킹된 값을
    되제출하는 것" 이라는 의미 수준 유효성은 API 레벨에서 검증되지 않는다.
  - 참고: `CHANGELOG.md` gate 9~14행이 이 경로를 "닫힌 범위는 UI 정상 흐름 한정" 이라고 스스로
    명시했고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 322행에
    **"`inputOverride` 서버측 마커 리터럴 거부"** 로 이미 등재돼 있다(2026-08-20). 영향은 기밀성
    침해가 아니라 호출자 자신의 새 실행 입력 오염에 한정되고, 트래커는 착수 시 서버측 체크와
    §R17 범위 명문화(planner 턴, `spec/` 쓰기 권한 밖)를 함께 하기로 명시해 뒀다 — 이번 PR 단독
    범위로 닫을 사안이 아니라는 판단은 타당하다.
  - 제안: 트래커 항목 그대로 진행 시, `inputOverride` 의 leaf 값이 `MASKED_MARKERS` 와 정확히
    일치하면 `400 INVALID_INPUT` 계열(기존 `resolveTriggerParameters` 실패와 같은 에러 코드
    패밀리)로 거부하는 defense-in-depth 체크를 `reRun` 입력 분기에 추가한다. 이렇게 하면
    "요청 검증" 축과 "에러 응답 일관성" 축을 동시에 만족한다(같은 자리에서 같은 에러 shape 재사용).

## 확인한 것 (회귀 없음 · API 계약 관점)

- **응답 형식 일관성**: `inputData` 마스킹이 REST 읽기 표면 전체 — `toResponseExecution`(단건),
  `toExecutionDto`(목록, L1010), `getChain`/`stop`, `BackgroundRunsService.toNodeExecutionDto`(본문
  노드) — 에 동일한 `redactStoredDataForResponse` 헬퍼로 일관되게 적용된다. 필드 타입·`null`
  처리(`redactStoredDataForResponse` 는 `null` 을 그대로 통과)도 형제 필드 `outputData`/`error` 와
  동일 규약을 공유해, 같은 엔드포인트 안에서 필드별로 다른 nullability 계약이 생기지 않는다.
- **webhook ingestion 마커와의 계약 비파괴**: `inputData` 에 이미 실려 있던 ingestion 시점
  `[REDACTED]` 마커(`spec/5-system/12-webhook.md` §5.3)가 새 egress 마스킹과 충돌하지 않고
  멱등하게 보존됨을 테스트로 확인(`deepRedactCore` 가 마커 문자열 재치환하지 않음).
- **인가 무변경**: `BackgroundRunsController`/`ExecutionsController` 의 `@Roles` 게이트·Re-run
  `RR-PL-06`(워크스페이스 owner/admin 검사)이 이 diff 로 변경되지 않았다.
- **URL/페이지네이션 영향 없음**: 새/변경된 엔드포인트나 경로 파라미터, 목록 API 의 페이지네이션
  파라미터는 이번 diff 범위에 없다.
- **에러 응답 형식 무변경**: `reRun` 의 기존 `400 INVALID_INPUT`/`409 RERUN_CHAIN_DEPTH_EXCEEDED`
  에러 shape 는 이 PR 로 건드려지지 않았다.

## 요약

이 PR 의 핵심은 API 계약 관점에서 **`Execution.inputData` REST 응답의 콘텐츠 시맨틱을 원문에서
마스킹으로 반전**시킨 것이다. 스키마(OpenAPI type)는 안 바뀌어 자동 검증으로는 드러나지 않는
breaking 변경이지만, 이미 CHANGELOG 로 공지되고 트래커(`spec-sync-external-interaction-api-gaps.md`
342행)에 "외부 소비자 확인 + release-notes breaking 표시" 로 후속 조치가 명문화돼 있어 이번 PR
자체를 막을 사유는 아니다. 두 번째 축인 `inputOverride` 의 서버측 마커 리터럴 미검증도 이 PR
이전부터 존재하던 요청 검증 갭이고(재현 확인·`re-run.dto.ts` 자체는 이번 diff 로 변경되지
않음), CHANGELOG 가 스스로 범위를 "UI 정상 흐름 한정" 으로 좁혀 밝혔고 트래커에 등재돼 있다.
응답 형식 일관성·에러 형식·URL/페이지네이션·인가는 이번 diff 로 영향받지 않았다. 두 WARNING 모두
새로 만들어진 결함이 아니라 기존/추적 중인 사안의 확인적 재기재이므로, 전체 위험도는 낮게
평가한다.

## 위험도

LOW

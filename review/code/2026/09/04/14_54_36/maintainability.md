# 유지보수성(Maintainability) 리뷰

## 개요

이번 변경은 응답 DTO 83개 필드에 대해 `@ApiPropertyOptional({ nullable: true }) field?: T | null` →
`@ApiProperty({ nullable: true }) field: T | null` 로 바꾸는 **기계적이고 반복적인** 패턴 변경(20개
DTO 파일)과, 그 배경을 설명하는 `CHANGELOG.md` 항목 1건, `plan/in-progress/spec-draft-nullable-notation-followups.md`
체크리스트 갱신 1건으로 구성된다. 실질 로직 변경은 없고 OpenAPI 데코레이터 + TS 옵셔널 마커만 바뀐다.

## 발견사항

- **[INFO]** 반복적인 데코레이터/타입 변경(83개 필드, 20개 파일)이지만 "중복 코드"로 볼 사안은 아님
  - 위치: 예) `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:25-26`,
    `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:19-20` 등 20개 파일 전반
  - 상세: 각 필드는 서로 다른 도메인 개념을 나타내는 별개 선언이며, 텍스트 형태만 유사하다(전형적 DRY
    위반과는 다름). 적용 결과를 전수 확인한바 **일관되게** 올바르게 적용됐다 — 진짜 옵셔널(키 생략)
    필드는 정확히 배제됐다: `WaitingContextBaseDto.conversationThread?`
    (`codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:67`,
    present-when-available 관례라 `?` 유지), `NodeExecutionSummaryDto.nodeLabel?`
    (`codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:148`),
    `WorkspaceSettingsDto.timezone?`/`maxConcurrentExecutions?`
    (`codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:52,61`),
    `TriggerDto.cronExpression?`/`timezone?`(schedule 타입 트리거에만 채워짐) 등.
  - 제안: 조치 불요. 향후 동일 규모의 일괄 데코레이터 변경이 또 필요해지면(§5.4 drift 잔여 요청측 21곳 등)
    수작업 대신 codemod(ts-morph 등)로 전환하면 리뷰 부담이 줄어들 것 — 다만 이번 PR 자체의 결함은 아니다.
- **[INFO]** import 정리가 파일별로 정확히 조건부 처리됨
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:1`
    (다른 파일들과 달리 `ApiPropertyOptional` import 를 유지)
  - 상세: `ApiPropertyOptional` 을 더 이상 쓰지 않는 파일은 import 를 제거했고(예: `alert-rule-response.dto.ts`,
    `folder-response.dto.ts`, `workspace-response.dto.ts` 등), 파일 내 다른 필드(`ExportWorkflowDto` 아님,
    `GraphWarningResultDto.params?`)에서 여전히 쓰는 `workflow-response.dto.ts` 는 import 를 남겼다.
    `grep` 으로 실사용을 확인해 unused-import 는 없다.
  - 제안: 없음 — 정상.
- **[INFO]** `CHANGELOG.md` 신규 항목의 서술 밀도가 높음(변경 요약 + 판단 실수 정정 서사가 혼재)
  - 위치: `CHANGELOG.md:3-37` (`## Unreleased — 응답 DTO 83곳의 ...`)
  - 상세: "이 배치를 등재할 때 '판정이 기계화되지 않는다' 고 적었다 — **틀렸다**" 같은 자기 정정 서술이
    "무엇이 바뀌었는가" 설명과 섞여 있어, 변경 사항만 빠르게 훑으려는 독자에게는 다소 길다. 다만
    같은 파일의 기존 항목들(`:38`, `:87`, `:108` 등)도 동일하게 상세 서사형 포맷을 취하고 있어 **이
    저장소의 기존 CHANGELOG 컨벤션과 일치**한다 — 이번 PR 이 새로 만든 비일관성은 아니다.
  - 제안: 조치 불요(기존 컨벤션 준수). 컨벤션 자체를 바꾸고 싶다면 별도 논의 필요.

## 요약

83개 필드 × 20개 DTO 파일에 걸친 대규모 diff 이지만, 실질은 `@ApiPropertyOptional`→`@ApiProperty` +
`field?:`→`field:` 로 좁혀지는 **단일 패턴의 기계적 치환**이며 함수 길이·중첩·복잡도·매직 넘버 등
전형적 유지보수성 위험 축과는 무관하다. 전수 대조 결과 예외 처리(진짜 optional 필드 배제, import
정리)가 모든 파일에서 일관되게 이뤄졌고, 규모에 비해 리뷰 위험이 낮다. `CHANGELOG.md`/plan 문서의
서술은 장문이지만 기존 저장소 관례와 일치한다. 유지보수성 관점에서 우려할 결함은 발견되지 않았다.

## 위험도

NONE

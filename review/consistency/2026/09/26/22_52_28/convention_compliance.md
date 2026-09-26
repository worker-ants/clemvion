### 발견사항

- **[WARNING]** 통합(Integration) API 실패 응답 포맷이 SoT 와 다르게 서술됨
  - target 위치: `spec/2-navigation/4-integration.md` §9.4 "공통 응답 포맷" (라인 889-892), `- 실패: `{ code, message, details? }``
  - 위반 규약: `spec/5-system/2-api-convention.md` §5.3 "에러 응답" (에러 봉투는 `{ error: { code, message, requestId, details? } }` 형태 — `error` 키로 감싸고 `requestId` 를 항상 포함), 그리고 `error-codes.md` §Overview 가 지목하는 "응답 봉투(envelope) 형식" SoT
  - 상세: 이 절은 성공 응답은 "(기존 컨벤션 준수)"라고 정확히 적으면서, 실패 응답은 top-level `error` 래퍼와 `requestId` 필드 없이 평평한 `{ code, message, details? }` 로 서술한다. 실제 구현(`codebase/backend/src/common/filters/http-exception.filter.ts`)은 `{ error: { code, message, requestId, details } }` 를 반환하고 있어(전역 `GlobalExceptionFilter`), 코드와도 어긋난다. `spec/2-navigation/` 의 다른 문서들(`1-workflow-list.md`, `2-trigger-list.md`, `9-user-profile.md` 등)은 모두 이 SoT 절을 정확히 인용하거나 실제 envelope 을 정확히 반영하는데, 이 문서만 국소적으로 구식/오기 서술을 담고 있다. `status: partial`(실사용 중인 기능)이라 misleading 위험이 있다.
  - 제안: `- 실패: { error: { code, message, requestId, details? } }` (또는 `spec/5-system/2-api-convention.md#53-에러-응답` 링크로 대체)로 정정. 이 페이지 아래 나열된 각 코드(`INTEGRATION_IN_USE` 등)는 그대로 `error.code` 값으로 재해석하면 된다.

- **[INFO]** 마켓플레이스(backlog) API 표의 `DELETE .../uninstall` 이 나머지 문서군의 관례와 다름
  - target 위치: `spec/2-navigation/8-marketplace.md` §3 API, `DELETE /api/marketplace/items/:id/uninstall`
  - 위반 규약: 명시적 conventions 파일이 강제하는 규칙은 아니며, `spec/2-navigation/**` 전반이 일관되게 쓰는 "동작(verb)-suffix 는 POST" 패턴(`POST .../install`, `POST .../rotate`, `POST .../revoke`, `POST .../rotate-bot-token` 등)과의 스타일 불일치 지적.
  - 상세: 나머지 모든 action-verb 서브경로(예: `/install`, `/rotate`, `/revoke-token`, `/reauthorize`)는 POST 를 쓰는데 이 표만 DELETE + action-verb(`/uninstall`)를 섞는다. `status: backlog`, `code: []` 로 아직 구현 의도가 확정되지 않은 placeholder 라 구속력은 낮다.
  - 제안: 실제 구현 착수 시 `POST .../uninstall` 또는 `DELETE /api/marketplace/my-installations/:id` 형태로 정리 권장(지금 당장 수정을 요구하는 수준은 아님).

- **[INFO]** 그 외 구조·명명 규약은 전반적으로 정확히 준수됨 (참고용, 조치 불필요)
  - `spec/2-navigation/**` 개별 문서는 `_product-overview.md`(§Overview 역할) → 본문 → `## Rationale` 3섹션 패턴을 일관되게 따르며, `6-config.md` 만 로컬 `## Overview (제품 정의)`를 명시적으로 추가로 갖는데 이는 CLAUDE.md·spec-impl-evidence.md 어디에도 어긋나지 않는다.
  - 에러 코드는 전부 `UPPER_SNAKE_CASE`이고 `error-codes.md` 카탈로그(§3 historical-artifact, §4 내부 분류)와 정확히 대조 확인됨(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED`, `INVALID_FIELD` 등).
  - DTO 명명은 swagger.md §1-7 (`Update` 접두는 top-level 요청 바디에만)과 §5-1(응답 DTO 고유성)에 위배되는 사례가 target 문서 텍스트 안에서는 발견되지 않음(`UpdateWorkflowDto`, `UpdateMeDto` 만 등장, `Patch*Dto` 없음).
  - `secret-store.md` 의 `secret://<scope>/<resourceId>/<name>` 네이밍(`bot-token`, `inbound-signing`)과 `2-trigger-list.md`의 `botTokenRef`/`inboundSigningRef` 서술이 정합.
  - `spec/2-navigation/1-workflow-list.md` §3.2 는 `spec_impact: none` 으로 진행 중인 `plan/in-progress/export-workflow-typed.md`(`ExportedNodeDto`/`ExportedEdgeDto` 신설 계획)와 충돌하지 않으며, 계획된 DTO 설계(§1-4 열린 map/닫힌 enum 구분, §1-6 nullable 처리)도 swagger.md 규약과 부합한다.

### 요약
`spec/2-navigation/` 은 전반적으로 `spec/conventions/**` 를 매우 정밀하게 준수하고 있으며(에러 코드 명명, DTO 명명, 페이지네이션/부재-표현 규약, secret 참조 네이밍 등 다수 항목이 정확히 SoT 를 인용), 이번 `--impl-prep` 검토에서 발견된 실질 문제는 `4-integration.md` §9.4 의 실패 응답 포맷 서술이 `api-convention.md §5.3` 의 실제 envelope(`{ error: { code, message, requestId, details } }`)과 어긋나는 국소적 문서 drift 하나뿐이다(코드 자체는 정상 동작). 그 외 `8-marketplace.md` 의 `DELETE .../uninstall` 은 backlog 단계의 사소한 스타일 불일치로 조치 시급성이 낮다. 지금 진행 예정인 `export-workflow-typed` 작업 범위(`1-workflow-list.md` §3.2)에는 규약 위반이 없어 구현 착수를 막을 사유는 없다.

### 위험도
LOW

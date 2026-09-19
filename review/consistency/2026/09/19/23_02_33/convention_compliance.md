# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-prep)

## 검토 범위

본 검토는 `--impl-prep` 번들에 실제 본문이 포함된 3개 파일을 대상으로 한다 (나머지 15개
파일은 컨텍스트 예산 초과로 본문이 생략되어 검토 불가 — "내용 없음"의 근거로 삼지 않음):

- `spec/2-navigation/1-workflow-list.md`
- `spec/2-navigation/2-trigger-list.md`
- `spec/2-navigation/3-schedule.md`

대조 대상 정식 규약은 `spec/conventions/**`(특히 `error-codes.md` · `audit-actions.md` ·
`swagger.md` · `secret-store.md` · `chat-channel-adapter.md` · `egress-masking.md` ·
`migrations.md` · `i18n-userguide.md` · `frontend-layering.md`)와, 각 규약이 SoT 를 위임하는
`spec/5-system/2-api-convention.md`(URL 구조·상태 토글·페이지네이션·부재 표현)를 실제
저장소 원본 파일에서 직접 대조했다.

## 발견사항

검토 관점 5가지(명명 규약·출력 포맷 규약·문서 구조 규약·API 문서 규약·금지 항목) 전체에서
**CRITICAL/WARNING 급 위반을 발견하지 못했다.** 아래는 실제로 대조한 항목과 그 결과다.

### 1. 명명 규약 — 대조 결과: 준수

- **에러 코드**: 문서가 쓰는 `VALIDATION_ERROR` · `RESOURCE_CONFLICT` · `TRIGGER_ENDPOINT_PATH_CONFLICT` ·
  `DUPLICATE_NODE_LABEL` · `AUTH_CONFIG_NOT_FOUND` · `BOT_TOKEN_INVALID` · `RESOURCE_NOT_FOUND` 전부
  `UPPER_SNAKE_CASE`([`error-codes.md` §1](../../../../../../../spec/conventions/error-codes.md))를
  따르고, 전부 `spec/5-system/3-error-handling.md` 중앙 카탈로그에 **이미 등재**돼 있음을
  grep 으로 확인했다(예: `TRIGGER_ENDPOINT_PATH_CONFLICT` 88행/238행, `AUTH_CONFIG_NOT_FOUND`
  252행, `BOT_TOKEN_INVALID` 285행). `details.field`/`details.code`(`INVALID_FIELD`) 표기도
  `3-error-handling.md` §2.1 의 표기와 문자 그대로 일치한다.
- **감사 액션**: `trigger.deleted` · `trigger.notification_secret_rotated` ·
  `trigger.chat_channel_bot_token_rotated` · `trigger.interaction_token_revoked` 는
  `audit-actions.md` §3 레지스트리의 등재 값과 정확히 일치(`<resource>.<verb>` + 과거분사 +
  언더스코어 토큰 구분).
- **DTO 명명**: `UpdateWorkflowDto` · `ExportWorkflowDto` · `WorkflowSettingsDto` ·
  `TriggerDto` 는 `swagger.md §1-7` 의 "top-level 요청 바디만 `Update` 접두" 규칙과 일치한다
  — `WorkflowSettingsDto` 는 nested 필드라 접두를 붙이지 않은 것이 규칙대로다.
- **Secret ref 스킴**: `secret://triggers/{id}/bot-token` 계열 예시와 `deleteByPrefix` 호출
  패턴은 `secret-store.md §1/§2.1` 의 URI scheme·행 삭제 커밋 후 정리 순서와 문자 그대로
  일치한다.
- **패키지명**: `@workflow/chat-channel-validation` 은 실제
  `codebase/packages/chat-channel-validation/package.json` 의 `name` 필드와 일치.
- **UI enum 값**: `formMode`(`multi_step`/`native_modal`/`auto`) · `visualNode`(`text`/`photo`/`auto`) ·
  `buttonLayout`(`auto`/`vertical`/`horizontal`) 은 `chat-channel-adapter.md` §2.3/§4 의 실제
  타입 선언과 정확히 일치한다.

### 2. 출력 포맷 규약 — 대조 결과: 준수

- **PATCH 단일 경로 + Boolean 토글**: `PATCH /api/triggers/:id { isActive }`(R-4)와
  `PATCH /api/schedules/:id { isActive }` 는 `2-api-convention.md §2.2` "**Boolean 상태 필드의
  단순 토글에는 [§12.1] 이 `PATCH /:id { field: value }` 를 규정하며 `POST /:id/activate` 류
  전용 엔드포인트를 금지**"를 정확히 따르며, `/toggle` 서브경로를 명시적으로 미채택한 이유까지
  Rationale 에 남겨 규약 근거와 일치시켰다.
- **RPC-style sub-channel 예외**: `/api/triggers/:id/notification/rotate-secret` ·
  `/api/triggers/:id/interaction/revoke-token` ·
  `/api/triggers/:id/chat-channel/rotate-bot-token` 는 `2-api-convention.md §2.2` 의 예외 규정에
  적힌 **동일한 예시**와 그대로 일치한다(규약이 이 문서를 인용해 만들어진 관계로 보임).
- **자원 액션**: `POST /api/workflows/:id/duplicate` · `POST /api/schedules/:id/run-now` 도
  §2.2 "자원 액션"(동사) 규칙 및 예시와 일치.
- **페이지네이션 참조**: `GET /api/workflows` · `GET /api/triggers` · `GET /api/schedules` 목록
  응답 전부 "`API 규약 §5.2` 준수"로 정확히 링크되어 있고, 해당 앵커(`52-목록-응답`)는 실제
  `2-api-convention.md` 의 `### 5.2 목록 응답` 헤딩과 일치한다(슬러그 오류 없음).
- **부재 표현(§5.4)**: `TriggerDto.workflow` · `ScheduleDto.trigger.workflow` 를 "키 생략형"
  으로 선언하며 `§5.4 기준 (b)` 를 명시 인용 — swagger.md 의 `@ApiPropertyOptional` vs
  `@ApiProperty({nullable:true})` 구분 원칙과 상충하지 않는다(값이 실제로 응답에서 빠지는
  케이스이므로 optional 선언이 맞다).
- **writeOnly/readOnly**: `botToken`/`inboundSigningPlaintext` 를 "write-only" 로,
  `hasBotToken`을 "응답 전용/derived" 로 서술한 것은 `swagger.md §1-5` 의 의무 사항과 정확히
  일치한다.
- **secret ref 비노출**: "내부 ref(`botTokenRef`, `inboundSigningRef`)는 사용자에게 노출하지
  않음" 서술은 `secret-store.md §1.1` "비대상 필드도 응답 바디에는 나가지 않는다"와 일치한다.

### 3. 문서 구조 규약 — 대조 결과: 준수 (영역 관행과 일치)

- 세 파일 모두 frontmatter(`id`/`status`/`code`/`pending_plans`) → 본문(번호 섹션) →
  `## Rationale` 구조를 따른다. `## Overview` 헤딩이 명시적으로 없으나, 이는 대상 파일만의
  일탈이 아니라 **`spec/2-navigation/` 영역 형제 문서(`4-integration.md` 등)의 기존 관행과
  동일**하다(직접 확인: `4-integration.md` 도 `## Overview` 없이 `## 1. 라우트 구성`부터
  시작해 `## Rationale`로 끝남). 즉 이 폴더의 정착된 스타일이며 target 만의 신규 이탈이
  아니다.
- `pending_plans` 필드는 `spec-impl-evidence.md §2.1` 스키마(`status: partial` 시 의무, 경로가
  `plan/in-progress/` 또는 `plan/complete/` 에 실존)를 만족한다 — 실제로
  `plan/in-progress/marketplace-and-plugin-sdk.md` · `plan/complete/workflow-duplicate-nodes-edges.md` ·
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 모두 존재를 확인했다. 두 plan
  중 하나만 `complete/`로 이동한 상태에서 `status: partial` 을 유지하는 것도 §3.1 전이 규칙(모든
  `pending_plans` 가 `complete/` 로 이동해야 `implemented` 승격)과 일치한다.
- `3-schedule.md`(`status: implemented`)는 `pending_plans` 를 두지 않아 §3 라이프사이클 표
  ("`implemented` → 없음")와 일치한다.

### 4. API 문서 규약 — 대조 결과: 준수 (spec 서술 수준에서)

본 문서는 실제 `*.dto.ts`/`*.controller.ts` 코드가 아니라 spec 이므로 데코레이터 자체를
검사할 수는 없으나, 코드 명명·필드 성격에 대한 spec 상 서술이 `swagger.md`의 규칙과
어긋나지 않는지 확인했다 — 위 §1·§2 참조. 하나 짚어둘 점(경계 사례, WARNING 아님):

- **INFO** — `ExportWorkflowDto.formatVersion` 선언-미발행 격차
  - target 위치: `1-workflow-list.md` §3.2 "⚠️ Swagger 응답 DTO(`ExportWorkflowDto`)는
    `formatVersion` 필드를 선언하지만... emit 하지 않는다"
  - 위반 규약: 명시적으로 위반하는 규약은 없음(swagger.md 는 optional 필드가 항상 비어
    있는 경우를 금지하지 않는다) — 참고로만 남긴다.
  - 상세: 이것은 규약 위반이라기보다 spec-impl 갭(별도 축, `spec-impl-evidence.md`/
    `/spec-coverage` 관할)이며, target 이 이를 "미구현 (Planned)"으로 스스로 정직하게
    표시하고 있어 오히려 모범적이다.
  - 제안: 조치 불필요. 정식 규약 준수 관점에서는 반영하지 않아도 됨.

### 5. 금지 항목 — 대조 결과: 위반 없음

- `Patch` 접두 DTO, `additionalProperties`로 뭉갠 닫힌 union, 엔티티 패스스루 응답, `/toggle`
  전용 엔드포인트, lowercase 에러 코드 신설 등 conventions 가 명시적으로 금지하는 패턴 중
  target 문서에서 재현된 것은 없다.

## 요약

`spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` (impl-prep,
본문 포함 3개 파일)를 `spec/conventions/`(error-codes·audit-actions·swagger·secret-store·
chat-channel-adapter 등)와 이들이 위임하는 `5-system/2-api-convention.md` 원본에 대조한 결과,
에러 코드 표기·감사 액션 명명·DTO 명명(Update 접두 범위)·secret ref 스킴·API 자원 액션/
RPC-style 예외·Boolean 토글 패턴(PATCH 단일 경로)·페이지네이션 참조·부재 표현(§5.4)·
writeOnly/readOnly 지정·문서 frontmatter(`pending_plans` 존재·상태 전이) 전 항목에서 정식
규약과 문자 그대로 일치했다. `## Overview` 헤딩 부재는 `spec/2-navigation/` 영역의 기존
형제 문서와 동일한 정착된 스타일이라 target 고유의 이탈이 아니다. CRITICAL·WARNING 급
발견사항은 없으며, INFO 1건(spec-impl 갭 성격의 참고 사항)만 기록했다. 다만 컨텍스트 예산
초과로 본문이 생략된 15개 파일(`4-integration.md`·`6-config.md`·`_product-overview.md` 등)은
이번 검토의 범위 밖이며, 별도로 직접 열어 확인이 필요하다.

## 위험도

NONE

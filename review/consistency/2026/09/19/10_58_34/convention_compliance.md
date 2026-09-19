# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: `--impl-prep` (구현 착수 전 검토)
대조 규약: `spec/conventions/error-codes.md` · `spec/conventions/swagger.md` · `spec/conventions/audit-actions.md` · `spec/5-system/2-api-convention.md` (§2 URL 명명 규칙은 conventions 로 격상되지 않았으나 error-codes.md 가 그 SoT 로 지목하는 문서라 함께 대조)
전량 열람: `1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` (prompt bundle 전문) — 나머지 14개 파일은 prompt 예산 절단으로 `Read` 로 원본을 직접 열어 표적 대조(에러 코드·DTO·엔드포인트 명명 위주). 문서 구조(Overview/본문/Rationale) 는 17개 파일 전수 `grep` 확인.

## 발견사항

- **[CRITICAL]** `IntegrationTestResult.code` 에 lower_snake_case 값 3종이 UPPER_SNAKE_CASE 규약을 어긴다
  - target 위치: `spec/2-navigation/4-integration.md` §5.4 Database (line 490) — "테스트: 연결 후 `SELECT 1` 실행. 실패 시 드라이버별 에러 메시지를 `error.code`에 정규화(`auth_failed`, `network`, `unknown_error`)."
  - 위반 규약: `spec/conventions/error-codes.md` §1 "의미 기반 명명" 표기 규율(SoT 는 `3-error-handling.md §3.2`/`node-output.md §3.2` 이나 error-codes.md 가 "**프로젝트 전체의 에러 코드 문자열**"(인라인 리터럴 포함)에 적용된다고 명시) — 값은 `UPPER_SNAKE_CASE` 여야 하며, 예외는 §3 historical-artifact 레지스트리에 **명시 등록된 것만** 허용된다.
  - 상세: 바로 15줄 아래 §5.5 Email(SMTP) (line 505) 이 **같은 필드**(`IntegrationTestResult.code`)를 설명하며 "값 형식은 동일 UPPER_SNAKE_CASE" 라고 스스로 못박고, 실제 예시로 `EMAIL_CONNECT_FAILED`·`EMAIL_HOST_BLOCKED` 를 든다. §5.4 는 같은 "테스트: …" 서술 패턴(§5.1~§5.9 전 서비스 공통)을 쓰면서도 정작 가장 가까운 형제 절과 반대 케이스(lower_snake_case: `auth_failed`/`network`/`unknown_error`)를 제시해, **문서 내부에서 자기 모순**이 난다. 세 값 모두 error-codes.md §3 예외 레지스트리(초대 흐름·OAuth redirect 등)에 없는 새 값이며, 저장소 실측(`grep`)으로도 DB 드라이버 커넥션 테스트 코드는 아직 구현되지 않았다 — 즉 이 spec 이 그대로 구현되면 처음부터 규약 위반 코드가 wire 로 나가고, 이후 error-codes.md §2 "rename 은 breaking change" 정책 때문에 되돌리기 비용이 커진다. 참고로 같은 `Integration` 엔티티의 `statusReason` 컬럼(`auth_failed`/`unknown_error` 등, `integration-status-reason.ts`)은 이미 구현된 **별개의 정당한 lower_snake_case 필드**이지만, §5.4 가 명시적으로 "`error.code`" 라고 지목하고 있어 그 필드와 혼동한 것이 아니라 `IntegrationTestResult.code` 를 가리키는 것으로 읽힌다 — 두 필드를 섞어 썼다면 그 자체가 별도의 명명 혼선이다.
  - 제안: §5.4 를 예: `DB_AUTH_FAILED` / `DB_NETWORK_ERROR` / `DB_UNKNOWN_ERROR` (또는 §5.5 의 `EMAIL_*` 접두 패턴과 맞춰 `DATABASE_*`) 로 UPPER_SNAKE_CASE + 도메인 prefix 로 정정한다. `MCP_CONNECT_FAILED`/`EMAIL_CONNECT_FAILED` 계열과 이름 형태를 맞추면 `IntegrationTestResult.code` 네임스페이스 전체가 다시 한 가지 케이스 컨벤션으로 통일된다. 구현 전이므로 정정 비용은 이 스펙 문구 3개 토큰뿐이다.

- **[INFO]** `Cafe24PrecheckResultDto` 가 MakeShop precheck 엔드포인트 응답 스키마로도 재사용된다 — 스펙 텍스트는 그 사실을 언급하지 않는다
  - target 위치: `spec/2-navigation/4-integration.md` §9.2 — `GET /api/integrations/makeshop/precheck` 행 ("응답 shape 은 `cafe24/precheck` 와 동형")
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "같은 개념을 층별로 나눠 선언해야 할 때는 이름을 다르게 둔다" 취지 — 직접적인 금지 조항 위반은 아니나(내용이 진짜로 동일하면 재사용 자체는 swagger.md 가 막지 않음), 클래스명이 `Cafe24*` 인 스키마가 OpenAPI `components.schemas` 에 MakeShop 엔드포인트 응답으로도 등록되면 문서 소비자가 provider 전용 타입으로 오독할 수 있다.
  - 상세: 실제 컨트롤러(`integrations.controller.ts`)가 `makeshop/precheck` 에도 `@ApiOkWrappedResponse(Cafe24PrecheckResultDto, …)` 를 그대로 붙여 쓰고 있다(기존 구현, 이번 spec 변경이 새로 만든 것은 아님). spec 문서가 "동형(isomorphic)" 이라고만 적어 이 재사용 사실 자체를 감춘다.
  - 제안: 이미 구현된 기존 drift 라 이번 --impl-prep 범위의 신규 작업 차단 사유는 아니다. 다만 §9.2 문구에 "`Cafe24PrecheckResultDto` 를 공유(provider 무관 공용 shape)한다" 는 한 줄을 추가하거나, 후속 PR 에서 `IntegrationPrecheckResultDto` 로 provider-neutral 개명을 검토할 근거로 남겨 둔다.

## 검토했으나 위반 아님 (명시적으로 남김 — 오탐 방지)

- **`isActive` 토글**: `PATCH /api/triggers/:id { isActive }` / `PATCH /api/schedules/:id { isActive }` 모두 `/toggle` 서브라우트를 명시적으로 미채택 — `api-convention.md §12.1`(및 §2.2 자원 액션 행의 "Boolean 상태 필드 단순 토글에는 적용 안 함") 준수.
- **RPC-style sub-channel 액션**: `/api/triggers/:id/chat-channel/rotate-bot-token` · `/notification/rotate-secret` · `/interaction/revoke-token` 은 `api-convention.md §2.2` 예외 항목에 **example 로 직접 열거**된 패턴과 문자 그대로 일치.
- **`details.field='endpoint_path'` (snake_case)**: `2-trigger-list.md §3` 이 쓰는 이 표기는 새로 도입된 것이 아니라 `5-system/3-error-handling.md §1.10`·`2-api-convention.md §5.3` 이 이미 SoT 로 확정한 기존 표기를 그대로 미러링한 것 — target 문서의 신규 위반이 아니다.
- **Audit action 명명**: `trigger.deleted/updated`, `trigger.notification_secret_rotated`, `trigger.chat_channel_bot_token_rotated`, `trigger.interaction_token_revoked`, `schedule.created/updated/deleted` 전부 `conventions/audit-actions.md` §3 레지스트리와 1:1 일치.
- **DTO 명명**: `UpdateWorkflowDto`/`WorkflowSettingsDto` 등은 `swagger.md §1-7` 의 "Update 접두는 top-level 요청 바디에만" 규칙과 정합. `Patch*Dto` 패턴(금지)은 저장소·target 문서 어디에도 없음.
- **문서 구조(3섹션)**: `spec/2-navigation/` 17개 파일 전수 `grep` 결과 `_product-overview.md` 를 제외한 16개 파일 모두 정확히 1개의 `## Rationale` 섹션 보유. `_product-overview.md` 는 다중-파일 영역의 Overview 전담 문서라 Rationale 부재가 정상(project-planner SKILL.md §Spec 문서 구조 규칙과 일치).
- **에러 코드 표기 전반**: `4-integration.md` 내 `CAFE24_*`/`OAUTH_*`/`MCP_CONNECT_FAILED`/`EMAIL_*` 등 나머지 전 코드, `2-trigger-list.md`/`3-schedule.md`/`1-workflow-list.md` 의 `VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`DUPLICATE_NODE_LABEL`/`TRIGGER_ENDPOINT_PATH_CONFLICT`/`BOT_TOKEN_INVALID`/`INVALID_FIELD` 등은 전부 UPPER_SNAKE_CASE 이며 위 §5.4 건 외 이탈 없음. `10-auth-flow.md` 의 OAuth callback `lower_snake_case` 는 error-codes.md §3 에 이미 등록된 예외를 정확히 인용.
- **sort/order 쿼리 파라미터**: workflow/trigger/schedule 목록 API 모두 `api-convention.md §4.1` 의 `sort`/`order` 명명과 예시값(`created_at`)을 그대로 따름.

## 요약

전량 열람한 3개 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)은 에러 코드 표기·DTO 명명·감사 액션 명명·API 엔드포인트 명명(RPC-style 예외 포함)·문서 3섹션 구조 전 영역에서 정식 규약과 정합했고, 특히 `/toggle` 미채택·RPC sub-channel 액션 등 과거 결정 사안을 Rationale 로 정확히 근거를 남겨 두는 등 규약 준수 의식이 높았다. 유일한 실질 위반은 prompt 예산 절단으로 별도 `Read` 대조가 필요했던 `4-integration.md` §5.4 에서 발견됐다 — DB 통합의 연결 테스트 실패 코드(`auth_failed`/`network`/`unknown_error`)가 error-codes.md §1 UPPER_SNAKE_CASE 규율을 어기며, 15줄 아래 형제 절(§5.5)이 명시한 "같은 필드는 UPPER_SNAKE_CASE" 라는 자기 선언과도 모순된다. 아직 미구현 상태라 --impl-prep 게이트가 정확히 잡아야 할 사례이며, 수정 비용은 세 토큰의 케이스 변경뿐이다. 부수적으로 `Cafe24PrecheckResultDto` 의 MakeShop 재사용(기존 구현, 이번 변경 범위 밖)을 INFO 로 남긴다.

## 위험도

MEDIUM

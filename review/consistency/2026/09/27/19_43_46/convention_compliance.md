# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: `--impl-prep` (scope=`spec/2-navigation/`, 관련 작업: `plan/in-progress/cross-workspace-refs.md`)

## 검토 범위상 제약 (먼저 명시)

프롬프트 번들이 컨텍스트 예산 초과로 `spec/2-navigation/` 18개 파일 중 **3개**
(`1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md`)만 전문을 포함했고, 나머지 15개
(`4-integration.md`, `5-knowledge-base.md`, `6-config.md`, `8-marketplace.md`, `9-user-profile.md`,
`14-execution-history.md`, `_product-overview.md`, `0-dashboard.md`, `7-statistics.md`,
`10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `15-system-status.md`,
`16-agent-memory.md`, `_layout.md`)는 "본문 생략됨" 플레이스홀더만 받았다. 아래 판정은 **전문을
받은 3개 파일**에 대한 것이며, 나머지 15개 파일의 정식 규약 준수 여부는 이번 라운드에서
검증되지 않았다 — "발견사항 없음" 을 "규약 위반 없음" 으로 일반화하지 말 것.

이 세 파일이 이번 impl-prep 의 실제 관련 영역(워크플로/폴더/트리거/스케줄의 요청 본문 참조
id — `plan/in-progress/cross-workspace-refs.md`)과 정확히 겹치므로, 범위는 좁지만 관련성은
높다.

---

## 발견사항

이번 라운드에서 `spec/conventions/**` 대비 **CRITICAL/WARNING 위반은 발견되지 않았다.** 아래는
검증한 항목과 INFO 성격의 관찰이다.

### 검증해 통과한 주요 항목 (준거 규약)

- **Swagger DTO 명명 (§1-7, `Update` 접두 범위)** — `UpdateWorkflowDto`(top-level 요청 바디, 접두
  ✓) vs `WorkflowSettingsDto`(nested 필드, 로컬 패턴, 접두 없음 ✓) 가 `swagger.md §1-7` 의 구분을
  정확히 따른다. `ExportWorkflowDto`(응답 전용) · `TriggerDto` · `ScheduleDto` 도 명명 패턴에
  부합. target 위치: `1-workflow-list.md` §3.2 (`UpdateWorkflowDto`/`WorkflowSettingsDto` 언급부).
- **에러 코드 표기·형태 (`error-codes.md` §1, `api-convention.md §5.3`)** — `VALIDATION_ERROR` /
  `RESOURCE_CONFLICT` / `TRIGGER_ENDPOINT_PATH_CONFLICT` / `DUPLICATE_NODE_LABEL` /
  `BOT_TOKEN_INVALID` / `AUTH_CONFIG_NOT_FOUND` / `INVALID_FIELD` 모두 `UPPER_SNAKE_CASE` 이며,
  `details.field` + `details.code='INVALID_FIELD'` 조합은 `api-convention.md` "「field 를 실으면
  code 도 싣는다」" 규칙과 정확히 일치 (2-trigger-list.md §2.3.1 다수 행, 특히
  `inboundSigningPlaintext`/`botTokenRef`/`provider`/`chatChannel` 필드). 폐기된 코드
  (`LLM_CONFIG_NOT_FOUND`/`INVALID_INPUT`/`WORKSPACE_REQUIRED`/`INVALID_PASSWORD` 등,
  `error-codes.md §5`)는 3개 파일 어디에도 등장하지 않는다.
- **응답 wrapping / 페이지네이션 (`swagger.md §2-5`, `api-convention.md §5.2`)** — 워크플로·트리거·
  스케줄 목록 API 모두 "페이지네이션 응답 형식은 API 규약 §5.2 준수" 를 명시하고, `PATCH`
  토글은 세 파일 전부 "별도 `/toggle` 서브경로는 없다" 를 명시해 `api-convention.md §12.1
  상태 토글 패턴` (`PATCH /:id { field: value }`, 전용 토글 엔드포인트 금지)을 정확히 반영한다.
- **URL 명명 (`api-convention.md §2.2`)** — RPC-style sub-channel 액션
  (`/api/triggers/:id/chat-channel/rotate-bot-token`, `/notification/rotate-secret`,
  `/interaction/revoke-token`) 은 그 규약이 드는 예시와 **문자 그대로 동일**하다. `run-now` ·
  `preview` 등 자원 액션도 케밥케이스 동사(구) 규칙에 부합.
- **감사 액션 명명 (`audit-actions.md §3`)** — `trigger.chat_channel_bot_token_rotated` /
  `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` 가 레지스트리
  등재값과 정확히 일치 (2-trigger-list.md §3 API 표).
- **Chat Channel enum (`chat-channel-adapter.md §2.3`)** — `uiMapping.formMode`
  (`multi_step`/`native_modal`/`auto`) · `visualNode`(`text`/`photo`/`auto`) ·
  `buttonLayout`(`auto`/`vertical`/`horizontal`) 값 집합이 컨벤션 문서와 완전히 일치.
- **Secret Store 인용 (`secret-store.md §1.1`)** — `botToken` write-only 필드의 마스킹 미차용
  근거 인용(`2-trigger-list.md` §2.3.1 `botToken` 행)이 해당 앵커(`#11-비대상-필드도-응답-바디에는-나가지-않는다`)에
  정확히 착지.
- **i18n 키 (`i18n-userguide.md` Principle 1/2)** — `workflows.executionHistory` 키가 실제
  `dict/ko/workflows.ts` · `dict/en/workflows.ts` 에 ko/en parity 로 존재 (1-workflow-list.md
  §2.6).
- **문서 구조 (CLAUDE.md / `project-planner/SKILL.md` "3섹션")** — 세 파일 모두 본문(화면 구조→
  기능 상세→API)+`## Rationale` 로 끝나며, 영역 진입 `_product-overview.md` 로 제품 정의를
  분리하는 다중 파일 영역 패턴(`## Overview` 내장 대신 별도 파일)을 정확히 따른다.
  `_layout.md`·`_product-overview.md` 파일명도 명명 컨벤션(`project-planner/SKILL.md` "명명
  컨벤션")과 일치.

### INFO — 관찰 (규약 위반 아님, 참고용)

- **`GET /api/folders` 의 응답 envelope 형태 미기술** (`1-workflow-list.md` §3.1). 실제 컨트롤러는
  `ApiOkWrappedArrayResponse(FolderDto)` → `{ data: FolderDto[] }` (페이지네이션도, `{data:{items}}`
  비-페이징 고정 컬렉션 형태도 아닌 제3의 형태 — `swagger.md §5-2` 표에는 있으나
  `api-convention.md §5.2` 목록에는 이 형태가 명시적으로 열거되지 않는다). target 문서는 이
  envelope 형태를 언급하지 않는데, 같은 파일의 다른 목록 API(워크플로 목록)는 "페이지네이션
  응답 형식은 §5.2 준수" 를 명시한다 — 대칭을 맞추려면 폴더 목록 행에도 "비-페이징 배열,
  `swagger.md §5-2 ApiOkWrappedArrayResponse` 참고" 식의 한 줄을 추가할 수 있다. 다만 다른
  action-형 엔드포인트(예: `GET /api/schedules/:id/preview`)도 마찬가지로 envelope 형태를
  적지 않는 것이 이 문서군의 일반적 패턴이라, CRITICAL/WARNING 이 아니라 INFO 로 남긴다.

### 이 검토자의 범위를 벗어나지만 언급함 (참고 — 다른 검토 축 권장)

- **`1-workflow-list.md` §Rationale-3 의 서술이 코드와 어긋날 가능성** — 이 절은 "`(data-model
  §2.5)`의 '최대 깊이 5 / 같은 워크스페이스 / 비순환'은 폴더 생성뿐 아니라 PATCH 부모 변경에서도
  hard-fail 로 강제한다" 고 적어, 창조(create) 경로가 이미 "같은 워크스페이스" 를 강제한다고
  전제한다. 그런데 `codebase/backend/src/modules/folders/folders.service.ts` `create()` 를
  직접 읽으면 `getDepth(data.parentId, workspaceId)` 가 다른 워크스페이스의 `parentId` 에 대해
  `workspaceId` 조건에 안 걸려 `undefined` 를 반환하고, 이 경우 예외를 던지지 않고 그냥
  `depth=1` 로 취급해 생성이 **그대로 통과**한다 — 즉 create() 에는 "같은 워크스페이스" 검사가
  실제로 없다(이는 `plan/in-progress/cross-workspace-refs.md` 자신의 §전수 "(D)" 표가 `POST
  /api/folders`·`parentId` 를 "저장 전 검사가 없는 자리" 로 분류하고, §처방에서 "생성 경로에
  소속 검사를 더한다" 고 적어 스스로 확인한다). `1-data-model.md §2.5` 도 "parent_id 는 같은
  워크스페이스의 폴더만 가리킨다" 를 무조건 제약으로 서술한다. 이 항목은 `spec/conventions/**`
  위반이 아니라 **target 문서 대 구현의 사실 정합성** 문제라 이 검토자(정식 규약 준수)의 엄밀한
  범위 밖이지만, 같은 impl-prep 라운드에서 다른 검토 축(consistency-checker 의
  spec-impl 정합성)이 놓치면 안 되는 항목이라 표시해 둔다. 정정 방향은 이미 plan 의 §처방에
  있으므로 별도 대응은 필요 없고, spec 반영은 plan 이 명시한 대로 "planner 몫 → 트래커" 로
  남겨 두면 된다.

---

## 요약

전문을 받은 3개 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`) 은 DTO 명명
(`Update` 접두 범위), 에러 코드 표기·`details` 형태, 응답 wrapping·페이지네이션, 상태 토글
URL 패턴, RPC-style sub-channel 액션 명명, 감사 액션 명명, Chat Channel enum, secret-store
인용, i18n 키, 문서 3섹션 구조 등 점검한 전 항목에서 `spec/conventions/**` 를 정확히 따르고
있으며 CRITICAL/WARNING 급 위반은 없다. 다만 (1) 컨텍스트 예산 초과로 `spec/2-navigation/`
18개 중 15개 파일은 이번 라운드에 검증되지 않았고, (2) 폴더 생성 경로의 "같은 워크스페이스"
강제에 대한 target 문서의 서술이 실제 구현과 어긋날 가능성이 있으나 이는 정식 규약 위반이
아니라 사실 정합성 이슈로 별도 검토 축의 몫이다.

## 위험도

LOW

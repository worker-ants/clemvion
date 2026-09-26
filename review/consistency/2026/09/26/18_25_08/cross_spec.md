# Cross-Spec 일관성 검토 — rotate-bot-token-body (--impl-done)

## 검토 방법

target 프롬프트 번들은 컨텍스트 예산 초과로 대부분 절단되어 있어(diff 19,450자 포함 11개 파일
생략), 프롬프트 내용만으로는 판정할 수 없었다. 대신 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/rotate-bot-token-body`)에서
직접 `git diff origin/main...HEAD`(코드 실질 변경 10파일/457줄 중 review/plan 산출물을 뺀 코드
부분)와 관련 spec 원문(`spec/5-system/15-chat-channel.md` §5.4/§5.4.1, `spec/5-system/12-webhook.md`
WH-EP-04/05, `spec/3-workflow-editor/3-execution.md` `/continue` 계약, `spec/conventions/swagger.md`
§1-5/§1-7)을 절대경로로 읽어 대조했다. `plan/in-progress/rotate-bot-token-body.md` 와 선행
`--impl-prep` 검토(`review/consistency/2026/09/26/17_20_45/cross_spec.md`)도 대조군으로 확인했다.

이 PR 은 `spec_impact: none` — OpenAPI 문서(`@ApiBody`/`@ApiConsumes`)만 3개 라우트
(`triggers.rotateBotToken` · `executions.continueExecution` · `hooks.receiveWebhook`)에 추가하고
런타임 검증·계약은 바꾸지 않는 순수 문서화 PR이다. `spec/**` 델타는 실제로 0개 파일이며, 이는
정상이다(코드/문서 전용 PR).

## 발견사항

- **[INFO]** 선행 `--impl-prep` WARNING 2건 모두 구현에서 정확히 해소됨 (재확인, 조치 불필요)
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`
    · `codebase/backend/src/modules/triggers/triggers-rotate-bot-token-body.spec.ts`
  - 충돌 대상(당시 우려): `spec/5-system/15-chat-channel.md` §5.4 (`newBotToken` 필수 서술) ·
    같은 문서 frontmatter `code:` glob (`dto/**/chat-channel-*.dto.ts`, R-CC-22 재발 이력)
  - 상세: (1) `newBotToken: string`(TS 옵셔널 아님) + `@ApiProperty({ writeOnly: true })`(required
    기본값)로 선언되어, 렌더 캐너리(`schema.required === ['newBotToken']`)가 이를 고정한다 — §5.4
    가 서술하는 "누락 시 400 INVALID_BOT_TOKEN"(정책상 필수)과 이제 OpenAPI 문서도 정합한다.
    (2) 파일명이 `chat-channel-rotate-bot-token-request.dto.ts`로 응답 DTO(`.../responses/chat-channel-rotate-bot-token-response.dto.ts`)와
    대칭이라 `15-chat-channel.md` frontmatter glob 안에 들어간다 — R-CC-22 4번째 재발을 피했다.
  - 제안: 없음. 기록만.

- **[INFO]** `hooks.receiveWebhook` `@ApiConsumes`/`@ApiBody` 가 `12-webhook.md` WH-EP-04/05 와
  문구까지 정합
  - target 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` (`@ApiConsumes('application/json', 'application/x-www-form-urlencoded')`,
    `schema: {}`)
  - 충돌 대상: `spec/5-system/12-webhook.md` WH-EP-04(JSON/form-urlencoded 수신) · WH-EP-05(본문
    전체를 `body` 로 전달) · WH-EP-05-1(Manual Trigger 파라미터를 최상위 키에서 추출)
  - 상세: 새 `@ApiBody` description("전체가 실행 입력 `body` 로 실리고, Manual Trigger 파라미터는
    최상위 키에서 추출")이 WH-EP-05/05-1 문구를 그대로 미러링하고, `@ApiConsumes` 두 content-type
    이 WH-EP-04 의 "JSON, form-urlencoded" 와 정확히 일치. 스키마를 빈 `{}`(임의 값)로 둔 것도
    `swagger.md` §1-4 "진짜 열린 map" 예외에 해당(선행 검토가 이미 확인). 충돌 없음.
  - 제안: 없음.

- **[INFO]** `executions.continueExecution` 신규 DTO 가 `3-execution.md` `/continue` 계약과 일치
  - target 위치: `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts`
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md` L343 (`POST /api/executions/:id/continue` —
    폼 데이터 전달, 대기 상태 아니면 422 `INVALID_STATE`)
  - 상세: `formData?: Record<string, unknown>` + `@ApiBody({ required: false })` 가 spec 의 "폼
    데이터 전달"·선택적 본문 서술과 부합. 검증 책임(엔진의 대기 폼 노드 필드 정의)도 DTO 주석에
    정확히 반영되어 있고 class-validator 데코레이터를 의도적으로 생략한 근거(전역 파이프 진입 시
    계약 변경)도 `workflows.execute` 선례와 일관됨. 충돌 없음.
  - 제안: 없음.

- 그 외 확인한 축 — 데이터 모델·요구사항 ID(CCH-*)·상태 전이·RBAC(`@Roles('editor')` 등 기존
  데코레이터 미변경)·계층 책임(트리거/실행/훅 3개 모듈 경계 유지) 모두 이번 diff 에서 불변. 신규
  DTO 클래스명(`ChatChannelRotateBotTokenRequestDto`/`ContinueExecutionRequestDto`)은 `spec/**`
  어디에도 리터럴로 등장하지 않아(spec 은 endpoint/동작 단위로 서술) 이름 충돌 표면이 없고,
  저장소 전역 DTO 이름 유일성은 별도 repo-guard(`dto-class-name-collision.spec.ts`)가 커버한다.

## 요약

이 PR 은 3개 라우트의 OpenAPI 요청 본문 스키마를 추가하는 순수 문서화 변경(`spec_impact: none`)
이며, 실제 diff 를 spec 원문과 직접 대조한 결과 새로 광고되는 스키마(required/writeOnly 여부,
content-type, 선택 여부)가 `15-chat-channel.md` §5.4, `12-webhook.md` WH-EP-04/05,
`3-execution.md` `/continue` 계약과 모두 정합한다. 선행 `--impl-prep` 검토가 지적한 두 WARNING
(required 표기 누락 위험 · glob 이탈 위험)은 구현에서 정확히 해소되었고 렌더 캐너리로 고정되어
있다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 신규 Cross-Spec
충돌을 발견하지 못했다.

## 위험도

NONE

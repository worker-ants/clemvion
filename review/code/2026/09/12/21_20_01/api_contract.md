# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 정본 spec 의 §5.4 실패 응답 표에 신규 `400 VALIDATION_ERROR` (`:id` 비-UUID) 행이 없다
  - 위치: `spec/5-system/15-chat-channel.md:369-379` (§5.4 Bot Token Rotation API 응답 계약 표)
  - 상세: `codebase/backend/src/modules/triggers/triggers.controller.ts` 의 `rotateBotToken` 에
    `ParseUUIDPipe` 가 새로 붙어(`@Param('id', ParseUUIDPipe) triggerId: string`, 해당 파일
    diff 게이트 291번째 줄) 이제 `:id` 가 UUID 형식이 아니면 `400 VALIDATION_ERROR` 를 반환한다.
    실측으로 확인: `GlobalExceptionFilter.getCodeFromStatus(400)` → `'VALIDATION_ERROR'`
    (`codebase/backend/src/common/filters/http-exception.filter.ts:132-152`), `ParseUUIDPipe` 가
    던지는 `BadRequestException` 은 `resp.code` 가 없어 이 기본값 경로를 그대로 탄다 — 컨트롤러의
    `@ApiBadRequestResponse` 문면과 `CHANGELOG.md` 에는 반영됐다(둘 다 diff 에 포함). 그런데
    `spec/5-system/15-chat-channel.md` §5.4 는 이 엔드포인트의 `error.code` 전수를 나열하는
    **canonical** 표인데(367번째 줄 "실패 응답 — ... 표준 에러 envelope 적용"), 그 표에는 새
    분기가 없다 — 생성된 OpenAPI(컨트롤러 데코레이터)가 canonical spec 보다 넓게 계약을 노출하는
    상태다. plan (`plan/in-progress/spec-draft-nullable-notation-followups.md`, 새 항목
    "`15-chat-channel.md §5.4` 실패 응답 표에 `rotate-bot-token` 의 신규 400 행이 없다")이 이미
    이 갭을 planner 항목으로 등재해 두었고(자기-반증형 소정정 조건 1 미충족이라 developer 턴에서
    직접 못 고친다는 이유도 타당하다), 실측 결과 그 등재 내용은 정확하다.
  - 제안: planner 턴에서 §5.4 표에 `400 | VALIDATION_ERROR | :id 가 UUID 형식이 아님
    (ParseUUIDPipe)` 행을 추가한다(이미 plan 에 적힌 처분안과 동일). 이 리뷰 시점 기준으로는
    아직 미해결이므로 병합 전 반영 여부를 확인할 것.

- **[INFO]** `rotate-bot-token` 의 500→400 전환은 관측 가능한 client-facing 변경이지만 적절히 문서화·검증됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (diff 게이트 291번째 줄,
    `@Param('id', ParseUUIDPipe)`), `CHANGELOG.md` (diff 게이트 3~24번째 줄)
  - 상세: 이 엔드포인트는 `codebase/frontend/src/content/docs/06-integrations-and-config/
    telegram{,.en}.mdx` 가 "API 등록 흐름(자동화/CI 용)" 예시로 직접 curl 호출을 안내하는
    외부 노출 API 다. 이전에는 비-UUID `:id` 가 Postgres SQLSTATE 22P02 로 거부되어
    `500 INTERNAL_ERROR` 로 마스킹됐는데(`GlobalExceptionFilter` 가 그 SQLSTATE 를 분기하지
    않음), 이제 `400 VALIDATION_ERROR` 다. 5xx 를 재시도/알림 신호로 쓰는 외부 자동화 클라이언트가
    있다면 동작이 달라진다 — 다만 이는 "서버 오류처럼 보이던 클라이언트 입력 오류"를 올바른
    4xx 로 되돌리는 수정이라 REST 의미상 타당한 방향이고, `CHANGELOG.md` 에 "⚠️ 배포 시 확인"
    항목으로 명시적으로 실려 있으며 저장소 내 유일한 소비자(프런트엔드 토스트)가 status 코드로
    분기하지 않음을 확인했다는 근거도 있다. 형제 6개 엔드포인트가 처음부터 이 파이프를 갖고
    있었다는 점에서 이 엔드포인트만 계약이 어긋나 있던 상태를 바로잡는 것으로 판단된다.
  - 제안: 조치 불필요 — 이미 적절히 문서화됨. 배포 노트에 CHANGELOG 항목이 실제로 릴리스
    노트에 반영되는지만 확인.

- **[INFO]** 유저 가이드 에러 코드 정정 검증 완료 — 실제 코드와 일치
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram{,.en}.mdx`,
    `02-nodes/triggers{,.en}.mdx`, `mcp-servers{,.en}.mdx`, `codebase/frontend/src/lib/i18n/
    backend-labels.ts`
  - 상세: 직접 grep 으로 재검증함. `TRIGGER_NOT_FOUND` 의 유일한 발신처는
    `codebase/backend/src/modules/hooks/hooks.service.ts:120`(인입 webhook 경로)이고, 트리거
    REST API 의 404 는 `codebase/backend/src/modules/triggers/triggers.service.ts:349` 및
    `triggers.controller.ts:280` 이 선언한 대로 `RESOURCE_NOT_FOUND` 가 맞다. 환경변수명도
    `MCP_ALLOW_INSECURE_URL` 이 실제 코드(`common/config/mcp.config.ts:41-42`,
    `common/config/production-guards.ts:141`, `.env.example:331`)와 일치하고, 문서가 고치기 전에
    썼던 `MCP_INSECURE_URL_ALLOWED` 는 저장소 어디에도 없다. 두 정정 모두 API 계약(에러 코드·
    설정 계약) 문서를 실제 구현과 일치시키는 정확한 수정이다.
  - 제안: 없음 (확인 목적의 기록).

- **[INFO]** id-형 경로 파라미터 UUID 계약 전수 가드는 향후 회귀를 구조적으로 방지
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`,
    `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`
  - 상세: 런타임 축(`ParseUUIDPipe`)과 문서 축(`@ApiParam({format:'uuid'})`)을 AST 로 전수
    스캔해 베이스라인 0 으로 고정한 것은 "요청 검증"·"응답 형식 일관성" 관점에서 이번 결함
    클래스(4개월간 한 자리만 계약이 달랐던 것)의 재발을 구조적으로 막는다. `@ApiExcludeEndpoint()`
    핸들러에 대해 문서 축만 면제하고 런타임 축은 계속 요구하는 설계도 타당하다.
  - 제안: 없음 (확인 목적의 기록).

## 요약

이번 변경의 핵심은 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 `:id` 파라미터에
`ParseUUIDPipe` 를 추가해 비-UUID 입력이 500(마스킹된 DB 오류)이 아니라 400 `VALIDATION_ERROR`
로 정상 분류되도록 고친 것이며, 형제 엔드포인트 6곳과의 계약 불일치를 해소하는 정당한 수정이다.
컨트롤러의 `@ApiBadRequestResponse` 문면·`CHANGELOG.md`·유저 가이드 4곳·`backend-labels.ts`
주석 귀속·MCP 환경변수명 오기까지 관련 표면을 광범위하게 정합화했고, 재검증(grep)으로 모든
정정이 실제 코드와 일치함을 확인했다. AST 기반 전수 가드(`param-uuid-pipe`)를 베이스라인 0으로
고정해 같은 클래스의 재발을 구조적으로 막은 점도 API 계약 관점에서 긍정적이다. 유일하게 남은
간극은 `spec/5-system/15-chat-channel.md` §5.4 의 canonical 실패 응답 표가 아직 새 400 분기를
반영하지 않아 생성된 OpenAPI 문서가 정본 spec 보다 넓게 계약을 노출한다는 점인데, 이는 plan 에
이미 planner 후속 항목으로 정확하게 등재되어 있다(자기-반증형 소정정 조건 미충족으로 developer
턴에서 직접 고칠 권한이 없다는 판단도 타당). 500→400 전환 자체는 관측 가능한 동작 변경이지만
CHANGELOG 에 배포 경고와 함께 적절히 문서화되었고 내부 유일 소비자에 영향이 없음을 확인했다.

## 위험도

LOW

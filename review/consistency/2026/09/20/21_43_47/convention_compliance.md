# 정식 규약 준수 검토 — spec/2-navigation (--impl-prep)

## 검토 범위

전달된 번들 중 본문이 온전히 포함된 대상은 `spec/2-navigation/2-trigger-list.md` ·
`spec/2-navigation/1-workflow-list.md` · `spec/2-navigation/3-schedule.md` 세 파일이다
(나머지 `spec/2-navigation/*` 15개는 컨텍스트 예산으로 절단됨 — 해당 파일에 대한 판정은
보류하며 "위반 없음" 의 근거로 쓰지 않는다). `spec/conventions/**` 전량(카탈로그 포함)을
대조군으로 사용했고, 특히 `error-codes.md` · `audit-actions.md` · `swagger.md` ·
`secret-store.md` · `chat-channel-adapter.md` 를 직접 대조했다.

## 발견사항

- **[INFO]** `GET /api/triggers/:id/history` 응답 포맷 인용 누락
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표, `GET /api/triggers/:id/history` 행
  - 관련 규약: `spec/5-system/2-api-convention.md §5.2` (목록 응답 — 페이징 vs 비-페이징 고정
    컬렉션 두 형태) · `spec/conventions/swagger.md §5-2` (`ApiOkWrappedArrayResponse` — 배열
    200 OK, `{ data: <Dto>[] }`)
  - 상세: 같은 §3 표의 형제 행 `GET /api/triggers`·`GET /api/schedules`(3-schedule.md §4)는
    "페이지네이션 응답 형식은 §5.2 준수" 를 명시하지만, `GET /api/triggers/:id/history` 행은
    포맷 인용이 전혀 없다. 실제 컨트롤러(`triggers.controller.ts` `getHistory`)는
    `@ApiOkWrappedArrayResponse(TriggerHistoryItemDto)` — swagger 규약이 이미 카탈로그화한
    **세 번째 형태**(`{ data: [...] }` bare array, `pagination` 없음, 최근 10건 고정)를 쓰고
    있어 구현 자체는 규약을 어기지 않는다. 다만 spec 본문만 보면 이 엔드포인트가 §5.2 페이징
    목록인지, 비-페이징 고정 컬렉션(`{ data: { items } }`)인지, bare array 인지 구분할 수
    없다 — 클라이언트 구현자가 문서만 보고 오판할 여지.
  - 제안: 해당 행에 "최근 10건 고정 배열 — 페이지네이션 없음(`ApiOkWrappedArrayResponse`)" 한
    줄을 추가해 형제 행과 같은 수준의 포맷 인용을 갖춘다. BLOCK 사유는 아니다.

## 점검했으나 위반 없음 (근거 포함)

- **에러 코드 명명**(`error-codes.md`): 봉투 코드(`VALIDATION_ERROR`/`RESOURCE_CONFLICT`/
  `RESOURCE_NOT_FOUND`/`INTERNAL_ERROR`)와 `details.code`(`INVALID_FIELD`,
  `TRIGGER_ENDPOINT_PATH_CONFLICT`)는 전부 `UPPER_SNAKE_CASE` 이며, `INVALID_FIELD` 는
  `api-convention.md §5.3` 예시 원문과 정확히 일치한다. `error-codes.md §4.2` 의 트리거
  파라미터 검증 사유(`MISSING_REQUIRED_FIELD` 등)와는 별개 파이프라인(관리 PATCH 필드 검증)
  이라 네임스페이스 충돌도 없다.
- **감사 액션 명명**(`audit-actions.md §3`): `trigger.created/updated/deleted` (과거분사
  기본형) · `trigger.notification_secret_rotated` / `trigger.chat_channel_bot_token_rotated` /
  `trigger.interaction_token_revoked` (2026-08-11 구현 항목) 모두 레지스트리와 1:1 일치.
  R-4 의 "activate/deactivate 도 `trigger.updated` 로 흡수, 별도 `trigger.toggle` 없음"
  서술도 §2.1 규칙(생애주기 CRUD 는 과거분사 하나로 통일)과 정합한다.
- **Secret Store 경계**(`secret-store.md §1.1`): `botToken`/`inboundSigningPlaintext` 를
  write-only 로 규정하고 `hasBotToken: boolean` 파생 필드만 응답에 노출한다는 서술, 그리고
  AuthConfig `***<last4>` 마스킹을 write-only 필드에 차용하지 않는다는 구분이 §1.1 의
  "ref/평문 모두 응답 바디에 나가면 안 된다" 규칙과 정확히 대응한다.
- **Chat Channel 어댑터 계약**(`chat-channel-adapter.md §2.3`): `uiMapping.formMode`
  (`multi_step`/`native_modal`/`auto`) · `uiMapping.visualNode`(`text`/`photo`/`auto`) ·
  `uiMapping.buttonLayout`(`auto`/`vertical`/`horizontal`) · `rateLimitPerMinute` ·
  `languageHints` 필드명·enum 값이 `ChatChannelConfig` 타입 정의와 완전히 일치한다.
- **요청 DTO 명명**(`swagger.md §1-7`): 본문이 인용하는 `update-trigger.dto.ts`(top-level
  요청 바디)는 `Update<Entity>Dto` 접두 규칙과 일치하고, nested 변형(`config`/`notification`/
  `chatChannel` 등)은 별도 DTO 접두를 주장하지 않아 로컬 패턴 규칙과 충돌하지 않는다.
- **문서 구조**(`CLAUDE.md` / `project-planner/SKILL.md` 3섹션 규칙): 세 파일 모두
  Overview 는 `_product-overview.md`(다중 spec 영역이므로 분리가 정칙) 링크로 위임하고,
  본문(화면 구조·기능 상세·API)과 말미 `## Rationale` 을 갖춰 규정된 구조를 만족한다.
  `spec/2-navigation/2-trigger-list.md` 는 `id`/`status`/`code:` frontmatter 도 갖춘다.
- **`/toggle` 서브경로 미채택**(R-4, R-16, `3-schedule.md §4`): 트리거·스케줄 양쪽 모두
  "별도 `/toggle` 없음, `PATCH .../{id}` body 단일 경로" 로 일관 서술 — 문서 간 drift 없음.

## 요약

검토한 세 파일(`2-trigger-list.md` · `1-workflow-list.md` · `3-schedule.md`)은 에러 코드·
감사 액션·secret store 경계·Chat Channel 어댑터 계약·DTO 명명·문서 3섹션 구조 등 점검한
전 항목에서 `spec/conventions/**` 의 정식 규약과 정합했다. 유일한 지적은 `GET
/api/triggers/:id/history` 의 응답 포맷이 형제 목록 엔드포인트와 달리 spec 본문에 인용되지
않은 완성도 문제(INFO)이며, 구현 자체(`ApiOkWrappedArrayResponse`)는 swagger 규약을 그대로
따르고 있어 실질적 위반은 아니다. 나머지 15개 `spec/2-navigation/*` 파일은 컨텍스트 절단으로
판정 대상에서 제외했다.

## 위험도

LOW

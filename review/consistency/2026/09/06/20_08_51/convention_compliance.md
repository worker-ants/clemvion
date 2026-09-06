# 정식 규약 준수 검토 — target: `spec/2-navigation/` (impl-done, diff-base `origin/main`)

## 검토 범위와 방법

- scope(`spec/2-navigation`) 델타는 0개 파일 — 이번 커밋 구간도 이 spec 영역 문서를 고치지
  않았다. 검토는 (a) 기존 `2-trigger-list.md`·`3-schedule.md` 본문이 `spec/conventions/**`
  (naming·swagger·error-codes·audit-actions·secret-store·chat-channel-adapter·
  spec-impl-evidence) 를 따르는가, (b) 이 브랜치가 이미 실은 코드(트리거 409/details 계약,
  `AUTH_CONFIG_NOT_FOUND` 등)가 그 spec 이 약속한 계약을 구현했는가 두 축이다.
- 프롬프트 번들에서 컨텍스트 예산으로 절단된 `spec/conventions/{swagger,error-codes,
  audit-actions,secret-store,chat-channel-adapter,spec-impl-evidence}.md` ·
  `spec/5-system/2-api-convention.md` 는 워킹트리에서 절대경로로 직접 Read 했다
  (`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`, HEAD).
- **이번 라운드는 직전 라운드(`review/consistency/2026/09/06/19_31_06`, 위험도 NONE) 이후
  변경분을 우선 확인했다.** `git log e008dd009..HEAD` 는 커밋 2개뿐이다 — `592d0c7b6`(백엔드
  타입체크 ratchet 회귀 수정, `pg-error-fixtures.ts` 캐스팅 하나)와 `33999c685`(리뷰 라운드
  통과 기록, 코드 변경 없음). 둘 다 `spec/2-navigation/**` · 트리거/스케줄 API 계약 · 에러 코드
  · swagger 데코레이터에 영향이 없다. 따라서 이 문서가 정식 규약을 지키는지에 대한 판정은
  `19_31_06` 이후로 **바뀔 근거가 없다** — 아래는 독립적으로 재수행한 교차검증 결과다(신뢰용).

## 발견사항

이번 라운드에서 신규로 보고할 CRITICAL/WARNING 은 없다. 아래는 독립적으로 재조사해
**이미 정확히 같은 결론에 도달**한 항목이며, 전부 기존 라운드에서 이미 조치·기각·등재
완료된 상태다(재지적 아님, 참고용):

- **[해소 확인 — 신규 아님] 409 `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT` Swagger 표면**
  - target 위치: `spec/2-navigation/2-trigger-list.md` `## 3. API` PATCH 블록쿼트 +
    §2.3.1 `Webhook Configuration | endpointPath` 행
  - 확인: `triggers.controller.ts` `create()`(L98-101)·`update()`(L127-130) 양쪽에
    `@ApiConflictResponse({ description: '... code=RESOURCE_CONFLICT, details.field=...,
    details.code="TRIGGER_ENDPOINT_PATH_CONFLICT".' })` 가 이미 붙어 있다(커밋
    `e008dd009`). 서비스(`rethrowEndpointPathConflict`)의 실제 발행값과 1:1 일치.
  - 제안: 없음.

- **[이미 planner 등재 — 재지적 아님] `details` 봉투가 object(단일 도메인 예외)·array
  (ValidationPipe 다중 필드) 두 형태로 공존하고, `TRIGGER_ENDPOINT_PATH_CONFLICT` 가
  `error-codes.md` §3(historical 예외)·§4(내부 분류 코드) 어디에도 등재되지 않은 신규 자리인
  점**
  - 위반 규약: `spec/5-system/2-api-convention.md` §5.3 (details 는 `[{ field, message,
    code: "INVALID_FIELD" }]` **array** 형태만 명문화 — object 단일 사유 형태 미정의) +
    `spec/conventions/error-codes.md` §3/§4 (카탈로그 완결성)
  - 상세: 저장소에 도메인 특화 409 를 표현하는 **두 관례**가 공존한다 — (1) top-level
    `code` 자체를 특화 코드로 교체(`DUPLICATE_NODE_LABEL` 등 다수, `3-error-handling.md`
    §1 카탈로그에 정식 등재), (2) top-level 은 `RESOURCE_CONFLICT` 로 두고 `details.code`
    에 특화 사유를 싣는 방식(`TRIGGER_ENDPOINT_PATH_CONFLICT`, 이번 브랜치 커밋
    `a185846a5` 가 구현). `2-trigger-list.md §3` 이 스스로 "세부 코드" 라는 표현으로 (2)를
    먼저 문서화해 뒀고 코드가 그것을 충실히 구현한 것이라, **이 문서·이 PR 의 신규 일탈이
    아니다.**
  - 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (§"도메인 세부 에러
    코드의 표현 방식을 정식화한다", `review/consistency/2026/09/06/14_59_49` W1 인용,
    `spec_impact` 에 `spec/2-navigation/2-trigger-list.md` 명시)에 planner 항목으로 등재돼
    있다 — `2-api-convention.md §5.3` 에 (1)/(2) 중 택일 기준을 적고 `3-error-handling.md
    §1` 에 이 코드를 나열형으로 등재하는 것이 그 해소책이다.
  - 제안: 이번 라운드에서 추가 조치 불요. planner 턴이 위 항목을 처리할 때 함께 닫는다.

- **[이미 planner 등재 — 재지적 아님] `2-trigger-list.md` R-2 가 폐기된 v1.1 설계
  (`POST /api/triggers/:id/auth/rotate-secret`) 를 유효한 것처럼 남겨 같은 문서 §3
  각주("본 PR 에서 폐기됐다", Rationale R-14)와 자기모순**
  - target 위치: `spec/2-navigation/2-trigger-list.md` Rationale R-2 (인증 `authConfigId`
    단일화 이전의 inline `hmacSecret` 설계 서술)
  - 위반 규약: 문서 구조 규약이라기보다 spec 본문 내부 정합성 문제이나, `R-2` 가 인용하는
    v1.1 API 형태가 지금은 존재하지 않는 설계라 이 문서를 읽는 사람이 폐기된 API 를
    로드맵으로 오인할 수 있다. 파급: `5-system/15-chat-channel.md` R-CC-10 이 R-2 를
    "현재 유효 설계"로 인용하고 있어 문서 밖으로 번진다.
  - 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (`review/consistency/
    2026/09/06/15_31_00` W1 인용)에 planner 항목으로 등재 — R-2 본문 취소선 + 정정 콜아웃,
    `15-chat-channel.md` R-CC-10 인용 동시 갱신이 해소책.
  - 제안: 이번 라운드 추가 조치 불요.

- **[이미 planner 등재 — 재지적 아님] `2-trigger-list.md` §2.3.1 `botToken` 행의 자기모순
  ("응답에는 `hasBotToken: boolean` 만 노출" vs "마스킹 placeholder `•••• <last4>`")**
  - 위반 규약: `spec/conventions/secret-store.md` §1.1 (write-only 시크릿은 응답 바디에
    실리지 않아야 함) 자체는 어기지 않으나, 같은 행 안에서 두 서술이 서로 모순돼 "실제 응답에
    무엇이 나가는가" 가 불분명하다. `15-chat-channel.md §5.4.2`(ref·plaintext 모두 응답
    미포함)와도 어긋난다.
  - 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (`review/consistency/
    2026/09/06/14_59_49` W2 인용)에 planner 항목으로 등재.
  - 제안: 이번 라운드 추가 조치 불요.

## 점검했으나 위반이 아니라고 판단한 항목 (근거 포함)

- **URL 명명** — `POST /api/triggers/:id/notification/rotate-secret` ·
  `.../interaction/revoke-token` · `.../chat-channel/rotate-bot-token` · `POST
  /api/schedules/:id/run-now` 는 `api-convention.md §2.2` "RPC-style sub-channel/자원 액션"
  예외 행이 **정확히 같은 예시**로 등재한 패턴과 문자 그대로 일치. `POST /api/schedules/preview`
  (collection-level, ID 없는 계산 endpoint) 도 같은 문서 §7 표가 이미 쓰는
  `POST /api/model-configs/preview-models` 패턴과 동형.
- **상태 토글** — `PATCH /api/triggers/:id { isActive }` 단일 경로, `/toggle` 서브경로
  미채택(R-4, R-16) — `api-convention.md §12.1` "Boolean 토글 전용 endpoint 금지"(`is_active`
  가 Trigger/Schedule 예시로 명시)와 정확히 일치. `PATCH /api/schedules/:id { isActive }`
  도 동일. drawer read-only 배지(R-16)와 API 편집 경로 분리 논리도 규약과 모순 없음.
- **유니크 제약 범위** — `(workspace_id, endpoint_path)` UNIQUE 는 `api-convention.md §12.2`
  표와 정확히 일치.
- **에러 코드 표기** — `VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`RESOURCE_NOT_FOUND`/
  `AUTH_CONFIG_NOT_FOUND`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 전부 `UPPER_SNAKE_CASE` —
  `error-codes.md §1` 표기 규율 위반 없음. `AUTH_CONFIG_NOT_FOUND` 가 404 가 아니라 400 으로
  발행되는 점은 언뜻 `MODEL_CONFIG_NOT_FOUND`(404)/`MODEL_CONFIG_DEFAULT_MISSING`(400) 분리
  사례("동일 코드가 두 status 를 가지면 모호")를 연상시키지만, 직접 실측
  (`triggers.service.ts` L844-858 `assertAuthConfigInWorkspace` → `BadRequestException`,
  400 한 곳에서만 발행, 404 짝 없음)한 결과 그 모호성은 성립하지 않는다. 같은 "요청 본문 안
  참조 리소스 검증 실패" 패턴으로 `USER_NOT_FOUND`(`totp.service.ts`, 400) ·
  `PREVIOUS_EXECUTION_NOT_FOUND`(`workflows.controller.ts`, 400) 가 이미 저장소에 있어
  이 패턴 자체가 기존 관행이다 — 신규 위반 아님(2026-05-28 이전부터 존재하는 pre-existing
  코드이기도 하다, 이번 PR 도입 아님).
- **감사 액션 명명** — `trigger.notification_secret_rotated` / `trigger.chat_channel_bot_
  token_rotated` / `trigger.interaction_token_revoked` / `trigger.deleted` / `trigger.updated`
  전부 `audit-actions.md §3` 레지스트리에 과거분사(§2.1) 패턴으로 정확히 등재돼 있다 — 신규
  action 없음.
- **secret store ref 명명·비노출** — `botTokenRef`/`inboundSigningRef` 명명은
  `secret-store.md` 의 `buildSecretRef`/`*Ref` 관례와 일치하고, "내부 ref 는 사용자에게
  노출하지 않음" 서술은 `secret-store.md §1.1`("ref 도 응답 DTO·바디에 실리면 안 된다")과
  정확히 부합한다.
- **chat-channel `uiMapping` enum** — `formMode`(`multi_step`/`native_modal`/`auto`,
  default `auto`) · `visualNode`(`text`/`photo`/`auto`, default `auto`) ·
  `buttonLayout`(`auto`/`vertical`/`horizontal`, default `auto`) 세 필드 모두
  `chat-channel-adapter.md` 의 TS 선언(`formMode?: "multi_step" | "native_modal" | "auto"`
  등)과 값 집합·기본값이 1:1 일치.
- **목록 응답/페이지네이션** — `GET /api/triggers` · `GET /api/schedules` 모두 "페이지네이션
  응답 형식은 API 규약 §5.2 준수"를 직접 인용. `nextRunAt` 계산 불가 시 `null`(대시 `-` 표시)
  서술도 `api-convention §5.4` 의 "상시 존재 필드는 `null`" 기본 원칙과 일치(EIA `nextCursor`
  선례와 동형).
- **문서 구조** — `2-trigger-list.md`/`3-schedule.md` 는 별도 `## Overview` 절 없이 `# Spec:
  ...` + `> 관련 문서` 로 시작하는데, 이는 `spec/2-navigation/` 디렉토리의 지배적 관행이다
  (16개 파일 중 `## Overview` 를 쓰는 것은 `6-config.md` 하나뿐 — 전수 확인). 두 문서 모두
  `## Rationale` 절은 갖춘다. CLAUDE.md 의 "Overview/본문/Rationale 3섹션 권장"을 이 영역
  스스로 다른 방식(관련 문서 인용 + Rationale)으로 이미 안정적으로 충족하고 있어 위반으로
  보지 않는다.
- **`code:` 글롭 사용** — frontmatter `code:` 에 `codebase/backend/src/modules/triggers/
  dto/**` 같은 디렉토리 글롭을 쓰는 것은 `spec-impl-evidence.md` R-1 이 명시적으로 허용한
  패턴("글로브 허용을 채택")과 일치.

## 요약

`spec/2-navigation/`(트리거 목록·스케줄 화면)은 이번 커밋 구간에서 스스로 변경되지 않았고,
직전 두 개 커밋(타입체크 ratchet 수정, 리뷰 라운드 기록)도 이 영역·API 계약·에러 코드·
swagger 표면에 영향이 없다. 독립적으로 URL 명명(§2.2)·상태 토글(§12.1)·유니크 범위(§12.2)·
에러 코드 표기(error-codes §1)·감사 액션 명명(audit-actions §2-3)·secret ref 명명·비노출
(secret-store §1.1)·chat-channel enum(chat-channel-adapter §2.3)·페이지네이션 응답(§5.2/§5.4)
·frontmatter `code:` 글롭 허용(spec-impl-evidence R-1) 을 재검증한 결과, 전부 `spec/
conventions/**` 를 정확히 따른다. 알려진 잔여 갭 셋(도메인 세부 에러 코드 `details` 표현
이원화, R-2 폐기 설계 잔존, botToken 행 자기모순)은 신규 발견이 아니라 이미 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재돼 있고 `spec_impact` 에
이 대상 파일이 명시돼 있어 이번 라운드가 다시 지적할 필요가 없다. 신규 CRITICAL/WARNING 없음.

## 위험도

NONE

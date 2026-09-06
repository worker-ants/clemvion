# Cross-Spec 일관성 검토 — sweep-response-contract-5ba0ad (impl-done, scope=spec/5-system/)

## 검토 방법 메모

`spec/5-system/` 자체의 diff 는 이번 라운드도 0개 파일이다 — 선행 PR(`#1284`~`#1290`)이 이미
`origin/main`(`9a9c024a6`)에 병합돼 §5.4 응답-계약 규범과 `secret-store.md §1.1` 노출 금지
규범을 세워 두었고, 이 브랜치는 그 규범을 코드로 이행하는 순수 구현 PR 이다. 프롬프트의
diff 섹션은 예산 초과로 절단돼 있어, 워킹트리에서 `git diff origin/main...HEAD --stat` 과
관련 파일 전문을 직접 재현해 확인했다. `origin/main` 대비 신규 커밋 13개, 최신은
`0de16b488`(`fix(backend): 보안 공지가 닫은 유출의 절반만 적고 있었다 + PATCH 경로가 관계를
잃었다`) — 직전 검토(`review/consistency/2026/09/06/01_13_51`, 대상 `fdb9b7caf`)가 발견한
두 INFO(secret-store.md 서술 stale 화 예정, nav-spec 문서화 갭)를 developer 권한 안에서
처리 가능한 부분(CHANGELOG 보안 공지 4필드 완성, `relations: ['workflow']` 재조회 수정,
plan 트래커 정정)만 반영한 뒤의 상태다.

대조한 spec: `spec/1-data-model.md`(§2.9.1·§2.10·§2.11·§2.25), `spec/conventions/
secret-store.md`(§1·§1.1·§4 SS-SE-01), `spec/conventions/swagger.md`(§3·§5-1),
`spec/5-system/2-api-convention.md`(§5.4), `spec/5-system/3-error-handling.md`
(`INTERNAL_ERROR`), `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md`
(§4), `spec/2-navigation/4-integration.md`(§9.1), `plan/in-progress/
spec-draft-nullable-notation-followups.md`.

## 발견사항

- **[INFO]** `secret-store.md §1` 의 "노출 창이 아직 닫혀 있지 않다" 서술이 이 브랜치
  머지 시점에 stale 화된다 (직전 라운드와 동일 항목, 아직 미종결)
  - target 위치: (코드) `triggers.service.ts` `TRIGGER_RESPONSE_STRIP_COLUMNS` +
    `sanitizeForResponse()`, `schedules.controller.ts` `toResponse()`
  - 충돌 대상: `spec/conventions/secret-store.md` §1 (line 69~78, 이미 `origin/main` 존재)
  - 상세: 해당 문단은 여전히 현재형으로 "현행 구현은 `GET/POST/PATCH /api/triggers` 와
    `GET /api/schedules`(트리거 조인) 응답에도 이 컬럼을 그대로 싣는다 … 매 요청 노출된다"
    라고 서술한다. 이 브랜치의 4축 스트립(엔티티 컬럼 2개 + `config.interaction.
    triggerToken` + `config.notification.signing.{secret,secretRef}`)이 정확히 그 노출을
    닫으므로, 머지 후 이 spec 문장은 실제 구현과 어긋난 과거형 서술로 남는다.
  - **추적 상태**: `plan/in-progress/spec-draft-nullable-notation-followups.md` line 824가
    이 항목을 `[ ]`(미체크)로 등재해 두었고 담당은 `planner` 로 명시돼 있다 —
    `spec/conventions/` 쓰기는 developer 권한 밖이라 이 브랜치가 직접 정정할 수 없다.
  - 제안: 신규 조치 불요. 이 브랜치가 머지된 뒤 planner 턴에서 secret-store.md §1 에
    "이 창은 `#<PR>` 로 닫혔다" 정정 이력을 추가한다.

- **[INFO]** `TriggerDto.workflow` / `ScheduleTriggerRefDto.workflow` 키-생략 사유가
  nav-spec 에 아직 반영되지 않음 (직전 라운드와 동일 항목, 아직 미종결)
  - target 위치: `trigger-response.dto.ts`(`TriggerWorkflowRefDto`, `workflow?`),
    `schedule-response.dto.ts`(`ScheduleTriggerWorkflowRefDto`, `workflow?`)
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4("키 생략은 그 필드를 문서화하는
    절에 사유를 명시"), `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/
    3-schedule.md` §4
  - 상세: nav-spec 어느 쪽에도 `trigger`/`workflow` 응답 shape·부재 사유(생성 응답에만
    없음)를 다루는 절이 없다. 사유는 현재 코드 JSDoc/주석에만 존재한다.
  - **추적 상태**: 같은 plan 파일 line 834 가 이 갭을 `[ ]` 로 등재(담당 `planner`).
  - 제안: 신규 조치 불요. planner 턴에서 두 nav-spec 문서에 참조 필드 shape + 키-생략
    사유를 추가한다.

- **[INFO]** `INTERNAL_ERROR` 고정 문구의 언어가 spec 과 기존 구현 사이에서 갈린다
  (이 브랜치가 만든 회귀 아님 — 새로 나란히 드러남)
  - target 위치: `schedules.controller.ts` `toResponse()` 의 신규 500(`{ code:
    'INTERNAL_ERROR', message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }`)
  - 충돌 대상: `spec/5-system/3-error-handling.md` line 33 (`INTERNAL_ERROR` 문구를
    한국어로 고정) vs `codebase/backend/src/common/filters/http-exception.filter.ts`
    (`UNHANDLED_ERROR_MESSAGE`="An unexpected error occurred. Please try again later.",
    `UNKNOWN_ERROR_MESSAGE`="An unexpected error occurred" — 둘 다 영어, 후자가 기본값)
  - 상세: 실측 확인 — `error-handling.md` 는 `INTERNAL_ERROR` 문구를 한국어로 정하는데,
    매핑되지 않은 예외를 잡는 전역 `GlobalExceptionFilter` 는 영어 상수 두 개(용도가
    다름: `Error` 매핑 실패용 vs 비-`Error` throw 용)를 쓴다. 이 브랜치의 새 코드는
    spec 문구를 정확히 따랐고(한국어), 기존 필터는 그대로라 같은 `INTERNAL_ERROR` 코드
    아래 문구가 세 갈래(한국어 1 + 영어 2)가 된다.
  - **추적 상태**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 가
    이 drift 를 등재(담당 `developer`, 이 브랜치 범위 밖 — 필터 수정은 매핑되지 않은
    모든 5xx 문구에 영향을 미쳐 PR 범위를 벗어난다고 명시).
  - 제안: 신규 조치 불요. 이 브랜치 범위 밖의 기존 drift — 필터 통일은 별도 작업으로.

## 확인했으나 충돌 없음 (근거 기록)

- **비밀 스트립 4축 완결성** — `TRIGGER_RESPONSE_STRIP_COLUMNS`(`notificationSecretV2`/
  `chatChannelTokenV2`) · `NOTIFICATION_SIGNING_STRIP_KEYS`(`secret`/`secretRef`) ·
  `INTERACTION_RESPONSE_STRIP_KEYS`(`triggerToken`) · `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`
  는 `secret-store.md §1.1` 이 이름으로 금지한 필드 집합과 정확히 일치하고,
  `CHANGELOG.md` 가 이번엔 네 필드 전부를 보안 공지 표에 실었다(직전 라운드는 2개만).
- **data model 필드 일치** — `AlertRuleDto.createdBy`(`nullable: true`) /
  `.lastTriggeredAt`(`nullable: true`) 는 `1-data-model.md §2.25` 의 `created_by: UUID?` /
  `last_triggered_at: Timestamp?` 와 nullable 여부까지 일치. `IntegrationDto` 신규 5필드
  (`appUrl`·`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt` = nullable,
  `consecutiveNetworkFailures` = non-null)는 `§2.10` 의 `mall_id: String?` /
  `token_expires_at: Timestamp?` / `last_used_at: Timestamp?` / `last_rotated_at:
  Timestamp?` / `consecutive_network_failures: int NOT NULL DEFAULT 0` 과 필드명·
  nullable 여부 전부 일치(코드 대 spec 실측 대조 완료).
- **PATCH 재조회 relations 정합** — `triggers.service.ts` `update()` 의 chatChannel
  재조회(line 512)가 이번 커밋에서 `relations: ['workflow']` 를 갖췄다. `create()` 의
  동종 재조회(line 412)는 의도적으로 `workflow` relation 을 요청하지 않는데, 이는
  "`workflow` 는 생성 응답에만 부재" 라는 코드 JSDoc/spec 취지와 정합한다(정상 경로에서
  `create()` 결과에 `workflow` 를 실을 근거가 없다 — 방금 저장한 트리거라 관계 자체가
  없거나 무의미).
- **Schedule↔Trigger NOT NULL 1:1** — `schedules.controller.ts` 의 "`Schedule.trigger_id`
  는 NOT NULL 1:1" 전제는 `1-data-model.md §2.9.1` 과 일치, `ScheduleDto.trigger` 는
  §5.4 기본형(`@ApiProperty`, 상시 존재)으로 선언돼 그 불변식과 정합한다.
- **요구사항 ID** — 이 diff 는 새 ID 를 도입하지 않고 기존 `SS-SE-01` 만 인용한다.
  다만 그 인용 자체("secret-store.md §5.5 SS-SE-01")는 **실제 정의 위치(§4 보안
  요구사항, line 265~269)와 다른 섹션 번호**를 가리킨다 — 그러나 이 citation 은
  `origin/main`(`5bced1f3`)에 이미 존재하던 것으로 **이 브랜치가 만든 것이 아니다**
  (`git show origin/main:...triggers.service.ts | grep SS-SE-01` 로 확인). 이 브랜치가
  손댄 것은 그 옆 주석의 후행절 삭제뿐, 섹션 번호는 그대로다. 범위 밖으로 판단해
  발견사항에 올리지 않는다(참고: `naming_collision`/`convention_compliance` 관점의
  별도 리뷰어가 다룰 사안).
- **상태 전이** — `Integration.status`, `Trigger.chatChannelHealth`/
  `notificationHealth` enum 을 이 diff 가 변경하지 않는다.
- **RBAC** — Trigger 비밀 필드는 `1-auth.md §3.2` 의 AuthConfig reveal 류 역할별 분리
  대상이 아니라 전 역할 상시 비노출이 정책(secret-store.md §1.1)이라, 코드가 역할
  무관하게 strip 하는 것과 충돌 없음. 이 diff 는 RBAC 매트릭스를 건드리지 않는다.
- **계층 책임** — `TriggersService.sanitizeForResponse`(서비스) vs
  `SchedulesController.toResponse`(컨트롤러)가 다른 레이어에서 응답을 좁히지만, 서비스
  반환값이 `update()` 내부 로직(예: `trigger.isActive`)에도 재사용된다는 근거가 코드
  주석에 명시돼 있고, `swagger.md`/`2-api-convention.md` 어디에도 "응답 축소는 반드시
  이 레이어에서" 라는 정식 규정이 없어 spec 위반이 아니라 설계 선택.
- **검증 층 경계** — `2-api-convention.md` "검증 층" 표(정적 `swagger-dto-contract-
  guard.ts` vs 런타임 `response-contract.ts`)와 `swagger.md §5-1`이 이번 diff 의 실제
  구현(`ExecutionDto` 전수 래칫 결속, `findOptionalNullableResponseFields` 재사용)과
  정확히 일치.

## 요약

이번 라운드는 직전 검토(`01_13_51`)가 발견한 두 INFO 를 developer 권한 범위 안에서
처리 가능한 만큼(CHANGELOG 보안 공지 완성, PATCH 재조회 relations 정합, plan 정정) 반영한
뒤의 재검토다. `spec/5-system/` 을 직접 건드리지 않는 코드 전용 PR 이며, data model·API
계약·secret-store 노출 금지 규범·RBAC·검증 층 경계·요구사항 ID·상태 전이 전 영역이 코드와
필드 단위로 정확히 일치했다. 남은 세 항목(secret-store.md §1 서술의 예정된 stale 화,
nav-spec 의 §5.4 키-생략 사유 문서화 누락, `INTERNAL_ERROR` 문구 언어 drift)은 모두 새로
발견한 것이 아니라 developer 권한 밖(spec 쓰기)이거나 이 PR 범위 밖(전역 필터 수정)이라
planner 턴 또는 별도 작업을 기다리는, 이미 plan 트래커에 등재된 항목이다. CRITICAL·WARNING
급 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다.

## 위험도

LOW

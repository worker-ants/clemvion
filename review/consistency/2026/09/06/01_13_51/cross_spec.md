# Cross-Spec 일관성 검토 — sweep-response-contract-5ba0ad (impl-done, scope=spec/5-system/)

## 검토 방법 메모

`spec/5-system/` 자체의 diff 는 0개 파일 — 이 브랜치는 spec 을 바꾸지 않는다(선행 PR
`#1284`~`#1290` 이 이미 `origin/main` 에 병합돼 있고, 그 planner 턴이 §5.4 응답-계약 규범과
`secret-store.md §1.1` 노출 금지 규범을 이미 세워 두었다). 프롬프트의 diff 섹션은 예산
초과로 대부분 절단돼 있어, 워킹트리에서 `git diff origin/main...HEAD --stat` 과 대상 파일
전문을 직접 재현해 확인했다(13개 신규 커밋, 최신 `fdb9b7caf` 기준).

실제 변경은 `TriggerDto`/`ScheduleDto`/`IntegrationDto`/`KnowledgeBaseDto`/`AlertRuleDto` 응답
계약 보정 + `TriggersService.sanitizeForResponse` 4축 정화 + `SchedulesController.toResponse`
신설 + `swagger-dto-contract-guard.ts`/`response-contract.ts` 정적·런타임 검증자 확장이다.
대조한 spec: `spec/1-data-model.md`(§2.8·§2.9·§2.9.1·§2.10·§2.11·§2.25), `spec/conventions/
secret-store.md`(§1·§1.1·§4 SS-SE-01), `spec/conventions/swagger.md`(§3·§5-1), `spec/conventions/
review-citations.md`(§3), `spec/5-system/2-api-convention.md`(§5.4), `spec/5-system/3-error-
handling.md`(INTERNAL_ERROR), `spec/5-system/14-external-interaction-api.md`(§3.1 EIA-NX-07/11),
`spec/5-system/15-chat-channel.md`(§3.4 CCH-SE-01, §5.4.2), `spec/2-navigation/2-trigger-list.md`,
`spec/2-navigation/3-schedule.md`(§4), `spec/2-navigation/4-integration.md`(§9.1), 및 대응 프런트
엔드 소비처(`schedules/page.tsx`, `triggers/page.tsx`, `lib/api/triggers.ts`).

이 브랜치는 이미 10라운드의 코드/일관성 리뷰를 거쳤다(`review/code/2026/09/05~06/**`,
`review/consistency/2026/09/05~06/**`). 직전 라운드(`00_48_52`)가 잡은 두 건 — (1) `Schedules
Controller.toResponse` 의 500 응답이 진단 문구를 CWE-209 방식으로 노출, (2) 은 최신 커밋
`fdb9b7caf`(`fix(backend): 지난 라운드의 "수정" 이 CWE-209 를 만들었다`)에서 이미 수정되어
현재 코드는 `{ code: 'INTERNAL_ERROR', message: <고정 문구> }` + `logger.error` 로 나뉘어 있고,
`http-exception.filter.ts` 실측(`HttpException` 은 message 를 그대로 echo, 순수 `Error` 만
마스킹)과 일치함을 재확인했다. 그 이전 라운드(`21_40_38`)가 잡은 `ScheduleDto.trigger` 키
생략형 문제도 현재 `@ApiProperty({ type: () => ScheduleTriggerRefDto })` 로 기본형 전환되어
해소돼 있다. 아래는 그 위에서 **아직 열려 있는** 항목만 남긴다.

## 발견사항

- **[INFO]** `secret-store.md §1.1` 의 "노출 창이 아직 닫혀 있지 않다" 서술이 이 브랜치
  병합 시점에 stale 화된다
  - target 위치: (코드) `codebase/backend/src/modules/triggers/triggers.service.ts`
    `TRIGGER_RESPONSE_STRIP_COLUMNS` + `sanitizeForResponse()`, `schedules.controller.ts`
    `toResponse()`
  - 충돌 대상: `spec/conventions/secret-store.md` §1 (line 69~78, `9a9c024a6`로 이미
    `origin/main` 에 존재)
  - 상세: 해당 문단은 현재형으로 "노출 창은 아직 설계대로 닫혀 있지 않다 … 현행 구현은
    `GET/POST/PATCH /api/triggers` 와 `GET /api/schedules`(트리거 조인) 응답에도 이 컬럼을
    그대로 싣는다 … 매 요청 노출된다" 라고 서술한다. 이 브랜치의 `TRIGGER_RESPONSE_STRIP_
    COLUMNS`(엔티티 컬럼 2개 삭제) + `SchedulesController.toResponse` 의 4필드 allow-list
    좁히기가 정확히 그 두 엔드포인트의 그 노출을 닫는다 — 즉 이 PR 이 머지되면 spec 문장이
    실제 구현과 어긋난 과거형 서술로 남는다.
  - **이미 알려져 추적 중**: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    line 797~805 이 정확히 이 항목을 `[ ]`(미체크)로 등재해 두었다 — "그 문장은 내가 직전
    planner 턴에 쓴 것이고 … 그 브랜치가 머지되는 순간 현재형 서술이 거짓이 된다 → §7.1 의
    '정정 이력' 패턴을 준용해 커밋 참조를 추가한다"고 스스로 적었다. 직전 라운드
    (`review/consistency/2026/09/06/00_48_52` RESOLUTION.md)도 이 항목을 "developer 권한
    밖(spec 쓰기) — 이 브랜치에서 집행하지 않는다"며 INFO 로 명시적으로 보류했다.
  - 제안: 신규 조치 불요 — planner 턴에서 secret-store.md §1 에 "이 창은 `#…` 로 닫혔다"
    정정 이력을 추가해야 한다. 이 브랜치가 머지된 뒤 그 planner 턴이 누락되지 않도록
    plan 트래커의 해당 체크박스가 여전히 열려 있음을 확인하는 것이 유일한 후속 조치다.

- **[INFO]** `TriggerDto.workflow` / `ScheduleTriggerRefDto.workflow` 키-생략 사유가
  nav-spec 에 아직 반영되지 않음 (§5.4 문서화 요구사항의 잔여 갭)
  - target 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
    (`TriggerWorkflowRefDto`, `workflow?`), `codebase/backend/src/modules/schedules/dto/
    responses/schedule-response.dto.ts` (`ScheduleTriggerWorkflowRefDto`, `workflow?`)
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4 ("키 생략은 (a)/(b) 중 하나에 해당할
    때만 쓰고, **그 필드를 문서화하는 절에 사유를 명시**한다"), `spec/2-navigation/2-trigger-
    list.md`, `spec/2-navigation/3-schedule.md` §4
  - 상세: 실측 — `spec/2-navigation/3-schedule.md` §4 API 표는 `GET/POST/PATCH /api/schedules`
    의 페이지네이션 형식만 링크할 뿐 `trigger`/`workflow` 응답 shape 나 부재 사유를 전혀
    언급하지 않는다. `spec/2-navigation/2-trigger-list.md` 에도 `TriggerDto.workflow` 키
    생략 사유(생성 응답에만 없음)를 다루는 절이 없다. 사유는 현재 코드 JSDoc/`//` 주석에만
    존재한다 — §5.4 가 요구하는 "그 필드를 문서화하는 절" 은 nav-spec 쪽인데 거기 반영이
    없다.
  - **이미 알려져 추적 중**: 같은 plan 파일 line 812~821 이 이 정확한 갭을 `[ ]` 로 등재
    (`21_40_38` W1 + `22_25_00` W2 인용) — "반영 대상 spec 은 `2-navigation/2-trigger-
    list.md` 와 `3-schedule.md §4` 둘" 이라고 명시.
  - 제안: 신규 조치 불요 — planner 턴에서 두 nav-spec 문서에 참조 필드 shape + 키-생략
    사유(기준 (b))를 `IntegrationDto` 포인터 항목과 대칭으로 추가한다.

## 확인했으나 충돌 없음 (근거 기록)

- **비밀 스트립 4축** — `TRIGGER_RESPONSE_STRIP_COLUMNS`(`notificationSecretV2`/
  `chatChannelTokenV2`) · `NOTIFICATION_SIGNING_STRIP_KEYS`(`secret`/`secretRef`) ·
  `INTERACTION_RESPONSE_STRIP_KEYS`(`triggerToken`) · `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 는
  `secret-store.md §1.1` 이 이름으로 금지한 필드 집합(비대상 3필드 + ref 3종)과 정확히
  일치한다.
- **data model 필드 일치** — `TriggerDto` 신규 7필드(`chatChannelHealth` 등)는
  `1-data-model.md §2.8` 컬럼과, `IntegrationDto` 신규 6필드는 `§2.10`(mall_id·
  consecutive_network_failures·token_expires_at·last_used_at·last_rotated_at) 및
  `2-navigation/4-integration.md §9.1`(appUrl 파생 필드 서술)과, `KnowledgeBaseDto`·
  `AlertRuleDto` 신규 필드는 각각 `§2.11`·`§2.25` 와 이름·nullable 여부까지 일치한다.
- **Schedule↔Trigger NOT NULL 1:1** — `schedules.controller.ts` 의 "`Schedule.trigger_id` 는
  NOT NULL 1:1" 전제는 `1-data-model.md §2.9.1` 과 일치하고, `ScheduleDto.trigger` 는 현재
  §5.4 기본형(`@ApiProperty`, 상시 존재)으로 선언돼 그 불변식과도 정합한다.
  `ScheduleTriggerRefDto.workflow?` 는 §5.4 키-생략 기준 (b)(선택적 부가 컨텍스트, "생성
  응답에만 부재")에 해당하는 실측(4개 서비스 경로 e2e 로 고정)과 일치한다.
- **§5.4 검증 층 이원화** — `2-api-convention.md` "검증 층" 표(정적 `swagger-dto-contract-
  guard.ts` vs 런타임 `response-contract.ts` 의 역할 분담)와 `swagger.md §5-1`(엔티티
  패스스루 금지, 상호 인용)이 이번 diff 의 실제 구현 내용과 정확히 일치하며, 두 spec
  문서의 `code:` frontmatter 모두 두 검증자 파일 패턴을 등재하고 있다.
- **RBAC** — Trigger 비밀 필드는 `1-auth.md §3.2` 의 AuthConfig reveal 류 역할별 분리
  대상이 아니라 **전 역할 상시 비노출**이 정책(secret-store.md §1.1 — 예외 없음)이라,
  코드가 역할 무관하게 strip 하는 것과 충돌 없음. 이 diff 는 RBAC 매트릭스를 건드리지
  않는다.
- **INTERNAL_ERROR 표준화** — `schedules.controller.ts` 의 신규 500 은 최신 커밋에서
  `error-handling.md` 의 고정 문구·`code: 'INTERNAL_ERROR'` 로 정정되어 CWE-209 우회 없이
  일치한다(직전 라운드가 잡은 결함이 이 브랜치 자체에서 이미 해소됨).
- **계층 책임** — `TriggersService.sanitizeForResponse`(서비스 레이어) vs
  `SchedulesController.toResponse`(컨트롤러 레이어)가 서로 다른 위치에서 응답을 좁히지만,
  코드 주석이 그 차이의 근거(서비스 반환값이 `update()` 등 내부 로직에도 재사용된다는
  것)를 명시하고, `swagger.md`/`2-api-convention.md` 어디에도 "응답 축소는 반드시 이
  레이어에서" 라는 정식 규정이 없어 spec 위반이 아니라 설계 선택으로 판단.
- **요구사항 ID·상태 전이** — 이 diff 는 새 요구사항 ID 를 도입하지 않고 기존 ID(SS-SE-01,
  EIA-NX-07/11, CCH-SE-01, WH-MG-07/09)를 인용만 하며, 상태 머신(Integration.status,
  Trigger.chat_channel_health/notification_health enum)을 변경하지 않는다 — ID·상태 전이
  충돌 없음.

## 요약

이 diff 는 `spec/5-system/` 을 직접 건드리지 않는 코드 전용 PR 로, 이미 10라운드의
코드/일관성 리뷰를 거치며 발견된 WARNING(500 진단 문구 CWE-209 노출, `ScheduleDto.trigger`
키-생략형 오선언)이 모두 최신 커밋(`fdb9b7caf`)에서 해소됐다. 이번 독립 검토에서 대조한
data model·API 계약·secret-store 노출 금지 규범·RBAC·검증 층 경계 전 영역이 코드와 필드
단위로 정확히 일치했고, 남은 두 항목(secret-store.md §1 서술의 예정된 stale 화, nav-spec 의
§5.4 키-생략 사유 문서화 누락)은 새로 발견한 것이 아니라 이 브랜치 자신의 plan 트래커
(`plan/in-progress/spec-draft-nullable-notation-followups.md`)가 이미 등재해 둔, developer
권한 밖(spec 쓰기)이라 planner 턴을 기다리는 항목이다. CRITICAL 급 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다.

## 위험도

LOW

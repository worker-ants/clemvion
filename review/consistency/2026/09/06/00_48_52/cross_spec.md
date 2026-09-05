# Cross-Spec 일관성 검토 — sweep-response-contract-5ba0ad (impl-done, scope=spec/5-system/)

## 검토 범위 메모

`spec/5-system/` 자체의 diff 는 0개 파일 — 이 브랜치는 spec 을 바꾸지 않았다(선행 PR
`#1288`~`#1290` 이 이미 `origin/main` 에 병합돼 있다). 실제 델타는 코드 전용
31파일/2279줄(`git diff origin/main...HEAD -- codebase spec` 로 재확인, 표시는 31파일/1535줄
— 아래 실제 산출 기준) 이며, 스케줄/트리거 응답 DTO 축소(§5.4 스윕 후속) + 관련 e2e/unit 이다.
따라서 본 검토는 "target 문서"가 아니라 **이 diff 가 다른 spec 영역과 충돌하는지**를 코드
자체를 직접 읽어 판정했다 (`git -C <worktree> diff origin/main...HEAD -- codebase spec`).

교차 대조한 spec 문서: `spec/conventions/secret-store.md` §1·§1.1, `spec/1-data-model.md`
§2.8·§2.9·§2.9.1·§2.10·§2.11·§2.25, `spec/5-system/2-api-convention.md` §5.4(검증 층 표),
`spec/conventions/swagger.md` §5-1, `spec/2-navigation/2-trigger-list.md` §2.1·§2.3.1·§3,
`spec/2-navigation/3-schedule.md` §2.1·§4, `spec/5-system/14-external-interaction-api.md` §3.1·§7.1,
`spec/5-system/3-error-handling.md`(INTERNAL_ERROR 행 + Rationale), 및 대응 코드
(`codebase/backend/src/common/filters/http-exception.filter.ts`).

## 발견사항

- **[WARNING]** `SchedulesController.toResponse` 의 신규 500 이 `error-handling.md` 의
  INTERNAL_ERROR 일반화 원칙과 어긋난다
  - target 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts`
    (diff 신규 `private toResponse()`, `throw new InternalServerErrorException(...)`)
  - 충돌 대상: `spec/5-system/3-error-handling.md` (§1.2 근처 에러 코드 표의
    `INTERNAL_ERROR` 행 — "예상하지 못한 서버 오류" → 클라이언트 문구는
    "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." 고정) + 같은 문서의
    Rationale("5xx 마스킹(generic 500)과 일관된다") + 이를 구현하는
    `codebase/backend/src/common/filters/http-exception.filter.ts` 의 CWE-209 방지 설계 의도
    (동일 파일 주석: "내부 메시지(경로·스택·라이브러리 힌트)를 클라이언트로 echo 하지
    않는다").
  - 상세: `GlobalExceptionFilter` 는 **`HttpException` 인스턴스의 메시지는 마스킹하지
    않고 그대로 클라이언트 JSON `error.message` 에 echo**한다(마스킹은
    `HttpException` 이 아닌 순수 `Error` 에만 적용됨). 신규 코드는
    ```ts
    throw new InternalServerErrorException(
      `Schedule ${schedule.id} has no loaded trigger — ` +
        'schedule.trigger_id is NOT NULL, so this means the query forgot ' +
        'the join/relation (or the row is orphaned).',
    );
    ```
    를 문자열 인자로 던진다 — NestJS `InternalServerErrorException(string)` 은
    `getResponse()` 가 `{ statusCode, message: <그 문자열>, error: 'Internal Server Error' }`
    를 반환하므로, 이 상세 진단 문구(요청 스코프의 실제 `schedule.id` + ORM/DB 불변식에
    대한 내부 추론)가 **500 응답 바디에 그대로 노출**된다. `error-handling.md` 는
    `INTERNAL_ERROR` 를 "예상 못한 서버 오류 → 고정 일반 문구" 로 규정하는데, 이 값은
    사실상 예상치 못한 불변식 위반(정상 데이터로는 도달 불가하다고 코드 스스로 적음)을
    감지한 자리이면서도 **일반 문구가 아니라 상세 원인을 노출**한다.
    - 기존 코드베이스에 `InternalServerErrorException({ code, message })` 형태의 선례가
      있으나(`auth-oauth.service.ts`, `integration-oauth.service.ts`,
      `standard-oauth.strategy.ts` — 전부 "ENV 미설정" 류의 **정적·비민감 운영 정보**만
      담는다), 이번 건은 (a) `code` 필드 없이 문자열만 던져 `INTERNAL_ERROR` 로 흡수되고,
      (b) **요청별 동적 리소스 ID + 내부 쿼리/스키마 추론**까지 담아 기존 선례보다 노출
      범위가 넓다.
  - 제안: `code: 'SCHEDULE_TRIGGER_MISSING'` 같은 안정 코드 + 클라이언트용 일반 메시지
    (예: "일시적인 서버 오류입니다")로 좁히고, `schedule.id`·조인 추론 등 진단 정보는
    `this.logger.error(...)` 로만 남긴다 (같은 파일의 `GlobalExceptionFilter` 가 이미
    그 패턴을 4xx http-error 매핑에 쓰고 있다 — `mapHttpErrorLike` 참고). spec 변경은
    불필요(기존 `error-handling.md` 원칙을 코드가 따르면 되는 사안).

## 확인했으나 충돌 없음 (근거 기록)

- **비밀 스트립(§1.1 세 필드)** — `TRIGGER_RESPONSE_STRIP_COLUMNS`
  (`notificationSecretV2`/`chatChannelTokenV2`) · `NOTIFICATION_SIGNING_STRIP_KEYS`
  (`secret`/`secretRef`) · `INTERACTION_RESPONSE_STRIP_KEYS`(`triggerToken`) 는
  `spec/conventions/secret-store.md §1.1` 이 이름으로 금지한 필드 집합과 정확히 일치한다
  (§1.1 은 2026-09-05 `#1290` 에서 이미 등재됐고, 이 diff 가 코드를 그 규범에 맞춘다).
- **Schedule.trigger NOT NULL 1:1** — `schedules.controller.ts` 의
  "`Schedule.trigger_id` 는 NOT NULL 1:1" 주장은 `spec/1-data-model.md §2.9.1`
  ("Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑")과 일치.
- **TriggerDto 신규 health/rotation 필드** (`chatChannelHealth`/`chatChannelLastError`/
  `chatChannelSetupAt`/`chatChannelRotatedAt`/`notificationHealth`/`notificationLastError`/
  `notificationRotatedAt`) — `spec/1-data-model.md §2.8` 컬럼 정의,
  `spec/2-navigation/2-trigger-list.md §2.1·§2.3.1`, `spec/5-system/14-external-interaction-api.md
  §3.1`(EIA-NX-07/11) 전부와 이름·의미가 일치.
- **AlertRule/Integration/KnowledgeBase 신규 필드** — 각각 `spec/1-data-model.md §2.25`,
  `§2.10`, `§2.11` 의 컬럼 정의와 nullable 여부까지 일치 (`embeddingModel` derived 필드는
  diff 이전부터 이미 선언돼 있어 diff 대상 아님).
- **§5.4 검증 층 이원화** — `spec/5-system/2-api-convention.md` "검증 층" 표와
  `spec/conventions/swagger.md §5-1` 이 서로를 인용하는 경계 서술이 diff 의
  `swagger-dto-contract-guard.ts`/`response-contract.ts` 변경 내용과 일치, 양쪽 `code:`
  frontmatter 에도 두 파일 패턴이 모두 등재돼 있다.
- **RBAC** — Trigger 비밀 3필드는 `spec/5-system/1-auth.md §3.2` 의 AuthConfig
  Reveal 류 역할별 분리 대상이 아니라 **전 역할 상시 비노출**이 정책이라(§1.1: "응답 DTO 에
  선언되어서도, 응답 바디에 실려서도 안 된다" — 예외 없음), 코드가 역할 무관하게 strip 하는
  것과 충돌 없음.
- **계층 책임(컨트롤러 vs 서비스에서 응답 축소)** — `TriggersService.sanitizeForResponse`
  는 서비스 레이어, 신규 `SchedulesController.toResponse` 는 컨트롤러 레이어에서 수행한다.
  두 위치가 다르지만 `spec/conventions/swagger.md`·`2-api-convention.md` 어디에도 "응답 축소는
  반드시 이 레이어에서" 라는 정식 규정이 없고, 코드 주석이 컨트롤러를 택한 이유(서비스
  반환값이 내부 로직에도 재사용됨)를 명시적으로 근거 지었다 — spec 위반이 아니라 설계
  선택의 영역으로 판단.

## 요약

이 diff 는 `spec/5-system/` 을 직접 건드리지 않는 코드 전용 PR 이며, 실제로 대조해 보면
`secret-store.md §1.1`·`1-data-model.md`(Schedule/Trigger/AlertRule/Integration/KnowledgeBase)·
`2-api-convention.md §5.4`·`swagger.md §5-1`·`2-navigation/{2-trigger-list,3-schedule}.md` 전
영역과 필드명·nullable 여부·검증 층 경계까지 정확히 일치한다 — 이번 스윕은 선행 merge
(`#1288`~`#1290`)가 이미 등재한 규범을 코드에 맞춘 후속 작업으로 보인다. 유일하게 발견된
간극은 스펙 충돌이 아니라 **신설 방어 코드(orphaned schedule.trigger 가드)가 500 응답에
상세 진단 문구를 그대로 노출**하는 지점으로, `error-handling.md` 의 INTERNAL_ERROR
일반화 원칙과 어긋난다(WARNING). CRITICAL 급 데이터 모델·API 계약·요구사항 ID·상태 전이·
RBAC 충돌은 발견되지 않았다.

## 위험도

LOW

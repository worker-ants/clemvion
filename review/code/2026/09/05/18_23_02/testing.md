# 테스트(Testing) 리뷰 — §5.4 응답-계약 스윕 (14개 엔드포인트 배선 + 트리거 secret 유출 수정)

## 발견사항

- **[CRITICAL]** `SchedulesController.findOne` (`GET /api/schedules/:id`) — 이 PR 이 바로 이 메서드에
  `this.toResponse(...)` (트리거 secret 좁히기) 를 새로 추가했는데, **이 엔드포인트를 때리는 테스트가
  저장소 전체에 단 하나도 없다** (unit·e2e 모두). 실측: `grep -rn "api/schedules/" codebase/backend/test/*.ts`
  결과 `preview`·`PATCH /:id`·`DELETE /:id` 는 있어도 `GET /:id` 패턴은 0건.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — `findOne` 핸들러
    (`@Get(':id')`, `this.toResponse(await this.schedulesService.findById(id, workspaceId))` 호출부)
  - 상세: 응답 경계 narrowing 이 제대로 동작하는지, 애초에 200 을 반환하는지조차 자동화된 검증이 없다.
    이 메서드가 고쳐진 이유(§5.4 스윕이 발견한 트리거 secret 유출)를 감안하면 가장 먼저 회귀 테스트가
    붙어야 할 자리인데 비어 있다.
  - 제안: `schedule-trigger.e2e-spec.ts` 에 `GET /api/schedules/:id` 를 때리는 케이스를 추가하고
    `assertMatchesContract(res.body.data, await contractForDto(ScheduleDto))` 를 동봉한다.

- **[WARNING]** `SchedulesController.findAll` (`GET /api/schedules`, 목록) — e2e 테스트 J 등 여러 곳에서
  이 엔드포인트를 반복 호출하지만(정렬·격리 검증), **`assertMatchesContract` 를 부르는 곳이 한 군데도
  없다.** `toResponse` 를 `.map()` 으로 적용하는 이 자리(배열 매핑)가 바로 secret 유출 수정이 실제로
  걸리는 경로인데, 리스트 응답에서 `trigger.notificationSecretV2` 가 새어 나와도 잡아낼 자동 테스트가
  없다. `ScheduleDto` 를 대상으로 한 `assertMatchesContract` 호출은 이 diff 전체에서
  `schedule-trigger.e2e-spec.ts` 테스트 C(`POST` 단건 생성 응답) 단 1곳뿐이다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — `findAll` 핸들러
    (`return { ...page, data: page.data.map((s) => this.toResponse(s)) };`)
  - 제안: 테스트 J(또는 새 케이스)에서 `GET /api/schedules` 응답 배열의 원소 하나에
    `assertMatchesContract(ascRows[0], await contractForDto(ScheduleDto))` 를 추가.

- **[WARNING]** `SchedulesController.update` (`PATCH /api/schedules/:id`, 테스트 D) — 이 경로도
  `toResponse` 를 거치도록 이번 diff 가 바꿨지만, 테스트 D 는 `nextRunAt` 재계산만 확인하고
  `assertMatchesContract` 호출이 없다. `create`/`findAll`/`findOne`/`update` 네 호출부 중 실제로
  계약 검사를 받는 것은 `create` 하나뿐이다 — 나머지 세 자리는 "같은 헬퍼를 쓰니 안전하다" 는
  가정에 기대고 있는데, 호출부 자체(예: 특정 핸들러만 `toResponse` 호출을 빠뜨리는 실수)는 그
  가정으로 못 잡는다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `it('D. PATCH cron → nextRunAt 재계산', ...)`
  - 제안: PATCH 응답에도 동일한 `assertMatchesContract` 한 줄을 추가.

- **[WARNING]** 단위 테스트 수준에서 `SchedulesController.toResponse` 와
  `TriggersService.sanitizeForResponse` 의 **엔티티 컬럼 스트립 로직 자체를 검증하는 테스트가 없다.**
  - `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` 는 actor(userId) 배선만
    검증하고(`create`/`update`/`remove`), `toResponse` 는 언급조차 없다 — mock 서비스가 반환하는
    fixture 에 `trigger` 필드 자체가 없어 narrowing 로직이 전혀 실행되지 않는다.
  - `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 의 `findOneDetail`/`findAll` 관련
    `describe` 블록(예: `'schedule 타입 + 매칭 schedule 존재 시...'` 등)은 트리거 fixture 를
    `{ id, workspaceId, type, name }` 처럼 최소 필드로만 만들고 `notificationSecretV2`/
    `chatChannelTokenV2` 를 아예 채우지 않는다 → `expect.objectContaining(...)` 은 "있어야 할 필드가
    있다" 만 확인하고 "없어야 할 필드가 없다" 는 확인하지 않으므로, `sanitizeForResponse` 의 신규
    `TRIGGER_RESPONSE_STRIP_COLUMNS` 삭제 로직이 되돌아가도 이 unit 테스트들은 전부 그대로 통과한다.
  - 이 보안 수정에 대한 실제 커버리지는 e2e 1곳(`chat-channel-trigger-create.e2e-spec.ts`)과
    `schedule-trigger.e2e-spec.ts` 테스트 C 뿐이며, 둘 다 인프라 기동이 필요해 피드백 루프가 느리다.
  - 제안: `triggers.service.spec.ts`/`schedules.controller.spec.ts` 에 각각 `notificationSecretV2: 'leaked'`,
    `chatChannelTokenV2: 'secret://...'` 를 채운 fixture 를 넣고 반환값에 그 키가 **존재하지 않음**을
    (`expect(result).not.toHaveProperty('notificationSecretV2')` 식으로) 단언하는 빠른 unit 테스트를
    추가하면, e2e 없이도 이 회귀를 즉시 잡을 수 있다.

- **[WARNING]** `contractForDto` 의 신규 promise 메모이제이션(모듈 스코프 `Map`, in-flight promise 캐시,
  실패 시 evict-후-재시도)에 대한 테스트가 전혀 없다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:406-422` (`contractForDto`/
    `buildContractForDto`)
  - 상세: `response-contract.spec.ts` 의 이번 diff 는 `allowMissing` 옵션 테스트만 추가했고
    (`grep cache` 결과 0건), 캐시 재사용·동시 호출 시 중복 부트스트랩 방지·실패 후 재시도 같은,
    문서 주석이 스스로 설계 근거로 내세운 동작은 어느 것도 검증되지 않는다. 이 저장소의 관례
    (설계 근거는 서술 전 뮤테이션/실측으로 반증해 보라)에 비추면, "그러지 않으면 매번 비용만 든다"
    는 근거 자체가 검증되지 않은 상태로 남는다.
  - 제안: 같은 `Type` 로 두 번 호출했을 때 두 번째 호출이 캐시된 동일 `Promise` 참조를 반환하는지
    (또는 `buildSwaggerDocument`/모듈 부트스트랩 호출 횟수를 spy 로 세어 1회인지), 그리고 실패하는
    DTO(예: 프로브 컨트롤러 생성이 던지는 케이스)로 한 번 실패시킨 뒤 재호출이 캐시를 재사용하지
    않고 다시 시도하는지를 검증하는 unit 테스트를 추가한다.

- **[INFO]** CHANGELOG/`plan/in-progress/spec-draft-nullable-notation-followups.md` 가 "스트립을
  되돌린 뮤턴트에 `TriggerDto` 2건, `ScheduleDto` 18건(중첩 경로 `trigger.notificationSecretV2`
  포함)이 RED" 라는 구체적 수치를 근거로 제시하는데, 현재 커밋된 테스트 스위트에서 `ScheduleDto` 를
  대상으로 한 `assertMatchesContract` 호출은 `schedule-trigger.e2e-spec.ts` 테스트 C **1곳뿐**이다
  (`grep -rln "ScheduleDto\b"` 로 전수 확인). "18건" 이 어느 테스트들을 가리키는지 diff 만으로는
  재현·확인이 안 된다 — 개발 중 1회성 수동 뮤테이션 실행이었다면(즉 위 WARNING 들이 지적하는 것처럼
  실제로는 회귀 시 1곳만 RED 가 난다면) CHANGELOG 문구가 실제 방어망보다 넓게 서술된 것이다.
  - 위치: `CHANGELOG.md` 신규 섹션("트리거 회전 secret 이 두 엔드포인트로 나갔다") /
    `plan/in-progress/spec-draft-nullable-notation-followups.md` "스윕 1차" 항목
  - 제안: 실제로 몇 개 테스트가 RED 로 뒤집히는지 재실측하거나(위 WARNING 들의 갭을 먼저 메운 뒤),
    수치를 못 지킨다면 "1곳(e2e)만 고정한다" 로 정정.

- **[INFO]** `IntegrationDto` 신규 6필드(`appUrl`·`mallId`·`tokenExpiresAt`·`lastRotatedAt`·
  `lastUsedAt`·`consecutiveNetworkFailures`) 는 전부 `ApiPropertyOptional` 이라, 값이 채워지지 않은
  상태(현재 `assertMatchesContract` 가 걸리는 유일한 자리인
  `ai-agent-tool-payload-warning.e2e-spec.ts` 의 `http` 타입 통합 — cafe24/makeshop 전용 필드가
  비어 있는 케이스)에서도 계약 위반 없이 통과한다. "필드가 존재할 때 타입이 선언과 맞는가" 축은
  cafe24/makeshop 통합처럼 이 필드들이 실제로 채워지는 fixture 로만 확인되는데, 그런 e2e 호출은
  없다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (신규 6필드) / `codebase/backend/test/ai-agent-tool-payload-warning.e2e-spec.ts` (유일한
    `assertMatchesContract(..., IntegrationDto)` 호출부)
  - 제안: 값이 채워진 케이스는 이미 등재된 "§5.4 스윕 2차" 백로그와 별개로, 기존 cafe24 e2e
    (`integration-cafe24-precheck.e2e-spec.ts` 등)에 이 필드들이 채워지는 통합 조회 지점을 찾아
    `assertMatchesContract` 를 얹으면 저비용으로 닫을 수 있다.

## 긍정적으로 확인된 부분 (회귀 안전성)

- `response-contract.spec.ts` 의 신규 `allowMissing` 테스트 3건(적용/이름 정확 일치/undeclared 와
  분리)은 각각 독립적 의도를 명확히 표현하고, "면제 없이는 위반" 캐너리를 명시적으로 먼저 확인해
  vacuous 를 스스로 방지하는 좋은 패턴이다.
- `workflow-crud.e2e-spec.ts` 의 `allowMissing: ['formatVersion']` 사용은 spec 문서의 Planned 갭을
  주석으로 인용하며 "갭을 닫는 PR 이 이 줄을 지우는 것" 이라고 명시해 추적 가능성이 좋다.
- `alerts-threshold-wire-type.e2e-spec.ts`/`knowledge-base.e2e-spec.ts` 는 새로 선언된 DTO 필드들이
  실제로 채워지는 지점에 `assertMatchesContract` 를 걸어 두어, 이 두 DTO 는 신규 필드의 타입까지
  실질적으로 검증된다.
- `SchedulesController.toResponse` 가 **화이트리스트(허용 필드만 새 객체로 조립)** 방식이라
  `TriggersService.sanitizeForResponse` 의 블랙리스트(`delete`) 방식보다 구조적으로 더 안전하다 —
  새 비밀 컬럼이 `Trigger` 엔티티에 추가돼도 `toResponse` 쪽은 자동으로 새지 않는다(반대로
  `TRIGGER_RESPONSE_STRIP_COLUMNS` 는 신규 컬럼마다 수동 추가가 필요해 "빼먹으면 샌다" 실패 모드가
  남아 있다 — 이미 소스 주석이 그 위험을 인지하고 있음).
- e2e 테스트들은 `uniqueEmail`/`uniqueName` 헬퍼로 각 케이스를 격리하고 있어 테스트 간 의존성 문제는
  발견되지 않았다.

## 요약

이번 diff 의 핵심(트리거 secret 이 엔티티 컬럼·조인을 타고 새던 것을 막는 수정)은 보안적으로
타당하고 화이트리스트 방식(`ScheduleDto.trigger` 좁히기)은 견고하지만, 그 수정을 지키는 회귀
테스트는 **네 개 호출부(`findAll`/`findOne`/`create`/`update`) 중 `create` 단 하나만** 실제로
`assertMatchesContract` 로 걸려 있고, `findOne`(`GET /api/schedules/:id`)은 아예 어떤 테스트도
때리지 않는다. 단위 테스트(`schedules.controller.spec.ts`, `triggers.service.spec.ts`)의 트리거
fixture 들은 애초에 유출 대상 필드를 포함하지 않아, 이 PR 이 고친 바로 그 로직이 되돌아가도 unit
테스트는 전부 그린으로 남는다 — 방어가 순전히 (부분적인) e2e 커버리지에만 의존한다. 신규
`contractForDto` promise 캐시 로직도 스스로 내세운 설계 근거(중복 부트스트랩 방지, 실패 후 재시도)를
검증하는 테스트가 없다. CHANGELOG/plan 의 "18건 RED" 수치는 현재 커밋된 테스트로 재현되지 않아
과장 서술 가능성이 있다.

## 위험도

HIGH

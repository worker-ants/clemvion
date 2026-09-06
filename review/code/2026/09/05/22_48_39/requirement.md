# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `ScheduleTriggerRefDto.workflow` / `TriggerWorkflowRefDto.workflow` 의 JSDoc 이
  "생성·수정 응답에는 이 관계가 로드되지 않는다" 라고 단정하지만, **PATCH(수정) 경로는 실제로
  워크플로우가 로드된 상태로 응답에 실린다** — 코드·TypeORM 소스를 직접 추적해 확인했다.
  - 위치:
    - `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:38-40`
      (JSDoc: "생성·수정 응답은 방금 저장한 트리거를 붙이므로 이 관계가 **로드되지 않는다**")
    - `codebase/backend/src/modules/schedules/schedules.service.ts:126-135`(`findById` 가
      `relations: ['trigger', 'trigger.workflow']` 로 조회), `:213-220`(`update()` 가 그
      `findById` 결과의 `schedule.trigger` 를 그대로 씀), `:263`(`saved.trigger = trigger ?? schedule.trigger`)
    - `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:89-93`
      (JSDoc: "목록·단건 조회 경로에서만 관계가 로드된다. 생성 응답에는 없다")
    - `codebase/backend/src/modules/triggers/triggers.service.ts:226-235`(`findById` 가
      `relations: ['workflow']`), `:342-348`(`update()` 시작에서 `this.findById(id, workspaceId)`
      호출 — 이 결과의 `trigger.workflow` 가 이미 로드돼 있음), `:604-615`(`sanitizeForResponse`
      가 `trigger.workflow` 를 그대로 좁혀서 실음)
  - 상세: `update()` 두 곳(스케줄·트리거) 모두 **먼저 `findById()`(또는 그와 동등한, `relations`
    에 `workflow` 를 포함한 조회)로 엔티티를 읽고, 그 위에 필드를 덮어쓴 뒤 `save()` 한다.**
    TypeORM 의 `EntityManager.save()` 는 `new EntityPersistExecutor(...).execute().then(() => entity)`
    로 구현돼 있다(`node_modules/typeorm/entity-manager/EntityManager.js:207` 확인) — 즉
    **호출자가 넘긴 그 객체 참조를 그대로 돌려준다.** `save()` 이전에 이미 로드돼 있던
    `.workflow` 프로퍼티는 `save()` 가 지우거나 재조회로 대체하지 않으므로 그대로 살아남는다.
    따라서:
    - `SchedulesService.update()`: `schedule.trigger`(= `findById` 의 `relations: ['trigger',
      'trigger.workflow']` 로 로드된 트리거)를 `trigger` 변수로 잡아 `name`/`isActive` 를
      바꾼 뒤 `triggerRepository.save(trigger)` 하고, `saved.trigger = trigger ?? schedule.trigger`
      로 응답에 그대로 건다. `trigger.workflow` 가 이미 채워져 있으므로
      `SchedulesController.toResponse()` 의 `...(t.workflow ? { workflow: { name: t.workflow.name } } : {})`
      가 참이 되어 **`PATCH /api/schedules/:id` 응답의 `trigger` 에 `workflow` 키가 실린다.**
      (스케줄에 연결된 트리거는 `workflowId` 가 NOT NULL 이라 `t.workflow` 는 항상 채워진다.)
    - `TriggersService.update()`: `const trigger = await this.findById(id, workspaceId)`
      (relations: `['workflow']`)로 시작해 `Object.assign(trigger, defined, {...})` 로
      필드만 바꾸고 저장한다. `chatChannel` 이 없는(가장 흔한) PATCH 요청에서는 재조회 분기를
      타지 않으므로 `result = saved`(= `trigger`, `.workflow` 보존)가 그대로
      `sanitizeForResponse` 로 들어가 **`PATCH /api/triggers/:id` 응답에도 `workflow` 가 실린다.**
    - 두 JSDoc 모두 "생성·수정(create/update) 응답에는 없다" 라고 명시적으로 단정하는데,
      실제로는 **create() 만 맞고 update() 는 틀리다** — `create()` 쪽은 정말로 방금 만든
      엔티티(관계 미로드)를 쓰므로 없는 것이 맞지만, `update()` 쪽은 `findById` 를 거치므로
      다르다.
    - 이 편차는 **기능 결함은 아니다** — `workflow` 필드는 두 DTO 모두
      `@ApiPropertyOptional`(키 생략형)이라 `assertMatchesContract` 도 이 초과 존재를 위반으로
      잡지 않고, 응답에 실리는 값(워크플로우 id/name)도 민감 정보가 아니다. 하지만 "의도"를
      기술하는 주석이 실제 동작과 다르고, 이 PR 이 배선한 e2e 계약 대조도 이 특정 클레임(수정
      경로에서 workflow 가 없다)을 **한 번도 양성/음성으로 단언하지 않는다** —
      `schedule-trigger.e2e-spec.ts` 의 C-3 테스트는 `POST`(생성) 응답의 `trigger` 키 3개만
      확인하고, PATCH 테스트들은 `assertMatchesContract` 만 돌 뿐 `Object.keys(...trigger)` 를
      단언하지 않는다. `triggers.service.spec.ts` 의 update 관련 테스트들도 `workflow` 를
      다루지 않는다. 이 PR 이 스스로 여러 차례 지적한 "vacuous 검증/근거 미실측" 패턴과 같은
      종류다 — 문서가 세운 클레임이 검증되지 않은 채 남아 있다.
  - 제안: 둘 중 하나로 정정한다. (1) 실제 동작(수정 경로에도 `workflow` 가 실릴 수 있음)에
    맞게 JSDoc 을 고치고 e2e 로 그 형태를 양성 고정하거나, (2) "수정 응답에는 없다" 는 의도가
    맞다면 `update()` 응답 경계에서 `workflow` 를 명시적으로 제거(narrowing)하도록 고치고
    회귀 테스트를 추가한다. 어느 쪽이든 지금처럼 "주석은 단정하는데 아무 테스트도 확인하지
    않는" 상태로 두지 않는 것이 이 PR 의 나머지 부분이 세운 기준과 일치한다.

- **[INFO]** `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 설명하는 JSDoc 블록이 이번 diff의 마지막
  커밋이 그 사이에 `INTERACTION_RESPONSE_STRIP_KEYS` 상수(및 그 자신의 JSDoc)를 끼워 넣으면서
  다시 대상 선언에서 떨어져 나갔다 — `review/code/2026/09/05/19_08_18/documentation.md` 가
  이미 한 번 지적하고 고친 바로 그 패턴(새 상수를 기존 JSDoc 과 대상 선언 사이에 삽입)이
  같은 파일에서 재발했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:79-93`(`TRIGGER_RESPONSE_STRIP_COLUMNS`
    를 설명하는 JSDoc, "응답에서 제거할 **엔티티 컬럼**…") 바로 다음 줄부터 `:94-108` 에
    `INTERACTION_RESPONSE_STRIP_KEYS` 의 JSDoc 이 끼어 있고, `:109` 에
    `INTERACTION_RESPONSE_STRIP_KEYS` 선언이, 그 다음에야 `:111-114` 에
    `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언이 온다. `git blame` 으로 확인: `:79-93` 은
    `a6f5826804`(19:37, 이전 라운드의 문서화 수정 커밋)가 썼고, `:94-108` 은 이번 diff에
    포함된 최신 커밋 `66a2510fd9`(22:48, "§1.1 이 세 필드를 열거했는데 둘만 닫았다")가 삽입했다.
  - 상세: 기능에는 영향 없음(보안 로직 자체는 정확함, 이미 검증됨). 사람이 읽을 때 "응답에서
    제거할 엔티티 컬럼" JSDoc 바로 아래 `config.interaction 에서 제거할 키` 라는 별개의
    JSDoc 이 나오고 그 아래 `INTERACTION_RESPONSE_STRIP_KEYS` 선언이 나와, 앞 JSDoc 이 어떤
    심볼을 설명하는지 시각적으로 혼동을 준다. 직전 문서화 리뷰가 "다음 라운드에서도 재발할
    여지가 있다" 고 명시적으로 경고했던 패턴이 실제로 재발한 사례라 기록해 둔다(요구사항
    reviewer 범위는 아니지만 문서화 reviewer 가 같은 파일을 볼 것이므로 교차 확인용).
  - 제안: `:79-93` JSDoc 블록을 `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언(`:111`) 바로 위로 옮긴다.

## 검증한 항목 (문제 없음 확인)

- **엔티티 ↔ DTO 필드 정합성**: `AlertRuleDto.createdBy/lastTriggeredAt`,
  `IntegrationDto.appUrl/mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt/consecutiveNetworkFailures`,
  `KnowledgeBaseDto.documentCount/embeddingModelConfigId/rerankMode/rerankCandidateK/
  rerankScoreThreshold/rerankConfigId/rerankLlmConfigId`, `TriggerDto` 의 7개 health/rotation
  필드 — 전부 해당 엔티티의 `nullable`/`default` 선언과 DTO 의 `nullable: true`/필수 여부가
  정확히 일치함을 각 엔티티 파일을 직접 열어 대조했다.
- **secret-store.md §1.1 시행**: 스펙이 이름으로 지목한 트리거 관련 세 필드
  (`triggerToken`·`notification_secret_v2`·`chat_channel_token_v2`) 와 두 ref(`botTokenRef`/
  `secretRef`) 가 `TRIGGER_RESPONSE_STRIP_COLUMNS`/`INTERACTION_RESPONSE_STRIP_KEYS`/
  `NOTIFICATION_SIGNING_STRIP_KEYS`/`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 전부에 정확히 대응됨을
  확인했다.
- **1-data-model.md §2.9.1**: "Schedule.trigger_id 는 NOT NULL — 반드시 Trigger 와 1:1 매핑"
  이라는 spec 본문 문장이 `ScheduleDto.trigger` 를 "상시 존재"(기본형)로 선언한 근거 주석과
  정확히 일치함을 spec 원문 대조로 확인했다.
- **2-navigation/1-workflow-list.md**: `formatVersion` 이 "미구현 (Planned)" 이라는 spec 문장이
  `workflow-crud.e2e-spec.ts` 의 `allowMissing: ['formatVersion']` 사용 근거와 정확히 일치.
- **`allowMissing` 옵션**: `response-contract.ts` 의 구현(`path` 정확 매칭, `undeclared` 축과
  독립)과 `response-contract.spec.ts` 의 4개 테스트(면제 안 하면 위반·이름 불일치 시 비면제·
  중첩 경로 정확 매칭·undeclared 는 별도 축)가 vacuous 하지 않게 "면제 없이는 위반" 캐너리를
  포함해 실제로 그 축을 검증함을 확인했다.
- **`contractForDto` 메모이제이션**: 동일 참조 반환·실패 promise 미캐싱(재시도 가능) 두 계약을
  `response-contract.spec.ts` 의 3개 테스트가 각각 실제로 단언함(단순 성공 경로만 보는
  vacuous 패턴이 아님)을 확인했다.
- **§5.4 금지 조합 래칫**(`swagger-dto-contract-guard.ts`/`.spec.ts`): 새 fixture
  (`optional-nullable.fixture.ts`)가 위반 2형태·준수 2형태를 실제로 담고, 대조군 테스트가
  `found.map(field)` 로 무엇을 집었는지 직접 단언하며, `EXPECTED_OPTIONAL_NULLABLE_DRIFT`
  배열 길이(78)가 CHANGELOG 의 "78건" 서술과 정확히 일치함을 실측(스크립트로 배열 파싱)
  확인했다.
- **`isActive` 무관 트리거 응답 대칭**(`schedules.service.ts` `create()`/`update()`): 두 자리
  모두 `saved.trigger = ...` 대입이 `if (isActive)`/`if (schedule.isActive)` 밖으로 옮겨져
  있어, 이제 응답 형태가 `isActive` 값에 좌우되지 않음을 확인. `schedule-trigger.e2e-spec.ts`
  의 C-3 테스트가 생성·PATCH 비활성화 양쪽을 실제로 고정한다.
- **`TriggersService.update()` 의 `undefined` 필드 보존**: `Object.entries(rest).filter(([, v])
  => v !== undefined)` 로 `useDefineForClassFields` 로 인한 own-`undefined` 덮어쓰기 결함이
  실제로 고쳐졌고, unit 테스트(`PATCH 에서 생략된 필드는 로드된 값을 유지한다`)가 이를
  직접 단언함을 확인했다.

## 요약

이번 diff는 §5.4 응답-계약 검증을 14개 e2e로 넓히며 드러난 두 건의 실제 secret 유출(트리거
회전 secret 의 엔티티 컬럼 미스트립 + 스케줄 조인을 통한 2차 유출)을 응답 경계에서 막고,
그 과정에서 발견된 23개 필드의 DTO 선언 지연(wire 불변, 문서만 실제에 맞춤)을 정정하는
작업이다. 엔티티-DTO 필드 정합성, secret-store.md §1.1 시행 범위, `allowMissing`/
`contractForDto` 메모이제이션·§5.4 금지조합 래칫 3개의 새 인프라 모두 실제 코드·spec 원문과
line-level 로 대조해 정확함을 확인했고, vacuous 검증(과거 라운드가 반복 지적한 패턴) 흔적도
찾지 못했다. 유일한 실질 발견은 `ScheduleTriggerRefDto.workflow`/`TriggerWorkflowRefDto.workflow`
의 JSDoc 이 "생성·수정 응답에는 없다" 고 단정하지만, `update()` 경로가 `findById()`(relations
포함)로 로드한 엔티티를 그대로 `save()`·재사용하기 때문에(TypeORM 소스로 확인) 실제로는
수정 응답에도 workflow 가 실릴 수 있다는 점이다 — 기능 결함이나 보안 문제는 아니고(필드가
optional 이라 계약 위반도 아니며 값도 비민감) 어떤 e2e/unit 도 이 구체적 클레임을 검증하지
않는다는 점에서, 문서-구현 간 괴리를 방치하지 않는다는 이 PR 자신의 기준에 비춰 정정이 필요한
항목으로 판단한다.

## 위험도

LOW

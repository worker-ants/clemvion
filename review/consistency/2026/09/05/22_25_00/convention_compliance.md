# 정식 규약 준수 검토 — convention_compliance

## 검토 범위

- target: `spec/5-system/` (`--impl-done`, diff-base `origin/main`)
- scope 델타: `spec/5-system/**` 파일 변경 **0건** — 정상 (이 브랜치는 코드 전용 PR).
- 실제 검토 대상: `git diff origin/main...HEAD -- codebase/**` 30개 파일 / 1,210줄
  (프롬프트가 예산 초과로 diff 본문·`spec/5-system/*` 대부분·`spec/conventions/*` 전부를
  절단했으므로, HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)를
  절대경로로 직접 `git diff`/`Read` 해 확인했다.)
- 이 브랜치는 같은 날 이미 4라운드(`18_23_03`·`19_08_19`·`20_45_39`·`21_40_38`)의
  convention_compliance 검토를 거쳤다. 그 결론(LOW, INFO 2건)을 재확인하고, 그 이후 신규
  커밋(`67881bbd4` 이후 `7e85da873`)의 **순증분만** 새로 검토했다.
- 대조한 정식 규약: `spec/conventions/swagger.md`(§1-4/§1-6/§3/§5-1/§6),
  `spec/conventions/secret-store.md`(§1/§1.1), `spec/5-system/2-api-convention.md §5.4`
  (부재 표현·검증 층), `spec/conventions/spec-impl-evidence.md`(`code:` 커버리지).

## 발견사항

- **[WARNING]** `ScheduleDto.trigger` 필드 JSDoc 에 내부 리뷰 라운드 참조가 그대로 실려
  **공개 OpenAPI `description` 으로 나간다** (신규 — 이번 라운드가 처음 잡음)
  - target 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`
    95~106행, `ScheduleDto.trigger` 필드의 `/** ... */` docblock
    (도입 커밋: `7e85da873`, 이번 라운드가 처음 검토하는 신규 커밋)
  - 위반 규약: `spec/conventions/swagger.md §3` "JSDoc 은 공개 OpenAPI 로 나간다 — 내부
    서사를 담지 않는다" (2026-09-05 규약화). 표: *"왜 이 값이 이 타입인지의 경위,
    리뷰·PR 참조 → 바로 위 `//` 주석"*.
  - 상세: 해당 필드 JSDoc 마지막 문장이 `"종전엔 키 생략형으로 선언했는데 §5.4 는 그
    형태에 사유 문서화를 요구하고, 실측은 부재 경로가 없다고 말한다
    (review/consistency/2026/09/05/21_40_38 W1)."` 이다. `trigger` 는 **필드** 데코레이터
    (`@ApiProperty`) 바로 위 JSDoc 이고, `nest-cli.json` 의 `@nestjs/swagger` 플러그인이
    `introspectComments: true` 로 **필드 레벨** JSDoc 을 `description` 에 그대로 승격한다
    (이 승격 동작 자체는 `19_08_19`·`21_40_38` 라운드가 이미 실측 확인했고 이번 라운드도
    같은 플러그인 설정을 재확인함 — `codebase/backend/nest-cli.json`). 즉 `GET/POST/PATCH
    /api/schedules` 의 OpenAPI 문서(및 Swagger UI)에 `review/consistency/2026/09/05/21_40_38`
    라는 **내부 리뷰 아티팩트 경로**가 소비자에게 그대로 노출된다 — 비밀 유출은 아니지만
    §3 이 명시적으로 금지한 "정정 경위·리뷰 참조" 패턴 그 자체다. 같은 파일 안
    `ScheduleTriggerRefDto.workflow` 필드(35~44행)는 같은 §5.4 사유 문서화 요구를
    리뷰 참조 없이 소비자 관점으로만 적어 대조군이 된다 — 무엇이 "소비자가 알아야 하는
    것"이고 무엇이 "경위"인지는 같은 파일 안에서 이미 갈라져 있다.
  - 제안: `(review/consistency/2026/09/05/21_40_38 W1)` 절만 필드 선언 바로 위 `//`
    주석으로 옮기고, `/** */` 에는 "연결된 트리거 — 참조 수준으로 좁혀진 형태이며 항상
    존재한다(`Schedule.trigger_id` NOT NULL 1:1)" 정도의 소비자 관점 설명만 남긴다.
    `§5.4 기준 (b)` 처럼 **spec 규칙 자체**를 인용하는 것은 문제가 아니다 — 문제는
    `review/consistency/...` 같은 **휘발성 내부 아티팩트 경로**를 공개 문서에 남기는
    것이다.

- **[INFO]** 클래스 레벨 JSDoc 에 내부 서사가 섞인 사례가 **3번째로 반복**된다 (재발견 —
  전 2건은 `21_40_38` 라운드에서 이미 INFO 로 기록됨, 실질 wire 유출 없음)
  - target 위치:
    - `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
      9~17행, `TriggerWorkflowRefDto` 클래스 docblock (신규 — `7e85da873`)
    - `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`
      3~14행, `ScheduleTriggerWorkflowRefDto` 클래스 docblock (기존 — `21_40_38` 이 이미 지적)
  - 위반 규약: 위와 동일 (`swagger.md §3`).
  - 상세: 두 클래스 모두 도입 경위("종전 응답은 조인된 Trigger 엔티티 전체를 실어
    보냈고... §5.4 응답-계약 스윕이 ... 검출해 드러났다")와 리뷰 참조
    (`review/code/2026/09/05/21_40_37` 등)를 `/** */` 에 담고 있다. 다만 **클래스 레벨**
    JSDoc 은 `introspectComments` 가 `description` 으로 승격하지 않는다는 점이
    `19_08_19`·`21_40_38` 라운드에서 이미 실측 확인됐고, 이번 라운드가 신규로 늘어난
    `TriggerWorkflowRefDto` 에도 같은 조건(클래스 레벨, `@ApiExtraModels` 등으로 참조되지
    않음)이 그대로 적용돼 공개 wire 유출은 없다. 다만 같은 규약이 **같은 날 세 번째로
    같은 형태로 위반**되고 있다는 점은, 위 WARNING 항목(필드 레벨 유출)과 근본 원인이
    같다는 신호다 — 신규 DTO 를 작성할 때 "경위 설명"을 습관적으로 `/** */` 에 먼저
    적고 있다.
  - 제안: 두 클래스 docblock 의 경위·리뷰 참조 문단을 클래스 선언 위 `//` 블록으로
    옮기고 `/** */` 에는 "스케줄/트리거 응답에 동봉되는 워크플로우 참조 — 목록 UI 가
    쓰는 N개 필드만 담는다" 수준의 한 줄만 남긴다. 차단 사유는 아니며, 다음에 이 파일을
    편집할 때 함께 정리해도 무방 — 다만 위 WARNING 은 필드 레벨이라 **실제 노출**이므로
    이번 PR 안에서 정정을 권장한다.

## 준수 확인 (참고 — 위반 아님)

- **§5.4 금지 조합 부재 확인**: 이번 diff 가 신설한 23개 필드
  (`TriggerDto.chatChannel*`/`notification*` 7개, `IntegrationDto` 6개,
  `KnowledgeBaseDto` 7개, `AlertRuleDto` 2개, `ScheduleDto.trigger`)를
  `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건, 기존 debt
  전용 래칫) 목록과 대조했다 — **신규 필드 중 어느 것도 그 목록에 없다.** 즉 전부
  `@ApiProperty({ nullable: true })`(상시 존재)/`@ApiPropertyOptional()`(키 생략, `| null`
  없음) 중 하나로 §5.4 기본형·예외형을 올바르게 갈라 선언했고, §5.4 가 금지하는
  `@ApiPropertyOptional({ nullable: true })` 조합은 프로덕션 코드(스캔 범위 `src/modules`)
  어디에도 새로 생기지 않았다. (테스트 fixture
  `repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` 는 래칫의
  양성 대조군으로 **의도적으로** 그 조합을 담고 있으며 스캔 범위 밖이라 문제 없음.)
- **`secret-store.md §1.1` 준수**: `TriggersService.sanitizeForResponse` 가 엔티티
  컬럼(`notificationSecretV2`·`chatChannelTokenV2`)을 응답 경계에서 `delete` 로 제거하고,
  `select: false` 를 쓰지 않았다 — 컨벤션이 명시적으로 요구하는 바로 그 방식이다
  ("컬럼 수준은... 조용히 오작동하므로 쓰지 않는다"). `SchedulesController.toResponse` 도
  조인된 트리거를 참조 4필드로 좁혀 같은 유출 경로(§1.1 이 지목한 "GET/POST/PATCH
  /api/triggers 와 GET /api/schedules")를 닫는다.
- **§1-6 numeric wire 타입 준수**: 신규 필드 중 DB 컬럼이 있는 것 전부(`int`/
  `timestamptz`/`uuid`/`text`/`double precision`)를 엔티티에서 직접 확인했다 — `numeric`/
  `decimal` 컬럼은 없어 `field: number` 선언(`consecutiveNetworkFailures`,
  `rerankCandidateK` 등)이 규약과 어긋나지 않는다.
- **§5-1 위치·명명 준수**: 신규 DTO(`TriggerWorkflowRefDto`, `ScheduleTriggerRefDto`,
  `ScheduleTriggerWorkflowRefDto`) 전부 `dto/responses/*-response.dto.ts` 안에 있고,
  같은 DTO 에만 쓰이는 필드는 `*.literal.ts` 로 빼지 않은 것도 §5-1 "값이 한 DTO 에만
  쓰이면 굳이 빼지 않는다" 예외와 일치한다.
- **`TriggerDto.chatChannelHealth`/`notificationHealth` 의 엔티티 타입 재사용**: `import
  type`으로 엔티티의 union 타입을 가져오지만 `enum:` 배열은 별도로 손으로 적는다 — 이
  패턴은 `login-history.dto.ts`·기존 `integration-response.dto.ts` 에 이미 선례가 있는
  로컬 관행이며, §5-1 이 금지하는 "엔티티 enum 에서 (배열을) 파생"에 해당하지 않는다
  (타입 재사용과 값-배열 파생은 다른 문제).
- **CHANGELOG.md 신규 항목**: 기존 항목과 동일한 heading 패턴(`## Unreleased — ...`)·
  표·근거-처방-검증 구조를 따른다.
- **plan 문서 경계 준수**: `spec-draft-nullable-notation-followups.md` 의 신규 등재
  항목(fixture `code:` 커버리지 등)은 developer 가 spec 을 직접 고치지 않고 planner
  후속으로만 등재했다 — CLAUDE.md 의 "spec 변경은 project-planner" 경계를 지켰다
  (`21_40_38` 라운드가 이미 확인한 사항, 이번 라운드도 재확인).

## 요약

이번 라운드의 실질 순증분(`67881bbd4` 이후 `7e85da873`)은 `TriggerDto.workflow`/
`TriggerWorkflowRefDto` 도입과 `PATCH` 응답에서 `Object.assign` 이 로드된 값을
`undefined` 로 덮어쓰던 결함의 수정이며, §5.4·secret-store §1.1·swagger §1-6/§5-1 등
실질 규약(명명·출력 포맷·API 문서 규약) 축에서는 새로운 위반이 없다. 다만 그 과정에서
`ScheduleDto.trigger` 필드의 JSDoc 에 내부 리뷰 라운드 참조(`review/consistency/...`)를
직접 적어 넣어, `swagger.md §3` 이 같은 날 명시적으로 금지한 패턴을 **필드 레벨**(공개
OpenAPI `description` 으로 실제 승격되는 자리)에서 새로 만들었다 — 이번 검토가 처음
잡은 신규 발견이다. 같은 패턴의 클래스 레벨 재발(`TriggerWorkflowRefDto`)도 함께
관찰되며, 실질 노출은 없지만 같은 규약이 같은 날 세 번째로 위반되고 있다는 점에서
습관적 원인을 짚어 둘 필요가 있다. 그 외 §5.4 금지 조합 부재·secret-store §1.1 준수·
numeric wire 타입·DTO 위치/명명 등은 전수 대조로 확인했고 위반이 없다.

## 위험도

LOW

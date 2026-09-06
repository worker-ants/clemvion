# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `ScheduleTriggerRefDto.workflow` 의 JSDoc 이 "e2e 가 세 형태를 각각 고정한다" 고
  주장하지만, 실제로 양성(positive) 검증이 있는 것은 `findById`(단건 조회) 한 형태뿐이다 —
  `findAll`(목록)과 `update`(PATCH) 경로는 구조 검증(`assertMatchesContract`)만 돌아 이
  필드의 **부재**(silent omission) 회귀를 못 잡는다.
  - 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:34-40`
    (주장 — "조회… 와 **수정**(`update()` 가 `findById` 로 시작한다)에는 채워진다 —
    e2e 가 세 형태를 각각 고정한다"),
    `codebase/backend/test/schedule-trigger.e2e-spec.ts:148-149`(findById — 양성 확인 있음,
    `Object.keys(...).toEqual(['id','name','workflowId','workflow'])`),
    `:161`(findAll/목록 — `assertMatchesContract` 만),
    `:288`(update/PATCH cron — `assertMatchesContract` 만)
  - 상세: `workflow` 는 §5.4 키 생략형(`@ApiPropertyOptional`)이라
    `findContractViolations` 는 그 키가 **없어도** 위반으로 보지 않는다
    (`response-contract.ts` 의 `visit()` — `!present` 인 non-required 필드는 그냥
    `continue`). 반면 그 키가 **존재**할 때는 재귀(`descend`)로 내려가 `nested` 스키마
    (`ScheduleTriggerWorkflowRefDto`) 의 undeclared 키를 잡는다 — 즉 이 검증자는
    "narrowing 이 깨져 필드가 더 넓게 새는" 회귀는 잡지만 "narrowing 로직 자체가 사라져
    키가 통째로 안 실리는" 회귀는 구조적으로 못 잡는다. `findAll`(라인 82-83,
    `schedules.service.ts` — `leftJoinAndSelect('t.workflow','w')`)과 `update`(라인
    213-269, `findById` 를 통해 `relations: ['trigger','trigger.workflow']` 로 로드)는
    둘 다 실제로 `workflow` 관계를 채우는 경로이므로, 여기서 `t.workflow` 를 넣는 컨트롤러
    쪽 narrowing(`schedules.controller.ts` 의 `toResponse` — `...(t.workflow ? {
    workflow: { name: t.workflow.name } } : {})`)이 실수로 제거되거나 조건이 뒤집혀도
    (예: `if (false)` 로 되돌리기, 혹은 그 스프레드 줄 자체를 삭제) 현재 e2e 스위트는
    **어느 것도 RED 로 만들지 못한다** — `assertMatchesContract` 는 키가 없어도 통과하고,
    `Object.keys` 명시적 대조는 148번째 줄(findById)에만 있다.
  - 제안: `:161`(목록)과 `:288`(update)에도 148번째 줄과 같은 패턴으로 `Object.keys(listed
    .trigger).toEqual([...])` / `Object.keys(patch.body.data.trigger).toEqual([...])` 를
    추가해 JSDoc 의 "세 형태를 각각 고정한다" 는 주장을 실제로 채우거나, 주장을 "findById
    한 곳만 명시적으로 고정하고 나머지 둘은 구조 검증에 기댄다" 로 낮춘다. 이 패턴은
    `feedback_documented_guarantee_wider_than_built` 부류다 — 서술이 실제 커버리지보다
    넓다.

- **[INFO]** 같은 구조적 한계가 `TriggerDto.workflow`(`TriggerWorkflowRefDto`)에도
  적용되는데, 이쪽은 JSDoc 이 "e2e 가 고정한다" 는 주장을 하지 않아 자기모순은 아니다.
  다만 어떤 e2e 도 `trigger.workflow` 의 정확한 키 집합(`['id','name']`)을 명시적으로
  대조하지 않는다 — `chat-channel-trigger-create.e2e-spec.ts` 의 단건 조회
  테스트(`GET /api/triggers/:id`)와 `schedule-trigger.e2e-spec.ts` C-2(`GET
  /api/triggers` 목록)가 `assertMatchesContract` 를 호출하므로 "엔티티 전체가 다시
  샌다" 류의 widening 회귀는 잡히지만(재귀 검증), "narrowing 함수 자체가 죽어 `workflow`
  키가 사라진다" 류는 여전히 사각지대다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
    (`TriggerWorkflowRefDto`), `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`,
    `codebase/backend/test/schedule-trigger.e2e-spec.ts:262`
  - 제안: 급하지 않음 — 위 WARNING 을 고칠 때 같은 패턴을 여기도 적용할 수 있다.

- **[INFO]** 이번 스윕으로 새로 선언된 필드들(`AlertRuleDto.createdBy`/`lastTriggeredAt`,
  `KnowledgeBaseDto.rerankMode`/`rerankCandidateK`/`rerankScoreThreshold`/
  `rerankConfigId`/`rerankLlmConfigId`/`documentCount`/`embeddingModelConfigId`,
  `IntegrationDto.mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`/
  `consecutiveNetworkFailures`)은 `assertMatchesContract` 로 **구조**(존재·타입·
  null 허용 여부)만 검증되고, 이번 diff 안 어떤 테스트도 이 필드들이 **실제 상황에서
  올바른 값으로 채워지는지**(예: 실제로 트리거된 알림 규칙의 `lastTriggeredAt` 이
  non-null 인지, rerank 를 켠 KB 의 `rerankMode` 가 `'off'` 가 아닌지)는 단언하지 않는다.
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts:103`,
    `codebase/backend/test/knowledge-base.e2e-spec.ts:79-82`,
    `codebase/backend/test/ai-agent-tool-payload-warning.e2e-spec.ts:99`
  - 상세: 이 필드들을 채우는 비즈니스 로직 자체는 이 PR 이전부터 있었고
    (`rerankMode` 는 `knowledge-base.service.spec.ts` 등에 이미 값-레벨 테스트가
    있음을 확인했다), 이 PR 의 명시된 범위는 "이미 나가고 있던 값의 **선언**을 실제에
    맞춘다"(scope.md 참조)이지 새 비즈니스 로직이 아니다. 그래서 이 자체를 이 PR 의
    결함으로 보지는 않는다 — 다만 `assertMatchesContract` 를 "계약이 지켜진다" 로 읽는
    다음 사람이 "값도 맞다" 로 과독하지 않도록 남겨 둔다.
  - 제안: 조치 불요. 참고용 관찰.

## 요약

이 변경(§5.4 응답-계약 검증자를 4→18개 DTO 로 넓히고, 트리거 secret 유출 2건을 수정)은
이미 9라운드에 걸친 코드/일관성 리뷰와 뮤테이션 검증을 거친 상태다. `response-contract.ts`
의 `allowMissing`/메모이제이션은 성공·실패·캐시-미스 경로를 각각 양성/음성 테스트로
덮고(`response-contract.spec.ts`), `swagger-dto-contract-guard.ts` 의 신규 §5.4 금지-조합
래칫은 위반 2형태·준수 2형태를 가르는 양성/음성 fixture 로 뮤테이션 검증됐다
(과거 라운드에서 fixture 경로 오류로 vacuous 했던 이력이 있고 지금은 고쳐졌음을 실측
확인). `TriggersService.sanitizeForResponse` 4축 정화는 unit(모든 축에 실제 비밀 값을
채운 fixture, 개발자 스스로 5/5 뮤턴트 RED 확인 기록)과 e2e(발급 후 응답 확인으로 vacuity
차단) 양쪽에서 이중으로 덮이고, `SchedulesController.toResponse` 의 트리거 참조 좁히기도
create/PATCH/findById 각 경로에서 mock 에 비밀 값을 채운 뒤 반환값을 단언하는 방식으로
검증된다. 이번 라운드에서 새로 발견한 것은 하나다 — `ScheduleTriggerRefDto.workflow` 의
JSDoc 이 "findById·findAll·update 세 형태를 e2e 가 각각 고정한다" 고 주장하지만 실제
양성(키-존재) 단언은 findById 하나뿐이고, 나머지 둘은 구조 검증(위반 시에만 잡는 검증)에
기대고 있어 "narrowing 로직이 통째로 사라지는" 회귀에는 무방비다. 그 외에는 커버리지
갭·엣지케이스·mock 적절성·격리·가독성·회귀 안전성 전 축에서 뚜렷한 문제를 찾지 못했다.

## 위험도
LOW

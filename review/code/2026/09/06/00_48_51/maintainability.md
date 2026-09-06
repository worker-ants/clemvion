# 유지보수성(Maintainability) 리뷰

## 범위에 대한 메모

프롬프트에 조립된 230개 파일 중 대다수(파일 34~230)는 `review/code/**`·`review/consistency/**` 아래의
과거 리뷰 라운드 산출물(RESOLUTION.md·SUMMARY.md·meta.json 등)이다. 이 저장소 관례상 `review/` 는
gitignore 대상이 아니라 커밋되는 산출물이며, 코드가 아니라 리뷰 프로세스의 기록이므로 "가독성·네이밍·
함수 길이" 같은 유지보수성 기준을 적용할 대상이 아니다. 아래 발견사항은 실제 소스 변경분
(`codebase/backend/**`, 파일 1~32)에 한정한다.

## 발견사항

- **[WARNING]** 트리거 참조 좁히기(narrowing) 결과 형태를 검증하는 동일한 assertion 블록이
  같은 파일·자매 파일에 여러 번 그대로 반복된다.
  - 위치:
    - `codebase/backend/test/schedule-trigger.e2e-spec.ts:148-150`
      (`expect(Object.keys(detail.body.data.trigger ?? {}).sort()).toEqual(['id','name','workflowId','workflow'].sort())`)
    - `codebase/backend/test/schedule-trigger.e2e-spec.ts:166-170` (같은 단언, 대상만 `listed`)
    - `codebase/backend/test/schedule-trigger.e2e-spec.ts:302-307` (같은 단언, 대상만 `patch.body.data`)
    - `codebase/backend/src/modules/schedules/schedules.controller.spec.ts:72-78`
      (`Object.keys(res.trigger).sort()).toEqual(['id','name','workflowId'])` +
      `not.toHaveProperty('notificationSecretV2'/'chatChannelTokenV2')`)
    - `codebase/backend/src/modules/schedules/schedules.controller.spec.ts:92-98` (동일 블록, `update` 케이스)
  - 상세: `['id', 'name', 'workflowId', 'workflow']` 형태 단언이 한 e2e 파일 안에서 3회,
    비밀 컬럼 부재 + 참조 필드 단언 6줄짜리 블록이 controller unit spec 안에서 2회 글자 그대로
    반복된다. `ScheduleTriggerRefDto` 의 필드 구성이 바뀌면(예: 필드 추가·이름 변경) 다섯 곳을
    각각 찾아 고쳐야 하고, 하나를 놓치면 그 자리만 조용히 낡은 형태를 계속 단언하게 된다 —
    이 PR 자체가 "선언과 실제가 벌어지는 drift" 를 주제로 삼고 있다는 점에서 특히 아이러니한
    반복이다.
  - 제안: `expectNarrowedTriggerRef(trigger, { withWorkflow: boolean })` 류의 공용 단언
    헬퍼를 (예: `test/helpers/` 또는 `schedules.controller.spec.ts` 상단) 하나 두고 다섯
    지점을 호출로 교체. 새 필드가 추가되면 헬퍼 한 곳만 고치면 되도록.

- **[INFO]** `§5.4` 선언 보정 배경을 설명하는 6줄짜리 주석 블록이 4개 응답 DTO 파일에
  글자 그대로(단어 하나까지) 복제돼 있다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:55-61`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:118-124`,
    `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:93-99`,
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:98-104`
  - 상세: "아래 필드는 이미 응답에 실려 나가고 있었다 … `@ApiPropertyOptional` 은
    `required: false` 의 별칭이라 상시 존재 필드에 쓰면 모순이다" 라는 동일 설명이 네 파일에
    복사돼 있다. 코드 로직 중복은 아니지만, 이 규칙 설명 자체가 바뀌거나(예: §5.4 기준이
    개정되거나) 오타가 발견되면 네 곳을 함께 고쳐야 하고 실제로는 한두 곳만 고쳐질 위험이
    있다. 이 저장소는 정식 규약을 `spec/conventions/` 에 단일 진실로 두는 관례가 있으므로
    (`CLAUDE.md` "정보 저장 위치" 표), 이런 반복 설명은 정황상 의도된 지역 문서화로 보이지만
    drift 위험 자체는 남는다.
  - 제안: 필수는 아님. 다음에 §5.4 조항 문구가 바뀔 때 이 네 자리를 함께 갱신해야 함을
    인지해 두거나, `spec/conventions/` 쪽 한 곳을 링크하고 DTO 쪽 주석은 한두 줄로 축약하는
    것도 고려할 수 있다.

- **[INFO]** `sanitizeForResponse`(`triggers.service.ts`)와 `toResponse`
  (`schedules.controller.ts`)의 JSDoc 이 각각 35줄·15줄로, 과거 리뷰 라운드의 이력
  (`review/code/2026/09/05/...` 참조 다수)까지 함수 계약 설명 안에 촘촘히 엮여 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:652-690`
    (`sanitizeForResponse` 바로 위 JSDoc), `codebase/backend/src/modules/schedules/schedules.controller.ts:54-67`
    (`toResponse` 바로 위 JSDoc)
  - 상세: 각 문단이 "왜 이렇게 됐는가" 를 정확히 설명하고 있어 근거 자체는 훌륭하지만,
    실제 사용 계약("무엇을 받고 무엇을 돌려주는가")과 사건 서사("과거에 두 번 좁게
    틀렸다")가 한 JSDoc 블록 안에 섞여 있어 처음 읽는 사람이 "지금 이 함수가 하는 일"을
    파악하려면 이력까지 다 읽어야 한다. 프로젝트 관례상(`review-citations.md §3`,
    `swagger.md §3`) 내부 서사는 `//` 로, 공개 계약 설명은 JSDoc 으로 분리하는 패턴을 DTO
    필드에는 일관되게 적용하고 있는데(예: `schedule-response.dto.ts` 의 `workflow` 필드),
    이 두 메서드는 사설 메서드임에도 서사 전체가 JSDoc 안에 있어 그 분리 원칙이 메서드
    레벨에는 적용되지 않았다.
  - 제안: 강제 사항은 아니다. 다음에 이 메서드를 또 고칠 일이 생기면, 계약 설명(축 표·
    파라미터·반환값)만 JSDoc 맨 위에 남기고 "왜 세 번 좁았는가" 류 사건 서사는 본문 `//`
    로 내리는 것을 고려.

- **[INFO]** `schedules.service.ts` 의 `create()`/`update()` 에 `saved.trigger = …` 대입을
  조건문 밖으로 옮기면서 남긴 주석이 두 메서드에서 각각 다른 근거(§공통 이유 vs "자매"
  참조)로 서술돼, 같은 수정 패턴임을 한눈에 알아보려면 두 자리를 다 읽어야 한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:198-206` (create),
    `codebase/backend/src/modules/schedules/schedules.service.ts:263-266` (update)
  - 상세: 기능적으로는 문제없다 — `update()` 주석이 "create() 와 같은 이유" 라고 명시적으로
    교차 참조하고 있어 독자가 왜 반복인지 알 수 있다. 다만 두 곳 모두 "트리거는 `isActive`
    와 무관하게 존재…" 문장이 부분적으로 다시 서술되어 있어, 향후 세 번째 유사 케이스가
    생기면 문장이 세 번 각색될 위험이 있다(관련 위험이 이미 `triggers.service.ts` 의
    `sanitizeForResponse` JSDoc 이 스스로 지적하는 "같은 실수를 세 번" 패턴과 궤를 같이
    한다). 조치를 요구할 정도는 아니고 관찰로 남긴다.
  - 제안: 조치 불요.

## 요약

이번 변경은 §5.4 응답-계약 검증자(`response-contract.ts`/`swagger-dto-contract-guard.ts`)를
18개 DTO로 넓히는 배선과, 그 과정에서 실측으로 드러난 트리거/스케줄의 secret 유출 수정
(`triggers.service.ts` 의 `sanitizeForResponse` 4-축 오케스트레이터, `schedules.controller.ts`
의 `toResponse`)으로 구성된다. 신규 로직은 대체로 작은 순수 함수(`omitKeys`,
`stripChatChannelSecrets`, `stripInteractionSecrets`, `stripNotificationSigningSecrets`,
`deleteSecretColumns`, `narrowWorkflowRef`)로 잘게 쪼개져 있고, 네이밍이 축(axis) 단위로
일관되며, 중첩 깊이나 순환 복잡도가 우려할 수준으로 높은 곳은 없었다. `contractForDto` 의
promise 메모이제이션도 실패 케이스를 캐시에서 제거하는 등 꼼꼼하다. 발견된 문제는 전부
경미한 수준으로, (1) 트리거 참조 좁히기 형태를 확인하는 assertion 블록이 두 테스트 파일에
걸쳐 5회 가까이 글자 그대로 반복되는 것(추출하면 좋음)과, (2) DTO 주석·메서드 JSDoc 에
과거 리뷰 이력을 상세히 남기는 이 프로젝트 특유의 관례가 유지보수 시 "계약 설명"과
"사건 서사"를 뒤섞어 첫 가독성을 낮추는 것(관례상 의도된 것으로 보이며 강제 조치 대상은
아님) 정도다. Critical 급 구조적 결함은 없다.

## 위험도
LOW

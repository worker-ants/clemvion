# 테스트(Testing) 리뷰

## 검증 방법

diff 상 코드 블록이 프롬프트 크기 제한으로 생략된 파일들(schedules.controller.ts/spec.ts,
triggers.service.ts/spec.ts, schedule-response.dto.ts, trigger-response.dto.ts,
swagger-dto-contract-guard.ts/spec.ts, response-contract.ts/spec.ts,
chat-channel-trigger-create.e2e-spec.ts, schedule-trigger.e2e-spec.ts)는
`git diff origin/main...`로 직접 열어 전문을 확인했다.

관련 unit 테스트 4개 파일(`schedules.controller.spec.ts`, `schedules.service.spec.ts`,
`schedule-trigger-ref.spec.ts`, `response-contract.spec.ts`) + `triggers.service.spec.ts` +
`swagger-dto-contract.spec.ts` + `execution-response.dto.spec.ts`를 실제로 실행해 전부
GREEN을 확인했다 (75 + 145건, 스킵 1건 제외 전부 통과).

GREEN만으로는 비어있는(vacuous) 단언을 걸러낼 수 없으므로, 이 PR의 핵심 보안 수정인
CWE-209 방지 테스트(`schedules.controller.spec.ts`의 `'trigger 미로드 행은 던지되 응답에
진단을 싣지 않는다'`)에 대해 뮤테이션 검증을 수행했다. `schedules.controller.ts`의
예외 메시지를 다시 `schedule.id`가 새는 형태로 되돌린 뒤 재실행하자 즉시 RED로
전환됐고(diff로 확인), 원복 후 `git status --short`로 저장소가 깨끗함을 재확인했다.
이 테스트는 실제로 회귀를 잡는다 — vacuous가 아니다.

## 발견사항

- **[INFO]** CWE-209 회귀 테스트가 컨트롤러 메서드를 동일 입력으로 두 번 호출한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` —
    `it('trigger 미로드 행은 던지되 응답에 진단을 싣지 않는다', ...)` 블록.
  - 상세: 첫 호출은 `await expect(controller.update(...)).rejects.toMatchObject(...)`로
    본문(`code`/`message`)을 확인하고, 곧이어 같은 인자로 `controller.update(...)`를
    다시 호출해 `.catch()`로 예외를 잡아 `JSON.stringify(...)`에 `sch-leak-probe` /
    `trigger_id` / `join`이 없는지 확인한다. 두 호출 모두 `service.update`가 같은
    mock 값을 반환하므로 결정적이라 flaky는 아니지만, 같은 로직 경로를 두 번 태우는
    것은 불필요하고 다음 사람이 "왜 두 번 부르지?"를 다시 추적해야 하는 비용을 만든다.
  - 제안: `try { await controller.update(...); } catch (err) { ... }` 한 번으로 통합해
    `err.response`에 대해 `toMatchObject`와 `JSON.stringify` 단언을 함께 적용하면
    호출이 하나로 줄고 의도가 더 분명해진다. 사소하며 PR을 막을 사유는 아니다.

- **[INFO]** `sanitizeForResponse`(triggers.service.ts)가 "정화할 것이 없어도 항상 새
  참조를 돌려준다"는 불변식을 직접 검증하는 테스트가 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` —
    `sanitizeForResponse` JSDoc의 "조기 return을 없앤 뒤로는 정화할 것이 없는 트리거도
    새 참조를 받는다, 그러니 호출부는 참조 동일성을 전제하지 말 것" 문장.
  - 상세: `triggers.service.spec.ts`의 `'chat-channel 이 아닌 트리거도 정화를 거친다 —
    조기 return 회귀 방지'` 테스트는 `notificationSecretV2`가 스트립됐는지만 확인하고,
    `result`가 원본 `trigger` 객체와 다른 참조(`not.toBe`)인지는 확인하지 않는다.
    엔티티 컬럼 스트립이 있으므로 이 특정 케이스는 항상 새 객체가 나오지만, "config에도
    strip할 게 전혀 없는" 극단 케이스(예: `config`가 `null`이고 비밀 컬럼도 없는 행)에서
    누군가 early-return 최적화를 재도입해도 이 서술을 깨는 테스트가 없다.
  - 제안: 위 시나리오에 `expect(result).not.toBe(trigger)` 한 줄을 추가하면 이 JSDoc
    문장 자체가 회귀 가드를 갖는다. 우선순위는 낮음 — 현재 스트립 대상이 되는 필드가
    항상 존재하는 도메인에서는 도달하기 어려운 분기다.

- **[INFO]** `expectNarrowedScheduleTriggerRef`는 `trigger`의 최상위 키셋만 보고,
  중첩된 `trigger.workflow` 객체 자신의 키셋(예: `ScheduleTriggerWorkflowRefDto`가
  `name`만 가져야 하는데 실수로 `id`까지 실리는 경우)은 검사하지 않는다. 다만 이는
  실질적 갭이 아니다 — 같은 e2e 테스트에서 나란히 호출되는 `assertMatchesContract`가
  `$ref`를 타고 `workflow` 스키마까지 내려가(`response-contract.ts`의 `descend`)
  `ScheduleTriggerWorkflowRefDto`에 선언되지 않은 키(`id`)를 `undeclared`로 잡는다
  (코드 확인 완료: `visit()` → `descend()` → 중첩 스키마 재귀).
  - 위치: `codebase/backend/src/shared/testing/schedule-trigger-ref.ts` (헬퍼 정의),
    `codebase/backend/test/schedule-trigger.e2e-spec.ts` (양쪽 헬퍼를 나란히 호출하는
    지점).
  - 상세: 다만 **unit 레벨**(`schedules.controller.spec.ts`)에서는
    `assertMatchesContract`를 쓰지 않고 `expectNarrowedScheduleTriggerRef`만 쓰며,
    그 unit mock(`scheduleWithSecretTrigger()`)에는 `trigger.workflow`가 아예 없어
    `withWorkflow: false` 분기만 exercise한다. 즉 "sibling ref DTO를 서로 바꿔치기하면
    안 된다"는 이 PR 자신의 주석 경고(W2)에 대한 회귀 감지는 e2e 계층에만 있고, 더 빠른
    unit 계층에는 없다 — 설계상 허용 가능한 분업이지만 피드백 루프가 느리다는 점은
    참고할 만하다.
  - 제안: 조치 불요. e2e가 이미 덮는다. 더 빠른 신호를 원하면
    `schedules.controller.spec.ts`의 mock에 `workflow` 필드를 채운
    `withWorkflow: true` 케이스 하나를 추가해도 좋다.

## 강점 (참고용 관찰)

- 이 PR의 테스트 추가분 다수가 "이전 리뷰 라운드에서 vacuous였던 지점"을 명시적으로
  인용하며 뮤테이션 검증 근거를 주석에 남긴다 — 예: `triggers.service.spec.ts`의
  `secretRef`만이 아니라 `secret` 키까지 채워 뮤턴트를 잡은 fixture,
  `optional-nullable.fixture.ts`의 "존재하지 않는 fixture 경로 참조로 인한 vacuous
  Critical" 수정, `contractForDto` 캐시의 "실패는 캐시에 남기지 않는다" 케이스를
  별도로 문 것. 이런 자기 회귀형 서술은 검증 부담을 줄여준다(직접 뮤테이션 1건을
  재현해 확인한 CWE-209 케이스도 동일 패턴이었고 실제로 RED를 냈다).
- `response-contract.spec.ts`의 `allowMissing` 테스트 4건이 "정확한 이름만 면제",
  "중첩 경로는 얕은 이름과 매칭 안 됨", "undeclared 축은 별개"를 각각 분리해서 문다 —
  옵션 하나에 대해 다축 뮤테이션 커버리지를 갖췄다.
- `schedules.service.spec.ts`의 `update()` 테스트는 `scheduleRepo.save.mockImplementation`
  이 관계를 일부러 떨어뜨려 반환하도록 만들어, "인자를 그대로 돌려주는 얕은 mock"이
  대입 로직을 우회해 vacuous해지는 것을 막는다 — mock 충실도가 실제 TypeORM 동작
  근사치보다 오히려 더 엄격한 방향으로 설계됐다.
- `triggers.service.spec.ts`의 목록 경로(`findAll`) 비밀 스트립 테스트는 `findOneDetail`
  경로와 별개 코드 경로(배열 `map`)임을 인지하고 별도로 문다 — 코드 경로별 커버리지
  분리가 잘 되어 있다.

## 요약

25개 실질 코드 변경 파일 중 테스트 관련 변경은 매우 밀도가 높고, 대부분이 "지난 리뷰
라운드가 발견한 vacuous 테스트·미검증 근거"를 구체적으로 인용해 고친 자기 회귀형 개선이다.
직접 실행한 unit 테스트(220건)가 전부 GREEN이었고, 이 PR의 핵심 보안 수정(CWE-209 진단
비노출)에 대해 별도로 수행한 뮤테이션 검증에서 해당 테스트가 실제로 RED를 내는 것을
확인했다 — vacuous가 아니다. 발견한 세 항목은 전부 INFO 등급으로, 하나는 가독성(중복
호출), 나머지 둘은 e2e가 이미 실질적으로 덮고 있는 낮은 우선순위의 unit 커버리지 세분화
여지다. 커버리지 갭·엣지 케이스·mock 부적절성·테스트 격리 문제·회귀 위험을 나타내는
CRITICAL/WARNING 사안은 발견하지 못했다.

## 위험도
NONE

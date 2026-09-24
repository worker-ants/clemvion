# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 공허성 가드의 매직 넘버 `1_500` 이 중앙 상수를 두고도 또 하드코딩됐다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:247`
  - 상세: `codebase/backend/test/helpers/concurrency.ts:26` 는 `const VACUITY_GUARD_MS = 1_500;` 을
    선언하며 바로 옆 주석(`:90`)에 "대기 시간의 근거는 `VACUITY_GUARD_MS` 선언부에 한 번만
    적는다(두 자리에 적으면 한쪽이 낡는다)" 라고 명시한다. 또한 `assertGuardBelowKnownTimeouts`
    로 이 값이 알려진 락 대기 상한보다 짧은지 **한 곳에서 검증**한다(`:31`). 그런데 이번 신규
    테스트는 `raceUnderHeldLock` 헬퍼를 쓰지 않고(재진입 패턴이라 다른 헬퍼 형태 — plan 이 이미
    이유를 적었다) 같은 공허성 가드를 손으로 다시 구현하면서 리터럴 `1_500` 을 그대로 복제했다.
    이미 `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts:118` 도 같은 값을
    복제해 두었으니(이번 diff 대상은 아니지만 같은 클래스), 이번 PR 로 동일 리터럴이 **세 번째**
    자리에 생겼다. `VACUITY_GUARD_MS` 는 현재 export 되지 않아 그대로 import 할 수는 없지만,
    그 사실 자체가 "한 곳에서만 관리한다" 는 모듈의 선언 의도와 실제 재사용 가능 범위가 어긋나
    있음을 보여준다. 값이 바뀌면(예: 락 대기 상한이 늘어) 세 자리를 손으로 찾아 맞춰야 하고,
    `assertGuardBelowKnownTimeouts` 의 중앙 검증도 이 두 자리(여기와 `integration-rotate-*`)엔
    적용되지 않아 향후 락 대기 상한이 1500ms 를 넘으면 이 가드가 조용히 무의미해져도(공허한
    통과) 아무도 알아채지 못한다.
  - 제안: `VACUITY_GUARD_MS` 를 `concurrency.ts` 에서 `export` 하고, 재진입 패턴 두 파일 모두
    그 상수를 import 해 쓰도록 바꾼다. 나아가 재진입 오케스트레이션(BEGIN → 락 → 발사 →
    공허성 가드 → 중간 mutate → COMMIT → finally ROLLBACK+drain) 자체가 이번으로 두 번째
    등장했으므로, `raceUnderHeldLock` 과 나란히 `reenterUnderHeldLock` 류의 헬퍼로 뽑는 것도
    고려할 시점이다(아래 항목과 연결).

- **[WARNING]** 재진입 락 오케스트레이션 보일러플레이트가 두 e2e 파일에 거의 그대로 중복된다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:224-267`
  - 상세: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts:86-160` 와 구조가
    거의 동일하다 — `locker.query('BEGIN')` → `SELECT … FOR UPDATE` → 요청 발사 →
    `Promise.race` 공허성 가드(`expect(raced...).toBe(...)`) → 락을 쥔 채 대상 행을 직접
    mutate → `COMMIT` → 응답 단언 → `finally` 에서 `ROLLBACK().catch(() => undefined)` +
    `pending?.catch(() => undefined)`. 이번 PR 의 plan(`plan/in-progress/member-owner-toctou.md`
    §E)도 "겹침 오케스트레이션을 `raceUnderHeldLock` 으로 접지 않는다 … 선례:
    `integration-rotate-concurrency.e2e-spec.ts`" 라고 명시적으로 그 파일을 선례로 인용한다 —
    즉 작성자 스스로 "같은 모양을 손으로 두 번째 짓는다" 는 것을 인지한 채로 진행했다.
    `raceUnderHeldLock` 이 만들어진 계기(파일 상단 JSDoc)가 "같은 구조의 e2e 가 아홉 파일
    11 블록 쌓였다" 는 임계점이었던 것과 대비하면, 이 재진입 변형도 세 번째가 나오기 전에
    추상화 여부를 판단해 두는 편이 다음 사람의 복붙 대상을 하나로 좁힌다.
  - 제안: 두 파일의 공통 골격(락 획득 → 발사 → 공허성 가드 → 콜백으로 mutate → COMMIT →
    finally 드레인)을 `helpers/concurrency.ts` 에 `reenterUnderHeldLock(locker, lock, fire,
    mutateWhilePending)` 형태로 뽑는 것을 검토. 최소한 세 번째 유사 사례가 생기면 반드시
    추출한다는 기준을 plan/트래커에 남겨 두면 좋다.

- **[WARNING]** "파일의 마지막이어야 한다" 는 테스트 순서 불변식이 주석으로만 강제된다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:183-184`
    (`// 아래 블록은 **파일의 마지막이어야 한다** — 승격을 raw UPDATE 로 넣으므로 …`)
  - 상세: 새 `it('제거 중 대상이 owner 로 승격되면 지우지 않고 403 이다', …)` 블록은
    `UPDATE workspace_member SET role = 'owner' WHERE id = $1` 을 raw SQL 로 직접 실행해
    `transferOwnership()` 의 효과를 흉내낸다(:254). 이 워크스페이스는 파일 전체
    `beforeAll` 에서 한 번만 생성돼 이후 모든 `it` 이 공유하므로, 이 블록이 끝나면 그
    워크스페이스에는 **owner 가 둘** 남는다(정상 `transferOwnership` 이면 이양 시 원 owner
    를 admin 으로 내리지만 이 raw UPDATE 는 그러지 않는다). 이 오염 상태는 오직 "이 블록을
    파일 맨 끝에 둔다" 는 사람이 지키는 관례로만 방지된다 — Jest 는 선언 순서대로 `it` 을
    실행하므로 지금은 실제로 맨 끝이지만, 나중에 누군가 이 파일에 새 `it` 을 이어 붙이면
    (흔한 편집 패턴 — 파일 맨 아래에 추가) 컴파일도 lint 도 이 불변식 위반을 잡지 못한 채
    조용히 owner 2명짜리 워크스페이스 위에서 새 테스트가 돈다.
  - 제안: 구조적으로 강제하는 편이 안전하다 — 예를 들어 이 테스트만 자신의 워크스페이스를
    새로 만들어 공유 상태를 건드리지 않게 하거나(다른 `it` 들처럼 `inviteAndAccept` 로 대상만
    새로 만드는 것과 별개로, 워크스페이스 자체도 로컬로 생성), 혹은 별도 `describe`/파일로
    분리해 "이 파일 안에서는 마지막이어야 한다" 는 규율 자체를 없앤다. 최소한 테스트 종료 후
    `role` 을 원래대로 되돌리는 정리 코드를 추가해 공유 상태 오염을 없애는 방법도 있다.

- **[INFO]** `removeMember` 의 주석 대 코드 비율이 매우 높다 — 기존 컨벤션과 일치하지만 계속
  누적되고 있다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:810-878`
    (`removeMember` 전체, 특히 DELETE 문 위 `:840-853` 14줄 주석 블록)
  - 상세: 실질 실행 코드는 약 20줄 남짓인데 인라인 주석은 그 세 배에 가깝다. 이 스타일은
    `deleteWorkspace`(`:518-592`)·`assertWorkspaceDeletable`(`:594-638`) 등 같은 파일의 다른
    동시성 메서드들과 일관되므로 이 PR 만의 새로운 문제는 아니고, 동시성처럼 "왜" 가 중요한
    코드에서는 합리적인 트레이드오프다. 다만 이런 블록이 메서드 하나에 더 쌓이면 실제 제어
    흐름(early guard → DELETE → 0-분기 → 재조회 → 감사)을 한눈에 훑기 어려워지는 지점에
    가까워진다.
  - 제안: 지금 당장 조치가 필요한 수준은 아니다. 다음에 이 메서드에 분기가 하나 더 추가된다면
    긴 근거 주석 일부(특히 Postgres EvalPlanQual 메커니즘 설명·타 스펙과의 구분 설명)를
    JSDoc 또는 별도 문서 링크로 옮기고 인라인에는 "무엇을" 위주로 남기는 정리를 고려.

- **[INFO]** `mock.calls[0]` 을 `as [...]` 로 캐스팅해 `FindOperator` 내부 표현을 직접 검사한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1509-1515`
  - 상세: `criteria.role.type`/`criteria.role.value` 로 TypeORM `Not()` 이 반환하는
    `FindOperator` 의 비공개에 가까운 내부 필드를 직접 읽는다. 주석이 그 이유(`toHaveBeenCalledWith`
    의 deep-equality 가 `FindOperator` 에 불투명함)와 형제 선례(`sessions.service.spec.ts`)를
    명시해 의도적 선택임을 밝히고 있어 이 자체를 결함으로 보진 않는다. 다만 TypeORM 내부
    구현이 바뀌면(예: `type`/`value` 필드명 변경) 이 단언은 타입 체크를 통과한 채로 조용히
    깨지거나 항상 통과하는 쪽으로 무력화될 수 있다 — 이미 `member-owner-toctou.md` §C 가
    "그 렌더링이 실제로 맞는가" 를 실 DB e2e(`member-remove-concurrency.e2e-spec.ts`)로도
    이중 고정해 뒀으므로 위험은 낮다.
  - 제안: 조치 불요. 다만 이런 내부-표현 단언이 늘어나면 작은 헬퍼(`expectNotOperator(criteria.role,
    'owner')` 등)로 뽑아 두면 다음에 같은 패턴을 쓸 때 캐스팅 타입을 다시 손으로 쓰지 않아도 된다.

## 긍정적으로 확인한 점

- `throwCannotRemoveOwner()` 추출(`workspaces.service.ts:349-360`)은 바로 위
  `throwMemberNotFound()` 가 세 곳에 리터럴 복제로 지적받았던 선례를 스스로 인용하며 같은
  실수를 미리 피했다 — 두 호출부(`:826`, `:866`)가 같은 헬퍼를 공유한다.
- `if (member.role === 'owner') this.throwCannotRemoveOwner();` 스타일은 같은 파일의
  `if (!member) this.throwMemberNotFound();`(`:310`) 등 기존 한 줄 가드 컨벤션과 일치한다.
- `wireFindOne` 의 `targetOnReread` 확장은 기본값을 생략(`undefined`)하면 종전 동작을 그대로
  유지하도록 설계돼 있어 기존 테스트를 건드리지 않고 새 시나리오만 얹었다 — 하위 호환적인
  테스트 헬퍼 확장의 좋은 예.
- "0 이 되는 두 이유(행 소실 vs owner 승격)" 를 가르는 별도 `it` 블록을 분리해 둔 것은
  "0이면 무조건 403" 으로 되돌리는 회귀 편집을 뮤턴트 B 가 잡을 수 있게 하는 근거가 되고,
  실제로 plan 의 뮤턴트 표가 이를 실측으로 확인해 뒀다.

## 요약

핵심 변경(`throwCannotRemoveOwner` 추출, `removeMember` 의 조건부 원자 `DELETE` + 0-분기
재조회, 대응 단위/e2e 테스트)은 가독성·네이밍·중복 제거 면에서 기존 코드베이스 컨벤션을
잘 따르고 있고 CRITICAL 급 결함은 없다. 다만 e2e 테스트 계층에서 세 가지 실질적인 유지보수
부채가 새로 쌓였다 — 중앙화 의도가 명시된 공허성 가드 상수(`VACUITY_GUARD_MS`)를 세 번째로
다시 하드코딩한 것, 재진입 락 오케스트레이션 보일러플레이트가 두 번째로 손으로 복제된 것,
그리고 "파일 맨 끝이어야 한다" 는 공유-상태 오염 방지 불변식이 주석에만 의존하는 것이다.
셋 다 지금 당장 기능을 해치진 않지만, 다음 사람이 이 파일에 이어 붙이거나 락 대기 상한을
바꿀 때 조용히 깨질 수 있는 종류의 결함이라 WARNING으로 남긴다.

## 위험도
LOW

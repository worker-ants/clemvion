# 유지보수성(Maintainability) 리뷰

## 검토 범위 및 방법

`origin/main...HEAD` 전체 diff(93개 파일, 코드 14 + `plan/`·`review/` 산출물 다수)를 확인했다.
그중 이전 라운드(`review/code/2026/09/14/20_17_16`)가 이미 리뷰한 지점 대비, 이번 라운드의
실질 신규분은 커밋 `889c93cd9`(직전 라운드가 리뷰한 `369852b4f` 대비 델타, `git diff
369852b4f..HEAD -- codebase/`)다. 그 델타 파일 7개(`hooks.service.ts`,
`trigger-transaction-mock.ts`, `chat-channel-binder.service.ts`, `chat-channel-input-rules.spec.ts`,
`trigger-config-lock.ts`, `triggers.service.spec.ts`, `triggers.service.ts`)를 `Read`로 현재
전체 컨텍스트와 함께 직접 대조했고, 이전 라운드들이 지적한 항목이 이번 델타에서 실제로
해소됐는지도 코드로 재확인했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 로
확인 — untracked 는 이 리뷰 자신의 출력 디렉터리뿐).

## 발견사항

- **[WARNING]** `{ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' }` 리터럴이 이번
  델타로 **2곳에서 4곳으로** 늘었다 — 이 PR 자신이 두 번 겪은 "복제된 자리 중 하나만 고치는
  drift" 패턴이 세 번째로 재현될 채비를 하고 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:352-357`(`findById`,
    기존) · `:482-487`(신규 `findByIdForUpdate`) · `:616-621`(`update()` 트랜잭션 콜백 내
    `if (!fresh) throw`, 기존) · `:1224-1229`(신규 `rotateBotToken` 의 `if (!wrote) throw`)
  - 상세: 직전 라운드(`review/code/2026/09/14/20_17_16/maintainability.md` INFO#4)가 이미
    "2곳 복제, 규모가 작아 당장 문제는 아니다"로 낮게 평가했는데, 이번 델타가 정확히 같은
    리터럴을 두 자리 더 추가했다(`findByIdForUpdate` 신설 + `rotateBotToken` 의 삭제-경합
    404 방어). 네 자리 모두 `NotFoundException` 생성자 인자가 글자 하나 다르지 않게
    동일하다. 이 PR 의 CHANGELOG·plan·커밋 메시지 전체가 "복제가 결함을 만든다"는 교훈을
    반복해서 기록하고 있는 것과 대조적으로, 정작 이 네 자리는 손으로 계속 복제되고 있다 —
    다음에 메시지 문구를 바꾸거나 새 필드(예: `details`)를 추가해야 할 일이 생기면 넷 중
    하나를 놓칠 위험이 구조적으로 남는다.
  - 제안: `private assertTriggerFound<T>(row: T | null): T { if (!row) throw new
    NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' }); return
    row; }` 같은 작은 헬퍼로 네 자리를 통합한다. `findById`/`findByIdForUpdate`/`update()`
    트랜잭션 콜백/`rotateBotToken` 모두 각자의 조회 결과를 이 헬퍼에 통과시키기만 하면 되고,
    트랜잭션 콜백 안에서도 순수 함수라 호출에 제약이 없다.

- **[INFO]** 신규 `findByIdForUpdate` 가 `findById` 와 거의 동일한 몸체를 반복한다 (위 항목과
  같은 근본 원인, 별도 관찰)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:347-359`(`findById`)
    vs `:475-489`(`findByIdForUpdate`)
  - 상세: 두 메서드는 `triggerRepository.findOne({ where: { id, workspaceId }, ... })` →
    `!trigger` 가드 → 동일한 `NotFoundException` → `return trigger` 구조를 그대로 반복하며,
    유일한 차이는 `relations: ['workflow']` 유무뿐이다(성능 목적의 의도된 분리이고 그 자체는
    합리적 — `/ai-review` `20_17_16` performance WARNING#1 대응). 다만 지금 형태는 "조회
    로직"과 "부재 처리 로직"이 함께 복제된 것이라, 위 헬퍼 추출과 함께 `findOne` 옵션만
    파라미터화하면 두 메서드가 각자 1줄짜리 얇은 래퍼로 줄어든다.
  - 제안: 위 `assertTriggerFound` 도입과 묶어서, `findById`/`findByIdForUpdate` 를
    `private async findRow(id, workspaceId, opts?: { relations?: string[] })` 하나로
    합치거나, 최소한 두 메서드 각각이 `assertTriggerFound(await this.triggerRepository
    .findOne(...))` 한 줄만 갖도록 줄인다.

- **[INFO]** 테스트 유틸 `withTransactionMock` 의 "위임 아니면 fallback" 클로저가 이번 델타로
  3개에서 4개로 늘었다 — 같은 모양의 반복이 계속 자라는 중
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:89-112`
    (`findOne`/`remove`(신규)/`save`/`update` 네 `jest.fn` 클로저)
  - 상세: 네 클로저 모두 `const xMock = triggerRepoMock.x as (...) => unknown | undefined;
    return xMock ? xMock(...) : fallback;` 형태를 반복한다. 이번 델타가 `remove` 하나를
    더 추가하면서(창 1 의 `remove()` 가 같은 트랜잭션 경로를 타게 된 데 따른 필연적 배선)
    반복 개수가 늘었다. 직전 라운드(`19_44_08`? 아니, `18_17_44` maintainability INFO#4)가
    이미 "필요하면 named type 으로 캐스트를 단순화할 수 있다, 급하지 않음" 수준으로 지적한
    지점인데, 그 뒤로 계속 새 메서드가 같은 패턴으로 이 파일에 추가되고 있다. 테스트 전용
    코드이고 각 위임은 파일 자신의 JSDoc 이 명시한 뮤테이션 실측(53개 케이스 RED)으로
    뒷받침되므로 위험도는 낮다.
  - 제안: 급하지 않음. 다만 다섯 번째 메서드(예: `insert`)가 필요해지는 시점이 오면, 그때는
    `delegate<K extends string>(key: K, mapArgs: (...args: unknown[]) => unknown[]) =>
    jest.fn((...args) => { const fn = triggerRepoMock[key]; return fn ? fn(...mapArgs(args))
    : args[args.length - 1]; })` 같은 소형 팩토리로 네 자리를 하나의 정의로 접는 것을 고려.

## 이전 라운드 대비 확인한 해소 사항 (참고, 재지적 아님)

- `hooks.service.ts` 두 호출부에 문자 그대로 복제돼 있던 5줄 주석 + 4줄 코드 블록
  (`review/code/2026/09/14/20_17_16/maintainability.md` WARNING#1)이 이번 델타에서
  `private touchLastTriggeredAt(trigger)` 헬퍼로 정확히 통합됐다(`hooks.service.ts:975-985`
  선언, `:227`·`:686` 두 호출부). 주석은 헬퍼 하나에만 남았고, "두 호출부가 이 한 함수를
  공유한다"는 문장이 이 통합 자체의 근거(직전 결함의 원인)를 스스로 문서화하고 있다 — 이
  리뷰가 위에서 지적한 `RESOURCE_NOT_FOUND` 중복에 그대로 적용 가능한 처방 사례다.
- `CHANGELOG.md` 의 "외부 provider 호출은 락 밖에 남는다" 문단이 문단 경계 없이 무관한 웹훅
  수정 문단 뒤에 잘못 붙어 있던 것(`20_17_16` WARNING#2)이 이번 델타에서 원래 자리
  (advisory-lock 재읽기 문단 바로 뒤, 문단 구분 포함)로 정확히 되돌아갔다(`git diff
  369852b4f..HEAD -- CHANGELOG.md` 로 직접 확인).
- `trigger-config-lock.ts` 의 `rewriteTriggerConfigLocked` JSDoc 에 "부재를 드러내는 방식이
  창마다 다르다"는 표(`:96-104`)가 새로 추가되어, 왜 binder 경로는 `false` 로 감추고 창
  1·`rotateBotToken` 은 404 로 드러내는지가 이제 함수 계약 문서 한 곳에서 읽힌다 — 이전
  라운드들이 "반환값이 세 호출부 모두에서 버려진다"고 지적했던 죽은 확장 포인트가 이번
  델타로 실제 소비처(2곳)를 얻으면서 그 문서도 함께 갱신된 좋은 사례다.

## 긍정적으로 확인한 점

- 네이밍은 여전히 목적을 정확히 드러낸다(`findByIdForUpdate`, `touchLastTriggeredAt`,
  `onLock`). 신규 테스트 이름(`remove() 도 같은 config 락을 잡는다`, `rotateBotToken —
  그 사이 삭제되면 404 + 감사 미기록`)도 검증 대상과 이유를 한 줄에 담는다.
- 매직 넘버 없음. `trigger-transaction-mock.ts` 의 "53개 케이스" 같은 실측 수치는 주석에
  "이 값은 시점 의존이다 — 이 파일을 고칠 땐 다시 재라"는 경고와 함께 기록돼, 나중에
  근거 없이 낡은 숫자로 오독될 위험을 스스로 낮춰 두었다.
- `remove()` 의 신규 락 배선(`triggers.service.ts:960-963`)은 `acquireTriggerConfigLock` 을
  재사용해 SQL 을 다시 손으로 적지 않았다 — `19_07_43` architecture WARNING#4 가 추출한
  프리미티브가 의도한 대로 세 번째 호출부에서 그대로 재사용됐다.

## 요약

이번 델타(`369852b4f..HEAD`, 커밋 `889c93cd9`)는 이전 두 라운드가 지적한 WARNING 두 건
(`hooks.service.ts` 복제, `CHANGELOG.md` 문단 오귀속)을 정확히 해소했고, 그 해소 방식
(private 헬퍼로 통합, 원래 위치로 문단 복원)은 이 코드베이스의 기존 관례와 일치한다.
다만 그 자리를 고치는 동안 같은 클래스의 결함이 다른 자리에서 새로 자랐다 — `RESOURCE_NOT_FOUND`
에러 리터럴이 `findByIdForUpdate` 신설과 `rotateBotToken` 의 삭제-경합 방어로 2곳에서
4곳으로 늘었고, 이는 이 PR 스스로 반복해서 문서화한 "복제가 drift 를 부른다"는 교훈과
정면으로 부딪힌다. 테스트 유틸의 위임 클로저 반복(3→4)도 같은 방향의 성장이지만 위험도는
낮다. CRITICAL 급 발견은 없고, WARNING 1건과 INFO 2건 모두 이번 배치를 막을 사유는 아니지만
다음 편집 전에 정리해 두는 편이 이 PR 이 남긴 교훈과 일관된다.

## 위험도

LOW

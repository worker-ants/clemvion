# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 의 JSDoc·인라인 주석 대 실제 로직 비율이 매우 높다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:115`~`183`(함수 JSDoc), `218`~`238`(새로 추가된 인라인 주석 블록), 실제 로직은 `184`~`243` 중 15줄 남짓
  - 상세: 함수 JSDoc 이 68줄, 새로 추가된 "0행이면 그 사이 행이 사라졌다…" 인라인 주석 블록이 21줄인데 반해 실제 실행 로직(`acquireTriggerConfigLock` 호출 → `findOne` → `patch` 구성 → `update` → `affected` 판정)은 10줄 남짓이다. 이 저장소는 리뷰·실측 이력을 코드 주석에 남기는 것이 확립된 컨벤션(`spec_impact`, `/ai-review` 인용 등)이라 의도적이지만, 처음 읽는 사람이 제어 흐름을 파악하려면 서술형 산문을 상당량 건너뛰어야 한다.
  - 제안: 지금 당장 리팩터링할 필요는 없다(컨벤션에 부합). 다만 향후 이 파일을 다시 만질 때는 "왜 셋째 삭제 경로가 문제인가" 같은 서사적 근거는 CHANGELOG/plan 링크로만 남기고, 함수 JSDoc 에는 계약(입력·출력·예외 조건)만 남기는 방향을 고려할 만하다.

- **[INFO]** 테스트 헬퍼 `makeManager` 의 두 번째 인자가 이름 없는 위치 인자라 호출부만 보면 의미가 드러나지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:45`(파라미터 선언), `:169`(`makeManager({ id: TRIGGER_ID, config: {} }, 0)` 호출)
  - 상세: `updateAffected: number | null | undefined = 1` 파라미터 자체는 주석으로 잘 설명돼 있지만, 실제 호출부 `makeManager({ id: TRIGGER_ID, config: {} }, 0)` 만 보면 `0` 이 무엇을 의미하는지(0행 매치) 함수 선언까지 거슬러 올라가야 안다. 같은 파일의 다른 헬퍼 인자들은 객체 리터럴 키로 의미를 드러내는 편(`{ id, config }`)이라 대비된다.
  - 제안: 호출부에서 `makeManager(fresh, { updateAffected: 0 })` 형태의 옵션 객체로 바꾸거나, 최소한 호출부에 `const ZERO_ROWS_AFFECTED = 0;` 같은 이름 있는 상수를 두면 읽는 사람이 함수 선언을 왕복하지 않아도 된다. 우선순위 낮음(테스트 전용 헬퍼, 파일 내 유일한 사용 지점 근처에 설명 주석이 이미 있음).

- **[INFO]** 같은 파일 안에서 "값 두 개를 모두 검증" 하는 유사 테스트가 `it.each`(파라미터화)와 `for` 루프(단일 `it` 안에서 반복) 두 스타일로 혼재한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:115`~`125`(`it.each(['undefined', undefined], ['null', null])` — 기존 코드, 이 PR 이전부터 존재)와 `:176`~`185`(새로 추가된 `affected 를 보고하지 않는 드라이버…` 테스트, `for (const affected of [undefined, null])` 사용), 그리고 `:214`~`226`(`유한하지 않으면 던진다` 테스트, `for (const bad of [NaN, Infinity])` 사용)
  - 상세: 위 `it.each` 케이스는 바로 그 파일의 커밋 이력에서 "제목이 두 값을 실제로 걸지 않아 3라운드 연속 지적됐다"(`review/code/2026/09/14/21_18_21`)는 교훈으로 채택된 패턴이다. 이번에 새로 추가된 두 테스트는 같은 목적(여러 대표값을 모두 검증)을 `for` 루프로 구현했는데, `for` 루프는 첫 반복에서 실패하면 나머지 반복(예: `null` 케이스)이 실행되지 않고 테스트 리포트에 어떤 값에서 실패했는지 라벨이 남지 않는다 — `it.each` 라면 실패한 케이스명이 그대로 리포트에 남는다. 기능적 결함은 아니지만 같은 파일 안에서 확립한 컨벤션을 새 코드가 따르지 않은 사례다.
  - 제안: `it.each([[undefined], [null]])(...)`, `it.each([Number.NaN, Number.POSITIVE_INFINITY])(...)` 형태로 통일하면 실패 시 원인 격리가 쉬워지고 파일 내 일관성도 회복된다. 낮은 우선순위(현재는 각 반복이 서로 독립적인 `expect` 라 교차 오염 위험은 낮음).

- **[INFO]** `Math.min(Math.max(...))` clamp 패턴이 저장소에 다섯 번째로 등장 — 아직 공용 유틸로 추출되지 않음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:51`~`54`(`toLockTimeoutMs`)
  - 상세: 동일한 clamp 관용구가 이미 `codebase/backend/src/modules/schedules/schedules.service.ts:400`, `codebase/backend/src/modules/integrations/integrations.service.ts:876`~`877`, `codebase/backend/src/modules/knowledge-base/graph/graph-query.service.ts:255` 에 존재한다. 다만 이번 것만 `Number.isFinite` 가드 + throw 를 추가로 갖고 있어 형태가 완전히 같지는 않다.
  - 제안: 이 PR 범위에서 조치할 필요는 없다 — 이 저장소는 "진짜 동일한 보일러플레이트 3곳 이상"일 때만 추출하는 관례를 따른다(`project_reaper_engine_dry_refactor_920` 선례). 형태가 갈라져 있는(가드 유무) 지금 시점에 강제 통합하면 오히려 지금 필요 없는 유연성을 넣게 된다. 향후 `Number.isFinite` 가드가 필요한 clamp 사례가 하나 더 생기면 그때 공용 `clampFiniteInt()` 추출을 검토할 신호로 남겨둔다.

## 요약

이번 변경은 `trigger-config-lock.ts` 의 실결함(advisory lock 이 못 막는 세 번째 삭제 경로에서 `affected===0` 을 판정하지 않던 문제) 수정과 함께, 이름이 거짓 연상을 주던 `findByIdForUpdate → findByIdForPatchValidation` 개명, `lock_timeout` 값의 유한성 검증/clamp 추가, JSDoc 과대 서술 정정을 포함한 정리성 PR이다. 코드 자체의 순환 복잡도는 낮고(단순 선형 흐름, 얕은 중첩), 새로 도입된 매직 넘버(`MIN_LOCK_TIMEOUT_MS`/`MAX_LOCK_TIMEOUT_MS`)는 이름 붙은 상수로 잘 분리됐으며, 개명은 저장소 전수 검색(`*ForUpdate` 식별자·`Precheck` 어휘 계열 충돌)까지 거쳐 신중하게 결정됐다. 테스트는 각 분기(0행/미보고/정상, 유한하지 않음/범위 초과/정상)를 뮤테이션 검증까지 곁들여 촘촘히 덮고 있다. 발견된 사항은 모두 INFO 수준으로, JSDoc 밀도가 매우 높다는 점(단, 저장소의 확립된 컨벤션)과 테스트 파일 내부의 사소한 스타일 비일관성(`it.each` vs `for` 루프, 위치 인자 가독성)에 국한된다. 기능적 결함이나 구조적 유지보수성 위험은 없다.

## 위험도

LOW

# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `countRawUpdateReturning` 이 docstring 에 명시한 두 blind spot(`.query(sqlVar)` 변수 전달, 2단계 이상 중첩 제네릭)이 캐너리 테스트로 고정돼 있지 않다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:92`(`.query(sqlVar)` 서술), `:109`(`2단계 이상 중첩은 여전히 못 받는다` 서술) — 대응 테스트는 `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:100-125`(음성 `describe`, 5케이스)에 부재.
  - 상세: 이 diff 는 이전 라운드 testing WARNING("SQL 이 변수에 담기면 탐지 못한다는 사실이 미문서화")을 docstring 명시로 해결했지만, 문서화에서 멈췄다. 같은 파일의 `countCalls` 는 자신의 알려진 한계(문자열 안 URL 뒤 호출이 잘리는 것)를 `source-scan.spec.ts:49`(`'문자열 안 URL 뒤의 호출은 잘려 나간다 — 알려진 한계, 방향은 RED'`)에서 **합성 fixture 로 RED 방향까지 고정**하는 관례를 이미 세워 뒀다. `countRawUpdateReturning` 의 새 음성 `describe`(`:100-125`)는 오탐 배제 5케이스(INSERT…RETURNING, INSERT…ON CONFLICT, RETURNING 없음, 주석, QueryBuilder)는 고정했지만 정작 docstring 이 스스로 지목한 두 사각지대(`.query(sqlVar)`, 2단계+ 중첩)는 캐너리가 없다 — 향후 누가 정규식을 리팩터하다 이 두 지점의 동작이 (의도치 않게) 바뀌어도 어떤 테스트도 RED 를 내지 않는다. 이 프로젝트는 "미수정 결함/한계는 캐너리로 고정한다"는 관례를 반복 확립해 온 곳이라 이 누락은 그 관례에서 벗어난다.
  - 제안: `it.each` 음성 목록에 두 케이스를 추가 — `'await db.query(sqlVar);'`(사전 정의된 `sqlVar`) 류와 `'await db.query<Array<Array<{ id: string }>>>(...)'` 류를 넣어 `hasRawUpdateReturning(...) === false` 를 명시적으로 고정한다.

- **[WARNING]** W2 하드닝(`guardCount < rawCount` 개수 비교, 구 존재-only `=== 0` 판정을 대체)을 실제로 가르는 **판별 입력**이 어떤 영속 테스트에도 없다 — 오직 검증 직후 삭제된 수동 프로브 파일로만 1회 확인됐다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:215-227`(`it('발견된 지점은 모두 raw 지점 수만큼 헬퍼를 거치거나...')`) — 이 판정 로직(`guardCount < rawCount`)은 이 `it` 본문에 인라인으로만 존재하고 별도 테스트 가능한 함수로 추출되지 않았으며, 입력은 항상 `discover()`(실제 `src/**` 스캔)에서 온다.
  - 상세: 이 비교가 구 판정(`=== 0`)과 실제로 달라지는 지점은 "한 파일에 raw 지점이 2곳 이상이고 헬퍼가 그보다 적게(1곳 이상 0곳 초과) 거치는" 경우뿐이다. 실측 확인 결과 현재 `discover()` 가 찾는 실제 파일들은 전부 두 극단 중 하나다 — `ALLOWED` 4개는 헬퍼 0개가 필요(존재-only 판정도 rawCount 판정도 이 경우 구별 못함, `allowed.has(rel)` 로 먼저 걸러짐), `execution-engine.service.ts`(raw 2 / 헬퍼 2)·`knowledge-base.service.ts`(raw 5 / 헬퍼 5) 등은 **정확히 일치**해 `guardCount < rawCount` 든 `guardCount === 0` 이든 결과가 같다(둘 다 `false` → guarded 로 분류). 즉 부분 커버리지(`0 < guardCount < rawCount`) 라는, 이 하드닝이 존재하는 유일한 이유인 그 케이스를 오늘의 저장소 상태로는 아무도 재현하지 못한다. `RESOLUTION.md`(리뷰 라운드 `12_41_15`)의 뮤테이션 표는 정확히 이 문제를 인지해 `src/common/utils/__raw-update-probe.ts`(raw 2곳 + 헬퍼 1곳)를 합성해 RED 를 실측했지만, **검증 직후 그 파일을 삭제**했다 — 남은 것은 plan 문서의 표 한 줄뿐이고, 코드베이스에는 이 판별 시나리오를 고정하는 영속 fixture 가 없다. 이는 이 저장소가 이미 학습해 명시적으로 적어 둔 교훈("되돌린 뮤테이션은 회귀 방어가 아니다", `#1238`)과 정확히 같은 형태의 결함이며, 이번 라운드 `RESOLUTION.md` 자신도 "이 라운드가 드러낸 것" 절에서 스캐너 판정 축(`countRawUpdateReturning`)에 대해 같은 자기비판을 남겼지만, **판정 로직(`guardCount < rawCount`) 자체**는 그 자기비판의 대상에서 빠졌다 — 다른 층위의 같은 문제다.
  - 제안: 이 비교 로직을 `discover()`/`ALLOWED` 와 분리해 `judgeUnguarded(discovered, allowed, guardCountFn)` 류의 순수 함수로 추출하고, `source-scan.spec.ts` 또는 별도 유닛 테스트에서 합성 입력 `[['fake/file.ts', 2]]` + `guardCountFn` 이 1을 반환하는 스텁으로 "부분 커버리지가 unguarded 로 분류된다"를 영속적으로 고정할 것. 최소한, 실제 저장소 파일을 건드리지 않는 방식(예: `discovered` 배열에 스텁 엔트리를 주입해 같은 `it` 내부에서 직접 비교식만 단위 테스트)으로도 같은 효과를 얻을 수 있다.

- **[INFO]** `kb-stats.helper.spec.ts` mock 정정(`[[{...}], 1]` / `[[], 0]`)은 실제 드라이버 계약과 일치하도록 바로잡혔고, 이전 라운드 testing WARNING을 정확히 해소했다. 두 테스트 모두 `refresh()` 가 반환값을 소비하지 않는 현재 동작과 여전히 정합적이며, 회귀 위험(향후 소비자가 틀린 shape 의 mock 을 템플릿 삼는 것)을 사전에 차단한다. 문제 없음.

- **[INFO]** `discover()` 를 `beforeAll` 로 1회만 계산해 4개 `it` 이 공유하도록 바꾼 것은 순수 함수 스캔이라 테스트 간 격리를 해치지 않는다(어떤 `it` 도 `discovered` 를 변형하지 않음, 코드 주석으로도 명시). 이전 라운드 maintainability WARNING 해소가 테스트 관점에서도 안전하게 이뤄졌다.

- **[INFO]** `countRawUpdateReturning`/`hasRawUpdateReturning` 전용 `describe`(양성 6·음성 5·개수 1)는 판정 축을 실제 소스 상태와 무관하게 합성 문자열로 직접 고정해, 이전 라운드 testing WARNING("이 함수엔 전용 단위 테스트가 없다")을 정확히 해소했다. 양성/음성 양쪽을 갖춰 `return true` 류의 뭉갬 뮤턴트가 살아남지 못하는 구조도 확인했다(`RESOLUTION.md` 뮤테이션 1 실측과 일치).

## 요약

핵심 회귀 가드(`countRawUpdateReturning`/`hasRawUpdateReturning` 전용 테스트, `kb-stats.helper.spec.ts` mock shape 정정, `discover()` 캐싱)는 이전 라운드 testing 발견 4건을 모두 정확히 해소했고 새 테스트들은 격리·가독성·의도 표현 면에서 양호하다. 다만 이번 라운드에서 새로 드러나는 두 갭이 남는다 — (1) docstring 이 스스로 명시한 두 blind spot(`.query(sqlVar)`, 2단계+ 중첩)이 문서화에는 반영됐지만 캐너리 테스트로는 고정되지 않아 이 파일 자신의 기존 관례("알려진 한계는 RED 방향 테스트로 고정")에서 벗어난다. (2) 이 PR 의 핵심 하드닝인 개수 기반 판정(`guardCount < rawCount`)을 실제로 가르는 입력(부분 커버리지 파일)이 오늘의 저장소 상태에는 없고, 유일한 검증은 검증 직후 삭제된 수동 프로브였다 — 이 판정 로직이 향후 `=== 0` 으로 후퇴해도 어떤 자동화 테스트도 잡지 못한다. 둘 다 활성 버그는 아니지만, 이 PR 이 방지하려는 "새 지점이 조용히 미가드로 남는 것"과 같은 형태의 조용한 회귀 경로를 가드 자신의 테스트 스위트에 남긴다.

## 위험도
MEDIUM

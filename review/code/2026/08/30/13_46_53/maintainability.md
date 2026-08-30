# 유지보수성(Maintainability) Review

## 리뷰 범위

이번 라운드(`13_46_53`)의 누적 diff(`origin/main...HEAD`, 41개 파일) 중 유지보수성 관점 실질 검토 대상은 아래 7개다:

- `codebase/backend/src/common/__test-utils__/source-scan.ts` — `countRawUpdateReturning`/`hasRawUpdateReturning`
- `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` — 위 두 함수의 판정 축 테스트(양성 6·음성 5·개수 1)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 발견형 구조 가드 + `findUnguarded` 순수 함수 추출(이번 라운드 신규)
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` / `.spec.ts` — 타입 인자 튜플 정정
- `plan/in-progress/update-returning-tuple-shape.md`, `CHANGELOG.md` — 문서(보조 검토)

`review/code/2026/08/30/{12_41_15,13_15_58}/**`, `review/consistency/2026/08/30/12_17_21/**`는 이전 라운드가 생성한 워크플로 산출물(리포트 md/json)이라 애플리케이션 코드가 아니므로 본 관점의 정밀 검토 대상에서 제외한다 — 직전 두 라운드의 동일 관점 리뷰어가 이미 같은 스코프 판단을 내렸다(`12_41_15/maintainability.md`, `13_15_58/maintainability.md`).

직전 두 라운드가 이미 지적하고 이번 라운드 이전에 해소된 항목(직접 코드 대조로 재확인):
- allowlist 최소 사유 길이 `20` → `MIN_REASON_LENGTH` 상수화됨 (`update-returning-rows.spec.ts:186`). 해결 확인.
- `SRC` 상수 파일 내 재선언 → 파일 상단으로 hoist됨 (`:12`). 해결 확인.
- `discover()` 3회 반복 호출 → `beforeAll` 캐싱으로 1회화됨 (`:261-264`). 해결 확인.

저장소 파일은 Read/Bash(읽기 전용)로만 조사했다 — 뮤테이션·쓰기 없음. `git status --short` 확인 결과 이 세션 산출 디렉터리(`review/code/2026/08/30/13_46_53/`) 외 변경 없음.

## 발견사항

- **[INFO]** `findUnguarded`(이번 라운드 신규 추출된 discovery-guard 판정 로직)가 `source-scan.ts` 자신이 명시한 "공유 로직은 여기로 모은다" 원칙을 따르지 않고 스펙 파일 안에 export 없이 남았다
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:167-182`(`findUnguarded` 정의) — 대조 원칙: `codebase/backend/src/common/__test-utils__/source-scan.ts:14-21`(module docstring "## 왜 공유하나" — *"세 번째 가드가 생겨도 여기만 고치면 되도록 둘의 계산을 여기로 모은다"*)
  - 상세: `countCalls`/`countRawUpdateReturning`은 정확히 이 원칙에 따라 `source-scan.ts`로 이관됐다. 그런데 이번 라운드(`a2ab29e2c`)에서 새로 추출된 `findUnguarded`(존재-only 판정을 개수 판정으로 대체하는, 이 PR의 핵심 하드닝 로직)는 같은 파일이 아니라 `update-returning-rows.spec.ts` 안에만 정의돼 다른 파일에서 재사용할 수 없다. 자매 파일 `assert-row-array.spec.ts`(직접 대조 확인)는 지금은 여전히 큐레이션(`EXPECTED`/`FILES`) 방식만 쓰고 발견형 판정이 없지만, 이 PR 이 첨부한 plan(`plan/in-progress/update-returning-tuple-shape.md:280-290`)이 이미 "자매 가드의 `CONSUMING` 정규식이 복제돼 있다"는 **같은 클래스의 비대칭**을 기록해 두고 "세 번째 가드가 생기는 시점이 `source-scan.ts` 이관의 자연스러운 착수 지점"이라고 처방까지 적어 뒀다. `findUnguarded`가 요구하는 것(발견 개수 vs 가드 개수 비교 + allowlist 초과 판정)은 SQL 스캐닝보다 오히려 더 범용적인 로직이라, `assert-row-array.spec.ts`가 같은 발견형 판정으로 확장되는 날 이 함수는 재사용이 아니라 **복제**를 부른다 — 이 저장소가 반복 지적해 온 "하드닝을 한쪽 자매에만 적용" 결함 클래스의 다음 겹이 될 수 있는 자리다.
  - 제안: 조치 급하지 않음(오늘은 소비자가 `update-returning-rows.spec.ts` 하나뿐이고 활성 결함이 아니다). `assert-row-array.spec.ts`가 발견형 판정을 필요로 하는 시점에 `findUnguarded`를 `source-scan.ts`(또는 신규 공유 판정 모듈)로 이관해 두 파일이 재사용하게 할 것. plan 의 기존 backlog 항목(`:280-290`, `CONSUMING` 정규식 이관)에 `findUnguarded`도 함께 명시해 두면 다음 사람이 이 자리를 놓치지 않는다.

- **[INFO]** `[string, number]` 튜플 shape이 이름 없이 세 곳에서 구조적으로만 동일하게 반복된다
  - 위치: `update-returning-rows.spec.ts:64`(`EXPECTED: Array<[string, number]>` — "파일, 기대 헬퍼 호출 수"), `:167-168`(`findUnguarded` 매개변수 `discovered: ReadonlyArray<readonly [string, number]>` — "파일, raw 지점 수"), `:247`(`discover(): Array<[string, number]>`)
  - 상세: 세 타입이 전부 `[path, count]` 모양이지만 `count`가 의미하는 바(기대 헬퍼 호출 수 vs 발견된 raw 지점 수)는 서로 다르다. TypeScript 구조적 타이핑상 셋은 호환 가능한 동일 타입이라, 실수로 `EXPECTED`(기대 헬퍼 수)를 `findUnguarded`의 `discovered`(raw 지점 수) 자리에 넘겨도 컴파일러가 잡지 못한다. 라벨 있는 튜플(`type FileRawCount = readonly [path: string, rawCount: number]`)로 이름을 붙이면 위치의 의미가 코드에 남는다.
  - 제안: 급하지 않음. 다음에 튜플 타입이 하나 더 추가되는 시점에 상단 `type` 별칭으로 통일 고려.

- **[INFO]** `update-returning-rows.spec.ts`가 서로 다른 검증 철학을 가진 4개 `describe` 블록을 한 파일(352줄)에 담고 있다
  - 위치: 파일 전체 — `:14`(`updateReturningRows` 단위 테스트), `:58`(큐레이션 `EXPECTED` 정확-개수 가드), `:184`(발견형 discovery 가드: `listSources`/`discover`/`ALLOWED`/`findUnguarded` 호출), `:306`(`findUnguarded` 자체의 합성 입력 단위 테스트)
  - 상세: 각 블록은 응집도가 있고 앞에 붙은 장문 주석이 왜 그 블록이 필요한지 명확히 설명하지만("제품 함수 테스트" · "구조적 회귀 가드(2종)" · "순수 함수 단위 테스트"), 파일 하나가 세 가지 서로 다른 테스트 책임을 겹쳐 지고 있다는 점은 사실이다. 위 첫 항목(`findUnguarded` 이관)을 처리하면 그 전용 테스트(`:306-351`)도 자연히 별도 `.spec.ts`로 분리되어 이 파일 길이도 함께 줄어드는 부수 효과가 있다.
  - 제안: 조치 불요(오늘 가독성을 해치는 수준은 아니며, 각 블록에 명확한 헤더 주석이 있어 탐색은 쉽다). 첫 항목을 처리하는 시점에 자연히 개선된다.

- **[정보 확인]** `findUnguarded` 자체는 함수 길이·중첩 깊이·순환 복잡도 모두 양호
  - `codebase/backend/src/common/utils/update-returning-rows.spec.ts:167-182` — for 루프 1개 + if 2개(순환 복잡도 3), 최대 중첩 3단계(`for` → `if` → `if`), 매개변수 이름(`discovered`/`allowed`/`guardCountOf`)이 각자 역할을 명확히 드러낸다. `ALLOWED` 3-tuple(`:200-222`)도 각 항목에 사유 문자열이 딸려 있어 "왜 면제됐는지"가 코드 자체에 남는다.
  - `countRawUpdateReturning`(`source-scan.ts:100-121`)도 for-loop + 단일 if, 중첩 2단계로 여전히 양호. 새로 추가된 두 음성 캐너리(`.query(sqlVar)`, 2단계 중첩 제네릭, `source-scan.spec.ts:128-136`)는 기존 `it.each` 패턴을 그대로 따르며 각 항목에 "왜 대상이 아닌가/왜 못 보는가"를 주석으로 남겼다 — 일관성 위반 없음.

## 요약

이번 라운드의 핵심 신규 코드는 `findUnguarded` 순수 함수 추출과 그에 대한 합성 입력 테스트, `ALLOWED` 3-tuple 확장, `source-scan.spec.ts`의 두 blind-spot 음성 캐너리다. 네이밍·함수 길이·중첩 깊이·순환 복잡도는 모두 양호하고, 직전 두 라운드가 지적한 매직넘버(`MIN_REASON_LENGTH`)·상수 재선언(`SRC`)·반복 호출(`discover()` 3회)은 코드 대조로 해결이 확인됐다. 이번 라운드에서 새로 관측한 것은 전부 INFO 수준이며 공통된 한 가지 패턴을 가리킨다 — `findUnguarded`가 `source-scan.ts`의 "세 번째 가드를 위해 공유 로직을 모은다"는 자신의 원칙을 아직 따르지 않고 스펙 파일에 갇혀 있다는 것. 이는 이 저장소가 plan 문서에 이미 같은 클래스로 기록해 둔 `CONSUMING` 정규식 복제 항목과 성격이 같고, `assert-row-array.spec.ts`가 발견형 판정으로 확장되는 시점에 실제 복제로 번질 수 있는 자리다. 오늘은 활성 결함이 아니라 급한 조치는 없다.

## 위험도
LOW

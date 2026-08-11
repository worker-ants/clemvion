# 성능(Performance) Review

## 방법론

이 PR 의 유일한 성능 항목(`extractLinks` 사전 필터)과 부수적으로 함께 들어온 `walkTree` 통합에
대해, 리뷰이 아니라 **직접 실측**으로 검증했다. 저장소를 수정하지 않기 위해 벤치마크 스크립트는
전부 스크래치패드(`/private/tmp/.../scratchpad/bench*.js`)에 작성했고, 대상은 워크트리의 실제
파일(`codebase/{backend,frontend,channel-web-chat,packages}` 소스, `spec/`, `plan/in-progress/`)을
`node` 로 직접 읽어 측정했다. `git checkout`/`restore` 등 저장소를 건드리는 명령은 쓰지 않았다.

## 발견사항

- **[INFO]** 주장한 이득("전수 스캔 114ms → 56ms")이 실재를 재현함
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:97-105` (`cannotContainLink`, `extractLinks`)
  - 상세: `collectCodebaseSources` 와 동일 조건(`node_modules`/`dist`/`build`/`.next` 제외,
    `.ts`/`.tsx`)으로 실 저장소를 순회하면 **2077개** 파일이 나온다 — PR 주석이 인용한
    "codebase 소스 2077개" 와 정확히 일치. 이 2077개에 대해 old(사전 필터 없음) / new(사전 필터
    포함) 를 각 9회 반복 측정(중앙값 채택)했다.
    - 디스크에서 매번 읽는 실제 시그니처(`extractLinks(absPath)`)와 동일한 방식: **old 119.17ms
      → new 74.08ms (1.61x, -45.09ms)**
    - 파일 내용을 미리 메모리에 올려 CPU 비용만 격리: **old 62.68ms → new 21.52ms (2.91x,
      -41.15ms)**
    - 두 측정 모두 PR 이 적은 "114ms → 56ms"(≈2x, -58ms)와 같은 자릿수·같은 방향으로 재현된다.
      정확한 절대값은 머신마다 다르지만("실측"이 다른 머신에서 나온 값이라 완전 일치는 기대할
      수 없다), 청구된 효과 자체는 조작이 아니라 실재한다.
    - 사전 필터 통과율도 함께 재현: `"](" ` 35개(1.7%), `"](" ∨ "]\`` `어느 한쪽 통과 247개
      (11.9%) — PR 주석의 "35개(1.7%) / 246개(11.8%)"와 거의 일치(±1건은 그사이 커밋으로 인한
      파일 수 변동으로 보임).
  - 제안: 없음 — 주장이 실재함을 확인.

- **[INFO]** 두 `includes()` 호출 비용이 절약분을 잠식하지 않음 — 큰 파일에서도
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:97-99` (`cannotContainLink`)
  - 상세: 저장소에서 가장 큰 codebase 소스 파일
    (`codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`, 699KB)로
    개별 측정했다. `!text.includes("](") && !text.includes("]\`")`(2회 substring 탐색)의 비용은
    ~46μs/call, 반면 그 파일의 전체 line-scan(`scanBody`, fence 판정 + 인라인 코드 제거 + 정규식
    exec 루프) 비용은 ~2.78ms/call — 사전 필터가 약 **60배** 더 싸다. `includes` 는 파일 길이에
    선형이지만 상수 계수가 매우 작아(V8 내장 substring search), 파일이 커질수록 filter 쪽 비용도
    커지긴 하나 scanBody 쪽 비용(라인 분할 + 정규식)이 더 가파르게 커져 역전 지점이 관측되지
    않았다.
    필터를 통과해 결국 전체 스캔까지 가는 "최악의 경우"(247개 파일 전수, 즉 필터가 아무것도
    걸러주지 못하는 그룹만 골라 측정)로도 old 대비 오버헤드는 총 0.625ms(파일당 평균 2.53μs)에
    그친다 — 이 그룹만 놓고 보면 new 가 old 보다 근소하게(~3%) 느리지만, 나머지 88% 파일에서
    스캔 자체를 건너뛰는 이득이 이를 압도적으로 상쇄한다.
  - 제안: 없음.

- **[LOW]** `walkTree` 클로저 통합이 순회 자체를 ~20% 늦추지만, 스위트 전체 시간엔 무관측
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:67-100` (`walkTree`)
  - 상세: 동일 트리(codebase 소스 루트, 2077 파일 / 468 디렉터리)에 대해 (A) PR 이 실은
    `walkTree`(옵션 객체 + 클로저 콜백 `skipDir`/`includeFile` + 매 호출 `rel()` 클로저) 와 (B)
    PR 이전 형태(필터 조건을 루프 안에 직접 하드코딩한 손수 DFS, diff 의 `-` 쪽을 그대로
    재구성)를 같은 Node 프로세스에서 각 15회 측정(중앙값 채택)했다.
    - `walkTree`: 18.36ms (median) vs 인라인: 15.01ms (median) → **델타 +3.36ms (+22.4%,
      상대적으로는 유의미)**.
    - 그러나 이 절대값 자체가 `pnpm --filter frontend exec vitest run docs` 로 3회 반복 실행한
      실제 문서 가드 스위트(26 test files, 2930 tests) 총 시간 **4.61s / 4.70s / 4.78s** 대비
      0.4% 미만이다. `walkTree` 기반 collector(`collectCodebaseSources` 등)는 스위트 내에서
      여러 `it()`/파일에 걸쳐 캐시 없이 반복 호출되지만(예: `spec-link-integrity.test.ts` 가
      `collectSpecMarkdown`/`collectCodebaseSources`/`findBrokenLinks`/
      `findBrokenSpecLinksInSources` 를 파일 하나 안에서 4번 재호출), 그걸 감안해도 절대
      기여분은 수십 ms 수준으로 vitest 자체의 transform/setup/import 오버헤드(수 초)에 완전히
      묻힌다. `origin/main` 체크아웃으로 별도 baseline 을 뜨는 것은 저장소를 건드리지 않는다는
      제약(리뷰 규약)상 하지 않았지만, 이 스케일 차이(3.36ms vs 4700ms, 3자릿수 차이)만으로도
      "walkTree 통합이 순회 성능을 나쁘게 만들었다"는 우려는 실무적으로 근거가 약하다.
  - 제안: 없음. 굳이 짜낸다면 `skipDir`/`includeFile` 을 화살표 리터럴 대신 top-level 명명 함수로
    끌어올려 V8 인라이닝 가능성을 높이는 정도인데, 기대 이득이 run 당 1ms 미만이라 권장하지 않음.

- **[INFO]** `rel(full)` 을 매 `skipDir` 호출마다 계산 — 실측상 유의미하지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:74-75, 87`
    (`const rel = (full) => path.relative(root, full).split(path.sep).join("/");` /
    `if (options.skipDir?.(entry.name, rel(full))) continue;`)
  - 상세: 프롬프트가 지적한 대로, 프로덕션 호출부 3곳이 전부 `skipDir` 의 두 번째 인자(`relPath`)
    를 안 쓰고 basename 만 쓴다 — 직접 코드로 확인:
    - `impl-anchor-parse.ts:117` — `skipDir: (name) => name.startsWith("_")`
    - `plan-scan.ts:68` — `skipDir: (name) => name === "archive"`
    - `spec-links.ts:333` — `skipDir: (name) => CODEBASE_SKIP_DIRS.has(name)`
    (`collectSpecMarkdown`/`collectApplicableSpecs` 는 `skipDir` 자체를 안 넘기므로 optional
    chaining(`?.`)이 short-circuit 되어 이 경우엔 `rel(full)` 평가 자체가 스킵된다 — 낭비는
    "skipDir 를 넘기지만 relPath 를 안 쓰는" 세 호출부에 한정.)
    실측: codebase 소스 루트 순회에서 `skipDir` 이 호출되는(=디렉터리인) 엔트리 수는 468개,
    `path.relative + split + join` 1회 비용은 ~2.41μs/call → 이 트리 하나를 순회할 때 낭비되는
    총 시간은 **~1.13ms**. 이는 바로 위 항목의 델타(+3.36ms)의 약 1/3을 차지하는 걸로 보이나,
    절대값 자체는 스위트 총 시간(4.6~4.8s) 대비 0.02% 남짓이라 실무적 영향은 없다.
  - 제안: 우선순위 낮음(하지 않아도 무방). 고치고 싶다면 `skipDir.length > 1` 로 relPath 필요
    여부를 감지해 필요할 때만 `rel(full)` 을 계산하거나, `relPath` 를 즉시값 대신 getter 로
    lazy 평가하는 방법이 있으나, 복잡도 대비 이득이 1ms 미만이라 권장하지 않는다.

## 요약

이 PR 의 성능 변경(`extractLinks` 사전 필터)은 청구한 이득("114ms → 56ms")이 직접 재현
측정으로 실재함이 확인됐고, 필터 자체의 비용(두 `includes()`)은 가장 큰 파일(699KB)에서도
전체 스캔 대비 60배 이상 싸서 절약분을 잠식하지 않는다. 부수적으로 들어온 `walkTree` 통합은
클로저 콜백 + 매 디렉터리 `rel()` 계산으로 인해 순회 자체에 상대적으로 ~22%(+3.36ms)의 측정
가능한 오버헤드가 있고, 그중 basename 만 쓰는 `skipDir` 호출부의 불필요한 `rel()` 계산이
~1.13ms 를 차지하는 것도 실측으로 확인했다. 그러나 두 오버헤드 모두 절대값이 ms 단위이고 실제
vitest 문서 가드 스위트 총 시간(4.6~4.8초, 26 파일/2930 테스트)에 비하면 1% 미만이라 관측
가능한 회귀가 아니다. 억지로 CRITICAL/WARNING 을 만들 이유가 없다 — 전부 INFO/LOW 수준의
확인·참고 사항이다.

## 위험도

LOW

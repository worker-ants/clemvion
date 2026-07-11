# 테스트(Testing) 리뷰 — spec-links.ts 스캔 코어 파라미터화 리팩터

대상: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`findBrokenLinks` /
`findBrokenSpecLinksInSources` 중복 스캔 로직을 `findBrokenLinksInFiles` + `LinkScanOptions`
공유 헬퍼로 통합). 소비자 테스트(`spec-link-integrity.test.ts`)는 이번 diff 에 포함되지
않음(무변경).

## 발견사항

- **[WARNING]** 신규 `LinkScanOptions` 분기 중 `checkSelfAnchors: false` 스킵 경로가 어떤
  테스트에서도 실질적으로 실행(exercise)되지 않음
  - 위치: `spec-links.ts:187` (`if (!options.checkSelfAnchors) continue;`), 소비 측
    `findBrokenSpecLinksInSources` (`spec-links.ts:322-325`)
  - 상세: `findBrokenSpecLinksInSources`(codebase `.ts`/`.tsx` 소스 스캔)는
    `checkSelfAnchors: false` 를 넘긴다. 이 값이 실제로 분기(`target.startsWith("#")`
    이면서 `!options.checkSelfAnchors`)를 타려면 스캔 대상 `.ts`/`.tsx` 소스 안에
    순수 same-file anchor 링크(`[..](#foo)`)가 존재해야 하는데, `grep -rnE
    '\]\(#[^)]+\)' codebase/{backend,frontend,channel-web-chat}/src codebase/packages`
    결과 이런 링크는 전부 `.mdx` 문서(`content/docs/**`)에만 존재하고 `collectCodebaseSources`
    스캔 대상인 `.ts`/`.tsx` 파일에는 하나도 없다. 즉 이 diff 로 새로 생긴 `if
    (!options.checkSelfAnchors) continue;` 라인은 현재 리포 코퍼스 기준 브랜치
    커버리지 0%다 — 회귀(예: 부호를 반대로 뒤집는 실수, `checkSelfAnchors` 인자
    누락)가 나도 기존 스위트가 잡아내지 못한다.
  - 제안: `spec-links.ts` 에 대해 `fixtures/`(이미 `registry.test.ts` 가 쓰는 패턴 참고)
    같은 임시 디렉터리 fixture 를 이용해, same-file anchor 를 포함한 가짜 `.ts` 소스
    1개로 `findBrokenSpecLinksInSources` (또는 export 를 추가한 `findBrokenLinksInFiles`
    자체)를 직접 단위 테스트하는 케이스를 추가 — "same-file anchor 는 무시된다" 를
    명시적으로 assert.

- **[WARNING]** 이 가드 스위트 전체가 "실제 리포에 위반이 0건이어야 한다"는 positive-only
  assertion 만 갖고 있어, 검출 로직 자체(참 위반을 실제로 잡아내는지)를 증명하는
  fixture 기반 negative-path 테스트가 없음 — 이번 리팩터로 조기 `continue` 분기가
  늘어나 해당 리스크가 더 커짐
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:65-68`,
    `:88-91` (`expect(violations).toEqual([])`)
  - 상세: `findBrokenLinksInFiles` 는 이번 diff 로 두 개의 새 이른-continue 분기
    (`!options.checkSelfAnchors`, `options.targetFilter && !options.targetFilter(...)`)를
    얻었다. 만약 향후 편집으로 이 가드들이 의도치 않게 항상 참이 되어 스캔 루프가
    사실상 아무것도 검사하지 않게 되더라도(vacuous-scan), "위반 0건" 을 기대하는
    현재 테스트는 여전히 통과한다 — 회귀가 조용히 은폐된다. `resolves a real repo
    root...`/`scans a non-trivial ... set` 테스트는 파일 **수집**의 vacuous-pass 만
    막을 뿐, 링크 **검출** 로직의 vacuous-pass 는 막지 못한다.
  - 제안: 임시 broken-link fixture(예: 존재하지 않는 상대경로를 가리키는 링크 1개 +
    잘못된 anchor 링크 1개)를 만들어 `findBrokenLinks`/`findBrokenSpecLinksInSources`
    가 정확히 그 위반들을 `DEAD`/`ANCHOR` 로 보고하는지 검증하는 테스트를 추가하면,
    이번 리팩터가 만든 분기들의 "실제로 걸러야 할 건 걸러내고 있다"는 사실을
    직접 증명할 수 있다. (이 갭은 리팩터 이전부터 있었으나, 새 옵션 분기 추가로
    은폐 리스크 표면이 넓어졌으므로 이번 기회에 보강 권장.)

- **[INFO]** `findBrokenLinksInFiles`(공유 코어)가 export 되지 않아 옵션 조합을
  화이트박스로 직접 단위 테스트할 수 없음
  - 위치: `spec-links.ts:181` (`function findBrokenLinksInFiles(...)` — `export` 없음)
  - 상세: 함수 자체는 순수 함수(파일 목록 + 옵션 → 위반 배열, 숨은 전역 상태 없음)라
    테스트 용이성은 좋으나, 현재는 두 public wrapper(`findBrokenLinks`,
    `findBrokenSpecLinksInSources`)를 통해서만, 그리고 항상 실제 리포 전체를
    스캔하는 방식으로만 간접 검증된다. `checkSelfAnchors`/`targetFilter` 를
    독립적으로 조합해 검증하는 결정적(deterministic)·빠른 단위 테스트를 원한다면
    export 후 소형 fixture 로 직접 호출하는 편이 리포 크기에 좌우되지 않는
    안정적 커버리지를 준다.
  - 제안: 필수는 아님(현재 public 계약은 변하지 않았고 회귀 스위트가 그린임).
    다만 향후 세 번째 호출자(예: `checkSelfAnchors: true` + `targetFilter` 동시
    사용)가 추가될 가능성이 있다면 이 시점에 export + 단위 테스트해 두는 편이 저렴하다.

- **[INFO]** 리팩터는 동작 보존(behavior-preserving)이며 기존 회귀 스위트가 실제로
  통과함을 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` (13 tests)
  - 상세: `npx vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` 실행 결과
    13/13 통과. 코드 정독 결과도 다음 동치성을 뒷받침한다 — (1) `findBrokenLinks` 는
    `checkSelfAnchors: true`, `targetFilter` 없음으로 이전과 동일하게 모든 상대링크를
    검사, (2) `findBrokenSpecLinksInSources` 는 `checkSelfAnchors: false` +
    `SPEC_MD_TARGET_RE` 필터로 이전과 동일한 스코프, (3) 이전엔 codebase-sources
    분기에 없던 `resolved.toLowerCase().endsWith(".md")` 가드가 공유 함수에 추가됐지만
    `SPEC_MD_TARGET_RE` 가 이미 `\.md$` 를 강제하므로 실질적으로 no-op(중복
    안전장치). 회귀 위험 낮음.
  - 제안: 없음(정보성 확인).

## 요약

`spec-links.ts` DEAD/ANCHOR 스캔 코어를 `findBrokenLinksInFiles` + `LinkScanOptions` 로
묶어 중복을 제거한 순수 리팩터로, 공개 API(`findBrokenLinks`,
`findBrokenSpecLinksInSources`, `LinkViolation`, `slugify` 등) 시그니처는 그대로다.
소비 테스트(`spec-link-integrity.test.ts`)는 무변경으로 여전히 실제 리포 전체를
스캔하는 통합 방식이며, 실행해보니 13/13 그린 — 코드 리딩으로 확인한 동치성과 일치해
현재 리포 콘텐츠 기준 회귀는 없다. 다만 이번 리팩터가 새로 도입한 두 옵션 분기
(`checkSelfAnchors`, `targetFilter`)는 전용 fixture 기반 단위 테스트 없이 오직 "실제
리포에 위반 0건" 이라는 positive-only 통합 어서션에만 기대고 있고, 그중
`checkSelfAnchors: false` 스킵 라인은 현재 `.ts`/`.tsx` 소스 코퍼스에 same-file
anchor 링크가 전혀 없어 실질 브랜치 커버리지가 0%다. 검출 로직 자체를 증명하는
negative-path(의도적으로 깨진 fixture) 테스트도 부재해, 향후 이 가드 함수를 다시
건드릴 때 조용한 vacuous-pass 회귀를 잡아내기 어려운 구조다.

## 위험도

LOW

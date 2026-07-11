# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** private 코어 함수와 public wrapper 함수의 이름이 한 단어(`InFiles`)만 다름
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:627` (`findBrokenLinksInFiles`) vs `:707` (`findBrokenLinks`)
  - 상세: 새로 추출한 공유 코어 `findBrokenLinksInFiles`가 기존 public 함수 `findBrokenLinks`와 이름이 거의 동일해 IDE 자동완성이나 빠른 코드 리딩 시 둘을 혼동할 여지가 있다. 특히 `findBrokenLinksInFiles`는 파일 내부 전용(export 안 됨)이라 외부에서는 문제되지 않지만, 파일 내부 유지보수 시 어느 것을 호출해야 하는지 헷갈릴 수 있다.
  - 제안: `scanLinksCore`, `runLinkScan` 등 접두어를 달리하는 이름으로 구분하면 가독성이 더 좋아진다. 다만 JSDoc 주석이 관계를 명확히 설명하고 있어 실질적 위험은 낮음.

- **[INFO]** `findBrokenLinksInFiles`의 중첩 깊이·순환 복잡도가 다소 높음 (리팩터 이전부터 존재, 이번 diff 로 신규 도입된 것은 아님)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:627-698`
  - 상세: `for` 안에 `for`, 그 안에 `if (target.startsWith("#"))` / `if (isExternal(...))` / `if (!fs.existsSync(...))` / `if (anchor && ...)` 분기가 이어지며 최대 4단 중첩(및 CC ~11)에 이른다. 이는 병합 전 두 함수 각각에 이미 있던 구조를 옵션화해 하나로 합친 결과이며, guard-clause(`continue`) 스타일로 얕게 유지하려는 노력은 보이지만, 향후 세 번째 scan 변형이 추가되면 복잡도가 더 늘어날 수 있다.
  - 제안: 필요 시 same-file anchor 체크와 cross-file path/anchor 체크를 각각 이름 있는 헬퍼(`checkSameFileAnchor`, `checkPathTarget`)로 추출해 최상위 루프를 얕게 유지할 수 있다. 현재 수준에서는 즉각 조치 불요.

- **[INFO]** 테스트 파일에서 임시 디렉토리 생성/정리 패턴이 `beforeAll`/`afterAll` 공유 픽스처와 마지막 단일 테스트에서 별도로 반복됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:64-65`, `:98-100`, `:127-140`
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), ...))` + `fs.rmSync(..., { recursive: true, force: true })` 조합이 공유 fixture(`beforeAll`/`afterAll`)와 마지막 "non-vacuous healthy path" 테스트(`try/finally`)에 각각 나타난다. "완전히 깨끗한 트리"를 별도로 검증하려는 의도적 분리이므로 결함은 아니나, 코드량이 늘면 작은 헬퍼(`withTempSpecTree(setupFn)`)로 통합할 여지가 있다.
  - 제안: 현재 6줄 내외의 경미한 중복이라 조치 불요. 유사 fixture 가 추가되면 헬퍼 추출 고려.

## 요약

이번 변경은 `findBrokenLinks`(spec/**)와 `findBrokenSpecLinksInSources`(codebase 소스)가 갖고 있던 ~40줄 규모의 DEAD/ANCHOR 스캔 루프 중복을 `findBrokenLinksInFiles(files, options)` 공유 코어로 정리한 리팩터로, 옵션 객체(`checkSelfAnchors`, `targetFilter`)를 이름 있는 boolean/predicate 로 설계해 호출부 가독성을 유지했고, 두 public 함수는 파일 목록과 옵션만 다른 얇은 wrapper 로 축소되어 계약(시그니처·정렬·소비자 동작)이 그대로 보존된다. 이전에 각 함수 내부에서 중복되던 slug 캐시 조회 로직도 `slugsFor` 클로저로 한 번 더 통합해 DRY 원칙을 이중으로 적용했다. 신규 테스트 파일은 negative-path fixture 를 통해 두 옵션 분기(`checkSelfAnchors:true/false`, `targetFilter`)를 명시적으로 고정하고, self-referential 마크다운 링크 오탐을 피하기 위한 `mkLink` 헬퍼 설계와 주석이 세심하다. 전반적으로 가독성·네이밍·중복 제거·기존 스타일과의 일관성이 모두 양호하며, 지적된 사항은 모두 INFO 수준으로 즉시 조치가 필요하지 않다.

## 위험도
LOW

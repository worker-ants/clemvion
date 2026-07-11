# 유지보수성(Maintainability) 리뷰 — codebase/frontend/src/lib/docs/__tests__/spec-links.ts

## 발견사항

- **[INFO]** 옵션 플래그와 각 분기의 결합 관계가 함수 본문을 읽어야 파악된다
  - 위치: `LinkScanOptions` (365-377행), `findBrokenLinksInFiles` (385-456행)
  - 상세: `checkSelfAnchors` 는 `target.startsWith("#")` 분기에만, `targetFilter` 는 path-target 분기에만 적용된다. 인터페이스 필드 JSDoc 에 각각 설명은 있지만 "이 옵션이 어느 분기에 영향을 주는지"는 함수 본문을 따라가야 확정된다. 현재는 두 호출부(`findBrokenLinks`/`findBrokenSpecLinksInSources`)만 있어 실사용상 문제는 없으나, 세 번째 변형이 추가되면 옵션 조합의 암묵적 결합이 늘어나 추적 비용이 커질 수 있다.
  - 제안: 현재 스코프에서는 조치 불요. 향후 세 번째 변형이 필요해지면 boolean+predicate 조합 대신 named preset 객체(`SPEC_SCAN_OPTIONS`, `CODEBASE_SCAN_OPTIONS` 등)로 승격하는 것을 고려.

- **[INFO]** private 헬퍼가 파일 내에서 public API(`findBrokenLinks`)보다 먼저 정의됨
  - 위치: `findBrokenLinksInFiles` (385행) vs `findBrokenLinks` (465행)
  - 상세: 리팩터 전에는 `findBrokenLinks` 가 이 섹션의 첫 익스포트였다. 리팩터 후에는 module-private 헬퍼가 먼저 나오고 그 아래 두 public 진입점 중 하나(`findBrokenLinks`)만 바로 붙어 있으며, 다른 하나(`findBrokenSpecLinksInSources`)는 파일 하단 별도 섹션에 위치한다. "helper-before-consumer" 배치 자체는 흔한 패턴이라 크게 문제는 아니지만, 파일을 처음 훑는 독자가 이 섹션의 공개 API가 무엇인지 파악하는 데 약간의 추가 스캔이 필요하다.
  - 제안: 현행 유지 가능. 필요 시 `findBrokenLinksInFiles` 상단 JSDoc의 "두 public 진입점"이라는 표현을 "이 파일의 `findBrokenLinks`/`findBrokenSpecLinksInSources` 참고"처럼 명시적으로 링크하면 탐색성이 개선된다.

- **[INFO]** 통합 후 `findBrokenLinksInFiles` 하나의 순환복잡도가 다소 높아짐
  - 위치: `findBrokenLinksInFiles` (385-456행)
  - 상세: 기존에는 유사 로직이 두 함수(`findBrokenLinks`, `findBrokenSpecLinksInSources`)에 각각 분산돼 있어 개별 함수의 복잡도는 낮았지만 중복이 컸다. 이번 통합으로 중복은 제거됐으나(약 50줄 감소, slug 캐시 조회 로직이 3중 중복→1개 `slugsFor` 클로저로 수렴), 대신 단일 함수가 같은 분기와 옵션 체크(`checkSelfAnchors`, `targetFilter`)까지 함께 처리해 순환복잡도가 소폭 증가했다. 다만 각 분기가 짧은 guard-clause(`continue`) 위주라 실질 가독성 저하는 크지 않다.
  - 제안: 현재 크기(약 70줄, depth 최대 4단)는 허용 범위. 추가 옵션이 붙어 분기가 더 늘어나면 same-file-anchor 처리와 path-target 처리를 별도 private 함수로 다시 쪼개는 것을 고려.

## 요약

이번 변경은 `findBrokenLinks` 와 `findBrokenSpecLinksInSources` 에 거의 동일하게 중복돼 있던 DEAD/ANCHOR 스캔 로직(slug 캐시 조회 3중 중복 포함, 약 50줄)을 `findBrokenLinksInFiles` + `LinkScanOptions` 로 통합한 순수 리팩터다. diff 를 원본과 대조한 결과 same-file anchor 스킵 순서, `isExternal` 체크 순서, `targetFilter` 적용 지점, 최종 `violations.sort` 등 기존 두 함수의 동작(순서 포함)이 모두 그대로 보존되어 있어 회귀 위험은 낮다. JSDoc 도 공유 헬퍼와 두 공개 진입점의 차이를 명확히 설명하고 있고 네이밍(`checkSelfAnchors`, `targetFilter`, `slugsFor`)도 목적을 잘 드러낸다. 발견된 사항은 모두 INFO 수준의 향후 확장성 참고 사항이며 즉시 조치가 필요한 결함은 없다.

## 위험도
LOW

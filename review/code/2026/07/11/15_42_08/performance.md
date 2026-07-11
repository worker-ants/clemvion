# 성능(Performance) 리뷰 — codebase/frontend/src/lib/docs/__tests__/spec-links.ts

## 발견사항

- **[INFO]** 순수 dedup 리팩터링 — 알고리즘 복잡도 변화 없음
  - 위치: `findBrokenLinksInFiles` (신규, L385-456), `findBrokenLinks` (L465-469), `findBrokenSpecLinksInSources` (L527-532)
  - 상세: 기존 `findBrokenLinks`/`findBrokenSpecLinksInSources` 두 함수가 각자 갖고 있던 거의 동일한 이중 루프(`files × links`) + `slugCache` 조회 로직을 `findBrokenLinksInFiles` 로 병합하고 `LinkScanOptions`(`checkSelfAnchors`, `targetFilter`)로 분기했다. 파일당 링크 순회, 캐시 히트/미스 판정, `path.resolve`/`fs.existsSync` 호출 횟수는 리팩터링 전후로 1:1 동일하다. 시간복잡도는 여전히 `O(files × links)`이고, 앵커 검증은 파일당 1회 `headingSlugs` 파싱 후 `Map`/`Set` 조회로 상환(amortized) O(1)이다. 회귀 없음.
  - 제안: 없음 (정보성).

- **[INFO]** `slugCache` 스코프는 호출당(per-call) 로컬 — 두 진입점 간 미공유 (기존과 동일)
  - 위치: `findBrokenLinksInFiles` L390, `slugsFor` 클로저 L391-398
  - 상세: `slugCache`는 여전히 `findBrokenLinksInFiles` 함수 본문 안에 선언되므로, `findBrokenLinks(root)`와 `findBrokenSpecLinksInSources(root)`를 같은 테스트 스위트에서 순차 호출하면(둘 다 실제로 spec 마크다운 파일을 대상으로 heading을 파싱하는 경우가 겹칠 수 있음) 캐시가 공유되지 않아 동일 파일의 `headingSlugs` 파싱이 두 번 발생할 수 있다. 다만 이는 리팩터링 이전에도 각 함수가 자체 `slugCache`를 갖고 있어 동일했던 기존 동작이며, 이번 diff가 새로 유발한 회귀가 아니다.
  - 제안: 현재 스코프로도 문제 없음(개별 diff 범위 밖). 필요 시 모듈 레벨 `WeakMap`/`Map` 캐시로 승격해 `findBrokenLinks`·`findBrokenSpecLinksInSources`·(만약 있다면) 반복 테스트 호출 간에 heading slug 파싱 결과를 공유하면 CI 실행 시간을 추가로 줄일 수 있으나 이번 PR의 스코프는 아님.

- **[INFO]** 앵커 체크에 `resolved.toLowerCase().endsWith(".md")` 재검사 추가 — 무시 가능한 오버헤드
  - 위치: L439 (`if (anchor && resolved.toLowerCase().endsWith(".md"))`)
  - 상세: 과거 `findBrokenSpecLinksInSources` 쪽은 `targetFilter`가 이미 `SPEC_MD_TARGET_RE`(`.md$`)로 걸러졌기 때문에 별도의 확장자 재확인 없이 `if (anchor)`만 검사했다. 공유 함수로 합치면서 `findBrokenLinks` 쪽 로직(임의 상대 링크 대상이라 `.md` 여부를 몰라 확인이 필요)에 맞춰 두 경로 모두 `endsWith(".md")` 문자열 비교를 거치게 됐다. 이는 링크 1건당 O(1) 문자열 스캔(경로 길이만큼)이며, 파일 시스템 접근이나 파싱이 늘어난 게 아니라서 실질적 성능 영향은 없다.
  - 제안: 조치 불필요 — 정확성을 위한 정당한 추가 비용이며 무시할 수준.

- **[INFO]** 블로킹(sync) I/O 는 기존과 동일하게 유지 — 도구 성격상 적절
  - 위치: `headingSlugs`(L253-272), `extractLinks`(L284-308), `collectSpecMarkdown`/`collectCodebaseSources` (L334-354, L494-518)
  - 상세: `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync` 동기 호출이 그대로 유지된다. 이번 diff는 이 부분을 건드리지 않았다. 해당 코드는 Jest 테스트/CI 가드용 유틸이라 요청-응답 핫패스가 아니므로 동기 I/O 자체는 문제가 아니다.
  - 제안: 조치 불필요.

## 요약
이번 변경은 두 개의 거의 동일한 링크 스캔 함수를 `findBrokenLinksInFiles` + `LinkScanOptions`로 통합한 순수 리팩터링(dedup)이며, 루프 구조·캐싱 전략(`Map`/`Set`)·시간복잡도(`O(files × links)`, 헤딩 파싱은 파일당 1회 상환)가 리팩터링 전후로 동일하게 보존된다. N+1 성격의 파일시스템 호출 패턴, 캐시 무효화 필요성, 블로킹 I/O 사용도 기존과 다르지 않으며 새로 도입된 유일한 추가 비용(`endsWith(".md")` 재검사)은 O(1) 수준으로 무시할 만하다. 성능 관점에서 회귀 없음.

## 위험도
NONE

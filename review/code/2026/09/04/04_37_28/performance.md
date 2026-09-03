# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** 새로 추가된 "저장소 전수" 테스트가 같은 트리를 **두 번** 재귀 워크한다 — 하나가 다른 하나의 부분집합인데도
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:422-427` (`describe('저장소 전수', ...)` 블록. `git diff origin/main` 확인 결과 이 블록 전체가 이번 PR 신규 추가)
  - 상세: 같은 `describe` 블록 안에서
    ```ts
    const entities = collectTsFiles(SRC_ROOT).filter((f) => f.endsWith('.entity.ts'));
    const specs = collectTsFiles(SRC_ROOT, { includeSpec: true }).filter((f) => f.endsWith('.spec.ts'));
    ```
    두 줄이 `SRC_ROOT`(`codebase/backend/src`) 전체를 `fs.readdirSync` 로 재귀 워크하는 `collectTsFiles` 를 **각각 별도로** 호출한다. `collectTsFiles(SRC_ROOT, { includeSpec: true })` 의 결과 집합은 `collectTsFiles(SRC_ROOT)` 의 결과 집합을 완전히 포함하는 상위집합이다(같은 함수 docstring 이 실측으로 적어 둔 대로 `includeSpec` 만이 두 축의 차이를 만들고, `.entity.ts` 는 애초에 spec 이 아니므로 두 호출 결과 모두에 동일하게 나타난다). 즉 `entities` 쪽 호출이 하는 디렉터리 순회·`readdirSync`·`Dirent` 필터링 작업 전부가 바로 다음 줄에서 중복 수행된다. 같은 함수(`source-scan.ts`)의 docstring 이 "walker 사본 5개를 하나로 합친다" 며 정확히 이런 중복 워크를 없애는 것을 이 PR 의 존재 이유로 못박아 놓고, 그 통합을 소비하는 신규 테스트 코드에서 같은 클래스의 중복이 재도입됐다. 실측 컨텍스트(같은 파일 docstring): `includeSpec` 유무에 따른 파일 수 차이가 `1261` vs `818` — 즉 `SRC_ROOT` 자체가 실행 시점에 수백~천 개 이상의 파일을 갖는 트리이고, 이 순회를 두 번 도는 비용이 공짜가 아니다.
  - 제안: `collectTsFiles(SRC_ROOT, { includeSpec: true })` 한 번만 호출해 `all` 에 담고, `entities`/`specs` 둘 다 그 결과에서 `.filter()` 로 파생시킨다(`.entity.ts` 는 `.spec.ts` 가 아니므로 상위집합 한 번으로 두 축을 모두 커버한다).

- **[INFO]** 같은 `describe` 블록 안에서 `widenedEntityFields(entities)` 가 두 개의 별개 `it()` 에서 두 번 재계산된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:434-436`, `:438-442`
  - 상세: `it('[전제] 넓혀진 필드가 실제로 있다', ...)` 와 `it('낡은 캐스트가 남아 있지 않다', ...)` 가 각각 `widenedEntityFields(entities)` 를 호출한다 — 이 함수는 `entities` 목록(엔티티 `.ts` 전수)의 파일을 매번 `fs.readFileSync` 로 다시 읽고 정규식으로 다시 파싱한다. 위 WARNING 만큼 크지는 않다(엔티티 파일 수는 스캔 대상 전체보다 훨씬 적다 — 같은 파일의 `[전제]` 단언이 `>30` 을 요구) — 그래도 module-scope 상수로 한 번만 계산해 재사용할 수 있는 작업이 `it()` 경계에서 반복된다.
  - 제안: `describe` 스코프에 `const widened = widenedEntityFields(entities);` 를 한 번 두고 두 `it()` 이 그것을 참조하게 한다. (다만 이 파일의 다른 자리들처럼 "전제가 어긋나면 아래가 공허하다" 는 테스트 철학상 각 `it` 이 독립적으로 재계산해 서로를 오염시키지 않게 하려는 의도였을 수 있어 — 순수 함수라 오염 여지는 없으므로 그 우려는 해당하지 않는다.)

- **[INFO]** 이번 리팩터 자체(`collectTsFiles` 로의 walker 5-사본 통합)는 알고리즘적으로 중립 — 기존 대비 개선도 퇴보도 아님
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:249-271` (신규 `collectTsFiles`), 소비처 `audit-action-binding-guard.ts:47-48` · `engine-error-code-anchor-guard.ts:157` · `masked-reject-callers-guard.ts:51` · `redis-fail-open-catalog-guard.ts:93-94` · `nullable-type-lie-cast-guard.ts:38-40`
  - 상세: 다섯 개 가드가 각자 갖고 있던 재귀 `fs.readdirSync` walker(동일한 O(파일 수) 동기 I/O)를 단일 구현으로 합쳤을 뿐, Big-O 나 호출 빈도는 바뀌지 않는다. 각 가드의 소비 지점은 여전히 module/describe 스코프에서 1회만 호출한다(반복문 내부 호출·N+1 패턴 없음, `redis-fail-open-catalog-guard.ts` 의 `findWiredComponents` 도 `text.includes(RECORDER_FN)` 얕은 검사로 대부분의 파일에서 비싼 `ts.createSourceFile` AST 파싱을 건너뛰는 기존 최적화가 그대로 유지됨). 전부 테스트/빌드 타임 도구이지 런타임 요청 경로가 아니므로 동기 I/O 자체는 문제가 아니다.

## 요약

이번 diff 는 사실상 두 축이다 — (1) `repo-guards/__tests__/` 의 사본 5개짜리 재귀 디렉터리 walker 를 `common/__test-utils__/source-scan.ts` 의 단일 `collectTsFiles` 로 합치는 리팩터, (2) `nullable-type-lie-cast-guard.ts`/`.spec.ts` 에 새 판정 축(`widenedEntityFields`, `findStaleSpecCasts`)과 그 저장소 전수 테스트를 추가하는 작업. (1)은 성능 관점에서 중립이며 오히려 다섯 갈래로 흩어져 있던 동일 로직을 한 곳으로 모아 향후 유지보수 비용을 낮춘다. 유일하게 실질적인 발견은 (2)에서 새로 추가된 "저장소 전수" 테스트가 `SRC_ROOT` 전체를 대상으로 하는 재귀 트리 워크를 **한 줄 차이로 두 번** 수행한다는 점이다 — 뒤 호출(`includeSpec: true`)의 결과가 앞 호출의 결과를 완전히 포함하므로 앞 호출은 통째로 중복 작업이다. 이 파일 자신이 "walker 사본을 없앤다" 를 존재 이유로 내세우는 만큼, 같은 diff 안에서 중복 트리 워크를 재도입한 것은 다소 아이러니하지만, 이 워크는 요청 경로가 아니라 Jest 스위트 로드 시 1회 실행되는 test-setup 비용이라 실사용자 영향은 없고 CI 실행 시간에 미미하게 더해지는 정도다. 나머지는 전부 선형(O(n)) 스캔·정규식 처리이고 반복문 내 DB/API 호출, 캐시 부재로 인한 반복 재계산, 메모리 누수 소지는 발견되지 않았다.

## 위험도

LOW

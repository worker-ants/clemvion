STATUS=success testing review complete (32 files in scope, 7 code/test files reviewed in depth, 1 new mutation-confirmed coverage gap found, repo tree clean after mutation probe)
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰

## 컨텍스트

이 세션은 직전 라운드(`review/code/2026/08/29/19_17_28`)의 RESOLUTION 이 반영된 뒤의 재검토다.
직전 testing 리뷰가 낸 WARNING 1건 + INFO 2건 중 WARNING 1건과 INFO 2건(union ENOENT throw,
readCatalogComponents 두 번째 throw 분기) 모두 커밋 `4dbc6ee39` 로 코드에 반영됐는지 직접
실행해 확인했다. 실질 신규 로직 파일은 `redis-fail-open-catalog-guard.ts` /
`redis-fail-open-catalog.spec.ts`(신규 3자 정합 가드)와 `http-exception.filter.spec.ts`(cause
비노출 계측)뿐이고, 파일 2·3·4·7(`expression-resolver.service.spec.ts` 등)은 주석만 바뀌어
테스트 로직 변경이 없다.

## 검증 방법

- `npx jest src/repo-guards/__tests__/redis-fail-open-catalog.spec.ts` → **10/10 PASS**
  (직전 라운드 8/8 → 이번 라운드 RESOLUTION 이 2건(ENOENT·패턴 불일치 throw) 추가해 10건).
- `npx jest src/common/filters/http-exception.filter.spec.ts` → **19/19 PASS**.
- `redis-fail-open-catalog-guard.ts` 를 대상으로 **직접 뮤테이션 검증**을 1건 수행했다
  (원본은 저장소 밖 scratch 로 `cp` 백업 → 수정 → 테스트 → `cp` 로 원복, `git checkout` 미사용).
  절차 종료 후 `git status --short` 로 저장소가 깨끗함을 확인했다(잔여물 없음, untracked 항목은
  이 리뷰 자신의 출력 디렉터리뿐).

## 발견사항

- **[INFO]** `listProductionSources` 의 `node_modules`/`dist`/`.d.ts` 제외 분기가 **테스트로
  커버되지 않는다** — 뮤테이션으로 실측 확인(제외 조건을 `if (false) continue;` 로 무력화한 뒤
  `redis-fail-open-catalog.spec.ts` 를 재실행해도 **10/10 그대로 GREEN**).
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:98`
    (`if (entry.name === 'node_modules' || entry.name === 'dist') continue;`),
    같은 파일 `:103`(`!entry.name.endsWith('.d.ts')`)
  - 상세: 이 가드가 스캔하는 `srcDir` 은 `codebase/backend/src` 인데, 그 하위에는 애초에
    `node_modules`/`dist` 디렉터리도 `.d.ts` 파일도 존재하지 않는다(`find codebase/backend/src
    -type d -iname node_modules|dist` / `-type f -iname *.d.ts` 전부 0건, 이번 세션에서 직접
    실측). 즉 이 세 제외 분기는 **현재 이 테스트 스위트 안에서 한 번도 발화하지 않는다** — 코드가
    맞고 안전한 이유는 "제외 로직이 지켜서" 가 아니라 "제외 대상이 애초에 없어서" 다. 이 저장소가
    같은 가드 파일 안에서 이미 실천한 패턴("빈 배열이 아니라 throw", scratch 디렉터리로 ENOENT
    직접 재현, 카탈로그 행 패턴 불일치 throw 재현)과 대비된다 — 그 셋은 실패 모드를 **합성해서**
    직접 발화시키는데, 이 세 제외 분기만 실제 저장소 상태에 우연히 기대고 있다.
  - 영향 범위는 낮다: `.spec.ts` 제외(가장 실질적인 제외 축)는 실제로 발화하고 잘 동작한다
    (spec 파일들이 `recordRedisFailOpen` 을 호출하는 fixture 를 포함하지 않는 한 눈에 띄는
    회귀는 안 나겠지만, 이 가드의 존재 이유 자체가 "빠뜨림을 조용히 통과시키지 않는다" 이므로
    제외 로직 자체의 회귀도 같은 기준으로 재는 것이 이 파일의 자기 규약과 일관적이다.
  - 제안: `withPatchedSpec` 과 같은 형태로 scratch 디렉터리에 `node_modules/`·`dist/`·`*.d.ts`
    항목을 합성해 `listProductionSources`(또는 이를 경유하는 `findWiredComponents`)가 그것들을
    건너뛰는지 직접 단언하는 케이스를 "가드 자체의 판별력" describe 블록에 추가한다. 최소한
    `.spec.ts` 케이스처럼 "포함되면 안 되는 것" 축을 명시적으로 한 번은 합성 fixture 로 고정할
    가치가 있다(현재 위험은 LOW — 두 디렉터리도 `.d.ts` 도 이 저장소 관례상 `src/` 밑에 생길
    가능성이 낮다).

## 파일별 요약

### `codebase/backend/src/common/filters/http-exception.filter.spec.ts`
직전 라운드 WARNING(“`QueryFailedError(23505)` 분기만 값 누출 검사가 빠짐”)이 `it.each` 4개
분기 공유 바디에 `expect(JSON.stringify(bodyOf(json))).not.toContain(CAUSE_MARKER)` 를 추가하는
형태로 반영됐다(4dbc6ee39). 실제 소스(`http-exception.filter.ts`)와 대조해 각 분기(HttpException /
비-HttpException Error / http-error 4xx / QueryFailedError→409)가 어떤 코드 경로로 이어지는지
확인했고, `isUniqueViolation` 분기(409)는 원래 `cause` 를 전혀 참조하지 않는 고정 문자열이라 이
단언이 지금은 자명하게 통과하지만, 그 자명함 자체가 "이 분기도 미래에 스프레드로 새면 잡는다"
는 회귀 캐너리의 목적과 부합한다. `mockHost`/`bodyOf` 헬퍼는 `ArgumentsHost` 의 실제 사용
표면(`switchToHttp().getResponse().status().json()`)만 최소로 흉내 낸 적절한 mock — 과잉 모킹
없음. `afterEach(jest.restoreAllMocks())` 로 `Logger.prototype` spy 가 테스트 간 누설되지 않는다
(테스트 격리 양호).

### `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` + `.spec.ts`
직전 라운드 INFO 2건(union 소스 ENOENT 미검증, `readCatalogComponents` 두 번째 throw 미검증)이
scratch 빈 디렉터리 + `withPatchedSpec` 변형 케이스로 반영됐다(4dbc6ee39, 8→10건). 위에서 새로
찾은 INFO(제외 분기 미검증) 외에는 이 가드의 vacuity 방지 설계(정확값 단언 `toEqual(['idempotency'])`,
`wired.length > 0`)와 fail-closed 설계(throw-on-empty)가 견고하게 유지되고 있다. `withPatchedSpec`
은 `os.tmpdir()` 안에서만 쓰고 `finally` 로 정리해 리뷰 규약(저장소 트리 비변경)을 스스로도
지킨다.

### `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts`,
`codebase/backend/src/nodes/data/code/code.handler.spec.ts`,
`codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts`
diff 는 "정본이 어디인가" 를 가리키는 주석 재배선뿐이고 assertion·fixture 변경 없음. 회귀 위험
없음. `error-shape.spec.ts` 를 정본으로 두고 backend 쪽 두 spec 이 그것을 가리키게 한 구조라,
근거가 바뀌면 한 곳만 고치면 되는 이점이 있다 — 다만 이는 세 번째 다리(backend 파일)가 여전히
간접 참조라는 뜻이라, 정본 문단이 삭제/이동되면 backend 쪽 주석은 침묵 broken-link 가 된다(코드
링크가 아니라 자연어 참조라 이 저장소의 링크 가드 대상은 아니다 — INFO 수준 관찰이며 blocking
아님).

### `codebase/backend/src/modules/secret-store/secret-resolver.service.ts`
diff 는 주석(형제 개수 3→4)뿐. 이 서비스의 `cause` 비부착 불변식은 `secret-resolver.service.spec.ts`
에 이미 잠겨 있어(이번 diff 밖) 새 갭 없음.

### plan 문서 (`backend-lint-gate-broken-on-main.md` 등)
정량 주장("10→19", "8→10", 뮤테이션 예측/실측 표)을 실제 실행 결과와 대조했고 전부 일치했다
(위 "검증 방법" 참조). 테스트 카테고리 관점에서 새로 지적할 것 없음.

## 요약

이번 diff 는 대부분 직전 라운드 RESOLUTION 의 반영(코멘트 정정 + 커버리지 갭 2종 메우기)이고,
실행으로 확인한 결과 그 반영은 정확하다(10/10, 19/19 PASS, RESOLUTION.md 의 조치 표와 커밋
`4dbc6ee39` 가 일치). 직접 수행한 뮤테이션 검증에서 `listProductionSources` 의 `node_modules`/
`dist`/`.d.ts` 제외 분기가 현재 저장소 상태에서 한 번도 발화하지 않는 새 갭을 하나 찾았다 —
위험은 낮지만(제외 대상 자체가 `src/` 밑에 생길 가능성이 낮음), 이 가드 파일이 스스로 세워 둔
"실패 모드는 합성해서 직접 발화시킨다" 는 원칙과 일관되게 메우는 편이 낫다. 나머지는 발견사항
없음 — 특히 comment-only 파일들(2·3·4·7)은 회귀 위험이 없고, 새 로직 파일(5·6)의 핵심 판별력은
견고하다.

## 위험도

LOW

# RESOLUTION — 4R (`12_37_50`)

## 조치 항목

| SUMMARY # | 발견 | 조치 | commit |
|---|---|---|---|
| W1 (testing) | 3R 이 배선한 `toPosixRelative` 호출 **3개 지점**이 인자 순서 뮤테이션에도 전부 GREEN — 가드 단언이 `toEqual([])` 뿐이라 `.file` 값이 관측되지 않는다 | 되짚기 불변식 캐너리 **5개** + `withFiles` 중첩 이름 지원 | `test(guard): 4R 리뷰 …` |

## 왜 이 형태의 단언인가

같은 함수를 같은 인자로 다시 부르면 **tautology** 라 무엇을 하든 통과한다. 대신
`resolve(root, .file) === 원본 절대 경로` 라는 **되짚기 불변식**을 쓴다 — 인자 순서가
뒤집히면 전혀 다른 경로가 나와 깨진다.

`withFiles` 가 중첩 이름(`nested/probe.ts`)을 받게 한 것은 부수가 아니라 전제다. 픽스처
파일명이 단일 세그먼트면 상대 경로에 구분자가 **원리적으로 나타나지 않아** 이 축을 관측할
수 없다 — 3R 에서 같은 이유로 한 번 막혔다.

## 뮤테이션 검증 (예측 / 실측)

| 대상 | 예측 | 실측 |
|---|---|---|
| `nullable-type-lie-cast-guard` 3곳 인자 순서 뒤집기 | RED 3 | **RED 3 · 31 pass** |
| `audit-action-binding` · `websocket-events.types` 2곳 | RED 2 | **RED 2 · 30 pass** |
| 원복 | GREEN | **GREEN 34 · 32** |

**한 번 틀렸다.** `findStaleSpecCasts` 픽스처를 `// token` 주석으로 썼는데 `stripComments`
가 지워 `SPEC_CAST` 를 안 탔다 — 캐너리가 공허하게 통과하지 않고 잡아 줬다.

## TEST 결과

- lint: **PASS**
- unit: **PASS** — backend jest 445스위트 **9,319건**(직전 9,314 + 캐너리 5)
- build: **PASS**
- e2e: **PASS** — 292건

## 보류·후속 항목

4R INFO 17건은 전부 비차단. 4라운드 연속 등장한 둘(`readBooleanOption` non-literal,
`hasTopLevelNull` 괄호 유니온)은 **저장소 실사례 0건**으로 매 라운드 재확인됐고,
`llmConfigId` 설명 문구·인라인 주석 어휘는 문서 수준이다. 발견의 성격이
계약 → 구조 → 측정 → 커버리지로 좁아졌고 4R 은 WARNING 1건뿐이다.

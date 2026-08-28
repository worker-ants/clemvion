# RESOLUTION — 23_20_05

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (Warning) | 문서 | 본 커밋 | `codebase/frontend/eslint.config.mjs` 헤더 — plan 이 지명한 SoT 인데 정정이 반영 안 됐다. **내가 만든 drift** 다(plan·가드는 고치고 SoT 는 안 고쳤다). 차단자 4개·레버 2종·캐너리 위치를 실었다 |
| #2 (Warning) | 코드+테스트 | 본 커밋 | `readPeerRanges` 를 `packages:` 섹션으로 **구조적으로** 한정. 회귀 케이스 2건 추가 |
| #3 (Warning) | 테스트 | 본 커밋 | `~` 연산자 분기 케이스 추가 (`~9.5.0`→false, `~10.5.0`→true, `^8 \|\| ~9.7`→false) |
| INFO #1 | 테스트 | 본 커밋 | lockfile 6MB 를 `it.each` 안에서 4회 재읽던 것을 1회로 호이스팅 (performance·testing 공통 지적) |
| INFO #8 | 문서 | 본 커밋 | `readLockfile()` JSDoc 추가 |

## Warning #2 — 지적이 맞았다 (실측)

키 정규식이 `packages:` 전용이라는 **주석의 주장이 코드로 강제되지 않았다.** 실제
lockfile 에서 `eslint-plugin-react` 키가 **2건** 매칭된다:

```
6353:  eslint-plugin-react@7.37.5:                                  ← packages:
16767: eslint-plugin-react@7.37.5(eslint@9.39.4(jiti@2.7.0)):       ← snapshots:
```

버전 패턴 `[^:\s]+` 이 `7.37.5(eslint@9.39.4(jiti@2.7.0))` 를 통째로 삼킨다(콜론·공백이
없다). 지금 오염이 안 나는 이유는 snapshots 항목 아래에 `peerDependencies:` 블록이 없어서
`out.set` 재호출이 **우연히** 일어나지 않을 뿐이다. 최상위 섹션을 추적해 그 우연을 없앴다.

## 뮤테이션 재검증 (조치 전/후)

| 뮤턴트 | 조치 전 | 조치 후 |
|---|---|---|
| `termMajorFloor` 정규식에서 `~` 제거 | **생존(GREEN)** — 리뷰 지적 그대로 | **RED** |
| `if (!inPackagesSection) continue;` 제거 | (분기 자체가 없었음) | **RED 2건** |

첫 줄이 리뷰가 옳았음을 확정한다 — 그 분기는 어떤 테스트도 관측하지 않고 있었다.

## TEST 결과

- lint  : 통과
- unit  : 통과 (frontend vitest — 이 파일 15/15, 전체 스위트 포함)
- build : 통과
- e2e   : 통과 (285/285)

## 보류·후속 항목

INFO #2·#3·#4·#5·#6·#7·#10 은 미조치. 전부 (a) 동작 결함이 아니고 (b) 고치면 리뷰
freshness 가 재무장돼 라운드가 한 번 더 도는 성격이다 — developer SKILL §수렴 예외.
구체적으로:

- #2(조기 break)·#3(들여쓰기 상수화)·#4(`lever` 문자열 상수화)·#5(메시지 헬퍼 분리)·
  #6(지역 변수명) — 전부 "선택" 으로 표시된 스타일·미세 성능 항목.
- #7(`Map.set` 중복 덮어쓰기) — 현재 데이터로 **미관측**이고, 이번에 넣은 섹션 한정이
  중복의 주 원인(snapshots)을 이미 제거했다. 남은 이론적 경로는 같은 `packages:` 안에
  동일 이름이 두 번 나오는 경우인데 pnpm lockfile 형식상 발생하지 않는다.
- #10(peerDependencies 블록이 `eslint:` 없이 끝나는 경로) — 이번에 추가한 snapshots
  fixture 가 그 경로를 실제로 통과시킨다(그 블록에 `eslint:` 가 있지만 섹션에서 잘린다).

발견의 성격이 동작 → 구조 → **문서/스타일**로 이동했고 Critical 0 · 남은 Warning 0 이다.

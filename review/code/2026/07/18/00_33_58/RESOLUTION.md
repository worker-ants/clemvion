# Resolution — review/code/2026/07/18/00_33_58

> 대상: `b2bc51d5e` (직전 리뷰 fix) 를 fix diff 스코프로 재리뷰한 **종결용(termination) 리뷰**.
> 목적은 freshness 재무장 해소 + fix 코드 자체가 미리뷰로 남지 않게 하는 것.
> 전체 위험도 **MEDIUM**, Critical **0**, Warning **2**. 둘 다 제 직전 fix 의 실제 갭이라 조치함.

## 조치 항목

| 출처 | 항목 | 조치 |
|---|---|---|
| WARNING #1 (testing/requirement) | 직전 라운드에 넣은 "문구 회귀 고정" 테스트에서 static 진입점의 `distinctPhrase`(`"@/components/** 를 import 할 수 없습니다"`)가 세 메시지 **전부의 공통 부분문자열**이라 static↔dynamic·static↔require 상수 뒤바뀜을 탐지 못함 | **FIXED** — 지적이 정확하다. 직접 실측으로 재현(`STATIC_IMPORT_MSG → DYNAMIC_IMPORT_MSG` mutation → 51/51 통과, 미탐지 확인). positive `toContain` 만으로는 부족하므로 케이스를 `{present, absent}` 구조로 바꿔 **각 진입점이 다른 진입점의 고유 문구(`동적 import() 로도`/`require() 로도`)를 담지 않는지** negative 단언을 추가. static 은 두 mark 의 부재가 곧 static 상수라는 증거다. 재검증: 상수 뒤바꿈 4종(`STATIC→DYNAMIC`·`STATIC→REQUIRE`·`DYNAMIC→STATIC`·`REQUIRE→DYNAMIC`) 전부 1건 실패로 탐지 — 이전엔 미탐지되던 `STATIC→DYNAMIC` 포함 |
| WARNING #2 (documentation) | 파일 최상단 모듈 JSDoc 이 여전히 `src/lib/**` 단독 스코프만 기술 — `LOWER_LAYERS` 가 `src/types/**` 까지 확장됐고 같은 파일에 `src/types` 전용 스위트까지 있는데도. 직전 라운드에 fail-open 메시지에서 고친 것과 같은 종류의 staleness 가 몇 줄 위에 남음 | **FIXED** — 모듈 JSDoc 을 `LOWER_LAYERS`(`src/lib/**`·`src/types/**`) 포괄로 갱신, 규약 SoT 링크 추가, 두 스위트의 관심사 분리(내용 vs 스코프)도 명시 |
| INFO #1 (requirement) | spec §4.1 "이 테스트가 고정하는 것" 목록에 이번에 추가된 메시지 콘텐츠 검증 항목이 없음 | **반영** — §4.1 에 "메시지 콘텐츠" 항목 추가. 공통 부분문자열 문제와 negative 단언 근거 명시 |
| INFO #2·3·4·5·6 | 블록 탐색의 단일 블록 가정(향후 분리 시 체크리스트)·rule-id predicate 중복(기존 처분)·유사명명 상수 병존·WARNING#2 부수 변경 스코프·리뷰 산출물 20파일 관례 | **조치 불필요** — 전부 기존 처분 재확인이거나 근거 있는 트레이드오프. INFO#2 는 이번 diff 가 오히려 drift 위험을 낮췄다고 리뷰어도 인정 |

## TEST 결과

- **lint**: 통과 (fix 후 재수행)
- **unit**: 통과 — 레이어 가드 스위트 51 케이스. frontend 전체는 아래 재수행에서 확인
- **build**: 통과 (fix 후 재수행)
- **e2e**: 통과 (fix 후 재수행) — backend jest 256 + playwright. 면제 불가(변경 set 에 `*.test.ts` 포함)

## 보류·후속 항목

없음. 이번 종결 리뷰가 찾은 갭은 전부 이 커밋에서 해소. 다음 종결 리뷰가 clean 이면 freshness 종결.

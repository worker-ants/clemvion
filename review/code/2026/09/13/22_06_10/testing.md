# 테스트(Testing) 코드 리뷰 — error-code-emission-axis (누적 8라운드 시점)

## 검토 범위·방법

이번 배치의 테스트 관점 실질 대상은 이전 7라운드와 동일하게 두 파일뿐이다 —
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기·
`isMessagePrefixOnly`·`computeNonEmittedOffenders`·`resolveSourceLines` 등)와
`guide-identifier-existence.test.ts`(그 축의 단언 + 진리표/경계 대조군). `git diff origin/main HEAD`
전체(163개 파일)를 확인했으나 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·
`review/**`)는 문서·plan·과거 7라운드 `/ai-review`·`--impl-done` 세션 산출물이라 테스트 코드
관점의 대상이 아니다.

`git log --oneline -- <두 파일>`로 확인한 결과, 두 파일에 대한 마지막 코드 변경은 라운드 7 fix
커밋(`53d29a6f4`)이며 이번 세션(22_06_10) 시점까지 추가 코드 변경이 없다. 즉 이번 라운드는
라운드 7이 넣은 수정(`resolveSourceLines` 유일성 가드에 `[0건]`/`[2건 이상]`/`[1건]` 3-분기
fixture 추가, `spec/conventions/user-guide-evidence.md §2` 미등재 인용 정정)이 실제로 반영·
회귀 없이 유지되는지를 독립적으로 재검증하는 것이 핵심 작업이었다.

### 독립 재현 (저장소 뮤테이션 없음 — 읽기 전용 검증만 수행)

- `npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts` 직접 실행 →
  **79 passed (79)**, 라운드 7 RESOLUTION이 보고한 수치(76→79)와 일치. 실행 시간도 44ms(테스트
  본체)로 무해하다.
- 라운드 7 WARNING#2가 지적했던 `resolveSourceLines`의 `found.length === 1` 유일성 가드를
  직접 열람(`guide-identifier-existence.test.ts:562-585`) — `[0건]`·`[2건 이상]`·`[1건]` 세
  분기가 모두 명시적 fixture로 고정돼 있음을 확인했다. `[2건 이상]` 케이스는 실제 저장소의
  `backend/src/**/index.ts` 46개 중복을 그대로 이용한다(합성 fixture가 아니라 실제 코퍼스에
  의존).
- 이번 세션에서는 저장소를 뮤테이션하지 않았다 — 코드 변경이 없는 라운드라 판단해 정적
  재검증 + 테스트 재실행만으로 충분하다고 결론지었다. `git status --short`로 세션 시작·종료
  시점 모두 리뷰 산출물 디렉터리(`review/code/2026/09/13/22_06_10/**`,
  `review/consistency/2026/09/13/22_06_21/**`) 외에는 변경이 없음을 확인했다.

## 발견사항

- **[INFO]** `resolveSourceLines`의 `[2건 이상]` 분기 fixture가 실제 저장소 상태(진짜
  corpus)에 결합돼 있어, 이 파일의 다른 신규 함수들이 일관되게 지켜 온 "합성 입력으로 두
  분기를 가른다" 원칙에서 유일하게 벗어나 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:576-578`
    (`it("[2건 이상] 다중 매치도 null — 아무거나 고르지 않는다", () => { expect(resolveSourceLines("index.ts")).toBeNull(); });`)
  - 상세: 같은 `describe` 블록의 `[0건]`·`[1건]` 케이스는 각각 "존재하지 않는 파일명"과 "유일한
    실제 파일명"으로 결정적이다. 반면 `[2건 이상]` 케이스는 `resolveSourceLines`가 내부적으로
    호출하는 `walkTree(repoRoot(), ["codebase/backend/src"], …)`가 오늘 시점 `index.ts`를 46개
    찾는다는 사실에 전적으로 의존한다 — `resolveSourceLines`가 탐색 루트나 파일 목록을 주입받는
    구조가 아니라 `codebase/backend/src`를 하드코딩하기 때문에, 테스트가 이 분기를 겨누려면
    실제 저장소 상태를 빌리는 수밖에 없다. 이 파일의 다른 모든 경계 대조군(`collectQuotedLiterals`
    의 역참조 불일치, `collectMessagePrefixes`의 콜론-공백 경계, `BACKTICK_INNER`의 워드 경계
    등)은 순수 문자열 합성 입력으로 두 판정이 갈리는 값을 고정하는 데 반해, 이 케이스만
    파일시스템의 우연한 현재 상태에 결과가 좌우된다.
  - 영향: `backend/src`에서 중복 `index.ts` 파일들이 통합·삭제되어 우연히 1개만 남게 되면
    (가능성은 낮지만 배제할 수 없다) 이 단언은 `null`이 아니라 줄 배열을 반환받아 **RED**로
    실패한다 — 이는 안전한 실패 방향(조용히 무의미해지는 vacuous 실패가 아니라 시끄러운 실패)
    이라 심각도는 낮다. 다만 실패 시 원인이 "가드 로직 결함"이 아니라 "저장소 파일 배치가
    바뀜"이라는 것을 다음 사람이 곧바로 알아채기 어렵고, 테스트가 프로덕션 코드가 아닌
    무관한 리팩터(중복 `index.ts` 통합)에 의해 깨질 수 있다는 점에서 테스트 격리·안정성
    관점의 사소한 결함이다.
  - 제안: 시급하지 않다(라운드 7 RESOLUTION이 이미 이 결합을 실측·인지한 상태로 도입했고,
    46개라는 여유가 커서 근시일 내 깨질 개연성은 낮다). 다만 향후 `resolveSourceLines`가
    두 번째 소비처를 얻거나 이 함수가 리팩터링될 기회가 오면, 탐색 대상 디렉터리를 인자로
    주입 가능하게 바꿔 `[2건 이상]` 케이스도 임시 디렉터리 fixture로 합성할 수 있게 하는
    편이 이 파일의 나머지 설계 원칙과 일관된다.

- **[INFO]** (회귀 확인, 조치 불요) 라운드 1~7이 지적한 항목이 실제로 반영돼 있는지 재대조 —
  전부 일치, 회귀 없음
  - 위치: `guide-identifier-scan.ts`(`isMessagePrefixOnly:453-459`, `computeNonEmittedOffenders:480-496`,
    `collectMatches:287-297`), `guide-identifier-existence.test.ts`(`parseWhereRefs:56-63`,
    `resolveSourceLines:88-102`와 그 대조군 `562-585`)
  - 상세: `isMessagePrefixOnly`가 스캐너 쪽에 export되어 진리표 대조군(`653-676`)의 대상이 될 수
    있음, `computeNonEmittedOffenders`가 베이스라인과 `[한계]`/`[대조군]` 테스트에서 동일 함수를
    호출해 정본 분기(`587-628`)가 유지됨, `parseWhereRefs`가 `where` 안의 모든 `파일:줄` 참조를
    걷고 자체 대조군(`302-315`)을 가짐, `resolveSourceLines`의 유일성 가드에 3-분기 fixture가
    모두 있음 — 이번 세션의 79/79 GREEN 재실행으로 교차 확인했다.
  - 제안: 조치 불필요.

- **[INFO]** `computeNonEmittedOffenders`의 `[...new Set(citedTokens)]` 중복 제거 단계는
  여전히 전용 판별 fixture가 없다 (기존 추적 항목, 신규 아님)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:489`
  - 상세: 라운드 6(`review/code/2026/09/13/21_19_46` testing INFO#1)이 이미 뮤테이션으로
    확인·등재했고, 같은 라운드 RESOLUTION이 "거짓 PASS로 이어지지 않음 — 진단 품질(중복 제거
    안 해도 `sort()`+`toEqual([])` 비교 결과는 동일)에만 영향" 이라는 이유로 낮은 우선순위
    처분을 내렸다. 이번 라운드 사이에 관련 코드 변경이 없어 재확인만 하고 새 항목으로 올리지
    않는다.
  - 제안: 조치 불필요(기존 처분 유지).

## 요약

이번 라운드(8회차)는 두 대상 파일에 대한 신규 코드 변경이 없는 상태를 재검증하는 세션이다.
라운드 7이 지적했던 `resolveSourceLines` 유일성 가드의 커버리지 갭(`WARNING#2`)은 `[0건]`·
`[2건 이상]`·`[1건]` 세 분기 fixture로 확실히 닫혀 있음을 직접 열람과 독립 테스트 실행
(79/79 GREEN)으로 확인했다. 유일하게 남긴 관찰은 그 `[2건 이상]` fixture가 이 파일의 다른
모든 경계 대조군과 달리 합성 입력이 아니라 실제 저장소의 우연한 상태(`index.ts` 46개 중복)에
결합돼 있다는 점인데, 실패 방향이 안전(RED, vacuous 아님)하고 저자가 이미 이 트레이드오프를
실측·문서화한 채 도입한 것이라 즉각 조치가 필요한 결함은 아니다. 그 외 회귀 확인 결과 라운드
1~7이 채운 모든 커버리지 갭(수집기 3종 경계·`isMessagePrefixOnly` 진리표·`staleGuideEntries`
판별·`computeNonEmittedOffenders` 정본화·`where` 다중 참조 파싱)이 그대로 유지되고 있다.

## 위험도

LOW — 신규 결함 없음, 회귀 없음. 유일한 관찰(테스트 격리 관점의 실코퍼스 결합)은 이미
저자가 인지·감수한 트레이드오프이고 실패 방향이 안전해 즉시 조치가 필요하지 않으나, 이
파일이 반복적으로 이름 붙여 온 "합성 fixture로 분기를 가른다" 원칙에서 유일하게 벗어난
자리라 기록해 둔다.

# 유지보수성(Maintainability) 코드 리뷰 — error-code-emission-axis (라운드 6 누적분, `21_41_23`)

## 검토 범위·방법

이 배치는 `origin/main` 대비 7커밋(`65256a109` feat → `a397ccc55`→`a4b98eda8`→`5778885ce`
→`57288e47f`→`2931d921f`→`eb53aba1c` fix, 총 7커밋)의 누적분이다. 실질 코드는 여전히
두 파일뿐이다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(595줄)와
`guide-identifier-existence.test.ts`(956줄). 나머지(`CHANGELOG.md`·`PROJECT.md`·
`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서·프로세스 산출물이라 코드 복잡도·중첩·
중복 관점의 대상이 아니다.

프롬프트가 두 핵심 TS 파일의 diff 를 크기 제한으로 생략했으므로, `Read` 로 두 파일
**전문**을 직접 열어 현재 상태(HEAD `eb53aba1c`)를 검토했고, `git show eb53aba1c --
<두 파일>` 로 **이번 라운드(라운드 6)가 새로 들여온 diff** 만 별도로 추출해 대조했다.
직전 다섯 라운드의 maintainability 리뷰(`19_23_22`→`21_19_46`)가 이미 CRITICAL/WARNING
전량을 해소 판정했으므로, 이번 라운드는 ① 라운드 6 diff 가 새로 들여온 것과 ② 그
diff 가 기존 이월 항목(특히 파일 서두 124줄 장문 주석)에 미친 영향만 집중 검토했다.
저장소 파일은 건드리지 않았다(읽기 전용 조사, 뮤테이션 없음, `git status --short` 로
잔여 없음 확인).

## 라운드 6 diff 검토

라운드 6 은 세 가지를 했다: ① `where` 검증의 `walkTree` 재순회를 `basename` 캐시로
줄임(`resolveSourceLines`/`sourceLinesCache` 신설), ② `computeNonEmittedOffenders`
JSDoc·테스트 주석의 "네 번" → "세 번"(실측) 정정, ③ 리뷰 산출물 커밋.

- **확인 후 문제 없음**: 신규 `resolveSourceLines`(`guide-identifier-existence.test.ts:86-101`)
  와 그 캐시(`:86`)는 이름 충돌이 없다 — `grep -rn "resolveSourceLines|sourceLinesCache"
  codebase/ --include="*.ts"` 로 재확인, 이 파일 밖에 동명 식별자 0건. 라운드 4 의
  `staleEntries`/`staleGuideEntries` 충돌(이름을 정하기 전에 grep 하지 않은 것이 원인)
  이후 이 저장소가 명시한 절차("새 식별자는 후보 토큰이 grep 0건임을 먼저 보여라")를
  이번엔 지킨 것으로 보인다. JSDoc(`:82-85`)도 "유일하게 특정되지 않으면 `null`" 이라는
  실패 모드를 명확히 밝혀 호출부가 그 계약을 놓치지 않게 한다.
- **확인 후 문제 없음**: `where` 검증 루프(`:280-297`)는 `walkTree` 인라인 호출을
  `resolveSourceLines` 한 줄 호출로 대체해 각 중첩 단계의 본문 길이는 줄었다. 다만
  루프 구조 자체(entry → refs → ref → lines → src) 는 여전히 4단 중첩이다 — 이는 라운드
  3 부터 "`where` 검증이 인라인 30줄 — 부분 고침(파싱만 분리, 트리 탐색은 남김)" 으로
  명시적으로 이월된 항목의 연장선이라 새 결함으로 등재하지 않는다(아래 이월 목록 참조).
- **확인 후 문제 없음**: JSDoc 자기 수정(`guide-identifier-scan.ts:462-465`,
  `existence.test.ts:224`)이 실측(`git show 2931d921f~1` 의 `.filter(` 개수)과 함께
  "네 번" 을 "세 번" 으로 정정했다 — 근거를 남기지 않고 조용히 숫자만 바꾸는 대신 *왜*
  틀렸는지(판정식의 "네 항"과 "filter 호출 횟수"를 혼동)까지 옆에 적어, 다음 사람이
  같은 혼동을 반복하지 않게 한다.

## 발견사항

새로 지적할 CRITICAL/WARNING 은 찾지 못했다.

- **[INFO]** 파일 서두 장문 반증 이력 주석이 파일 부피의 절대다수를 차지한다 — 재확인,
  변화 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-124`
    (코드 선언 이전의 순수 주석 블록)
  - 상세: `grep -c '^\s*//\|^\s*\*'` 로 세면 이 파일 595줄 중 **412줄(약 69%)** 이
    주석이다. 라운드 1~5 의 maintainability 리뷰가 이 절을 반복 검토했고, 코드 자신이
    "이 주석을 지우지 말 것 — 가드가 무엇을 보장하지 않는지가 적혀 있지 않으면 다음
    사람이 '가드가 통과했으니 이 식별자는 실재한다'로 읽는다"(`:84-85`)고 명시적으로
    요구하는, 이 저장소의 의도된 관례다. 라운드 6 diff 는 이 절의 줄 수를 늘리거나
    줄이지 않았다(직접 대조 확인).
    다만 **누적 추세는 그대로 남아 있다** — 하루 만에 7라운드를 거치며 `review/code/
    2026/09/13/*` 세션 경로 인용이 scan.ts 13건·existence.test.ts 20건으로 늘었고,
    파일이 "무엇을 하는가" 보다 "무엇이 어떻게 틀렸었는가" 를 설명하는 비중이 더 크다.
    세션 타임스탬프 경로(`review/code/2026/09/13/16_56_29` 류)는 이 PR 의 git 이력
    바깥에서는 맥락을 잃는 형태의 앵커이기도 하다. 이번 diff 가 새로 만든 문제는
    아니므로 액션을 강제하지 않되, plan 이 닫히는 시점에 안정화된 "라운드 N" 서술 중
    지금도 유효한 설계 근거(축·경계·트레이드오프)만 남기고 일회성 반증 서사는
    CHANGELOG/RESOLUTION 쪽에 이미 있는 기록에 위임하는 정리를 한 번 고려할 만하다.
  - 제안: 이번 PR 에서 조치 불필요(이미 5라운드가 동일하게 판정). 다음에 이 파일을
    다시 만질 일이 생기면(다섯 번째 축 추가 등) 그 기회에 안정화 절 축약을 함께 검토.

- **[INFO]** `where` 검증 로직의 4단 중첩이 여전히 남아 있음 — 이월분, 이번 라운드
  캐시 도입으로 각 단계 본문은 축소
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:273-298`
    (`it("\`where\` 의 \`파일:줄\` 이 실제로 그 토큰을 담는다 …")` 본문)
  - 상세: `for (entry) { … if (refs.length===0) …; for ({file,line}) { … if
    (lines===null) …; if (!src.includes(...)) … } }` 로 최대 4단 중첩이 그대로다.
    라운드 3 RESOLUTION(INFO#4)이 "`parseWhereRefs` 로 파싱은 분리, 트리 탐색은 남김
    — 부분 고침" 으로 명시적으로 이월했고, 라운드 6 은 트리 탐색 호출부를
    `resolveSourceLines` 한 줄로 줄여 각 단계 본문을 더 짧게 만들었을 뿐 구조(중첩
    단수)는 바꾸지 않았다. 상한이 등록 3항목·참조 소수(≤5)로 낮아 실질 가독성 비용은
    작다.
  - 제안: 조치 불필요(기존 유예 유지). `where` 검증을 `guide-identifier-scan.ts` 의
    순수 함수로 완전히 뽑을 때(라운드 3 이 예정한 시점) 이 중첩도 함께 정리하는 것을
    권장.

- **[INFO, 재확인 — 새 결함 아님]** vacuity floor 매직 넘버·`GUIDE_EXTERNAL_VOCABULARY`
  / `GUIDE_NON_EMITTED_VOCABULARY` 타입 미공유는 라운드 6 diff 범위 밖(코드 자리 이동
  없음)이라 직전 판정을 그대로 유지한다 — `existence.test.ts:166-235` 의
  `toBeGreaterThan(50/500/800/5/200/3/50/…)` 등은 각각 실측 주석을 달고 있으나 이름
  없는 리터럴로 5라운드 연속 이월(낮은 우선순위); `GUIDE_EXTERNAL_VOCABULARY`
  (`{token, system, why}`, `guide-identifier-scan.ts:300-304`)와
  `GUIDE_NON_EMITTED_VOCABULARY`(`{token, where, why}`, `:333-338`)는 세 번째
  유사 목록이 생기면 공유 타입 추출을 검토하기로 라운드 4 부터 이월됨.

## 요약

라운드 6(`eb53aba1c`)의 실질 변경은 `where` 검증의 `walkTree` 재순회를 `basename`
캐시(`resolveSourceLines`)로 줄인 성능 개선과, 판정식 항수(4항)와 `.filter` 호출
횟수(3회)를 혼동했던 JSDoc 주석의 자기 정정 두 가지다. 신규 캐시 함수는 이름 충돌
없음을 grep 으로 확인했고 실패 모드(유일하게 특정 안 되면 `null`)를 JSDoc 에 명시해
호출부 계약이 분명하다. 이미 다섯 라운드에 걸쳐 검토·이월된 항목들(파일 서두 124줄
반증 이력 주석·`where` 검증 중첩·vacuity 매직넘버·두 허용목록 타입 미공유)은 이번
diff 가 그 코드 자리를 건드리지 않아 판단을 그대로 유지한다 — 특히 서두 장문 주석은
이 저장소가 코드 안에 "지우지 말 것" 이라고 명시한 의도된 설계이므로 새 WARNING 으로
재상정하지 않았다. 다만 누적 7라운드에 걸쳐 세션 경로 인용이 계속 늘고 있다는 추세는
현재 파일 크기(595줄 중 69% 주석)를 고려할 때 plan 종료 시점에 한 번쯤 정리를 검토할
만한 지점으로 남겨 둔다. 새로 보고할 CRITICAL/WARNING 은 없다.

## 위험도

LOW

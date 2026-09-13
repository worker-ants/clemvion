# 요구사항(Requirement) 리뷰 — error-code-emission-axis (라운드 2)

## 검토 방법

`git log`로 이 배치가 두 커밋(`65256a109` feat + `a397ccc55` fix — 라운드 1 `/ai-review`·
`--impl-done` 지적 반영)으로 구성됨을 확인했다. 프롬프트가 컨텍스트 예산으로 diff를
생략한 두 핵심 파일(`guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`)은
`Read`로 전체를 직접 열었고, 관련 백엔드 소스(`execution-engine.service.ts`
:7100-7135·:7995-8024, `loop-executor.ts`, `execution-failure-classifier.ts`,
`makeshop.handler.ts`)를 대조해 JSDoc·주석·plan 문서의 실측 인용이 실제 코드와
line-level로 일치하는지 확인했다. `codebase/frontend`에서 `vitest run
guide-identifier-existence.test.ts`를 직접 실행해 **63/63 GREEN**을 확인했다(저장소
뮤테이션 없음 — 실행 전후 `git status --short`로 확인, 이 세션이 만든 산출물 외
변경 없음).

라운드 1(`review/code/2026/09/13/19_23_22`)의 requirement WARNING 2건(①
`MAX_ITERATIONS_EXCEEDED`가 "카탈로그 덕에" 통과한다는 서술이 실제 메커니즘과
다름, ② `GUIDE_NON_EMITTED_VOCABULARY`가 거울상 목록 대비 강제 2개 부족)은 커밋
`a397ccc55`에서 테스트/JSDoc 레벨로 정정·보강됐음을 코드에서 직접 확인했다 — ①은
`collectCatalogCodes` JSDoc과 `[회귀]`/`[한계]`/`[대조군]` 테스트 3종으로, ②는
`NON_EMITTED_VOCABULARY_CAP = 5` + "여전히 인용되는가" 죽은-등록 방지 테스트로
반영됐다. 둘 다 재확인했고 새 결함 없음.

## 발견사항

- **[WARNING]** `CHANGELOG.md`가 라운드 1에서 반증된 것과 똑같은 틀린 메커니즘 설명을
  여전히 담고 있다 — 같은 배치의 코드/테스트/plan 문서는 이미 정정했는데 사용자
  대면 문서만 정정에서 빠졌다.
  - 위치: `CHANGELOG.md:19-21` (`"탈출구로 쓰면 \`MAX_ITERATIONS_EXCEEDED\` 처럼
    *접두로만 발행되지만 spec 이 정식 코드로 인정한* 것이 통과한다"`)
  - 상세: `git log -p -- CHANGELOG.md`로 확인한 결과 이 문단은 최초 feat 커밋
    (`65256a109`)에서 작성된 뒤 fix 커밋(`a397ccc55`, `git show --stat`으로 변경
    파일 24개 확인 — `CHANGELOG.md` 미포함)에서 전혀 손대지 않았다. 그런데
    `a397ccc55`가 바로 이 문장과 **동일한 주장**을 코드 레벨에서 반증했다 —
    `collectCatalogCodes` 새 JSDoc(`guide-identifier-scan.ts:398-413`)은 *"이
    탈출구는 오늘 한 번도 발화하지 않는다(라운드 1에 반증됨)"*라고 명시하고,
    `guide-identifier-existence.test.ts:255-271`의 `[회귀]` 테스트는
    `isMessagePrefixOnly("MAX_ITERATIONS_EXCEEDED")`가 `false`(카탈로그 검사에
    **도달조차 안 함**)임을, `:273-287`의 `[한계]` 테스트는 `rescuedByCatalog`가
    **공집합**임을 단언으로 고정한다. `execution-failure-classifier.ts:76`
    (`INTERNAL_CODES = new Set([...'MAX_ITERATIONS_EXCEEDED'...])`)을 직접 확인해
    실제 통과 이유가 "카탈로그가 정식 코드로 인정해서"가 아니라 "소비자 Set이
    토큰-단독 리터럴로 인용해 `isMessagePrefixOnly` 자체가 `false`가 되어서"임을
    재확인했다. 심지어 같은 CHANGELOG 항목 바로 다음 문단("**잔여 한계**", 23-26행)은
    *"소비자·분류기 목록이 토큰을 따옴표로 인용하면 접두-전용 판정이 풀려
    통과한다"*라고 **올바른** 메커니즘을 적고 있어, 한 항목 안에서 두 문단이
    서로 모순된 설명을 준다 — 앞 문단(카탈로그가 통과시킨다)과 뒷 문단(소비자
    인용이 통과시킨다)이 배타적인데 나란히 남아 있다.
  - 왜 문제인가: 이 배치 자체가 "근거를 검증 없이 적었다가 반증됐다"는 실수를
    라운드 1에서 이미 한 번 저질렀고(plan §E "내 «근거» 가 또 거짓이었다"), 그
    교훈을 코드·테스트·plan에는 반영했지만 CHANGELOG에는 반영하지 않아 같은
    실수의 흔적이 사용자 대면 문서에 그대로 남았다. `plan/in-progress/
    error-code-emission-axis.md` §E는 이 반증을 "지우지 않고 사실대로 적는다"는
    원칙으로 코드 JSDoc에 남겼는데, CHANGELOG는 그 원칙이 적용되지 않아 오히려
    "지우지 않은 틀린 원본"만 남고 정정이 없는 상태다.
  - 제안: `CHANGELOG.md`의 해당 문단을 실제 메커니즘("접두 전용 판정 자체가
    소비자 Set의 토큰-단독 인용 때문에 이미 거짓이 되어, 카탈로그 검사에
    도달하지 않고 통과한다")으로 정정하거나, 최소한 "이 서술은 초안이었고 실제
    메커니즘은 아래 '잔여 한계' 절과 같다"는 정정 표시를 추가할 것. `CHANGELOG.md`는
    `spec/`이 아니라 `codebase/**`와 같은 층위의 저장소 최상위 문서이므로 developer
    권한 안에서 즉시 고칠 수 있는 항목이다.

## 확인했으나 문제 없음 (참고)

- `logic.mdx:114`/`logic.en.mdx:103`의 문장 정정은 `execution-engine.service.ts:
  7121,7125,7130`의 실제 구현(일반 `Error` + 템플릿 리터럴 메시지 접두,
  `nodeExec.error = { message }`로 `code` 필드 자체가 없음, `:8016`에서 직접 확인)과
  line-level로 정확히 일치한다. KO/EN 문장도 의미가 동등하다.
- `GUIDE_NON_EMITTED_VOCABULARY`의 `where` 필드 3종(`makeshop.handler.ts:436`,
  `execution-engine.service.ts:7121·7125`, `:7130`)을 모두 직접 열어 대조했고,
  각 줄에 해당 토큰이 실제로 존재한다 — 신규 grep 강제 테스트
  (`guide-identifier-existence.test.ts:202-231`)가 요구하는 대로 정확하다.
- `execution-failure-classifier.ts:76`의 `'MAX_ITERATIONS_EXCEEDED'`가 `Set`
  리터럴(`INTERNAL_CODES = new Set([...])`, :54) 안의 정확한-토큰 문자열임을
  확인 — `collectQuotedLiterals`가 이를 리터럴로 잡는다는 JSDoc·테스트 주장과
  일치한다.
- spec 6개 문서(`0-common.md`·`7-map.md`·`9-foreach.md`·`2-edge.md`·`0-canvas.md`·
  `4-execution-engine.md`)가 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를
  여전히 "코드"처럼 서술하는 spec-vs-실체 drift는 이미 두 차례 consistency-check
  라운드(`18_40_54`·`19_23_31`)가 WARNING으로 잡았고, 이번 배치는 `spec/`을
  건드리지 않은 채(`spec_impact: none`, 실측 델타 0) `plan/in-progress/
  spec-draft-nullable-notation-followups.md`에 두 항목을 신규 planner 백로그로
  정확히 등재했다(3419-3461행, 실측 근거·통일 선례(`3-loop.md §6`)까지 명시).
  `spec/`은 developer 권한 밖이므로 이 처리는 적절하다 — 재차 지적하지 않는다.
- `spec-draft-nullable-notation-followups.md:3404`의 완료 트래커 체크박스는
  이번 배치에서 `[x]` + 실측 근거("`execution-engine.service.ts:8016`이
  `nodeExec.error = { message }`로 기록 — `code` 필드가 아예 없다")로 정확히
  갱신돼 있다 — 라운드 1 documentation/plan_coherence WARNING이 지적한 누락이
  해소됐다.
- `guide-identifier-existence.test.ts` 63개 테스트 전수를 `vitest run`으로 직접
  실행해 GREEN을 확인했다(plan이 주장하는 "46 → 63"과 일치).

## 요약

기능적으로는 의도한 요구사항(가이드가 구조화된 에러 코드처럼 서술하던
`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`의 실제 동작을 정정하고, 같은
형태의 재발을 막는 "발행 축" 가드를 신설)을 line-level로 정확히 구현했다 —
mdx 문장, `where` 필드, JSDoc의 소스 인용을 전부 직접 대조해 사실과 일치함을
확인했고 테스트 63/63이 GREEN이다. 라운드 1에서 지적된 요구사항 결함(잘못된
메커니즘 서술, 거울상 목록 강제 불균형)은 코드·테스트 레벨에서 정확히 고쳐졌다.
다만 그 정정이 `CHANGELOG.md`까지 전파되지 않아, 라운드 1이 반증한 것과 동일한
"카탈로그가 `MAX_ITERATIONS_EXCEEDED`를 통과시킨다"는 틀린 서술이 사용자 대면
문서에 그대로 남아 있고, 심지어 같은 항목의 바로 다음 문단이 올바른 메커니즘을
적어 자기모순을 이룬다. 이는 이번 배치 자체가 경계하려 했던 바로 그 실수
클래스("근거를 검증 없이 적었다가 반증되었는데 일부 표면에만 정정을 반영")의
재발이라 WARNING으로 분류한다. 그 외 spec 6개 문서의 코드-서술 drift는 이번
배치 범위 밖이며 planner 백로그로 올바르게 이관됐다.

## 위험도

LOW

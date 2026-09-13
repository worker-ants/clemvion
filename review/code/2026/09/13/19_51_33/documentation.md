# 문서화(Documentation) 리뷰 — error-code-emission-axis (라운드 2)

## 검토 방법

이 라운드는 `review/code/2026/09/13/19_23_22/RESOLUTION.md`(라운드 1, C0·W7)의 수정 커밋
(`a397ccc55`)이 반영된 뒤의 diff 를 검토한다. 라운드 1 documentation 리뷰(`19_23_22/documentation.md`)가
낸 WARNING·INFO 4건이 실제로 해소됐는지 먼저 `git diff`/`Read` 로 직접 대조했고, 그 위에서
새로 생긴 문서화 문제를 찾았다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 가 **같은 PR 이 이미 스스로 반증한 주장**을 그대로 남기고 있다 —
  같은 항목의 두 문단이 서로 다른(그리고 상호 배타적인) 메커니즘을 주장한다
  - 위치: `CHANGELOG.md:19-21` (`탈출구로 쓰면 \`MAX_ITERATIONS_EXCEEDED\` 처럼 …
    통과한다`) vs 같은 항목 `CHANGELOG.md:23-26` (`**잔여 한계**: 소비자·분류기 목록이
    토큰을 따옴표로 인용하면 …`)
  - 상세: 라운드 1 fix 커밋(`a397ccc55`)의 diff stat 에는 `CHANGELOG.md` 가 **없다** —
    `git show --stat a397ccc55` 로 확인했다. 그런데 그 커밋이 고친 것이 정확히 이 문장이
    담고 있는 주장이다. `review/code/2026/09/13/19_23_22/requirement.md` WARNING(#3)이
    "`MAX_ITERATIONS_EXCEEDED` 는 **카탈로그 덕에** 통과한다" 는 테스트 제목·JSDoc 의 주장을
    반증했고("실제로 통과시키는 것은 `execution-failure-classifier.ts:76` 의 **소비자 Set**
    인용이지 카탈로그가 아니다"), 그 결과 코드 쪽은 전부 정정됐다 — 지금
    `guide-identifier-scan.ts:398-424` 의 `collectCatalogCodes` JSDoc 은 "처음엔 …
    이 탈출구로 통과한다고 적었다. **틀렸다**." 라고 명시하고, `guide-identifier-existence.test.ts:255-271`
    테스트 제목도 "**소비자-인용 때문에** 통과한다 (카탈로그 아님)" 으로 바뀌었으며,
    `plan/in-progress/error-code-emission-axis.md` §E 도 같은 정정을 담고 있다(전수 실측:
    "카탈로그 탈출구는 오늘 한 번도 발화하지 않는다").
    그러나 `CHANGELOG.md:19-21` 은 여전히 최초(반증된) 버전 그대로다 — *"탈출구로 쓰면
    `MAX_ITERATIONS_EXCEEDED` 처럼 접두로만 발행되지만 spec 이 정식 코드로 인정한 것이
    통과한다"*. 이것은 지금 코드베이스의 corrected 이해와 **직접 모순**되며(카탈로그는
    이 토큰의 통과에 관여하지 않는다 — `isMessagePrefixOnly` 단계에서 이미 탈락한다),
    바로 아래 같은 항목의 "잔여 한계" 문단(`:23-26`, 소비자·분류기 인용이 원인이라는
    **정확한** 설명)과도 내부적으로 모순된다. 즉 같은 CHANGELOG 항목 안에 정정 전/후
    설명이 공존한다 — 나중에 읽는 사람은 어느 쪽이 맞는지 CHANGELOG 만으로는 알 수 없다.
  - 왜 문제인가: 이 PR 의 제목·본문 전체가 "가이드가 «코드» 로 부르던 두 이름이 코드가
    아니었다"는 **정확성 정정**을 다루는데, 그 정정을 알리는 CHANGELOG 항목 자체가 이번
    라운드에서 반증된 새로운 부정확한 서사를 담은 채 방치된다 — 이 저장소가 반복 기록해 온
    "설계 근거는 뮤테이션/실측으로 반증될 수 있고, 반증되면 지우지 말고 정정해야 한다" 원칙이
    코드·테스트·plan 세 곳에는 적용됐는데 CHANGELOG 한 곳만 빠졌다. CHANGELOG 는 코드보다
    수명이 길고(릴리스 노트로 재사용될 수 있음) 다시 열어볼 사람이 원본 코드 JSDoc 까지
    따라가지 않을 가능성이 높다.
  - 제안: `CHANGELOG.md` 의 해당 문단을 라운드 1 정정과 일치시킨다 — 예:
    *"카탈로그를 요구 조건이 아니라 «탈출구» 로 둔다(요구 조건으로 쓰면 미등재 25종에
    거짓 RED). 다만 이 탈출구는 오늘 한 번도 발화하지 않는다 — `MAX_ITERATIONS_EXCEEDED`
    같은 토큰은 카탈로그가 아니라 소비자·분류기 목록의 정확 인용 때문에 이미 앞 단계에서
    통과한다."* 처럼, "잔여 한계" 문단과 같은 방향으로 재작성해 두 문단이 모순되지 않게
    통일할 것.

## 확인 후 문제 없음(참고) — 라운드 1 WARNING/INFO 재검증

- `plan/in-progress/spec-draft-nullable-notation-followups.md:3404` 체크박스 — 라운드 1
  documentation WARNING 이 지적한 미체크 항목이 이번 diff 에서 `[x]` 로 바뀌고 해소 근거
  (`execution-engine.service.ts:8016` 실측 — `nodeExec.error = { message }`, `code` 필드
  없음)가 추가됐다. 직접 `sed -n '8008,8020p'` 로 재확인 — 서술이 정확하다.
- 같은 파일에 consistency-check(`18_40_54`) WARNING #2(spec 6파일의 `CONTAINER_*` "코드"
  서술 통일)·#3(§1.4 앵커-없는 카탈로그 취급 정합)이 각각 새 체크리스트 항목(`:3419-3438`,
  `:3440-3460`)으로 등재됐다. 두 항목이 인용하는 spec 줄 번호(`4-execution-engine.md:332-333`,
  `2-edge.md:202`, `0-canvas.md:636`, `0-common.md:83`, `7-map.md:179-180`,
  `9-foreach.md:209-210`, `3-loop.md:189-191`) 전부를 직접 `sed` 로 열어 대조했고, 인용된
  표·문장이 실제 spec 원문과 정확히 일치한다.
- `guide-identifier-scan.ts` 의 `GUIDE_NON_EMITTED_VOCABULARY`— 라운드 1 WARNING(#4·#6)이
  지적한 "거울상 목록보다 강제 2개 부족"·"`where` 가 단언 없는 프리텍스트"는 각각
  `NON_EMITTED_VOCABULARY_CAP`(상한)·"여전히 인용되는가" 테스트, 그리고 `where` 의
  `파일:줄` 을 파싱해 실제로 그 줄에 토큰이 있는지 grep 하는 테스트(`:202-231`)로 해소됐다.
  `CONTAINER_MULTIPLE_EMIT` 의 `where` 도 `execution-engine.service.ts:7130` 으로 줄 번호가
  채워졌다 — `sed -n '7128,7132p'` 로 실제 그 줄에 `CONTAINER_MULTIPLE_EMIT` 리터럴이
  있음을 확인했다.
- 신규 수집기 3종(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`)에
  형제 함수 수준의 합성 경계 대조군(`describe("발행 축 수집기 — 경계 대조군")`,
  `:477-551`)이 추가됐다 — 라운드 1 testing WARNING 이 요구한 "두 판정이 갈리는 값"이
  역참조 불일치·`:` 유무·공백 유무·여는 따옴표 직후 여부·백틱 vs 따옴표 다섯 갈래로
  구체적으로 고정돼 있다.
- 근접 중복 지적(`19_23_22` maintainability WARNING#7)도 `collectMatches` 공유 헬퍼로
  해소됐고, 그 리팩터 자체의 JSDoc(`:268-280`)이 "왜 위쪽 4곳의 수동 `lastIndex` 는 그대로
  두는지"를 정확히 설명한다.
- `PROJECT.md:300` — 발행 축 추가를 반영한 문구가 실제 구현(3종 등록, 카탈로그=탈출구,
  잔여 한계)과 부합한다. 다만 라운드 1 이 추가한 강제(상한·"여전히 인용" 검사)까지는
  세부적으로 언급하지 않는데, 이는 기존에도 `GUIDE_EXTERNAL_VOCABULARY` 항목 설명 수준과
  같은 축약이라 새로운 결함은 아니다(INFO 수준, 조치 불요).
- `logic.mdx:114`/`logic.en.mdx:103` — KO/EN 문장 모두 실제 엔진 동작(`execution-engine.service.ts:7121·7125·7130`,
  일반 `Error` + 메시지 접두, 구조화 `error.code` 미방출)과 정확히 일치한다. 두 언어 문장의
  의미·구조도 대응한다.
- 가드 스위트 `it(` 개수를 직접 세어(`grep -oE '\bit\(' … | wc -l`) **63** 을 확인했다 —
  RESOLUTION.md·plan §E 가 claim 한 "46 → 63" 과 일치한다.

## 요약

라운드 1 documentation 리뷰가 지적한 4건(플랜 체크박스 미갱신, consistency WARNING 2건
plan 미이관, `where` 줄 번호 누락, 거울상 강제 부족)은 모두 실측으로 재확인한 결과 정확히
해소됐다 — 특히 plan 문서들이 spec 원문·엔진 소스 줄 번호를 전수 인용하며 지어낸 근거가
없음을 확인했다. 다만 라운드 1 자체가 만들어낸 새로운 정정(`MAX_ITERATIONS_EXCEEDED` 는
카탈로그가 아니라 소비자-인용 때문에 통과한다)이 코드·테스트·plan 세 곳에는 반영됐는데
`CHANGELOG.md` 한 곳만 반영되지 않아, 같은 항목 안에서 정정 전/후 설명이 공존하는
자기모순 상태로 남아 있다. 이 PR 자체가 "가이드의 부정확한 코드 주장을 고친다"는 주제이므로
그 결과를 알리는 CHANGELOG 항목이 새로운 부정확한 주장을 담은 채 병합되는 것은 이 PR 의
취지와 특히 어긋난다.

## 위험도
MEDIUM

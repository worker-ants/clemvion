# 문서화(Documentation) 리뷰 — error-code-emission-axis (라운드 4, `20_34_32`)

## 검토 방법

이 배치는 이미 `/ai-review` 3라운드(`19_23_22` C0·W7 → `19_51_33` C0·W4 → `20_13_13`
C0·W2·LOW)와 `--impl-done` 4라운드를 거쳤고, 라운드 3 documentation 리뷰(`20_13_13/documentation.md`)는
"새로 보고할 CRITICAL/WARNING 없음"으로 종결했다. 이번 라운드는 그 직후 커밋
(`5778885ce` "라운드 3 — 1줄 헬퍼만 내 규율을 비켜 갔다")이 새로 들여온 변경만 독립적으로
재검증한다. `git show 5778885ce -- codebase/ plan/ CHANGELOG.md PROJECT.md`로 실제 diff를
직접 열었고, 인용된 소스 줄(`execution-engine.service.ts:7121·7125·7130·8016`,
`makeshop.handler.ts:436`)·`spec/conventions/review-citations.md §4`·
`dto-jsdoc-citation-guard.ts` 존재 등은 전부 저장소를 직접 `grep`/`Read`해 실측 대조했다 —
전부 일치했다.

## 발견사항

- **[WARNING]** JSDoc 주석이 자신이 설명하려던 블록에서 두 블록 떨어진 **엉뚱한 블록 위에 얹혀 있다** — 라운드 2에서 생긴 것을 라운드 3이 한 칸 더 벌렸다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:512-519`
    (JSDoc 블록 "발행 축 수집기 3종의 **합성 경계 대조군**...") 바로 다음 줄 `:520`
    (`describe("staleEntries — 판별 대조군", ...)`). 이 JSDoc 이 실제로 설명해야 할 블록은
    `:568` (`describe("발행 축 수집기 — 경계 대조군", ...)`)이며, 그 사이에 무관한
    `describe("isMessagePrefixOnly — 진리표 대조군", ...)`(`:542`)와 이번 라운드가 새로
    추가한 `describe("staleEntries — 판별 대조군", ...)`(`:520`) 두 블록이 끼어 있다.
  - 상세: `git show a397ccc55:.../guide-identifier-existence.test.ts`(라운드 1 fix)를 열어
    대조한 결과, 라운드 1 시점에는 이 JSDoc(그때는 `:470`)이 정확히 `describe("발행 축
    수집기 — 경계 대조군", ...)`(`:477`) 바로 위에 있었다 — 올바른 배치였다. 라운드 2
    (`a4b98eda8`)에서 `isMessagePrefixOnly`가 테스트-로컬 클로저에서 export 함수로 승격되며
    그 진리표 `describe`가 JSDoc과 대상 블록 **사이에 삽입**됐고, 그 시점부터 이미 JSDoc이
    `isMessagePrefixOnly`의 설명처럼 보이는 상태가 됐다(`git show a4b98eda8:...`로 확인,
    `:510-517`이 `:523`의 `isMessagePrefixOnly` describe 바로 위). 이번 라운드 3 커밋
    (`5778885ce`)이 `staleEntries` 판별 대조군을 **같은 자리**(JSDoc 바로 다음)에 추가로
    끼워 넣으면서 간극이 한 칸 더 벌어졌다. 결과적으로 지금은: JSDoc이 "형제 함수엔 손으로
    짠 대조군이 있는데 **신규 3종**(수집기)만 없었다"고 말하는 그 자리 바로 아래에
    `staleEntries`(수집기가 아니라 "여전히 인용되는가" 필터 헬퍼) 테스트가 오고, 정작
    "신규 3종"(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`)의
    경계 대조군인 `:568` 블록은 어떤 설명도 없이 등장한다. 내용 자체는 두 블록 다 여전히
    맞다(JSDoc 텍스트도 참, `:568`의 테스트 내용도 그 JSDoc이 말하는 것과 일치) — 문제는
    순수하게 **위치**다. 이 저장소가 반복해서 겪어 온 "고칠 때 자리를 보는데 결함의 형태는
    자리(오프셋)다" 클래스이고, 3라운드 연속 `/ai-review`·`--impl-done`의 testing·
    documentation·maintainability checker 전원이 이 특정 배치(라운드 2가 만들고 라운드 3이
    악화시킨 것)를 잡지 못했다.
  - 제안: JSDoc 블록(`:512-519`)을 `:566`(`isMessagePrefixOnly` describe 닫는 `});`) 바로
    다음, `:568` describe 바로 위로 옮긴다. `staleEntries` describe(`:520-540`)에는 이미
    자체 인라인 설명(`:521-524`, `/ai-review` `20_13_13` testing WARNING#2 인용)이 있으므로
    별도 JSDoc 없이도 자족적이다 — 이동만으로 해소된다. 비용은 8줄 이동, 한 줄.

## 확인 후 문제 없음(재확인, 재발 아님)

- `CHANGELOG.md`, `PROJECT.md:300`, `logic.mdx:114`, `logic.en.mdx:103` — 라운드 2에서 정정된
  내용이 이번 커밋(`5778885ce`)에서 변경되지 않았고, 여전히 서로 모순 없이 일치한다(직접
  재확인).
- `GUIDE_NON_EMITTED_VOCABULARY`의 `where` 3건(`execution-engine.service.ts:7121`·`:7125`·
  `:7130`, `makeshop.handler.ts:436`)을 `grep -n`으로 재대조 — 토큰·줄 번호 전부 정확.
  `execution-engine.service.ts:8016`의 `nodeExec.error = { message }`(code 필드 없음)도
  재확인했다.
- 새로 추가된 `staleEntries — 판별 대조군` describe(`:520-540`)의 인용
  `` `review/code/2026/09/13/20_13_13` `` — 전체 경로로 정확히 인용됐다(라운드 2·3에서
  4번 반복된 bare-timestamp 클래스의 재발 없음. 저장소 전체 `grep`으로 `` `NN_NN_NN` ``
  형태의 bare 인용 0건 확인).
- `spec/conventions/review-citations.md §4`("기존 bare 인용 499건은 일괄 치환하지 않는다")
  인용, `dto-jsdoc-citation-guard.ts`(스코프: backend DTO JSDoc) 존재 — 둘 다 plan 문서
  (`error-code-emission-axis.md` §G)의 서술과 실측이 정확히 일치한다.
- `plan/in-progress/error-code-emission-axis.md`의 체크리스트 — 유일한 미완료 항목이
  "`/ai-review` + `--impl-done` — **라운드 4 대기**"이고, 지금이 바로 그 라운드 4라 정합적이다
  (거짓 완료·거짓 미완료 없음).
- CHANGELOG에 이번 라운드 3 fix(`staleEntries` 대조군 추가, bare 인용 정정)에 대한 별도
  항목이 없는 것은 결함이 아니다 — 두 변경 모두 사용자에게 보이는 동작·문서 서술을 바꾸지
  않는 내부 테스트 하니스 강화이고, 기존 CHANGELOG 항목(가이드 문장 정정 + 발행 축 신설)의
  서술과 상충하지 않는다.

## 요약

라운드 1~3이 지적한 문서화 항목(CHANGELOG 자기모순, plan 체크박스, `where` 프리텍스트,
거울상 목록 강제 불균형, bare 인용 4회)은 이번 라운드에서도 여전히 해소된 상태를 유지하고
있고 재발이 없다. 다만 독립 검증 과정에서 3라운드 동안 어떤 checker 도 잡지 못한 새로운
항목 하나를 찾았다 — 라운드 2에서 `isMessagePrefixOnly` export 승격 시 밀려나기 시작한 JSDoc
설명 블록이, 라운드 3의 `staleEntries` 대조군 추가로 한 칸 더 밀려 지금은 완전히 무관한
블록(`staleEntries`) 위에 얹혀 있고 원래 대상 블록(발행 축 수집기 3종 경계 대조군)은
설명 없이 남았다. 두 블록 다 테스트 내용 자체는 정확하므로 동작 결함은 아니지만, 다음
사람이 주석을 보고 엉뚱한 코드를 그 근거로 오독할 수 있는 자리이고 이 저장소가 반복
경계해 온 "위치 이동에 취약한 주석" 클래스의 실제 사례다. 수정 비용은 8줄 이동 한 건으로
낮다. 그 외 API 문서·README·설정 문서·예제 코드 관점에서는 이번 배치가 순수 dev-time
가드/가이드 문장 정정이라 해당 사항이 없다.

## 위험도
LOW

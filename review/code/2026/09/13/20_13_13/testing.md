# 테스트(Testing) 코드 리뷰

## 검토 범위

`error-code-emission-axis` 배치의 실질 코드는 `guide-identifier-scan.ts`(수집기 3종 +
`GUIDE_NON_EMITTED_VOCABULARY`)와 `guide-identifier-existence.test.ts`(그 위 단언 다수)에
집중된다. 이미 라운드 1·2에서 여러 `/ai-review` 사이클을 거치며 mutation 검증·진리표
대조군·경계 대조군이 촘촘히 채워진 상태다. `codebase/frontend`에서 대상 테스트 파일 및
`src/lib/docs/__tests__/` 전체를 직접 실행해 회귀를 확인했다(저장소 뮤테이션 없음, 실행만
수행).

```
guide-identifier-existence.test.ts 단독:  68 passed (68)
src/lib/docs/__tests__/ 전체(23파일):     3368 passed (3368)
```

`GUIDE_NON_EMITTED_VOCABULARY`의 `where` 줄 번호 3건(`execution-engine.service.ts:7121`,
`:7125`, `:7130`, `makeshop.handler.ts:436`)도 소스를 직접 열어 토큰이 실제로 그 줄에
있는지 대조했다 — 전부 일치.

## 발견사항

- **[WARNING]** `staleEntries` 헬퍼가 실제로 "인용 안 됨"을 판정하는지 겨눈 합성 대조군이 없다 — 두 호출부 모두 현재 실코퍼스가 0건인 베이스라인-0 검증뿐이다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:64`(`staleEntries` 정의), 호출부 `:291`(`GUIDE_NON_EMITTED_VOCABULARY`), `:408`(`GUIDE_EXTERNAL_VOCABULARY`)
  - 상세: `staleEntries(list, cited)`는 `list.filter((e) => !cited.has(e.token))`으로 "더 이상 가이드에 인용되지 않는 등록 항목"을 걸러낸다. 두 호출부 모두 `expect(staleEntries(...)).toEqual([])`로만 검증하는데, 이는 "오늘 두 목록의 항목이 전부 실제로 인용되고 있다"는 사실을 확인할 뿐 `staleEntries` 자체의 필터 방향이 옳다는 것을 별도로 증명하지 않는다. 이 파일은 바로 옆에서 `isMessagePrefixOnly`(진리표 대조군 4종)·`parseWhereRefs`(합성 대조군)·`collectQuotedLiterals` 등 신규 함수마다 "두 판정이 갈리는 합성 입력"을 요구하는 규율을 명시적으로 지키고 있다(라운드별 커밋 메시지·JSDoc이 이 규율을 반복 언급). `staleEntries`만 그 규율에서 빠져 있다 — 만약 `!cited.has(e.token)`이 실수로 `cited.has(e.token)`으로 뒤집히면(부정 누락), 현재 실코퍼스로는 모든 등록 항목이 "인용됨"이므로 원래 함수는 `[]`을 반환해야 하는데 뒤집힌 버전은 등록된 3종/1종 전부를 반환해 우연히 RED로 걸리긴 한다. 하지만 예를 들어 두 목록이 앞으로 늘어나 실제로 죽은(더 이상 인용 안 되는) 항목이 하나라도 생기는 시점부터는, `staleEntries`에 미묘한 다른 결함(예: 대소문자 비교 실수, trim 누락 등 — 지금은 해당 없지만 향후 필드가 늘면 생길 수 있는 클래스)이 있어도 실코퍼스만으로는 그 결함을 재현하는 입력이 우연히 존재해야만 잡힌다.
  - 제안: `staleEntries`에 직접 겨눈 합성 케이스 하나를 추가한다. 예: `expect(staleEntries([{ token: "NOT_CITED" }], new Set(["OTHER"]))).toEqual(["NOT_CITED"])`와 `expect(staleEntries([{ token: "CITED" }], new Set(["CITED"]))).toEqual([])`처럼 판정이 갈리는 두 값을 명시적으로 고정한다. 함수 자체가 1줄짜리라 비용은 매우 낮다.

- **[INFO]** `where` 필드의 파일-존재/줄-내용 검증 로직이 `hits.length !== 1` 분기와 `!src.includes(...)` 분기를 실코퍼스의 "정상 경로"로만 통과시킨다 — 0건·2건 이상 매치 분기를 겨눈 합성 fixture가 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:224`(`it("... 파일:줄이 실제로 그 토큰을 담는다 ...")`) 안의 `:241-258`
  - 상세: 이 검증 로직(파일 찾기 → 줄 추출 → 토큰 포함 여부)은 `guide-identifier-scan.ts`로 뽑히지 않고 테스트 본문에 인라인으로 있어, 직전 항목(`parseWhereRefs`)처럼 별도 함수로 분리해 합성 입력을 주기가 상대적으로 어렵다. 현재는 실제 등록 4건(3 토큰 × `where` 참조)이 전부 "정확히 1개 파일에서 발견되고 해당 줄에 토큰이 있음" 경로만 밟는다. `hits.length !== 1`을 `hits.length > 1`로 잘못 고치는 뮤테이션이 들어오면(0건 케이스를 놓침) `hits[0].absPath`에서 `TypeError`가 나 테스트는 여전히 실패하지만, `broken` 배열을 통한 깔끔한 진단 메시지(`"X: file.ts 이 0건"`) 대신 스택트레이스로 실패해 원인 파악 비용이 올라간다. 심각도는 낮다 — 회귀가 나더라도 결국 실패는 하기 때문이다.
  - 제안: 급하지 않음. 향후 이 검증 로직을 `guide-identifier-scan.ts`의 순수 함수(예: `verifyWhereRef(root, file, line, token)`)로 뽑아낼 계기가 생기면, 그때 "파일 0건"·"파일 2건 이상"·"줄에 토큰 없음" 세 갈래를 겨눈 합성 대조군을 함께 추가할 것을 권한다.

- **[INFO]** 테스트 본문 안에 라운드별 리뷰 이력(`/ai-review` 세션 경로·라운드 번호)이 산문으로 장문 인용돼 있어, 순수하게 "이 단언이 무엇을 보장하는가"만 빠르게 파악하기는 다소 어렵다
  - 위치: 예 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:224-233`, `:298-308`, `:352-360` 등 다수
  - 상세: 각 주석이 "왜 이 형태의 fixture여야 하는가"를 실제 사건(리뷰 세션·라운드)으로 근거를 남기는 이 저장소의 명시적 관례(틀린 근거를 지우지 않고 정정하는 문화, MEMORY 다수 항목과 일치)이므로 결함으로 보긴 어렵다. 다만 신규 합류자가 테스트 목록만 훑어 "이 스위트가 무엇을 커버하는가"를 파악하려면 각 `it` 제목 자체(예: `"[경계] 스팬 안쪽에도 워드 경계가 걸린다"`)는 이미 의도를 잘 드러내고 있어 실질적 문제는 크지 않다. 참고용으로만 남긴다 — 조치 불요.

## 요약

새로 추가된 발행 축(수집기 3종 + `GUIDE_NON_EMITTED_VOCABULARY` + 판정 함수 `isMessagePrefixOnly`)은 진리표 대조군·판별 fixture(두 판정이 갈리는 값)·vacuity floor·회귀 고정까지 이례적으로 촘촘하게 커버돼 있고, 실제로 68/68(대상 파일 단독)·3368/3368(형제 파일 포함 전체) 테스트가 통과하며 `GUIDE_NON_EMITTED_VOCABULARY`의 `where` 줄 번호도 소스와 직접 대조해 정확함을 확인했다. 유일하게 남는 갭은 `staleEntries` 헬퍼가 이 파일이 다른 모든 신규 함수에 적용한 "판별 fixture" 규율에서 빠져 있다는 점(WARNING)과, `where` 검증의 파일-존재 분기가 합성 입력 없이 실코퍼스의 정상 경로로만 검증된다는 점(INFO) 정도다. 둘 다 회귀를 놓치는 방향이 아니라(실패는 결국 나되) 진단 품질·규율 일관성 문제에 가깝다. 리뷰 대상 나머지 파일(CHANGELOG.md·PROJECT.md·logic{,.en}.mdx·plan/**·review/**)은 문서/프로세스 산출물로 테스트 관점의 발견사항이 없다.

## 위험도
LOW

# 변경 범위(Scope) 리뷰 — error-code-emission-axis (라운드 5, `20_57_13`)

## 검토 방법

`plan/in-progress/error-code-emission-axis.md` 의 목표(가이드 가드에 "발행 축" 추가 +
`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가이드 문장 정정)를 기준선으로 삼아,
`git diff origin/main..HEAD --stat` 로 전체 파일 목록을 뽑고, 프롬프트가 컨텍스트 예산으로
diff 를 생략한 파일(5·6·7·8번)은 `git diff origin/main..HEAD -- <path>` 로 직접 열어
전문을 확인했다. `codebase/` 하위에 이 4개 외 다른 파일이 건드려졌는지도
`git diff origin/main..HEAD --stat -- codebase/` 로 전수 확인했다.

## 발견사항

- **[INFO]** `codebase/` 하위 실질 코드 변경은 정확히 2 테스트/스캐너 파일 + 2 mdx 파일,
  4개로 한정된다 — 확인됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`,
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`,
    `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`,
    `codebase/frontend/src/content/docs/02-nodes/logic.en.mdx:103`
  - 상세: `git diff origin/main..HEAD --stat -- codebase/` 결과 이 4개 파일 외에는
    아무것도 나오지 않는다(백엔드·다른 프론트엔드 소스 0건). 두 mdx 파일은 각각 한 문장만
    교체했고(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가 "코드로 실행 실패"가
    아니라 "메시지 접두"라는 정정, KO/EN 동형), plan §D-2 처분표와 정확히 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 의 신규
  코드(정규식 3종, 수집기 3함수+공용 헬퍼 `collectMatches`, 판정 함수
  `isMessagePrefixOnly`, 예외 목록 `GUIDE_NON_EMITTED_VOCABULARY`, 대응 테스트 다수)는
  전부 plan 이 정의한 "발행 축" 단일 기능으로 수렴한다
  - 위치: `guide-identifier-scan.ts` (신규 export 전체), `guide-identifier-existence.test.ts`
    (신규 `describe("발행 축 …")` 블록 + 신규 대조군 `describe` 3개)
  - 상세: 기존 export(`collectSourceTokens`/`collectEnvDeclarations`/`scanIdentifierCitations`/
    `GUIDE_EXTERNAL_VOCABULARY`)의 시그니처는 변경되지 않았고(순수 추가), 신규 함수
    전부가 새 테스트 블록에서 소비된다(미사용 임포트 없음, `import` 목록 4개 전부
    신규 블록에서 실사용 확인). 목표를 넘는 기능(예: 넷째 축, AST 기반 방출 위치 특정 —
    plan 이 명시적으로 "다음 배치" 로 미룬 항목)은 이번 diff 에 없다.
  - 제안: 조치 불필요.

- **[INFO]** `staleGuideEntries` 리팩터(기존 `GUIDE_EXTERNAL_VOCABULARY` stale 판정 인라인 →
  공유 헬퍼 호출)가 기존 코드 한 곳을 건드린다
  - 위치: `guide-identifier-existence.test.ts` — 기존 "각 항목이 여전히 가이드에 인용된다"
    `it()` 블록 (파일 하단, `GUIDE_EXTERNAL_VOCABULARY` 축)
  - 상세: 인라인 2줄(`const stale = …; expect(stale.map(...)).toEqual([])`)을 새로 만든
    `staleGuideEntries(list, cited)` 호출 1줄로 교체했을 뿐, 판정 로직(필터 조건)은
    동일하다. 이 리팩터는 신규 함수가 "두 목록이 같은 판정을 공유해야 한다"는 이번
    배치의 설계(발행 축과 존재 축이 동일한 stale 판정을 씀)에서 직접 파생된 것이라
    무관한 정리가 아니다 — RESOLUTION.md(`19_51_33` WARNING#4)가 "중복 제거 커밋이 다른
    중복을 만들었다"고 지적해 나온 수정이며, 지적·수정 모두 이 배치가 만든 코드를
    겨눈다.
  - 제안: 조치 불필요 — 스코프 내 자기수정.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` (이 작업과
  다른, 더 큰 트래커)에 항목 4개가 추가/체크됐다
  - 위치: 라인대 기준 4곳 — (1) `GUIDE_EXTERNAL_VOCABULARY` 항목에 "번복은 두 번이다"
    보강 문단, (2) `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 항목 `[ ]`→`[x]`
    + 해소 서술, (3) 신규 항목 "spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다", (4)
    신규 항목 "§1.4 앵커 없는 코드 7종", (5) 기존 "consistency `--spec` 예산" 항목에
    "`--impl-prep` 에서도 재현됐다" 보강 문단.
  - 상세: 다섯 곳 모두 **이 작업 도중 부수적으로 발견한 사실**(spec-drift, 카탈로그
    탈출구 미발화, consistency 예산 갭 재현)을 **이미 존재하는 관련 항목에 이어붙이거나
    그 항목을 체크**한 것이다. 새 절을 신설하거나 무관한 항목을 재작성하지 않았고,
    대상 파일의 나머지 4,000줄+는 diff 에 나타나지 않는다. `CLAUDE.md` 의 plan 라이프사이클
    관례("발견 즉시 올바른 트래커에 기록")와 일치하며, 이번 작업 범위(가이드 문장 정정 +
    발행 축)와 인과관계가 명확하다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/**`·`review/consistency/**` 하위 신규 파일 다수(4 ai-review
  라운드 + 5 consistency-check 라운드, 커밋 스탯 기준 약 90개 파일·8,000줄+)가 이번
  diff 에 포함된다
  - 위치: `review/code/2026/09/13/{19_23_22,19_51_33,20_13_13,20_34_32}/**`,
    `review/consistency/2026/09/13/{18_40_54,19_23_31,19_51_39,20_13_19,20_34_48}/**`
    (전부 신규 파일)
  - 상세: `CLAUDE.md` "정보 저장 위치" 표가 `review/code/**`·`review/consistency/**` 를
    코드/일관성 리뷰 산출물의 정식 저장 위치로 지정하고 있고, 이 저장소는 반복적으로
    이 산출물을 커밋해 보존하는 관례를 지켜 왔다(직전 4개 라운드의 자체 scope.md 도
    동일하게 "정상 워크플로 산출물" 로 판정). 이번 라운드(5)까지 반복이 길어진 이유는
    각 ai-review 라운드가 실제로 CRITICAL/WARNING(orphan JSDoc·이름 충돌·검증 구멍
    등)을 찾아 다음 라운드에서 실제로 고쳐졌기 때문이며(RESOLUTION.md 4건이 매번
    구체적 뮤테이션 실측을 동반), 리뷰가 형식적으로 반복된 것이 아니라 실질 결함
    수렴 과정이다. 코드 관점에서 새로운 스코프 이탈로 볼 근거는 없다.
  - 제안: 조치 불필요 — 다만 부피가 커서(diff 통계 상 code 아닌 부분이 대부분) 다음
    사람이 diff 를 훑을 때 실질 코드 변경(2 파일)과 프로세스 산출물(90+ 파일)을
    혼동하지 않도록, 이 리뷰처럼 "실질 코드 변경 파일 목록"을 매 라운드 서두에
    명시하는 관례(이미 지켜지고 있음)를 유지할 것.

- 포맷팅·주석·임포트·설정 관점에서 무관한 변경은 발견하지 못했다. `CHANGELOG.md`·
  `PROJECT.md` 는 각각 신규 항목 삽입/단일 줄 교체뿐이고 기존 서술 재작성이 없다.
  `guide-identifier-scan.ts` 의 신규 JSDoc 은 분량이 크지만(정규식 3종·함수 3종·목록
  1종 전부에 설계 근거·경계표·반증 이력을 붙임) 전부 신규 코드 자신의 근거이며, 이
  파일이 기존에도 유지해 온 "장문 근거 주석" 관례(이미 `maintainability.md` 계열
  리뷰가 반복 확인)와 일치해 튀는 추가가 아니다.

## 요약

`origin/main` 대비 실질 코드 변경은 `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`
(발행 축 구현 + 테스트) 와 `logic.mdx`/`logic.en.mdx`(가이드 문장 2건 정정) 4개 파일로
한정되며, 전부 plan(`error-code-emission-axis.md`)의 목표와 1:1 대응한다. `CHANGELOG.md`·
`PROJECT.md` 갱신도 그 변경을 설명하는 단일 항목/단일 줄 교체뿐이다. `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 붙은 관찰 노트 5곳은 이번 작업 도중 발견한
부작용을 기존 트래커의 올바른 항목에 이어붙인 것으로 스코프 이탈이 아니다.
`review/code/**`·`review/consistency/**` 산출물 90여 개는 `CLAUDE.md` 가 의무화한
`/ai-review`+`--impl-done`/`--impl-prep` 워크플로의 정식 저장 위치 산출물이며, 4번의
ai-review 라운드는 매번 구체적 결함(뮤테이션으로 실측된 검증 구멍·orphan JSDoc·이름
충돌 등)을 발견·수정하는 실질 수렴 과정이었다. 불필요한 리팩토링, 요청 밖 기능 확장,
무관한 파일·코드 영역 수정, 의미 없는 포맷팅/주석/임포트/설정 변경은 관측되지 않았다.

## 위험도
NONE

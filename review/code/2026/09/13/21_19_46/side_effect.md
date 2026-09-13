# 부작용(Side Effect) 코드 리뷰 — error-code-emission-axis (라운드 6, `21_19_46`)

## 검토 범위 · 방법

이 배치는 6개 커밋(`65256a109` feat → `a397ccc55`→`a4b98eda8`→`5778885ce`→`57288e47f`→`2931d921f`
fix 라운드 1~5)의 누적분이다. 실질 코드는 여전히 두 파일뿐이다 —
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기 3종·
`collectMatches`·`isMessagePrefixOnly`·`computeNonEmittedOffenders`·`GUIDE_NON_EMITTED_VOCABULARY`)와
`guide-identifier-existence.test.ts`(그 축의 단언·대조군). 나머지(`CHANGELOG.md`·`PROJECT.md`·
`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서/프로세스 산출물이라 코드 실행 경로가 없다 —
`git diff afaef5bef..HEAD --stat -- codebase/` 로 재확인한 결과 `codebase/` 아래 변경된 파일은
정확히 이 넷(두 `.mdx` + 두 `.ts`)뿐이고, 런타임 프로덕션 코드(`execution-engine.service.ts` 등)는
diff 에 등장하지 않는다.

이전 5라운드(`review/code/2026/09/13/{19_23_22,19_51_33,20_13_13,20_34_32,20_57_13}/side_effect.md`)가
이미 위험도 NONE 으로 판정했다. 이번 라운드는 **라운드 5 fix(`2931d921f`, 직전 커밋
`57288e47f` 대비 증분)가 새로 들여온 것만** `git diff 57288e47f..2931d921f -- <두 파일>` 로
직접 추출해 재검증했다. 저장소 파일은 건드리지 않았다(읽기 전용 조사만 수행).

## 라운드 5 증분

1. `guide-identifier-scan.ts`: 신규 **export** 함수 `computeNonEmittedOffenders(citedTokens, sets)`
   — offender 판정 체인(`인용됨 ∧ 접두-전용 ∧ ¬카탈로그 ∧ ¬등록`)을 한 곳에 모은 정본.
2. `guide-identifier-existence.test.ts`: 베이스라인 단언과 `[한계]`(카탈로그 탈출구) 단언이
   손으로 짠 `.filter()` 체인 대신 위 함수를 호출하도록 교체 + `sets` 번들 객체 추가.
3. `guide-identifier-existence.test.ts`: 신규 `describe("computeNonEmittedOffenders — 네 항이
   각각 무는가", …)` — 합성 토큰(`SYNTH_TOKEN`) 기반 진리표 대조군 5건.
4. `guide-identifier-existence.test.ts` JSDoc: `staleGuideEntries` 개명 이력 서술의 자기모순
   (`"첫 판은 staleGuideEntries 였는데"` → `"첫 판은 staleEntries 였는데"`) 텍스트 정정.
5. `plan/in-progress/{error-code-emission-axis.md,spec-draft-nullable-notation-followups.md}`:
   plan 서술 갱신(라운드 5 회고, 검증 로그 갱신) — 실행 코드 변경 없음.
6. `review/code/2026/09/13/20_57_13/**`, `review/consistency/2026/09/13/20_57_15/**`: 라운드 5
   리뷰·일관성 세션 산출물 신규 커밋 — 저장소 관례(CLAUDE.md)와 일치, 코드 실행 부산물 아님.

## 발견사항

- **확인 후 문제 없음(참고)**: `computeNonEmittedOffenders` 는 인자만 읽어 새 배열을 반환하는
  순수 함수다 — `[...new Set(citedTokens)]` 로 **새** Set/배열을 만들고, `sets.*` 네 개는
  전부 `.has()` 로만 읽는다. 어떤 인자도 mutate 하지 않는다(대입·push·delete 없음). 전역
  상태·모듈 스코프 가변 변수를 새로 만들지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:471-487`
- **확인 후 문제 없음(참고)**: 신규 export 는 순수 추가다 — `grep -rn "computeNonEmittedOffenders"
  codebase/frontend/src` 결과 정의 1곳(`guide-identifier-scan.ts:471`)과 호출부는 전부
  `guide-identifier-existence.test.ts` 안에 있다. 이 모듈의 기존 export
  (`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`/`isMessagePrefixOnly`/
  `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`/
  `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY`)는 이번 라운드에서 시그니처가
  전혀 바뀌지 않았다 — 기존 호출자 영향 없음.
- **확인 후 문제 없음(참고)**: 테스트 파일이 `sets` 번들(`{messagePrefixes, quotedLiterals,
  catalogCodes, registered}`)을 describe 최상위에서 한 번 만들고, `[한계]` 테스트에서
  `{ ...sets, registered: new Set<string>() }` / `{ ...sets, catalogCodes: new Set<string>(),
  registered: new Set<string>() }` 처럼 **스프레드로 새 객체를 만들어** 변형한다 — 원본 `sets`
  또는 그 안의 Set 인스턴스를 직접 변경하지 않으므로, 이후 다른 `it()`(베이스라인 재확인 등)이
  같은 `sets` 를 참조해도 오염되지 않는다. 신규 `describe("computeNonEmittedOffenders — 네 항이
  각각 무는가", …)` 블록의 `const base = {...}` 도 각 `it()` 이 `{ ...base, X: new Set([T]) }`
  로만 변형하며 `base` 자체를 건드리지 않는다 — 테스트 실행 순서에 따라 값이 달라지는 공유
  가변 상태가 없다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:134-140`
    (`sets` 선언), `:344-354`(스프레드 변형), `:539-580`(신규 진리표 describe)
- **확인 후 문제 없음(참고)**: JSDoc 자기모순 정정(`staleGuideEntries` 개명 이력 문장의 옛
  이름을 `staleGuideEntries` → `staleEntries` 로 되돌림)은 주석 텍스트만 바뀌었고 그 아래
  `staleGuideEntries` 함수 자체(비-export 로컬 함수, 시그니처·로직)는 라운드 4 이후 변경이
  없다 — 실행 경로에 영향 없음. 개명이 회피하려던 실제 충돌 대상
  (`internal-package-registration-guard.ts:129` 의 `export function staleEntries(...)`)도
  이번 diff 에 포함되지 않아 그대로다.
- **재확인**: 이번 diff 범위 전체에서 `process.env` 신규 읽기/쓰기, 네트워크 호출, 이벤트
  발행/구독, 파일 생성·수정·삭제(리뷰 세션 산출물 외)는 관측되지 않았다. 백엔드 런타임 코드는
  이번 diff 에 포함되지 않는다.

## 참고 (다른 관점이 이미 등재 — 부작용 관점 재조치 불요)

- 라운드 5 RESOLUTION(`review/code/2026/09/13/20_57_13`)이 지적한 "정본 통합에도 불구하고
  카탈로그 필터 뮤턴트가 실코퍼스로는 생존한다"는 사안은 **테스트 커버리지/뮤테이션 완전성**
  관점(testing)이지 부작용 관점의 상태 변경 문제가 아니다 — `computeNonEmittedOffenders` 자체는
  순수 함수이므로 이 축에서는 위에서 확인한 "인자 비변경"만 검증 대상이다.
- 카탈로그 SoT(`spec/5-system/3-error-handling.md`) 하드 리드가 존재 가드 없이 이뤄지는 것은
  라운드 1~5 side_effect 리뷰가 이미 "기존 관행과 일치 — 조치 불요"로 처분했고 이번 라운드에서도
  변경되지 않았다.

## 요약

라운드 5 fix 가 새로 들여온 것(`computeNonEmittedOffenders` 정본 추출, 진리표 대조군 5건,
JSDoc 자기모순 정정, plan 서술 갱신)은 전부 순수 함수 추가·기존 로직의 재사용(스프레드로
새 객체 생성, 원본 비변경)·주석 텍스트 정정으로 구성돼 있어, 점검 관점 8가지(의도치 않은
상태 변경/전역 변수/파일시스템 부작용/시그니처 변경/인터페이스 변경/환경 변수/네트워크
호출/이벤트·콜백) 중 어느 것도 CRITICAL/WARNING 급 결함으로 이어지지 않았다. 신규 export
`computeNonEmittedOffenders` 의 유일한 소비자는 같은 테스트 파일이라 하위 호환성 리스크가
없고, 기존 export 시그니처는 전혀 바뀌지 않았다. 라운드 1~5 가 이미 NONE 으로 판정한 나머지
코드(수집기 3종·`collectMatches`·`isMessagePrefixOnly`·`parseWhereRefs`·`staleGuideEntries`·
`matchAll` 의 `lastIndex` 회피)는 이번 라운드에서 로직 변경이 없어 판정을 유지한다.

## 위험도

NONE

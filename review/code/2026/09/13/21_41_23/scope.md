# 변경 범위(Scope) 리뷰 — error-code-emission-axis (라운드 7, `21_41_23`)

## 검토 방법

`git diff --stat origin/main...HEAD` 로 이 PR 전체(7개 커밋 누적: `65256a109` feat + 6회
`fix(guards)` 라운드)의 실제 변경 파일을 전수 확인했다. 143개 파일·12,791줄 추가·8줄 삭제
중 **135개 파일(review/consistency/**, review/code/** 전부)은 이전 6라운드 `/ai-review`·
`--impl-done` 세션 산출물**이고, 실질 코드·문서·plan 변경은 **8개 파일**로 좁혀진다:

- `CHANGELOG.md`(+32) · `PROJECT.md`(+1/-1)
- `codebase/frontend/src/content/docs/02-nodes/logic.mdx`(+1/-1) · `logic.en.mdx`(+1/-1)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(+237/-)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(+451/-2)
- `plan/in-progress/error-code-emission-axis.md`(신규, +594)
- `plan/in-progress/spec-draft-nullable-notation-followups.md`(+110)

이 8개 파일 각각을 `git diff origin/main...HEAD -- <파일>` 로 직접 열어 재확인했다(프롬프트의
게이트 숫자에 의존하지 않고 저장소 diff 원본을 근거로 썼다 — 다수 파일이 프롬프트 크기
제한으로 diff 가 생략돼 있었다). 라운드 1~6 의 `scope.md`(파일 16·29·41·52·64·77, 확인 가능한
것은 전부 위험도 NONE)가 이미 같은 결론에 도달했는지도 대조했다.

## 발견사항

- **[INFO]** 135개 review 산출물 파일이 커밋에 포함
  - 위치: `review/code/2026/09/13/{19_23_22,19_51_33,20_13_13,20_34_32,20_57_13,21_19_46}/**`,
    `review/consistency/2026/09/13/{18_40_54,19_23_31,19_51_39,20_13_19,20_34_48,20_57_15,21_19_52}/**`
  - 상세: CLAUDE.md 가 의무화한 `--impl-prep`/`--impl-done`·`/ai-review` 각 라운드의 산출물이다.
    `review/` 는 gitignore 대상이 아니고 세션 산출물을 커밋에 포함하는 것이 이 저장소의 정착된
    관례(MEMORY.md "plan 소실 대비")다. 스코프 이탈이 아니라 이 PR 이 7라운드에 걸쳐 자기 자신을
    리뷰·수정한 정상 절차의 기록이다.
  - 제안: 조치 불필요.

- **[INFO]** `guide-identifier-scan.ts` 의 신규 추가분이 순수 추가(0줄 삭제)임을 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체 diff
    (`git diff origin/main...HEAD` 로 직접 대조, 삭제 줄 0건 — 기존 주석 헤더 1줄만 문구
    보강으로 교체)
  - 상세: 신규 정규식 3종(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`), 공용 수집기
    `collectMatches`, `GUIDE_NON_EMITTED_VOCABULARY` 목록, 판정 함수 4개
    (`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`/
    `isMessagePrefixOnly`/`computeNonEmittedOffenders`)가 전부 plan §B-3·§D-2 가 명시한
    "발행 축" 설계와 1:1로 대응한다. 기존 export(`scanIdentifierCitations` 등)의 시그니처는
    건드리지 않았다. 무관한 기존 절 재작성·삭제 없음.
  - 제안: 조치 불필요.

- **[INFO]** `guide-identifier-existence.test.ts` 의 유일한 삭제(2줄)가 자기 자신이 만든
  중복을 되돌리는 리팩터임을 확인
  - 위치: 해당 파일의 "각 항목이 **여전히 가이드에 인용된다**" 테스트 블록
    (`const stale = GUIDE_EXTERNAL_VOCABULARY.filter(...)` 2줄 삭제 → `staleGuideEntries(...)`
    호출 1줄로 교체)
  - 상세: 라운드 3(`5778885ce`)이 `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY`
    두 호출부에 복제된 "여전히 인용되는가" 판정을 공용 헬퍼로 합친 것 — 이번 배치가 스스로
    만든 근접 중복을 같은 배치 안에서 제거한 것이라 무관한 리팩터가 아니다. 나머지 449줄은
    전부 발행 축을 소비하는 신규 `describe`/`it` 블록(대조군·진리표·경계 케이스) 추가다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 대한 110줄
  변경이 전부 이 배치가 직접 겨냥·처분한 항목과 그 항목의 `spec_impact` 목록 보강에 한정됨을
  확인
  - 위치: frontmatter `spec_impact` 5경로 추가(§ CONTAINER_* 6파일 중 누락분), 체크리스트
    항목 2건을 `[ ]` → `[x]` 로 전환(해소 근거 포함), 신규 항목 2건 등재(spec 6파일 서술 불일치,
    §1.4 앵커 없는 코드 표기), 다른 절의 "`--impl-prep` 예산 초과 재현" 관찰 노트 1건 추가.
    전부 이 PR 자신의 실행 과정에서 발견·처분된 항목이고, 이 문서의 다른 4,000줄 이상은
    diff 에 나타나지 않는다 — 무관한 트래커 항목을 건드리지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** `CHANGELOG.md`·`PROJECT.md` 의 변경이 각각 신규 섹션 1개 추가·기존 항목 설명문
  1곳 교체로 정확히 국한됨을 확인 — `git diff` 로 직접 대조, 다른 기존 CHANGELOG 항목이나
  PROJECT.md 표의 다른 행은 손대지 않았다.

- 포맷팅·주석·임포트·설정 관점에서 지적할 무관한 변경은 발견하지 못했다. 신규 함수마다
  붙은 JSDoc 이 길지만(예: `computeNonEmittedOffenders` 선언부), 전부 신규 코드의 설계
  근거(6라운드에 걸친 리뷰 지적·반증 과정)를 담고 있어 이 저장소가 이미 갖고 있던 같은 파일의
  기존 관례(정규식 경계 감사표 등)와 일관되고, 이번 diff 밖의 무관한 절을 재작성하지 않았다.

## 요약

이 PR 은 7개 커밋(feat 1 + fix 6)의 누적분이지만, 실질 코드·문서·plan 변경은 8개 파일에
국한되고 나머지 135개 파일은 그 8개 파일을 만들어 낸 과정 자체(6라운드 `/ai-review`·
`--impl-done`)의 정상 산출물이다. 8개 파일 각각을 저장소 diff 원본으로 직접 재확인한 결과
모든 hunk 가 plan(`error-code-emission-axis.md`)의 체크리스트 항목 또는 그 항목이 발견한
부수 결함(자기 자신의 중복 제거·오타·이름 충돌 등)과 1:1로 대응하며, 요청 범위를 벗어난
리팩토링·기능 확장·무관한 파일 수정·의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.
이전 6라운드의 scope 리뷰가 이미 도달한 NONE 판정과 일치한다.

## 위험도
NONE

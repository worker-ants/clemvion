# 변경 범위(Scope) 리뷰 — error-code-emission-axis (누적 6커밋, 라운드 6)

## 검토 방법

프롬프트에 첨부된 diff 는 크기 제한으로 다수 파일이 생략돼 있어, `git diff origin/main`
(`origin/main` = `afaef5bef`, `HEAD` = `2931d921f`)을 직접 재구성해 전 파일·전 hunk 를
확인했다. 이 배치는 정확히 6개 커밋으로 구성된다:

```
65256a109 feat(guards): 발행 축을 더한다
a397ccc55 fix(guards): 라운드 1
a4b98eda8 fix(guards): 라운드 2
5778885ce fix(guards): 라운드 3
57288e47f fix(guards): 라운드 4
2931d921f fix(guards): 라운드 5
```

무관한 커밋이 섞여 있지 않음을 `git merge-base --is-ancestor afaef5bef origin/main`(yes)와
`git log`로 확인했다 — `afaef5bef` 이후 이 브랜치의 모든 커밋이 이 배치 하나에 속한다.

각 커밋의 diff(`git show <sha> -- <path>`)를 직접 열어 커밋 메시지가 서술하는 변경과
실제 diff 가 1:1로 대응하는지 대조했다(특히 마지막 라운드 `2931d921f`는 이전 라운드들이
아직 검토하지 않은 유일한 신규 변경이라 전문을 직접 읽었다).

## 발견사항

- **[INFO]** 실질 코드 변경은 누적 6커밋 내내 정확히 2개 파일에 고정돼 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(+234/-0 누적),
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(+429/-0 누적)
  - 상세: `git diff origin/main --stat`로 확인한 결과 백엔드·프론트엔드 런타임 코드,
    기존 함수 시그니처, 다른 테스트 파일은 일절 건드리지 않았다. 신규 export
    4개(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`/
    `computeNonEmittedOffenders`, 그리고 `isMessagePrefixOnly`)와 신규 상수
    2개(`GUIDE_NON_EMITTED_VOCABULARY`, 정규식 3종)는 전부 "발행 축" 이라는 단일 목표에
    직접 대응하며, 각 라운드의 diff(`2931d921f` 전문 재확인 포함)에서 그 목표와 무관한
    헬퍼·리팩터·기능은 발견되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 문서 3파일(`CHANGELOG.md`·`PROJECT.md`·`logic.mdx`/`logic.en.mdx`)의 변경은
  각각 hunk 1개로, 이번 배치가 정정한 두 가지 사실(발행 축 도입, `CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT` 문장 오류)에 정확히 대응한다
  - 위치: `logic.mdx:113-114`, `logic.en.mdx:102-103`, `PROJECT.md:299-300`,
    `CHANGELOG.md:1-34`(`git diff origin/main` 게이트 기준, 전부 신규 삽입)
  - 상세: `git diff origin/main -- <각 파일>`로 hunk 개수를 직접 셌다(`PROJECT.md`+`logic{,.en}.mdx`
    합쳐 hunk 3개). 인접 문단 재작성·서식 변경은 없다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이번 작업과
  무관해 보이는 대형(4천 줄+) 트래커 문서 수정이 포함돼 있으나, 실제로는 이번 작업 중
  `--impl-done`/`--impl-prep` 세션이 발견한 부작용을 **기존 항목에 부기**한 것이다
  - 위치: hunk 5개 — `:3263`(허용목록 "번복이 두 번" 보강), `:3391`("존재 검사 CRITICAL"
    항목 `[x]` 처리 + 해소 근거), `:3428`(`CONTAINER_*` 항목 `[x]` 처리 + 실측 근거),
    `:3443`(spec 6파일 `CONTAINER_*` 서술 신규 planner 항목 2건 추가), `:4086`(`--impl-prep`
    예산 초과 재현 노트 추가) — 전부 `git diff origin/main`의 hunk 헤더 기준.
  - 상세: 5개 hunk 전부 **기존 항목의 각주·체크박스 상태 갱신** 또는 **같은 클래스의
    신규 발견을 그 항목 바로 아래에 추가**하는 형태이며, 그 사이(3283~3391, 3443~4086,
    4106~파일끝)의 수천 줄은 diff 에 전혀 나타나지 않는다. `feedback_review_fix_stale_loop.md`
    가 명시한 "미룬 항목은 그 턴에 plan/ 에 적어라" 관례와 일치하고, 이 트래커 문서 자체가
    이 저장소의 SoT(단일 진실)이므로 별도 파일을 새로 만드는 대신 기존 문서에 이어붙인
    것은 관례에 부합한다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/2026/09/13/{19_23_22,19_51_33,20_13_13,20_34_32,20_57_13}/**`,
  `review/consistency/2026/09/13/{18_40_54,19_23_31,19_51_39,20_13_19,20_34_48,20_57_15}/**`
  — 총 100여 개 세션 산출물 파일이 이번 diff 로 신규 커밋된다
  - 위치: `git diff origin/main --stat`의 대다수 행(120개 변경 파일 중 약 112개)
  - 상세: 전부 `new file mode`이고 실행 코드가 아니라 이전 5라운드 `/ai-review` +
    대응 `--impl-done`/`--impl-prep` 세션의 markdown/JSON 산출물이다. `CLAUDE.md` "정보
    저장 위치" 표가 `review/code/**`·`review/consistency/**`를 정식 저장 위치로 지정하고,
    developer SKILL이 구현 완료 후 `/ai-review` + fix를 상시 승인된 강제 의무로 못 박고
    있어, 라운드마다 산출물이 누적되는 것은 스코프 이탈이 아니라 이 저장소의 정착된
    게이트 관행이다(선행 4개 라운드의 scope.md 전부가 동일하게 NONE 으로 판정했고, 이번
    라운드에서 다시 봐도 그 판단을 뒤집을 근거가 없다).
  - 제안: 조치 불필요.

- **[INFO]** 마지막 라운드(`2931d921f`)가 새로 추출한 `computeNonEmittedOffenders`는
  기존 판정 체인(`.filter` 4연쇄)을 함수로 승격한 것으로, 순수 리팩터이되 이번 배치의
  핵심 결함(대조군이 베이스라인과 분리된 병렬 구현이라 뮤테이션을 못 잡음)을 직접
  해소하는 목적성 있는 변경이다 — "관련 없는 정리"가 아니라 이번 배치가 스스로 발견한
  결함의 수정이므로 범위 안이다
  - 위치: `guide-identifier-scan.ts` (`export function computeNonEmittedOffenders`,
    `isMessagePrefixOnly` 정의 바로 아래)
  - 제안: 조치 불필요.

그 외 포맷팅·불필요한 주석·미사용 임포트·의도치 않은 설정 변경은 6개 커밋 전체에서
발견하지 못했다. `guide-identifier-scan.ts`의 JSDoc이 각 라운드마다 길게 누적되고 있으나
(파일 서두 주석이 코드보다 먼저 오는 구조는 라운드 4 maintainability 리뷰가 이미 "반증
이력 보존 원칙의 직접 사례"로 확인함), 전부 신규 코드(정규식 3종·함수 5개·목록 1개)의
직접적 설계 근거·반증 이력이며 무관한 절을 재작성하지 않는다.

## 요약

`origin/main`(`afaef5bef`) 이후 이 브랜치의 6개 커밋은 전부 하나의 배치
(`error-code-emission-axis`)에 속하며, 실질 코드 변경은 시종 `guide-identifier-scan.ts`·
`guide-identifier-existence.test.ts` 2개 파일에 고정돼 있다. 문서 정정(CHANGELOG·PROJECT.md·
logic 가이드 2개)은 각 1개 hunk로 배치의 목표와 정확히 대응하고, plan 트래커 수정은
기존 항목에 발견사항을 부기하는 형태로 관례에 맞다. 다수(약 112개)를 차지하는
`review/code/**`·`review/consistency/**` 신규 파일은 이 저장소가 구현 완료 후 상시
의무화한 `/ai-review`+`--impl-done`/`--impl-prep` 게이트의 정식 산출물이며 5라운드
연속으로 동일하게 NONE 판정됐다. 의도 이상의 변경, 불필요한 리팩토링, 과잉 기능 확장,
무관한 파일 수정, 의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE

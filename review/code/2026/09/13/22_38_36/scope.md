# 변경 범위(Scope) 리뷰 — error-code-emission-axis

## 검토 방법

`origin/main..HEAD` 전체 diff(186개 파일, +18,209/-14)를 `git diff --name-only`/`git diff --stat`로
분류한 뒤, 실질 코드·문서·plan 변경 8개 파일의 전문 diff를 직접 읽었다. 나머지 178개 파일은
`review/code/**`·`review/consistency/**` 하위의 8라운드 `/ai-review` + `--impl-done` 세션
산출물이다. 저장소 파일은 건드리지 않았다(`git diff`/`git log`만 사용, mutation 없음).

핵심 코드/문서 변경 파일 8개:

- `CHANGELOG.md`, `PROJECT.md` — 문서
- `codebase/frontend/src/content/docs/02-nodes/logic.mdx`, `logic.en.mdx` — 유저 가이드
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`,
  `guide-identifier-existence.test.ts` — 가드 코드
- `plan/in-progress/error-code-emission-axis.md` (신규, 728줄) — 이 작업 자신의 plan
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 공유 백로그 트래커

## 발견사항

- **[INFO]** 공유 백로그 트래커(`spec-draft-nullable-notation-followups.md`)에 이 작업과
  직접 관련 없어 보이는 편집 2건이 섞여 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — `spec_impact:`
    블록에 5개 spec 경로 추가(파일 상단), 그리고 하단 "consistency `--spec` 예산" 항목에
    "`--impl-prep` 에서도 재현됐다" 단락 추가
  - 상세: 전자는 이 배치 자신이 신규 등재한 "spec 6파일이 `CONTAINER_*` 를 코드로 서술"
    항목의 `spec_impact` 누락분을 보강한 것이고(`--impl-done` 라운드 6 WARNING#3 처분),
    후자는 이 작업의 `--impl-prep` 실행 중 우연히 재현된 기존 결함(consistency 예산이
    conventions 를 떨구는 문제)을 그 자리에 기록한 것이다. 둘 다 "이 작업 도중 발견한
    부수 사실을 그 턴에 트래커에 적어라"는 이 저장소의 명시 규약
    (`feedback_review_fix_stale_loop.md`)을 따른 것이라 스코프 위반으로 보지 않는다.
    다만 공유 트래커(다른 다수의 미해결 항목을 담은 대형 파일)를 건드리는 편집이라
    diff 리뷰 시 "이 PR 이 무엇을 하나"를 흐릴 수 있어 기록해 둔다.
  - 제안: 조치 불요 — 규약 준수. 병합 시 트래커 충돌만 확인.

- **[INFO]** 8라운드 `/ai-review` + `--impl-done` 산출물(178개 파일, diff 대부분)이
  코드 변경(2개 파일, 순net 약 550줄)에 비해 압도적으로 크다
  - 위치: `review/code/2026/09/13/{19_23_22,19_51_33,20_13_13,20_34_32,20_57_13,21_19_46,21_41_23,22_06_10}/**`,
    `review/consistency/2026/09/13/**`
  - 상세: 이 프로젝트의 CLAUDE.md는 "구현 완료 후 자동 review/fix는 상시 승인된 강제
    의무"이고 리뷰 산출물 커밋을 "정상 게이트 산출물"로 규정한다(RESOLUTION.md 각 라운드의
    INFO 처분에도 반복 확인됨). 따라서 이 자체는 스코프 위반이 아니다. 다만 순수 기능
    관점에서는 "가이드 문장 2줄 정정 + 가드에 축 하나 추가"인 변경이 8번의 리뷰-수정
    사이클(라운드 1~8)을 거치며 헬퍼 함수 5개(`collectMatches`, `staleGuideEntries`,
    `parseWhereRefs`, `resolveSourceLines`, `computeNonEmittedOffenders`)와 대조군
    테스트 다수로 확장됐다. 각 확장이 직전 라운드 리뷰어의 구체적 지적(중복 제거,
    진리표 대조군, 뮤테이션 생존 등)에 대한 직접 대응이라는 점은 diff에서 확인했고
    (예: `collectMatches` 도입 JSDoc이 `review/code/.../19_23_22` maintainability
    WARNING#7을 직접 인용), 요청 범위를 벗어난 임의 확장은 발견하지 못했다.
  - 제안: 조치 불요 — 각 확장의 동기가 diff 내 JSDoc/RESOLUTION.md에 추적 가능하게
    남아 있어 "의도 이상의 변경"으로 판정하지 않는다.

- **[INFO]** `guide-identifier-existence.test.ts`의 기존 `GUIDE_EXTERNAL_VOCABULARY`
  검증 로직 1줄이 새 헬퍼로 교체됐다 — 신규 기능과 무관해 보일 수 있는 최소 리팩터
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    — "각 항목이 여전히 가이드에 인용된다" 테스트(`GUIDE_EXTERNAL_VOCABULARY` 블록)
  - 상세: `const stale = GUIDE_EXTERNAL_VOCABULARY.filter((e) => !cited.has(e.token)); expect(stale...)`
    가 `expect(staleGuideEntries(GUIDE_EXTERNAL_VOCABULARY, cited)).toEqual([])`로
    교체됐다. 새로 추가된 `GUIDE_NON_EMITTED_VOCABULARY`도 동일 판정이 필요해 그 판정을
    공유 헬퍼로 뽑아낸 것이며, RESOLUTION.md(라운드 2)가 "같은 판정을 두 `it()`에
    복제했다"는 이전 라운드 자신의 지적을 고치는 커밋으로 명시하고 있어 신규 기능이
    유발한 필연적 변경이다. 기존 동작(단언 결과)은 바뀌지 않았다.
  - 제안: 조치 불요 — 무관한 리팩터가 아니라 신규 축 추가로 발생한 최소 DRY.

- **[INFO]** `sourceTexts` 소스 루트 정의가 인라인 배열 리터럴에서 모듈 상수
  (`SOURCE_ROOTS`)로 추출됨 — 신규 기능(`resolveSourceLines`)이 같은 정의를 필요로
  했기 때문
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    — `const sourceTexts = walkTree(root, SOURCE_ROOTS, { skipDir: skipBuildDirs, ... })`
  - 상세: 리뷰 라운드 8(`review/code/.../22_06_10` architecture WARNING#1)이 "백엔드
    소스" 정의가 파일 안에 두 곳(기준집합용·`where` 검증용)이라 불일치 위험이 있다고
    지적했고, 이를 단일 상수로 합친 결과다. 순수 프로덕션 코드가 아니라 테스트 파일
    내부 상수 추출이며 외부에 영향 없다.
  - 제안: 조치 불요.

## 검토했으나 스코프 이탈로 보지 않은 항목

- 런타임 프로덕션 코드(`execution-engine.service.ts` 등)는 이번 diff에 전혀 포함되지
  않았다 — plan §D의 "동작은 안 바꾼다" 제약과 일치하며, 여러 라운드의 side_effect/
  security 리뷰가 이미 이를 확인했다(재확인 목적의 중복 지적 아님).
- `CHANGELOG.md`(+33줄)·`PROJECT.md`(+2줄) 변경은 정확히 이번 가드 항목 하나(발행 축)를
  서술하는 데 국한되고, 무관한 CHANGELOG 항목이나 다른 규약 문서 항목을 함께 건드리지
  않았다.
- import 추가(`collectQuotedLiterals`, `collectMessagePrefixes`, `collectCatalogCodes`,
  `isMessagePrefixOnly`, `computeNonEmittedOffenders`, `GUIDE_NON_EMITTED_VOCABULARY`)는
  전부 같은 diff에서 새로 export된 심볼이며 사용되지 않는 임포트는 없다.
- 포맷팅·공백만의 변경, 무관한 주석 삭제/추가는 diff에서 발견되지 않았다 — 주석 변경은
  전부 이번 기능(발행 축)의 근거·한계·이력 서술이거나 위 리팩터에 동반된 JSDoc이다.

## 요약

핵심 변경은 "가이드 문서 2건의 부정확한 서술(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`
가 에러 코드로 발행된다는 오해) 정정 + 이를 지키는 가드에 발행 축 추가"라는 단일 목적에
정확히 국한돼 있으며, 실질 코드 변경은 두 테스트/스캐너 파일에 한정된다. 함께 이뤄진
소규모 리팩터(공용 헬퍼 추출, 소스 루트 상수 통합)는 모두 신규 기능이 요구한 필연적
변경이고 각각의 동기가 diff 내 주석·RESOLUTION.md에 추적 가능하다. plan 트래커 편집도
이 작업 도중 발견한 부수 사실을 기록하는 이 저장소의 명시 규약을 따른 것이다. 8라운드
`/ai-review` 산출물이 diff 크기의 대부분(178/186 파일)을 차지하지만 이는 프로젝트가
강제하는 표준 게이트 산출물이며 임의 기능 확장이나 무관한 파일 수정은 발견하지 못했다.

## 위험도

NONE

# 변경 범위(Scope) 리뷰 — guide-identifier-existence (라운드 4, `15_24_12` 이후)

## 검증 방법

`git diff --stat origin/main...HEAD`(98 files)를 직접 조회하고, `review/**` 산출물을 제외한
실제 코드/문서/plan 변경만 따로 뽑아(`git diff --stat ... | grep -v '^ review/'`) 확인했다.
직전 라운드(`review/code/2026/09/13/15_24_12`) 이후 새로 커밋된 유일한 코드 변경(`b75fe0ace`)을
`git show`/`git diff 938060138 b75fe0ace`로 단독 대조했고, `CHANGELOG.md`·`PROJECT.md`·
`plan/in-progress/spec-draft-nullable-notation-followups.md`·`guide-identifier-existence.test.ts`
는 `Read`/`git diff`로 전문을 직접 열어 확인했다. 저장소는 뮤테이션하지 않았다(`git status --short`
결과 이 세션이 만든 `review/code/2026/09/13/15_42_54/`·`review/consistency/2026/09/13/15_43_24/`
untracked 산출물 외 변경 없음).

## 발견사항

- **[INFO]** 라운드 3 이후 실제 코드 델타(`b75fe0ace`)는 직전 라운드 testing WARNING #1 에 **1:1로 결속**돼 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (`describe("scanIdentifierCitations — 축별 대조군", …)` 안 `it("[비대상] 밑줄 없는 대문자 약어는 안 집는다", …)`) · `plan/in-progress/guide-identifier-existence.md`(체크리스트 갱신)
  - 상세: `git diff 938060138 b75fe0ace`로 대조한 결과, 유일한 실 코드 변경은 `UPPER_SNAKE`의 "밑줄 최소 1개" 설계 결정이 무검증이었다는 라운드 3 리뷰 지적(`review/code/2026/09/13/15_24_12/testing.md` WARNING #1, `+`→`*` 뮤턴트 생존)을 겨눈 테스트 1건 추가뿐이다. `LLM`/`HTTP`(밑줄 없음, 놓쳐야 함) vs `LLM_TIMEOUT`(밑줄 있음, 잡아야 함)이라는 두 판정이 갈리는 fixture로 짜여 있어 판별력도 있다. 나머지는 `plan/in-progress/guide-identifier-existence.md`의 체크리스트를 실제 수행 상태(`run-test-all.sh` 3회 ALL PASS, 라운드별 `/ai-review`+`--impl-done` 표)로 동기화한 것뿐이다. 요청 이상의 추가 수정, 무관 리팩토링, 기능 확장은 없다.
  - 제안: 없음. 스코프 이탈 아님.

- **[INFO]** `CHANGELOG.md`/`PROJECT.md` 편집이 정확히 이 PR 이 리네임한 가드 카탈로그 항목 한 줄에 국한됨
  - 위치: `CHANGELOG.md`(가드 목록 절) · `PROJECT.md:299`(가드 카탈로그 표)
  - 상세: `git diff origin/main...HEAD -- CHANGELOG.md PROJECT.md`로 전문 대조한 결과, 두 파일 모두 `guide-error-code-existence` → `guide-identifier-existence` 항목 텍스트(3축·기준집합·허용목록·한계 서술)만 갱신됐고 그 앞뒤의 무관한 다른 가드 항목·설정·목차는 건드리지 않았다. 포맷팅·줄바꿈 드리프트도 없다(diff hunk가 해당 항목 범위에만 국한).
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 편집은 리네임 전방 참조 갱신 + 원 항목 종결(취소선+번복 근거)에 국한되고, 새로 등재된 무관 항목은 스스로 "무관"을 명시함 — 라운드 1~3 처분과 동일 결론 재확인
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (여러 지점의 `guide-error-code-*` → `guide-identifier-*` 참조 갱신, `- [ ]` → `- [x]` 원 트래커 항목 종결, `cafe24-api-metadata.md §4` Principle 오인용 신규 항목)
  - 상세: 전문을 직접 읽은 결과, (1) 이 가드를 지칭하는 기존 산문 6곳이 새 이름으로 갱신(구 이름은 대부분 각주로 병기), (2) 이 PR 이 닫는 원 트래커 항목("가이드가 적는 식별자가 실재하는지 세는 가드가 없다")이 취소선+번복 근거와 함께 체크됨, (3) 새로 등재된 `cafe24-api-metadata.md §4` Principle 7→0 오인용 항목은 본문에 `(선재, 무관)`이라고 스스로 명시하고 있고, `--impl-prep` 도중 우연히 발견한 선재 결함을 `developer`가 `spec/` 쓰기 권한이 없어 즉시 `plan/` 백로그로 등재해야 하는 프로젝트 관례(개발자 SKILL·자기-반증형 소정정 예외 밖 사안)를 그대로 따른 것이다. 은폐 없이 투명하게 스코프 밖임을 밝혔으므로 CRITICAL/WARNING 대상은 아니다.
  - 제안: 조치 불요. 기록으로만 남긴다.

- **[INFO]** 파일 교체(`guide-error-code-*` 삭제 + `guide-identifier-*` 신규)가 `git mv`가 아닌 delete+create — 라운드 1이 실측 근거와 함께 이미 조치 불요 처분, 재검토해도 뒤집을 새 근거 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`(삭제)/`guide-error-code-scan.ts`(삭제) → `guide-identifier-existence.test.ts`(신규)/`guide-identifier-scan.ts`(신규)
  - 상세: 축 구조(문맥 게이팅 제거)·기준집합(env 선언처 병합 추가)·허용목록(신설 4강제)이 모두 바뀐 실질 재설계라 순수 리네임이 아니었고, 라운드 1 scope 리뷰가 `--find-renames=25%`로도 git이 D+A로 기록함을 실측 확인한 뒤 "회고적 이력 재작성은 비용 > 이익"으로 조치 불요 처리했다. 이번 라운드도 그 결론을 뒤집을 새 사실은 없다.
  - 제안: 조치 불요(재확인). 다음에 유사한 대규모 가드 재설계 시 `git mv` 후 편집하는 방식을 고려할 것.

- **[INFO]** 전체 diff(98 files) 중 대다수(≈80개)가 `review/code/**`·`review/consistency/**` 산출물 — 프로젝트의 fix→리뷰 루프 관례에 따른 필수 동반 커밋이며 스코프 크리프 아님
  - 위치: `review/code/2026/09/13/{14_41_14,15_03_06,15_24_12}/**`, `review/consistency/2026/09/13/{12_33_41,14_41_43,15_03_36,15_23_53}/**`
  - 상세: 이 저장소는 "원 리뷰가 stale 판정되지 않으려면 코드 커밋과 리뷰 산출물이 같은 이력에 있어야 한다"는 확립된 관례(`feedback_review_fix_stale_loop`, `feedback_fresh_review_after_resolution`)를 따른다. 이번 diff 자체의 목적("가이드 식별자 실재성 가드")과 직접 관련된 코드가 아니라 그 목적을 검증한 과정의 기록이므로 별도 카테고리로 다루되, 무관한 리팩토링·기능 확장으로 보지 않는다.
  - 제안: 없음.

- **[INFO]** MDX 가이드 본문 자체는 이번 diff에서 전혀 수정되지 않음 — 스코프가 검증 harness에 정확히 국한됨
  - 위치: `git diff origin/main...HEAD --name-only` 전수 확인 — `codebase/frontend/src/content/docs/**` 매치 0건
  - 상세: 이 PR은 "가이드가 적은 식별자가 실재하는가"를 검증하는 가드만 바꾸고, 검증 대상인 가이드 문서 자체는 건드리지 않는다.
  - 제안: 없음.

## 요약

라운드 4 시점 전체 diff(98 files)는 이전 세 라운드의 scope 리뷰가 일관되게 LOW로 판정한 범위와 동일하며, 라운드 3 이후 실제로 추가된 유일한 코드 변경(`b75fe0ace`)은 그 라운드의 testing WARNING #1(주석에만 있던 "밑줄 최소 1개" 설계 결정이 무검증)에 1:1로 결속된 테스트 1건 추가와 plan 체크리스트 동기화뿐이다. `CHANGELOG.md`·`PROJECT.md` 편집은 리네임된 가드 카탈로그 항목 한 줄에 국한되고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 편집도 전방 참조 갱신 + 원 항목 종결 + 자기-명시적으로 "무관"이라 밝힌 관례 준수 백로그 항목 하나에 국한된다. 요청 이상의 기능 확장·무관한 리팩토링·포맷팅 드리프트·불필요한 임포트/주석 변경은 관찰되지 않았다. 경계에 있던 두 항목(cafe24 백로그 신규 등재, delete+create 형태의 리네임)은 이전 라운드에서 이미 실측 근거와 함께 조치 불요로 처분됐고 이번 라운드에서 그 처분을 무효화할 새로운 사실은 없다. 다수를 차지하는 `review/**` 산출물은 이 프로젝트의 fix→리뷰 루프 관례에 따른 필수 동반 커밋이다.

## 위험도

LOW

# 테스트(Testing) 리뷰

## 검증 방법

이번 라운드는 이미 두 차례(`18_30_55`→`18_46_06`)의 `/ai-review` 를 거친 브랜치(10개 커밋,
base `ead37afd4` → HEAD `f3ece1fc6`)의 3라운드 리뷰다. 프롬프트 대신 저장소 현재 상태를
직접 근거로 썼다:

- `git log --oneline origin/main..HEAD` 로 10개 커밋 확인, 최신 커밋(`f3ece1fc6`)의
  `git show --stat`/본문으로 이번 라운드에서 실제로 무엇이 바뀌었는지 확정.
- `.claude/tests/test_consistency_scope_census.py` 전체를 `Read` 로 직접 열어 1·2라운드
  리뷰가 지적한 WARNING(스코프 20건 초과 fold 미검증, 매직넘버 등)이 실제로 fixture 로
  반영됐는지 확인.
- `.claude/tests/test_tests_readme_catalog.py` — 최신 커밋이 고쳤다고 주장하는 카탈로그
  가드를 직접 실행해 GREEN 확인.
- `_scope_delta_census` 의 `diff_lines` 계산부에 뮤테이션(`999999`로 치환)을 넣어
  `test_consistency_scope_census.py` 14개가 전부 GREEN 을 유지하는지 실측 확인 → 그 값이
  실제로 어떤 테스트에서도 단언되지 않음을 증명. 뮤테이션은 `git show HEAD:<path> > <path>`
  로 즉시 원복(저장소 밖 scratch 사본이 아니라 committed HEAD 내용으로 직접 복원 — `git
  checkout`/`restore`/`stash` 미사용), 이후 `git status --short` 로 clean 확인하고
  스위트를 재실행해 19/19 GREEN 으로 원복을 검증했다.
- `spec/5-system/6-websocket-protocol.md` 의 실제 헤딩 시퀀스(`### 4.1`~`### 4.7`)를 grep 으로
  대조해, `websocket-events.types.ts`/`chat-channel/*` 에 남아 있는 다수의 `§4.4` 인용이
  이번 PR 의 렌넘버링(구 `§4.4` 알림 이벤트→`§4.5`) 대상이 **아니라** 이동하지 않은 별개
  섹션(`§4.4 사용자 입력 대기 이벤트 상세`, 하위 `§4.4.5`/`§4.4.6`)을 정확히 가리키고
  있음을 확인했다 — 오탐 후보를 제거하고 리포트에서 뺐다.

## 발견사항

- **[INFO]** `_scope_delta_census` 가 렌더링하는 `{diff_lines}줄` 값이 어떤 테스트에서도
  검증되지 않는다 (1라운드 리뷰가 이미 지적했고 2라운드 fix 에서도 다루지 않은 잔여 항목 —
  이번에 뮤테이션으로 재확인).
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 함수
    `_scope_delta_census` 내 `diff_lines = diff_text.count("\n") if diff_text.strip() else 0`
    (모듈 상수 `_SCOPE_HITS_DISPLAY_LIMIT` 정의 직후, `_count_diff_files` 다음 블록)와
    `.claude/tests/test_consistency_scope_census.py` 의
    `test_present_diff_warns_that_absence_below_means_truncation`
    (`ScopeDeltaCensus` 클래스, `assertIn("1개 파일", out)` / `assertIn("예산에 잘렸다", out)`
    / `assertIn("/tmp/wt", out)` 세 단언만 존재, `줄` 문자열 단언 없음).
  - 상세: `diff_lines` 를 `999999` 로 강제 치환하는 뮤테이션을 넣고 스위트를 재실행한 결과
    **14/14 GREEN** 을 유지했다(원복 후 재확인 완료) — 즉 이 값이 잘못 계산돼도 현재
    스위트는 감지하지 못한다. 판정 로직(scope 필터·truncation 경고 문구)에는 영향을 주지
    않는 표시용 부가 정보라 심각도는 낮지만, 같은 fixture(`ONE_FILE_DIFF`, 개행 1개 삽입
    → 6줄)로 `assertIn(f"{ONE_FILE_DIFF.count(chr(10))}줄", out)` 한 줄을 추가하는 비용이
    낮다.
  - 제안: `test_present_diff_warns_that_absence_below_means_truncation` 에 `diff_lines` 값
    단언을 한 줄 추가.

- **[INFO]** `_count_diff_files` 가 rename-only diff(내용 변경 없는 순수 이름 변경, `+++`/`---`
  헝크가 없는 형태)를 세는 경로는 fixture 로 직접 검증되지 않는다.
  - 위치: `.claude/tests/test_consistency_scope_census.py` 클래스 `CountDiffFiles` (4개
    케이스 — 빈 문자열, 첫 헤더 개행 유무, 3파일, added-file `/dev/null` 케이스). rename
    케이스(`diff --git a/x b/y\nsimilarity index 100%\nrename from x\nrename to y\n` 형태,
    `+++`/`---` 없음)는 없음.
  - 상세: 함수 자체의 docstring 이 "`+++` would... miscount **renames**" 라고 rename 을
    명시적 동기로 들면서도, 정작 그 rename 케이스를 재현하는 fixture 는 스위트에 없다
    (added-file `/dev/null` 케이스만 있음). 구현은 `diff --git` 헤더 존재만 세므로 rename
    여부와 무관하게 정확할 개연성이 높아 실질 위험은 낮지만, docstring 이 스스로 든 근거를
    테스트가 커버하지 못하는 간극이다.
  - 제안: `test_rename_counts_once_with_no_plus_plus_plus_line` 같은 케이스를 하나 추가해
    docstring 의 주장을 fixture 로 뒷받침.

- **[INFO]** 최신 커밋(`f3ece1fc6`)의 실 코드 변경은 전부 주석/독스트링(`websocket.service.ts`
  §4.4→§4.5, `websocket.service.spec.ts` 같은 문구, `notifications-channel-authorizer.ts`
  헤더 코멘트 갱신)과 `.claude/tests/README.md` 카탈로그 등재뿐이라 별도 신규 테스트가
  필요하지 않다 — 다만 이 커밋이 스스로 "직전 커밋에서 카탈로그 가드를 한 번도 안 돌리고
  통과라고 썼다"고 인정한 실수(W1)는 **회귀 방지용 테스트가 아니라 프로세스(discover
  패턴 좁힘) 문제**였다는 점을 기록해 둔다. 직접 `python3 -m unittest
  test_tests_readme_catalog -v` 로 GREEN 을 재확인했다(가드 자체는 §"위치 표기" 절에
  Read 로 전문을 확인 — 존재하는 실제 항목만 세는 정본 정규식 파서 + 공허 방지 sanity
  테스트 3종을 갖춰 이 결함 클래스(누락 카탈로그 항목)를 구조적으로 다시 잡는다).
  - 위치: 해당 없음(코드 변경 없음, 관찰 기록).
  - 제안: 조치 불요 — 참고로만 남긴다.

## 회귀 확인 (직접 실행)

- `.claude/tests/test_consistency_scope_census.py` — 14/14 PASS (뮤테이션·원복 검증 포함).
- `.claude/tests/test_tests_readme_catalog.py` — 5/5 PASS (신설 `test_consistency_scope_census.py`
  가 `.claude/tests/README.md` 카탈로그에 정확히 등재됐음을 확인).
- 원복 후 `git status --short` — 세션 산출물 디렉터리(`review/code/2026/08/31/19_07_49/`)
  외 잔여 변경 없음 확인.

## 이전 라운드 대비 상태 요약

1·2라운드가 지적한 testing 축 WARNING(scope-hits 20건 초과 fold 분기 미커버, 매직넘버 `20`
비상수화)은 이번 라운드 이전 커밋(`0883c4e43`)에서 이미 해소돼 있음을 fixture
(`test_under_the_limit_lists_every_path_and_does_not_fold` n=20,
`test_over_the_limit_folds_with_the_exact_remainder` n=25, "… 외 5건" 정확 단언)로 직접
확인했다. 남은 것은 이번에 새로 실측한 `diff_lines` 미검증(뮤테이션으로 확정)과 rename
fixture 부재 두 건뿐이며, 둘 다 판정 로직이 아니라 표시/부가 축이라 INFO 다.
`workflow-assistant.controller.swagger.spec.ts`(라우트 수 공허 방지 전제 + 401 문구 단언,
데코레이터 제거 뮤테이션으로 RED 확인은 1라운드에서 이미 수행됨)와 `chat-channel`/`websocket`
주석 전용 변경(테스트 영향 없음, 43/43·기존 스위트 재실행 통과 기록됨)에 대해서는 이번
라운드에서 새로 지적할 사항이 없다.

## 요약

이번 changeset 의 테스트 설계는 전반적으로 이 저장소의 높은 기준(뮤테이션 근거 명시,
"주어 있는 assertion", 공허 방지 전제 케이스, 서브프로세스/fresh-interpreter 격리, 카탈로그
가드로 문서-테스트 drift 차단)을 잘 따른다. 1·2라운드가 낸 testing WARNING 은 소스 확인
결과 실제로 해소돼 있었다. 이번 라운드에서 직접 뮤테이션 테스트로 새로 확정한 갭은
`_scope_delta_census` 의 `diff_lines`(부가 표시값, 999999 로 치환해도 14/14 GREEN 유지)와
`_count_diff_files` 의 rename-only 케이스 fixture 부재 두 건이며, 둘 다 판정 로직에
영향을 주지 않는 표시/문서 축이라 INFO 로 남긴다. 최신 커밋 자체는 주석·카탈로그 등재뿐이라
신규 테스트가 필요한 로직 변경이 없다. CRITICAL/WARNING 급 결함은 발견하지 못했다.

## 위험도

LOW

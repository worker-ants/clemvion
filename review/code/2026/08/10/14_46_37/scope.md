# 변경 범위(Scope) Review

## 조사 방법

이 changeset(`origin/main..HEAD`, 브랜치 `claude/harness-review-batch-false-pass`, 96개 파일 /
+7047 -36)은 (a) 실제 하네스 코드·문서·plan 9개 파일(배치 분할 제거 + router fail-closed
교차검사)과 (b) `review/code/2026/08/10/{08_32_48,10_54_59,11_08_01,11_15_05,11_44_32,14_09_31,
14_32_02}/**` + `review/consistency/2026/08/10/{10_35_05,10_36_44,12_06_35}/**`(고아 리뷰
산출물 회수 + 이번 브랜치 자신의 리뷰 라운드)로 구성된다.

오케스트레이터 지시대로 "08_32_48 CRITICAL 처분이 타당한가"와 "남은 회수분에 또 다른
오귀속이 없는가"를 **액면가로 받지 않고** 재판정했다. 방법: 각 세션 `meta.json`(`files[]` 또는
`target_path`)을 읽고, 거기 적힌 커밋/PR 이 실제로 `origin/main`의 조상인지
`git merge-base --is-ancestor`로, diff 내용이 일치하는지 `git show --stat <sha>`로 직접
대조했다(직전 두 라운드가 이미 이 방법을 썼다는 서술 자체도 재검증 대상으로 다뤘다 — 서술을
믿지 않고 다시 실행했다).

## 발견사항

- **[INFO]** (오케스트레이터 처분 재검증 — 타당함) `08_32_48`의 대상 9개 중 3개
  (`plan-link-integrity.test.ts`·`spec-links.ts`·`spec-plan-completion.test.ts`)가 도달
  불가능한 로컬 커밋 `62084e807`의 산출물이라는 `14_32_02/scope.md` CRITICAL과, "산출물은
  유지하고 서술만 정정한다"는 `14_32_02/RESOLUTION.md` 처분을 **독립적으로 재실측**했다.
  - 위치: `review/code/2026/08/10/08_32_48/meta.json`(files[] 9건), `14_32_02/RESOLUTION.md`
    (처분 서술), 실제 판단 근거는 저장소 git 이력(파일 아님)이라 게이트 인용 불가.
  - 상세: `git cat-file -t 62084e807` → `commit`(객체 존재) / `git branch -a --contains
    62084e807`·`git tag --contains 62084e807` → 둘 다 무출력 / `git merge-base --is-ancestor
    62084e807 origin/main` 및 `HEAD` → 둘 다 NOT ancestor / `git for-each-ref`로 로컬·원격 전체
    ref를 훑어도 도달하는 ref가 하나도 없음 — 로컬 dangling 커밋이라는 주장이 사실이다.
    `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts`는
    `git show origin/main:<path>`·`git show HEAD:<path>` 모두 실패(파일이 양쪽 모두에 부재).
    한편 그 작업의 후속인 `144d0de0a`(#1123, "plan 라이프사이클 게이트 3종")는
    `origin/main`의 조상이며, 그 커밋 메시지 본문이 "spec-impl-evidence §4.2 를
    'plan-scan.ts 소관'으로 갱신"이라고 직접 언급한다 — `62084e807`이 반영한 plan-link 검사
    로직이 `plan-scan.ts`로 옮겨가며 재구조화됐다는, `14_32_02/scope.md`의 기술적 주장과
    정확히 들어맞는 독립 증거다. 6개 나머지 파일(`git_probe.py`·`session.py`·
    `consistency_orchestrator.py`+테스트 3개)은 `c9e0e2ff7`(#1125)의 diffstat과 파일명이
    1:1로 일치함을 직접 확인했다(`.claude/_shared/git_probe.py`, `.claude/skills/
    code-review-agents/lib/session.py`, `consistency_orchestrator.py` 등이 모두 그 안에 있음).
    즉 **"6/9는 합법, 3/9는 폐기된 로컬 작업"**이라는 판정 자체가 옳고, `12_48_08`(열린 PR
    #1130 — 담을 곳이 있어 옮김)과 `08_32_48`(폐기된 로컬 커밋 — 담을 곳이 없어 유지)을
    가르는 기준도 합리적이다. 처분에 동의한다.

- **[WARNING]** 위 CRITICAL의 근원이 된 잘못된 주장이, 정정 이후에도 원문 그대로 남아
  이번 changeset에 **함께** 실린다 — "부분만 확인하고 전체로 적는" 패턴이 정정되지 않은 채
  감사 기록에 그대로 굳는다.
  - 위치: `review/code/2026/08/10/14_09_31/RESOLUTION.md:15`
    (`` | `08_32_48` | `git_probe.py`·`session.py`·`consistency_orchestrator.py` | #1125
    (머지) ✅ | ``)
  - 상세: 이 표는 `14_09_31` 라운드가 "액면가로 받지 않고 각 세션 meta.json 을 직접 읽어
    대조했다"고 선언한 검증 결과다. 그런데 정작 `08_32_48` 행은 대상 9개 중 3개
    (`plan-link-integrity.test.ts` 등)를 아예 언급하지 않고 "#1125 (머지) ✅"로 조건 없이
    확정한다 — 바로 그 3개가 `14_32_02/scope.md`가 나중에 CRITICAL로 잡아낸 도달 불가 커밋
    산출물이다. `12_48_08` 행은 같은 표에서 열린 PR로 정확히 갈렸으니, 이 표를 작성한 시점의
    검증이 `08_32_48`에 대해서는 "9개 중 6개만 보고 전체를 ✅로 적는" 동일한 실수를 반복한
    것이다(`14_32_02/RESOLUTION.md:35`가 이 사실을 스스로 지적한다: "내 RESOLUTION 도
    `08_32_48` 을 '#1125 것' 으로 한 줄 처리했는데 실제로는 9개 중 6개만…"). 문제는 그
    자기지적이 `14_32_02` 문서에만 있고, 원본 표(`14_09_31/RESOLUTION.md:15`)는 이번
    changeset에 **정정 없이, 상호 참조 각주도 없이** 그대로 커밋된다는 점이다. 이 브랜치는
    아직 `origin/main`에 머지되지 않았으므로 지금은 "이미 확정된 과거 커밋"이 아니라 이번 PR
    자체가 쓰고 있는 문서다 — 나중에 누군가 `08_32_48`의 귀속을 `14_09_31/RESOLUTION.md`
    표만 보고 확인하면(예: grep으로 "#1125"만 찾으면) 다시 "전부 합법"으로 오판할 수 있다.
    오케스트레이터가 미리 경고한 "부분만 확인하고 전체로 적는" 실패 형태가, 정정된 뒤에도
    원본 문서에는 남아 이번 커밋 이력에 그대로 박제되는 셈이다.
  - 제안: `14_09_31/RESOLUTION.md:15` 행에 각주(예: "→ 14_32_02 에서 3/9 는 도달 불가 커밋
    산출물로 재정정, 산출물 유지·서술만 정정")를 붙이거나, 최소한 이번 changeset의 커밋
    메시지 중 하나에 "14_09_31/RESOLUTION.md 의 08_32_48 행은 14_32_02 로 대체됨" 을
    명시해 둔다. 아직 push 전이라 정정 비용이 가장 싸다 — 머지된 뒤에는 `12_48_08` 류의
    별도 정정 커밋이 필요해진다.

- **[INFO]** (재검증 결과 문제 없음 — 새 오귀속 없음) `08_32_48` 외 나머지 8개 회수 세션은
  전부 실제로 병합된 커밋과 대응하며, 그 대응이 파일명 나열이 아니라 **내용의 자연스러운
  진화**로 뒷받침된다.
  - 위치: `review/code/2026/08/10/{10_54_59,11_08_01,11_15_05,11_44_32}/meta.json`,
    `review/consistency/2026/08/10/{10_35_05,10_36_44,12_06_35}/meta.json`
  - 상세: `10_54_59`→`11_08_01`→`11_15_05`→`11_44_32` 순서로 대상 파일 목록을 비교하면
    `shared.test.ts`가 `11_08_01`(부재)과 `11_15_05`(존재) 사이에 새로 등장한다 — 이는
    `10_54_59/architecture.md`가 낸 WARNING("공유 파서의 유일한 회귀 테스트가 소유 모듈이
    아니라 소비자 테스트에만 있다")과 정확히 맞물리는 자연스러운 개발 흐름이다(지적 →
    보강 → 다음 라운드에 반영). `11_44_32/meta.json`은 그 사이에 생긴
    `review/code/2026/08/10/11_22_14/*`(같은 작업의 또 다른 라운드 산출물)를 새 파일로 함께
    review 대상에 포함하는데, 그 `11_22_14` 디렉터리 자체가 실제로 `eeb194b6a`(#1126,
    `origin/main` 조상 확인됨)의 diffstat 안에 그대로 들어 있다(`git show --stat eeb194b6a`로
    확인 — `_shared.ts`·`internal-package-registration-guard.ts`·
    `internal-package-registration.test.ts`·`shared.test.ts`·`typescript-toolchain-guard.ts`·
    `typescript-toolchain.test.ts`·`typescript-toolchain-followups.md`·
    `review/code/2026/08/10/11_22_14/**` 전부 포함). 즉 `10_54_59`~`11_44_32`는 같은 PR의
    서로 다른 시점 리뷰 라운드이지 다른 작업의 산출물이 아니다 — `62084e807`처럼 "다른
    구현으로 대체"된 게 아니라 "같은 구현이 다듬어지는" 정상적 반복이다. `10_35_05`·
    `10_36_44`(`target_path: spec/conventions/spec-impl-evidence.md`)는 `144d0de0a`(#1123)의
    diffstat에 그 경로가 있음을, `12_06_35`(`target_path: spec/7-channel-web-chat/2-sdk.md`)는
    `527865c08`(#1128)의 diffstat에 그 경로(23줄 변경)가 있음을 각각 확인했다. 두 커밋 모두
    `origin/main`의 조상이다. 새로운 오귀속은 발견되지 않았다.

- **[INFO]** (문제 없음) 실제 코드/문서/plan 9개 파일은 커밋 메시지가 서술한 두 결함(배치
  분할 거짓 PASS, router fail-closed 교차검사) + 그 뒤 두 리뷰 라운드(`14_09_31`,`14_32_02`)의
  fix 범위를 정확히 지킨다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`(`main()`의
    배치 루프 제거, `_warn_large_changeset`/`_bulleted_path_sample`/
    `_source_files_missing_from_changeset` 추가), `.claude/tests/test_line_anchors.py`
    (삭제-전용 커밋 가드 3변종), `.claude/tests/test_review_prepare_single_session.py`(신규,
    단일 세션·대형 changeset 안내·forced 집합 축소 회귀·fail-closed 교차검사 4클래스만),
    `plan/in-progress/harness-review-gate-followups.md`(체크박스 종결 + `[~]` 원문 보존),
    `.claude/skills/code-review-agents/{README,SKILL}.md`·`.claude/commands/ai-review.md`
    (배치 분할 폐지 반영), `.claude/skills/code-review-agents/lib/session.py`(주석만 —
    "배치 분할이 원인" → "이제 없다"로 정정, 측정 기록은 보존), `.claude/tests/README.md`
    (카탈로그 1줄 동반 갱신).
  - 상세: `git diff origin/main..HEAD`로 9개 파일 전체를 직접 재확인했다. `main()`의
    배치 루프 제거와 신규 헬퍼 3개는 각각 docstring이 스스로의 존재 이유(실측 수치 포함)를
    적고 있고, `_bulleted_path_sample` 추출은 같은 diff 안에서 두 번째 사용처가 생기며
    필요해진 것이라 드라이브바이 리팩터가 아니다. 신규 테스트 파일의 4개 클래스는 정확히
    그 4개 헬퍼/동작만 겨냥한다. import·설정 파일 변경, 무관한 파일 수정, 포맷팅 잡음은
    없다.

## 요약

오케스트레이터가 제시한 `08_32_48` 처분("산출물 유지 + 서술 정정")은 액면가가 아니라
`git cat-file`/`merge-base`/`show --stat`로 직접 재실측한 결과 **타당하다** — `62084e807`은
실제로 dangling 커밋이고, 그 작업(plan-link 게이트)은 `#1123`으로 재구조화되며 대체됐다.
나머지 8개 회수 세션(`10_54_59`~`11_44_32`→#1126, `10_35_05`·`10_36_44`→#1123, `12_06_35`
→#1128)도 각각 실제 병합 커밋의 diffstat과 직접 대조해 새로운 오귀속을 찾지 못했다 —
특히 `10_54_59`~`11_44_32`는 대상 파일 목록의 시간적 변화(`shared.test.ts` 추가 시점)가 그
사이 리뷰 지적과 정확히 맞물려, "같은 PR의 반복 라운드"라는 판정을 내용 수준에서 뒷받침한다.
다만 이 재검증 과정에서 **처분 자체와는 별개인** 잔여 문제를 하나 찾았다: 처분의 근거가 된
CRITICAL을 낳은 원본 진술(`14_09_31/RESOLUTION.md:15`의 "#1125 (머지) ✅" 표 행)이 이번
changeset에 **정정 없이 원문 그대로** 함께 실린다. 후속 라운드(`14_32_02`)가 그 오류를
문서화했지만 원본 표 자체에는 상호 참조가 없어, 같은 브랜치 안에서 "부분 확인 → 전체 확정"
패턴이 겉으로는 닫혔지만 감사 기록 표면에는 흔적 없이 남는다. 실제 하네스 코드 9개 파일은
서술된 두 결함(+ 두 차례 리뷰 fix)의 범위를 정확히 지키며, 드라이브바이 리팩터·무관 파일
수정·포맷팅 잡음·불필요한 임포트/설정 변경은 없다.

## 위험도

MEDIUM

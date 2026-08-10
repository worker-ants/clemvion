# 변경 범위(Scope) Review

## 조사 방법

이 changeset(`origin/main...HEAD`, 브랜치 `claude/harness-review-batch-false-pass`, 84개 파일)은
(a) 실제 하네스 코드/문서 7개 파일(파일 1~7) + plan 갱신 1개(파일 8) — 배치 분할 제거·router
fail-closed 교차검사 — 와 (b) `review/code/2026/08/10/{08_32_48,10_54_59,11_08_01,11_15_05,
11_44_32,14_09_31}/**` + `review/consistency/2026/08/10/{10_35_05,10_36_44,12_06_35}/**` (파일
9~84, "고아 리뷰 산출물 회수")로 구성된다.

오케스트레이터 요청대로 "남아 있는 회수분이 전부 실제로 머지된 PR 것인지"를 **직전 라운드의
판정을 액면가로 받지 않고** 각 세션 `meta.json`의 대상 파일 목록을 `git show --stat <머지
커밋 SHA>` 실측과 1:1 대조했다. 직전 스코프 라운드(`14_09_31`)와 그 RESOLUTION(같은 diff 안의
`review/code/2026/08/10/14_09_31/scope.md`, `RESOLUTION.md`)은 `08_32_48` 세션을 "`git_probe.py`·
`session.py`·`consistency_orchestrator.py` 등 → #1125 머지 확인"으로 정리했는데, "등" 이
가리키는 나머지 6개 파일 중 3개를 대조하지 않았다. 그 3개를 직접 대조한 결과가 아래 CRITICAL이다.

## 발견사항

- **[CRITICAL]** 회수 세션 `08_32_48` 의 대상 파일 9개 중 3개는 병합된 PR 이 아니라 **지금도
  main 어디에도 없는, 도달 불가능한(dangling) 커밋**의 것이다 — "전부 이미 머지된 PR
  (#1125~#1129)" 라는 커밋 서술이 이 세션에 대해서도 부분적으로 거짓이며, 그 오류가 이번
  diff 안에서 두 차례(스코프 리뷰·RESOLUTION) 그대로 통과했다.
  - 위치: `review/code/2026/08/10/08_32_48/meta.json:35`(`plan-link-integrity.test.ts`),
    `:40`(`spec-links.ts`), `:45`(`spec-plan-completion.test.ts`) — 세 `file_path` 항목.
    `review/code/2026/08/10/08_32_48/scope.md:10`(`` `62084e807` feat(harness): plan
    라이프사이클 게이트 2종 — 완료 plan 의 미완 status + plan 내부 링크 무결성 ``) 도 같은
    커밋을 리뷰 범위로 명시. `review/code/2026/08/10/14_09_31/RESOLUTION.md:15`(테이블 행
    `` | `08_32_48` | `git_probe.py`·`session.py`·`consistency_orchestrator.py` | #1125
    (머지) ✅ | ``)에 이 세 파일이 아예 빠져 있다.
  - 상세: 실측 — `git cat-file -t 62084e807` → `commit` (객체는 존재), `git branch -a
    --contains 62084e807` → 무출력(로컬·원격 어느 ref 에서도 도달 불가), `git merge-base
    --is-ancestor 62084e807 origin/main` → 아닌 것으로 종료(exit 1). 즉 이 커밋은 **어느 브랜치
    tip 에도 붙어 있지 않은 고아 커밋**이다. `git show --stat 62084e807` 로 실제 diff 를
    확인하면 정확히 `plan-link-integrity.test.ts`(신규 150줄) · `spec-links.ts`(+43줄) ·
    `spec-plan-completion.test.ts`(+96줄) 를 건드린다 — `08_32_48` 이 리뷰한 그 세 파일과
    일치한다. `git ls-tree origin/main -- codebase/frontend/src/lib/docs/__tests__/
    plan-link-integrity.test.ts` 는 빈 결과이고(파일 자체가 origin/main 에 없음),
    `git show origin/main:.../spec-plan-completion.test.ts | grep claimsUnfinished` 도
    0건이다(`08_32_48` 리뷰가 다루는 `claimsUnfinished` 함수가 main 에 없음). `spec-links.ts`
    는 origin/main 에 존재하지만 plan 링크 검사 부분의 현재 구현은 별도 모듈
    `plan-scan.ts`(`collectLivePlanMarkdown`)에 위임하는 형태로, `08_32_48/architecture.md`
    가 지목한 자체 `collectPlanMarkdown`(파일 내부 268행)과 구조가 다르다 — 리뷰된 버전과
    현재 main 버전이 다른 계통이다.
    반면 같은 세션의 나머지 6개 파일(`git_probe.py`·`session.py`·`consistency_orchestrator.py`·
    `test_consistency_bundle_priority.py`·`test_consistency_context_budget.py`·
    `test_review_session_dir_collision.py`)은 실제로 `c9e0e2ff7`(#1125, origin/main 조상
    확인됨)의 squash 본문에 포함된 하위 커밋 3개(`fix(harness): consistency 번들 …`,
    `fix(harness): 편집 중(미커밋) 문서가 …`, `fix(harness): 같은 초에 생긴 세션 두 개가 …`)
    와 diffstat·함수명·라인 수까지 정확히 일치해 정당한 회수다. 즉 **한 세션 안에서 6개는
    합법, 3개는 다른(그리고 아직 아무 데도 병합되지 않은) 작업의 산출물**이 섞여 있다.
    이는 직전 라운드에서 이미 발견·수정된 `12_48_08`(#1130 미머지 건)과 **같은 결함 클래스**이고,
    같은 클래스가 스코프 리뷰(`14_09_31/scope.md`)와 RESOLUTION(`14_09_31/RESOLUTION.md`) 두
    단계를 모두 통과해 이번 커밋 이력에 남았다 — 두 곳 다 세션의 대상 파일을 "등" 으로 줄여
    9개 중 3개를 아예 대조하지 않았기 때문이다. `12_48_08` 때와 동일한 위험(다른 브랜치가
    아직 확정하지 않은 코드에 대해 "이미 검토·기록됨"이라는 확신을 주는 감사 기록 오염)이
    그대로 적용된다 — 특히 이 3개 파일이 속한 "plan 라이프사이클 게이트 2종" 작업은 지금도
    이 물리 워크트리를 공유하는 다른 세션(`claude/spec-small-followups`)에서 계속 리베이스·
    수정되고 있어(동일 메시지의 커밋들이 이미 다른 SHA로 재작성됨), 나중에 그 작업이 실제로
    병합될 때 파일 구조·함수명이 지금 리뷰 기록과 달라질 가능성이 이미 관측됐다
    (`collectPlanMarkdown` vs `plan-scan.ts` 위임 구조).
  - 제안: `review/code/2026/08/10/08_32_48/*` 전체(또는 최소한 그 세션이 담은 감사 기록)에서
    `plan-link-integrity.test.ts`·`spec-links.ts`·`spec-plan-completion.test.ts` 에 관한 서술을
    분리한다 — 세션 하나가 여러 md 파일에 걸쳐 통합 서술을 하고 있어 파일 단위 분리가 어렵다면,
    가장 실용적인 조치는 `12_48_08` 때와 동일하게 이 세션 전체를 이번 커밋에서 제외하고
    "plan 라이프사이클 게이트 2종" 작업 자신의 PR 이 병합될 때 자기 산출물을 커밋하도록 남기는
    것이다(6개 파일의 정당한 audit trail 은 `10_54_59`~`11_44_32`·`10_35_05`·`10_36_44`·
    `12_06_35` 만으로도 #1125/#1126/#1123/#1128 계열은 이미 충분히 남아 있어, 손실이 크지
    않다). 아울러 커밋 메시지·RESOLUTION 의 "전부 검증했다" 는 문구를 "9개 중 6개만
    확인했다"로 정정해 이후 라운드가 같은 지점을 또 건너뛰지 않게 한다.

- **[INFO]** (재검증 결과 문제 없음) 나머지 8개 회수 세션은 실제로 병합된 PR 과 파일 단위로
  정확히 대응한다 — 직전 라운드가 이미 이렇게 판정했던 6개(`10_54_59`·`11_08_01`·`11_15_05`·
  `11_44_32` → #1126 `eeb194b6a`; `10_35_05`·`10_36_44` → #1123 `144d0de0a`; `12_06_35` →
  #1128 `527865c08`)를 이번에도 `git show --stat <SHA>` 로 재확인했다.
  - 위치: `review/code/2026/08/10/{10_54_59,11_08_01,11_15_05,11_44_32}/meta.json`,
    `review/consistency/2026/08/10/{10_35_05,10_36_44,12_06_35}/meta.json`
  - 상세: `eeb194b6a`(origin/main 조상 확인됨) 의 diffstat 이 `_shared.ts`·
    `internal-package-registration-guard.ts`·`internal-package-registration.test.ts`·
    `shared.test.ts`·`typescript-toolchain-guard.ts`·`typescript-toolchain.test.ts`·
    `plan/in-progress/typescript-toolchain-followups.md` 를 정확히(라인 수까지) 포함한다.
    `spec/conventions/spec-impl-evidence.md` 를 마지막으로 건드린 커밋은 `144d0de0a`(#1123,
    origin/main 조상 확인됨)이고, `spec/7-channel-web-chat/2-sdk.md` 를 마지막으로 건드린
    커밋은 `527865c08`(#1128, origin/main 조상 확인됨)이다. 직전 라운드가 "#1125~#1129
    어디에도 없다"며 WARNING 을 냈던 `10_35_05`·`10_36_44` 는 애초에 #1123 것이라 그 PR
    범위(#1125~#1129) 밖을 봤을 뿐 — 오케스트레이터 메모가 지적한 대로 그 WARNING 은
    기각한다.
  - 세션 `14_09_31`(파일 57~67)은 이번 브랜치 **자신의** 리뷰 라운드(배치 분할 제거) 산출물이며
    회수 대상이 아니라 이번 작업 결과물 그 자체다 — CLAUDE.md 관례(구현 완료 후 리뷰 audit
    trail 보존)와 부합해 스코프 이탈이 아니다.

- **[INFO]** (문제 없음) 파일 1~8(실제 하네스 코드/문서/plan)은 커밋 메시지가 서술한 두 결함
  범위를 정확히 지킨다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 전체 diff,
    `.claude/tests/test_line_anchors.py:107-119`, `.claude/tests/test_review_prepare_single_session.py`,
    `.claude/tests/README.md`, `.claude/commands/ai-review.md:14`,
    `.claude/skills/code-review-agents/{README,SKILL}.md`
  - 상세: `code_review_orchestrator.py` 의 신규 함수(`_warn_large_changeset`,
    `_bulleted_path_sample`, `_source_files_missing_from_changeset`)는 각각 docstring 이
    스스로의 존재 이유를 서술하고, `main()` 배선(배치 루프 제거 → 단일 `prepare_session`
    호출)과 정확히 짝을 이룬다. `_bulleted_path_sample` 추출은 기존 20개-표시 로직의 중복
    제거(드라이브바이가 아니라 같은 diff 안에서 두 번째 사용처가 생기며 발생한 필요한 DRY)로,
    스코프 안에서 정당화된다. `test_line_anchors.py` 의 삭제-전용 커밋 가드 추가는 `dc7bef76a`
    (`e4ce8adf8` 이후엔 `b35bd23ca`) 를 골라야 하는 픽스처 결함을 좁게 겨눈다. import·설정
    파일 변경, 무관한 리팩터, 포맷팅 잡음은 없다.

## 요약

실제 코드/문서 변경(파일 1~8)은 서술된 두 결함(배치 분할 거짓 PASS, router fail-closed
교차검사) 범위를 정확히 지킨다. 문제는 "고아 리뷰 산출물 회수" 로 커밋된 74개 파일 중
`08_32_48` 세션이다 — 오케스트레이터가 지시한 대로 액면가를 거부하고 재검증한 결과, 이 세션의
9개 대상 파일 중 6개(`git_probe.py`·`session.py`·`consistency_orchestrator.py`와 짝 테스트
3개)는 실제로 병합된 #1125 squash 안에 있어 정당하지만, 나머지 3개(`plan-link-integrity.test.ts`·
`spec-links.ts`·`spec-plan-completion.test.ts`)는 **origin/main 어느 커밋의 조상도 아닌 고아
커밋(`62084e807`)** 의 산출물이다 — 지금 이 물리 워크트리를 공유하는 다른 미완료 작업("plan
라이프사이클 게이트 2종")의 것이며, 그 작업은 계속 리베이스되고 있다. 이는 직전 라운드에
발견·수정된 `12_48_08`/#1130 건과 정확히 같은 결함 클래스이고, 그 라운드의 스코프 리뷰와
RESOLUTION 양쪽 모두 이 세션의 대상 파일을 "등" 으로 축약해 9개 중 3개를 대조하지 않은 채
통과시켰다 — 같은 실수가 두 검증 단계를 그대로 통과해 지금 이 diff 에 남아 있다. 반면
오케스트레이터가 제시한 다른 정정("10_35_05·10_36_44 는 #1123 것, 12_06_35 는 #1128 것")은
실측으로 확인되며, 직전 라운드의 해당 WARNING 은 기각해도 된다.

## 위험도

CRITICAL

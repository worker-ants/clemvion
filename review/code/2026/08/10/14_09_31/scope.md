# 변경 범위(Scope) Review

## 조사 방법

프롬프트가 `review/**` 대부분 파일에서 diff 를 생략했고("프롬프트 크기 제한으로 diff 생략"),
81개 파일 중 74개가 `review/**` 산출물이라는 orchestrator 주석이 있어, `git status`/`git log`/
`git show` 로 실제 changeset(`origin/main..HEAD`, 3개 커밋: `193d43fc5`·`50d877bd9`·`b35bd23ca`)
을 직접 확인했다. orchestrator 가 명시적으로 요청한 "고아 리뷰 산출물 회수 구성이 정당한지"를
판정하기 위해 각 회수 세션 디렉터리의 `meta.json`(대상 파일 목록)을 실제로 병합된 PR
#1125~#1129 의 `git show --stat` 결과와 대조했다.

## 발견사항

- **[CRITICAL]** "고아 리뷰 산출물 회수" 라는 커밋 서술이 최소 1개 세션에 대해 사실과 다르다 —
  그 세션은 이미 병합된 PR 이 아니라 **다른 worktree 에서 여전히 진행 중인 별개 작업**의
  미착륙 산출물이다.
  - 위치: `review/code/2026/08/10/12_48_08/*` (커밋 `b35bd23ca` 로 신규 추가된 9개 파일:
    `_retry_state.json`, `documentation.md`, `maintainability.md`, `meta.json`, `requirement.md`,
    `scope.md`, `security.md`, `side_effect.md`, `testing.md`)
  - 상세: `b35bd23ca` 의 커밋 본문은 "`review/code/2026/08/10/{08_32_48,10_54_59,11_08_01,
    11_15_05,11_44_32,12_48_08}` … **전부 이미 머지된 PR(#1125~#1129)의 라운드 산출물**"이라고
    적는다. 그런데 `12_48_08/meta.json` 이 지목하는 리뷰 대상은
    `codebase/channel-web-chat/src/widget/use-widget.ts`(`StreamClaim` 명명 union 반환 타입
    승격 리팩터)와 `plan/in-progress/webchat-usewidget-extraction.md` 다. 확인 결과:
    1. 현재 트리의 `codebase/channel-web-chat/src/widget/use-widget.ts` 에는 `StreamClaim` 문자열이
       전혀 없다(`grep` 0건) — 이 세션이 리뷰한 코드 변경 자체가 `origin/main`은 물론
       이 브랜치 어디에도 존재하지 않는다.
    2. `12_48_08/scope.md` 는 "`plan/in-progress/webchat-usewidget-extraction.md` 의 미완료(`[ ]`)
       체크리스트 항목 1개를 완료(`[x]`)로 바꾸며 … 기록"했다고 서술하지만, 현재 트리의
       `plan/in-progress/webchat-usewidget-extraction.md:60` 은 여전히 `- [ ] **seed 게이트 +
       openStream 게이트 짝의 구조적 강제 검토**` 로 **미완료** 상태다 — 리뷰가 기술하는 변경이
       실제로 반영된 적이 없다.
    3. 같은 plan 파일 frontmatter(`:2`)의 `worktree: webchat-session-generations-ca88ae`,
       `:5`의 `status: in-progress` 는 이 작업이 **지금도 다른 worktree 에서 진행 중**임을
       명시한다. 즉 "이미 머지된 PR" 이 아니라, 다른 세션이 아직 커밋하지 않은 작업 결과물이
       회수 대상 목록에 잘못 포함됐다.
  - 이 세션이 리뷰한 코드는 이 저장소 어디에도 없는데, 그 세션의 `documentation.md`/`scope.md`
    는 "WARNING 반영 완료"·"[x] 전환"처럼 이미 처리된 것처럼 서술한다. 이 상태로 `main` 에
    올라가면, 이후 그 감사 기록을 읽는 사람이 `use-widget.ts` 의 `StreamClaim` 리팩터가 이미
    검토·반영됐다고 오판할 근거를 갖게 되고, 정작 그 작업을 실제로 진행 중인 다른 worktree
    가 나중에 같은 코드를 커밋하면 자신의 리뷰 세션(`12_48_08`)이 이미 `main` 에 이름이
    선점된 상태로 마주치게 된다.
  - 제안: `review/code/2026/08/10/12_48_08/*` 9개 파일을 이번 커밋에서 제외한다(`webchat-usewidget-extraction`
    작업이 실제로 완료·커밋될 때 그 작업 자신의 PR 이 자기 산출물을 커밋하도록 남겨 둔다).
    커밋 메시지의 "전부 #1125~#1129" 단정도 재검증 후 정정한다.

- **[WARNING]** 동일한 근거 불일치가 `review/consistency/**` 회수분 2개 세션에도 있다 —
  대상 spec 파일이 #1125~#1129 어느 diff 에도 없다.
  - 위치: `review/consistency/2026/08/10/10_35_05/meta.json`, `review/consistency/2026/08/10/10_36_44/meta.json`
    (둘 다 `"target_path": "spec/conventions/spec-impl-evidence.md"`)
  - 상세: `git log -- spec/conventions/spec-impl-evidence.md` 로 확인한 결과 이 파일을 마지막으로
    건드린 커밋은 `144d0de0a`(#1123)이고, #1125(`c9e0e2ff7`)·#1126(`eeb194b6a`)·#1127(`888e28b53`)·
    #1128(`527865c08`)·#1129(`813984897`) 어느 diffstat 에도 `spec/conventions/spec-impl-evidence.md`
    가 없다. 이 두 세션의 실제 출처(어느 작업의 것인지)가 커밋 메시지의 서술만으로는 확인되지
    않는다 — "전부 #1125~#1129" 라는 단정과 모순되는 두 번째 사례다.
  - 제안: 이 두 세션의 실제 출처를 확인한 뒤, 정말 무해한 회수라면 근거를 커밋 메시지에
    정확히 남기고, 확인이 안 되면(위 CRITICAL 항목과 동일한 패턴일 가능성) 함께 보류한다.

- **[INFO]** (문제 없음으로 확인) `08_32_48`·`10_54_59`·`11_08_01`·`11_15_05`·`11_44_32`·
  `12_06_35` 세션은 실제로 병합된 PR 과 대응된다.
  - 위치: `review/code/2026/08/10/08_32_48/meta.json`(대상: `git_probe.py`/`session.py`/
    `consistency_orchestrator.py` 등, PR #1125 `c9e0e2ff7` diffstat 과 일치),
    `review/code/2026/08/10/{10_54_59,11_08_01,11_15_05,11_44_32}/meta.json`(대상:
    `_shared.ts`/`internal-package-registration-guard.ts`/`typescript-toolchain-guard.ts` 등,
    PR #1126 `eeb194b6a` diffstat 과 일치), `review/consistency/2026/08/10/12_06_35/meta.json`
    (대상: `spec/7-channel-web-chat/2-sdk.md`, PR #1128 `527865c08` diffstat 과 일치).
  - 상세: 이 6개 세션은 커밋 메시지의 "이미 머지된 PR 의 라운드 산출물" 서술과 실제로
    부합한다 — 병합 전 feature 브랜치에서 반복 실행된 `/ai-review`·`/consistency-check` 산출물이
    PR 이 squash-merge 되며 함께 커밋되지 못하고 untracked 로 남았다가 지금 회수되는
    정상적인 하우스키핑으로 보인다. `review/**` 가 gitignore 대상이 아니고 CLAUDE.md 가
    저장 위치를 규약화한 점(SoT), 방치하면 `git status` 가 매번 "미완 작업"으로 오독된다는
    점도 회수 자체의 근거로 타당하다.

- **[WARNING]** 근거가 맞는 6개 세션조차, "이번 PR 자신의 plan 체크리스트 종결"(§배치 거짓
  PASS·§router fail-closed)과 하나의 커밋(`b35bd23ca`)에 섞였다.
  - 위치: `b35bd23ca` 전체 diff (`plan/in-progress/harness-review-gate-followups.md` 49줄 + 회수
    파일들)
  - 상세: 커밋 메시지 자체가 "본 PR 의 코드 변경과는 무관하다"고 명시하고(직전 티켓의 scope
    reviewer 지적을 인지하고 있음도 밝힘) 순수 추가(new file)뿐이라 병합 충돌·런타임 위험은
    없지만, 서로 다른 3개 이상의 완전히 무관한 작업 스트림(consistency 번들 하네스 수정
    #1125, repo-guards 리팩터 #1126, 웹채팅 spec 정정 #1128)의 감사 기록을 이번 PR 고유의
    plan 종결과 한 커밋에 묶은 것은, 위 CRITICAL 항목이 보여주듯 "정당한 회수"와 "출처 미확인·
    미착륙 작업 혼입"을 가르는 검증을 어렵게 만든다. 별도 커밋(`chore(review): PR #1125/#1126/#1128
    고아 산출물 회수`)으로 쪼갰다면 이번 CRITICAL/WARNING 이 그 커밋 하나로 좁혀져 검증·되돌리기가
    쉬웠을 것이다.
  - 제안: 향후 유사 회수 시 (a) 출처를 세션별로 실측 검증한 뒤 (b) 현재 PR 고유 변경과 분리된
    커밋으로 넣는다.

## 실제 코드/문서 diff(파일 1~7, non-review) 자체는 스코프 이탈 없음

`.claude/commands/ai-review.md`·`README.md`·`SKILL.md`·`code_review_orchestrator.py`·
`.claude/tests/README.md`·`test_review_prepare_single_session.py`·
`plan/in-progress/harness-review-gate-followups.md` 7개 파일을 커밋 `193d43fc5`/`50d877bd9`
단위로 직접 대조했다. `code_review_orchestrator.py` 의 함수 추가(`_warn_large_changeset`,
`_source_files_missing_from_changeset`)와 호출부 배선은 각 커밋 메시지가 서술한 결함(배치
분할이 만드는 거짓 PASS, changeset 오산정이 "문서 전용"으로 세탁되는 증폭 구조)에 정확히
대응하며, 신규 테스트 클래스(`PrepareEmitsExactlyOneSessionTest`, `LargeChangesetIsAnnouncedTest`,
`ForcedSetShrinksWithTheChangesetTest`, `DocsOnlyFramingIsCrossCheckedTest`)도 그 두 결함만
겨눈다. import·설정 파일 변경, 무관한 리팩터, 포맷팅 잡음은 없다.

## 요약

7개 실제 코드/문서 파일은 커밋 메시지가 서술한 두 결함(배치 분할 거짓 PASS, router fail-closed
교차검사) 범위를 정확히 지킨다. 문제는 나머지 74개 `review/**` 회수 파일의 구성이다.
orchestrator 가 요청한 정당성 판정에 대한 답은 **"부분적으로만 정당하다"**다 — 6개 세션(약
65개 파일)은 실제로 병합된 PR #1125/#1126/#1128 의 감사 기록과 대상 파일이 일치해 정상적인
회수로 보이지만, `review/code/2026/08/10/12_48_08/*`(9개 파일)는 **다른 worktree
(`webchat-session-generations-ca88ae`)에서 아직 진행 중인 별개 작업**의 미착륙 리뷰 산출물이고
— 그 세션이 리뷰한 `StreamClaim` 코드 변경도, "체크리스트 `[x]` 전환"도 현재 트리에 존재하지
않는다 — "전부 이미 머지된 PR" 이라는 커밋 서술과 정면으로 모순된다. `review/consistency/2026/08/10/
{10_35_05,10_36_44}/*` 도 대상 spec 파일이 #1125~#1129 어느 diff 에도 없어 같은 의심을 받는다.
이는 단순한 "무관한 파일 섞임" 수준을 넘어 — 다른 활성 worktree 의 미완료 작업 산출물이 이
브랜치의 커밋 이력에 "이미 검토·반영된 것"처럼 잘못 각인되는 감사 기록 오염 문제다.

## 위험도

HIGH

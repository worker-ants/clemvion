# 문서화(Documentation) Review 결과

본 리뷰는 요청에 따라 `plan/complete/consistency-named-in-substring-match.md`(파일 3)에 적힌
**수치·서술을 실측으로 검증**하는 데 집중했다. 아래 "검증 결과" 절에 6개 항목 각각의 검증
결과를 먼저 정리하고, 그중 실제 오류로 확정된 것을 발견사항으로 올린다.

## 검증 결과 (요청받은 6개 항목)

1. **R1/R2 표(hunk 57/0, diff 25,066/31,525자, 헤드 39,768/87,953자, 청크 2/4)** — **정확**.
   `/Volumes/project/private/clemvion/.claude/worktrees/stop-editor-403-docs/review/consistency/2026/08/11/{17_21_43,17_42_52}/_prompts/cross_spec.md` 를 직접 파싱해 재계산했다.
   - R1: `@@ ` hunk 57개, diff 본문(펜스 안) 25,066자, diff 앞 청크 2개 — 정확히 일치.
   - R2: diff는 스텁("본문 생략됨 — 컨텍스트 예산 초과 (원래 **31,525** 자)")으로 대체돼 있고 hunk 0개, diff 앞 청크 4개 — 정확히 일치.
   - "헤드 39,768자 / 87,953자"만 내 재계산치(39,745 / 87,930)와 **정확히 23자씩** 차이난다. 23은
     파일 경계 sentinel(`\n<!-- @bundle-file -->\n`)의 길이와 정확히 같다 — 즉 plan 저자는 diff
     청크를 여는 sentinel까지 "헤드"에 포함해 셌고, 나는 그 직전까지만 셌다는 **정의상의 차이**이지
     오류가 아니다(두 행 모두 같은 방향·같은 크기로 어긋나 내적으로 일관됨).
2. **두 청크 크기(`secret-store.md` 17,616 · `cafe24-api-catalog/store.md` 30,559)** — **정확**.
   R2 dump에서 두 파일 모두 헤더+펜스+본문 포함 청크 길이가 각각 정확히 17,616자·30,559자였고,
   R1 dump에서는 둘 다 스텁(드롭됨) 상태였다 — "R2에만 새로 들어왔다"는 서술과 일치.
3. **"라운드 사이 편집은 하니스 plan 하나"** — **부정확 (아래 발견사항 참조)**.
4. **인용한 옛 주석 원문("cannot reach the prefix unless the branch edited it")** — **정확**.
   `git show dfe4f4319^:.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
   로 수정 전 blob을 직접 열어 대조 — 인용구가 글자 그대로 일치한다.
5. **뮤테이션 결과표(2건/4건)와 최종 테스트 수** —
   - plan 본문이 실제로 주장하는 수치("66 passed / 33 subtests", 대상 3개 테스트 파일)는
     **정확**하다. `git show HEAD:.claude/tests/test_consistency_{bundle_priority,context_budget,impl_done}.py`
     (커밋된 blob)로 정적 카운트: `def test_` 35+29+2=**66**, `subTest` 동적 반복 수
     4(언급 형태)+3(budget)+3(unread key)+5(checker)+18(`spec/2-navigation/*.md` 개수)=**33**.
     둘 다 정확히 맞아떨어진다.
   - "1067 passed / 1137 subtests, plan 라이프사이클 게이트 963 passed"는 **plan 문서 본문에는
     없고 커밋 메시지(`dfe4f4319`)에만 있다.** 이 세션에서 재현을 시도했으나, 이 worktree에
     **현재 진행 중인 별개의 미커밋 편집**(`test_consistency_bundle_priority.py`가 HEAD 대비
     +53줄 — per-character 경계 테스트 추가 작업으로 보임, 이 리뷰 대상 diff와 무관)이 살아
     있어 전체 스위트 재실행 결과가 실행마다 요동쳤다(1063~1071 tests, 간헐적 2건 실패).
     따라서 이 두 수치는 **이번 세션에서 독립 재검증하지 못했다** — 오류라는 근거는 없지만
     확인됐다고도 말할 수 없다.
   - 뮤테이션 표(경계 제거→2건 RED, 과잉 조임→4건 RED)는 실제로 뮤테이션을 실행해보진
     않았으나(테스트 관점 리뷰의 영역), 테스트 코드 구조와 정합적이다: 2건=
     `test_longer_name_does_not_promote_the_shorter_one` + `test_extension_suffix_does_not_count`,
     4건=`test_basename_mention_is_enough`(기존) + `test_mention_forms_that_must_still_count`의
     backticked/문장끝 subTest 2개 + `ThisBranchsPlanOutranksEveryOtherPlanTest`의 브랜치-plan
     티어 테스트. 문서화 관점에서 반증 근거 없음.
6. **plan frontmatter의 Gate C 충족 여부(`spec_impact: none`)** — **충족**.
   `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`의
   `NONE_VALUES = new Set(["none", "없음", "n/a", "na"])`와
   `spec-plan-completion.test.ts`의 "string `spec_impact` is an explicit no-op assertion"
   (`NONE_VALUES.has(impact.trim().toLowerCase())`)이 `spec_impact: none`을 명시적으로 유효한
   무영향 선언으로 인정한다(임의 문자열은 거부 — 예: `spec_impact: maybe`는 실패). `started:
   2026-08-11`은 `GATE_C_CUTOFF(2026-06-04)` 이후라 선언이 필수인 케이스인데, 이미 선언돼 있다.

## 발견사항

- **[WARNING]** "어떻게 드러났나" 절이 라운드 사이 편집 파일을 잘못 지목한다 — 실제로는
  이 PR 자신의 plan이 편집됐고, `harness-review-gate-followups.md`는 그보다 늦게(라운드 2
  **이후**) 내용을 이관받았다.
  - 위치: `plan/complete/consistency-named-in-substring-match.md:39-41`
    ("두 파일이 48,185자를 먹었고 31,525자 diff 가 밀려났다. 라운드 사이에 내가 편집한 것은
    `harness-review-gate-followups.md` 하나이고, 거기 적은 **가드 사각지대 사례 목록**이
    방아쇠였다.") — 동일 문장이 커밋 메시지 `dfe4f4319`에도 "라운드 사이 편집은 하니스 plan
    하나였고, 거기 적은 가드 사각지대 사례 목록이 방아쇠였다"로 그대로 들어가 있다.
  - 상세: git 이력으로 재구성한 타임라인은 다음과 같다(모두 `stop-editor-403-docs` 브랜치,
    커밋 SHA는 이 worktree의 공유 `.git`에서 직접 확인 가능):
    - R1 consistency 실행: `17:21:43`
    - 커밋 `165960a92`(`17:40:35`, **R1과 R2 사이**) — `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md`에 "## 후속" 절을 추가하며
      `conventions/secret-store.md`를 포함한 6개 파일 목록을 **처음으로** 적어 넣는다
      (diff: `+ \`7-channel-web-chat/4-security.md\` · \`conventions/secret-store.md\` · ...`).
      `harness-review-gate-followups.md`는 이 커밋에서 **전혀 건드리지 않았다**
      (`git show 165960a92 --stat`에 그 파일이 없음).
    - R2 consistency 실행: `17:42:52` — 이 시점에 `_rank_branch_plan_text`가 읽는 "이 브랜치가
      건드린 plan"에는 `spec-sync-stop-editor-and-forbidden-routes.md`(방금 커밋됨)가 들어가고,
      `harness-review-gate-followups.md`에는 `secret-store`/`store.md` 문자열이 **아직 전혀
      없다**(`git show 165960a92^` 및 `git show 7977f5c8:...harness-review-gate-followups.md`
      양쪽 다 grep 0건).
    - 커밋 `fdcb2a61a`(`17:58:34`, **R2 이후**) — 커밋 메시지 자체가 "plan_coherence — 가드
      사각지대는 하니스 소관이다 … 이관하면서 경고를 함께 옮겼다"라고 명시한다. 이 커밋에서야
      비로소 `harness-review-gate-followups.md`에 `secret-store.md` 목록이 **이관되어**
      들어간다.
    즉 R1→R2 사이의 실제 편집은 "하니스 plan 하나"가 아니라 **이 PR 자신의 plan**
    (`spec-sync-stop-editor-and-forbidden-routes.md`)이었고, `harness-review-gate-followups.md`는
    R2가 이미 끝난 **뒤에** 그 내용을 받았다 — R2의 `_named_in` 오매치를 유발할 수 있었을 리가
    없는 시점이다. 기술적 결론(`_named_in`이 경계 없이 부분 문자열로 매치해 `secret-store.md`
    사례가 `store.md`를 오매치시켰다는 것)은 이 오류와 무관하게 그대로 유효하지만("어떻게
    드러났나" 절의 원인 규명 자체는 옳다), **어느 문서가 방아쇠였는지**를 서술한 문장은 틀렸다.
    이 plan은 `plan/complete/`에 놓인 영구 기록이라, 나중에 같은 버그 클래스를 조사하는 사람이
    이 문장을 근거로 `harness-review-gate-followups.md`의 그 시점 이력을 찾으면 아무것도 나오지
    않아 헛수고를 하게 된다.
  - 제안: 해당 문장을 "라운드 사이에 내가 편집한 것은 이 PR 자신의 plan
    (`spec-sync-stop-editor-and-forbidden-routes.md`)의 '## 후속' 절 하나이고, 거기 적은
    가드 사각지대 사례 목록이 방아쇠였다. (그 항목은 R2 이후 소유권 정정으로
    `harness-review-gate-followups.md`로 다시 이관됐다.)"로 정정할 것을 권한다. 이미 완료/병합된
    커밋 메시지 자체는 고칠 수 없더라도, `plan/complete/` 문서는 아직 고칠 수 있는 유일한
    사본이다.

- **[INFO]** R1/R2 표의 "헤드" 글자수(39,768 / 87,953)는 "head + diff 이전 청크들"만 더한
  재계산치보다 정확히 23자(파일 경계 sentinel 길이)씩 크다 — 두 행 모두 같은 부호·같은 크기로
  어긋나므로 오류가 아니라 "헤드에 diff 청크를 여는 sentinel까지 포함해서 센다"는 정의 차이다.
  다만 이 정의가 본문 어디에도 명시돼 있지 않아, 나중에 누군가 스크립트로 재현을 시도하면
  23자 차이를 보고 "숫자가 틀렸다"고 오판할 수 있다.
  - 위치: `plan/complete/consistency-named-in-substring-match.md:30` (표의 "diff 앞 헤드" 행)
  - 제안: 필수는 아니지만, "헤드"의 경계 정의(diff 청크의 여는 sentinel 포함)를 각주로 한 줄
    남기면 재현성이 좋아진다.

- **[INFO]** "최종 테스트 수" 중 plan 본문에 실제로 적힌 "66 passed / 33 subtests"는 정확히
  검증됐지만, 검증 요청에 포함된 "1067/1137, 963"(커밋 메시지에만 있는 수치)은 이 세션에서
  독립 재검증하지 못했다 — 원인은 이 diff와 무관하게 같은 worktree에서 **현재 진행 중인 별개의
  미커밋 편집**(`test_consistency_bundle_priority.py`가 HEAD 대비 +53줄, per-character 경계
  테스트 추가 작업으로 보임)이다. 오류라는 증거는 없으며, 단지 "이번 라운드에서 확인 불가"임을
  기록해 둔다. (이 사실 자체는 문서화 결함이 아니라 리뷰 시점의 환경 노이즈다.)
  - 위치: 해당 없음(plan 본문에는 이 수치가 없다 — 커밋 메시지 `dfe4f4319`에만 존재)

## 그 외 문서화 관점 점검

- **독스트링/주석 정확성**: `consistency_orchestrator.py`의 새 주석(`_NAME_START`/`_NAME_END`
  위, `_named_in` docstring, `_n_on_topic` 정정 주석)은 모두 코드 동작과 일치하며, 어느 것도
  "어느 plan 파일이었는지"를 특정하지 않아(그냥 "a branch plan") 위 오류를 반복하지 않는다 —
  이 문제는 `plan/complete/` 문서에만 있다.
- **테스트 주석**: `test_consistency_bundle_priority.py`의 새 주석(96-103행, R2 세션 경로 인용
  등)도 마찬가지로 "a branch plan"이라고만 적어 안전하다.
- **README/API 문서/CHANGELOG/설정 문서/예제 코드**: 이번 변경은 내부 harness 스크립트의 버그
  수정 + 테스트 + 사후분석 plan 문서이며, 사용자 대면 API·설정·README 변경이 없다 — 해당 없음.

## 요약

핵심 기술 서술(경계 없는 부분 문자열 매치가 `secret-store.md` 사례를 통해
`cafe24-api-catalog/store.md`를 오매치시켰고, 그로 인해 코드 diff가 예산 밖으로 밀려났다는
인과관계, R1/R2 수치, 두 파일 크기, 인용된 옛 주석, `spec_impact: none`의 Gate C 적합성)는
전부 실측으로 확인됐다. 다만 "어떻게 드러났나" 절의 한 문장 — 라운드 사이에 편집된 파일이
`harness-review-gate-followups.md`라는 서술 — 은 git 이력과 어긋난다: 실제로는 이 PR 자신의
plan(`spec-sync-stop-editor-and-forbidden-routes.md`)이 편집됐고, `harness-review-gate-followups.md`는
라운드 2가 끝난 뒤에야 그 내용을 이관받았다. `plan/complete/`는 영구 기록이므로 이 오류는
정정할 가치가 있다. 그 외에는 사소한 정의상 차이(헤드 글자수 +23)와, 이번 세션 환경 노이즈로
재검증하지 못한 커밋 메시지 수치(1067/1137, 963) 정도만 남는다.

## 위험도

LOW

STATUS: OK

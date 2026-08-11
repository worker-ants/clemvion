# 요구사항(Requirement) 리뷰

## 조사 방법 및 스코프 확정

`_prompts/requirement.md` 는 81개 파일을 열거하지만, 실제로 검토할 "코드 변경"은
파일 1~7(`.claude/commands/ai-review.md`, `.claude/skills/code-review-agents/README.md`,
`.claude/skills/code-review-agents/SKILL.md`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/tests/README.md`, `.claude/tests/test_review_prepare_single_session.py`,
`plan/in-progress/harness-review-gate-followups.md`)뿐이다. 이 7개는 커밋
`193d43fc5`(배치 분할 제거) + `50d877bd9`(router fail-closed 교차검사)로 이미 커밋된
상태이며 오케스트레이터 호출자가 준 과제 설명("--prepare 의 배치 분할 제거 + router
fail-closed 교차검사, 근거는 harness-review-gate-followups.md")과 정확히 일치한다.

파일 8~81(`review/code/2026/08/10/{08_32_48,10_54_59,11_08_01,11_15_05,11_44_32,
12_48_08}/**`, `review/consistency/2026/08/10/{10_35_05,10_36_44,12_06_35}/**`)은
같은 워크트리에서 오늘 실행된 **이전 리뷰/일관성 검사 세션들의 산출 리포트**(untracked)로,
`git status` 상 `?? review/code/2026/08/10/` 로 잡혀 이번 changeset 스캔에 함께 쓸려
들어온 것으로 보인다. 이들은 정적 markdown/json 리포트일 뿐 "의도한 기능"을 구현하는
코드가 아니어서 요구사항 충족 관점에서 평가할 대상이 없다(스코프 이상 자체는
scope reviewer 소관). 아래 발견사항은 파일 1~7에 한정한다.

## 검증 내역

- `code_review_orchestrator.py::main()`: 기존 `REVIEW_BATCH_SIZE` 단위 배치 루프
  (`--- Batch N/M ---` 헤더 + 배치별 `prepare_session()` 호출 + 배치별 stdout 한 줄씩)를
  제거하고, `_warn_large_changeset()` 로 임계 초과만 stderr 안내한 뒤
  `prepare_session(change_infos, config)` 를 **정확히 1회**, 전체 changeset 으로 호출하고
  세션 경로를 **정확히 한 줄** stdout 에 출력하도록 바뀌었음을 실제 소스에서 확인.
- `_warn_large_changeset`: `if batch_size and total > batch_size` — `batch_size=0` 이면
  무조건 침묵(경계값 처리), `total == batch_size` 는 안내하지 않음(`>` 이지 `>=` 아님,
  README/SKILL 표의 "이 수를 넘으면" 문구와 일치).
- `_source_files_missing_from_changeset`: `router_safety.source_files` (forced-agent
  규칙과 동일 확장자 분류기)를 재사용해 브랜치 diff 소스 파일과 changeset 소스 파일의
  차집합을 계산하고, `build_router_prompt_body` 의 "소스 코드 파일 0개(문서 전용)" 분기
  안에서만 router 프롬프트에 이름을 나열하는 경고 블록을 추가함을 확인. `_default_branch_ref`
  실패(`None`) 시 조기 반환, `get_git_branch_diff_files` 예외 시 흡수(`except Exception`) —
  "git 실패는 삼킨다"는 문서화된 계약과 일치. 실제로 `get_git_branch_diff_files` →
  `_shared/git_probe.branch_diff_files` 는 내부적으로 이미 모든 실패를 `[]` 로 흡수하므로,
  호출부의 추가 try/except 는 방어적 이중화이며 회귀 테스트
  (`test_git_failure_is_absorbed_not_propagated`, 헬퍼를 직접 예외로 monkey-patch)가 그
  이중화 자체를 검증한다.
- `.claude/tests/test_review_prepare_single_session.py` 17개 테스트를 로컬에서 직접 실행 —
  전부 통과(`Ran 17 tests ... OK`). 커밋 메시지가 주장하는 테스트 수(1차 커밋 10건 + 2차
  커밋 7건 = 17건)와 실제 테스트 메서드 수가 정확히 일치.
- `plan/in-progress/harness-review-gate-followups.md` 의 두 `[x]` 처분 항목(배치 분할 제거,
  router fail-closed 방어)이 서술하는 구현 내용·테스트 수·뮤테이션 결과가 실제 코드/테스트
  상태와 라인 단위로 일치 — plan 체크박스가 실제 상태를 정확히 반영.
- 문서 3종(`ai-review.md`, `code-review-agents/README.md`, `code-review-agents/SKILL.md`)의
  "stdout 마지막 줄 = 세션 디렉토리" / `REVIEW_BATCH_SIZE` 표 행 갱신이 실제 코드 동작과
  일치. 저장소 전체에서 "batch 별로 한 줄씩"/"one line per batch" 같은 옛 계약 문구가
  살아있는 채로 남은 곳은 없음(테스트 docstring 의 역사적 인용 제외).

## 발견사항

- **[INFO]** router fail-closed 교차검사는 changeset 이 소스 파일을 **0개로** 오판한
  경우(`build_router_prompt_body` 의 `else` 분기)에만 실행되고, 소스 파일을 **일부만**
  누락한 경우(예: 실제 5개 중 2개만 changeset 에 잡힌 경우)는 다루지 않는다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` —
    `build_router_prompt_body` 함수, `if src_paths: ... else: ... unseen = _source_files_missing_from_changeset(all_paths)` 분기 (헬퍼 정의는 `_source_files_missing_from_changeset`, 926번째 줄 부근)
  - 상세: plan 이 실측·처방한 실패 양태는 "changeset 이 소스 파일을 하나도 못 잡아 router 가
    `소스 코드 변경 없음(문서 전용)` 으로 확신해 12명을 skip" 하는 **증폭** 케이스이고, 구현은
    그 케이스를 정확히 겨냥한다. 일부만 누락되는 경우는 `src_paths` 가 비어 있지 않으므로
    router 는 이미 "문서 전용이 아님"을 사실로 통보받아 동일한 전원-skip 증폭이 원천적으로
    발생하지 않는다 — 즉 이 스코프 경계는 실제 위험도(증폭 여부)와 일치하는 의도적 설계로
    보이며, plan 문서·커밋 메시지도 "changeset 이 소스코드 변경 없음이라고 오판하는 경우"로
    명시적으로 범위를 좁혀 두었다. CRITICAL/WARNING 은 아니지만, 부분 누락으로 인한
    "일부 reviewer 가 실제로는 존재하는 파일을 못 보는" 잔여 위험은 여전히 남아 있고 (기존
    `warn_if_committed_work_is_missing` 이 커밋-직후 working-tree 공백 케이스는 별도로
    커버) 이 fail-closed 교차검사의 범위 밖이라는 점은 향후 백로그 판단을 위해 기록해 둘
    가치가 있다.
  - 제안: 코드/plan 수정 불필요. 다만 "부분 누락"이 실제로 관측되면 (plan §관측 이력의
    다른 항목처럼) 별도 실측 후 백로그 항목으로 다룰 것을 권장.

- **[INFO]** 리뷰 payload(파일 1~7 외 74개 파일)가 이번 changeset 스캔에 함께 포함되어
  있으나 전부 이전 리뷰/일관성 검사 세션의 생성물(markdown/json 리포트)이며, "이 변경이
  의도한 기능"(배치 분할 제거·router fail-closed 교차검사)과 무관하다.
  - 위치: `review/code/2026/08/10/{08_32_48,10_54_59,11_08_01,11_15_05,11_44_32,12_48_08}/**`,
    `review/consistency/2026/08/10/{10_35_05,10_36_44,12_06_35}/**`
  - 상세: 요구사항 관점에서 평가할 기능이 없어(정적 리포트) CRITICAL/WARNING 대상이
    아니며, 본 리뷰에서는 실질 분석 대상에서 제외했다. `review/` 가 gitignore 대상이 아니라는
    점(팀 컨벤션)과 결합해, 공유 워크트리에서 여러 세션이 동시에 작업할 때 changeset 산정이
    스테일 산출물을 함께 주울 수 있음을 시사하는 관측이다(이 자체가 바로 이번 변경이
    고치려는 "changeset 오판" 클래스의 인접 사례이기도 하다).
  - 제안: 조치 불요. 이번 태스크 완료 후 해당 워크트리에서 이 산출물들의 커밋/정리 여부는
    작업 소유 세션이 판단할 사항.

- **[INFO]** 변경 영역은 `spec/` 문서가 다루지 않는 개발 하네스(`.claude/`)다. governing
  문서는 `.claude/docs/subagent-call-contract.md` 와
  `plan/in-progress/harness-review-gate-followups.md` 이며, 후자와는 라인 단위로 대조를
  마쳤고 불일치 없음. `subagent-call-contract.md` 는 배치/세션 개수를 언급하지 않아
  갱신 대상이 아님을 확인.

## 요약

파일 1~7(실제 하네스 변경)은 plan 이 실측·처방한 두 결함 — (1) `--prepare` 의 배치 분할이
꼬리 배치를 디스크에서 조용히 소실시키고 `agents_forced` 를 축소시켜 거짓 PASS 를 냈던 문제,
(2) changeset 오산정이 router 에게 "문서 전용" 이라는 확신 있는 사실로 세탁되어 reviewer
전원 skip 으로 증폭되던 문제 — 를 코드·문서·plan 세 층위에서 정확히 1:1 로 구현했다.
`_warn_large_changeset`/`_source_files_missing_from_changeset` 의 경계값(임계값 0/등호,
git 실패 흡수, 조기 반환)을 소스에서 직접 확인했고, 신규 회귀 테스트 17건을 로컬에서
실행해 전부 통과함을 검증했으며, 커밋 메시지·plan 처분 서술의 테스트 개수·뮤테이션 결과
주장이 실제 상태와 일치함을 대조했다. TODO/FIXME 류 미완성 표시나 반환값 누락, 함수명·
docstring 과 구현의 괴리는 발견되지 않았다. 유일한 INFO 는 fail-closed 교차검사가 "소스
파일 0개로 오판" 케이스에만 좁게 스코프되어 있다는 점인데, 이는 plan 이 실측한 증폭
메커니즘과 정확히 일치하는 의도적 설계로 판단되며 결함으로 보지 않는다. 이번 changeset
스캔에 딸려온 74개 이전 리뷰 산출물은 기능 코드가 아니어서 평가 대상에서 제외했다.

## 위험도

NONE

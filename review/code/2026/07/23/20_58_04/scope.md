# 변경 범위(Scope) 리뷰

## 확인한 범위

`git diff --stat origin/main...HEAD` 로 실제 커밋 범위를 직접 대조했다. 대상은 4개 커밋
(`8ddf391d2` 원 수정 → `004d33ccb` §E 후속 기록 → `30877465b` 1R 리뷰 반영 → `37fcfc494` 2R 리뷰
반영)의 누적 diff이며, payload 32개 파일과 `--stat` 결과가 1:1 일치한다(추가/누락 없음).

## 발견사항

- **[INFO]** `test_line_anchors.py` 수정은 원 작업 주제(bash 넛지 세그먼트 FN)와 다른 서브시스템(리뷰
  프롬프트 line-gutter 조립 테스트)에 대한 변경이다
  - 위치: `.claude/tests/test_line_anchors.py` (`_pick_commit_fixture` 신설 + `_prepare_commit()` 결속 제거, 커밋 `37fcfc494`)
  - 상세: 이번 PR 의 표제 작업은 `guard_default_branch_bash.py::_is_mutating` 의 세그먼트 분류다. 그런데
    이 PR 자신의 커밋 시퀀스(마지막 커밋이 7줄짜리 plan 문서 갱신)가 `test_diff_blocks_are_annotated_and_correct`
    를 `--commit HEAD` 크기에 결속시켜 RED 로 만들었고, RESOLUTION.md(`review/code/2026/07/23/20_33_56/RESOLUTION.md`
    W3)가 "자연 치유"·"임계값 완화" 둘 다 거부하고 `_prepare_commit()` 이 최근 40커밋 중 변경 라인 ≥80인
    첫 커밋을 fixture 로 고르도록 고쳤다. 이는 이 diff 가 자체적으로 만든 회귀를 스스로 닫은 것이라
    정당성은 있으나, 손댄 파일(line-anchor 테스트 하네스)이 원 커밋 제목이 가리키는 대상과 다른 관심사라는
    사실 자체는 남는다. 변경은 좁게(헬퍼 1개 추가 + 결속 제거) 격리돼 있고 뮤테이션(임계값 0 되돌리기 →
    원래 에러 재현)으로 비-vacuity 도 확인됐다.
  - 제안: 스코프상 차단 사유 아님(자기 유발 회귀의 정당한 봉합, 격리·테스트 완비). 참고로만 기록.

- **[INFO]** §J(차단성 push 가드 결함) 전체가 원 작업과 무관한 다른 훅(`guard_review_before_push.py`)의
  이슈로 plan 에 신설됐으나, 코드는 손대지 않고 문서만 추가 + 별건 PR 로 명시 위임
  - 위치: `plan/in-progress/harness-guard-followups.md` §J 섹션(커밋 `30877465b` 신설, `37fcfc494` 포인터
    정정), `.claude/hooks/guard_review_before_push.py` 의 주석 3곳(코드 로직 변경 없음, cross-reference
    주석만 추가/이동)
  - 상세: `_GIT_PUSH` 우회 결함은 W1(`VAR=value` 따옴표 값)을 조사하다 파생 발견된 것으로, 발견 경위가
    합리적이고 "발견→plan 기록→코드는 별건 PR로 defer"라는 이 프로젝트의 표준 패턴을 정확히 따른다.
    `_GIT_PUSH` 정규식 자체와 `test_push_guard_allowlist.py` 의 byte-for-byte 핀은 이번 diff 에서
    전혀 건드리지 않았다 — 실측(`git diff`)으로 확인. 기능적 스코프 침범은 없다.
  - 제안: 조치 불필요. §J 별건 PR 착수 시 이 plan 섹션이 그대로 근거 문서 역할을 한다.

- **[INFO]** `plan/complete/harness-push-guard-subcommand-detection.md` 에 대한 사후 append(4줄)와
  `plan/in-progress/harness-guard-followups.md` 의 §E 관련 4줄(#1000 후속 기록, 커밋 `004d33ccb`)은 둘 다
  기존 내용 재작성이 아닌 순수 상호참조 추가
  - 위치: 위 두 파일, 각각 커밋 `8ddf391d2`(전자, §C won't-do 근거 연결)와 `004d33ccb`(후자, 별 세션 #1000
    이 이 plan 소유 항목을 완료했는데 plan 을 갱신하지 않은 것을 기록)
  - 상세: `plan/complete/` 사후 편집은 원칙적으로 예외 케이스이나, 이번 추가가 가리키는 대상(§C 결정)이
    바로 그 문서 자신의 서술이라 실질적 위험이 없다. §E 4줄도 "이 plan 이 §E 를 소유하는데 다른 PR 이
    완료 사실을 여기 남기지 않았다"는 명시적 사유가 있어 무관한 드리프-바이 편집이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 누적 diff 1825줄 중 실제 실행 코드 변경은 `guard_default_branch_bash.py`(+72/-15) 1개
  파일뿐이고, 나머지 대부분(약 1000줄)은 두 차례 리뷰 라운드(`review/code/2026/07/23/20_02_29/**`,
  `review/code/2026/07/23/20_33_56/**`)의 SUMMARY/RESOLUTION/개별 reviewer 산출물이다
  - 위치: `review/code/2026/07/23/20_02_29/*`, `review/code/2026/07/23/20_33_56/*` (총 22개 파일)
  - 상세: `review/` 는 gitignore 대상이 아니며, "구현 완료 후 자동 review → fix → 재커밋" 은 이 프로젝트의
    상시 승인된 강제 워크플로다. 이 파일들은 diff 크기를 크게 부풀리지만 스코프 침범이 아니라 정상적인
    감사 추적(audit trail) 커밋이다. 앞선 두 라운드의 scope 리뷰(`20_02_29/scope.md`, `20_33_56/scope.md`)
    도 동일하게 판정했다.
  - 제안: 조치 불필요.

## 스코프 대조 (핵심 실행 코드)

- `.claude/hooks/guard_default_branch_bash.py` — `_is_mutating` 을 세그먼트 분할(`&&`/`||`/`;`/`|`/`&`/개행)
  + `VAR=value`(따옴표 포함) 접두 스킵으로 확장. plan 체크리스트가 명시한 항목과 1:1 대응. 무관한 함수
  리팩토링·신규 기능·포맷팅 변경 없음(`git diff` 로 직접 확인, hunk 는 `_MUTATING`/`_SEGMENT_SPLIT`/
  `_is_mutating` 세 지점에 국한).
- `.claude/hooks/guard_review_before_push.py` — 주석 3곳 추가/이동만(§J 인지 주석 + 위치 정정). 정규식
  본문·분기 로직·리턴값 전부 unchanged.
- `.claude/tests/test_guard_default_branch_bash_mutating.py`(신규) — 위 코드 변경에 대응하는 pin. 무관한
  검증 없음.
- `.claude/tests/README.md` — 신규 테스트 파일 카탈로그 등재 1줄. `test_tests_readme_catalog.py` 가드가
  강제하는 필수 동반 수정.
- `.claude/docs/worktree-policy.md` — D 정책 문단 1곳, 코드 동작(6종 구분자·따옴표 값 인식)과 동기화.
- `.claude/tests/test_line_anchors.py` — 위 INFO #1 참고. 원 주제와 다른 파일이나 자기 유발 회귀의 정당한
  봉합.
- `plan/in-progress/harness-guard-followups.md`, `plan/complete/harness-push-guard-subcommand-detection.md`
  — 위 INFO #2/#3 참고.
- `review/code/2026/07/23/{20_02_29,20_33_56}/**` — 위 INFO #4 참고.

임포트 변경·설정 파일 변경·불필요한 주석 손질(설명과 무관한 주석 추가/삭제)·의미 없는 공백/줄바꿈
포맷팅은 발견되지 않았다.

## 요약

이번 diff 는 원 커밋(item C won't-do 종결 + `guard_default_branch_bash.py` 세그먼트 미검사 FN 해소)에서
출발해, 두 차례의 강제 코드 리뷰가 낸 Warning/Critical 을 그대로 반영하며 확장된 4-커밋 시퀀스다. 각
추가 파일 변경은 특정 리뷰 발견사항(W1/W2/W3, §J)이나 프로젝트 컨벤션(README 카탈로그, review 아카이빙)
에 직접 대응하며, 코드 로직이 바뀐 파일은 시종일관 `guard_default_branch_bash.py` 하나뿐이다(`guard_review_
before_push.py` 는 주석만). 유일하게 원 주제와 결이 다른 파일 변경은 `test_line_anchors.py`(별개
서브시스템의 회귀 봉합)와 `harness-guard-followups.md` §J(다른 훅의 발견-후-defer)인데, 둘 다 이 diff
자신의 작업 과정에서 실측으로 발견된 문제를 투명하게 기록·격리 수정한 것이고 코드 스코프(핵심 훅 로직)를
침범하지 않는다. 무관한 리팩토링·기능 확장·포맷팅 뒤섞임·불필요한 임포트/설정 변경은 발견되지 않았다.

## 위험도
LOW

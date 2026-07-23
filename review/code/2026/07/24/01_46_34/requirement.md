# 요구사항(Requirement) 충족 리뷰

## 검증 방법

리뷰 대상 diff 는 `origin/main..HEAD` 두 커밋(`11a94fe9b` §J-후속 FN 수정 + `6e1723985` 이전
리뷰 01_25_14 의 RESOLUTION 반영)의 누적 상태다. 실제 워크트리에서 직접 검증했다:

- `.claude/tests/test_guard_default_branch_bash_mutating.py` + `test_push_guard_allowlist.py`
  pytest 실행 → **71 passed** (신규 `OldEnvPrefixSupersetTest`/`GeneratedFloorTest`/
  `KnownFalseNegativeTest` 포함).
- 이전 리뷰(01_25_14)의 Warning 4건이 실제 코드에 반영됐는지 개별 확인:
  - W1: `guard_default_branch_bash.py:33-37` 모듈 docstring — "unclosed quote 는 이제 매치되고
    (`\S+` 폴백), empty value 만 unmatched" 로 정정됨. 더 이상 diff 가 고친 동작을 반박하지 않음.
  - W2: `test_push_guard_allowlist.py` 내 "§K" 오기 전량 제거 확인(`grep -n "§K"` 무결과), §L 로
    통일.
  - W3: `_harness.ENV_VALUE_SHAPES` 로 두 테스트 파일의 값 목록이 단일화됨(`grep`으로 두 파일
    모두 `_harness.ENV_VALUE_SHAPES` 참조 확인, 리터럴 중복 없음).
  - W4: `OldEnvPrefixSupersetTest`(넛지 훅)에 `test_no_duplicate_values` + `_MIN_COVERAGE` 비-
    vacuity 하한이 추가돼 push 가드의 `GeneratedFloorTest` 와 대칭화됨.
- RESOLUTION.md 가 스스로 보고한 "탈출구"(값 목록에서 미종료 따옴표 형태를 지워도 테스트가
  안 잡는 문제)를 독립적으로 재현: `_harness.ENV_VALUE_SHAPES` 에서 `"'x"` 를 제거하는 뮤테이션을
  가한 뒤 재실행 → `test_the_regression_shapes_are_still_generated` 가 정확히 RED 로 전환되는
  것을 확인, 이후 원본으로 복원해 71 passed 재확인(파일 잔여 diff 없음).
- 정규식 동작을 Python으로 직접 재현: `A='x git push`(미종료 단일따옴표) — pre-§J 패턴 불일치,
  §J(#1002) 패턴 불일치(§J-후속이 지목한 정확한 회귀), 폴백 추가 후 패턴은 일치. `A="a b"c git
  push`(§L, 범위 밖 선재 갭)는 세 패턴 모두 일치하지 않음 — plan/canary 서술과 일치.
- `ENV_VALUE_SHAPES`(현재 29개 값) × 7개 템플릿 = 203 케이스 생성 스크립트로 legacy 패턴 대비
  손실/획득을 재계산: **손실 0건, 획득 14건** — "엄밀한 상위집합" 주장이 §L 형태를 포함한 현재
  전체 목록에서도 성립함을 확인. (plan 문서의 "168건/28건/12건" 은 §L 형태가 추가되기 전
  시점의 스냅샷 수치이며, 정성적 결론("무손실 상위집합")은 여전히 참 — 이전 리뷰 INFO#10 과
  동일 결론.)
- `plan/complete/harness-push-guard-subcommand-detection.md` 실제 존재 확인(SoR 경로 정정 2건
  정확함).
- `spec/` 전체에서 `guard_review_before_push`/`guard_default_branch_bash`/`_GIT_PUSH`/`_MUTATING`
  언급 문서 없음(grep) — 제품 코드(`codebase/**`)가 아닌 `.claude/` 하네스 도구이므로 spec 커버리지
  대상 밖.

## 발견사항

- **[INFO]** 관련 spec 문서 없음 (spec 부재)
  - 위치: `spec/` 전체
  - 상세: 이번 변경은 `.claude/` 하네스 개발 도구(pre-commit/pre-push 가드 정규식)이며 제품 코드가
    아니므로 `spec/`의 통제 대상이 아니다. `plan/in-progress/harness-guard-followups.md` 가
    사실상의 SoR 역할을 하며, 본 diff 는 그 문서의 §J-후속(해소)·§L(캐너리로 고정, 미해결) 섹션·
    체크리스트와 line-level 로 정확히 일치한다.
  - 제안: 조치 불요.

- **[INFO]** plan 표의 정확한 수치("168건/28건/12건")가 현재 공유 목록으로는 재현되지 않음
  (§L 형태 추가로 목록이 24→29개로 늘어난 이후 시점이기 때문)
  - 위치: `plan/in-progress/harness-guard-followups.md` (J-후속 섹션 표), 커밋 `11a94fe9b`
  - 상세: 이전 리뷰(01_25_14) INFO#10 과 동일한 관찰이며 RESOLUTION 에서 이미 "조치 불요(낮은
    우선순위)"로 처분됨. 이번 라운드에서 현재 전체 목록(29개 값)으로 재계산한 결과도 "손실 0건"
    이라는 핵심 주장은 그대로 성립해, 서술 정밀도 문제일 뿐 기능적 결함은 아님을 재확인.
  - 제안: 조치 불요.

## 점검 결과 (문제 없음으로 확인된 항목)

- **기능 완전성**: §J-후속(env 값의 `\S+` 트레일링 폴백 복원으로 미종료 따옴표 FN 제거)은
  두 훅 + 테스트 미러 총 3곳 모두에 정확히 반영되고 71건 테스트로 검증됨. 이전 리뷰가 지적한
  documentation 자기모순(W1/W2)과 테스트 픽스처 중복/비대칭(W3/W4)도 이번 diff 의 후속 커밋에서
  전부 반영 완료.
- **엣지 케이스**: 빈 값(`VAR=`, 여전히 unmatched — 설계상 의도), 미종료 단일/이중 따옴표(이제
  매치), 이스케이프된 따옴표, 여러 env 할당 체인, §L(닫는 따옴표 뒤 문자 결합 — 의도적으로 범위
  밖) 모두 명시적으로 다뤄지고 테스트로 고정됨.
- **의도-구현 일치**: "quoted 대안이 먼저 소비, `\S+` 는 나머지만 받는 엄밀한 상위집합" 주장이
  `OldEnvPrefixSupersetTest`/`GeneratedFloorTest` 로 기계적 검증되고, 직접 재현(29개 값 기준)으로도
  손실 0건임을 재확인. 모듈 docstring 도 이제 실제 동작과 일치(W1 반영 확인).
- **회귀 방지 (탈출구 봉쇄)**: RESOLUTION 이 스스로 발견해 고친 "생성 목록에서 회귀 형태를 지워
  테스트를 통과시킬 수 있는 탈출구"가 `test_the_regression_shapes_are_still_generated` 로 실제로
  봉쇄됐음을 뮤테이션 재현으로 독립 확인(제거 시 RED, 복원 시 GREEN).
- **에러 시나리오/반환값**: 순수 정규식 분류 함수(`_is_mutating`/`_is_git_push`)로 항상 bool
  반환, 모든 분기에서 값 존재. 새 예외 경로 없음.
- **비즈니스 로직**: "블라인드 패스는 결코 false negative 를 늘려선 안 된다"는 프로젝트 불변식이
  두 훅 모두에서 정확히 유지·강화됨. 넛지 훅의 "실수는 nudge 쪽"·push 가드의 "실수는 block 쪽"
  이라는 상반된 안전 방향 정책도 그대로 보존.
- **TODO/FIXME**: 코드 내 신규 TODO/FIXME/HACK/XXX 주석 없음(grep 확인). plan 의 `- [ ] L` 은
  프로젝트 컨벤션상 정식 백로그 항목이며 코드 내 미완성 표식이 아님.
- **spec fidelity**: 대상 영역이 `spec/` 커버리지 밖(harness 도구)이므로 line-level 불일치
  판단 대상 자체가 없음 — INFO 로 처리.

## 요약

이번 diff(origin/main..HEAD 2커밋)는 §J-후속 회귀(env 값의 `\S+` 폴백 누락으로 미종료 따옴표가
push/mutating 탐지 접두 그룹을 붕괴시키던 FN)를 정확히 겨냥해 두 훅 + 테스트 미러 3곳에 최소
수정을 가했고, 이어지는 두 번째 커밋에서 직전 리뷰(01_25_14, Critical 0/Warning 4)의 지적사항을
전부 코드에 반영했다. 모든 반영 사항(docstring 자기모순 해소, §K→§L 정정, 값 목록 단일화, 대칭
안전장치 추가, 그리고 RESOLUTION 이 자체 발견한 "생성 목록 축소로 인한 탈출구" 봉쇄)을 실제
파일 읽기·grep·pytest 실행(71 passed)·직접 뮤테이션 재현으로 하나하나 독립 검증했으며 전부
서술과 일치했다. 정규식 손실/획득 수치를 현재 전체 값 목록(29개)으로 재계산해도 핵심 주장
("legacy 대비 손실 0건, 상위집합")은 유지된다. §L(닫는 따옴표 뒤 문자 결합)은 의도적으로 범위
밖에 남아 캐너리(`KnownFalseNegativeTest`)와 plan 미해결 체크박스로 정직하게 관리되고 있으며,
파국적 백트래킹 위험 때문에 측정 없이 성급히 고치지 않겠다는 판단도 합리적이다. `spec/` 커버리지
대상 밖(harness 개발 도구)이라 spec fidelity 항목은 INFO 로 처리했다. Critical/Warning 급 신규
결함 없음.

## 위험도
NONE

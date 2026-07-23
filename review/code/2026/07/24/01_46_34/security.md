# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 변경은 애플리케이션 코드(`codebase/**`)가 아니라 `.claude/hooks/*.py` 내부 하네스 가드
(`git push` 전 코드 리뷰를 강제하는 블로킹 게이트, default-branch Bash 넛지)와 그 대응 테스트,
plan 문서다. 핵심 변경은 두 정규식 — `guard_default_branch_bash._MUTATING`
(`.claude/hooks/guard_default_branch_bash.py:109-114`), `guard_review_before_push._GIT_PUSH`
(`.claude/hooks/guard_review_before_push.py:118-121`) — 의 env-value 대안 중 마지막 대안을
`[^\s'"]\S*`(따옴표 문자 제외) → `\S+`(무조건 fallback) 로 넓힌 것이다. 목적은 "따옴표를 열고
닫지 않은 env 값 때문에 `git push` 탐지 자체가 실패해 필수 코드 리뷰 게이트를 통째로 우회하던"
회귀(§J-후속, 생성 입력 168조합 기준 28건 손실)를 되돌리는 **보안 강화(false-negative 축소)** 커밋이다.
같은 alternation 을 프로덕션 정규식과 byte-identical 로 미러링하는
`.claude/tests/test_push_guard_allowlist.py::_BLIND_PATTERN`(82행)도 동일하게 갱신됐다.
나머지 diff(`.claude/tests/README.md`, `plan/in-progress/harness-guard-followups.md`,
`review/code/2026/07/24/01_25_14/**`)는 테스트 카탈로그/추적 문서/이전 리뷰 라운드 산출물이며
실행 코드 변경이 없다.

## 발견사항

- **[INFO]** 변경 방향 자체가 보안 강화(FN 축소)이며 신규 취약점 도입 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:118-121`(`_GIT_PUSH`),
    `.claude/hooks/guard_default_branch_bash.py:109-114`(`_MUTATING`)
  - 상세: `\S+` 는 alternation 의 세 번째(마지막) 대안으로만 추가됐고, 앞의 두 따옴표 대안이
    여전히 우선 시도되므로 정상적으로 닫힌 따옴표 값은 그대로 그 대안이 소비한다. 두 훅 모두
    `tool_input`/stdin 으로 받은 Bash 명령 문자열을 오직 `re.search()` 로 패턴 매칭할 뿐
    `eval`/`exec`/`subprocess(..., shell=True)` 등으로 재해석하지 않으므로, 임의의 Bash 문자열이
    훅 프로세스 안에서 코드/명령으로 실행되는 경로가 없다(정규식 매칭 결과에 따라 exit code/메시지만
    결정). `OldEnvPrefixSupersetTest`(`.claude/tests/test_guard_default_branch_bash_mutating.py:211-283`)와
    `GeneratedFloorTest`(`.claude/tests/test_push_guard_allowlist.py:320-397`)가 "새 패턴이 옛 패턴의
    엄밀한 상위집합"이라는 조건을 값 형태×할당 개수 2축의 생성 입력으로 강제하므로, 기존에 탐지되던
    케이스를 놓치는 방향의 회귀 위험은 낮다.
  - 제안: 없음(강화 변경).

- **[INFO]** ReDoS(catastrophic backtracking) 재도입 검증 — 타당함
  - 위치: 위와 동일 두 정규식; 회귀 가드는 `test_push_guard_allowlist.py::BacktrackingTest`,
    `test_guard_default_branch_bash_mutating.py::BacktrackingTest`
  - 상세: 두 훅 모두 **매 Bash 호출/매 `git push` 마다 동기 실행**되는 hot-path 이므로 정규식이
    병리적으로 느려지면 세션 hang 이라는 가용성 문제로 직결된다(과거 §C1/§C2 사례). 이번에 넓힌
    env-value 그룹은 각 반복이 `^`(또는 `&&`/`;`/`|` 구분자) 앵커 + 필수 `[A-Za-z_][A-Za-z0-9_]*=`
    로 시작해야 하고, 값을 소비한 뒤 반드시 `\s+` 로 끝나야 하는 구조라 — 대안 사이에 모호성이
    생겨도 반복 횟수에 비례한 선형 이상으로 폭발할 파티션이 없다. 코드 주석에 실측치(예:
    `A="a b" ` ×24 는 마이크로초 이내)가 남아 있고, `BacktrackingTest`(subprocess+timeout, 수만 회
    반복 adversarial 입력)로 지속 회귀 가드되고 있다. 별도 조치 불필요.

- **[INFO]** 사전 존재(pre-existing) 잔여 게이트 우회 — §L, 이번 diff 범위 밖이나 여전히 열려 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:118-121`(`_GIT_PUSH`); 캐너리
    `.claude/tests/test_push_guard_allowlist.py:891-928`(`KnownFalseNegativeTest`); 추적 문서
    `plan/in-progress/harness-guard-followups.md`(신설 `## L.` 섹션)
  - 상세: `A="a b"c git push` 처럼 닫는 따옴표 바로 뒤에 공백 없이 다른 문자가 붙는 형태는 여전히
    탐지되지 않는다(따옴표 대안은 닫는 따옴표 뒤 공백을 요구하고, `\S+` 대안은 따옴표 안의 공백을
    넘지 못해 접두 그룹이 0회로 무너짐 → `git\b` 앵커 불일치 → **push 미탐지**). §J/§J-후속이 고친
    것과 같은 방향의 조용한 게이트 우회이며, "push 전 코드 리뷰 필수"라는 프로세스 강제를 우회할 수
    있는 형태다. 다만 (a) §J 이전 legacy 패턴도 못 잡던 pre-existing 갭이고(`test_the_gap_predates_the_j_fix`
    로 확인됨), (b) plan 문서에 명시적으로 백로그·우선순위 등록돼 있으며, (c) `KnownFalseNegativeTest`
    가 "고쳐지면 assertion 을 뒤집으라"는 캐너리로 현재(버그) 동작을 고정해 은폐되지 않는다. 자연스러운
    수정형(`(?:'[^']*'|"[^"]*"|[^\s'"])+` 같은 문자 단위 반복 대안)은 그 자체가 대안 각각이 1글자를
    매칭할 수 있는 반복 그룹 — `BacktrackingTest` 가 잡으려는 파국적 백트래킹 형태이며, plan 문서에
    유사 형태 실측(14회 반복 5.2초, 18회 초과 8초)이 기록돼 있다. 측정 없이 성급히 고치면 §C1/§C2급
    ReDoS 를 재도입할 위험이 있다는 판단은 타당하다.
  - 제안: 이번 PR 범위에서 고칠 필요 없음(이미 별도 backlog 항목·우선순위로 추적 중, canary 로 회귀
    감시 중). `guard_default_branch_bash._MUTATING` 도 같은 클래스 갭을 공유하나 비차단 넛지라
    영향 범위가 작아 우선순위 유지가 합리적.

- **[INFO]** 하드코딩된 시크릿 / 인젝션 / 인증-인가 / 암호화 / 의존성 변경 없음
  - 위치: 전체 diff (`guard_default_branch_bash.py`, `guard_review_before_push.py`, 두 테스트 파일,
    `_harness.py`, plan 문서, `review/code/2026/07/24/01_25_14/**` 신규 리뷰 산출물)
  - 상세: 테스트 픽스처에 등장하는 `~/.key`, `GIT_SSH_COMMAND="ssh -i ~/.key"`, `-i` 등은 정규식
    매칭 대상 예시 문자열일 뿐 실제 자격증명이 아니다. 신규 추가된 `review/code/2026/07/24/01_25_14/**`
    (RESOLUTION.md, SUMMARY.md, _retry_state.json, meta.json, 각 리뷰어 산출물)은 이전 리뷰 라운드의
    산출물을 커밋에 포함시킨 것으로, 절대경로·세션 디렉토리명 등 저장소 로컬 정보만 담고 있으며
    시크릿/토큰/자격증명은 없음. 서드파티 의존성 변경도 없음.

- **[INFO]** fail-open 예외 처리 — 이미 문서화된 설계이며 관측 장치 존재
  - 위치: `.claude/hooks/guard_default_branch_bash.py:63-66`(`except Exception: traceback.print_exc(); sys.exit(0)`) —
    이번 diff 로 변경되지 않은 기존 동작
  - 상세: 훅 임포트/실행 중 예외가 나면 차단하지 않고 통과시키는 fail-open 설계다. 프로덕션 웹
    서비스라면 보안 경계에서의 fail-open 은 문제지만, 이 문서(`.claude/tests/README.md`
    `test_guard_review_before_push_main.py` 행)에 따르면 fail-open 은 의도된 정책이고 연속 3회
    이상 실패 시 escalate 하는 관측 카운터(`push_guard_failopen.json`)가 별도로 존재한다. 이번
    diff 의 변경 범위에 포함되지 않으므로 참고 사항으로만 기록.

## 요약

이번 diff 는 프로덕션 애플리케이션 코드가 아니라 내부 개발 워크플로 강제용 하네스 훅(`git push`
전 코드 리뷰 필수화 블로킹 게이트, default-branch Bash 넛지)의 정규식 회귀를 고친 것으로, 방향성
자체가 "따옴표를 열고 닫지 않은 env 값 때문에 push 탐지가 통째로 실패하는" 게이트 우회를 없애는
보안 강화다. 두 훅 모두 사용자 입력을 실행하지 않고 정규식 매칭에만 사용하므로 커맨드 인젝션
경로가 없고, ReDoS 재도입 여부는 정규식 구조(필수 앵커·비중첩 반복)와 adversarial
`BacktrackingTest`(양쪽 훅) 로 뒷받침된다. 하드코딩 시크릿·인증/인가 변경·암호화·의존성 이슈는
발견되지 않았다. 유일한 잔여 사항은 이번 diff 범위 밖의 사전 존재 게이트 우회(§L,
`A="a b"c git push` 형태)로, 이미 백로그·canary 테스트로 관리 중이고 자연스러운 수정안 자체가
새로운 ReDoS 위험을 안고 있어 측정 선행이 필요하다는 판단이 문서화돼 있다. 전반적으로 이 diff 로
인한 신규 보안 리스크는 없다.

## 위험도

LOW

# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 변경은 애플리케이션 코드(`codebase/**`)가 아니라 `.claude/hooks/*.py` 내부 하네스 가드(개발
워크플로 강제용 PreToolUse 훅) + 대응 테스트 + plan 문서다. 핵심 변경은 두 정규식(`guard_default_branch_bash._MUTATING`,
`guard_review_before_push._GIT_PUSH`)의 env-value 대안에서 마지막 대안을
`[^\s'"]\S*`(따옴표 제외) → `\S+`(무조건 fallback) 로 넓힌 것이다. 목적 자체가 "따옴표를 열고
닫지 않은 값 때문에 `git push` 탐지가 통째로 실패해 리뷰 게이트를 우회하던" 회귀(28건, §J-후속)를
고치는 **보안 강화(FN 축소) 커밋**이다.

## 발견사항

- **[INFO]** 리뷰 대상 회귀 자체는 보안 강화이며 새 취약점을 도입하지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py` (게이트 118~121행, `_GIT_PUSH`), `.claude/hooks/guard_default_branch_bash.py` (게이트 108~114행, `_MUTATING`)
  - 상세: `\S+` 를 세 번째 대안(fallback)으로만 추가했고, 앞의 두 따옴표 대안이 여전히 우선 시도되므로 정상적으로 닫힌 따옴표 값은 그대로 그 대안이 소비한다. 저자가 직접 작성한 `OldEnvPrefixSupersetTest`(파일 3)와 `GeneratedFloorTest`(파일 4)가 "새 패턴이 예전 패턴의 엄밀한 상위집합"이라는 조건을 생성 입력(값 형태 × 할당 개수 2축)으로 강제하므로, 이 변경이 기존에 탐지되던 case 를 놓치는 방향의 회귀를 만들 위험은 낮다.
  - 제안: 없음(강화 변경). 다만 `push-guard`(보안 게이트)와 `default-branch-bash`(비차단 넛지)는 서로 다른 리스크 등급이므로, 두 정규식이 "byte-identical" 을 요구하는 `EnvValueSubpatternSharedTest` 가 향후에도 계속 통과하는지 CI 에서 지켜볼 것.

- **[INFO]** `\S+` fallback 추가가 catastrophic backtracking(ReDoS) 을 재도입하지 않는지는 자체 검증됐고, 독립적으로도 타당함
  - 위치: `.claude/hooks/guard_review_before_push.py` 게이트 118~121행 `_GIT_PUSH`, `.claude/hooks/guard_default_branch_bash.py` 게이트 108~114행 `_MUTATING`; 회귀 테스트는 `.claude/tests/test_push_guard_allowlist.py::BacktrackingTest`, `.claude/tests/test_guard_default_branch_bash_mutating.py::BacktrackingTest`
  - 상세: 두 훅 모두 **모든 Bash 호출 앞단에서 동기 실행**되므로 정규식 하나가 병리적으로 느려지면 세션이 멈추는 심각한 가용성 문제로 이어진다(과거 §C1/§C2 사례). 이번에 추가된 `\S+` 는 각 반복이 `^`(혹은 구분자) 앵커 + 필수 `IDENT=` 로 시작해야 하고, 반복마다 소비한 뒤 반드시 `\s+` 로 끝나야 하므로, 대안들 사이의 모호성이 발생하더라도 백트래킹이 반복 횟수에 비례한 선형 이상으로 폭발할 파티션이 없다. 두 파일 모두 이 주장을 코드 주석에 실측치(예: `A="a b" ` ×24 는 마이크로초 이내, 400KB 입력에서 입력 4배 → 시간 4배)로 남겼고, subprocess+timeout 기반의 `BacktrackingTest`(40,000회 반복·백슬래시 40,000개 등 adversarial 입력)로 회귀를 가드하고 있어 신뢰할 수 있다. 별도 조치 불필요.

- **[INFO]** 문서화된 사전 존재(pre-existing) 게이트 우회 잔여 갭 — §L, 이번 diff가 만든 것은 아니지만 여전히 열려 있음
  - 위치: `.claude/hooks/guard_review_before_push.py` 게이트 118~121행 `_GIT_PUSH`; 캐너리 테스트 `.claude/tests/test_push_guard_allowlist.py::KnownFalseNegativeTest`(게이트 877~914행); 추적 문서 `plan/in-progress/harness-guard-followups.md` §L(게이트 495~511행)
  - 상세: `A="a b"c git push` 처럼 닫는 따옴표 바로 뒤에 공백 없이 다른 문자가 붙는 형태는 여전히 탐지되지 않는다(따옴표 대안은 닫는 따옴표 뒤 공백을 요구하고, `\S+` 대안은 따옴표 안의 공백을 넘지 못해 접두 그룹이 0회로 무너짐). §J 가 고친 클래스와 같은 방향의 조용한 게이트 우회이며, "PR 전 필수 코드 리뷰"라는 내부 프로세스 강제를 우회할 수 있는 형태다. 다만 이는 (a) 이번 diff 이전부터 존재하던 gap(§J 이전 legacy 패턴도 못 잡음, `test_the_gap_predates_the_j_fix` 로 확인됨), (b) plan 문서에 명시적으로 백로그 등록·우선순위 지정돼 있고, (c) `KnownFalseNegativeTest` 가 "고쳐지면 이 assertion 을 뒤집으라"는 캐너리로 고정돼 있어 은폐된 결함이 아니다. 자연스러운 수정형(`(?:'[^']*'|"[^"]*"|[^\s'"])+` 같은 문자 단위 반복)이 그 자체로 파국적 백트래킹 형태(실측: 유사 패턴 14회 반복에서 5.2초, 18회에서 8초 초과)이므로 **측정 없이 성급하게 고치면 §C1/§C2급 ReDoS 를 재도입할 위험이 있다**는 점도 문서가 정확히 짚고 있다.
  - 제안: 이 항목 자체를 이번 PR 에서 고칠 필요는 없음(범위 밖, 이미 별도 항목으로 추적 중). 다만 `guard_default_branch_bash._MUTATING` 도 같은 클래스의 갭을 공유한다고 문서가 명시하는데(§L 마지막 줄) 그쪽은 비차단 넛지라 영향이 작으므로 우선순위상 낮음 — 현행 backlog 우선순위 그대로 유지 권장.

- **[INFO]** 하드코딩된 시크릿 / 인젝션 / 인증-인가 / 암호화 / 의존성 변경 없음
  - 위치: 전체 diff(`guard_default_branch_bash.py`, `guard_review_before_push.py`, 두 테스트 파일, plan 문서)
  - 상세: 두 훅 모두 `tool_input.get("command")` 를 **오직 `re.search` 로 패턴 매칭**할 뿐 `eval`/`exec`/`subprocess(shell=True)` 등으로 재해석하지 않으므로, 사용자가 만든 임의 Bash 문자열이 훅 프로세스 안에서 명령/코드로 실행될 경로가 없다(정규식 매칭 결과에 따라 종료 코드/메시지만 결정). 테스트 파일에 등장하는 `~/.key`, `ssh -i` 같은 문자열은 예시일 뿐 실제 자격증명이 아니다. 의존성(서드파티 라이브러리) 변경 없음.

## 요약

이번 변경은 프로덕션 애플리케이션 코드가 아니라 내부 개발 워크플로 강제용 하네스 훅(`git push` 전 코드 리뷰 강제 게이트, default-branch 넛지)의 정규식을 수정한 것으로, 방향성 자체가 기존에 존재하던 "따옴표를 열고 닫지 않은 env 값 때문에 push 탐지가 통째로 실패하는" 게이트 우회(28건 회귀)를 없애는 **보안 강화**다. 훅은 사용자 입력을 실행하지 않고 정규식 매칭에만 사용하므로 커맨드 인젝션 경로가 없고, ReDoS 재도입 여부는 저자가 실측 주석과 subprocess-timeout 테스트로 충분히 검증했다. 유일한 잔여 이슈는 이번 diff 범위 밖의 사전 존재 게이트 우회(§L, `A="a b"c git push` 형태)인데, 이미 백로그에 등록되고 캐너리 테스트로 고정돼 있어 은폐된 결함이 아니며 자연스러운 수정안이 그 자체로 새로운 ReDoS 위험을 안고 있다는 점까지 문서화돼 있다. 전반적으로 이 diff 로 인한 신규 보안 리스크는 없다.

## 위험도

LOW

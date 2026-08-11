# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `TheSiteListHasNotGoneStaleTest` 의 두 테스트가 "grep 실행 + 발견 집합 계산" 10줄을 그대로 복제
  - 위치: `.claude/tests/test_install_gate_flags.py:110-119`(`test_no_unregistered_install_site_exists`) 와 `:129-138`(`test_the_search_actually_finds_the_known_sites`)
  - 상세: 두 테스트 메서드가 다음 블록을 토씨 하나 안 틀리고 그대로 갖고 있다 — `subprocess.run(["git", "grep", "-l", "pnpm install", "--", ".github", ".claude", "codebase", "Makefile", "scripts"], ...)` 호출과 그 결과를 필터링하는 `found = {p for p in proc.stdout.split("\n") if p and self._is_execution_site(p) and install_lines(...)}` set comprehension. 두 테스트는 "이 계산 결과로 무엇을 단언하는가"만 다르고(미등재 여부 vs 등재 집합과의 완전 일치), 그 계산 자체는 완전히 동일하다. 이 파일의 존재 이유 자체가 "다섯 곳이 흩어져 있어 한 곳만 고치면 나머지로 샌다"(모듈 docstring, `SITES` 튜플)인데, 정작 이 가드 자신의 핵심 로직(검색 대상 디렉터리 목록·판정 기준)이 두 곳에 복제돼 있어 같은 패턴의 위험을 자기 자신 안에 재현하고 있다 — 예를 들어 검색 대상에 새 디렉터리를 추가해야 할 때 한쪽만 고치면, "비-vacuity" 테스트(`test_the_search_actually_finds_the_known_sites`)가 여전히 옛 디렉터리 집합으로 통과해 그 갱신 누락을 못 잡는다. `unittest.TestCase.setUp()` 은 각 테스트 메서드 실행 전에 매번 새로 호출되므로, 두 테스트가 독립적으로 "재탐색"을 수행한다는 성질(`test_the_search_actually_finds_the_known_sites` 의 비-vacuity 목적)을 잃지 않고도 이 중복을 제거할 수 있다.
  - 제안: `subprocess.run(...)` 호출과 `found = {...}` 계산을 `setUp(self)` (또는 `_found_sites()` 같은 private 헬퍼)로 옮기고, 두 테스트는 `self.found`(또는 헬퍼 반환값)만 소비하도록 정리한다.

- **[WARNING]** 같은 파일 안에서 모듈 docstring 과 메서드 docstring 이 "유일한 소재지" 주장에 대해 서로 반대로 말한다
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:6` (모듈 docstring: `"지금은 저장소 전체에서 **그 한 줄이 여기 하나뿐**이다."`) vs `.claude/tests/test_pnpm_workspace_action.py:110` (`test_pnpm_receives_both_gate_flags_and_the_filter` docstring: `"저장소 전체의 유일한 소재지가 아니다(pnpm install 은 5곳에 있다)."`)
  - 상세: 이 저장소는 방금(`e02857eaa`, 이번 diff 에 `RESOLUTION.md`/`SUMMARY.md` 로 포함됨) "저장소에서 유일한 소재지" 라는 프레이밍이 실제 사고(4곳 무가드)의 원인이었다고 판정하고, 그 문구를 쓰는 자리를 `유일한 소재지|only copy in the repository` 리터럴로 전수 검색해 세 곳을 고쳤다. 그런데 바로 이 파일 최상단 모듈 docstring 은 같은 주장을 다른 단어(`하나뿐`)로 여전히 하고 있고, 그 리터럴 검색으로는 걸리지 않는다. 결과적으로 한 파일 안에서 위쪽(모듈 docstring, 파일을 열면 가장 먼저 읽는 자리)은 "이 한 줄이 저장소에서 유일하다" 고 말하고, 그 아래 104줄 뒤(같은 클래스의 메서드 docstring, 이번 diff 로 방금 수정됨)는 정확히 반대로 "유일한 소재지가 아니다(5곳에 있다)" 라고 말한다. 이 모순은 diff 밖(모듈 docstring 은 `5fd068a26` 에서 도입돼 이번 변경이 건드리지 않음)이지만, 방금 같은 파일에서 같은 주장을 반대로 정정한 이번 diff 로 인해 새로 모순 관계가 생겼다는 점에서 이번 변경의 부작용이다. 새로 파일을 여는 사람은 6번째 줄에서 잘못된 멘탈 모델("이 한 줄만 지키면 된다")을 먼저 얻고, 110번째 줄에서야 그것이 틀렸다는 걸 안다.
  - 제안: 모듈 docstring 6번째 줄도 "CI 워크플로가 공유하는 한 줄"(action.yml·`pnpm-workspace.yaml` 이 이미 채택한 좁힌 표현)로 정정하거나, 최소한 "저장소 전체의 유일한 소재지는 아니다 — 아래 참고" 식의 caveat 를 붙인다. 재발 방지 차원에서는, 다음에 이런 전수 정정을 할 때 리터럴 문자열 grep 뿐 아니라 같은 파일 안의 유사 표현(동의어 패러프레이즈)까지 사람이 훑는 절차를 권한다.

- **[INFO]** `pnpm-workspace.yaml` 신설 섹션에서 굵게 표시된 한 문장이 부자연스럽게 두 줄로 쪼개져 있다
  - 위치: `pnpm-workspace.yaml:134-135`
  - 상세: `# **예외 목록(`peerDependencyRules`)은` 줄과 `# 비어 있고, 비어 있는 것이 정상이다.**` 줄이 한 문장을 굵게 마크업한 채로 반으로 나눠져 있다. 파일의 다른 문단들(예: 106-107번째 줄)은 자연스러운 폭(약 90자 전후)으로 줄바꿈하는데, 이 문장만 두 개의 짧은 줄로 끊겨 있어 스캔할 때 리듬이 깨진다.
  - 제안: 한 줄로 합치거나 다른 문단과 비슷한 폭으로 재-wrap.

- **[INFO]** 신설 섹션 구분선(`── … ──`)이 파일의 다른 섹션 관례와 다름 — 직전 라운드 documentation/maintainability 에서 이미 INFO 로 지적됐고 우선순위가 낮아 미반영 상태로 남아 있음(재확인 목적 기재)
  - 위치: `pnpm-workspace.yaml:124`
  - 상세: `overrides`/`onlyBuiltDependencies`/`auditConfig` 등 기존 섹션은 박스 문자 헤더 없이 일반 주석 문단으로 시작하는데, 이번에 추가된 `peer dependency 게이트` 섹션만 유니코드 구분선을 새로 쓴다. 우선순위가 낮아 이전 라운드에서도 반영을 요구하지 않았고, 이번에도 동일 판단이 유효하다고 본다.
  - 제안: (낮은 우선순위) 기존 스타일에 맞추거나, 반대로 가독성 개선이 목적이면 다른 섹션에도 소급 적용해 파일 전체를 통일.

## 요약

이번 diff 의 실질 코드 변경(Dockerfile 3개·`action.yml`·`test-stages.sh` 의 플래그 한 줄 추가, `test_pnpm_workspace_action.py` 의 인자·이름 갱신)은 전부 단순하고 문제없다. 유지보수성 관점에서 주목할 지점은 이번 라운드에 새로 생긴 두 파일 안에 있다. 첫째, 직전 라운드가 지적한 "5곳 중 4곳 무가드"를 닫기 위해 신설한 `test_install_gate_flags.py` 자체가, `git grep` 호출과 발견 집합 계산 10줄을 두 테스트에 그대로 복제하고 있다 — `setUp()` 으로 옮기면 테스트 독립성을 잃지 않고 제거할 수 있는 명백한 추출 대상이다. 둘째, "저장소에서 유일한 소재지" 프레이밍을 전수 제거한 이번 diff 가 리터럴 문자열 검색에 의존한 탓에, 같은 파일(`test_pnpm_workspace_action.py`) 최상단의 파레프레이즈된 동일 주장(6번째 줄)을 놓쳐, 그 파일 안에서 두 docstring 이 서로 반대 주장을 하는 상태가 새로 생겼다 — 이 라운드가 방금 고치려던 것과 정확히 같은 클래스의 문제가 같은 파일 안에 남았다는 점에서 가볍게 볼 사안은 아니다. 나머지는 스타일 수준의 INFO.

## 위험도
LOW

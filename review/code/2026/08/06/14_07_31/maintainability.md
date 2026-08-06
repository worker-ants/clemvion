# 유지보수성(Maintainability) 리뷰 — round 10

대상: `.claude/_shared/git_probe.py` 신설(git probe 5종 통합) + `branch_guard.py`/`plan_guard.py`/
`review_guard.py` 의 위임 전환 + `_summary_is_resolved` 위험도 파싱 잠복 결함 수정(9R,
`e834d0f4e`). 실제 diff 는 `git diff HEAD~1 HEAD`로 확인했고, 그 외 명시 파일(테스트·워크플로·
plan 문서)은 현재 상태를 함께 읽었다.

## 발견사항

- **[WARNING]** `git_probe._origin_default_branch` 가 쓰이지 않는 `cwd` 파라미터를 받고, `branch_guard.py`
  의 동명 함수와 이름은 같지만 의미(반환 타입)가 완전히 다르다.
  - 위치: `.claude/_shared/git_probe.py:35`(def) ~ `:59`(return). 호출부는 `:113`(`_default_branch`
    안의 `resolver = _origin_default_branch(cwd)`).
  - 상세: `def _origin_default_branch(cwd: str):` 의 본문(35~59행) 어디에서도 `cwd` 를 읽지 않는다
    (`python3 -c "import ast; ..."` 로 AST 확인: `arg(arg='cwd', ...)` 만 있고 `Name(id='cwd')` 참조는
    본문에 없음). 이 함수는 브랜치 이름을 조회하는 게 아니라 `branch_guard.py` 를 동적 로드해 그
    모듈의 **`_origin_default_branch` 함수 객체**를 반환하는 접근자다. 반면 `branch_guard.py:65`
    의 `_origin_default_branch(cwd)` 는 실제로 `cwd` 를 써서 `git remote`/`symbolic-ref`/
    `remote show origin` 을 실행하고 **브랜치 이름 문자열**을 반환한다. 같은 파일 쌍(`git_probe.py`
    가 `branch_guard.py` 를 참조)에 같은 이름·다른 반환 타입의 함수가 공존해, 호출부만 보면
    `resolver = _origin_default_branch(cwd)` 가 이미 브랜치 이름을 준다고 착각하기 쉽다
    (`_default_branch()` 안에서 `resolver(cwd)` 로 다시 호출해야 실제 값이 나온다는 것은 코드를
    끝까지 따라가야 보인다).
  - 제안: `cwd` 파라미터를 제거해 "이 함수는 조회일 뿐 cwd 에 의존하지 않는다"를 시그니처로
    드러내거나, 함수명을 `_branch_guard_resolver()` 처럼 바꿔 `branch_guard.py` 의 동명 함수와
    구분되게 할 것.

- **[WARNING]** `.claude` 루트 계산 + `sys.path` 등록 + `_shared` import 부트스트랩 블록이
  `branch_guard.py`/`plan_guard.py`/`review_guard.py` 세 파일에 각각 손으로 복제돼 있고, 벌써
  스타일이 갈렸다(`sys` 임포트 별칭 유무).
  - 위치: `.claude/hooks/_lib/branch_guard.py:24-33`(특히 27행 `import sys as _sys`),
    `.claude/hooks/_lib/plan_guard.py:47-63`(특히 53행 `import sys` — 별칭 없음, 56-60행),
    `.claude/hooks/_lib/review_guard.py:120-121`(기존 코드, 계산 방식이 또 다름 —
    `THIS_DIR` 을 거쳐 두 단계만 `dirname`).
  - 상세: 이번 라운드의 명시적 동기는 "손-동기 쌍이 반복해서 갈린다"(git probe 5종을
    `_shared/git_probe.py` 로 통합한 이유 그 자체)인데, 그 처방을 담기 위한 8~9줄짜리
    부트스트랩 코드가 지금 세 파일에 각각 다시 손으로 복제됐다. `branch_guard.py` 는
    `_sys` 별칭을 쓰고 `plan_guard.py` 는 별칭 없이 `sys` 를 그대로 쓴다 — 같은 목적의 코드가
    이미 스타일 레벨에서 갈렸다. `_shared` 를 찾기 위한 코드라 `_shared` 안으로 옮길 수는
    없지만(자기 자신을 import 하기 전에 실행돼야 하므로), 최소한 세 파일이 문자 그대로 동일한
    블록을 유지하도록 정렬하거나 "세 곳이 동일해야 한다"는 불변식을 주석으로 남길 필요가 있다.
    지금 상태(별칭 불일치)는 이 PR 이 막으려는 것과 같은 종류의 drift 가 이미 부트스트랩
    레이어에서 시작됐다는 신호다. 기능 영향은 없다(둘 다 같은 경로로 귀결).
  - 제안: 세 파일의 부트스트랩 블록을 문자 그대로 동일하게 맞추거나(별칭 통일), 주석으로
    "손대면 세 곳 다 함께 고칠 것"을 명시.

- **[INFO]** `git_probe.py` 안에서 매직 문자열 `"_git_probe_branch_guard"` 가 상수화 없이 3회
  반복된다.
  - 위치: `.claude/_shared/git_probe.py:49`(`sys.modules.get(...)`), `:53`
    (`spec_from_file_location(...)`), `:55`(`sys.modules[...] = mod`).
  - 상세: 이 파일 자체가 "다섯 함수가 손-복제돼 두 번 갈렸다"는 사고를 module docstring
    (1-23행)에서 상세히 기록하는데, 같은 클래스의 (훨씬 작은 규모) 리터럴 반복을 정작 이
    함수 안에서는 상수화하지 않았다. 세 곳 중 하나만 다른 문자열로 바뀌면 캐시가 매번
    무효화돼 호출마다 `branch_guard.py` 를 다시 로드하게 되지만, 정확성 자체는 깨지지 않는다
    — 조용히 성능만 나빠지는 실패 모드라 발견이 늦어지기 쉽다.
  - 제안: 모듈 상단에 `_BRANCH_GUARD_MODULE_KEY = "_git_probe_branch_guard"` 상수를 두고 세
    자리 모두에서 재사용.

- **[INFO]** `_summary_is_resolved` 의 위험도 스캔이 중첩 루프 + 사후 플래그 검사로 바깥
  루프를 종료하는 구조라, 이번 라운드가 정확히 고친 자리인데도 흐름을 눈으로 따라가기 어렵다.
  - 위치: `.claude/hooks/_lib/review_guard.py:440-469` (`_summary_is_resolved` 내부, 위험도
    토큰을 찾는 이중 `for`).
  - 상세: 이번 수정(무조건 `break` → `risk_level is not None` 조건부 `break`, 468-469행)
    자체는 정확하고 회귀 테스트(`RiskHeadingDecoyTest`, `test_review_guard_hardening.py`)로
    양방향 다 고정돼 있다. 다만 구조는 여전히 `for i, ln in enumerate(lines)` 안에
    `for j, probe in enumerate(lines[i:])` 를 두고, 안쪽 루프의 결과(`risk_level` 이 갱신됐는지)
    를 바깥 루프가 사후에 검사해 자신을 멈추는 형태다. 주석이 상세해 의도 파악에는 무리가
    없지만, 이 함수에서 가장 순환 복잡도가 높은 블록이 됐다.
  - 제안: "헤딩 다음 줄부터 다음 헤딩 전까지 첫 위험도 토큰 찾기"를
    `_find_risk_level(lines: list[str], start: int) -> str | None` 같은 작은 헬퍼로 추출해
    `return` 으로 종료하면 바깥/안쪽 두 단계 `break` 를 없앨 수 있다.

- **[INFO]** `plan_guard.py` 의 모듈 변수 `THIS_DIR` 이 여전히 어디서도 참조되지 않는 죽은
  코드이고, 이번 라운드가 정확히 그 줄을 잘라 새 위치로 옮기면서도 정리하지 않았다.
  - 위치: `.claude/hooks/_lib/plan_guard.py:63`.
  - 상세: `git show HEAD~1:.claude/hooks/_lib/plan_guard.py | grep -n THIS_DIR` 로 확인하면
    리팩터 이전에도 정의만 있고 파일 안에서 재참조가 없었다(1건, 정의 자체). 저장소 전체에서도
    `grep -rn "plan_guard\.THIS_DIR\|pg\.THIS_DIR" .claude/` 결과 0건 — 외부에서도 안 쓰인다.
    이번 diff 는 이 줄을 부트스트랩 블록 아래로 그대로 옮겼을 뿐이라(`git diff HEAD~1 HEAD` 로
    확인: `-THIS_DIR = ...` 가 옛 위치에서 삭제되고 `+THIS_DIR = ...` 가 새 위치에 그대로
    재등장), 개발자가 이 정확한 줄을 다시 타이핑하면서도 죽은 코드임을 확인할 기회가 있었다.
  - 제안: 삭제하거나, 향후 사용 계획이 있으면 그 의도를 주석으로 남길 것.

## 요약

이번 라운드(9R, `e834d0f4e`)의 핵심 작업 — `review_guard.py`/`plan_guard.py`/`branch_guard.py` 가
손으로 복제해 두 번 갈렸던 git probe 5종을 `.claude/_shared/git_probe.py` 하나로 통합하고,
위험도 파싱의 잠복 결함(단일 `break`)을 조건부로 고친 것 — 은 방향이 정확하고 회귀 테스트로 잘
봉쇄돼 있다. 다만 그 통합 코드 자체가 작은 규모로 같은 클래스의 유지보수성 문제를 새로 들여왔다:
`_origin_default_branch` 라는 이름이 두 파일에서 서로 다른 것을 가리키고 쓰이지 않는 파라미터를
받으며, "`_shared` 를 찾기 위한" 부트스트랩 블록이 세 파일에 다시 손으로 복제돼 벌써 별칭
스타일이 갈렸고, 매직 문자열 하나가 상수화 없이 3회 반복된다. 전부 기능(판정 결과)에는 영향이
없고 회귀 테스트의 안전망 바깥에 있는 가독성·중복 문제이며, `plan_guard.py` 의 죽은 변수
`THIS_DIR` 도 이번에 정리할 기회를 그대로 지나쳤다. CRITICAL 급 결함은 없다.

## 위험도

LOW

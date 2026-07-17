# 부작용(Side Effect) 리뷰 — guard_review_before_push.py / test_push_detection.py

리뷰 대상 diff 는 `origin/main..HEAD` 기준 `.claude/hooks/guard_review_before_push.py`(`_is_git_push`
정규식 1줄 → shlex 토큰화·재귀 8개 헬퍼 함수로 확장, +422/-7)와 신규 파일
`.claude/tests/test_push_detection.py`(+621, 전체 신규)이다. 두 파일 모두 실제로 로드해 실행하며
검증했다(정적 diff 읽기에 그치지 않음).

## 발견사항

- **[WARNING]** `main()`의 게이트-적용여부 판정(`_is_git_push` 호출)만 하위 두 게이트와 달리 예외
  보호가 없음 — 복잡도가 급증한 뒤 방어 비대칭이 생김
  - 위치: `.claude/hooks/guard_review_before_push.py:528`(`if not _is_git_push(command): return 0`,
    보호 없음) vs `:533-537`(REVIEW 게이트, `try/except Exception`), `:544-548`(PLAN 게이트, 동일
    패턴). `_is_git_push` 자체 정의는 `:398-491`.
  - 상세: 변경 전 `_is_git_push`는 사전 컴파일 정규식 `.search()` 한 줄이라 사실상 어떤 문자열
    입력에도 예외를 던질 수 없었다. 변경 후에는 `_tokenize`(shlex)·`_find_command_substitutions`
    (균형 괄호/백틱 스캔)·`_git_subcommand`·`_shell_dash_c_argument`·`_eval_argument`·
    `_segment_runs_push` 를 거치는 재귀 파이프라인(최대 깊이 4)으로 바뀌었고, 모듈 자신의
    독트링이 "A guard must not turn permissive when it cannot parse"라는 원칙을 `_tokenize`가
    던지는 `ValueError`(따옴표 불균형) 한 가지에 대해서는 정확히 적용한다(`:460` 근방, 실패 시
    `_GIT_PUSH_FALLBACK` 정규식으로 폴백해 **차단 방향**으로 fail). 그런데 그 동일한 원칙이
    `main()`의 호출부(`:528`)에는 적용되지 않는다 — `_tokenize`가 명시적으로 예상하지 못한 다른
    예외(향후 리팩터로 유입될 인덱싱 버그 등)가 파이프라인 어디선가 발생하면 `main()` 전체가
    잡히지 않은 예외로 죽고, 파일 상단 계약("any other → treated as runtime error; tool call
    proceeds (fail-open)")에 따라 REVIEW·PLAN 게이트가 **둘 다** 건너뛰어진 채 `git push`가
    통과한다 — 이 훅이 막으려는 바로 그 실패 모드다. 직접 퍼징(5000자 반복 문자열, 불균형
    따옴표/백틱, 외톨이 서로게이트 `\ud800`, `git -C`/`eval`/`bash -c`의 트레일링 절단 등)으로
    실제 크래시는 재현하지 못했으므로 이는 **증명된 버그가 아니라 방어 일관성 공백**이다.
  - 제안: `main()`에서 `_is_git_push(command)` 호출도 `try/except Exception`으로 감싸고, 예외
    발생 시 (다른 두 게이트처럼 "일단 진행"이 아니라) **차단 방향**으로 fail — 즉 "판정 불가 ⇒
    push로 간주하고 REVIEW/PLAN 게이트를 계속 평가"하도록 만들면, 이미 `_tokenize`의
    `ValueError` 케이스에 적용된 원칙과 일관되고 두 게이트가 최소한 시도는 되도록 보장한다.

- **[INFO]** 시그니처/인터페이스 변경은 하위호환이며 외부 참조 없음을 확인함
  - 위치: `_is_git_push(command: str) -> bool` → `_is_git_push(command: str, _depth: int = 0) -> bool`
    (`:398`), 모듈 상수 `_GIT_PUSH` → `_GIT_PUSH_FALLBACK` 로 개명·"주 판정"에서 "파싱 불가 시
    폴백"으로 역할 축소(`:57`).
  - 상세: `_depth`는 기본값 있는 신규 파라미터라 기존 단일-인자 호출부(`main()` 의 `:528`,
    테스트의 단일 인자 케이스 다수)는 전부 그대로 동작한다. 저장소 전체를 `grep -rn "_GIT_PUSH\b"`
    /`grep -rln "_is_git_push"`/`grep -rln "guard_review_before_push"` 로 훑어 확인한 결과, 옛
    상수명 `_GIT_PUSH`를 참조하는 곳은 이 파일 밖에 전무하고, `_is_git_push`는 이 훅 파일과 신규
    테스트 파일 밖에서 import 되지 않으며, 다른 파일들의 `guard_review_before_push` 언급은 전부
    `.claude/settings.json`(파일 경로 등록)·docstring/문서상 상호 참조일 뿐 내부 심볼을 직접
    가져다 쓰는 곳은 없다(`review_guard.py`/`plan_guard.py`/`guard_review_before_stop.py` 모두
    파일명만 주석에 언급). 훅의 실제 "공개 계약"인 harness 와의 프로세스 경계(stdin JSON 입력 →
    exit 0/2/기타 + stderr)도 `main()` 자체가 diff 밖이라 무변경. 즉 이번 diff 로 깨지는 외부
    호출자·공개 인터페이스는 발견되지 않았다.
  - 제안: 조치 불요 (검증 결과 기록 목적).

- **[INFO]** 사전 필터 제거로 모든 Bash 호출이 매번 전체 토큰화 비용을 지불 — 의도된 트레이드오프,
  재귀 비용도 실측상 선형임을 직접 계측으로 확인
  - 위치: `_is_git_push`(`:398-491`), 훅 등록은 `.claude/settings.json`(`"matcher": "Bash"`) —
    `git push` 여부와 무관하게 세션의 **모든** Bash 툴 호출마다 새 `python3` 프로세스로 이 경로가
    실행된다.
  - 상세: 이전엔 `if not command or "push" not in command: return False`로 조기 반환했으나(Critical
    #2 수정으로 제거, 원시 문자열에 "push" 서브스트링이 없어도 `git 'pu''sh'` 처럼 셸이 합쳐 실제
    push 가 되는 unsound 사례가 있었기 때문 — 이미 문서화·측정됨: 대표 명령 6종 평균 6-24us vs
    프로세스 기동 ~13ms). 재귀(`_MAX_RECURSION_DEPTH=4`)가 "형제(sibling) $(...) 를 겹겹이 중첩"
    시키면 총 작업량이 브랜칭 팩터의 지수/다항으로 폭발하지 않는지 직접 의심해 `_find_command_
    substitutions`를 계측(호출 횟수·누적 스캔 문자수)한 결과, 원본 길이 대비 누적 스캔량은 항상
    ~3.6-3.9배(≈ `_MAX_RECURSION_DEPTH`+1)로 **일정**했다 — 형제 노드 수를 3/5/8로 늘려도 비율은
    불변. 즉 각 재귀 레벨이 실제로 원본 문자열의 disjoint 한 부분만 재스캔하는 구조가 맞고,
    총비용은 O(depth×n)으로 선형이며 지수 폭발은 없다 — `performance.md` 리뷰의 동일 결론과
    교차검증되어 일치한다(최초엔 n(형제수) 대 wall-clock 시간만 비교해 다항 폭발처럼 보였으나,
    이는 이 특정 생성 방식에서 문자열 길이 자체가 n^depth 로 커지기 때문이었고 length-vs-time 은
    선형이었다 — 계측 없이 wall-clock 만으로 판단했다면 오탐 WARNING 을 냈을 사례).
  - 제안: 조치 불요. 다만 이 훅이 세션의 모든 Bash 호출 경로에 있다는 사실 자체는 코드 리뷰 시
    "이 파일은 `git push` 전용"이라고 오인하지 않도록 계속 주지할 가치가 있다.

- **[INFO]** 신규 테스트 파일의 모듈 로더가 프로세스 전역 `sys.modules` 레지스트리에 기록 — 기존
  하네스 패턴, 충돌 없음 확인
  - 위치: `.claude/tests/test_push_detection.py:24`(`guard = _harness.load_module_by_path(
    "guard_review_before_push", ...)`) → `_harness.load_module_by_path`(`.claude/tests/_harness.py`,
    diff 밖의 기존 공유 인프라)가 `sys.modules["guard_review_before_push"] = module`로 등록.
  - 상세: `sys.modules` 변경은 프로세스 전역 부작용이지만, 이 diff 가 새로 도입한 패턴이 아니라
    기존 테스트 하네스의 표준 로더를 그대로 재사용한 것이다. `grep -n 'load_module_by_path("guard_
    review_before_push"' .claude/tests/*.py` 로 확인한 결과 이 이름으로 등록하는 테스트 파일은
    `test_push_detection.py` 하나뿐이라 동일 세션 내 이름 충돌은 없다. 훅 모듈을
    `exec_module`(import)만 해도 `main()`은 `if __name__ == "__main__":` 가드 뒤에 있어 실행되지
    않으므로, 로드 자체로 stdin 을 소비하거나 git 명령을 실행하는 일은 없다.
  - 제안: 조치 불요.

## 요약

두 파일에서 파일시스템 쓰기·네트워크 호출·환경변수 신규 읽기/쓰기·이벤트/콜백 관련 부작용은
발견되지 않았고, 시그니처·인터페이스 변경(`_is_git_push`의 `_depth` 매개변수 추가, `_GIT_PUSH` →
`_GIT_PUSH_FALLBACK` 개명)은 저장소 전체 grep 으로 외부 참조 부재를 확인해 하위호환임을
검증했다. 유일하게 실질적인 우려는 `main()`이 REVIEW/PLAN 두 게이트 호출은 `try/except`로
감싸면서도, 그 앞단의 "이게 push 인가?" 판정(`_is_git_push`)은 동일한 보호 없이 호출한다는
비대칭이다 — 변경 전엔 이 함수가 예외를 사실상 던질 수 없는 한 줄짜리 정규식이라 무해했지만,
지금은 재귀·토큰화를 포함한 8개 함수로 늘어나 표면적이 커졌다. 퍼징으로 실제 크래시는 재현하지
못해 "증명된 버그"는 아니지만, 만약 미래에 예상 밖 예외가 나면 파일 자신이 선언한 fail-open
계약에 따라 REVIEW·PLAN 게이트가 **함께** 스킵된 채 미검토 push 가 통과한다는 점에서, 이 파일이
막으려는 실패 모드 그 자체와 맞닿아 있어 WARNING 으로 기록한다. 그 외 "모든 Bash 호출이 토큰화
비용을 지불한다"는 자원-소비 측 부작용은 의도적으로 측정·문서화된 트레이드오프이고, 재귀
비용이 실제로 선형인지 직접 계측(문자 스캔량 카운트)으로 재확인해 지수 폭발 가능성도 배제했다.

## 위험도

LOW

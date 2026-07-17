# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — push 가드(`guard_review_before_push.py`)의 REVIEW/PLAN 게이트를 완전히 우회해 미검토 `git push`를 통과시키는, 실행으로 검증된 false-negative가 3개 리뷰어(security/requirement/testing)에 의해 서로 다른 4개 독립 벡터로 발견됨. 동일 파일에 대한 3세션 연속(`17_09_10` → `18_04_20` → 이번 `19_15_56`) 하드닝에도 매 세션 새로운 CRITICAL 우회가 나오는 패턴이 반복되고 있어, 개별 수정 외에 검증 방법론(퍼징, 조기-반환 순서 재검토) 차원의 보강이 필요하다. router 강제 화이트리스트(`maintainability, requirement, scope, security, side_effect, testing`) 6명 전원의 결과가 정상 확보되었다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `$'push'`/`$"push"`(bash ANSI-C/locale quoting)가 `_tokenize()`에서 `$push` 토큰으로 잘못 분해되어 `_is_git_push`가 `False`를 반환. 실제 bash/zsh에서는 `git push`로 그대로 실행됨을 직접 실행으로 확인했다. legacy 정규식은 두 형태 모두 정상 차단하던 것이라 이번 shlex rewrite의 신규 회귀. 해시 이스케이프 변형(`git $'\x70\x75\x73\x68'`)도 동일하게 우회됨(단 이건 legacy 도 못 막던 기존 gap) | `guard_review_before_push.py` `_tokenize()`(204-230행), `_git_subcommand()`(291행~), `_is_git_push()`(398행~), `main()`(523-529행) | `$'...'`/`$"..."` 시퀀스를 토큰화 전/중에 디코드(선행 `$` 제거 후 일반 인용으로 취급, 가능하면 `\xHH` 등 ANSI-C 이스케이프까지 디코드). `MUST_BLOCK`+`LegacyRegressionDifferentialTest` 코퍼스에 `git $'push'`/`git $"push"`/`git $'\x70\x75\x73\x68'` 추가 |
| 2 | 요구사항 | `_find_command_substitutions`의 backtick 미종료 처리가 `spans.append` 없이 `while` 루프 자체를 `break`시켜, 그 뒤에 오는 진짜 `git push`(예: `"$(git push)"`)를 전혀 스캔하지 않음. 자기 docstring의 "미종료 시 over-inclusive(나머지 전체 흡수)" 원칙과 정면 배치. `echo "it\`s neat" && git commit -m "$(git push)"` 및 그 backtick-쌍 변형 두 케이스 모두 legacy 정규식은 정상 차단하던 것이라 신규 회귀로 확인(`old ⊆ new` 위반) | `_find_command_substitutions`(280-286행), 호출부 `_is_git_push`(494-497행) | 미종료/미스페어링(홀수 개 backtick) 시 첫 backtick부터 문자열 끝까지 통째로 over-inclusive span으로 흡수하도록 재설계. 반례를 `MUST_BLOCK`+`LegacyRegressionDifferentialTest`에 회귀 테스트로 고정, 수정 전 FAIL 재현을 먼저 확인(비-vacuity) |
| 3 | 요구사항 | `_shell_dash_c_argument`/`_eval_argument`가 `_git_subcommand`에 이미 있는 `_ENV_ASSIGN`(env 대입 토큰) skip 로직을 재사용하지 않아, `FOO=1 bash -c "git push"` / `FOO=1 eval "git push"`에서 `segment[0]`이 `"FOO=1"`로 오검사되어 간접실행 재귀 자체가 시작되지 않음. legacy 정규식은 원래도 못 잡던 케이스라 회귀는 아니지만, plan 문서는 `-c`/`eval` 간접실행을 "closed in the same pass"로 명시 선언했고 이 변형은 그 범위 밖 잔여 한계로도 등재돼 있지 않음 | `_shell_dash_c_argument`(355-358행), `_eval_argument`(377행) | 두 헬퍼 진입 시 `_git_subcommand`와 동일한 `_ENV_ASSIGN` skip 루프(또는 공용 헬퍼로 추출) 적용 후 첫 실토큰 검사. `FOO=1 bash -c "git push"`/`FOO=1 eval "git push"`(+ `MUST_ALLOW` 대응 케이스: `FOO=1 bash -c "echo hi"`) 회귀 테스트 추가 |
| 4 | 테스트 | 제어문자(NUL 등) 또는 shlex 파싱 실패(따옴표 불균형)가 있으면 `_is_git_push`가 세그먼트 분석·간접실행 재귀(이번 diff의 핵심 목표)를 전혀 타지 않고 곧바로 legacy fallback 정규식으로 직행 — 이 fallback은 `-c`/`eval`/`$(...)`를 애초에 인식하지 못함. `bash -c "git push\x00"` / `eval "git push\x00"` / `echo "$(git push\x00)"` / `bash -c "git push`(따옴표 미종료) / `eval "git push`(따옴표 미종료) 5종 전부 `False` 실측 확인. `ResidualLimitationsTest`에 의도적 한계로도 등재돼 있지 않은 미검증 갭 | `_is_git_push`(455-465행, hostile-control-char·`ValueError` 조기 반환), `_has_hostile_control_characters`(184-192행) | 조기 반환 전에 `-c`/`eval`/`$(...)` 스팬을 먼저 추출·재귀 검사하도록 순서 변경하거나, 의도적 잔여 한계로 확정한다면 `ResidualLimitationsTest`에 명시 pin. 위 5개 조합 케이스를 `RecursiveIndirectionTest`에 회귀 테스트로 추가 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 | `main()`이 REVIEW/PLAN 두 게이트 호출은 `try/except`로 감싸면서, 그 앞단의 "이게 push인가?" 판정(`_is_git_push`) 호출은 아무 보호 없이 실행. 변경 전엔 한 줄짜리 정규식이라 예외를 사실상 던질 수 없어 무해했지만, 이번 diff로 재귀·토큰화를 포함한 8개 함수로 표면적이 커지며 방어 비대칭이 생김. 퍼징(5000자 반복 문자열, 불균형 따옴표/백틱, 외톨이 서로게이트 등)으로 실제 크래시는 재현되지 않아 증명된 버그는 아니고 방어 일관성 공백 | `main()`:528(무보호) vs :533-537·:544-548(REVIEW/PLAN 게이트, `try/except` 보호) | `_is_git_push(command)` 호출을 `try/except Exception`으로 감싸고, 예외 시 (다른 두 게이트의 fail-open과 의도적으로 다르게) **fail-closed**(판정 불가 ⇒ push로 간주해 REVIEW/PLAN 게이트를 계속 평가)로 처리 |
| 2 | 보안 | 모듈이 스스로 "hard gate"("리뷰 없는 push를 차단하는 유일 안전장치")로 서술하지만, 내부적으로 3중 fail-open 경로(`_lib` import 실패 / `evaluate_review`·`evaluate_plan` 호출 중 예외 / `main()` 자체의 미처리 예외)를 가짐. 코드 주석상 의도된 트레이드오프로 보이나, 이 게이트의 유일 존재 목적과는 긴장 관계 | 40-49행, 532-540행·543-554행(fail-open 블록), 27-39행(모듈 docstring "hard gate" 서술), 560행 | fail-open 발생 시 stderr 로그를 CI/사전-push 알림 등으로 감시하거나 "연속 N회 fail-open 시 경고" 같은 안전장치 고려. 최소한 모듈 docstring에 "예외 시 fail-open" 한계를 한 줄 명시해 기대치 정합 |
| 3 | 아키텍처 | `_is_git_push` 판정 엔진(~350줄)이 이 프로젝트의 `_lib/` 관례("판정 로직은 `_lib/`, 훅 파일은 얇은 오케스트레이션")를 벗어나 훅 엔트리포인트에 직접 내장돼 파일 전체 560줄 중 대부분을 차지. 동일 질문("이 Bash 명령이 어떤 git 서브커맨드를 실행하는가")을 자매 훅 `guard_default_branch_bash.py`가 셸 인용·간접실행을 전혀 모르는 훨씬 약한 단순 정규식(`_MUTATING`)으로 독립 재구현 중이라, 3세션에 걸친 이번 하드닝의 혜택을 전혀 못 받음(단 그 훅은 "never blocks, misclassification only injects a harmless reminder" soft-fail 설계라 당장 위험은 낮음) | `guard_review_before_push.py:57-480` vs `guard_default_branch_bash.py:60-81` | `_tokenize`~`_is_git_push`(+지원 상수)를 `.claude/hooks/_lib/git_command_detection.py`로 추출해 다른 `_lib` 모듈과 같은 컨벤션으로 정렬하고 `guard_default_branch_bash.py`도 재사용 가능하게. 이번 PR 비차단, 후속 plan 항목으로 추적 권장 |
| 4 | 요구사항 | `.claude/tests/README.md`("간접실행은 전부 차단됨")와 `LegacyRegressionDifferentialTest` 코퍼스가 암묵적으로 보장하는 커버리지가, 실제로는 위 Critical #2·#3이 보여주듯 "backtick 앞에 홀수개의 무관한 backtick이 먼저 나오는 경우"·"env 접두가 붙은 `-c`/`eval`" 두 케이스만큼 좁음 | `.claude/tests/README.md:32`, `test_push_detection.py:1111-1216`(`LegacyRegressionDifferentialTest`) | Critical #2·#3 수정 후 해당 반례를 `MUST_BLOCK`/`INDIRECT_EXECUTION_CASES` 코퍼스에 편입시켜 README의 주장과 코퍼스 실제 커버리지를 재정합 |
| 5 | 유지보수성 | `_read_payload()`와 "환경변수 우회 확인 → try/except로 감싼 evaluate 호출 → 실패 시 traceback 출력 후 `None`으로 fail-open" 골격이 자매 훅 `guard_review_before_stop.py`와 바이트 단위로 완전히 동일하게 중복(각 파일에서 2회씩, 총 4회 반복). 두 훅 모두 이미 `_lib/`를 공유 임포트하고 있어 결합도를 늘리지 않고도 추출할 구조적 여지가 충분 | `guard_review_before_push.py` L220-227(`_read_payload`), L558-580(REVIEW/PLAN 블록) vs `guard_review_before_stop.py` L79-86, L245-267 | `_lib/`에 `hook_io.py`(`read_payload()`) 또는 `evaluate_fail_open(fn)` 같은 얇은 헬퍼를 추가해 두 훅에서 임포트 — 한쪽만 고쳐지고 다른 쪽이 드리프트하는 사고(예: JSON 파싱 엣지케이스 수정 누락) 예방 |
| 6 | 테스트 | `main()` 훅 진입점 — exit code 0/2, REVIEW/PLAN 게이트 오케스트레이션 순서, `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 환경변수 우회, `evaluate_review`/`evaluate_plan` import 실패·호출 예외 시 fail-open, stdin JSON 파싱 실패 처리 — 가 `.claude/tests/*.py` 어디에도 exercise되지 않음. `main()` 자체는 이번 diff로 신설된 갭은 아니지만(origin/main 대비 무변경), `_is_git_push`의 동작이 이번 diff로 크게 바뀐 만큼 그 결과를 소비하는 최종 진입점의 무검증 상태가 상대적으로 더 두드러짐 | `guard_review_before_push.py:523-556`(`main`), `:194-201`(`_read_payload`) | `subprocess.run([sys.executable, "guard_review_before_push.py"], input=json.dumps(payload), ...)` 형태의 e2e 테스트, 또는 `evaluate_review`/`evaluate_plan`을 `unittest.mock.patch`로 주입해 exit code·stderr 문구까지 검증하는 통합 테스트를 별도 파일(`test_guard_review_before_push_main.py`)로 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/부작용 | 모든 Bash 호출마다(`git push` 여부와 무관하게) 3중 O(n) 문자열 스캔이 실행됨 — 의도된 트레이드오프로 이미 문서화(timeit 실측 대표 명령 6종 평균 ~6-24us vs 프로세스 기동 ~13ms). side_effect 리뷰어가 재귀 비용을 직접 계측(형제 `$(...)` 노드 수 3/5/8로 늘려 누적 스캔 문자수 확인)해 원본 대비 항상 ~3.6-3.9배(≈`_MAX_RECURSION_DEPTH`+1)로 일정함을 확인 — O(depth×n) 선형이며 지수 폭발 없음을 교차검증. 다만 performance 리뷰어는 그 실측이 전형적 명령 길이 기준이며, 이 저장소의 대형 heredoc 커밋 메시지류까지 결론이 일반화되는지는 별도 측정되지 않았다고 지적 | `_is_git_push`(398-491행) 전체, 훅은 모든 Bash 호출에 등록 | 조치 불요. 필요 시 command 길이 분포(heredoc 포함) 실측을 추가하거나 docstring에 측정 범위 caveat 추가 |
| 2 | 성능 | REVIEW/PLAN 두 게이트가 각자 독립적으로 유사한 git 서브프로세스(브랜치 diff 파일 목록 등)를 호출해 중복 I/O가 발생하는지는 `_lib/review_guard.py`/`plan_guard.py`가 이번 리뷰 스코프(2개 파일) 밖이라 확인 불가(단 `_is_git_push`가 True일 때만 지연 호출되므로 영향은 제한적) | `main()`:534(`evaluate_review()`), :545(`evaluate_plan()`) | 두 `_lib` 모듈을 별도로 검토할 기회가 있으면 공유 가능한 계산의 중복 여부 확인 가치 있음 |
| 3 | 아키텍처 | 간접실행 리졸버(`_shell_dash_c_argument`/`_eval_argument`)가 확장 가능한 리스트가 아닌 순차 if/else 체인(리졸버 2개뿐이라 현재는 무해) + `_git_subcommand()`가 "확정 파싱"과 "보수적 추측"을 같은 `str \| None` 반환 타입에 섞음(유일 호출부가 `== "push"` 비교만 해 현재 무해, 직전 리뷰에서도 이미 지적된 사항) | `_segment_runs_push`(382-397행), `_git_subcommand`(338행) | 조치 불요. WARNING #3(`_lib/` 추출) 시점에 함께 고려 |
| 4 | 요구사항 | `spec/`에는 이 harness 훅을 규정하는 문서가 전무(grep 결과 `guard_review_before_push`/`_is_git_push`/`review_guard` 참조 0건) — 대신 `plan/in-progress/harness-session-anchor-guards.md` §②와 `.claude/tests/README.md`를 대용 spec으로 사용해 리뷰를 수행. 위 Critical 4건은 project-planner 개입이 필요한 SPEC-DRIFT가 아닌 순수 코드 결함으로 확인됨 | 해당 없음 | 조치 불요(참고 기록) |
| 5 | 보안 | `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 환경변수 검사는 훅 자신의 `os.environ`만 본다. `BYPASS_REVIEW_GUARD=1 git push`처럼 커맨드 문자열에 인라인으로 넣어도 훅의 `os.environ`에는 반영 안 되는 것이 정상 기대지만, harness가 훅 프로세스를 스폰할 때 Bash 호출 시점 환경을 그대로 물려주는지는 이 두 파일 범위 밖이라 확정 불가 | `main()`:532, :543 | harness 쪽에서 훅 프로세스가 상속하는 환경이 Bash 명령의 inline env prefix와 무관함을 한 번 명시적으로 확인/문서화 |
| 6 | 유지보수성 | 3회 리뷰 세션(`17_09_10`/`18_04_20`/`19_15_56`) 이력이 "Critical #N"/"WARNING #N" 형태로 인라인 주석에 계속 누적돼 파일이 27KB로 비대화(자매 훅 `guard_review_before_stop.py` 12KB 대비). 회귀 방지 근거 기록으로는 유효하나 다음 세션에도 같은 패턴이 반복되면 코드 본문 대비 주석 비율이 더 벌어질 우려 | 파일 전반 ~20곳(예: L66, L97, L235, L411) | 핵심 불변식만 인라인에 남기고 세션별 상세 측정 이력은 전용 문서(예: `.claude/docs/push-guard-parsing.md`)로 이전, 인라인에는 짧은 포인터만 유지 고려 |
| 7 | 유지보수성 | "plan의 잔여 한계 섹션" 참조가 구체 파일 경로를 명시하지 않아, plan이 관례대로 `plan/complete/`로 이동한 뒤에는 추적이 더 어려워짐(파일명이 없어 "링크가 깨졌다"는 신호조차 없음) | L287, L474 부근 | 참조 시 최소한 plan 파일명 명시(`plan/in-progress/harness-session-anchor-guards.md` 등) |
| 8 | 유지보수성 | `main()`의 REVIEW/PLAN 게이트 블록이 "환경변수 우회 확인 → try/except fail-open → 조건 만족 시 메시지 포맷 후 `return 2`" 골격을 거의 동형으로 반복(파일 내부) | `main()` L557-580 | WARNING #5의 `_lib` 헬퍼 추출과 함께 검토 여지(시급하지 않음) |
| 9 | 유지보수성 | exit 코드 0/2가 `main()` 전반에 리터럴로 산재. 모듈 docstring에 계약이 명문화돼 있어 오독 위험은 낮으나, 자매 훅(`guard_review_before_stop.py`)은 `_allow()`/`_block(reason)` 명명 헬퍼로 각 반환 지점을 자기설명적으로 만듦 | `main()` L555, L566, L580, L582 | 대칭성·자기설명성을 위해 동일한 `_allow()`/`_block(msg)` 헬퍼 도입 고려(경미, 선택적) |
| 10 | 테스트 | `_MAX_RECURSION_DEPTH` 캡 경계 테스트가 `_find_command_substitutions`(`$(...)`) 재귀 경로로만 검증되고, `_segment_runs_push`(`-c`/`eval` 체인)의 동일 depth 체크는 별도로 pin 안 됨. 현재는 두 경로가 같은 상수·부등호를 공유해 위험 낮으나 향후 분기 시 사각지대 가능 | `test_recursion_depth_is_capped`, `_segment_runs_push`(390행) | `bash -c` 체인 버전 캡 테스트 짝 추가(`guard._is_git_push('bash -c "git push"', guard._MAX_RECURSION_DEPTH)` → `False`, one-below-cap → `True`) |
| 11 | 테스트 | `main()`이 `sys.stdin`/`os.environ`을 전역으로 직접 읽어, WARNING #6의 통합 테스트 작성 시 몽키패치나 서브프로세스 기동이 필요 | `_read_payload`(194-201행), :532, :543 | 필수는 아니나 WARNING #6 테스트 작성 시 `payload`/`env`를 매개변수로 받는 `run(payload, env) -> int` 분리를 함께 고려 |
| 12 | 테스트 | 트레일링 값-옵션(`git -C`, 값 없이 끝)·다중 env 대입(`FOO=1 BAR=2 git push`) 경계가 명시적으로 pin 안 됨(직접 실행 확인 결과 `IndexError` 없이 각각 `None`/`"push"` 정상 반환 — 실제 위험은 낮음) | `_git_subcommand`(339-360행) | 우선순위 낮음. 여유 시 `test_subcommand_skips_global_options_and_their_values` 옆에 회귀 테스트 1-2줄 추가 |
| 13 | 문서화 | 테스트 독스트링의 "only `-C` was exercised" 서술이 근소하게 부정확 — `MUST_BLOCK`의 `git -c user.name="a b" push` 케이스로 `-c`도 이미 개별 검증되고 있었음(테이블-드리븐 테스트 자체는 9개 항목 모두 정확히 커버해 기능·안전성 무관) | `test_all_value_taking_global_options_skip_their_value` 독스트링 | "only `-C`/`-c` were exercised" 등으로 근소 수정. 우선순위 매우 낮음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | `$'push'`/`$"push"` ANSI-C/locale quoting — legacy 대비 회귀로 게이트 완전 우회 |
| requirement | CRITICAL | backtick 조기 `break`(legacy 대비 회귀) + `-c`/`eval` env-prefix 미스킵, 2건 독립 CRITICAL |
| testing | HIGH | 제어문자/파싱실패 폴백이 간접실행 재귀를 완전 무력화(미검증 false negative) + `main()` 완전 미검증 |
| side_effect | LOW | `main()`의 `_is_git_push` 호출에 예외 보호 비대칭(다른 두 게이트만 보호됨) |
| architecture | LOW | 판정 엔진이 `_lib/` 관례 이탈 + 자매 훅이 훨씬 약한 로직으로 독립 재구현 |
| maintainability | LOW | `_read_payload`/fail-open 블록이 자매 훅과 바이트 단위 중복 |
| performance | LOW | 모든 Bash 호출 3중 O(n) 스캔 — 의도된 트레이드오프, 지수 폭발 없음 확인 |
| documentation | NONE | 문서화 수준 우수(핵심 주장 실측 재현으로 검증), 독스트링 1건 근소 부정확 |
| scope | NONE | 전 diff가 문서화된 결함에 1:1 대응, 스코프 이탈 없음 |
| dependency | NONE | 신규 의존성은 stdlib `shlex` 뿐, "zero third-party deps" 관례 준수 |
| database | NONE | 해당 없음(DB 관련 코드 없음) |
| concurrency | NONE | 해당 없음(단일 스레드 동기 로직, 공유 가변 상태 없음) |
| api_contract | NONE | 해당 없음(API 표면 변경 없음) |
| user_guide_sync | NONE | 해당 없음, doc-sync-matrix 매칭 트리거 0건 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync, scope, dependency — 리뷰 대상(harness 훅 2개 파일)이 각 관점(DB/동시성/API 계약/사용자 가이드 동기화/변경범위/의존성)에서 다룰 대상이 없거나(N/A), 변경분이 문서화된 결함(직전 두 리뷰 세션의 Critical/Warning 표)에 정확히 대응해 스코프 이탈이 없음을 확인.

## 권장 조치사항

1. **CRITICAL 4건 수정** — (a) `$'...'`/`$"..."` ANSI-C/locale quoting 디코드, (b) `_find_command_substitutions`의 backtick 미종료/미스페어링을 over-inclusive 흡수로 재설계, (c) `_shell_dash_c_argument`/`_eval_argument`에 `_ENV_ASSIGN` skip 로직 재사용, (d) 제어문자/파싱실패 조기반환을 간접실행 추출 이후로 재정렬(또는 `ResidualLimitationsTest`로 명시 pin). 각 수정 전 "수정 전 코드에서 FAIL 함을 먼저 확인"하는 비-vacuity 절차를 따르고, `MUST_BLOCK`+`LegacyRegressionDifferentialTest`(+ 필요 시 `INDIRECT_EXECUTION_CASES`/`RecursiveIndirectionTest`) 코퍼스에 반례를 회귀 테스트로 고정할 것.
2. **`main()`의 `_is_git_push()` 호출을 예외로부터 보호** — try/except로 감싸고, 다른 두 게이트(fail-open)와 의도적으로 비대칭하게 **fail-closed**(판정 불가 시 push로 간주해 게이트를 계속 평가) 처리.
3. **`main()` 훅 진입점 통합/e2e 테스트 신설** — exit code, 게이트 오케스트레이션 순서, env bypass, import 실패·evaluate 예외 시 fail-open, stdin 파싱 실패까지 커버.
4. **README.md/`LegacyRegressionDifferentialTest` 코퍼스 재정합** — 1번 수정 후 반례를 코퍼스에 편입해 "간접실행 전부 차단" 서술과 실제 커버리지를 일치시킬 것.
5. **(후속, 비차단)** `_is_git_push` 판정 엔진을 `_lib/git_command_detection.py`로 추출해 `guard_default_branch_bash.py`와 공유, `_read_payload`/fail-open 블록을 `_lib/hook_io.py` 류로 추출해 `guard_review_before_stop.py`와 공유.
6. **(후속, 비차단)** 세션별 이력 주석 비대화 완화 — 핵심 불변식만 인라인 유지, 상세 측정 이력은 전용 문서로 이전. plan 참조에는 파일 경로 명시.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유 미기재(prompt에 `routing_skip_reason` 없음). 전체 14개 reviewer가 무조건 실행됨.
- **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (6명) — 전원 결과 확보됨(누락 없음).
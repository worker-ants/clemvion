# RESOLUTION — review/code/2026/07/17/17_09_10

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 (개행-단독 구분 미탐지) | 코드 | `2c4e96eb4` | `_tokenize()` 의 `punctuation_chars` 에 `\n` 추가 + `whitespace` 에서 제거. `&&\n` 같은 결합 토큰까지 잡도록 세그먼트 경계 판정을 정확 토큰-일치(`_SEGMENT_SEPARATORS`)에서 "토큰이 구분자 문자로만 구성됐는가"(`_SEGMENT_SEPARATOR_CHARS` + `_is_segment_boundary()`)로 교체. `<`/`>` 는 구분자 문자 집합에서 제외(리다이렉트) |
| Critical #2 (인용부호 분할이 사전 필터 우회) | 코드 | `2c4e96eb4` | `_is_git_push()` 첫 줄의 토큰화-이전 원시 substring 필터(`"push" not in command`) 제거. hot-path 성능 영향 `timeit` 실측: 대표 명령 6종 평균 tokenize 비용 6~24us, 훅이 매 호출 지불하는 python3 기동 비용(~13ms) 대비 3자릿수 작아 무관측 |
| Critical #3 (git 런처 대소문자) | 코드 | `2c4e96eb4` | `_git_subcommand()` 의 `os.path.basename(...) != "git"` 비교를 `.lower()` 로 정규화 |
| Critical #4 (미등록 글로벌 옵션 fail-open) | 코드 | `2c4e96eb4` | `--attr-source` 를 `_GIT_OPTS_WITH_VALUE` 에 추가(점 patch) + 구조적 fix — 내장값(`=`) 없는 미지 옵션은 "다음 토큰=서브커맨드"로 단정하지 않고 세그먼트 나머지에 `push` 가 있으면 보수적으로 차단(fail-closed). 별도 회귀 테스트로 `--attr-source` 없이도 구조적 fix 만으로 통과함을 고정 |
| Warning #1 (plan 검증 체크리스트 과장) | 코드(문서) | `6d578cbbb` | plan 문서에 "review 후속 수정" 절 신설(Critical #1-4 원인·수정 표) + "### 검증" 체크리스트·"잔여 한계" 갱신 |
| Warning #2 (`--keep` 다회 지정 미검증) | 코드(테스트) | `8783d7b12` | `test_reap_merged_worktrees.py` 에 `--keep A --keep B` 동시 지정 케이스 추가. 로직 자체는 버그 아님(기존 동작 확인) — 커버리지만 추가 |
| Warning #3 (`_GIT_OPTS_WITH_VALUE` 커버리지 6/8 누락) | 코드(테스트) | `2c4e96eb4` | `test_push_detection.py` 에 `_GIT_OPTS_WITH_VALUE` 9개(+ 신규 `--attr-source`) 전항목 파라미터화 테이블 테스트 추가 |

INFO 18건은 자동 수정 대상 아님 — 아래 "보류·후속 항목" 참고. spec 관련 항목 0건(전부 `.claude/**` 하네스 코드/테스트 + `plan/**` 문서).

## TEST 결과

- lint  : 해당 없음 — 이번 diff 는 `.claude/**`(Python 하네스) + `plan/**`(문서) 만 변경하고 `codebase/**` 는 무변경이라 pnpm lint 파이프라인(`cmd_lint`) 대상 파일이 없음. `python3 -m py_compile`로 구문 검증 통과 + 아래 unit 스위트가 이 하네스 코드의 실질 검증 수단(`.claude/tests/README.md` 컨벤션 — 별도 flake8/ruff 설정 없음)
- unit  : 통과 — `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` **264 → 269건** 전체 통과(신규 5건: 회귀 4개 테스트 메서드 + `--keep` 커버리지 1개 메서드; 그 외 MUST_BLOCK 6개 케이스는 기존 `test_blocks_real_pushes` 의 subTest로 편입). `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` **93건** 전체 통과(plan 파일 변경 — 필수 게이트)
- build : 해당 없음 — `codebase/**` 무변경
- e2e   : 면제 (화이트리스트: `PROJECT.md §e2e 면제 화이트리스트`의 `.claude/**`(skills, hooks, agents 정의) 및 `spec/** · plan/** · review/** · ...` 두 항목 — 이번 diff 의 변경 파일 전체가 그 부분집합: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_detection.py`, `.claude/tests/test_reap_merged_worktrees.py`, `plan/in-progress/harness-session-anchor-guards.md`)

### 비-vacuity 증거

신규 회귀 테스트(MUST_BLOCK 6건 + 전용 테스트 메서드 4건, 총 10개 지점)를 코드 수정 **이전**에 먼저 추가해 실행 → 9건이 예측대로 FAIL, 1건(`test_all_value_taking_global_options_skip_their_value`, Warning #3)은 이미 PASS(로직 결함이 아니라는 SUMMARY 서술과 일치, 커버리지 갭만 존재). 수정 후 재실행 → 전부 PASS.

프롬프트가 "절대 깨지면 안 된다"고 지정한 MUST_ALLOW 2건도 수정 후 명시적으로 재확인:
- heredoc 이 커밋 메시지 본문에서 push 를 *언급*만 하는 경우 → `False` (허용) 유지
- 따옴표 안 `\|` 를 가진 grep → `False` (허용) 유지

## 보류·후속 항목

- INFO #1 (`eval`/`bash -c` 등 인터프리터 래퍼 전체 미탐지, 신·구 코드 동일 — 정적 토큰 가드의 구조적 한계): 조치 없음(plan "잔여 한계"에 이미 인지 기록)
- INFO #2 (`--keep` 값 미검증이지만 pass1 필터로 실위험 없음): 조치 없음(선택적 sanity check, 필수 아님)
- INFO #3 (`bootstrap-session.sh` 앵커 계산 실패 시 무경고): 조치 없음(선택, 실패 방향이 안전)
- INFO #4~#7 (성능 — hot-path 토크나이저, `is_kept()` subprocess fork, 순서 최적화 확인, 신규 테스트로 인한 스위트 시간 소폭 증가): 전부 조치 불요로 판정된 항목, 그대로 둠
- INFO #8~#10 (범위 — 두 결함 묶음 정당화됨, plan frontmatter worktree 불일치는 사실 오류 아님, `--keep` repeatable 선제 설계): 조치 불요
- INFO #11~#13 (유지보수성 — 세그먼트 판정 중복, `keep_paths` 리터럴 개행, 진단 서술 5곳 반복): 스타일 수준, 이번 세션에서 미반영(급하지 않음, 필요 시 별도 후속)
- INFO #14 (`test_reap_merged_worktrees.py` 가 `.claude/tests/README.md` 커버리지 표에 없음 — 이 PR 이전부터의 pre-existing 누락): 미반영. 전체 감사는 별도 후속 권장(SUMMARY 원문 그대로)
- INFO #15 (`guard_review_before_push.main()` 자체의 subprocess 수준 통합 테스트 부재): 미반영, 후속 과제
- INFO #16 (세그먼트 처리 대칭 케이스 일부 미검증): 미반영, 선택 사항
- INFO #17 (plan 문서의 "테스트 8건 추가" 서술과 실제 9건 diff 개수 불일치 서술): 미반영 — Warning #1 조치로 plan 문서를 이미 큰 폭으로 갱신했으므로 문구 표현 세부는 이번 세션 범위 밖으로 유보
- INFO #18 (`test_quoted_pipe_is_not_a_segment_separator`의 docstring 이 plan 전용 "B-case" 레이블을 자기완결 설명 없이 인용): 미반영, 선택 사항
- 잔여 한계 (수용, plan 문서에 명시): heredoc/커밋 메시지 본문의 한 줄이 그 자체로 `git push` 처럼 보이면 여전히 BLOCK(fail-safe 방향, 프롬프트가 명시적으로 수용 가능하다고 확인한 트레이드오프). Critical #4 의 구조적 fail-closed 로 인해 이론상 "미지 옵션 뒤 우연히 push 값이 오는 비-push 명령"도 BLOCK 될 수 있음(false positive 방향, 실재하는 git 옵션 중엔 해당 사례 없음)
- spec draft 위임: 없음(spec 관련 항목 0건)

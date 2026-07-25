# RESOLUTION — line-continuation fold 의 두 CRITICAL

CRITICAL 2 / WARNING 3. 직전 라운드에서 **내가 넣은 fold 가 새 우회를 만들었고**, 둘 다 실측
확증 후 수정했다.

## 조치 항목

| # | 판정 | 조치 | 실측 근거 |
|---|---|---|---|
| C1 | 수용 | fold 를 **parity 인식** 정규식으로 (`(?<!\\)((?:\\\\)*)\\\n`) | `\\` 는 리터럴 백슬래시 + **진짜 개행**이라 shell 이 **두 명령**을 실행한다(직접 실행해 `a\` 출력 + `git version` 확인). blind `.replace` 가 그 개행을 지워 `git push` 앞 separator 를 없앴다 → 미탐지 |
| C2 | 수용 | 치환을 `""` 로, fold 를 **early-return 이전**으로 | shell 은 두 문자를 **삭제**하므로 `git pu\<개행>sh` 는 한 단어 `push`. 공백 치환은 `pu sh` 로 남겼고, `"push" not in command` 가 fold 앞에 있어 애초에 도달도 못 했다 |
| W3 | 수용 | plan 체크리스트 4건을 실제 상태로 갱신 | revert 가 §N 커밋의 plan 갱신까지 되돌려 미체크로 남아 있었다 |
| W4 | 수용 | corpus SoR 축약 경로(`plan/.../`) → 정식 경로 | |
| W5 | 수용 | `_LINE_CONTINUATION` 주석에 SoR 포인터 추가 | |

INFO 반영: `_is_git_push` docstring 에 fold 단계 명시. 미러(`blind_is_push`)도 동일 fold 사용 —
그건 release 가 아니라 **탐지 전처리**라, 빼두면 `test_no_new_blocks` 가 넓어진 탐지를
"allowlist 가 스스로 차단하기 시작했다" 로 오독한다.

## 진단에 시간을 쓴 곳 — stale `__pycache__`

수정 후 2건이 계속 실패했는데, 단계별로 재현하면 전부 통과였다(`fold` → `git push origin main`,
`search` → True). `inspect.getsource` 는 **파일을 직접 읽어** 최신 소스를 보여주는데 실행은
옛 바이트코드였다 — `_unfold_continuations` 를 spy 로 감싸도 호출 로그가 안 찍혀서 확정했다.
`__pycache__` 제거 후 4/4 통과. **코드가 옳은데 테스트가 틀릴 때 의심할 것**으로 기록해 둔다.

## 비-vacuity 검증

| 뮤턴트 | 결과 |
|---|---|
| parity 무시(첫 버전 blind replace 재주입) | `test_even_backslash_run_is_not_a_continuation` **5 failed** |
| fold 를 early-return 뒤로 (C2 재주입) | `test_continuation_inside_the_word_is_joined` **2 failed** |

## 성능

fold 는 모든 Bash 호출 경로에 있으므로 측정했다 — continuation 없는 명령(대다수)
**0.00 ms**(빠른 membership 체크로 조기 반환), continuation 40k **11.7 ms**.

## TEST 결과

- lint: 해당 없음(Python 훅 — harness 스위트가 검증)
- unit: **harness 663 passed, 570 subtests**
- build: 해당 없음(`codebase/**` 변경 0)
- e2e: **면제** — diff 가 `.claude/**` + `plan/**` + `review/**` 뿐

## 보류·후속 항목

- INFO9(자매 훅 `guard_default_branch_bash` 에 fold 미적용) — 그 훅은 **차단하지 않는** soft
  reminder 이고 `_SEGMENT_SPLIT` 이 개행을 이미 구분자로 처리한다. 이번 범위 밖.

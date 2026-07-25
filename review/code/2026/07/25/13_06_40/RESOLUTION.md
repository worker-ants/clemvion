# RESOLUTION — 2회차 (§M(d)(e))

CRITICAL 2 / WARNING 4. **둘 다 실측으로 확증하고 수정**했다. 하나는 선재, 하나는 **§M 이
스스로 만든 것**이다.

## 조치 항목

| # | 판정 | 조치 | 실측 근거 |
|---|---|---|---|
| C1 | 수용 | separator 클래스에 `&`(bash 백그라운드 연산자) 추가 → §M(d) | `sleep 5 & git push` = `_is_git_push` **False**(우회 확증). **선재** — legacy 도 놓친다. 자매 훅 `guard_default_branch_bash._SEGMENT_SPLIT` 은 `&` 를 계속 갖고 있었다 — 그 비교를 했으면 세 번 전에 잡혔을 결함 |
| C2 | 수용 | tail `[^&;|]*` → `[^&;|\n]*` → §M(e) | 6k 줄=3.7s · 12k=**14.7s**(×2→×4). **§M(a) 이 만든 결함**: §M 이전 같은 입력 **2.8ms**(그땐 `^` 만 시작점이라 tail 이 1회 스캔). `\n` 을 separator 로 만드니 모든 `git` 줄이 시작점이 됐다 → 수정 후 **2.4ms** |
| W1 | 수용 | 비-commit heredoc 본문의 push 를 `CORPUS` 에 **accepted FP** 로 pin | 과차단=안전 방향. 이 스위트의 "놀라움 대신 가시성" 철학에 맞춤 |
| W2 | 수용(설계 변경) | 생성 축 vacuity → **축 동등성** 단언으로 교체 | 아래 §내가 한 번 틀렸다 |
| W3 | 수용 | 벤치 수치 불일치(5ms vs 10ms) → **크기 표기 누락**이 원인. 재측정 후 크기 명시 | 20k=**5.2ms**, 40k=**9.6ms** — 둘 다 맞았고 어느 크기인지가 빠져 있었다 |
| W4 | 미조치 | `_MUTATING` 압축 한 줄 재포맷 | 순수 스타일. 이번 diff 의 논리와 무관하고, 이 정규식은 byte-identical 불변식이 걸려 있어 포맷 변경도 drift 표면이다 — 별도 정리 패스가 맞다 |

INFO 반영: #2(생성 축에 `&` 추가 — 이 축이 없어 C1 을 사전에 못 잡았다) · #3(6.5s→6.3s 통일) ·
#4(stale plan 경로 `in-progress`→`complete`) · #5(테스트 수 시점 명시).

## 내가 한 번 틀렸다 — W2 를 고치다 과한 단언을 썼다

W2("`\n` 축이 vacuous")를 "생성된 모든 케이스가 탐지돼야 한다" 로 고쳤더니 **27건 실패**했다.
확인해보니:

- 전부 **닫히지 않은 따옴표 + 다중 공백**(`A='x y git push`) 형태였고,
- **§M 이전에도 미탐지**(선재)이며,
- 무엇보다 **bash 가 이 텍스트를 실행하지 못한다** — `bash -n` → `unexpected EOF`.

즉 내 단언이 "게이트가 지킨 적도 없고 지킬 필요도 없는 것" 을 요구했다. 올바른 불변식은
**separator 선택이 답을 바꾸면 안 된다** 이므로, `&&`(legacy floor 가 덮는 기준 축) 대비
`\n`·`&` 의 판정이 값 shape 별로 **동일한지**를 비교하도록 바꿨다. 리뷰어가 예시한 뮤턴트
(`\n` 뒤 값 파싱이 갈리는 형태)를 실제로 잡는 것을 확인했다.

## 비-vacuity 검증

| 뮤턴트 | 실측 |
|---|---|
| separator 에서 `&` 제거 (C1 재주입) | **30 failed** |
| tail 에서 `\n` 제외 되돌림 (C2 재주입) | **10s timeout FAILED** |
| separator 후 whitespace 를 `[ ]*` 로 (축 동등성 겨냥) | **3 failed** (탭 축 갈림) |

## TEST 결과

- lint: 해당 없음(Python 훅 — harness 스위트가 검증)
- unit: **harness 654 passed, 474 subtests**
- build: 해당 없음(`codebase/**` 변경 0)
- e2e: **면제** — diff 가 `.claude/**` + `plan/**` + `review/**` 뿐. PROJECT.md §e2e 면제
  화이트리스트의 harness/문서 전용 변경.

## 보류·후속 항목

- W4(정규식 포맷 통일) — 별도 정리 패스. 기존 `harness-env-value-subpattern-dedup`(P3) 이
  같은 파일의 표현 통일을 다루므로 그 티켓에서 함께 판단하는 것이 자연스럽다.

# RESOLUTION — C won't-do 종결 + 넛지 FN 해소

리뷰: `review/code/2026/07/23/20_02_29/SUMMARY.md` — RISK=**LOW**, **Critical 0**, Warning 3.
forced 7명 전원 확보(`forced_missing: []`).

**Warning 3건 전부 반영.** 그리고 W1 을 추적하다 **원 리뷰가 보지 못한 차단성 결함**을
push 가드에서 실측 발견했다(아래 §J).

## Warning (3) — 전부 반영

### W1 — `VAR=value` 접두가 따옴표 안 공백에서 끊긴다 (requirement, testing)

재현: `GIT_SSH_COMMAND="ssh -i ~/.key" git commit -m "x"` → `_is_mutating` **False**.
`\S+` 가 공백에서 끊겨 명령이 `~/.key"` 로 시작하는 것처럼 보인다. **이번 diff 의 목적(FN 해소)과
정면으로 충돌**하는 잔여 갭이므로 최우선 반영.

→ 값을 `(?:'[^']*'|"[^"]*"|[^\s'"]\S*)` 로 확장. 세 대안은 **첫 글자로 서로소**라 항상 하나만
적용된다. `test_quoted_env_value_containing_spaces_is_skipped` 4건 + read-only 비승격 2건 추가.

### W2 — push 가드와 정규식 중복 (maintainability)

실측 확인: `guard_review_before_push.py:120,127` 에 `_SEGMENT_IS_GIT`(동일 env 접두 패턴)·
`_SEGMENT_SPLIT` 존재. 지적 타당.

→ **추출 대신 양방향 상호 참조 주석.** 추출은 §C 에서 방금 "이득 0" 으로 닫은 것과 같은 판단이고
(두 훅의 방향이 반대: 한쪽은 늦은 경계 = 해제 안 함 = 안전, 다른 쪽은 오탐 넛지), 실제 위험은
"한쪽만 고쳐진다" 이므로 주석이 그 위험을 정확히 겨냥한다. 주석에 §J 도 함께 적었다.

### W3 — 개행 분할이 두 번째 오탐 클래스를 연다 (testing)

재현: `cat <<'EOF' > notes.txt\nmkdir the new feature folder\nEOF` → **True**.
README 와 테스트 docstring 에 적은 **"the one residual FP"** 는 내 과대 단정이었다.

→ `test_heredoc_body_line_starting_with_a_verb_nudges` 로 pin, README·docstring·plan 을 전부
"2종" 으로 정정. 개행은 구분자를 그만둘 수 없다(멀티라인 체인이 실제 사용 형태이고 `SegmentTest`
가 그에 의존) — 그래서 고치지 않고 **수용을 명시**하는 쪽이 맞다.

## INFO 중 반영

- **#4 단일 `&` 미분리** — `sleep 5 & rm -rf x` 실측 False. W1 과 같은 FN 클래스라 함께 수정
  (`_SEGMENT_SPLIT` 에 `&` 추가, `&&` 대안이 앞서므로 순서 안전). 회귀 뮤턴트로 확인.
- **#10 모듈 docstring 미언급** — 반영. 메모리상 "최상단 docstring 이 방금 고친 버그를 설명하고
  있지 않은지 확인" 은 4번째 재발 경로로 이미 한 번 데인 항목이라 값싼 보험이다.
- **#8 Overview 카운트 stale** — "5건 + won't-do 1건" 이 F~J 추가로 낡았다. 숫자 대신
  "섹션 목록이 범위, 하단 체크리스트가 정본" 으로 교정.
- **#9 "프로브 8건" 재현성** — 숫자를 지우고 `NoFalsePositiveClassTest` 파일을 가리키도록 변경.
  케이스가 늘면 숫자는 낡지만 파일 포인터는 안 낡는다.

## INFO 중 미반영(사유)

- #1/#2/#6/#7: 조치 불필요로 리뷰어 자신이 판정(ReDoS 무해 실측, advisory-only, 의도된 확장).
- #3 `session_id` 미검증 `os.path.join`: diff 밖 + 신뢰 경계 내부. 스코프 밖.
- #5 주석의 `§C` 인용: 하우스 스타일과 일치.

## 리뷰가 놓친 것 — 내가 실측으로 찾은 차단성 결함 (§J 신설)

W1 을 고치면서 "push 가드에도 같은 `\S+` 가 있다" 를 확인하러 갔다가, 그쪽은 **넛지 유실이 아니라
게이트 우회**임을 발견했다. `_is_git_push` 실측:

| 명령 | 결과 |
| --- | --- |
| `GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main` | **MISSED** |
| `GIT_SSH_COMMAND='ssh -i ~/.key' git push origin main` | **MISSED** |
| `GIT_AUTHOR_NAME="John Doe" git push --force origin main` | **MISSED** |
| `GIT_SSH_COMMAND=ssh git push origin main` | detected |

탐지 실패 = 훅이 통과시킴 = **리뷰-before-push 게이트 전체가 조용히 우회**된다. SSH 키를 지정해
push 하는 건 일상적인 형태다. blind 1차 정규식 자체의 결함이며(② 의 "차단은 무지하게" 설계는
멀쩡하고, 무지해야 할 쪽이 **덜 무지해서** 생긴 문제), `_SEGMENT_IS_GIT` 쪽은 release 경로라
미매치 = 해제 안 함 = 안전 방향으로 별개다.

**이 PR 에서 고치지 않는 이유**: `_GIT_PUSH` 는 `test_push_guard_allowlist.py` 가 byte-for-byte
고정하고 차등 코퍼스(legacy ⇒ new)가 걸려 있다. 차단형 가드의 패턴 변경은 핀 갱신 + 코퍼스 확장 +
뮤테이션을 동반해야 하므로 별 PR 이 맞다. plan §J 로 등록하고 체크리스트 최상단(차단성)에 올렸다.

## 스스로 정정한 것 — ReDoS 주장 철회

W1 수정 시 "서로소 alternation 이 ReDoS 를 막는다" 는 주석과 `BacktrackingTest` 를 넣었는데,
**뮤테이션에서 모호한 형태 뮤턴트(M8)가 GREEN** 이었다. 즉 내 테스트가 vacuous 였다.
옛-새 실측(`A="a b" ` ×24 + 실패 tail)으로 확인: **모호한 형태도 여기선 선형**이다 — 반복마다
`^` 앵커와 `IDENT=` 가 강제돼 엔진이 탐색할 분할이 없다(push 가드의 `_MESSAGE_ARG` 는 그 앵커가
없었다).

→ 주석에서 "이건 ReDoS 형태" 단정을 **철회**하고 "명확성을 위한 것이며 모호한 형태도 선형임을
실측했다" 로 교정. `BacktrackingTest` 는 남기되 docstring 에 **"alternation 서로소성의 대리
증거가 아니다"** 를 명시했다. 미측정 단정은 애초에 §C 를 백로그에 올린 바로 그 실수라, 같은 PR
안에서 반복할 수 없다.

## 검증

- 신규 테스트 **12건**(9 → 12), 하네스 전체 **513건 OK**(510 → 513), plan-frontmatter 105건 OK.
- 비-vacuity 뮤턴트 **7종 전부 RED**(스크래치 복사본, baseline GREEN + 원복 확인):
  분할 원복 / split 무력화 / env 접두 제거 / **앵커 제거** / env 값 `\S+` 원복 /
  `&` 제거 / 개행 제거. 8번째(모호 alternation)는 GREEN → 위 §철회의 근거.
- 앵커 제거 뮤턴트가 `NoFalsePositiveClassTest` 를 RED 로 만드는 것이 **§C won't-do 근거가
  실제로 고정됐다**는 증거다.

## 한계 (그대로 유지)

GitHub Actions 가 저장소 전체에서 비활성(`actions/permissions → enabled:false`)이라 위 수치는
**전부 로컬 실행** 결과다. CI 재활성화 전까지 이 PR 들의 "스위트 통과" 주장은 로컬 한정이다.

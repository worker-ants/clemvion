# RESOLUTION — fold 를 버리고 tail 로 옮겼다 (§O)

CRITICAL 1 / WARNING 3. **전처리(fold) 접근 자체를 폐기**했다 — 같은 fold 에서 CRITICAL 이
세 번(parity · 치환문자/위치 · heredoc) 나왔고, 세 번째는 이 저장소에서 **가장 흔한 명령
형태**를 깨뜨렸다.

## CRITICAL — fold 가 heredoc 종료 delimiter 를 삼켰다

```
git commit -F - <<'EOF'
message\
EOF
git push
```

본문 마지막 줄이 홀수 백슬래시로 끝나면 fold 가 `message\` + `EOF` 를 `messageEOF` 로 합친다
→ `_commit_heredoc_spans` 가 terminator 를 못 찾아 span 이 명령 끝까지 확장 →
**그 뒤의 진짜 `git push` 가 "inert 본문" 으로 blank 처리** → 미탐지. 실측 확인.

`_commit_heredoc_spans` 와 `_redact_inert_text` 는 **원본 텍스트 오프셋** 기준이라, 텍스트를
미리 고쳐 쓰는 전처리는 이 파일에서 안전할 수 없다.

## 조치 — 재작성 없이 tail 이 판단한다

fold(상수·함수·호출)를 전부 제거하고, tail 이 **백슬래시가 이스케이프한 개행만** 넘도록 했다:

```
git\b(?:[^&;|\n\\]|\\[^\n]|\\\n)*\bpush\b
```

세 alternative 는 첫 문자로 disjoint(일반 비-백슬래시 / 백슬래시+비개행 / 백슬래시+개행)라
rival parse 가 없다. 텍스트를 건드리지 않으므로 heredoc·redact 와 상호작용이 **원천적으로**
없다.

이 한 수정으로 WARNING 1·2 도 함께 사라졌다 — 미러(`blind_is_push`)가 미러할 전처리가 없어졌고,
`_push_targets` 가 원본을 보는 비대칭도 사라졌다.

## 갭 하나는 의도적으로 남겼다

`git pu\<개행>sh` — continuation 이 **키워드 자체**를 쪼개는 형태는 텍스트를 실제로 합쳐야만
잡을 수 있어 §O 로는 못 잡는다. **legacy 도 못 잡으므로 floor 위반이 아니다**(실측 확인).
`test_continuation_inside_the_word_is_a_KNOWN_GAP` 이 이것을 **갭으로 명시 pin** 하고, legacy
도 놓친다는 사실까지 함께 단언한다 — 나중에 누가 "회귀" 로 오분류하면 그 자리에서 갈린다.

거래는 명시적이다: 극히 인위적인 한 형태를 놓치는 대신, **이 저장소가 매 커밋마다 쓰는
heredoc 형태**를 지킨다.

## 비-vacuity 검증

| 뮤턴트 | 결과 |
|---|---|
| tail 을 §M(e) 상태(`[^&;|\n]*`)로 | `LineContinuationTest` **3 failed** |
| tail 이 개행 무조건 통과(`[^&;|]*`) | `test_many_git_lines...` **10s timeout** |

선형성 pin 신설(W3) — 백슬래시 런 / `\<개행>` 런 / 혼합 런 각각 ×2 입력 → ×2 시간 확인.

## TEST 결과

- lint: 해당 없음(Python 훅 — harness 스위트가 검증)
- unit: **harness 665 passed, 572 subtests**
- build: 해당 없음(`codebase/**` 변경 0)
- e2e: **면제** — diff 가 `.claude/**` + `plan/**` + `review/**` 뿐

## 보류·후속 항목

- INFO2(자매 훅 비대칭) — §O 는 정규식 tail 변경이라 자매 훅에 이식할 것이 없다(그 훅은
  `_SEGMENT_SPLIT` 으로 개행을 먼저 자른다). 주석에 한 줄 남김.
- INFO5(단일따옴표 안 개행 corpus) — §O 는 텍스트를 안 고치므로 그 트레이드오프 자체가 사라짐.

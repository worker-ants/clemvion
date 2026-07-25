# RESOLUTION — 수렴 (CRITICAL 0)

CRITICAL **0** / WARNING 4. 다섯 라운드 만에 수렴했다. WARNING 은 전부 §O 철회 뒷정리와
테스트 위생이며 4건 모두 조치.

## 조치 항목

| # | 판정 | 조치 |
|---|---|---|
| W1 | 수용 | `test_continuation_aware_tail_stays_linear` **삭제** — §O 철회로 그 테스트가 재던 tail 자체가 사라졌는데 내가 지우지 않았다. reviewer 4명이 공통 지적 |
| W2 | 조치 없음 | line-continuation 갭 — 이미 의도적 수용, corpus 에 이유와 함께 등재됨. 리뷰어도 "재작업 불필요" |
| W3 | 수용 | 신규 CORPUS 4건이 범용 differential 3종에 **걸리지 않는다**(전부 `legacy_is_push` 게이트인데 legacy 는 이 형태를 모른다)는 사실을 CORPUS 블록에 명시. 유일 방어선이 `QuotedNewlineValueTest` 임을 같은 자리에 적었다 |
| W4 | 수용 | `_CASES` 를 **CORPUS 에서 파생**하도록 변경. 모듈 docstring 이 "a command literal is never typed twice" 를 약속하는데 손으로 복사해 어겼다. 파생이 vacuous(빈 튜플) 하지 않은지 실측 확인 — 5건 |

INFO5 반영: 신규 `subprocess.run` 에 `timeout=` 추가(파일의 다른 호출 관례와 일치).

## TEST 결과

- lint: 해당 없음(Python 훅 — harness 스위트가 검증)
- unit: **harness 662 passed, 562 subtests**
- build: 해당 없음(`codebase/**` 변경 0)
- e2e: **면제** — diff 가 `.claude/**` + `plan/**` + `review/**` 뿐

## 다섯 라운드 요약

| 라운드 | CRITICAL | 무엇 |
|---|---|---|
| 1 | 1 | §M(c) separator 직후 whitespace O(n²) |
| 2 | 2 | §M(d) `&` 누락(선재) · §M(e) tail O(n²) |
| 3 | 0 | 수렴 → §M 종료 |
| 4 | 1 | §N split 이 따옴표 안 개행에서 우회 → **revert** |
| 5 | 2 | fold 의 parity·치환/위치 → 수정 |
| 6 | 1 | fold 가 heredoc terminator 파손 → **fold 폐기**, tail 로 |
| 7 | 2 | §O tail 이 `git \push` 유실 + O(n²) 재도입 → **revert** |
| 8 | **0** | 수렴 |

## 보류·후속 항목

없음.

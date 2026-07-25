# RESOLUTION — §M push 게이트 newline separator

CRITICAL 1 / WARNING 2. **CRITICAL 은 실측으로 확증하고 수정**, 다만 같은 항목의 **2차 제안은
실측으로 반증해 거부**했다. 리뷰어가 옳은 곳과 틀린 곳을 갈라서 처리한 것이 이 문서의 요지다.

## 조치 항목

| # | 판정 | 조치 | 실측 근거 |
|---|---|---|---|
| C1-a | **수용** | separator 직후 `\s*` → `[^\S\n]*` | 개행 런 4k=400ms · 16k=6.3s · **50k=62s** (입력×2→시간×4, quadratic) → 수정 후 50k=**4ms**. §M(b) 에서 env-value 만 좁히고 이 자리를 빠뜨린 내 실수 |
| C1-b | **거부** | 첫 `search` 전 `_MAX_REDACTION_INPUT` 절단 — **하지 않음** | `echo <16KB>\ngit push` 는 절단 시 push 가 잘려 `search`=**False** → 두 게이트 skip. 길이 캡은 release 경로에만 있고 초과 시 `return True`(차단). **캡이 탐지를 게이팅하면 새 우회**가 된다 |
| W1 | 수용 | plan 을 `complete/` 로 이동하고 SoR 을 정확 경로로 | 체크리스트 전항 `[x]`, follow-up 은 별 티켓 2건으로 분리 → lifecycle §2 상 이동 가능 |
| W2 | **분리** | env-value 서브패턴 4곳 복제 → 별 티켓 `harness-env-value-subpattern-dedup` (P3) | 공유 모듈화는 **import 실패 시 게이트 전면 무력화**를 만든다(두 훅 모두 `_lib` 실패를 fail-open 으로 흡수). 정규식이 파일 안에 있는 것이 의도된 설계 — 티켓에 (A)/(B)/(C) 선택지와 반대 근거 기록 |

INFO 반영: #1(테스트 미러 동시 갱신) · #11(docstring 20000 vs 실행 40000 관계 명시) ·
#12(탭·formfeed 회귀 테스트 신설) · #13(644→**649** 실측 정정) · #14(주석의 옛 `\s+` 참조).

## 비-vacuity 검증

| 뮤턴트 | 기대 | 실측 |
|---|---|---|
| `[^\S\n]*` → `\s*` (C1 재주입) | 개행 런 테스트 RED | **10s timeout FAILED** |
| 첫 search 에 절단 적용 (거부한 제안 재주입) | 우회 재현 RED | **FAILED** |
| separator 에서 `\n` 제거 (§M(a) 재주입) | 탐지·통합 RED | **4 subtest + 통합 1 FAILED** |
| `[^\S\n]+` → `\s+` (§M(b) 재주입) | rival ReDoS RED | **10s timeout FAILED** |

## TEST 결과

- lint: 해당 없음(Python 훅 — harness 스위트가 검증)
- unit: **harness 649 passed, 404 subtests** / Gate C `spec-plan-completion` **725 passed**
- build: 해당 없음(코드베이스 변경 없음)
- e2e: **면제** — `codebase/**` 변경 0줄(diff 는 `.claude/**` + `plan/**` 뿐). PROJECT.md
  §e2e 면제 화이트리스트의 "harness/문서 전용 변경" 에 해당하며, 이 저장소의 e2e 는 backend
  Jest 라 훅 정규식과 실행 경로가 겹치지 않는다.

## 보류·후속 항목

- `harness-review-gate-ci-backstop` (P2) — 훅-독립 CI 백스톱. §M 조사에서 나온 통찰(정규식이
  유일 판정자인 한 사후 탐지도 같은 사각지대를 공유)을 근거로 분리.
- `harness-env-value-subpattern-dedup` (P3) — 위 W2.

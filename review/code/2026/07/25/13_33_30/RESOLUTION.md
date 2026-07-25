# RESOLUTION — 3회차 (수렴)

**CRITICAL 0** / WARNING 3. 세 라운드 만에 CRITICAL 이 사라졌다. WARNING 은 전부 문서·DRY
성격이며 2건 조치, 1건은 이미 별 티켓 추적 중.

## 조치 항목

| # | 판정 | 조치 |
|---|---|---|
| W1 | 이미 추적 | env-value 서브패턴 4곳 복제 → `harness-env-value-subpattern-dedup`(P3). 리뷰어도 "신규 조치 불요, 다섯 번째 편집 전에 확정 권장" |
| W2 | 수용 | `.claude/tests/README.md` 에 §M 요지 반영 — 두 separator 추가·ReDoS 3종 pin·동등성 단언의 근거(왜 "전부 탐지" 가 아닌지), main 엔트리 행에 `test_multiline_push_still_gates` |
| W3 | 수용(주석) | `_SEGMENT_SPLIT` 이 §M(d) 이후 `_GIT_PUSH` 와 **의도적으로** 갈라졌음을 명문화. `&` 를 넣지 **않는다** — 여긴 release 경로라 누락이 "소유자 미인정 → 미release → 여전히 차단"(안전 방향)이고, release 확대는 별도 정당화가 필요하다(`ReleasePathNarrownessTest`). 실측: `echo x & git commit -F - <<EOF` + 본문 push → 미release 확인 |

INFO 반영: #1(`&` 단독 대량입력 선형성 pin — 이 파일은 "측정 없는 안전 단언" 이 3회 반증된
이력이 있다) · #2(`\n`+`&` **조합** 축을 성능·동등성 양쪽에 추가).

## TEST 결과

- lint: 해당 없음(Python 훅 — harness 스위트가 검증)
- unit: **harness 656 passed, 532 subtests**
- build: 해당 없음(`codebase/**` 변경 0)
- e2e: **면제** — diff 가 `.claude/**` + `plan/**` + `review/**` 뿐(PROJECT.md §e2e 면제
  화이트리스트의 harness/문서 전용 변경)

## 3라운드 요약 — 무엇이 반복됐나

| 라운드 | CRITICAL | 성격 |
|---|---|---|
| 1 | 1 | §M(c) separator 직후 whitespace → O(n²) |
| 2 | 2 | §M(d) `&` 누락(선재) · §M(e) tail 이 개행 건넘 → O(n²) |
| 3 | **0** | 수렴 |

(c)·(e) 와 착수 중 발견한 (b) 는 **전부 §M(a) 의 `\n` separator 결정에서 파생**했다. 그
관찰과 split-then-match 대안의 실측(정확성 10/10 동일, 성능 동등 이상)은
`harness-push-detection-split-then-match`(P2) 로 분리했다 — 이번에 전환하지 않은 이유(release
경로 상호작용이 미지수이고 그 자리가 14_23_23 의 C1·C2·C3 를 낸 곳)도 함께 기록했다.

## 보류·후속 항목

- `harness-env-value-subpattern-dedup`(P3) — W1 + 2회차 W4(포맷 통일).
- `harness-push-detection-split-then-match`(P2) — 설계 반전 판정.
- `harness-review-gate-ci-backstop`(P2) — 훅-독립 CI 백스톱.

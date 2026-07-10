# 코드 리뷰 SUMMARY — SECRET_LEAK_PATTERNS 확장(bare JWT + URI userinfo)

- 리뷰 대상: `f5dff4799` (패턴 2개 추가) + review-fix `2ea285408`.
- reviewer: security / testing.
- 처분: [`RESOLUTION.md`](./RESOLUTION.md).

## 전체 위험도: LOW

Critical 0 / Warning 0(testing WARNING 처분 완료).

## Critical

| # | Checker | 위배 |
|---|---------|------|
| - | - | (없음) |

## 경고 (WARNING)

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| 1 | testing | bare JWT positive 단일 케이스·FP 가드 IPv6/SSH 미포함 | **Fixed** — alg=none JWT + IPv6(userinfo 유/무)·SSH shorthand 테스트 추가(`2ea285408`) |

## 참고 (INFO)

| # | Checker | 항목 |
|---|---------|------|
| 1 | security | ReDoS 없음(200k~1M자 sub-3ms), FP 실질 없음 — 위험도 NONE |
| 2 | security | whole-match 마스킹으로 URI 스킴 손실은 의도된 trade-off. DB 스킴은 CONNECTION_STRING strip 선행이라 충돌 없음 |
| 3 | testing | MCP 는 자체 userinfo 패턴(PR #842) 선행 적용이라 net-new 는 bare-JWT 한정(commit 서술 정정) |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| security | NONE | ReDoS 없음(disjoint delimiter 설계), FP 없음, 소비처 217 test 통과 |
| testing | LOW | 전체 400 suite/7946 test 통과, 회귀 없음. positive/FP 커버리지 보강. |

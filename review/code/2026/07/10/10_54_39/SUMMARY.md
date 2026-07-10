# 코드 리뷰 SUMMARY — URI-userinfo 마스킹 SoT 통합(scheme 보존 + MCP dedup)

- 리뷰 대상: `90ab8f390` + review-fix `b48d4c10b`.
- reviewer: security / testing.
- 처분: [`RESOLUTION.md`](./RESOLUTION.md).

## 전체 위험도: LOW

Critical 0 / Warning 0 (findings 전부 INFO).

## Critical

| # | Checker | 위배 |
|---|---------|------|
| - | - | (없음) |

## 경고 (WARNING)

| # | Checker | 위배 |
|---|---------|------|
| - | - | (없음) |

## 참고 (INFO) — 처분

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | security | `redactMcpSecrets` JSDoc(65행)이 "MCP_EXTRA(URL userinfo·bare token)"로 stale | **Fixed**(`b48d4c10b`) |
| 2 | testing | password 콜론 포함 케이스 마스킹 개선이 미-pin | **Fixed**(테스트 추가) |
| 3 | security | scheme 이 비-MCP 소비처에 신규 노출(credential 아님, 의도된 tradeoff·문서화) | 조치 불필요 |
| 4 | security | 기존 FN(password 내 리터럴 `@`)·over-mask(username 자리 라벨드 키워드) — 본 diff 무관 선재 | 조치 불필요 |
| 5 | security(확인) | ReDoS 없음(2M자 <5ms), lookbehind Node 정상, behavior-preserving(15케이스+209 test 동일) | — |
| 6 | testing(확인) | 전 소비처 30+7 suite/883 test 통과, assertion exact-string 로 강화 | — |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| security | LOW→(INFO fix 후) | credential 완전 마스킹·ReDoS 없음·behavior-preserving 실측 확인. stale JSDoc 정정. |
| testing | LOW | 전 소비처 회귀 없음·assertion 강화. password-colon 테스트 보강. |

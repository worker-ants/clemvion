# RESOLUTION — SECRET_LEAK_PATTERNS 확장 ai-review

| 출처 | Severity | 처분 |
|---|---|---|
| security | NONE | ReDoS 없음(disjoint-delimiter 설계, 200k~1M자 adversarial sub-3ms), FP 실질 없음, 소비처 217 test 통과. 조치 불필요. |
| testing | WARNING | bare JWT positive 단일 케이스·FP 가드 IPv6/SSH 미포함 → **Fixed**: alg=none JWT positive + IPv6 host(userinfo 유/무)·SSH shorthand(`git@host:org`, no `://`) FP 가드 테스트 추가(`2ea285408`). |
| testing | INFO | MCP 는 자체 userinfo 패턴(PR #842)이 선행이라 net-new 방어는 bare-JWT 한정 — PR 본문에 정확 범위 명시(commit "MCP 개선" 서술 완화). |

## 검증
- unit: shared sanitize(39) + 전 소비처(thread-renderer·execution-engine·mcp·cafe24·makeshop·oauth) 회귀 통과(전체 400 suite/7946). lint 0 error, build clean.
- **e2e: 249 pass** (production 패턴 커밋 `f5dff4799` 기준; test-fix `2ea285408` 은 spec-only 라 런타임 불변).

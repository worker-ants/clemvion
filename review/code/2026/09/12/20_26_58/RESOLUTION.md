# RESOLUTION — 라운드 2 (`review/code/2026/09/12/20_26_58`)

**판정**: Critical 0 · WARNING 4. Critical 0.

**해소 커밋**: `d730f803f`

| # | 지적 | 실측 | 처분 |
|---|---|---|---|
| 1 | `15-chat-channel.md §5.4` 표에 신규 400 행 없음 | 참 | planner 항목 등재 (자기-반증형 소정정 조건 1 미충족) |
| 2 | `LLM_AUTH_ERROR` 를 "근접 오기" 로 오진단 | **참 — `7-llm-client.md:345` 가 Planned 로 등재** | plan·트래커 두 곳의 진단 정정 |
| 3 | docstring 수치 127 이 틀림 | 참 — AST 재측정 **144** | 시점·범위 병기해 정정 |
| 4 | 500→400 행위 변경의 실행 테스트 부재 | 참 — **내 "e2e 가 필요하다" 가 틀렸다** | `Test.createTestingModule`+`supertest` HTTP 왕복 3케이스 추가, M9·M10 으로 고정 |

---

검증: 각 라운드마다 `.claude/tools/run-test-all.sh lint unit build e2e` ALL PASS
(backend 460 suites · 9,642 tests, e2e 305 tests).

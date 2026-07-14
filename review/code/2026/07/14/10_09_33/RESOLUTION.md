# RESOLUTION — 2026/07/14/10_09_33

PR: AI Agent 도구 정의 payload 예산 런타임 가드레일 (feat 2adbd65f8 계열,
`codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` ·
`ai-turn-executor.ts` + spec).

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (W1)   | 코드 | `d8be832e1` | `executeSingleTurn` buildTools try/catch + config-echo 블록을 `assembleSingleTurnConfigEcho`/`buildSingleTurnToolsOrError` private 헬퍼로 추출 (동작 불변) |
| #2 (W2)   | 코드(문서화) | `d8be832e1` | single(return)/multi(throw) 전파 비대칭을 `AiTurnExecutor` 클래스 JSDoc 에 공식 계약으로 명문화(통일은 후속 plan 범위 — 코드 변경 없음) |
| #3 (W3)   | 문서 | `f9c818cef` | CHANGELOG 항목에 breaking behavior change 공지 포함 |
| #4 (W4)   | 코드 | `d8be832e1` | `singleTurnEnteredAt` → `preflightStartedAt` 개명 (기존 `singleTurnStartedAt` 과 혼동 제거) |
| #5 (W5)   | 코드 | `970ccbbca` | env 예산 파싱을 `Number.isFinite(n) && n > 0 ? n : fallback` 로 하드닝 — 음수/0 오설정 시 AI Agent 노드 영구 차단 위험 제거 |
| #6 (W6)   | 테스트 | `970ccbbca` | env=`'0'`·음수 3예산(soft/hard/count) fallback 회귀 테스트 추가 |
| #7 (W7)   | 테스트 | `d8be832e1` | single-turn catch 의 rethrow(else) 분기 테스트 — non-string 도구 이름으로 buildTools 내부 non-budget TypeError 유발 → executeSingleTurn 이 삼키지 않고 rethrow 함을 고정 |
| #8 (W8)   | 문서 | `344010bb7` | `.env.example` 에 AI Agent 도구 payload 예산 env 3종 등재 (MCP_MAX_RESPONSE_BYTES 선례 형식) |
| #9 (W9)   | 문서 | `f9c818cef` | CHANGELOG.md Unreleased 에 항목 추가 |

### opportunistic 반영 (관련 INFO)

| INFO # | 내용 | 조치 commit |
|--------|------|-------------|
| INFO5  | `readByteBudget` → `readEnvNumber` 범용 개명 | `970ccbbca` |
| INFO6  | hard/soft 메시지 템플릿 공통부 `buildBudgetExceededPrefix` 로 통합 | `970ccbbca` |
| INFO7  | `buildTools` 에 `@throws {ToolDefinitionPayloadExceededError}` JSDoc 추가 | `d8be832e1` |
| INFO9  | `pickCulpritProvider` 빈 perProvider → culpritProvider 키 생략 분기 단위 테스트 | `970ccbbca` |
| INFO10 | 0/음수 env 가 킬스위치가 아님을 JSDoc 에 명문화 | `970ccbbca` |

## TEST 결과

- lint  : 통과 (수정 전 1건 prettier 포맷 오류 `eslint --fix` 로 해결, 나머지는 사전 존재하던 warning 계열)
- unit  : 통과 (backend 409 test suites / 8133 passed + 1 skipped, monorepo 전체 포함)
- build : 통과
- e2e   : 통과 (253/253, `_test_logs/e2e-20260714-103940.log`) — 코드 변경(`.ts` 로직)이 PROJECT.md §e2e 면제 화이트리스트 부분집합이 아니므로(주석/문서 전용이 아닌 실질 로직 변경: env 파싱 하드닝·private 헬퍼 추출·rename) default 수행 대상으로 판단, 실제 실행해 통과 확인.

## 보류·후속 항목

- **INFO1**(sid `__` 분할 — 진단 표시만, culprit 오귀속 판정 무영향): 코드 수정 안 함, 낮은 우선순위 관측 이슈. SPEC-DRIFT 아님.
- **INFO2**(mcpDiagnostics meta 예산 초과 error 에 미포함): pre-flight 은 tool 실행 전이라 진단 없음이 자연스러움 — 코드 수정 안 함.
- **INFO3**(신규 error meta 가 §7.3 turnDebug 보다 얇음 — spec 주석 권고): `project-planner` 영역, 코드 수정 대상 아님. spec draft 미작성(단순 주석 권고 수준, 별도 BLOCK 유발 요소 아니라 판단 — 필요 시 후속 spec 정합 패스에서 흡수).
- **INFO4**(ai-agent.md §10 저장 경고 인라인 표기 없음 — cross-node-warning-rules 는 Planned 명시): `project-planner` 영역, 이미 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 후속 plan(config-time 저장 경고)에서 추적 중 — 중복 조치 불필요.
- **INFO8**(멀티턴 테스트명이 extractAiTurnErrorPayload 경유 암시하나 code 필드만 확인): 본 지시(우선 반영/보류 목록) 어디에도 명시되지 않은 항목 — cosmetic 테스트 커버리지 갭(assertion 확장이지 결함 아님), 이번 pass 범위 밖으로 보류. 리스크 낮음.

## 분류 참고

본 PR 의 WARNING 9건은 전량 **코드 관련**(구현 버그·테스트 누락·리팩토링·문서 갱신) 이며 spec-drift 또는 spec 결함으로 분류된 항목은 없음 — SUMMARY 의 "라우터 결정"·"권장 조치" 어디에도 spec 변경 필요성이 제기되지 않았고, requirement reviewer 도 `[SPEC-DRIFT]` 태그를 달지 않았다. 따라서 spec draft 없이 코드/문서 fix 로 전량 종결.

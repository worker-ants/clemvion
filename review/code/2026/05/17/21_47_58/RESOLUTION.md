# RESOLUTION

## 조치 항목

| ID | 등급 | 발견 | 조치 | Fix commit |
|---|---|---|---|---|
| C1 | Critical | `nodeExec` null 무음 skip — 데이터 누락 silent fail | `else` 분기에 `logger.warn` 추가 (cross-tab snapshot lag 명시 + executionId/nodeId 포함) | (본 RESOLUTION 직후 commit) |
| W1 | Warning (security) | `_resumeState` strip 이 shallow copy + delete — 중첩 내부 필드 silent 누출 위험 | top-level allowlist destructure (`const { _resumeState: _stripped, ...safe } = adaptedNext`) 로 전환. 향후 top-level 에 추가되는 internal 필드는 명시적으로 strip 해야만 영속 — review-driven defense in depth | 위 commit |
| W2 | Warning (concurrency) | `continueAiConversation` 연속 호출 시 in-memory `nodeExec` 참조 last-write-wins 가능성 | **수용 (defer)**: ① `continueAiConversation` entry point 는 같은 nodeExec 를 single bus consumer 가 sequential 처리하므로 동일 turn 안에서의 race window 사실상 없음. ② 만약 last-write-wins 가 발생해도 다음 turn 의 누적 messages 가 이전 값을 superset 으로 덮어쓰므로 self-healing. ③ TypeORM `update(id, ...)` 단일 쿼리 전환은 본 PR scope 보다 큰 패턴 변경 (button/form/첫 turn 모두 동일 패턴 사용 중). 후속 task 후보 — 본 PR 의 `Follow-up` 섹션에 기록 |
| W3 | Warning (requirement) | DB persist 실패 시 in-memory cache 와 불일치 가능 + 로그 부재 | `try/catch` 으로 감싸고 `logger.error(executionId, nodeId, err.message)` 기록. WS 는 이미 emit 된 상태라 strict atomicity 는 기존 button/form 패턴과 동일 trade-off — 신규 비일관성 도입 없음 | 위 commit |
| W4 | Warning (testing) | `continueAiConversation` 호출에 `await` 없이 `flushPromises` 단발 — 깊은 Promise 체인 false-negative 위험 | `flushPromises()` 를 2회 연속 호출해 후속 마이크로태스크(`await this.nodeExecutionRepository.save(nodeExec)` 의 microtask + `try/catch` 분기)도 settle 되도록 보강 | 위 commit |
| W5 | Warning (testing) | 테스트 nodeId 하드코딩이 fixture 와 결합 — 변경 시 무음 실패 가능 | `AGENT_NODE_ID = 'node-agent'` 상수화 + `savedAgentRows.length === 0` 분기에서 진단 메시지(`observed save calls: [...]`) 동봉한 `throw new Error()`. Jest expect 는 message 두번째 인자 미지원이므로 throw 패턴 | 위 commit |
| W6 | Warning (scope) | 포맷팅 hunk 혼재 | 이미 별도 commit `b29407f0 style(backend/exec-engine): apply eslint --fix line wraps` 으로 분리 | 기존 |
| W7 | Warning (scope) | catalog-sync / registry 경로 fix 가 본 PR 에 혼재 | 의도된 분리 — 각각 `774a69f6 fix(backend/cafe24-test): ...` · `9dc272a4 fix(frontend/docs-test): ...` 별 commit. PR 본문에 사전 결함이며 commit 33521233 누락 분 명시 | 기존 |
| W8 | Warning (testing — registry) | `it.runIf(hasRealDocs)` 조건부 실행이 CI 에서 `content/docs` 부재 시 spec 경로 검증을 무력화할 수 있음 | **수용 (follow-up)**: 본 PR 의 변경 의도(경로 fix) 와 별개 issue — CI job 의 step 추가는 별 worktree/PR 로 분리. 본 PR 의 Follow-up 에 기록 |
| W9 | Warning (documentation) | plan 체크리스트에 API 문서/매뉴얼 검토 항목 누락 | plan 에 "API 문서(Swagger) / 사용자 매뉴얼 영향 여부 확인" 항목 추가. REST `/executions/:id` 응답은 기존 outputData 그대로 통과 — PROJECT.md "백엔드 API 추가·변경" 매핑 미해당, 사용자 매뉴얼 외부 노출 컨트랙트 신규 없음 → 갱신 불요 결론 적시 | plan 갱신 |
| W10 | Warning (documentation) | plan 체크박스 미갱신 | 모든 완료 항목 `[x]` 로 갱신. consistency-check 세션 경로, review 세션 경로 cross-link | plan 갱신 |

### INFO (12건) — 기록만, 별도 조치 없음

- INFO 1, 2 (security): 본 PR 의 가드(`JSON.stringify` 두 겹 검사, null check + await) 가 양호 — 유지.
- INFO 3 (maintainability — canary 상수화), INFO 5 (`repoRoot()` 헬퍼 중앙화), INFO 6 (`if (nodeExec)` 의도 주석 — 본 fix 에서 6줄 주석 블록으로 자연 해소), INFO 7 (테스트 case A/B/C 분리), INFO 8 (`nodeExec === undefined` 별도 테스트), INFO 9 (sentinel 범위 확장), INFO 10 (deep-clone), INFO 11 (emit-then-save atomicity 패턴 개선), INFO 12 (commit 메시지 prefix 명시) — 모두 본 PR 의 핵심 회귀 fix scope 밖. 패턴 변경은 button/form/AI 전체에 걸친 후속 작업 후보. 본 PR 의 `Follow-up` 으로만 기록.
- INFO 4 (테스트 타입 캐스팅 체인): 본 fix 가 `unknown` 캐스팅을 줄이는 게 아니라 회귀 가드용 일회성 검증 코드라 cost/benefit 부적합 — 유지.

## TEST 결과

- **lint** (backend `npm run lint`): 0 errors, 19 warnings — 모두 본 PR 무관 사전 결함 (`executions.service.ts`, `migrate-node-output-refs.ts`). 본 PR 새 issue 0건.
- **unit test** (backend `npm test`): 217 suites · 3874 tests 모두 통과. multi-turn follow-up persist 회귀 가드 1건(`persists outputData ... on multi-turn follow-up waiting turn`) 신규.
- **unit test** (frontend `npm test`): 123 suites · 1456 tests 모두 통과.
- **build** (backend + frontend `npm run build`): 양쪽 모두 통과.
- **e2e** (`make e2e-test`): 16 suites · 93 tests 모두 통과 — `e2e-test (backend supertest)` 의 모든 시나리오 PASS, `clemvion-e2e-*` docker compose 정상 기동·정리.

## 보류·후속 항목

본 PR 의 스코프 밖이며 별도 plan/worktree 에서 처리할 항목:

1. **W2 (concurrency, last-write-wins 보강)** — multi-turn waiting 시 `nodeExec` 참조 갱신 → save 패턴을 TypeORM `update(id, { outputData })` 단일 쿼리로 전환. button / form / AI 첫 turn 모두 같은 패턴 사용 중이라 cross-cutting refactor 가 필요. Follow-up plan.
2. **W8 (registry test 조건부 실행 가드)** — CI job 에 `content/docs` 존재 확인 step 추가 또는 skip 시 warn 로그. frontend-test 워크플로 영역의 작업.
3. **INFO 5 (`repoRoot()` 헬퍼 중앙화)** — `catalog-sync.spec.ts` 와 `registry.test.ts` 가 각자 `..` 반복으로 repo root 탐색. 향후 디렉토리 재구성 대비 공유 헬퍼화. monorepo housekeeping 영역.
4. **consistency-check WARN 1, 2, 5 (Information Extractor multi-turn spec 미반영, AI Agent §5 예약 포트 `completed` 누락)** — `project-planner` 위임. `plan/in-progress/spec-update-info-extractor-multiturn.md` 등으로 별 plan.
5. **consistency-check Critical (`spec/conventions/cafe24-api-catalog/_overview.md` 파일명)** — `project-planner` 위임. 본 PR scope 밖.

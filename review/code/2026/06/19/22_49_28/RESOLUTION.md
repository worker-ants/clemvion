# RESOLUTION — C-1 dev 1b (review 22_49_28)

ai-review 결과 **LOW · Critical 0 · Warning 2**. 두 Warning 모두 조치(W-1 spec 갱신 / W-2 disposition + spec 문서화). 가치 높은 INFO(테스트·문서화)도 함께 반영.

## 조치 항목

| # | 카테고리 | 조치 | 위치 |
|---|----------|------|------|
| W-1 | SPEC-DRIFT | spec §4 step 4 + §5.5 인라인 에러코드 열거에 `WORKFLOW_FORBIDDEN_WORKSPACE` 추가 (코드 유지, spec 갱신) | `spec/4-nodes/2-flow/1-workflow.md` L108·L228 |
| W-2 | API 계약 | **disposition: 의도된 보안 강화 surface 변경** — cross-workspace 차단은 PR #637(fail-closed)부터 이미 동작했고 본 변경은 surfaced **코드만** `SUB_WORKFLOW_FAILED`→`WORKFLOW_FORBIDDEN_WORKSPACE` 로 정밀화. 변경 이력은 spec 에 문서화됨(workflow §6 표·error-handling §1.4/§3.2·engine §Rationale ★). 별도 changelog 인프라 부재라 spec 카탈로그가 SoT | 문서화 완료 |
| I-4 | 테스트 | `workflow-errors.spec.ts` 에 `WorkflowForbiddenWorkspaceError` 클래스 계약 describe 추가(mismatch/missing-caller — 필드 캡처·message prefix·name) | `workflow-errors.spec.ts` |
| I-5 | 테스트 | `execution-engine.service.spec.ts` fail-closed 테스트에 `rejects.toBeInstanceOf(WorkflowForbiddenWorkspaceError)` 단언 추가 | `execution-engine.service.spec.ts` |
| I-7 | 테스트 | `mapSubWorkflowError` over-match 음성 테스트 추가(`'workspace'` 단어만으론 격리코드로 오분류 안 됨 → `SUB_WORKFLOW_FAILED`) | `workflow.handler.spec.ts` |
| I-9 | 문서화 | `ai-agent.handler.ts` llmCalls 주석 영어 단독 통일 | `ai-agent.handler.ts` L1489·L2410 |
| I-10 | 문서화 | `TurnRagDelta` 인터페이스에 rename 이력 주석 추가(formerly `TurnDebugEntry`) | `output-shape.ts` L307 |
| I-11 | 문서화 | plan 워크플로 체크박스 갱신 | `c1-dev-followups-1b.md` |

## Disposition (비조치 — 근거)

| # | 항목 | 근거 |
|---|------|------|
| I-1 | 에러 메시지 workspaceId 노출 | 기존 inline Error 와 **동일 메시지**(신규 노출 0). workspaceId 는 호출자 자신의 workspace UUID(시크릿 아님). `output.error.message` 는 워크플로 소유자만 조회. 회귀 아님 |
| I-2/I-6 | LlmCallRecord loosen 후 durationMs 런타임 단언 | push site 가 항상 전 필드 공급(코드 확인) + build tsc 통과 + 기존 ai-agent 420 테스트가 turnDebug 경로 커버. canonical 통일(③)의 의도된 loosen, trace 구조라 수용 |
| I-3 | shared 타입 required subset 분리 | 중기 type-consolidation 과제(범위 밖, 부모 plan 기록) |
| I-8 | JSDoc `executeSync` | **정확** — assertSameWorkspace 는 executeInline/executeSync/executeAsync 3 진입점 전부에서 발화. sibling `WorkflowNotFoundError` JSDoc 도 동일하게 executeSync 명시. node-facing spec(workflow §)만 canonical 2-mode 표기 |
| I-12 | prefix 상수 추출 | message 는 단일 생성자에 집중, backstop 은 lowercase includes 로 decoupled. 추출 효익 marginal |
| I-13 | `Object.entries(ErrorCode)` 동적 순회 | `error-codes.spec.ts` 가 전 enum 순회로 UPPER_SNAKE_CASE 네이밍 검증 — 신규 항목 포함해 **unit 통과**(7134) → 이미 검증됨 |

## TEST 결과

- **lint**: 통과 (재수행 63s, `--fix` 무관 파일 오염 0)
- **unit**: backend **355 suites / 7134 passed** (1 skipped) — 신규 테스트 +3 전부 통과 (2회 연속 동일). frontend 212/213 — 1 실패는 **매 실행 다른 무관 flaky 테스트**(`spec-link-integrity` 타임아웃 / `schedules-page` RBAC, 둘 다 내 PR 미접촉). **격리 재실행 전부 통과**: `spec-link-integrity` 11/11(깨진 in-repo 링크 0 — 내 spec anchor 검증), `schedules-page` 10/10 ×3. 병렬 docker e2e(타 워크트리 active job) 자원 경쟁 기인 환경 flakiness.
- **build**: 통과 (rebased base; 본 fix-delta 는 test+comment+spec-md only, 프로덕션 코드/타입 무변 → tsc·next build 직전 PASS 유효)
- **e2e**: 통과 (35 suites / 205, rebased base; fix-delta 프로덕션 행위 무변 → 직전 PASS 유효)

## 보류·후속 항목

- ⑥ previousOutput Phase 3 — BLOCKED(node-output-redesign 의존), c1-engine-split.md 기록.
- I-3 shared 타입 required subset 분리 — 중기 type-consolidation(부모 plan 기록).

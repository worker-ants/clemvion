# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 WARNING 은 spec 편집 시 함께 처리 권장 수준.

## 전체 위험도
**MEDIUM** — Cross-Spec 에서 WARNING 4건 확인. 변경 4(`§10 passthrough` vs `LLM_CALL_FAILED fallback` 명시 모순)와 변경 1c/1e(엔진 잔류 기술 번복 cross-reference 부재)가 핵심. Plan/Naming 은 NONE, Convention/Rationale 은 LOW.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | 변경 4: 미등록 vendor 코드 passthrough·`retryable=false` 가 §10 "분류 불가 fallback → `LLM_CALL_FAILED`" 설명과 명시 모순 | `plan/in-progress/spec-draft-c1-spec-drift.md` 변경 4 | `spec/4-nodes/3-ai/1-ai-agent.md §10` L1099 분류 규칙 | §10 분류 규칙 문단 끝에 "provider SDK 가 명시 code 를 포함해 throw 하면 code 보존(passthrough)·`retryable=false` — 별도 `AI_*` 코드로 래핑 안 함. 신호가 **모두** 없는 경우에만 `LLM_CALL_FAILED` fallback" 추가. `LLM_PROVIDER_QUOTA`·`LLM_API_ERROR` 는 에러 코드 표에 "(passthrough 예시)" 행 추가. |
| W-2 | Cross-Spec | 변경 1c/1e: `retryLastTurn`·`applyRetryLastTurn` 엔진 잔류→제거 번복 시 §3 본문 L193 callout 과 §4.2 WS 사용처 설명이 미동기화 | 변경 1c·1e | `spec/5-system/4-execution-engine.md` §3 L193, §4.2 L1391 | 변경 1e 적용 시 §3 L193 callout 도 "외부 진입점(`websocket.gateway`·`continuation-execution.processor`)이 `RetryTurnService` 직접 호출" 로 동기화. §4.2 WS 사용처 설명도 동반 갱신. |
| W-3 | Cross-Spec | 변경 1e: `ExecutionEventEmitter→WebsocketService` forwardRef facade 가 §4.4 "별도 추상화 금지" 본문에 전혀 설명되지 않음 — facade 도입 이유·범위 미기술 | 변경 1e | `spec/5-system/4-execution-engine.md §4.4` L438 | §4.4 본문에 "thin delegation facade `ExecutionEventEmitter` 는 forwardRef DI 해소 + call-site 일원화를 위한 동형 래퍼이며 §4.4 정책의 예외가 아님" 주석 한 줄 추가. |
| W-4 | Cross-Spec | 변경 3: `spec/5-system/3-error-handling.md §3.2` Sub-workflow 행이 §1.4 와 아직 미동기화 (방향은 올바름) | 변경 3 | `spec/4-nodes/2-flow/0-common.md` L51-52 (4종 이미 정의) | 변경 3 적용 시 §3.2 행도 §1.4 와 완전히 동일한 형태(링크 포함)로 작성 확인. |
| W-5 | Rationale Continuity | 변경 1c/1d: 기존 C-1 Rationale "엔진 잔류 확정" 을 번복하면서 변경 1e 의 신규 bullet 에 기존 결정 대체·폐기 cross-reference 가 없음 | `plan/in-progress/spec-draft-c1-spec-drift.md` 변경 1c·1d | `spec/5-system/4-execution-engine.md` §Rationale C-1 "엔진 잔류" bullet | 변경 1e 신규 Rationale bullet 에 "기존 C-1 Rationale '엔진 잔류' 의 `retryLastTurn`·`applyRetryLastTurn thin delegator` 항은 본 결정(후속 ④)으로 대체된다" 명시 추가. |
| W-6 | Convention Compliance | plan frontmatter 필수 필드 `started`·`owner` 누락, `worktree` 전체 경로 기재 — `plan-frontmatter.test.ts` build guard 강제 | `plan/in-progress/spec-draft-c1-spec-drift.md` L1-6 frontmatter | `.claude/docs/plan-lifecycle.md §4` | `started: 2026-06-19`, `owner: project-planner` 추가. `worktree: spec-drift-c1-ea8bcb` 로 디렉토리명만 기재. 비표준 `created:` 키 제거 또는 `started:` 로 통일. |
| W-7 | Convention Compliance | `WORKFLOW_FORBIDDEN_WORKSPACE` — enum 미등재 코드를 에러코드 카탈로그 표 셀에 정식 항목처럼 기재하면 독자 혼선 | 변경 2·3 (`3-error-handling.md §1.4/§3.2`) | `spec/conventions/error-codes.md §1` (새 코드는 enum 등재 후 사용 원칙) | 표 본문 셀 기재 대신 표 아래 note/callout 형식으로 처리. "현재 inline throw — `SUB_WORKFLOW_FAILED` 로 surface, enum 등재 후속" 명시. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | 변경 5b: `mcpDiagnostics?` 추가는 §6 표와 §7 본문의 기존 불일치 해소 — 올바른 방향 | `spec/4-nodes/3-ai/0-common.md §6` L106 | 변경 5b 적용 후 §6·§7 정합 확인. |
| I-2 | Cross-Spec | 변경 6: `button_continue` shape `url?`·`selectedItem?` 가 `node-output.md §4.5` 와 이미 정합 — stale 동기화 | `spec/4-nodes/6-presentation/0-common.md §4.5` L131 | 변경 6 적용 후 세 파일 일치 확인. |
| I-3 | Cross-Spec | 변경 2: `executeSync` 가 현재 spec `1-workflow.md §4` 에 없는 메서드명 — `executeInline` 이 canonical | 변경 2 W-6 callout | 변경 2 에서 `executeSync` 를 제거하고 `executeInline`/`executeAsync` 두 가지만 표기. 또는 data-flow §3 교차 참조 추가. |
| I-4 | Rationale Continuity | 변경 4: 미등록 vendor passthrough 가 `AI_*` 별도 네임스페이스 신설 기각 Rationale 의 공백 채움 — 합의 번복 아님 | `spec/4-nodes/3-ai/1-ai-agent.md §Rationale` | §Rationale 에 "미등록 vendor 코드 passthrough 는 §10 단일 taxonomy 원칙의 연장" 한 줄 근거 추가 권장. |
| I-5 | Rationale Continuity | 변경 1d: `WorkflowExecutor` 재사용 기각·`WORKFLOW_EXECUTOR` 토큰 보존 — 기존 Rationale 계승 확인됨 | 변경 1d | 정합. 조치 불필요. |
| I-6 | Rationale Continuity | 변경 2/3: fail-open → fail-closed 전환 — 기존 spec 에 명시 결정 없으므로 합의 번복 아님 | 변경 2 W-6, 변경 3 | 정합. |
| I-7 | Convention Compliance | `status: draft` — spec-impl-evidence 5값 외 비표준 값이나 plan 파일은 해당 가드 적용 대상 아님. 빌드 차단 없음 | frontmatter L1 | 삭제 예정 임시 파일이므로 현 상태 유지 가능. |
| I-8 | Convention Compliance | `parent_plan:` — plan-lifecycle §4 미정의 키. "추가 필드 허용" 범위 내 | frontmatter L3 | 현 상태 유지 가능. |
| I-9 | Plan Coherence | `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재 후속(작업 1b)이 부모 plan `c1-engine-split.md` 에 이미 추적됨 — 이중 추적이나 미해결 결정 아님 | `spec-draft-c1-spec-drift.md` §비반영 | target 적용 후 부모 plan 해당 항에 "spec 반영 완료" 표기 권장. |
| I-10 | Plan Coherence | 변경 2(W-6 callout)와 `node-output-redesign/workflow.md` §5.2 미결 output 개선안 — 편집 위치 달라 직접 충돌 없음 | 변경 2 | `node-output-redesign/workflow.md` 에 "W-6 callout 갱신됨(fail-closed + 진입점 명시)" 메모 1줄 권장. |
| I-11 | Plan Coherence | 변경 3과 `spec-fix-prod-guards-prose.md` W5(§1.2 `TOKEN_INVALID`)가 동일 파일 다른 섹션 편집 — 의미 충돌 없음 | 변경 3 `3-error-handling.md §1.4/§3.2` | target 적용 PR 본문에 W5 미적용 draft 잔존 언급으로 충분. |
| I-12 | Naming Collision | ISP 5-부분인터페이스(`CoreEngineDriver` 등) 명칭이 spec 신규 도입 — 기존 `EngineDriver` 단일 복합 인터페이스와 레이어 혼동 가능 | 변경 1d ISP 산문 | 삽입 산문에 "(코드 레벨 ISP 분해 — spec SoT 는 단일 `EngineDriver` 계약)" 한 줄 명시. |
| I-13 | Naming Collision | `LlmCallRecord`/`TurnDebugEntry` spec 신규 타입명 — 기존 필드 기술과 정합, 동명 충돌 없음 | 변경 5 | 없음. |
| I-14 | Naming Collision | `WORKFLOW_FORBIDDEN_WORKSPACE` — L75 에 이미 존재, 신규 식별자 아님. §3.2 추가는 기존 기술의 카탈로그 등재 | 변경 2·3 | 없음. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | W-1(§10 passthrough vs LLM_CALL_FAILED 모순), W-2(§3/§4.2 미동기화), W-3(§4.4 facade 미기술), W-4(§3.2 미동기화) 4건 WARNING |
| Rationale Continuity | LOW | W-5(C-1 Rationale 번복 cross-reference 부재) 1건 WARNING |
| Convention Compliance | LOW | W-6(frontmatter 필수 필드 누락·빌드 가드 강제), W-7(enum 미등재 코드 표 셀 기재) 2건 WARNING |
| Plan Coherence | NONE | 미해결 결정 우회·선행 plan 미해소 없음. 후속 추적 INFO 3건 |
| Naming Collision | NONE | 의미 충돌 식별자 없음. 레이어 혼동 예방 INFO 3건 |

## 권장 조치사항

1. **(W-6 우선)** `plan/in-progress/spec-draft-c1-spec-drift.md` frontmatter 에 `started: 2026-06-19`, `owner: project-planner` 추가, `worktree` 값을 `spec-drift-c1-ea8bcb` 로 정정, 비표준 `created:` 제거 — build guard `plan-frontmatter.test.ts` 차단 해소.
2. **(W-1)** 변경 4 적용 시 `ai-agent.md §10` L1099 분류 규칙 문단을 "code 있으면 passthrough·`retryable=false` / code·상태·network 신호 모두 없으면 `LLM_CALL_FAILED` fallback" 으로 재기술. `LLM_PROVIDER_QUOTA`·`LLM_API_ERROR` 를 에러 코드 표 "(passthrough 예시)" 행으로 추가.
3. **(W-5)** 변경 1e 신규 Rationale bullet 에 "기존 C-1 '엔진 잔류' `retryLastTurn`·`applyRetryLastTurn thin delegator` 항은 후속 ④로 대체" cross-reference 명시.
4. **(W-2)** 변경 1c 적용 시 `execution-engine.md §3` L193 callout 과 `§4.2` WS 사용처 설명을 동기화.
5. **(W-3)** 변경 1e 적용 시 `§4.4` 본문에 `ExecutionEventEmitter` facade 가 §4.4 정책의 예외가 아닌 동형 래퍼임을 한 줄 명시.
6. **(W-4)** 변경 3 적용 시 `3-error-handling.md §3.2` Sub-workflow 행을 §1.4 와 완전히 동일한 4종 + 링크 형태로 작성.
7. **(W-7)** `WORKFLOW_FORBIDDEN_WORKSPACE` 를 에러코드 카탈로그 표 셀이 아닌 note/callout 으로 처리.
8. **(I-3)** 변경 2 에서 `executeSync` 제거 후 `executeInline`/`executeAsync` 두 가지만 표기(또는 data-flow §3 교차 참조 추가).
9. **(I-4)** `ai-agent.md §Rationale` 에 "미등록 vendor passthrough = §10 단일 taxonomy 연장" 한 줄 근거 추가.
10. **(I-12)** ISP 부분인터페이스 명칭 삽입 산문에 "코드 레벨 ISP 분해 — spec SoT 단일 `EngineDriver` 계약" 괄호 명시.

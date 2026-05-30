---
worktree: retry-downstream-traversal-spec-f4a19d
started: 2026-05-30
owner: project-planner
---

# Spec draft — retry_last_turn 성공 시 downstream graph 진행 명시 (WARNING #10)

> `plan/in-progress/retry-handler-followup.md` WARNING #10 의 해소. spec 한 줄 명시 (PR1) + 구현 fix (PR2, 별 PR).

## 배경

`retry_last_turn` 이 multi-turn AI 노드의 일시적 LLM 에러를 재진입시키는 노드 단위 재시도 기능으로 도입됐다 ([Spec AI Agent §7.9](../../spec/4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트), [Spec WS §4.2](../../spec/5-system/6-websocket-protocol.md#42-실행-제어-명령-client--server)). 현재 구현(`execution-engine.service.ts:3427 completeRetryExecution`) 은 재진입한 turn 이 성공해도 Execution 을 즉시 `COMPLETED` 로 마감해 downstream 노드 traversal 을 우회한다.

spec 의 "노드 단위 재시도 — 마지막 LLM 호출 재진입" 표현은 워크플로 Re-run ([§13](../../spec/5-system/13-replay-rerun.md)) 과의 구분(Execution 단위 vs 노드 단위) 의도였지, downstream traversal 차단 의도는 어디에도 없다. AI 노드가 재진입을 통해 결국 성공한 상태가 됐다면 그건 일반 성공 노드와 의미적으로 동일하며, downstream traversal 은 워크플로 엔진의 기본 invariant 다.

본 draft 는 그 invariant 가 retry 경로에도 적용됨을 spec 에 한 줄 명시한다. 구현 fix 는 PR2 에서.

## 변경 1 — `spec/4-nodes/3-ai/1-ai-agent.md` §7.9

기존 line 894~896 의 "재시도 진입" / "재진입 시 config expression 재평가" 단락 직후 (line 897 빈 줄 뒤) 에 다음 한 단락 추가:

> **재진입 종결 후 graph 진행**: 재진입한 turn 이 성공 종결되면 spawn 된 NodeExecution 은 일반 노드 `COMPLETED` 와 동일하게 출력 포트의 downstream 노드로 그래프 진행이 이어지며, 워크플로 종결 규칙([실행 엔진 §4.2](../../5-system/4-execution-engine.md))을 따른다. 재진입 turn 이 다시 실패하면 일반 노드 `FAILED` 와 동일하게 §10 의 종결 규칙을 따른다 (Execution 도 `FAILED` 마감). 즉 retry 는 "마지막 LLM 호출 재진입" 까지가 단위이고, 그 결과의 downstream 처리·종결 정책은 일반 노드의 그것과 같다 — 워크플로 Re-run ([§13](../../5-system/13-replay-rerun.md)) 과의 구분은 "동일 Execution 안 노드 단위 재진입" 이지 "downstream 차단" 이 아니다.

## 변경 2 — `spec/5-system/6-websocket-protocol.md` §4.2

기존 line 358 의 "replay 중 cancel" bullet 다음 (line 358 끝, line 359 빈 줄 직전) 에 새 bullet 추가:

> - **재진입 종결 후 graph 진행**: 재진입한 turn 이 성공 종결되면 spawn 된 NodeExecution 은 일반 노드 `COMPLETED` 와 동일하게 출력 포트의 downstream 으로 진행한다 ([실행 엔진 §4.2](./4-execution-engine.md)). 재진입이 실패하면 일반 노드 `FAILED` 와 동일하게 종결 (Execution 도 `FAILED` 마감). 워크플로 Re-run ([§13 replay-rerun](./13-replay-rerun.md)) 과 구분되는 점은 "동일 Execution 안 노드 단위 재진입" 이며 "downstream traversal 차단" 이 아니다. AI Agent 본문은 [§7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트) 참조.

## 변경 3 — `spec/5-system/13-replay-rerun.md` §14.3

기존 §14.3 (line 418-420) 의 "Multi-turn snapshot 과의 직교성" 단락 끝에 한 단락 추가:

> 노드 단위 재시도 (`execution.retry_last_turn`, [Spec WebSocket §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) + [Spec AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트)) 도 본 Re-run 모드와 직교한다. retry 는 동일 Execution 안에서 같은 노드의 마지막 LLM 호출만 새 NodeExecution row 로 재진입하며, 성공 시 그 노드의 downstream 은 일반 노드 `COMPLETED` 와 동일하게 진행된다. Re-run 은 새 Execution row 와 chain 깊이 증가를 만드는 반면 retry 는 동일 chain·동일 Execution 안의 in-place 재시도라는 점이 다르다 — chain badge 도 부여되지 않는다.

## Rationale 갱신

### `spec/4-nodes/3-ai/1-ai-agent.md` §12 끝에 새 §12.8 추가

> ### 12.8 `retry_last_turn` 성공 후 downstream graph 진행
>
> **문제**: 초기 구현은 `retry_last_turn` 으로 재진입한 turn 이 성공해도 Execution 을 즉시 `COMPLETED` 로 마감해, 해당 AI 노드의 downstream 으로 연결된 노드 (예: HTTP Request, Send Email) 가 실행되지 않는 갭이 있었다. spec 의 "노드 단위 재시도" 표현이 워크플로 Re-run ([§13](../../5-system/13-replay-rerun.md)) 과의 구분 (Execution 단위 vs 노드 단위) 의도였음에도 일부 독자가 "downstream 도 의도적으로 차단" 으로 오독할 여지가 있었다.
>
> **결정**: retry 성공 시 spawn 된 NodeExecution 은 일반 노드 `COMPLETED` 와 동일하게 downstream graph 로 진행한다. retry 의 단위는 "마지막 LLM 호출 재진입" 까지이며, 그 결과의 graph traversal·종결 정책은 일반 노드와 같다. 이는 워크플로 엔진의 기본 invariant ("성공한 노드는 출력 포트의 downstream 으로 진행") 의 자연스러운 적용이지 새 정책이 아니다 — 본 §7.9 의 명시는 구현 정렬을 위한 표면 명확화다.
>
> **기각된 대안**:
>
> - **downstream 도 차단 (현 구현 유지)** — 사용자가 retry 로 대화를 살린 뒤 워크플로의 나머지 분기는 별도 Re-run 으로 다시 돌려야 한다는 의미가 되어, "한 노드만 살리고 나머지 흐름은 그대로" 라는 retry 의 본래 목적과 충돌한다.
> - **별도 `execution.retry_last_turn_and_resume` 명령으로 분리** — 사용자가 두 가지 retry 행위를 구분해 선택해야 하는 추가 인지 부담. retry 의 본질은 항상 "그 노드를 살리고 워크플로를 정상 진행" 이라 분리할 이유가 없다.

### `spec/5-system/6-websocket-protocol.md` Rationale 끝에 새 단락 추가

> ### `execution.retry_last_turn` 의 graph 진행 의미 — Re-run 과의 경계
>
> retry 는 "노드 단위 재시도" 라는 표현 때문에 일부 독자가 "downstream 도 의도적으로 차단" 으로 오독할 여지가 있었으나, spec 의 의도는 워크플로 Re-run ([§13](./13-replay-rerun.md)) 과의 단위 구분 (Execution 단위 vs 노드 단위) 이지 downstream traversal 차단이 아니다. 재진입한 turn 의 성공 후 graph 진행은 일반 노드 `COMPLETED` 와 동일한 워크플로 엔진의 기본 invariant 적용이며, AI Agent §7.9 + §12.8 에서 동일 결정 근거를 공유한다.

### `spec/5-system/13-replay-rerun.md` Rationale 끝에 새 단락 추가

> ### `execution.retry_last_turn` 과의 경계 (§14.3 보강)
>
> 노드 단위 재시도 (`execution.retry_last_turn`, [Spec AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트)) 는 동일 Execution 안에서 같은 노드의 마지막 LLM 호출만 새 NodeExecution row 로 재진입하는 in-place 재시도이며, 성공 시 downstream graph 는 일반 노드 `COMPLETED` 와 동일하게 진행된다. 본 Re-run spec 의 단위 (전체 워크플로, RR-PL-03) 와 chain 추적 모델 (RR-PL-05) 은 retry 에 적용되지 않으며, 둘은 동일 사용자 가치 ("실패한 흐름 다시" — §2) 의 다른 입자 (granularity) 다. retry 가 노드 단위로 좁고 빠른 회복 (시간 단위 60분 TTL) 을 다루고, Re-run 이 워크플로 단위로 무한 깊이 (chain 32) 의 재실행을 다룬다.

## Plan 갱신

`plan/in-progress/retry-handler-followup.md` 의 WARNING #10 항목을 다음과 같이 갱신:

기존:
```
- 🔲 **남은 한계 (스펙 결정 필요 — project-planner)**:
  - **WARNING #10 — 성공 retry 후 downstream 그래프 traversal**: retry 로 대화는 재개되나, AI 노드의 출력 포트에 연결된 하류 노드는 미실행 (성공 종결 시 Execution 을 COMPLETED 로만 마감). **스펙 판단 결론 (2026-05-30)**: ... downstream traversal 은 신규 제품 동작(노드 단위 → 워크플로 재개로 의미 확장)이라 `project-planner` 의 spec 결정이 선행돼야 하며 developer 범위가 아니다. ... **사용자/기획 결정 대기.**
```

신규:
```
- ✅ **WARNING #10 (spec 명시 — PR1, 2026-05-30)**: retry 성공 후 downstream traversal 이 일반 노드 COMPLETED 와 동일하게 진행됨을 spec 에 명시 — `spec/4-nodes/3-ai/1-ai-agent.md §7.9` + `spec/5-system/6-websocket-protocol.md §4.2` + `spec/5-system/13-replay-rerun.md §14.3`. 직전 "사용자/기획 결정 대기" 분류는 과보수적이었음 — spec 의 "노드 단위 재시도" 표현은 워크플로 Re-run 과의 단위 구분 의도였지 downstream 차단 의도가 아니었음을 명확화. Rationale: §12.8 (ai-agent) + Rationale (websocket / replay-rerun) 에 결정 근거 보존. **구현 fix 는 PR2 — `completeRetryExecution` 의 즉시 Execution.COMPLETED 마감을 일반 graph loop 합류로 교체** (`developer` 위임).
```

## 영향 spec 정합성

- `spec/5-system/4-execution-engine.md §4.2` (워크플로 종결 규칙) — 본 spec 변경의 referent. 변경 없음 (기존 규칙을 retry 경로에도 적용한다는 cross-ref 만 추가).
- `spec/conventions/node-output.md §4.2.1` (`_retryState` 보존 예외) — 변경 없음. retry 의 운반 메커니즘 정의이며 graph 진행 의미와 직교.
- `spec/4-nodes/3-ai/1-ai-agent.md §10` (에러 코드) — 변경 없음. retry 실패 시 일반 노드 FAILED 종결 규칙을 따른다는 명시는 §7.9 에서 한 줄로 처리.
- `spec/5-system/13-replay-rerun.md §15` (향후 확장 D2) — 변경 없음. D2 는 "Re-run 시 multi-turn 사용자 응답 자동 재사용" 이라 retry 의 본문과 다른 주제.

## 구현 fix (PR2 — 본 spec PR 이후)

다음은 본 PR 범위 밖이며 참고용:

- `execution-engine.service.ts:3427 completeRetryExecution` 의 즉시 `execution.status = COMPLETED` 마감을 제거하고, `finalizeAiNode` 가 이미 spawn row 를 COMPLETED 마감 + `nodeOutputCache` seed + `EXECUTION_RESUMED` emit + Execution RUNNING 전이까지 해 둔 상태에서 graph rebuild + reachability seed + 일반 graph loop 진입 (`resumeGraphAfterRetry` 헬퍼 신설) 으로 교체.
- 단위 테스트: (a) downstream 있음 → dispatch 검증, (b) leaf → 즉시 COMPLETED 검증 (현재 동작과 동일), (c) downstream 에 form 노드 → WAITING_FOR_INPUT 진입 검증, (d) retry 재실패 → 기존 `failRetryExecution` 경로 무변경 검증.
- e2e: AI Agent → HTTP 노드 그래프에서 AI 401/429 시뮬레이션 후 retry 클릭 → HTTP 노드 실행 검증.
- 본 PR 의 spec 변경이 merge 된 직후 developer skill 위임으로 PR2 시작.

## 적용 시 발견사항 보완 (2026-05-30 — consistency-check `review/consistency/2026/05/30/14_48_20`)

draft 의 인용구 텍스트와 실제 적용 텍스트 사이에 다음 보완이 반영됐다 — 모두 BLOCK 없는 Warning/Info 의 권고 반영:

- **앵커 교정** (cross-spec I2, rationale-continuity I2): `[실행 엔진 §4.2]` → `[실행 엔진 §1.1 Execution 상태]` + `[§2.1 토폴로지 traversal]` 두 앵커로 분리. §4.2 는 "태스크 단위 (Worker 모델)" 라 의미 불일치.
- **§12.8 도입 한 줄** (cross-spec I5): "본 절은 §7.9 '재진입 종결 후 graph 진행' 단락의 결정 근거다." 한 줄을 §12.8 서두에 추가 — render_form 테마에서 retry 테마로의 급전환 완화.
- **chain badge 근거 보강** (cross-spec I4): §14.3 의 "chain badge 도 부여되지 않는다" 에 "retry 는 새 Execution row 를 생성하지 않으므로 §9 의 `re_run_of` / `chain_id` 에 관여하지 않으며" 근거 병기.
- **frontmatter 정책 명시** (convention W3): PR1 시점에서 3 개 target spec 파일의 frontmatter `status` 변경 없음 — PR2 (구현 fix) merge 후 `pending_plans:` 등 `spec/conventions/spec-impl-evidence.md §2·§3` 가드 정합 정리. `retry-handler-followup.md` WARNING #10 갱신 텍스트에 동일 정책 명시.
- **WARNING #10 번복 경위 보강** (rationale-continuity W4): `retry-handler-followup.md` WARNING #10 갱신 텍스트에 "rationale-continuity-checker 가 과거 Rationale 에 downstream 차단 결정이 명시된 적 없음 확인 → 무근거 번복 아님" 명시.
- **replay-rerun 의존성 메모** (plan W2): `plan/in-progress/replay-rerun.md` 관련 문서 절에 `§14.3` 변경 사실과 후속 rebase 검토 필요 한 줄 추가.

미반영 Info (필수 아님):
- I1 — `spec/5-system/4-execution-engine.md §1.1` `failed → running` 행에 downstream traversal 언급 보강. cross-spec 의 표면 비대칭이긴 하나 §7.9 + §4.2 의 명시로 의미 SoT 가 완결돼 보강 미반영.
- I3 — websocket §4.2 bullet 의 삽입 위치. `_retryState` 소비 계약 절 안에 두면 맥락 전환이라는 지적이나, "재진입 종결 후 graph 진행" 도 동일 명령의 동작 계약이라 같은 절 안에서 자연스럽다고 판단해 현 위치 유지.
- I6 — 실행 엔진 Rationale 의 "재진입 성공 시 completed" 모호성 보강. AI Agent §7.9 + §12.8 이 의미 SoT 가 되므로 별 PR 으로 분리해 검토.
- I7 — 인용구 링크 기준 명시. 각 target spec 파일 기준이 자연스럽고 본문 적용 후엔 모호성 없음.
- I8 — `retry-handler-followup.md` WARNING #1~#5 의 ✅ 재분류. 본 draft 범위 밖이며 별 plan 정리 단계에서 처리.
- I9 — PR2 의 `EXECUTION_RESUMED` 의미 겸용 검토. PR2 spec 갱신 시점에 다룸.

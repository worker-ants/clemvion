# 정식 규약 준수 검토 — linear-cancel-mechanism

## 사전 안내 — 프롬프트 조립 결함 우회

`_prompts/convention_compliance.md` 는 "Target 문서" 로 `spec/conventions/` 전체를
dump 하도록 조립됐으나, 컨텍스트 예산이 `cafe24-api-catalog/` 서브트리(대부분 이번
작업과 무관)에서 소진돼 `node-cancellation.md`·`node-output.md`·`error-codes.md`
— 오케스트레이터가 명시한 중점 파일 3개 — 가 모두 "생략됨" 목록에 들어갔고, 정작
이번 diff 자체(`## 구현 변경 사항` 류 섹션)는 프롬프트에 전혀 포함돼 있지 않았다
(`feedback_impl_done_spec_bundle_bug` 류의 번들링 결함과 동일 패턴). 이에 따라 본
검토는 프롬프트 대신 워크트리를 절대경로로 직접 열어 수행했다:

- 규약 3종: `Read` 절대경로로 `spec/conventions/{node-cancellation,node-output,error-codes}.md` 직접 확인.
- 구현 diff: `git -C <worktree> diff origin/main...HEAD` 로 실제 변경분 확인
  (`spec/conventions/**` 는 diff 0건 — 오케스트레이터 서술과 일치).

## 발견사항

- **[WARNING] `assertExecutionNotCancelled`/`ExecutionCancelledError` 신규 메커니즘이 §2.3·§5.1 에 미문서화**
  - target 위치: `spec/conventions/node-cancellation.md` §2.3 (생산자 목록, L56-61) · §5.1 (L107-109)
  - 위반 규약: 본 문서 자체(§2.3 은 abort 생산자를 4개로 열거, §5.1 은 "노드 핸들러는 abort 시 `error.name === 'AbortError'` 를 throw" 로만 분류 경로를 규정)
  - 상세: 이번 diff 가 신설한 `ExecutionEngineService.assertExecutionNotCancelled()` (`execution-engine.service.ts`)는 §2.3/§5.1 이 전제하는 `context.abortSignal` 기반 신호 전파가 **전혀 아니다** — 노드 경계마다 Execution 행을 DB 에서 재조회해 외부 cancel(`POST /executions/:id/stop`)을 관측하고, `error.name` 이 `'AbortError'` 가 아닌 별도 sentinel `ExecutionCancelledError` 를 throw 한다. 즉 지금 §5.1 은 "`cancelled` 로 귀결되는 유일한 throw 형태는 `AbortError`" 라고 읽히는데, 실제로는 발생 지점(핸들러 vs 엔진 dispatch 루프)과 `error.name` 이 다른 **두 번째 독립 경로**가 같은 분류로 수렴한다. CHANGELOG.md 신규 항목도 `SoT: spec/conventions/node-cancellation.md §2.3/§5.1` 이라 명시하지만, 그 섹션들의 현재 문면은 이 메커니즘을 설명하지 않는다.
  - 이미 추적됨: `developer` 는 `spec/` 쓰기 권한이 없어 스스로 고치지 않고 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-26 #6)" 절에 §2.3 신규 bullet·§5.1 단락·§6 신규 표 행·`frontmatter.code:` 갱신을 구체적으로 제안해 project-planner 에게 위임했다 — CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 프로세스를 정확히 따른 것으로 보인다.
  - 제안: 규약 갱신이 정답 — 위 plan 문서의 제안(§2.3 bullet 추가 + §5.1 단락 추가 + §6 신규 행)을 project-planner 턴에서 반영. 코드 쪽 추가 변경은 불필요.

- **[WARNING] §5.2 errorPolicy 표가 `ExecutionCancelledError` 의 우회 재throw(모든 정책 무시)를 다루지 않음**
  - target 위치: `spec/conventions/node-cancellation.md` §5.2 (L111-119)
  - 위반 규약: 같은 문서 §5.2 자신 — `errorPolicy === 'continue'` 항목이 "그 노드 `cancelled` 기록 후 후속 분기 계속" 이라고 서술
  - 상세: 이번 diff 는 `foreach-executor.ts`(C3)·`parallel-executor.ts`(C5)에서 `ExecutionCancelledError` 를 **errorPolicy 분기(`stop`/`continue`/`skip`/`cancel-others-on-fail`) 판정 이전에 무조건 재throw** 하도록 가드를 추가했다 — 즉 이 sentinel 에 한해서는 `continue`/`skip` 이어도 "후속 분기 계속" 하지 않고 전체를 중단시킨다. 코드 주석은 이 예외의 근거(사용자가 실행 전체를 Stop 했으므로 개별 브랜치의 `continue` 의미가 없다)를 정확히 남겼으나, §5.2 문면 자체는 이 구분(브랜치 자신의 I/O abort vs 실행 전체 외부 cancel)을 두지 않아 "그 노드 cancelled 기록 후 후속 분기 계속" 을 문자 그대로 읽으면 오독 소지가 있다. 위 plan 문서의 "#6 위임" 목록에도 §5.2 는 언급되지 않아 이번 검토에서 추가로 짚는 항목이다.
  - 제안: §5.2 에 "단, `ExecutionCancelledError`(§2.3 신규 Execution-레벨 가드)는 errorPolicy 와 무관하게 항상 우회 재throw — 브랜치 자신의 I/O `AbortError` 와 달리 실행 전체가 외부에서 종료 확정된 상태이므로 `continue`/`skip` 의 '계속' 의미가 성립하지 않는다" 류의 각주 추가. §2.3/§5.1 갱신과 같은 턴에 처리하면 비용이 낮다.

- **[WARNING] `error.code: 'AbortError'` 가 error-codes.md 명명 규약 위반 상태로 미등재 — 이번 diff 가 그 패턴을 공유 헬퍼로 확산**
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 신규 `markNodeCancelled()` (diff 내 `+ if (errorEnvelope) nodeExecution.error = errorEnvelope;`), 호출부 `{ code: 'AbortError', message: err.message }`
  - 위반 규약: `spec/conventions/error-codes.md` §1 (`UPPER_SNAKE_CASE`, node-output.md §3.2 위임) · §3 (historical-artifact 예외는 **명시 등재** 의무)
  - 상세: `AbortError` 는 PascalCase 라 §1 표기 규약 위반이고, §3 예외 레지스트리 어디에도 등재돼 있지 않다. 이 값 자체는 이번 diff 이전부터 존재했으나(선재 — `git diff` 상 `-        const errorEnvelope = { code: 'AbortError', message: err.message };` 로 확인, 순수 리팩토링), 이번 diff 는 이 정확한 필드를 `markNodeCancelled()` 공유 헬퍼의 매개변수로 승격시켜 재사용 지점을 늘렸다(향후 신규 호출부가 늘어날수록 미등재 예외의 표면이 함께 넓어진다).
  - 이미 추적됨: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-25 #4)" 항목 (1) 이 정확히 이 gap 을 지적하고 `error-codes.md §3` 저비용 등재를 권고안으로 제시했다.
  - 제안: project-planner 턴에서 `error-codes.md §3` 에 `AbortError` 를 historical-artifact 로 등재(등재 사유: 노드 cancellation 분류 표준 — JS 런타임 `Error.name` 관용 표기를 그대로 채택, `UPPER_SNAKE_CASE` 신설 코드와 별도 계보).

- **[WARNING] §5.1 `meta.success = false` 서술이 구현과 계속 어긋남 (이번 diff 가 그 코드 경로를 리팩토링했지만 갭을 닫지 않음)**
  - target 위치: `spec/conventions/node-cancellation.md` §5.1 마지막 문장(L109) — `codebase/backend/.../execution-engine.service.ts` 신규 `markNodeCancelled()`
  - 위반 규약: 문서 자신의 §5.1 — "`output.error` 는 표준 봉투(`code: 'AbortError'`)로 기록하되 `meta.success = false`"
  - 상세: `markNodeCancelled()` 는 `status`/`error`/`finishedAt`/`durationMs` 만 설정하고 `nodeExecution.meta` 는 전혀 건드리지 않는다 — `meta.success = false` 가 실려나가지 않는다. 이번 diff 는 정확히 이 catch 블록(구 `isAbortError` 분기)을 추출해 `markNodeCancelled()` 로 옮겼음에도 `meta.success` 보강은 포함하지 않았다.
  - 이미 추적됨: 같은 plan 문서 "#4" 항목 (2) 가 동일 gap 을 지적 ("문구를 삭제하거나, 엔진에 실제로 넣고 WS 표를 함께 갱신하거나 — 셋 중 하나로 통일").
  - 제안: project-planner 턴에서 (a) §5.1 문구에서 `meta.success = false` 삭제, 또는 (b) `markNodeCancelled()` 에 `nodeExecution.meta = { ...nodeExecution.meta, success: false }` 보강 — 코드 쪽으로 택하면 developer 턴에서 후속 처리.

- **[INFO] CHANGELOG.md 의 "SoT: §2.3/§5.1" 표기가 시제상 앞서 있음**
  - target 위치: `CHANGELOG.md` 신규 항목 마지막 줄 "SoT: `spec/conventions/node-cancellation.md` §2.3/§5.1."
  - 상세: 위 두 WARNING 이 확인하듯 §2.3/§5.1 의 **현재** 문면은 이번에 추가된 메커니즘을 설명하지 않는다. CHANGELOG 의 SoT 지목은 project-planner 가 §6-위임 제안을 반영한 이후에야 정확해지는 선언이다. 규약 문서 자체는 이번 diff 대상이 아니므로 CRITICAL 로 다루지 않으나, 독자가 지금 그 링크를 따라가면 신규 메커니즘의 근거를 찾지 못한다.
  - 제안: 별도 조치 불요(§2.3/§5.1 갱신이 완료되면 자동으로 참이 됨). 다만 갱신이 지연될 경우 CHANGELOG 문구를 "SoT 갱신 예정: plan/in-progress/spec-update-node-cancellation-shutdown-classification.md" 로 임시 완화하는 것도 고려 가능.

- **[INFO] §2.2(best-effort) 인용이 원래 취지와 다른 개념(엔진 DB-폴링 스로틀)에 적용됨**
  - target 위치: `execution-engine.service.ts` `CONTAINER_CANCEL_CHECK_THROTTLE_MS` JSDoc, `plan/in-progress/node-cancellation-residual-signal-propagation.md` "트레이드오프" 절
  - 상세: §2.2 는 "노드 핸들러가 `context.abortSignal` 을 지원하지 않는 경우" 의 best-effort 를 규정하는 조항인데, 이번 diff 는 이를 인용해 **엔진 자신의** 아이템 경계 DB 재조회 스로틀(250ms 지연 허용)의 정당화 근거로 쓴다. 결론(취지상 무해)은 합리적이지만, 인용 대상 조항이 원래 다루는 계층(노드 핸들러의 signal 미지원)과 실제 적용 계층(엔진 dispatch 루프의 폴링 주기)이 다르다.
  - 제안: 위 첫 WARNING 의 §2.3 갱신 시, "Execution-레벨 재확인 가드의 관측 지연도 best-effort" 라는 문장을 §2.3 신규 bullet 또는 §5.1 에 함께 명문화하면 이 인용이 정확한 근거를 갖게 된다. 급하지 않음.

## 요약

`spec/conventions/**` 자체는 이번 diff 에서 변경되지 않았으며(확인됨: `git diff origin/main...HEAD -- 'spec/conventions/*'` 0건), 구현(`ExecutionEngineService.assertExecutionNotCancelled`/`ExecutionCancelledError` 기반 Execution-레벨 취소 가드, 컨테이너/Parallel/Sub-Workflow cascade, 재시도·background 오분류 수정)은 이미 7라운드 ai-review 를 거쳐 Critical/Warning 0 으로 수렴했고, 코드 자체가 `node-cancellation.md §5.1`/`node-output.md Principle 3.2` 를 주석으로 명시 인용하는 등 규약을 의식하며 작성됐다. 다만 규약 준수 관점에서는 **네 가지 실질적 drift** 가 확인된다 — (1) 신규 Execution-레벨 cancel 메커니즘이 §2.3/§5.1 에 미문서화, (2) §5.2 errorPolicy 표가 이 신규 메커니즘의 "정책 무관 우회 재throw" 를 다루지 않음, (3) `code: 'AbortError'` 가 error-codes.md 의 `UPPER_SNAKE_CASE`·예외 등재 규약을 계속 위반한 채 공유 헬퍼로 확산, (4) §5.1 의 `meta.success = false` 서술이 리팩토링된 코드에서도 여전히 미이행. 이 중 (1)·(3)·(4) 는 developer 스스로 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 에 구체적 제안을 남기고 project-planner 에게 정식 위임한 상태라 프로세스는 올바르게 지켜졌으나, **`spec/conventions/` 의 실제 텍스트는 아직 이 diff 가 만든 새 계약을 반영하지 못한 상태로 남아 있다**. (2) 는 이번 검토에서 추가로 확인한 항목으로 같은 위임 문서에 아직 없다. 코드 자체의 동작(모든 errorPolicy·container/parallel/sub-workflow 경로에서 취소를 일관되게 우회 처리하는 것)은 합리적이고 자기충족적이므로, 발견사항은 전부 "구현이 규약을 향후 시제로 앞서간(SPEC-DRIFT, 아직 미반영)" 유형이며 규약 위반이라기보다 규약 갱신 지연에 가깝다.

## 위험도

MEDIUM

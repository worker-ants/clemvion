# Plan 정합성 검토 — llm-usage-attr-hardening-4648ca (--impl-prep)

대상 draft: `/private/tmp/claude-501/.../scratchpad/impl-prep-draft.md` (변경 (e) ai-turn-executor.ts 타입 주석, (g) IE collection-retry attribution 테스트)
base: `origin/main` @ `cc3dafa8c` (docs PR #898 미포함)

## 발견사항

### [Warning] draft (e)/(g) ↔ plan INFO#1/INFO#4 매핑은 정확하지만, PR #898 과 같은 리스트 블록의 인접 줄을 편집해 merge 충돌 위험

- target 위치: draft "변경 (e)" / "변경 (g)" (draft 전문)
- 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md` §"최종 /ai-review(02_09_15) INFO" — 현재(cc3dafa8c 기준) 74-79행:
  - 74-75행 `- [ ] ai-turn-executor.ts:2599 ... (INFO#1 ...)`  ← draft (e)
  - 76-77행 `- [ ] Text Classifier ... (INFO#3 ...)`  ← 본 코드 PR 범위 밖, 문서 전용
  - 78-79행 `- [ ] IE runTurnWithCollectionRetries ... (INFO#4 ...)`  ← draft (g)
- 상세:
  1. 매핑 검증: `llm-usage-doc-alignment-01d7a4` 워크트리(#898, commit `895087c2a`, 아직 origin/main 미머지)의 실제 diff 를 직접 읽어 확인한 결과, #898 은 정확히 이 plan 파일의 "잔여 follow-up" 4개 항목 전부(현재 61-76행, no-op 종결 포함)와 "최종 review INFO" 의 **INFO#3 만** `[x]` 로 체크했고, **INFO#1·INFO#4 는 그대로 `[ ]`** 로 남겨뒀다. 즉 draft (e)=INFO#1, (g)=INFO#4 는 plan 문서와 1:1 정확히 대응하며, 본 코드 PR 이 그 두 체크박스를 마저 체크하는 것이 맞는 그림이다.
  2. 그러나 실제 코드 라인 대조 결과 draft 의 인용(:2599 `const llmContext = {...}`, IE `describe('collection retry loop')`:954, 기존 첫 호출 단언 `it`:921, `retryState()` 헬퍼에 `executionId` 부재:970-991)은 현재 코드베이스와 정확히 일치 — draft 자체의 기술적 근거는 검증됨.
  3. **merge 충돌 위험**: #898 은 이 plan 파일의 "최종 review INFO" 3-item 리스트 중 **가운데(INFO#3, 원본 76-77행)** 를 4줄로 확장 편집한다. 본 코드 PR 은 같은 리스트의 **양쪽(INFO#1 원본 74-75행, INFO#4 원본 78-79행)** 을 편집해야 한다. 세 항목이 리스트 구분자(빈 줄) 없이 연속 배치돼 있어, git 기본 diff context(3줄)가 서로의 편집 hunk 를 침범할 가능성이 높다 — 특히 INFO#3 편집(76행)과 INFO#1 편집(74행)은 단 2줄 차이. 두 PR 이 서로의 변경을 모른 채 각자 base(cc3dafa8c)에서 갈라져 나가 있으므로, 먼저 머지되는 쪽이 아닌 PR 은 rebase 시 이 블록에서 conflict marker 를 만날 개연성이 크다(내용 자체는 상충하지 않아 해소는 trivial하지만, 자동화 파이프라인에서 수동 개입 없이는 막힌다).
- 제안: 두 갈래 권고 중 실제 머지 순서에 맞춰 택일.
  - **(A) 순서가 통제 가능하면 우선**: `claude/llm-usage-doc-alignment-01d7a4` (#898) 을 먼저 merge → 본 attr-hardening 브랜치를 그 위로 rebase → rebase 후의 실제 줄 번호(문서 상 80행 INFO#1, 86행 INFO#4)에 맞춰 `[ ]`→`[x]` 편집. 이 경우 텍스트 충돌이 원천적으로 없다.
  - **(B) 순서를 통제할 수 없으면**: 본 PR 은 plan 파일을 건드리지 않고 코드 변경(e)(g)만 반영 — plan 의 INFO#1/INFO#4 체크는 **#898 병합 후의 별도 소규모 후속(또는 #898 자신의 rebase)** 으로 미룬다. 단, 이 경로를 택하면 plan 이 일시적으로 stale 해지므로(코드는 이미 반영됐는데 체크박스 미체크) PR 설명/커밋 메시지에 "plan 체크는 #898 머지 후 별도 처리" 라고 명시해 유실 방지.
  - 아래 [Info] 항목이 이 결정과 맞물려 있다(draft 자체가 plan 파일 갱신을 전혀 언급하지 않음).

### [Info] draft 가 plan 체크박스 갱신을 아예 언급하지 않음 — push-gate hook 은 강제하지 않지만 SoT 신선도 관점 권고

- target 위치: draft 전문 (plan 파일 언급 없음)
- 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md` frontmatter `worktree: elastic-shannon-e52824`
- 상세: `.claude/docs/plan-lifecycle.md` §3 의 push-gate(`guard_review_before_push.py`)는 in-progress plan frontmatter 의 `worktree:` 가 **현재 worktree 디렉토리명과 일치**할 때만 "연결된 plan" 으로 간주해 갱신을 강제한다. 이 plan 의 `worktree:` 값은 `elastic-shannon-e52824` 이고 현재 작업 중인 worktree 는 `llm-usage-attr-hardening-4648ca` 이므로 **문자 그대로는 불일치** — hook 이 이 PR 을 이 plan 에 "연결됨"으로 자동 판정하지 않을 가능성이 높다. 즉 draft 가 plan 파일을 안 건드려도 push 가 기계적으로 막히지는 않을 것이다. 다만 내용상 이 PR 은 그 plan 의 마지막 두 follow-up 항목을 정확히 소진하는 작업이므로, hook 강제 여부와 무관하게 SoT 정확성을 위해 체크 반영을 권고(위 [Warning] 의 (A)/(B) 중 택일과 함께).
- 제안: impl-prep 단계에서 이 갱신을 명시적 작업 항목으로 추가(어느 PR 이 체크할지는 위 (A)/(B) 결정에 종속).

### [Warning] `task_6da430a3` (IE·ai-turn-executor 재개 식별 필드 hydration 공용화)가 draft (e)와 같은 코드 지점을 대상

- target 위치: draft "변경 (e)" — `ai-turn-executor.ts:2599` `const llmContext = { workflowId, executionId, nodeExecutionId }`
- 관련 plan: 로컬에 아티팩트가 없는 별도 스폰 task chip `task_6da430a3` (`ResumeIdentificationFields` 타입 + `pickResumeIdentificationFields` 헬퍼, ai-turn-executor.ts + information-extractor.handler.ts 공용화) — 로컬 브랜치/워크트리로 아직 구체화되지 않아 git 상으로 검증 불가(설명 텍스트 기준 판단).
- 상세: 두 작업이 겨냥하는 것은 **같은 object literal**이다 — draft (e)는 그 리터럴에 `LlmCallContext` 타입 주석만 얹고, `task_6da430a3`는 그 리터럴 자체를 (아마 information-extractor.handler.ts 의 유사 지점과 함께) 공용 헬퍼 호출로 대체하려 한다. 이는 기능적 **충돌**은 아니다 — (e)는 in-place 편집 2~3줄이라 어느 쪽이 먼저 머지돼도 나중 쪽이 그 몇 줄을 다시 덮어쓰면 그만이다. `task_6da430a3` 를 무의미하게 만들지도 않는다: 헬퍼가 `pickResumeIdentificationFields(state): ResumeIdentificationFields` 처럼 **명시 반환 타입**을 갖추면 (e)가 잡으려던 "오탈자 필드가 인자로 넘어갈 때 조용히 누락"되는 클래스의 버그를 헬퍼 내부의 return 문 자체에서 동일하게(오히려 단일 지점으로 집약돼 더 견고하게) 방지할 수 있다 — 이 경우 (e)는 상위 호환으로 흡수돼 checkbox 만 유효, diff 는 무의미해진다. 반대로 헬퍼가 반환 타입을 명시하지 않으면(추론에 의존) 같은 여지가 다시 생길 수 있어, (e)가 남긴 "왜 명시 타입이 필요한가"라는 근거가 `task_6da430a3` 구현자에게 인수인계돼야 한다.
- 제안: (e)는 저비용·즉시 가치가 있으므로 순서와 무관하게 그대로 진행 권고. 다만 `task_6da430a3` 담당자에게 "이 리터럴에 이미 `LlmCallContext` 타입 주석이 붙어 있으며, 대체 헬퍼도 동일한 명시 반환 타입(`ResumeIdentificationFields`)을 가져야 동일한 컴파일 타임 보호가 유지된다"는 근거를 전달할 것. `task_6da430a3` 가 먼저 머지되면 (e)의 코드 변경분은 그대로 재대체(superseded)되므로 그때는 draft (e)를 재적용하지 말고 헬퍼의 반환 타입 명시 여부만 확인하는 것으로 대체.

## 교차 확인 — 그 외 in-progress plan 과의 파일 중복 (충돌 없음)

`ai-turn-executor.ts` 또는 `information-extractor.handler.spec.ts` 를 언급하는 다른 in-progress plan:
- `plan/in-progress/spec-sync-mcp-client-gaps.md:46` — 동일 파일(`ai-turn-executor.ts`)의 **MCP 진단 accumulator**(`McpDiagnosticsAccumulator`, `buildMcpDiagnosticsMeta`) 관련 항목. draft (e)의 대상(라인 2599, `LlmCallContext` 타입 주석)과는 다른 함수/영역 — 직접 충돌 없음.
- `plan/in-progress/parallel-p2-followups.md:22` — `information-extractor.handler.ts` 의 `runTurnWithCollectionRetries` 를 언급하나 **abort-signal 전파**(node-cancellation) 관점이며 이미 "완료" 표기(`✅`). draft (g)가 추가하는 신규 `it`(attribution 단언)과 같은 `describe` 블록 안이지만 대상 assertion 이 달라 충돌 없음.
- `plan/in-progress/node-output-redesign/ai-agent.md`, `.../information-extractor.md` — output 5필드 규약(node-output.md) 관점의 대규모 진단 문서. `ai-turn-executor.ts` 참조 라인(:1209/:1439 single-turn error contract, :1738-2964 등)과 `information-extractor.handler.ts` 참조 라인(:839-1358, :1443-1493 등)이 다수 있으나, draft (e)의 2599행·(g)의 1037행(traceChat 3번째 인자 전달부)과는 **겹치지 않음**. 단, `information-extractor.md` §"종합 개선안"의 `turnDebugHistory` cap 미구현 항목(:919-922 근접)은 draft (g)가 건드리는 collection-retry 루프와 같은 파일의 인접 영역이므로, 두 작업이 동시에 진행되면 diff 가 인접할 수 있다는 점만 참고(현재는 별 작업으로 진행 중이라는 근거 없음 — INFO 수준).

## [Info] node-output-redesign 인접 영역 참고 (충돌 아님, 후속 참고용)

- `plan/in-progress/node-output-redesign/information-extractor.md:221` 이 `runTurnWithCollectionRetries` 내부의 `turnDebugHistory` cap 부재를 별도 잔여 항목(impl)으로 들고 있다. draft (g)는 같은 함수의 attribution 전달을 테스트로 고정하는 것이라 로직 변경은 없으나, 같은 함수를 대상으로 하는 두 개의 서로 다른 작업 트랙이 존재한다는 사실만 기록. 실제 코드 수정이 아니므로 충돌 아님.

## 요약

draft (e)/(g)는 `plan/in-progress/resume-llm-usage-attribution.md` 의 INFO#1/INFO#4 에 정확히 1:1 대응하며 draft 의 코드 라인 인용(2599, 1037, 921, 954, retryState 헬퍼)도 실제 코드와 일치해 근거는 견고하다. 다만 같은 세션에서 이미 진행 중인 문서 PR #898 이 같은 plan 파일의 인접 리스트 항목(INFO#3 및 4개 잔여 follow-up)을 편집하고 있어 두 PR 이 병합 순서와 무관하게 텍스트 merge 충돌을 겪을 개연성이 높고, draft 자체는 plan 파일 갱신을 아예 계획에 넣지 않아 어느 쪽이 체크박스를 언제 반영할지가 불명확하다. 또한 draft (e)와 별도로 스폰된 task_6da430a3 이 동일 object literal 을 더 큰 리팩터로 흡수하려 하므로, (e)는 그대로 진행하되 그 리팩터가 동일한 타입 안전성을 보존하도록 근거를 인계할 필요가 있다. plan 의 `plan/complete/` 이동 여부는 현재 base(cc3dafa8c, #898 미포함) 기준으로는 시기상조 — a/b/c/d/f 다섯 항목이 아직 main 에 반영되지 않았으므로, 이 PR이 e/g만 체크한 채 이동을 감행하면 안 되며, #898 병합·rebase 확인 후 "마지막 PR" 쪽에서 `spec_impact` 리스트(`spec/data-flow/7-llm-usage.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/6-knowledge-base.md`, `spec/data-flow/13-agent-memory.md`, `spec/1-data-model.md`)를 선언하며 `git mv` 로 이동해야 한다.

## 위험도

MEDIUM

STATUS: DONE

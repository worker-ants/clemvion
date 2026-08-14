# Cross-Spec 일관성 검토 — cross_spec

## 검토 대상 요약

이번 diff(`origin/main...HEAD`, 8 커밋)는 `spec/**` 를 전혀 건드리지 않고
(`git diff origin/main...HEAD --stat -- spec/` = 빈 결과, 직접 확인) 아래 세 코드
파일만 바꾼다 — `llmCalls` external-strip 을 `websocket.service.ts`(fanout) 단독
소유에서 `shared/utils/strip-external-only-fields.ts` 공유 유틸로 승격하고,
**REST 단발 조회 `GET /api/external/executions/:id`**(`interaction.service.ts
getStatus()`)에도 처음으로 적용한 보안 수정이다:

- `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (신규)
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `codebase/backend/src/modules/external-interaction/interaction.service.ts`

target 지시(`## ⚠️ 현재 구현 코드의 기준`)에 따라 프롬프트에서 컨텍스트 예산 초과로
생략된 `spec/5-system/14-external-interaction-api.md`(101,724자) 와 `<git diff>`
섹션은 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff`/`Read`/`grep` 으로 직접 재확인했다.

이 fix 의 JSDoc·커밋 메시지는 SoT 로 `spec/5-system/6-websocket-protocol.md §4.4`
(`llmCalls[]` strip 결정) + `EIA §6.5` 를 명시한다. **동일 불변식을 공유해야 하는
다른 spec 파일(`14-external-interaction-api.md` §R17)** 이 실제로 이 코드 변경과
정합한지를 이 관점에서 대조했다.

---

## 발견사항

### [CRITICAL] `spec/5-system/14-external-interaction-api.md` §R17 + `6-websocket-protocol.md` §4.4 가 이번에 확장된 strip 범위를 반영하지 못한 채 여전히 반대로 서술한다

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction.service.ts:341-355`(`getStatus()` — `nodeOutput` 조립에 `stripExternalOnlyFields(deepRedactSecrets(nodeExec.outputData ?? {}), MAX_REDACT_DEPTH)` 신규 적용, 주석 자체가 `"12_06_21" cross_spec CRITICAL 1` 을 SoT 로 인용)
- **충돌 대상**:
  - `spec/5-system/6-websocket-protocol.md:519`(§4.4) — *"strip 대상은 **본 WS 이벤트 필드뿐**이며, DB 영속 경로 `NodeExecution.output_data.meta.turnDebug[i].llmCalls` 및 그를 출처로 하는 실행 이력 디버그 패널은 **영향 없다**."*
  - `spec/5-system/6-websocket-protocol.md:1056-1064`(Rationale "`ai_message.llmCalls[]` 외부 수신자 strip") — 동일 문구 반복
  - `spec/5-system/14-external-interaction-api.md:1346-1352`(§R17 "표면 제약(보안)") — *"ai-turn-orchestrator 의 두 waiting emit 은 conversationConfig 를 `deepRedactSecrets` 로 마스킹하고(에디터 전용 `turnDebug.llmCalls` 는 건드리지 않음), **`getStatus` 는 `nodeOutput` 전체 + terminal `result`/`error` 의 `outputData` 를 `deepRedactSecrets` 로 마스킹한다**(REST 는 `sanitizePayloadForWs` 미적용 경로라 필수)."*
- **상세**: 두 spec 파일 모두 지금도 "REST `getStatus()` 는 `deepRedactSecrets`(값 마스킹)만 거치고, `llmCalls` 같은 **필드 제거**(strip)는 WS 이벤트(fanout)에만 적용된다"고 정상 동작인 것처럼 정면으로 서술한다. 그런데 이번 diff 는 정확히 그 REST `getStatus()` 경로에 `stripExternalOnlyFields` 를 새로 추가했다 — 코드 자신의 주석이 "`deepRedactSecrets` 는 값 마스킹이지 필드 제거가 아니다 ... fanout 만 막는 것은 반쪽이었다"라고 명시하며 위 두 spec 문서가 서술하는 바로 그 "REST 는 값-마스킹만"이 **불충분한 결함**이었다고 스스로 진단한다. 즉 코드는 이미 spec 서술을 반증하는 방향으로 바뀌었는데, 두 spec 파일의 정상 동작 서술은 갱신되지 않았다.
  이 정확한 간극은 **이전 라운드 `review/consistency/2026/08/14/12_06_21/cross_spec.md` CRITICAL 1** 이 이미 지적했고, 그 리포트의 제안 ①(코드 fix)과 제안 ②(`spec/5-system/14-external-interaction-api.md` §R17 갱신)를 함께 냈다. 이번 diff 는 제안 ①만 구현했고(`git diff --stat -- spec/` 가 빈 결과인 것으로 확인), 제안 ②는 이행되지 않았다 — 즉 그 CRITICAL 의 근본 원인("WS §4.4 의 '모든 외부 fanout 수신자' 문구가 REST `getStatus` 를 포함하는지 spec 상 모호함")은 코드가 고쳐진 뒤에도 spec 텍스트에는 그대로 남아 있다.
  또한 이 gap 을 닫기 위해 이미 만들어진 planner draft `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 항목 (7)("`llmCalls` strip SoT 가 실제 누출 표면을 안 덮는다")도 **REST `getStatus`/`interaction.service.ts` 를 언급하지 않는다** — 그 항목은 WS wire envelope 의 depth-1→깊이 무관 강화(§6.2/§4.4 Rationale 확장)만 다루며, 이 draft 가 쓰여진 시점(같은 세션, 이전 커밋들) 이후에야 REST 누출이 별도로 발견·수정됐기 때문이다. 따라서 이 draft 가 그대로 적용돼도 §R17 의 위 문장은 여전히 stale 로 남는다.
  이 프로젝트는 이미 이 정확한 클래스의 혼동을 한 번 겪었다 — `plan/complete/eia-strip-llmcalls.md:48` 은 *"C-1 = false positive (spec 은 83d60340 에 이미 strip-only 반영; reviewer 가 spec-draft 의 'Before' 블록을 현행 spec 으로 오인)"* 라고 기록한다. 즉 이 영역의 spec 문서 staleness 는 실제로 리뷰 판정을 오도한 전례가 있다.
- **제안**:
  1. (project-planner) `spec/5-system/14-external-interaction-api.md` §R17 의 "`getStatus` 는 `nodeOutput` 전체 ... 를 `deepRedactSecrets` 로 마스킹한다" 문장을 "`deepRedactSecrets` 로 값 마스킹한 뒤 `stripExternalOnlyFields` 로 `llmCalls` 를 필드 제거한다(fanout 과 동일 처방, `shared/utils/strip-external-only-fields.ts`)"로 갱신 — terminal `result`/`error` 는 아래 WARNING 참조.
  2. `spec/5-system/6-websocket-protocol.md:519`·`:1056-1064` 의 "strip 대상은 본 WS 이벤트 필드뿐" 문구를 "WS 이벤트(fanout) + EIA REST `getStatus()` 양쪽"으로 넓힌다. "DB 영속 경로 ... 영향 없다"는 여전히 참(리턴 값만 strip, DB row·디버그 패널 불변)이므로 그 부분은 유지.
  3. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 항목 (7)에 이번 REST `getStatus` 확장분을 추가 등재해, draft 가 확정될 때 §R17 이 함께 갱신되도록 한다(현재는 누락).

### [WARNING] 같은 함수 안에서 `nodeOutput` 은 새 strip 을 받았지만 형제 `result`/`error` 는 여전히 `deepRedactSecrets` 단독 — 방어 범위가 비대칭

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-355`(`nodeOutput` — `stripExternalOnlyFields` 적용됨) vs `:408-421`(terminal `result`/`error` — `deepRedactSecrets` 단독, strip 미적용)
- **충돌 대상**: 같은 커밋의 같은 파일 내 자기 모순 — 주석(`:346-347`) *"fanout 과 **같은 수준**으로 debug 필드를 제거한다"* 이 함수 전체가 아니라 `nodeOutput` 경로에만 적용됨
- **상세**: `result`/`error` 는 `execution.outputData`(`Execution` 엔티티, `NodeExecution.outputData` 와 다른 컬럼)에서 온다. 직접 추적한 결과 — 정상 COMPLETED 종결 시 `Execution.outputData` 는 `context.nodeOutputCache[lastNodeId]`(`execution-engine.service.ts:2358`)이고, 이는 `toEngineFlatShape(adapted)`(`handler-output.adapter.ts:109-189`)의 산출물인데 이 함수는 `NodeHandlerOutput.meta`(= `turnDebug` 가 실리는 자리)를 **결과 객체에 포함하지 않는다** — 즉 현재는 `Execution.outputData` 구조상 `meta.turnDebug` 가 실릴 수 없어 이 경로는 **지금은** 안전하다(반면 `NodeExecution.outputData` 는 같은 파일 `execution-engine.service.ts:5936` 에서 `adaptHandlerReturn` 이전의 **raw handler 반환값**을 그대로 저장하므로 `meta.turnDebug` 를 그대로 보존한다 — `nodeOutput` 경로가 leak 이었던 이유).
  문제는 이 안전성이 **spec 이나 코드 주석 어디에도 명시되지 않은, 우연한 구조적 사실**이라는 점이다. `toEngineFlatShape` 가 향후 `.meta` 를 포함하도록 바뀌거나(예: `$node[X].meta` 표현식 지원 확장), `Execution.outputData` 채우기 로직이 raw 값을 쓰도록 바뀌면, 지금 고친 것과 **완전히 동일한 클래스의 leak** 이 `result`/`error` 필드로 조용히 재발한다 — 그런데 이 diff 의 회귀 테스트(`interaction.service.spec.ts` 신규 45줄)는 `nodeOutput`/waiting 경로만 검증하고 `result`/`error` 비-strip 을 커버하지 않는다(직접 확인).
- **제안**: 다음 중 하나를 명시적으로 택해 문서화한다 — (a) `result`/`error` 에도 `stripExternalOnlyFields` 를 대칭 적용(방어심층화, 비용 거의 0 — `EXTERNAL_STRIPPED_FIELDS` 가 없으면 no-op), 또는 (b) `Execution.outputData` 가 구조적으로 `.meta` 를 가질 수 없다는 불변식을 `interaction.service.ts:406-407` 주석 + `spec/5-system/14-external-interaction-api.md` §R17 에 명시하고, 그 불변식이 깨지면 실패하는 회귀 테스트(예: `.meta` 가 있는 fixture 로 `Execution.outputData` 를 만들어 `result` 에 `llmCalls` 가 새지 않는지 확인)를 추가한다.

### [INFO] `CHANGELOG.md` Unreleased 항목이 depth-1→깊이 무관 fanout 강화만 서술하고 REST `getStatus` 확장은 별도 기록이 없다

- **target 위치**: `CHANGELOG.md:3-25`(신규 Unreleased 섹션, 커밋 `81f2c60d6`/`5df89cda6` 범위만 서술)
- **충돌 대상**: 없음(직접 모순 아님) — `interaction.service.ts` REST 확장(커밋 `34e32e62f`)에 대응하는 CHANGELOG 서술이 없다
- **상세**: 위 CRITICAL 의 "이미 유출된 데이터에 대한 사후 대응 — 운영 판단 필요" 항목(`plan-draft-eia-62-waiting-payload.md` 처분 목록)이 CHANGELOG 만을 근거로 운영 통지 여부를 판단할 여지가 있는데, REST 경로로 새어나간 것에 대한 언급이 CHANGELOG 에 없으면 그 판단 자료가 불완전해진다.
- **제안**: 급하지 않음. spec 갱신(위 CRITICAL) 시 함께 정리하면 충분.

---

## 요약

이번 diff 는 이전 라운드(`12_06_21` cross_spec CRITICAL 1)가 지적한 실제 보안 결함 — REST `GET /api/external/executions/:id` 가 `deepRedactSecrets` 값-마스킹만 거쳐 `nodeOutput.meta.turnDebug[].llmCalls`(raw LLM 프롬프트)를 그대로 반환하던 문제 — 를 코드 레벨에서는 올바르게 닫는다(직접 확인: `stripExternalOnlyFields` 신규 적용, `__proto__` 안전, lazy clone-on-write, 테스트로 실증). 그러나 그 CRITICAL 이 함께 요구했던 spec 갱신(`spec/5-system/14-external-interaction-api.md` §R17)은 이번 diff 에 포함되지 않았다(`spec/` 변경 0건, 직접 확인) — §R17 과 `6-websocket-protocol.md §4.4` 는 지금도 "REST `getStatus` 는 `deepRedactSecrets` 값-마스킹만 받고 strip 은 WS 이벤트 전용"이라고 코드가 방금 반증한 서술을 그대로 유지한다. 이 프로젝트는 정확히 이 영역의 spec staleness 가 이전에 리뷰어를 오도한 전례(`eia-strip-llmcalls.md` C-1 false positive)가 있어 재발 위험이 실증적이다. 부가로, 같은 함수 안에서 `nodeOutput` 만 strip 을 받고 형제 `result`/`error` 는 받지 못한 비대칭이 있는데 지금은 구조적으로 안전하지만 문서화되지 않은 우연에 기댄다.

## 위험도

CRITICAL

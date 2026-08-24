# 요구사항(Requirement) 충족 검토 — `envelope.output` allowlist 확장 (`node-output-envelope`)

## 검토 범위

19개 변경 파일 중 실질 코드/스펙 변경은 `codebase/backend/src/modules/websocket/websocket.service.ts`(구현),
`websocket.service.spec.ts`(테스트), `spec/5-system/14-external-interaction-api.md`(EIA §R17),
`spec/5-system/6-websocket-protocol.md`(WS §4.1/§4.4), `spec/conventions/conversation-thread.md`(§8.4
자기-반증형 소정정)이다. 나머지(`CHANGELOG.md`, `plan/**`, `review/consistency/2026/08/24/10_44_28/**`)는
계획·이력·직전 라운드 consistency-check 산출물이며, `review/consistency/.../RESOLUTION.md`가 그 라운드의
CRITICAL/WARNING을 이미 처리한 상태다.

핵심 변경: `allowlistFanoutNodeOutput`이 좁히던 두 지점(`envelope.nodeOutput`,
`envelope.buttonConfig.nodeOutput`)에 세 번째 지점(`envelope.output` — `execution.node.completed`/`.failed`가
싣는 `NodeExecution.outputData`)을 추가. 그 근거로 `#1208`이 유예했던 "이종 payload라 같은 목록을 걸 수 없다"는
전제를 실 DB 조회(e2e 285건, `node_execution.output_data` 93행)로 반증했다고 주장.

## 독립 검증 결과 (직접 실행/실측)

- `narrowTopLevelNodeOutput(envelope, key)` → `allowlistFanoutNodeOutput`에서 `'nodeOutput'`·`'output'` 순으로
  적용, `toFanoutEnvelope`(유일 외부 출구)에서 두 emit 경로(`emitExecutionEvent`/`emitNodeEvent`) 공용 배선 확인.
- `node-output-allowlist.ts`(이번 PR 무변경) 확인: `NODE_OUTPUT_ALLOWED_KEYS` 13키, `NodeHandlerOutput` 공개키
  5개(`config,output,meta,port,status`)를 컴파일타임 `assertAllowlistCoversHandlerContract`로 결속 — 핸들러가
  새 공개키를 추가하면 빌드가 깨지므로 "미래 새 키가 조용히 새는" 회귀는 타입 레벨에서 차단됨을 확인.
- `resolveButtonInteraction`(button-interaction.service.ts:503 근방) → `setNodeOutput`은 in-memory
  `nodeOutputCache`에만 flat record를 쓰고, `nodeExec.outputData`(button-interaction.service.ts:542)는
  `buildResumedStructuredOutput`의 반환값(`NodeHandlerOutput`, `prevStructured.config/meta` 보존)이 실제로
  대입됨을 소스에서 확인 — 이 PR/spec이 주장하는 "그 flat record는 outputData가 되지 않는다"는 기술적 근거가
  실측과 일치.
- `ai-turn-orchestrator.service.ts:1449-1458`의 `finalAdapted ?? context.nodeOutputCache[node.id]` 폴백
  존재 확인 — "잔여 위험"으로 명시 트래킹된 것과 일치, 이번 PR 스코프 밖으로 남긴 판단은 합리적(영속 계약
  변경까지 번지는 별건).
- `emitNodeEvent`/`emitExecutionEvent`가 만드는 다른 top-level `output`류 필드(`EXECUTION_MESSAGE`의
  `presentations[].output`, 종결 이벤트의 `result`)는 키 이름이 다르거나 top-level이 아니라 새 필터와
  충돌하지 않음을 확인 — 의도치 않은 과잉 좁힘 없음.
- `codebase/backend`에서 `npx jest websocket.service.spec.ts node-output-allowlist.spec.ts` 실행 →
  **2 suites / 84 tests 전부 통과**.
- `npx tsc --noEmit`으로 변경 파일 타입체크 → `websocket.service.ts`/`node-output-allowlist.ts` 신규 오류
  없음(`websocket.service.spec.ts:578`의 기존 타입 오류 1건은 이번 diff 밖 pre-existing이며 hunk 범위 밖임을
  `git diff` hunk로 확인).
- `grep -rln "envelope\.output" spec/`로 미러 누락 여부 확인 → 정확히 이번 diff가 고친 3개 파일만 매치, 놓친
  4번째 미러 없음.

## 발견사항

- **[WARNING]** "emit 5곳" 카운트가 실제보다 1개 적다 — 실측: `execution-engine` 2 · `form-interaction` 1 ·
  `button-interaction` 1 · **`ai-turn-orchestrator` 2**(합계 6), 문서는 `ai-turn-orchestrator`를 1개로 세어
  합계 5로 적음.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:475`(JSDoc "emit 5곳"),
    `codebase/backend/src/modules/websocket/websocket.service.spec.ts:913`(JSDoc "emit 5곳"),
    `spec/5-system/14-external-interaction-api.md`(§R17 재정정 블록, diff 상 `1759`행 부근 "emit 5곳:
    `execution-engine` 2 · `form-interaction` · `button-interaction` · `ai-turn-orchestrator`")
  - 상세: `grep -rn "output: nodeExec" codebase/backend/src/modules/execution-engine/*.ts`로 직접 세면
    `ai-turn-orchestrator.service.ts`에 `output: nodeExec.outputData`를 싣는 emit이 **두 곳**이다
    (`:1541` NODE_FAILED, `:1636` NODE_COMPLETED) — `finalOutput`이 `nodeExec.outputData`에 대입된 뒤
    FAILED/COMPLETED 두 분기 모두에서 emit되기 때문. `execution-engine.service.ts`의 2곳(`:6120` COMPLETED,
    `:6381` `finalizeErrorPortNode`의 FAILED), `form-interaction.service.ts`(`:344`) 1곳,
    `button-interaction.service.ts`(`:581`) 1곳과 합치면 총 **6곳**이지 5곳이 아니다. 기능적으로는
    `toFanoutEnvelope` chokepoint 하나가 emit 사이트 수와 무관하게 전부 커버하므로 보안 동작에는 영향이
    없다 — 다만 이 PR 전체의 서사가 "이전 실측(#1208의 유예 근거)이 틀렸다"를 재확인·정정하는 것이라, 같은
    라운드에 새로 쓴 정량 주장이 다시 부정확한 것은 신뢰도 측면에서 지적할 가치가 있다. 세 곳(코드 JSDoc
    2군데 + spec 1곳)에 동일하게 미러돼 있어 다음 사람이 "emit 5곳"을 근거로 grep 없이 감사하면 1곳을 놓친다.
  - 제안: 세 위치 모두 "emit 5곳"→"emit 6곳"으로 정정하고 breakdown을
    "`execution-engine` 2 · `form-interaction` 1 · `button-interaction` 1 · `ai-turn-orchestrator` 2"로
    갱신. `websocket.service.ts`/`.spec.ts`의 JSDoc은 developer가 직접 고칠 수 있는 코드 주석이고,
    `spec/5-system/14-external-interaction-api.md`는 API 계약 문서이므로 이 정정은 이번 PR이 이미 열어 둔
    "(planner 턴)" 처리 범위에 함께 얹거나 후속 라운드에서 반영.

- **[WARNING]** `narrowTopLevelNodeOutput` 함수 docstring이 리팩터 전 상태를 그대로 두어 "두 자리"라고
  적혀 있으나 실제로는 세 자리(+버튼 중첩분까지 포함하면 네 자리 개념)를 좁히는 시스템의 일부로 바뀌었다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts`의 `narrowTopLevelNodeOutput` 함수
    바로 위 JSDoc 블록(함수 정의 직전, "fanout envelope 안의 `nodeOutput` 두 자리를 fail-closed allowlist로
    좁힌다."로 시작)
  - 상세: 이 JSDoc은 리팩터 전 `allowlistFanoutNodeOutput`(구 이름) 전체에 달려 있던 문서였다. 이번 diff가
    그 함수를 제네릭 헬퍼 `narrowTopLevelNodeOutput(envelope, key)`로 쪼개고 새 `key: 'nodeOutput' | 'output'`
    파라미터를 추가했는데, 함수 바로 위 JSDoc은 갱신되지 않고 그대로 남았다. 문서 내용("`nodeOutput` **두
    자리**를 좁힌다", "폼 waiting 은 `nodeOutput`, 버튼 waiting 은 `buttonConfig.nodeOutput`")은 (a) 이 함수가
    실제로는 호출마다 **하나의 top-level 키만** 좁히는 제네릭 헬퍼라는 점, (b) `output` 키 케이스를 전혀
    언급하지 않는다는 점에서 함수의 실제 동작과 어긋난다. 전체 그림(3키 처리)은 그 아래
    `allowlistFanoutNodeOutput` 래퍼의 별도 인라인 주석("**키 이름이 둘인 것이 이 표면의 함정이었다**")에
    설명돼 있어 실제 동작 이해에는 지장이 없지만, `narrowTopLevelNodeOutput`만 단독으로 읽는 유지보수자는
    stale JSDoc에 오도될 수 있다(item 4 "의도와 구현 간 괴리").
  - 제안: JSDoc을 "fanout envelope의 top-level 한 키를 fail-closed allowlist로 좁히는 제네릭 헬퍼 — 호출부가
    `nodeOutput`/`output` 두 키에 각각 적용한다"는 취지로 정정하고, "두 자리"라는 구체적 개수 서술은
    래퍼 함수(`allowlistFanoutNodeOutput`)의 주석으로 옮기거나 삭제.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` §R17 / `spec/5-system/6-websocket-protocol.md`
  §4.4·§4.1는 CLAUDE.md 기준 "API 계약" 문서이며, 자기-반증형 소정정 예외(조건 2: API 계약 제외)가 명시적으로
  적용되지 않는다. 이번 diff는 이 두 파일을 developer 소유 plan(`node-output-envelope.md`, `owner: developer`)
  커밋 안에서 직접 수정했다 — 다만 이는 이미 같은 세션의 `/consistency-check --impl-prep`
  (`review/consistency/2026/08/24/10_44_28`)이 CRITICAL로 잡았고, `RESOLUTION.md`가 "plan 체크리스트에
  `(planner 턴)`으로 명시된 항목을 이 PR 안에서 그 턴으로 수행했다"는 절차적 답변과 함께 frontmatter를
  두 블록(예외 미적용분/예외 적용분)으로 분리해 이미 반영한 상태다(`plan/in-progress/node-output-envelope.md`
  frontmatter 확인). 코드 review 관점에서는 이 절차적 쟁점이 같은 PR 안에서 이미 한 라운드 소화됐다는 점만
  기록하고, 실질적 spec 내용(fail-closed allowlist, 근거 표)이 구현과 line-level로 일치함은 위 "독립 검증
  결과"에서 확인했다.
  - 위치: `plan/in-progress/node-output-envelope.md` frontmatter, `review/consistency/2026/08/24/10_44_28/RESOLUTION.md`
  - 제안: 별도 조치 불요(이미 처리됨). 다음 `/ai-review`·`/consistency-check` 라운드에서 동일 쟁점이 재부상하면
    이 RESOLUTION을 참조.

- **[INFO]** TODO/FIXME/HACK/XXX 등 미완성 표식 없음. 새 캐너리 테스트("[캐너리]", "[잔여 고정]")는 모두 현재
  동작을 고정하는 의도된 테스트이며 미완 작업 표식이 아님(`finalAdapted ?? nodeOutputCache` 폴백 잔여 위험은
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 별건으로 정식 등재돼 추적됨 — 방치 아님).

## 요약

`envelope.output`(execution.node.completed/.failed) allowlist 확장은 기존 `#1208`이 유예했던 CRITICAL
잔여(`23_29_27` cross_spec)를 정확히 닫는다. 핵심 기술 주장(button 재개 flat record는 `nodeOutputCache`에만
남고 `outputData`에는 `NodeHandlerOutput` shape만 대입된다는 것)을 소스 레벨에서 직접 재검증했고 사실과
일치했으며, `NodeHandlerOutput` 공개 키가 컴파일타임 결속으로 allowlist에 강제 포함되므로 향후 새 키 누출도
구조적으로 차단된다. 테스트(신규 캐너리 2건 포함 84개)와 타입체크 모두 통과했고, 내부 WS 불변·chat-channel
렌더 보존 등 회귀 방지 대조군도 갖춰져 있다. 유일한 실질 흠은 "emit 5곳"이라는 정량 주장이 실제로는 6곳이라는
사소하지만 세 곳에 미러된 사실 오류(WARNING)와, 리팩터된 헬퍼 함수의 stale JSDoc(WARNING)이다. 둘 다 보안
동작 자체에는 영향을 주지 않는 문서 정확성 이슈다.

## 위험도

LOW
